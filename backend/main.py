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
from db import (
    create_notification,
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
    cached = get_weather_forecast(waypoint_id, hiking_date)
    if cached is not None:
        return {"date_valid": True, "forecast": cached}

    # 3. Call Open-Meteo with waypoint coordinates
    try:
        result = weather.fetch_forecast_for_date(latitude, longitude, hiking_date)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather lookup failed: {e}")

    if result is None:
        return {"date_valid": True, "forecast": None}

    save_weather_forecast(
        waypoint_id, 
        hiking_date, 
        result["temperature"], 
        result["humidity"], 
        result["wind_speed"],
        result["precipitation_mm"],
        result["weather_code"]
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


@app.get("/trail-reports/me")
def get_my_trail_reports(
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cursor.execute(
        """
        SELECT
            tr.report_id,
            tr.rating,
            tr.condition,
            tr.comment,
            tr.created_at,

            m.mountain_name,
            m.image_url,

            rw.name AS trail_name

        FROM trail_reports tr

        JOIN mountains m
            ON tr.mountain_id = m.mountain_id

        LEFT JOIN route_waypoints rw
            ON tr.waypoint_id = rw.waypoint_id

        WHERE tr.user_id = %s

        ORDER BY tr.created_at DESC
        """,
        (current_user["user_id"],),
    )

    reports = cursor.fetchall()

    cursor.close()
    conn.close()

    return [dict(r) for r in reports]
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

class GearItemPayload(BaseModel):
    gear_name: str
    category: Optional[str] = "Other"
    is_required: bool = True
    reason: Optional[str] = ""


class CreatePlanRequest(BaseModel):
    mountain_id: int
    waypoint_id: int
    date: date

    # AI output generated for this exact mountain/trail/date, persisted with
    # the plan so it survives later refreshes of the shared analysis cache.
    ai_gear_summary: Optional[str] = None
    ai_difficulty_analysis: Optional[str] = None
    ai_safety_analysis: Optional[str] = None
    ai_route_plan: Optional[str] = None
    gear: Optional[list[GearItemPayload]] = None

    checkpoint_id: Optional[int] = None


def _assert_trail_belongs_to_mountain(cursor, mountain_id: int, waypoint_id: int) -> dict:
    cursor.execute(
        "SELECT * FROM route_waypoints WHERE waypoint_id = %s AND mountain_id = %s",
        (waypoint_id, mountain_id),
    )
    trail = cursor.fetchone()
    if not trail:
        raise HTTPException(status_code=400, detail="That trail doesn't belong to this mountain")
    return dict(trail)


def _store_plan(payload: CreatePlanRequest, current_user: dict) -> dict:
    fetch_mountain(payload.mountain_id)

    if payload.date < date.today():
        raise HTTPException(status_code=400, detail="Hiking date can't be in the past")

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        _assert_trail_belongs_to_mountain(cursor, payload.mountain_id, payload.waypoint_id)

        cursor.execute(
            """
            INSERT INTO plans (
                user_id, mountain_id, waypoint_id, date, checkpoint_id,
                ai_gear_summary, ai_difficulty_analysis, ai_safety_analysis, ai_route_plan
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING plan_id, user_id, mountain_id, waypoint_id, date, checkpoint_id,
                      ai_gear_summary, ai_difficulty_analysis, ai_safety_analysis, ai_route_plan
            """,
            (
                current_user["user_id"],
                payload.mountain_id,
                payload.waypoint_id,
                payload.date,
                payload.checkpoint_id,  # ✅ Stored here
                payload.ai_gear_summary,
                payload.ai_difficulty_analysis,
                payload.ai_safety_analysis,
                payload.ai_route_plan,
            ),
        )
        plan = dict(cursor.fetchone())

        if payload.gear:
            cursor.executemany(
                """
                INSERT INTO gear_recommendations (plan_id, gear_name, category, reason, is_required)
                VALUES (%s, %s, %s, %s, %s)
                """,
                [
                    (
                        plan["plan_id"],
                        item.gear_name,
                        item.category or "Other",
                        item.reason or "",
                        item.is_required,
                    )
                    for item in payload.gear
                ],
            )

        if payload.checkpoint_id:
            cursor.execute(
                """
                SELECT checkpoint_id 
                FROM trail_checkpoints 
                WHERE route_waypoint_id = %s 
                  AND checkpoint_id BETWEEN 1 AND %s
                ORDER BY sequence_order ASC
                """,
                (payload.waypoint_id, payload.checkpoint_id),
            )
            checkpoints_to_insert = cursor.fetchall()

            # ✅ Fixed typo from checkpoints_to_insets to checkpoints_to_insert
            if checkpoints_to_insert:
                cursor.executemany(
                    """
                    INSERT INTO plan_checkpoints (plan_id, checkpoint_id)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    [(plan["plan_id"], cp["checkpoint_id"]) for cp in checkpoints_to_insert],
                )
        
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

    plan["gear"] = [item.model_dump() for item in (payload.gear or [])]
    return plan


@app.post("/plans/save")
def save_plan(payload: CreatePlanRequest, current_user: dict = Depends(get_current_user)):
    """Persist the final mountain, trail, date, and AI output for a hike plan."""
    return _store_plan(payload, current_user)


@app.post("/plans")
def create_plan(payload: CreatePlanRequest, current_user: dict = Depends(get_current_user)):
    """Alias of /plans/save kept for existing clients."""
    return _store_plan(payload, current_user)


@app.get("/plans")
def list_plans(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        """
        SELECT DISTINCT
    p.plan_id,
    p.date,
    p.user_id AS owner_id,
    p.waypoint_id,
    p.updated_at,
    p.is_completed,          
    p.completed_at::text,    
    p.completion_time::text,

    m.mountain_id,
    m.mountain_name,
    m.location,
    m.image_url,
    m.terrain,
    m.description,
    m.hazards,

    rw.name AS trail_name,
    rw.description AS trail_description,
    rw.distance_from_start_km,
    rw.estimated_time,
    rw.difficulty

FROM plans p

JOIN mountains m
ON m.mountain_id = p.mountain_id

JOIN route_waypoints rw
ON rw.waypoint_id = p.waypoint_id

LEFT JOIN plan_members pm
ON pm.plan_id = p.plan_id
AND pm.status = 'accepted'

WHERE p.user_id = %s
OR pm.user_id = %s

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


class UpdatePlanRequest(BaseModel):
    # Qualified as datetime.date on purpose: a field literally named `date`
    # with a default shadows the bare `date` type when Pydantic resolves
    # annotations, which silently collapses the field type to None.
    date: Optional[datetime.date] = None
    waypoint_id: Optional[int] = None


@app.patch("/plans/{plan_id}")
def update_plan(
    plan_id: int,
    payload: UpdatePlanRequest,
    current_user: dict = Depends(get_current_user),
):
    """Organizer edits the plan; every member record is synced in the same transaction.

    Members read the plan through plan_id, so the new date/trail is visible to
    them the moment this commits. On top of that we stamp plan_members.synced_at
    and queue a notification per member, so each member record carries proof of
    the change and the member is told about it on their next login.
    """
    if payload.date is None and payload.waypoint_id is None:
        raise HTTPException(status_code=400, detail="Nothing to update")

    if payload.date is not None and payload.date < date.today():
        raise HTTPException(status_code=400, detail="Hiking date can't be in the past")

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cursor.execute(
            """
            SELECT p.plan_id, p.user_id, p.mountain_id, p.waypoint_id, p.date,
                   m.mountain_name, rw.name AS trail_name
            FROM plans p
            JOIN mountains m ON m.mountain_id = p.mountain_id
            JOIN route_waypoints rw ON rw.waypoint_id = p.waypoint_id
            WHERE p.plan_id = %s
            """,
            (plan_id,),
        )
        plan = cursor.fetchone()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        if plan["user_id"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Only the organizer can edit this plan")

        new_date = payload.date or plan["date"]
        new_waypoint_id = payload.waypoint_id or plan["waypoint_id"]

        trail = _assert_trail_belongs_to_mountain(cursor, plan["mountain_id"], new_waypoint_id)

        trail_changed = new_waypoint_id != plan["waypoint_id"]
        date_changed = new_date != plan["date"]
        if not trail_changed and not date_changed:
            return {"plan_id": plan_id, "changed": False, "members_synced": 0}

        # The stored AI output was generated for the old trail/date, so it no
        # longer describes this plan. Clear it rather than serve stale advice.
        cursor.execute(
            """
            UPDATE plans
            SET date = %s,
                waypoint_id = %s,
                ai_gear_summary = NULL,
                ai_difficulty_analysis = NULL,
                ai_safety_analysis = NULL,
                ai_route_plan = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE plan_id = %s
            RETURNING plan_id, mountain_id, waypoint_id, date, updated_at
            """,
            (new_date, new_waypoint_id, plan_id),
        )
        updated = dict(cursor.fetchone())

        cursor.execute("DELETE FROM gear_recommendations WHERE plan_id = %s", (plan_id,))

        # Propagate to every associated member record.
        cursor.execute(
            """
            UPDATE plan_members
            SET synced_at = CURRENT_TIMESTAMP
            WHERE plan_id = %s AND status <> 'declined'
            RETURNING user_id
            """,
            (plan_id,),
        )
        member_ids = [row["user_id"] for row in cursor.fetchall()]

        changes = []
        if date_changed:
            changes.append(f"moved to {new_date.isoformat()}")
        if trail_changed:
            changes.append(f"trail changed to {trail['name']}")
        change_text = " and ".join(changes)

        organizer_name = f'{current_user["first_name"]} {current_user["last_name"]}'
        for member_id in member_ids:
            create_notification(
                cursor,
                member_id,
                "Plan updated",
                f'{organizer_name} updated the {plan["mountain_name"]} hike: {change_text}.',
                "plan_updated",
                plan_id,
            )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

    updated["changed"] = True
    updated["members_synced"] = len(member_ids)
    return updated


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

class NotesUpdate(BaseModel):
    notes: str

@app.patch("/plans/{plan_id}/notes")
def update_plan_notes_route(plan_id: int, payload: NotesUpdate) -> dict:
    """Update the announcement notes for a specific plan."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cursor.execute(
            """
            UPDATE plans 
            SET notes = %s 
            WHERE plan_id = %s 
            RETURNING *
            """,
            (payload.notes, plan_id) # Use payload.notes here
        )
        updated_row = cursor.fetchone()
        conn.commit()
        if not updated_row:
            raise HTTPException(status_code=404, detail="Plan not found")
        return dict(updated_row)
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()



# ---------------------------------------------------------------------------
# Group plans: invite members to a shared plan
# ---------------------------------------------------------------------------


class InvitePlanMemberRequest(BaseModel):
    """Accepts either a username or an email address in `identifier`.

    `email` is still honoured so older clients keep working.
    """

    identifier: Optional[str] = None
    email: Optional[EmailStr] = None

    def lookup_value(self) -> str:
        value = (self.identifier or self.email or "").strip()
        if not value:
            raise HTTPException(status_code=400, detail="Enter a username or email address")
        return value


@app.post("/plans/{plan_id}/invite")
def invite_plan_member(
    plan_id: int,
    payload: InvitePlanMemberRequest,
    current_user: dict = Depends(get_current_user),
):
    lookup = payload.lookup_value()

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cursor.execute(
            """
            SELECT p.plan_id, p.user_id, p.date, m.mountain_name
            FROM plans p
            JOIN mountains m ON m.mountain_id = p.mountain_id
            WHERE p.plan_id = %s
            """,
            (plan_id,),
        )
        plan = cursor.fetchone()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        if plan["user_id"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Only the plan owner can invite others")

        cursor.execute(
            "SELECT user_id FROM users WHERE LOWER(email) = LOWER(%s) OR LOWER(username) = LOWER(%s)",
            (lookup, lookup),
        )
        invitee = cursor.fetchone()
        if not invitee:
            raise HTTPException(
                status_code=404, detail="No TaraPeak account found with that username or email"
            )
        if invitee["user_id"] == current_user["user_id"]:
            raise HTTPException(status_code=400, detail="You can't invite yourself")

        cursor.execute(
            """
            INSERT INTO plan_members (plan_id, user_id, status, invited_by)
            VALUES (%s, %s, 'pending', %s)
            ON CONFLICT (plan_id, user_id) DO UPDATE
                SET status = CASE WHEN plan_members.status = 'declined' THEN 'pending'
                                   ELSE plan_members.status END
            RETURNING plan_member_id, status, (xmax = 0) AS is_new
            """,
            (plan_id, invitee["user_id"], current_user["user_id"]),
        )
        result = dict(cursor.fetchone())

        if result.pop("is_new", False) or result["status"] == "pending":
            organizer_name = f'{current_user["first_name"]} {current_user["last_name"]}'
            create_notification(
                cursor,
                invitee["user_id"],
                "New hike invitation",
                f'{organizer_name} invited you to hike {plan["mountain_name"]} '
                f'on {plan["date"].isoformat()}.',
                "invite_received",
                plan_id,
            )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
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
    try:
        cursor.execute(
            """
            SELECT pm.plan_member_id, pm.plan_id, p.user_id AS organizer_id, m.mountain_name
            FROM plan_members pm
            JOIN plans p ON p.plan_id = pm.plan_id
            JOIN mountains m ON m.mountain_id = p.mountain_id
            WHERE pm.plan_member_id = %s AND pm.user_id = %s
            """,
            (plan_member_id, current_user["user_id"]),
        )
        invite = cursor.fetchone()
        if not invite:
            raise HTTPException(status_code=404, detail="Invite not found")

        cursor.execute(
            "UPDATE plan_members SET status = %s, synced_at = CURRENT_TIMESTAMP "
            "WHERE plan_member_id = %s RETURNING plan_member_id, status",
            (new_status, plan_member_id),
        )
        result = dict(cursor.fetchone())

        member_name = f'{current_user["first_name"]} {current_user["last_name"]}'
        verb = "accepted" if new_status == "accepted" else "declined"
        create_notification(
            cursor,
            invite["organizer_id"],
            f"Invitation {verb}",
            f'{member_name} {verb} your invitation to {invite["mountain_name"]}.',
            f"invite_{verb}",
            invite["plan_id"],
        )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

    return result


@app.post("/plans/invites/{plan_member_id}/accept")
def accept_plan_invite(plan_member_id: int, current_user: dict = Depends(get_current_user)):
    return _respond_to_invite(plan_member_id, current_user, "accepted")


@app.post("/plans/invites/{plan_member_id}/decline")
def decline_plan_invite(plan_member_id: int, current_user: dict = Depends(get_current_user)):
    return _respond_to_invite(plan_member_id, current_user, "declined")

@app.get("/plans/{plan_id}")
def get_plan_detail(plan_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    current_user_id = current_user["user_id"]

    # 1. Fetch plan & verify authorization
    cursor.execute(
        """
        SELECT
            p.plan_id,
            p.date,
            p.user_id AS owner_id,
            p.waypoint_id,
            p.checkpoint_id,
            p.updated_at,
            p.ai_gear_summary,
            p.ai_difficulty_analysis,
            p.ai_safety_analysis,
            p.ai_route_plan,
            p.notes,

            p.is_completed,          
                p.completed_at::text,    
                p.completion_time::text,

            m.mountain_id,
            m.mountain_name,
            m.location,
            m.image_url,
            m.terrain,
            m.description,
            m.hazards,

            rw.name AS trail_name,
            rw.description AS trail_description,
            rw.distance_from_start_km,
            rw.estimated_time,
            rw.difficulty,

            tc.name AS checkpoint_name,
            tc.distance_from_start_km AS checkpoint_distance_km,

            (p.user_id = %s) AS is_owner

        FROM plans p

        JOIN mountains m
        ON p.mountain_id = m.mountain_id

        JOIN route_waypoints rw
        ON rw.waypoint_id = p.waypoint_id

        LEFT JOIN trail_checkpoints tc
        ON p.checkpoint_id = tc.checkpoint_id

        LEFT JOIN plan_members pm
        ON p.plan_id = pm.plan_id
        AND pm.user_id = %s

        WHERE p.plan_id = %s
        AND (p.user_id = %s OR pm.user_id = %s)
        """,
        (current_user_id, current_user_id, plan_id, current_user_id, current_user_id)
    )
    plan = cursor.fetchone()
    if not plan:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Plan not found or unauthorized")

    # 2. Fetch organizer's name/email explicitly + all invited members
    cursor.execute(
        """
        -- Get the plan creator (Organizer) with their name and email
        SELECT 
            0 AS plan_member_id, 
            u.user_id, 
            CONCAT(u.first_name, ' ', u.last_name) AS name, 
            u.email,
            'organizer' AS role,
            'accepted' AS status
        FROM plans p
        JOIN users u ON p.user_id = u.user_id
        WHERE p.plan_id = %s

        UNION

        -- Get invited group members with their name and email
        SELECT 
            pm.plan_member_id, 
            pm.user_id, 
            CONCAT(u.first_name, ' ', u.last_name) AS name, 
            u.email,
            'member' AS role,
            pm.status
        FROM plan_members pm
        JOIN users u ON pm.user_id = u.user_id
        WHERE pm.plan_id = %s;
        """,
        (plan_id, plan_id)
    )
    members = cursor.fetchall()

    cursor.execute(
        """
        SELECT gear_id, gear_name, category, reason, is_required
        FROM gear_recommendations
        WHERE plan_id = %s
        ORDER BY is_required DESC, category, gear_id
        """,
        (plan_id,),
    )
    gear = cursor.fetchall()
    
    cursor.execute(
        """
        SELECT tc.checkpoint_id, tc.name, tc.description, tc.sequence_order, tc.latitude, tc.longitude, tc.distance_from_start_km
        FROM plan_checkpoints pc
        JOIN trail_checkpoints tc ON pc.checkpoint_id = tc.checkpoint_id
        WHERE pc.plan_id = %s
        ORDER BY tc.sequence_order ASC
        """,
        (plan_id,),
    )
    checkpoints = cursor.fetchall()

    cursor.close()
    conn.close()

    plan_dict = dict(plan)
    plan_dict["members"] = [dict(m) for m in members]
    plan_dict["gear"] = [dict(g) for g in gear]
    plan_dict["checkpoints"] = [dict(cp) for cp in checkpoints]
    return plan_dict

@app.delete("/plan-members/{plan_member_id}")
def remove_plan_member(plan_member_id: int, current_user: dict = Depends(get_current_user)):
    """Organizer removes a member. Access is revoked as soon as this commits,
    because every plan read filters on plan_members."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cursor.execute(
            """
            SELECT p.user_id AS organizer_id, pm.user_id AS member_id,
                   pm.plan_id, m.mountain_name
            FROM plan_members pm
            JOIN plans p ON pm.plan_id = p.plan_id
            JOIN mountains m ON m.mountain_id = p.mountain_id
            WHERE pm.plan_member_id = %s
            """,
            (plan_member_id,),
        )
        row = cursor.fetchone()
        if not row or row["organizer_id"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Unauthorized to remove member")

        cursor.execute("DELETE FROM plan_members WHERE plan_member_id = %s", (plan_member_id,))

        create_notification(
            cursor,
            row["member_id"],
            "Removed from a hike",
            f'You were removed from the {row["mountain_name"]} hike plan.',
            "member_removed",
            row["plan_id"],
        )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

    return {"message": "Member removed successfully"}

class CompletePlanRequest(BaseModel):
    completion_date: date
    completion_time: str


@app.patch("/plans/{plan_id}/complete")
def complete_plan(
    plan_id: int,
    payload: CompletePlanRequest,
    current_user: dict = Depends(get_current_user),
):
    """Mark a hiking plan as completed with the date and duration."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        # 1. Verify authorization
        cursor.execute(
            """
            SELECT p.plan_id
            FROM plans p
            LEFT JOIN plan_members pm ON pm.plan_id = p.plan_id AND pm.user_id = %s
            WHERE p.plan_id = %s AND (p.user_id = %s OR pm.user_id = %s)
            """,
            (current_user["user_id"], plan_id, current_user["user_id"], current_user["user_id"])
        )
        plan = cursor.fetchone()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found or unauthorized")

        # 2. Update plan & cast interval/date to text for JSON serialization
        cursor.execute(
            """
            UPDATE plans
            SET is_completed = TRUE,
                completion_time = %s::interval,
                completed_at = %s::date,
                updated_at = CURRENT_TIMESTAMP
            WHERE plan_id = %s
            RETURNING plan_id, 
                      is_completed, 
                      completion_time::text AS completion_time, 
                      completed_at::text AS completed_at, 
                      updated_at
            """,
            (payload.completion_time, payload.completion_date, plan_id)
        )
        updated = dict(cursor.fetchone())
        conn.commit()
    except Exception as e:
        conn.rollback()
        # Returns exact database exception details during debugging
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

    return updated
# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------


@app.get("/notifications")
def get_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    query = """
        SELECT notification_id, user_id, title, message, type, reference_id, is_read, created_at
        FROM notifications
        WHERE user_id = %s
    """
    params: list = [current_user["user_id"]]
    if unread_only:
        query += " AND is_read = FALSE"
    query += " ORDER BY created_at DESC LIMIT %s"
    params.append(limit)

    cursor.execute(query, params)
    notifications = [dict(n) for n in cursor.fetchall()]

    cursor.execute(
        "SELECT COUNT(*) AS unread FROM notifications WHERE user_id = %s AND is_read = FALSE",
        (current_user["user_id"],),
    )
    unread = cursor.fetchone()["unread"]

    cursor.close()
    conn.close()

    return {"unread_count": unread, "notifications": notifications}


@app.post("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        "UPDATE notifications SET is_read = TRUE WHERE notification_id = %s AND user_id = %s "
        "RETURNING notification_id, is_read",
        (notification_id, current_user["user_id"]),
    )
    row = cursor.fetchone()
    conn.commit()
    cursor.close()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    return dict(row)


@app.post("/notifications/read-all")
def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = %s AND is_read = FALSE",
        (current_user["user_id"],),
    )
    updated = cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return {"marked_read": updated}
# ---------------------------------------------------------------------------
# AI analysis
# ---------------------------------------------------------------------------

@app.post("/ai/difficulty/{mountain_id}")
def ai_difficulty(mountain_id: int, current_user: dict = Depends(get_current_user)):
    mountain = fetch_mountain(mountain_id)

    if cached is not None:
        return {"mountain_id": mountain_id, "analysis": cached, "cached": True}

    try:
        
        analysis = ai.analyze_difficulty(mountain, current_user)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}")

    return {"mountain_id": mountain_id, "analysis": analysis, "cached": False}

@app.post("/ai/safety/{mountain_id}")
def ai_safety(
    mountain_id: int,
    hiking_date: date = Query(None, alias="date"),
    waypoint_id: int = Query(..., alias="waypoint_id"),
    current_user: dict = Depends(get_current_user),
):
    mountain = fetch_mountain(mountain_id)
    weather_data = get_weather_forecast(waypoint_id, hiking_date) if hiking_date else None

    try:
        analysis = ai.analyze_safety(mountain, weather_data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}")

    return {"mountain_id": mountain_id, "analysis": analysis, "cached": False}


def _gather_gear_context(mountain_id: int, waypoint_id: int, hiking_date: Optional[date], user_id: int) -> dict:
    """Collect everything the gear agent reasons over: trail, forecast, hiker
    experience, and what recent hikers actually reported on this trail."""
    mountain = fetch_mountain(mountain_id)

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cursor.execute(
        "SELECT * FROM route_waypoints WHERE waypoint_id = %s AND mountain_id = %s",
        (waypoint_id, mountain_id),
    )
    trail = cursor.fetchone()
    if not trail:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="That trail doesn't belong to this mountain")

    cursor.execute(
        """
        SELECT rating, condition, comment
        FROM trail_reports
        WHERE waypoint_id = %s
        ORDER BY created_at DESC
        LIMIT 5
        """,
        (waypoint_id,),
    )
    reports = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT hiker_experience FROM users WHERE user_id = %s", (user_id,))
    row = cursor.fetchone()
    experience = (row or {}).get("hiker_experience") or "beginner"

    cursor.close()
    conn.close()

    weather_data = get_weather_forecast(mountain_id, hiking_date) if hiking_date else None

    return {
        "mountain": mountain,
        "trail": dict(trail),
        "weather": weather_data,
        "reports": reports,
        "experience": experience,
        "date": hiking_date.isoformat() if hiking_date else None,
    }


@app.post("/ai/gear/{mountain_id}")
def ai_gear(
    mountain_id: int,
    waypoint_id: int = Query(...),
    hiking_date: date = Query(None, alias="date"),
    current_user: dict = Depends(get_current_user),
):
    """Generate a packing list for a prospective plan (nothing is saved yet)."""
    context = _gather_gear_context(mountain_id, waypoint_id, hiking_date, current_user["user_id"])
    result = ai.recommend_gear(context)
    return {
        "mountain_id": mountain_id,
        "waypoint_id": waypoint_id,
        "summary": result.get("summary", ""),
        "items": result.get("items", []),
        "source": result.get("source", "ai"),
    }


@app.post("/plans/{plan_id}/gear")
def regenerate_plan_gear(plan_id: int, current_user: dict = Depends(get_current_user)):
    """Regenerate and persist the packing list for an already-saved plan."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        """
        SELECT p.plan_id, p.mountain_id, p.waypoint_id, p.date, p.user_id
        FROM plans p
        LEFT JOIN plan_members pm ON pm.plan_id = p.plan_id AND pm.status = 'accepted'
        WHERE p.plan_id = %s AND (p.user_id = %s OR pm.user_id = %s)
        """,
        (plan_id, current_user["user_id"], current_user["user_id"]),
    )
    plan = cursor.fetchone()
    cursor.close()
    conn.close()

    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found or unauthorized")
    if plan["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the organizer can regenerate gear")

    context = _gather_gear_context(
        plan["mountain_id"], plan["waypoint_id"], plan["date"], current_user["user_id"]
    )
    result = ai.recommend_gear(context)
    items = result.get("items", [])

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cursor.execute("DELETE FROM gear_recommendations WHERE plan_id = %s", (plan_id,))
        if items:
            cursor.executemany(
                """
                INSERT INTO gear_recommendations (plan_id, gear_name, category, reason, is_required)
                VALUES (%s, %s, %s, %s, %s)
                """,
                [
                    (
                        plan_id,
                        item["gear_name"],
                        item.get("category", "Other"),
                        item.get("reason", ""),
                        item.get("is_required", True),
                    )
                    for item in items
                ],
            )
        cursor.execute(
            "UPDATE plans SET ai_gear_summary = %s, updated_at = CURRENT_TIMESTAMP WHERE plan_id = %s",
            (result.get("summary", ""), plan_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

    return {"plan_id": plan_id, "summary": result.get("summary", ""), "items": items,
            "source": result.get("source", "ai")}


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

    # Defaults to 8000. Set API_PORT in backend/.env if that port is already
    # taken on your machine, and set VITE_API_URL in the root .env to match.
    port = int(os.environ.get("API_PORT", "8000"))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
