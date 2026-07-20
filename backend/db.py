import os
from typing import Optional

import psycopg2
import psycopg2.extras

DATABASE_URL = os.environ.get("DATABASE_URL")

WEATHER_SEED_SQL = """
INSERT INTO weather_forecasts (mountain_id, hiking_date, temperature, humidity, wind_speed) VALUES
(1, CURRENT_DATE, 18.5, 70, 12),
(1, CURRENT_DATE + 1, 19.0, 65, 10),
(1, CURRENT_DATE + 2, 17.5, 75, 15),
(1, CURRENT_DATE + 3, 18.0, 72, 13),
(2, CURRENT_DATE, 20.0, 60, 8),
(2, CURRENT_DATE + 1, 21.0, 55, 9),
(2, CURRENT_DATE + 2, 19.5, 68, 11),
(2, CURRENT_DATE + 3, 20.5, 58, 8),
(3, CURRENT_DATE, 8.0, 85, 25),
(3, CURRENT_DATE + 1, 7.5, 88, 30),
(3, CURRENT_DATE + 2, 9.0, 80, 22),
(3, CURRENT_DATE + 3, 8.5, 83, 27);
"""

WAYPOINTS_SEED_SQL = """
INSERT INTO route_waypoints (mountain_id, sequence_order, name, description, elevation_m, distance_from_start_km) VALUES
(1, 1, 'Ampucao Trailhead', 'Starting point with registration and guide assignment.', 1500, 0.0),
(1, 2, 'Gungal Rock', 'Panoramic viewpoint over the Itogon ridgelines.', 1700, 3.0),
(1, 3, 'Pine Ridge', 'Shaded pine forest stretch before the final ascent.', 1750, 5.5),
(1, 4, 'Mount Ulap Summit', 'Grassland summit with 360-degree views.', 1846, 8.0),
(2, 1, 'Yangbew Trailhead', 'Starting point near La Trinidad.', 1400, 0.0),
(2, 2, 'Flower Garden Junction', 'Seasonal wildflower fields.', 1500, 1.5),
(2, 3, 'Rock Formation Viewpoint', 'Sunrise viewpoint over rocky outcrops.', 1550, 2.8),
(2, 4, 'Mount Yangbew Summit', 'Short, rewarding summit point.', 1600, 4.0),
(3, 1, 'Ambangeg Ranger Station', 'Registration and orientation point.', 2100, 0.0),
(3, 2, 'Camp 1', 'First rest camp, tree line begins to thin.', 2400, 4.0),
(3, 3, 'Camp 2', 'Second rest camp, common overnight stop.', 2500, 8.0),
(3, 4, 'Mossy Forest', 'Dense mossy forest crossing before the grassland.', 2700, 13.0),
(3, 5, 'Mount Pulag Summit', 'Third highest peak in the Philippines, sea of clouds.', 2926, 18.0);
"""


def get_connection():
    if DATABASE_URL:
        return psycopg2.connect(DATABASE_URL)
    return psycopg2.connect(
        host=os.environ.get("PGHOST", "localhost"),
        port=os.environ.get("PGPORT", "5432"),
        dbname=os.environ.get("PGDATABASE", "tarapeak"),
        user=os.environ.get("PGUSER", "postgres"),
        password=os.environ.get("PGPASSWORD", "postgres"),
    )


def _table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SELECT to_regclass(%s)", (f"public.{table_name}",))
    return cursor.fetchone()[0] is not None


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    if not _table_exists(cursor, "mountains"):
        with open("tarapeak.sql", "r") as f:
            cursor.execute(f.read())
        conn.commit()
        cursor.close()
        conn.close()
        return

    # Existing database from before this feature set — apply additive
    # migrations so upgrading doesn't require dropping the DB.
    cursor.execute("ALTER TABLE users ALTER COLUMN password TYPE VARCHAR(255)")

    cursor.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
            ) THEN
                ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
            END IF;
        END $$;
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS route_waypoints (
            waypoint_id SERIAL PRIMARY KEY,
            mountain_id INT NOT NULL,
            sequence_order INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            description VARCHAR(200),
            elevation_m INT,
            distance_from_start_km DECIMAL(4,1),
            CONSTRAINT waypoint_fk_mountains FOREIGN KEY (mountain_id) REFERENCES mountains(mountain_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ai_analysis_cache (
            cache_id SERIAL PRIMARY KEY,
            mountain_id INT NOT NULL,
            analysis_type VARCHAR(20) NOT NULL,
            cache_key VARCHAR(20) NOT NULL DEFAULT '',
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT ai_cache_fk_mountains FOREIGN KEY (mountain_id) REFERENCES mountains(mountain_id),
            CONSTRAINT ai_cache_unique UNIQUE (mountain_id, analysis_type, cache_key)
        )
    """)
    conn.commit()

    cursor.execute("SELECT COUNT(*) FROM route_waypoints")
    if cursor.fetchone()[0] == 0:
        cursor.execute(WAYPOINTS_SEED_SQL)
        conn.commit()

    cursor.execute("SELECT COUNT(*) FROM weather_forecasts")
    if cursor.fetchone()[0] == 0:
        cursor.execute(WEATHER_SEED_SQL)
        conn.commit()

    cursor.close()
    conn.close()


def get_cached_analysis(mountain_id: int, analysis_type: str, cache_key: str = "") -> Optional[str]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT content FROM ai_analysis_cache
        WHERE mountain_id = %s AND analysis_type = %s AND cache_key = %s
        """,
        (mountain_id, analysis_type, cache_key),
    )
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return row[0] if row else None


def save_cached_analysis(mountain_id: int, analysis_type: str, content: str, cache_key: str = "") -> None:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO ai_analysis_cache (mountain_id, analysis_type, cache_key, content)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (mountain_id, analysis_type, cache_key)
        DO UPDATE SET content = EXCLUDED.content, created_at = CURRENT_TIMESTAMP
        """,
        (mountain_id, analysis_type, cache_key, content),
    )
    conn.commit()
    cursor.close()
    conn.close()
