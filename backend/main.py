from dotenv import load_dotenv

load_dotenv()

from datetime import date
from typing import Optional
import os
import httpx

import psycopg2.extras
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import datetime
import ai
import weather
from auth import get_current_user, router as auth_router
from analytics import router as analytics_router 

app = FastAPI()

# 2. Register the router with your app
app.include_router(analytics_router)
from db import (
    get_cached_analysis,
    get_connection,
    get_weather_forecast,
    init_db,
    save_cached_analysis,
    save_weather_forecast,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(analytics_router)

# Initialize DB on startup if missing, and apply migrations for existing DBs
init_db()



def fetch_mountain(mountain_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute("SELECT * FROM mountains WHERE mountain_id = %s", (mountain_id,))
    mountain = cursor.fetchone()
    cursor.close()
    conn.close()
    if not mountain:
        raise HTTPException(status_code=404, detail="Mountain not found")
    return dict(mountain)


@app.get("/get")
def get_mountains(search: str = Query(None)):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if search:
        query = "SELECT * FROM mountains WHERE mountain_name ILIKE %s"
        cursor.execute(query, (f"%{search}%",))
    else:
        cursor.execute("SELECT * FROM mountains")

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return [dict(row) for row in rows]


@app.get("/mountains/{mountain_id}")
def get_mountain(mountain_id: int):
    return fetch_mountain(mountain_id)


# ---------------------------------------------------------------------------
# Weather / date & location check
# ---------------------------------------------------------------------------



@app.get("/weather/{mountain_id}")
def check_weather(
    mountain_id: int,
    hiking_date: datetime.date = Query(..., alias="date"), 
    waypoint_id: int = Query(..., alias="waypoint_id"),
    current_user: dict = Depends(get_current_user),
):
    fetch_mountain(mountain_id)

    if hiking_date < date.today():
        raise HTTPException(status_code=400, detail="Hiking date can't be in the past")

    # 1. Fetch exact latitude & longitude for the selected waypoint
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT latitude, longitude 
        FROM route_waypoints 
        WHERE waypoint_id = %s AND mountain_id = %s
        """,
        (waypoint_id, mountain_id),
    )
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Waypoint not found")

    latitude, longitude = row[0], row[1]

    # 2. Query database forecast cache
    cached = get_weather_forecast(mountain_id, hiking_date)
    if cached is not None:
        return {"date_valid": True, "forecast": cached}

    # 3. Call Open-Meteo with waypoint coordinates
    try:
        result = weather.fetch_forecast_for_date(latitude, longitude, hiking_date)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather lookup failed: {e}")

    if result is None:
        return {"date_valid": True, "forecast": None}

    # 4. Save to database cache
    save_weather_forecast(
        mountain_id, hiking_date, result["temperature"], result["humidity"], result["wind_speed"]
    )
    return {"date_valid": True, "forecast": result}

# ---------------------------------------------------------------------------
# Route waypoints
# ---------------------------------------------------------------------------

@app.get("/waypoints/{mountain_id}")
def get_waypoints(mountain_id: int):
    fetch_mountain(mountain_id)

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        "SELECT * FROM route_waypoints WHERE mountain_id = %s ORDER BY sequence_order",
        (mountain_id,),
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return [dict(row) for row in rows]

@app.get("/checkpoints/{route_waypoint_id}")
def get_trail_checkpoints(route_waypoint_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        "SELECT * FROM trail_checkpoints WHERE route_waypoint_id = %s ORDER BY sequence_order ASC;",
        (route_waypoint_id,),
    )
    checkpoints = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(row) for row in checkpoints]

@app.get("/trail-reports/{mountain_id}")
def get_trail_reports(mountain_id: int):
    fetch_mountain(mountain_id)

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    query = """
        SELECT
            tr.report_id,
            tr.mountain_id,
            tr.waypoint_id,
            tr.rating,
            tr.condition,
            tr.comment,
            tr.created_at,
            CONCAT(u.first_name, ' ', u.last_name) AS user_name,
            w.name AS waypoint_name
        FROM trail_reports tr
        LEFT JOIN users u ON tr.user_id = u.user_id
        LEFT JOIN route_waypoints w ON tr.waypoint_id = w.waypoint_id
        WHERE tr.mountain_id = %s
        ORDER BY tr.created_at DESC;
    """

    cursor.execute(query, (mountain_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return [dict(row) for row in rows]


class CreateTrailReportRequest(BaseModel):
    waypoint_id: Optional[int] = None
    rating: int
    condition: str
    comment: str


@app.post("/trail-reports/{mountain_id}")
def create_trail_report(
    mountain_id: int,
    payload: CreateTrailReportRequest,
    current_user: dict = Depends(get_current_user),
):
    fetch_mountain(mountain_id)

    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    if len(payload.comment.strip()) < 10:
        raise HTTPException(status_code=400, detail="Comment must be at least 10 characters")

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if payload.waypoint_id is not None:
        cursor.execute(
            "SELECT waypoint_id FROM route_waypoints WHERE waypoint_id = %s AND mountain_id = %s",
            (payload.waypoint_id, mountain_id),
        )
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail="That trail doesn't belong to this mountain")

    cursor.execute(
        """
        INSERT INTO trail_reports (mountain_id, waypoint_id, user_id, rating, condition, comment)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING report_id, mountain_id, waypoint_id, rating, condition, comment, created_at
        """,
        (
            mountain_id,
            payload.waypoint_id,
            current_user["user_id"],
            payload.rating,
            payload.condition,
            payload.comment.strip(),
        ),
    )
    report = dict(cursor.fetchone())
    report["user_name"] = f'{current_user["first_name"]} {current_user["last_name"]}'
    conn.commit()
    cursor.close()
    conn.close()

    return report

# ---------------------------------------------------------------------------
# Hiking plans
# ---------------------------------------------------------------------------

class CreatePlanRequest(BaseModel):
    mountain_id: int
    date: date


@app.post("/plans")
def create_plan(payload: CreatePlanRequest, current_user: dict = Depends(get_current_user)):
    fetch_mountain(payload.mountain_id)

    if payload.date < date.today():
        raise HTTPException(status_code=400, detail="Hiking date can't be in the past")

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        """
        INSERT INTO plans (user_id, mountain_id, date)
        VALUES (%s, %s, %s)
        RETURNING plan_id, user_id, mountain_id, date
        """,
        (current_user["user_id"], payload.mountain_id, payload.date),
    )
    plan = dict(cursor.fetchone())
    conn.commit()
    cursor.close()
    conn.close()

    return plan


@app.get("/plans")
def list_plans(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        """
        SELECT DISTINCT p.plan_id, p.date, p.user_id AS owner_id, m.mountain_id,
               m.mountain_name, m.location, m.image_url
        FROM plans p
        JOIN mountains m ON m.mountain_id = p.mountain_id
        LEFT JOIN plan_members pm ON pm.plan_id = p.plan_id AND pm.status = 'accepted'
        WHERE p.user_id = %s OR pm.user_id = %s
        ORDER BY p.date ASC
        """,
        (current_user["user_id"], current_user["user_id"]),
    )
    plans = [dict(row) for row in cursor.fetchall()]

    members_by_plan: dict[int, list] = {}
    if plans:
        plan_ids = [p["plan_id"] for p in plans]
        cursor.execute(
            """
            SELECT pm.plan_id, u.user_id, u.first_name, u.last_name
            FROM plan_members pm
            JOIN users u ON u.user_id = pm.user_id
            WHERE pm.plan_id = ANY(%s) AND pm.status = 'accepted'
            """,
            (plan_ids,),
        )
        for row in cursor.fetchall():
            members_by_plan.setdefault(row["plan_id"], []).append(
                {"user_id": row["user_id"], "name": f'{row["first_name"]} {row["last_name"]}'}
            )

    cursor.close()
    conn.close()

    for plan in plans:
        plan["is_owner"] = plan["owner_id"] == current_user["user_id"]
        plan["members"] = members_by_plan.get(plan["plan_id"], [])

    return plans


@app.delete("/plans/{plan_id}")
def delete_plan(plan_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        "SELECT plan_id FROM plans WHERE plan_id = %s AND user_id = %s",
        (plan_id, current_user["user_id"]),
    )
    if not cursor.fetchone():
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Plan not found")

    cursor.execute("DELETE FROM plans WHERE plan_id = %s", (plan_id,))
    conn.commit()
    cursor.close()
    conn.close()

    return {"deleted": True}


# ---------------------------------------------------------------------------
# Group plans: invite members to a shared plan
# ---------------------------------------------------------------------------


class InvitePlanMemberRequest(BaseModel):
    email: EmailStr


@app.post("/plans/{plan_id}/invite")
def invite_plan_member(
    plan_id: int,
    payload: InvitePlanMemberRequest,
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cursor.execute("SELECT plan_id, user_id FROM plans WHERE plan_id = %s", (plan_id,))
    plan = cursor.fetchone()
    if not plan:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan["user_id"] != current_user["user_id"]:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=403, detail="Only the plan owner can invite others")

    cursor.execute("SELECT user_id FROM users WHERE email = %s", (payload.email,))
    invitee = cursor.fetchone()
    if not invitee:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="No TaraPeak account found with that email")
    if invitee["user_id"] == current_user["user_id"]:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="You can't invite yourself")

    cursor.execute(
        """
        INSERT INTO plan_members (plan_id, user_id, status, invited_by)
        VALUES (%s, %s, 'pending', %s)
        ON CONFLICT (plan_id, user_id) DO UPDATE
            SET status = CASE WHEN plan_members.status = 'declined' THEN 'pending'
                               ELSE plan_members.status END
        RETURNING plan_member_id, status
        """,
        (plan_id, invitee["user_id"], current_user["user_id"]),
    )
    result = dict(cursor.fetchone())
    conn.commit()
    cursor.close()
    conn.close()

    return result


@app.get("/plans/invites")
def list_plan_invites(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        """
        SELECT pm.plan_member_id, pm.plan_id, p.date, m.mountain_id, m.mountain_name,
               m.location, m.image_url,
               CONCAT(inviter.first_name, ' ', inviter.last_name) AS invited_by_name
        FROM plan_members pm
        JOIN plans p ON p.plan_id = pm.plan_id
        JOIN mountains m ON m.mountain_id = p.mountain_id
        LEFT JOIN users inviter ON inviter.user_id = pm.invited_by
        WHERE pm.user_id = %s AND pm.status = 'pending'
        ORDER BY p.date ASC
        """,
        (current_user["user_id"],),
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return [dict(row) for row in rows]


def _respond_to_invite(plan_member_id: int, current_user: dict, new_status: str) -> dict:
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        "SELECT plan_member_id FROM plan_members WHERE plan_member_id = %s AND user_id = %s",
        (plan_member_id, current_user["user_id"]),
    )
    if not cursor.fetchone():
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Invite not found")

    cursor.execute(
        "UPDATE plan_members SET status = %s WHERE plan_member_id = %s RETURNING plan_member_id, status",
        (new_status, plan_member_id),
    )
    result = dict(cursor.fetchone())
    conn.commit()
    cursor.close()
    conn.close()

    return result


@app.post("/plans/invites/{plan_member_id}/accept")
def accept_plan_invite(plan_member_id: int, current_user: dict = Depends(get_current_user)):
    return _respond_to_invite(plan_member_id, current_user, "accepted")


@app.post("/plans/invites/{plan_member_id}/decline")
def decline_plan_invite(plan_member_id: int, current_user: dict = Depends(get_current_user)):
    return _respond_to_invite(plan_member_id, current_user, "declined")


# ---------------------------------------------------------------------------
# AI analysis
# ---------------------------------------------------------------------------

@app.post("/ai/difficulty/{mountain_id}")
def ai_difficulty(mountain_id: int, current_user: dict = Depends(get_current_user)):
    mountain = fetch_mountain(mountain_id)

    cached = get_cached_analysis(mountain_id, "difficulty")
    if cached is not None:
        return {"mountain_id": mountain_id, "analysis": cached, "cached": True}

    try:
        analysis = ai.analyze_difficulty(mountain)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}")

    save_cached_analysis(mountain_id, "difficulty", analysis)
    return {"mountain_id": mountain_id, "analysis": analysis, "cached": False}


@app.post("/ai/safety/{mountain_id}")
def ai_safety(
    mountain_id: int,
    hiking_date: date = Query(None, alias="date"),
    current_user: dict = Depends(get_current_user),
):
    mountain = fetch_mountain(mountain_id)
    cache_key = hiking_date.isoformat() if hiking_date else ""

    cached = get_cached_analysis(mountain_id, "safety", cache_key)
    if cached is not None:
        return {"mountain_id": mountain_id, "analysis": cached, "cached": True}

    weather_data = get_weather_forecast(mountain_id, hiking_date) if hiking_date else None

    try:
        analysis = ai.analyze_safety(mountain, weather_data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}")

    save_cached_analysis(mountain_id, "safety", analysis, cache_key)
    return {"mountain_id": mountain_id, "analysis": analysis, "cached": False}


@app.post("/ai/route-optimization/{mountain_id}")
def ai_route_optimization(mountain_id: int, current_user: dict = Depends(get_current_user)):
    mountain = fetch_mountain(mountain_id)

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        "SELECT * FROM route_waypoints WHERE mountain_id = %s ORDER BY sequence_order",
        (mountain_id,),
    )
    waypoints = [dict(row) for row in cursor.fetchall()]
    cursor.close()
    conn.close()

    if not waypoints:
        raise HTTPException(status_code=404, detail="No route data available for this trail")

    cached = get_cached_analysis(mountain_id, "route")
    if cached is not None:
        return {"mountain_id": mountain_id, "waypoints": waypoints, "plan": cached, "cached": True}

    try:
        plan = ai.optimize_route(mountain, waypoints)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}")

    save_cached_analysis(mountain_id, "route", plan)
    return {"mountain_id": mountain_id, "waypoints": waypoints, "plan": plan, "cached": False}

@app.get("/mountains/{mountain_id}/trailheads")
def get_mountain_trailheads(mountain_id: int):
    fetch_mountain(mountain_id)

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    query = "SELECT * FROM trailheads WHERE mountain_id = %s"
    cursor.execute(query, (mountain_id,))
    trailheads = cursor.fetchall()
    cursor.close()
    conn.close()

    return [dict(row) for row in trailheads]


@app.get("/mountains/{mountain_id}/routes")
def get_mountain_routes(mountain_id: int):
    fetch_mountain(mountain_id)

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    query = "SELECT * FROM routes WHERE mountain_id = %s"
    cursor.execute(query, (mountain_id,))
    routes = cursor.fetchall()
    cursor.close()
    conn.close()

    return [dict(row) for row in routes]


@app.get("/routes/{route_id}/waypoints")
def get_route_waypoints(route_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    query = """
        SELECT * FROM route_waypoints 
        WHERE route_id = %s 
        ORDER BY sequence_order ASC;
    """
    cursor.execute(query, (route_id,))
    waypoints = cursor.fetchall()
    cursor.close()
    conn.close()

    return [dict(row) for row in waypoints]

class WaypointCoord(BaseModel):
    latitude: float
    longitude: float


class ORSRequest(BaseModel):
    waypoints: list[WaypointCoord]
    profile: Optional[str] = "foot-hiking"


@app.post("/ors/route")
async def get_ors_route(payload: ORSRequest):
    if not payload.waypoints or len(payload.waypoints) < 2:
        raise HTTPException(status_code=400, detail="At least two waypoints are required.")

    coordinates = [[float(wp.longitude), float(wp.latitude)] for wp in payload.waypoints]
    radiuses = [2000 for _ in payload.waypoints]

    ors_api_key = os.getenv("ORS_API_KEY", "YOUR_OPENROUTESERVICE_API_KEY")
    ors_url = f"https://api.openrouteservice.org/v2/directions/{payload.profile}/geojson"

    headers = {
        "Authorization": ors_api_key,
        "Content-Type": "application/json",
    }
    body = {"coordinates": coordinates, "radiuses": radiuses, "elevation": False}

    try:
        async with httpx.AsyncClient() as client:
            ors_response = await client.post(ors_url, json=body, headers=headers, timeout=10.0)

        if ors_response.status_code != 200:
            print("OpenRouteService Error:", ors_response.text)
            raise HTTPException(
                status_code=ors_response.status_code,
                detail="Failed to fetch trail path from ORS",
            )

        data = ors_response.json()
        raw_coords = data.get("features", [{}])[0].get("geometry", {}).get("coordinates", [])

        route_polyline = [[lat, lng] for lng, lat in raw_coords]
        return {"route": route_polyline}

    except httpx.RequestError as err:
        print("Server error fetching ORS route:", err)
        raise HTTPException(status_code=500, detail="Internal server error connecting to ORS")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
