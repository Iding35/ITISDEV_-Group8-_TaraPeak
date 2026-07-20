import os
from typing import Optional
from datetime import date
import bcrypt
import psycopg2
import psycopg2.extras

DATABASE_URL = os.environ.get("DATABASE_URL")

SEED_USER_EMAILS = [
    "alex.rivera@example.com",
    "maria.santos@example.com",
    "john.doe@example.com",
    "elena.cruz@example.com",
    "ramon.reyes@example.com",
]

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
INSERT INTO route_waypoints (mountain_id, sequence_order, name, description, longitude, latitude, elevation_m, difficulty, estimated_time, distance_from_start_km) VALUES
(1, 1,'Mount Ulap Eco-Trail','The official hiking route of Mount Ulap. This 9.4 km trail passes through scenic pine forests, the Ambanao Paway ridge, the iconic Gungal Rock, and ends at the 1,846-meter summit with panoramic views of the Cordillera mountain range.', 120.6312, 16.2904, 1846, 'Moderate', 4.5, 9.4),
(1, 2, 'Ampucao Trailhead', 'One of the main access points to the Mount Ulap Eco-Trail, featuring registration facilities and the first panoramic views of the Itogon ridgelines.', 120.6358, 16.2947, 1520, 'Easy', 0.2, 0.5),
(1, 3, 'Ambacao Paway Ridge', 'A scenic ridge offering panoramic views of the surrounding mountains and valleys.', 120.6358, 16.2947, 1520, 'Easy', 0.2, 0.5),
(2, 1, 'Yangbew Trailhead', 'The main jump-off point for Mount Yangbew, also known as Little Pulag because of its grassland scenery resembling Mount Pulag.', 120.607052, 16.453989, 1446, 'Easy', 0.30, 3.2),
(2, 2, 'Grassland Ridge', 'An open grassland section offering panoramic views of La Trinidad Valley and the surrounding mountains.', 120.5906, 16.4580, 1510, 'Easy', 0.3, 1.2),
(2, 3, 'Rock Formation Viewpoint', 'A popular photo stop featuring natural rock formations overlooking the valley below.', 120.5925, 16.4605, 1560, 'Easy', 0.7, 2.3),
(2, 4, 'Mount Yangbew Summit', 'The summit of Mount Yangbew offers breathtaking sunrise and sunset views over La Trinidad and Baguio City.', 120.5940, 16.4622, 1609, 'Easy', 1.1, 3.3),
(3, 1, 'Ambangeg Trail', 'The most popular and beginner-friendly trail to Mount Pulag, often called the "Artista Trail". The summit is typically reached in 3 to 4 hours.', 121.08612, 16.52075, 2250, 'Easy', 4.0, 7.0),
(3, 2, 'Akiki Trail', 'Known as the "Killer Trail", Akiki is recommended for experienced hikers due to its steep ascents and multi-day trek.', 120.8992, 16.5975, 2260, 'Hard', 14.0, 20.4),
(3, 3, 'Tawangan Trail', 'A scenic trail passing through traditional Ibaloi communities, mossy forests, and grasslands before reaching the summit.', 120.89917, 16.5975, 2200, 'Moderate', 18.0, 12.0),
(3, 4, 'Ambaguio Trail', 'A less frequently used route approaching Mount Pulag from Nueva Vizcaya, known for its long forest sections.', 121.0564, 16.5794, 2150, 'Hard', 24.0, 16.0);
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

    # Early seed data stored these five demo accounts' passwords as plaintext
    # instead of bcrypt hashes, which made login() crash (bcrypt.checkpw
    # rejects non-hash input). Repair any database seeded before that fix.
    cursor.execute(
        "SELECT user_id, password FROM users WHERE email = ANY(%s)",
        (SEED_USER_EMAILS,),
    )
    for user_id, password in cursor.fetchall():
        if not password.startswith("$2"):
            fixed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            cursor.execute("UPDATE users SET password = %s WHERE user_id = %s", (fixed, user_id))
    conn.commit()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS route_waypoints (
            waypoint_id SERIAL PRIMARY KEY,
            mountain_id INT NOT NULL,
            sequence_order INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            description VARCHAR(200),
            longitude FLOAT NOT NULL,
            latitude FLOAT NOT NULL,
            elevation_m INT,
            difficulty VARCHAR(20) NOT NULL,
            estimated_time FLOAT NOT NULL,
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

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS trail_reports (
            report_id SERIAL PRIMARY KEY,
            mountain_id INT REFERENCES mountains(mountain_id) ON DELETE CASCADE,
            waypoint_id INT REFERENCES route_waypoints(waypoint_id) ON DELETE CASCADE,
            user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
            rating INT CHECK (rating >= 1 AND rating <= 5),
            condition VARCHAR(100) NOT NULL,
            comment TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute(
        "ALTER TABLE trail_reports ADD COLUMN IF NOT EXISTS waypoint_id "
        "INT REFERENCES route_waypoints(waypoint_id) ON DELETE CASCADE"
    )

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS plan_members (
            plan_member_id SERIAL PRIMARY KEY,
            plan_id INT NOT NULL REFERENCES plans(plan_id) ON DELETE CASCADE,
            user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            invited_by INT REFERENCES users(user_id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT plan_members_unique UNIQUE (plan_id, user_id)
        )
    """)

    cursor.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'weather_unique'
            ) THEN
                ALTER TABLE weather_forecasts ADD CONSTRAINT weather_unique UNIQUE (mountain_id, hiking_date);
            END IF;
        END $$;
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


def get_weather_forecast(mountain_id: int, hiking_date: date):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT temperature, humidity, wind_speed 
        FROM weather_forecasts 
        WHERE mountain_id = %s AND hiking_date = %s
        """,
        (mountain_id, hiking_date),
    )
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if row:
        return {
            "temperature": float(row[0]),  # <-- FORCE CONVERSION TO FLOAT HERE
            "humidity": int(row[1]),
            "wind_speed": float(row[2])    # <-- FORCE CONVERSION TO FLOAT HERE
        }
    return None


def get_weather_forecast(mountain_id: int, hiking_date: date):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT temperature, humidity, wind_speed 
        FROM weather_forecasts 
        WHERE mountain_id = %s AND hiking_date = %s
        """,
        (mountain_id, hiking_date),
    )
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if row:
        return {
            "temperature": float(row[0]),  # Convert DECIMAL securely
            "humidity": int(row[1]),
            "wind_speed": float(row[2])
        }
    return None

def save_weather_forecast(mountain_id: int, hiking_date: date, temp: float, hum: int, wind: float):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO weather_forecasts (mountain_id, hiking_date, temperature, humidity, wind_speed)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (mountain_id, hiking_date) DO UPDATE 
            SET temperature = EXCLUDED.temperature, 
                humidity = EXCLUDED.humidity, 
                wind_speed = EXCLUDED.wind_speed
            """,
            (mountain_id, hiking_date, temp, hum, wind),
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()
