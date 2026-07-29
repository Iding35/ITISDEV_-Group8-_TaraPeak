import psycopg2.extras
from fastapi import APIRouter, Depends, HTTPException, Query
import ai
from db import get_connection
from auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

def require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# Descriptive: Specific mountain route/waypoints with most condition reports
@router.get("/reports-by-trail")
def get_reports_by_trail(
    mountain_id: int = Query(None), 
    admin: dict = Depends(require_admin)
):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    query = """
        SELECT 
            m.mountain_id,
            m.mountain_name,
            COALESCE(w.name, 'General Trail') AS trail_name,
            COUNT(tr.report_id) AS total_reports,
            MAX(tr.created_at) AS latest_report
        FROM mountains m
        LEFT JOIN trail_reports tr ON m.mountain_id = tr.mountain_id
        LEFT JOIN route_waypoints w ON tr.waypoint_id = w.waypoint_id
    """
    
    params = []
    if mountain_id is not None:
        query += " WHERE m.mountain_id = %s"
        params.append(mountain_id)
        
    query += """
        GROUP BY m.mountain_id, m.mountain_name, w.name
        ORDER BY total_reports DESC;
    """
    
    cursor.execute(query, params)
    results = cursor.fetchall()
    cursor.close()
    conn.close()
    return results

@router.get("/reports-by-mountain")
def get_reports_by_mountain(admin: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute("""
        SELECT 
            m.mountain_id,
            m.mountain_name,
            COUNT(tr.report_id) AS total_reports,
            MAX(tr.created_at) AS latest_report
        FROM mountains m
        LEFT JOIN trail_reports tr ON m.mountain_id = tr.mountain_id
        GROUP BY m.mountain_id, m.mountain_name
        ORDER BY total_reports DESC;
    """)
    results = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(row) for row in results]

