from dotenv import load_dotenv

load_dotenv()

from datetime import date

import psycopg2.extras
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import ai
from auth import get_current_user, router as auth_router
from db import get_connection, init_db

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

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
def check_weather(mountain_id: int, hiking_date: date = Query(..., alias="date")):
    fetch_mountain(mountain_id)  # 404s if the mountain doesn't exist

    if hiking_date < date.today():
        raise HTTPException(status_code=400, detail="Hiking date can't be in the past")

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        "SELECT * FROM weather_forecasts WHERE mountain_id = %s AND hiking_date = %s",
        (mountain_id, hiking_date),
    )
    forecast = cursor.fetchone()
    cursor.close()
    conn.close()

    return {
        "date_valid": True,
        "forecast": dict(forecast) if forecast else None,
    }


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
        SELECT p.plan_id, p.date, m.mountain_id, m.mountain_name, m.location,
               m.image_url, m.difficulty
        FROM plans p
        JOIN mountains m ON m.mountain_id = p.mountain_id
        WHERE p.user_id = %s
        ORDER BY p.date ASC
        """,
        (current_user["user_id"],),
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return [dict(row) for row in rows]


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
# AI analysis
# ---------------------------------------------------------------------------

@app.post("/ai/difficulty/{mountain_id}")
def ai_difficulty(mountain_id: int):
    mountain = fetch_mountain(mountain_id)
    try:
        analysis = ai.analyze_difficulty(mountain)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}")
    return {"mountain_id": mountain_id, "analysis": analysis}


@app.post("/ai/safety/{mountain_id}")
def ai_safety(mountain_id: int, hiking_date: date = Query(None, alias="date")):
    mountain = fetch_mountain(mountain_id)

    weather = None
    if hiking_date:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(
            "SELECT * FROM weather_forecasts WHERE mountain_id = %s AND hiking_date = %s",
            (mountain_id, hiking_date),
        )
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        weather = dict(row) if row else None

    try:
        analysis = ai.analyze_safety(mountain, weather)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}")
    return {"mountain_id": mountain_id, "analysis": analysis}


@app.post("/ai/route-optimization/{mountain_id}")
def ai_route_optimization(mountain_id: int):
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

    try:
        plan = ai.optimize_route(mountain, waypoints)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}")
    return {"mountain_id": mountain_id, "waypoints": waypoints, "plan": plan}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