# Descriptive: Quarterly user registrations
@router.get("/registrations-quarterly")
def get_registrations_quarterly(admin: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute("""
        SELECT 
            CONCAT('Q', EXTRACT(QUARTER FROM created_at), ' ', EXTRACT(YEAR FROM created_at)) AS quarter,
            COUNT(user_id) AS total_users
        FROM users
        GROUP BY EXTRACT(YEAR FROM created_at), EXTRACT(QUARTER FROM created_at)
        ORDER BY EXTRACT(YEAR FROM created_at) ASC, EXTRACT(QUARTER FROM created_at) ASC;
    """)
    results = cursor.fetchall()
    cursor.close()
    conn.close()
    return results

# Descriptive: Hikers by selected mountain & date
@router.get("/hikers-by-date")
def get_hikers_by_date(
    mountain_id: int = Query(...), 
    date: str = Query(...), 
    admin: dict = Depends(require_admin)
):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute("""
        SELECT 
            COUNT(DISTINCT user_id) AS total_hikers
        FROM plans
        WHERE mountain_id = %s AND date = %s;
    """, (mountain_id, date))
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    return {"mountain_id": mountain_id, "date": date, "total_hikers": result["total_hikers"] if result else 0}

# Diagnostic: Trail popularity 
@router.get("/popularity-drivers")
def get_popularity_drivers(admin: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute("""
        SELECT
            m.mountain_name,
            COUNT(DISTINCT p.plan_id) AS total_plans,
            COALESCE(MAX(rw.difficulty), 'Moderate') AS difficulty,
            COALESCE(MAX(rw.accessibility), 'Unspecified') AS accessibility,
            ROUND(AVG(tr.rating)::numeric, 1) AS avg_rating,
            COALESCE(MAX(rw.distance_from_start_km), 0) AS distance
        FROM mountains m
        LEFT JOIN plans p ON m.mountain_id = p.mountain_id
        LEFT JOIN trail_reports tr ON m.mountain_id = tr.mountain_id
        LEFT JOIN route_waypoints rw ON m.mountain_id = rw.mountain_id
        GROUP BY m.mountain_id, m.mountain_name
        ORDER BY total_plans DESC;
    """)
    results = cursor.fetchall()
    cursor.close()
    conn.close()
    return results

@router.get("/users")
def get_all_users(admin: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute("""
        SELECT 
            user_id, 
            first_name, 
            last_name, 
            email, 
            role, 
            TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at 
        FROM users 
        ORDER BY created_at DESC;
    """)
    users = cursor.fetchall()
    cursor.close()
    conn.close()
    return users

@router.get("/avg-completion-time")
def get_avg_completion_time(admin: dict = Depends(require_admin)):
    """Average logged completion time per trail, from completed plan histories."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute("""
        SELECT
            m.mountain_id,
            m.mountain_name,
            COALESCE(rw.name, 'General Trail') AS trail_name,
            COUNT(p.plan_id) AS completed_count,
            ROUND(EXTRACT(EPOCH FROM AVG(p.completion_time)) / 60) AS avg_minutes
        FROM plans p
        JOIN mountains m ON m.mountain_id = p.mountain_id
        LEFT JOIN route_waypoints rw ON rw.waypoint_id = p.waypoint_id
        WHERE p.is_completed = TRUE AND p.completion_time IS NOT NULL
        GROUP BY m.mountain_id, m.mountain_name, rw.waypoint_id, rw.name
        ORDER BY avg_minutes DESC NULLS LAST;
    """)
    by_trail = [dict(row) for row in cursor.fetchall()]

    cursor.execute("""
        SELECT ROUND(EXTRACT(EPOCH FROM AVG(completion_time)) / 60) AS avg_minutes,
               COUNT(*) AS completed_count
        FROM plans
        WHERE is_completed = TRUE AND completion_time IS NOT NULL;
    """)
    overall = dict(cursor.fetchone())

    cursor.close()
    conn.close()
    return {"overall": overall, "by_trail": by_trail}


@router.get("/diagnostic-correlations")
def get_diagnostic_correlations(admin: dict = Depends(require_admin)):
    """Agentic diagnostic analysis: how trail-selection frequency and average
    rating vary across difficulty, terrain, and accessibility."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cursor.execute("""
        SELECT
            rw.difficulty,
            COUNT(DISTINCT p.plan_id) AS times_selected,
            ROUND(AVG(tr.rating)::numeric, 2) AS avg_rating,
            COUNT(DISTINCT tr.report_id) AS report_count
        FROM route_waypoints rw
        LEFT JOIN plans p ON p.waypoint_id = rw.waypoint_id
        LEFT JOIN trail_reports tr ON tr.waypoint_id = rw.waypoint_id
        GROUP BY rw.difficulty
        ORDER BY times_selected DESC;
    """)
    by_difficulty = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
        SELECT
            m.terrain,
            COUNT(DISTINCT p.plan_id) AS times_selected,
            ROUND(AVG(tr.rating)::numeric, 2) AS avg_rating,
            COUNT(DISTINCT tr.report_id) AS report_count
        FROM route_waypoints rw
        JOIN mountains m ON m.mountain_id = rw.mountain_id
        LEFT JOIN plans p ON p.waypoint_id = rw.waypoint_id
        LEFT JOIN trail_reports tr ON tr.waypoint_id = rw.waypoint_id
        GROUP BY m.terrain
        ORDER BY times_selected DESC;
    """)
    by_terrain = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
        SELECT
            rw.accessibility,
            COUNT(DISTINCT p.plan_id) AS times_selected,
            ROUND(AVG(tr.rating)::numeric, 2) AS avg_rating,
            COUNT(DISTINCT tr.report_id) AS report_count
        FROM route_waypoints rw
        LEFT JOIN plans p ON p.waypoint_id = rw.waypoint_id
        LEFT JOIN trail_reports tr ON tr.waypoint_id = rw.waypoint_id
        GROUP BY rw.accessibility
        ORDER BY times_selected DESC;
    """)
    by_accessibility = [dict(r) for r in cursor.fetchall()]

    cursor.close()
    conn.close()

    stats = {
        "by_difficulty": by_difficulty,
        "by_terrain": by_terrain,
        "by_accessibility": by_accessibility,
    }
    diagnosis = ai.diagnose_trail_patterns(stats)

    return {**stats, "narrative": diagnosis["narrative"], "source": diagnosis["source"]}


@router.get("/most-taken-trails")
def get_most_taken_trails(admin: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute("""
        SELECT 
            m.mountain_id,
            m.mountain_name, 
            COALESCE(rw.name, 'General Trail') AS trail_name,
            COUNT(p.plan_id) AS total_completed_hikes,
            (
                SELECT tc.name 
                FROM plan_completed_checkpoints pcp2
                JOIN plans p2 ON pcp2.plan_id = p2.plan_id
                JOIN trail_checkpoints tc ON pcp2.checkpoint_id = tc.checkpoint_id
                WHERE p2.mountain_id = m.mountain_id 
                  AND (p2.waypoint_id = rw.waypoint_id OR (p2.waypoint_id IS NULL AND rw.waypoint_id IS NULL))
                  AND p2.is_completed = true
                GROUP BY tc.name
                ORDER BY COUNT(pcp2.checkpoint_id) DESC
                LIMIT 1
            ) AS most_taken_checkpoint
        FROM plans p
        JOIN mountains m ON p.mountain_id = m.mountain_id
        LEFT JOIN route_waypoints rw ON p.waypoint_id = rw.waypoint_id
        WHERE p.is_completed = true
        GROUP BY m.mountain_id, m.mountain_name, rw.waypoint_id, rw.name
        ORDER BY total_completed_hikes DESC;
    """)
    results = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(row) for row in results]