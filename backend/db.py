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

# Must stay byte-for-byte consistent with the same INSERT in tarapeak.sql:
# waypoint_id values are assigned by insertion order, and CHECKPOINTS_SEED_SQL
# below references them positionally. Reordering one without the other silently
# attaches checkpoints to the wrong trail.
WAYPOINTS_SEED_SQL = """
INSERT INTO route_waypoints (mountain_id, sequence_order, name, description, longitude, latitude, elevation_m, difficulty, estimated_time, distance_from_start_km, total_hikers, accessibility) VALUES
(1, 1, 'Ambacao Paway Ridge', 'A scenic ridge offering panoramic views of the surrounding mountains and valleys.', 120.6358, 16.2947, 1520, 'Easy', 0.2, 0.5, 15, 'Paved Road Access'),
(1, 2, 'Ampucao Trailhead', 'One of the main access points to the Mount Ulap Eco-Trail, featuring registration facilities and the first panoramic views of the Itogon ridgelines.', 120.6358, 16.2947, 1520, 'Easy', 0.2, 0.5, 25, 'Paved Road Access'),
(1, 3, 'Mount Ulap Eco-Trail','The official hiking route of Mount Ulap. This 9.4 km trail passes through scenic pine forests, the Ambanao Paway ridge, the iconic Gungal Rock, and ends at the 1,846-meter summit with panoramic views of the Cordillera mountain range.', 120.6312, 16.2904, 1846, 'Moderate', 4.5, 9.4, 60, 'Unpaved Trailhead'),
(2, 1, 'Yangbew Trailhead', 'The main jump-off point for Mount Yangbew, also known as Little Pulag because of its grassland scenery resembling Mount Pulag.', 120.607052, 16.453989, 1446, 'Easy', 0.30, 3.2, 10, 'Paved Road Access'),
(2, 2, 'Grassland Ridge', 'An open grassland section offering panoramic views of La Trinidad Valley and the surrounding mountains.', 120.5906, 16.4580, 1510, 'Easy', 0.3, 1.2, 20, 'Paved Road Access'),
(2, 3, 'Rock Formation Viewpoint', 'A popular photo stop featuring natural rock formations overlooking the valley below.', 120.5925, 16.4605, 1560, 'Easy', 0.7, 2.3, 30, 'Paved Road Access'),
(2, 4, 'Mount Yangbew Summit', 'The summit of Mount Yangbew offers breathtaking sunrise and sunset views over La Trinidad and Baguio City.', 120.5940, 16.4622, 1609, 'Easy', 1.1, 3.3, 40, 'Unpaved Trailhead'),
(3, 1, 'Ambangeg Trail', 'The most popular and beginner-friendly trail to Mount Pulag, often called the "Artista Trail". The summit is typically reached in 3 to 4 hours.', 121.08612, 16.52075, 2250, 'Easy', 4.0, 7.0, 50, 'Unpaved Trailhead'),
(3, 2, 'Tawangan Trail', 'A scenic trail passing through traditional Ibaloi communities, mossy forests, and grasslands before reaching the summit.', 120.89917, 16.5975, 2200, 'Moderate', 18.0, 12.0, 20, '4x4 / High-Clearance Required'),
(3, 3, 'Akiki Trail', 'Known as the "Killer Trail", Akiki is recommended for experienced hikers due to its steep ascents and multi-day trek.', 120.8992, 16.5975, 2260, 'Hard', 14.0, 20.4, 20, 'Remote / Difficult Access'),
(3, 4, 'Ambaguio Trail', 'A less frequently used route approaching Mount Pulag from Nueva Vizcaya, known for its long forest sections.', 121.0564, 16.5794, 2150, 'Hard', 24.0, 16.0, 10, 'Remote / Difficult Access');
"""

CHECKPOINTS_SEED_SQL = """
INSERT INTO trail_checkpoints
(mountain_id, route_waypoint_id, sequence_order, name, description, longitude, latitude, elevation_m, difficulty, estimated_time, distance_from_start_km)
VALUES
(1, 1, 1, 'Ampucao Entry Gate', 'Starting point near Philex Road heading up to Ambacao Paway.', 120.6358, 16.2947, 1520, 'Easy', 0.0, 0.0),
(1, 1, 2, 'Pine Grove Rest Area', 'Shaded pine area along the initial incline.', 120.6380, 16.2970, 1580, 'Easy', 0.2, 0.8),
(1, 1, 3, 'Ambacao Ridge Viewpoint', 'A scenic ridge offering panoramic views of the surrounding mountains and valleys.', 120.6410, 16.3010, 1680, 'Easy', 0.8, 2.1),
(1, 1, 4, 'Grassland Slope', 'Gentle slope running parallel to the main ridge line.', 120.6435, 16.3035, 1720, 'Easy', 1.2, 3.0),
(1, 1, 5, 'Paway High Point', 'Summit ridge point of the Ambacao section.', 120.6471, 16.3060, 1788, 'Easy', 1.8, 4.2),
(1, 2, 1, 'Ampucao Barangay Hall', 'Main registration and guide assembly hall.', 120.6550, 16.3253, 1497, 'Easy', 0.0, 0.0),
(1, 2, 2, 'Totomtombek Rest Stop', 'First covered rest shelter surrounded by Benguet pines.', 120.6482, 16.3218, 1552, 'Easy', 0.3, 1.0),
(1, 2, 3, 'Corral Rock Formation', 'Distinct rock outcrop along the ridge trail.', 120.6475, 16.3130, 1603, 'Easy', 0.8, 2.0),
(1, 2, 4, 'Ambanao Paway Peak', 'Grassland peak with wide open views of Benguet.', 120.6471, 16.3060, 1788, 'Easy', 1.5, 3.6),
(1, 2, 5, 'Ampucao Turnaround Point', 'Popular midpoint turnaround spot for shorter day hikes.', 120.6410, 16.3010, 1750, 'Easy', 2.0, 4.5),
(1, 3, 1, 'Ampucao Trailhead', 'Starting jump-off point at Barangay Ampucao registration hall.', 120.6550, 16.3253, 1497, 'Easy', 0.0, 0.0),
(1, 3, 2, 'Totomtombek Rest Stop', 'First resting shelter surrounded by Benguet pine trees.', 120.6482, 16.3218, 1559, 'Easy', 0.3, 1.2),
(1, 3, 3, 'Ambanao Paway Ridge', 'First major peak with rolling grasslands and scenic vistas.', 120.6471, 16.3060, 1788, 'Easy', 1.5, 3.6),
(1, 3, 4, 'Gungal Rock', 'The iconic cliff-side rock formation and popular photo stop.', 120.6368, 16.2950, 1814, 'Moderate', 3.0, 5.4),
(1, 3, 5, 'Mount Ulap Summit', 'Highest point along the trail offering 360-degree Cordillera views.', 120.6310, 16.2900, 1846, 'Moderate', 4.0, 6.5),
(1, 3, 6, 'Sta. Fe Exit', 'End of the traverse trail leading down to hanging bridges.', 120.6215, 16.2810, 1277, 'Moderate', 6.0, 9.4),
(2, 4, 1, 'Yangbew Trailhead Gate', 'The main jump-off point for Mount Yangbew near the barangay hall.', 120.6070, 16.4540, 1446, 'Easy', 0.0, 0.0),
(2, 4, 2, 'Pine Grove Path', 'Early pine tree shade before the open grassland.', 120.6050, 16.4555, 1490, 'Easy', 0.2, 0.6),
(2, 4, 3, 'Middle Slope Rest Stop', 'Small open clearing with view of La Trinidad valley.', 120.6010, 16.4570, 1530, 'Easy', 0.5, 1.2),
(2, 4, 4, 'Yangbew Plateau Entry', 'Entry point onto the grassy upper summit plateau.', 120.5960, 16.4600, 1585, 'Easy', 0.8, 2.2),
(2, 4, 5, 'Main Summit Marker', 'Main summit sign and horse riding area on the grassland.', 120.5940, 16.4622, 1609, 'Easy', 1.0, 3.2),
(2, 5, 1, 'Grassland Ridge Start', 'Starting point along the eastern open ridge slope.', 120.5906, 16.4580, 1510, 'Easy', 0.0, 0.0),
(2, 5, 2, 'Lower Meadow Walk', 'Gentle trail section walking across green pasture land.', 120.5915, 16.4590, 1535, 'Easy', 0.2, 0.5),
(2, 5, 3, 'East Viewpoint Hill', 'Scenic hill overlook facing eastern mountain ranges.', 120.5928, 16.4600, 1570, 'Easy', 0.4, 0.9),
(2, 5, 4, 'Upper Ridge Junction', 'Junction joining the main summit trail on the ridge.', 120.5940, 16.4618, 1600, 'Easy', 0.6, 1.2),
(2, 6, 1, 'Rock Formation Trailhead', 'Starting point near the northern rocky approaches.', 120.5925, 16.4605, 1560, 'Easy', 0.0, 0.0),
(2, 6, 2, 'Bouldering Outcrop', 'Scattered limestone rock formations ideal for quick photo stops.', 120.5932, 16.4612, 1585, 'Easy', 0.2, 0.8),
(2, 6, 3, 'Valley Viewpoint Rock', 'The highest rock cluster offering clear views of La Trinidad Valley.', 120.5938, 16.4618, 1602, 'Easy', 0.4, 1.5),
(2, 6, 4, 'Summit Plateau Connector', 'Short grassy path connecting the rock formations to the main summit.', 120.5940, 16.4622, 1609, 'Easy', 0.6, 2.3),
(2, 7, 1, 'Tawang Base Jump-off', 'Main registration and parking area at the base of Mount Yangbew.', 120.6070, 16.4540, 1446, 'Easy', 0.0, 0.0),
(2, 7, 2, 'Pine Forest Pass', 'Shaded woodland trail connecting the lower valley to the upper ridge.', 120.6035, 16.4565, 1515, 'Easy', 0.3, 0.9),
(2, 7, 3, 'Rock Formation Overlook', 'Natural limestone outcrop offering scenic photo spots over La Trinidad.', 120.5980, 16.4600, 1565, 'Easy', 0.6, 1.8),
(2, 7, 4, 'Mount Yangbew Summit Plateau', 'The main summit area with 360-degree views of Baguio and La Trinidad Valley.', 120.5940, 16.4622, 1609, 'Easy', 0.9, 2.6),
(2, 7, 5, 'Grassland Ridge Descent', 'Open grassland pasture trail descending back towards the Tawang exit.', 120.5910, 16.4585, 1520, 'Easy', 1.1, 3.3),
(3, 8, 1, 'Babadak Ranger Station', 'Main jump-off center for registration, guides, and briefing.', 120.8804, 16.5722, 2400, 'Easy', 0.0, 0.0),
(3, 8, 2, 'Camp 1 Shelter', 'First major resting point along the shaded pine forest section.', 120.8905, 16.5815, 2577, 'Easy', 1.0, 2.5),
(3, 8, 3, 'Camp 2 (Mossy Forest Exit)', 'Campsite marking the boundary between mossy forest and dwarf bamboo grassland.', 120.8982, 16.5910, 2690, 'Moderate', 3.0, 5.2),
(3, 8, 4, 'Saddle Campsite', 'High-altitude campsite right below the summit peak.', 120.8990, 16.5960, 2800, 'Moderate', 4.0, 7.0),
(3, 8, 5, 'Mount Pulag Summit', 'The highest peak in Luzon (2,928m) famous for the sea of clouds.', 120.8992, 16.5975, 2928, 'Moderate', 4.5, 8.0),
(3, 9, 1, 'Tawangan Barangay Hall', 'Jump-off point in Barangay Tawangan, Kabayan.', 120.8750, 16.6320, 1480, 'Hard', 0.0, 0.0),
(3, 9, 2, 'Tawangan Mossy Forest Camp', 'Deep mossy forest campsite with high humidity and lush vegetation.', 120.8870, 16.6180, 2100, 'Hard', 5.0, 7.5),
(3, 9, 3, 'Mount Pulag Summit', 'Summit junction approaching from the northern mossy forest trail.', 120.8992, 16.5975, 2928, 'Hard', 10.0, 13.0),
(3, 10, 1, 'Akiki Jump-Off Point', 'Starting point at Barangay Doacan, Kabayan.', 120.8421, 16.5812, 1250, 'Hard', 0.0, 0.0),
(3, 10, 2, 'Eddet River Camp', 'Riverside campsite after a steep downhill descent from jump-off.', 120.8605, 16.5790, 1650, 'Hard', 3.0, 4.5),
(3, 10, 3, 'Marlboro Country Camp', 'Mid-trail campsite located in a lush pine forest area.', 120.8780, 16.5855, 2130, 'Hard', 7.0, 9.2),
(3, 10, 4, 'Akiki Mossy Forest Exit', 'Dense forest section leading to the open grasslands.', 120.8920, 16.5925, 2600, 'Hard', 10.0, 12.5),
(3, 10, 5, 'Mount Pulag Summit', 'Reaches the main peak from the western ridgeline.', 120.8992, 16.5975, 2928, 'Hard', 12.0, 14.5),
(3, 11, 1, 'Ambaguio Jump-off', 'Starting point in Ambaguio, Nueva Vizcaya.', 121.0150, 16.5210, 1100, 'Hard', 0.0, 0.0),
(3, 11, 2, 'Upper Napo Shelter', 'First day rest stop along the forest ridgeline.', 120.9750, 16.5450, 1850, 'Hard', 8.0, 12.0),
(3, 11, 3, 'Mount Pulag Summit', 'Approaches the peak from the eastern slope.', 120.8992, 16.5975, 2928, 'Hard', 16.0, 24.0);
"""

HAZARDS_SEED_SQL = """
UPDATE mountains SET hazards = 'Exposed ridgelines with no shade, slippery clay when wet, steep drop-offs near Gungal Rock, limited water sources along the traverse.' WHERE mountain_name = 'Mount Ulap' AND hazards IS NULL;
UPDATE mountains SET hazards = 'Loose rock near the formations, strong crosswinds on the open plateau, sun exposure with almost no tree cover, crowding at sunrise.' WHERE mountain_name = 'Mount Yangbew' AND hazards IS NULL;
UPDATE mountains SET hazards = 'Hypothermia risk from near-freezing summit temperatures, altitude sickness above 2,500 m, dense fog with low visibility, slippery mossy roots, long emergency evacuation times.' WHERE mountain_name = 'Mount Pulag' AND hazards IS NULL;
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
            synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT plan_members_unique UNIQUE (plan_id, user_id)
        )
    """)
    cursor.execute(
        "ALTER TABLE plan_members ADD COLUMN IF NOT EXISTS synced_at "
        "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    )

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS trail_checkpoints (
            checkpoint_id SERIAL PRIMARY KEY,
            mountain_id INT NOT NULL,
            route_waypoint_id INT NOT NULL,
            sequence_order INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            longitude FLOAT NOT NULL,
            latitude FLOAT NOT NULL,
            elevation_m INT,
            difficulty VARCHAR(20) NOT NULL,
            estimated_time FLOAT NOT NULL,
            distance_from_start_km DECIMAL(4,1),
            CONSTRAINT checkpoint_fk_mountains FOREIGN KEY (mountain_id)
                REFERENCES mountains(mountain_id) ON DELETE CASCADE,
            CONSTRAINT checkpoint_fk_route_waypoints FOREIGN KEY (route_waypoint_id)
                REFERENCES route_waypoints(waypoint_id) ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            notification_id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            title VARCHAR(120) NOT NULL,
            message TEXT NOT NULL,
            type VARCHAR(30) NOT NULL,
            reference_id INT,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS notifications_user_idx "
        "ON notifications (user_id, is_read, created_at DESC)"
    )

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS gear_recommendations (
            gear_id SERIAL PRIMARY KEY,
            plan_id INT NOT NULL REFERENCES plans(plan_id) ON DELETE CASCADE,
            gear_name VARCHAR(100),
            category VARCHAR(50),
            reason TEXT,
            is_required BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    for column, ddl in [
        ("category", "VARCHAR(50)"),
        ("reason", "TEXT"),
        ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
    ]:
        cursor.execute(
            f"ALTER TABLE gear_recommendations ADD COLUMN IF NOT EXISTS {column} {ddl}"
        )
    cursor.execute("ALTER TABLE gear_recommendations ALTER COLUMN gear_name TYPE VARCHAR(100)")

    # The original constraint had no ON DELETE CASCADE, so deleting a plan that
    # had gear saved against it raised a ForeignKeyViolation. Recreate it.
    cursor.execute("ALTER TABLE gear_recommendations DROP CONSTRAINT IF EXISTS gear_fk_plans")
    cursor.execute(
        "ALTER TABLE gear_recommendations ADD CONSTRAINT gear_fk_plans "
        "FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE CASCADE"
    )

    # Columns added after the first release. Each is additive so an existing
    # database upgrades in place instead of having to be dropped.
    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50)")
    cursor.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS hiker_experience VARCHAR(50) DEFAULT 'beginner'"
    )
    cursor.execute("ALTER TABLE mountains ADD COLUMN IF NOT EXISTS hazards VARCHAR(300)")
    cursor.execute("ALTER TABLE route_waypoints ADD COLUMN IF NOT EXISTS total_hikers INT DEFAULT 0")
    cursor.execute("ALTER TABLE route_waypoints ADD COLUMN IF NOT EXISTS accessibility VARCHAR(50)")

    # Failed-login tracking used by auth.py's lockout check.
    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts INT NOT NULL DEFAULT 0")
    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP NULL")

    # Roles were originally free-text ('user'/'admin'). Normalize to the
    # hiker/admin/registrar vocabulary and enforce it going forward — signup
    # relies on this DEFAULT since it never sets role explicitly.
    cursor.execute("UPDATE users SET role = 'hiker' WHERE role = 'user'")
    cursor.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'hiker'")
    cursor.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
            ) THEN
                ALTER TABLE users ADD CONSTRAINT users_role_check
                    CHECK (role IN ('hiker', 'admin', 'registrar'));
            END IF;
        END $$;
    """)

    # Backfill accessibility for trails seeded before the column existed,
    # using difficulty as a rough proxy so nothing is left NULL.
    cursor.execute("""
        UPDATE route_waypoints
        SET accessibility = CASE difficulty
            WHEN 'Easy' THEN 'Paved Road Access'
            WHEN 'Moderate' THEN 'Unpaved Trailhead'
            WHEN 'Hard' THEN 'Remote / Difficult Access'
            ELSE 'Unpaved Trailhead'
        END
        WHERE accessibility IS NULL
    """)

    for column, ddl in [
        ("waypoint_id", "INT REFERENCES route_waypoints(waypoint_id)"),
        ("ai_gear_summary", "TEXT"),
        ("ai_difficulty_analysis", "TEXT"),
        ("ai_safety_analysis", "TEXT"),
        ("ai_route_plan", "TEXT"),
        ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        # The "mark plan completed" feature (PATCH /plans/{id}/complete,
        # checkpoint tracking, most-taken-trails/avg-completion-time
        # analytics) was added to tarapeak.sql's CREATE TABLE but never
        # migrated onto an existing database — every one of those endpoints
        # was throwing UndefinedColumn.
        ("checkpoint_id", "INT REFERENCES trail_checkpoints(checkpoint_id) ON DELETE SET NULL"),
        ("notes", "TEXT NULL"),
        ("is_completed", "BOOLEAN DEFAULT FALSE"),
        ("completion_time", "INTERVAL NULL"),
        ("completed_at", "TIMESTAMP NULL"),
    ]:
        cursor.execute(f"ALTER TABLE plans ADD COLUMN IF NOT EXISTS {column} {ddl}")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS plan_checkpoints (
            plan_id INT REFERENCES plans(plan_id) ON DELETE CASCADE,
            checkpoint_id INT REFERENCES trail_checkpoints(checkpoint_id) ON DELETE CASCADE,
            PRIMARY KEY (plan_id, checkpoint_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS weather_climate_baseline (
            baseline_id SERIAL PRIMARY KEY,
            waypoint_id INT NOT NULL REFERENCES route_waypoints(waypoint_id) ON DELETE CASCADE,
            year INT NOT NULL,
            month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
            avg_temperature DECIMAL(4,1),
            avg_humidity INT,
            avg_wind_speed DECIMAL(4,1),
            avg_precipitation DECIMAL(5,1),
            fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT weather_baseline_unique UNIQUE (waypoint_id, year, month)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS plan_completed_checkpoints (
            plan_checkpoint_id SERIAL PRIMARY KEY,
            plan_id INT NOT NULL REFERENCES plans(plan_id) ON DELETE CASCADE,
            checkpoint_id INT NOT NULL REFERENCES trail_checkpoints(checkpoint_id) ON DELETE CASCADE,
            reached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notes TEXT NULL,
            CONSTRAINT uc_plan_checkpoint UNIQUE (plan_id, checkpoint_id)
        )
    """)

    # Plans predating the trail selector have no waypoint; backfill them with
    # the mountain's first trail so the NOT NULL join in /plans still matches.
    cursor.execute("""
        UPDATE plans p
        SET waypoint_id = sub.waypoint_id
        FROM (
            SELECT DISTINCT ON (mountain_id) mountain_id, waypoint_id
            FROM route_waypoints
            ORDER BY mountain_id, sequence_order
        ) sub
        WHERE p.waypoint_id IS NULL AND p.mountain_id = sub.mountain_id
    """)

    # Backfill usernames from the email local part, de-duplicating collisions.
    cursor.execute("""
        UPDATE users u
        SET username = candidate.name
        FROM (
            SELECT user_id,
                   split_part(email, '@', 1) ||
                   CASE WHEN ROW_NUMBER() OVER (
                            PARTITION BY split_part(email, '@', 1) ORDER BY user_id
                        ) = 1 THEN '' ELSE user_id::text END AS name
            FROM users
            WHERE username IS NULL
        ) candidate
        WHERE u.user_id = candidate.user_id
    """)
    cursor.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key'
            ) THEN
                ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
            END IF;
        END $$;
    """)

    # weather_forecasts predates the waypoint-level refactor: get_weather_forecast()
    # and save_weather_forecast() have keyed on waypoint_id for a while, but no
    # migration ever added that column (or precipitation/weather_code) to an
    # existing database — every weather read/write was throwing
    # UndefinedColumn on any DB created before that refactor.
    cursor.execute("ALTER TABLE weather_forecasts ADD COLUMN IF NOT EXISTS waypoint_id INT")
    cursor.execute("ALTER TABLE weather_forecasts ADD COLUMN IF NOT EXISTS precipitation DECIMAL(5,1)")
    cursor.execute("ALTER TABLE weather_forecasts ADD COLUMN IF NOT EXISTS weather_code INT")

    # Backfill: old rows only recorded mountain_id, so attribute them to that
    # mountain's first trail (arbitrary but deterministic) rather than drop them.
    cursor.execute("""
        UPDATE weather_forecasts w
        SET waypoint_id = sub.waypoint_id
        FROM (
            SELECT DISTINCT ON (mountain_id) mountain_id, waypoint_id
            FROM route_waypoints
            ORDER BY mountain_id, sequence_order
        ) sub
        WHERE w.waypoint_id IS NULL AND w.mountain_id = sub.mountain_id
    """)

    cursor.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'weather_fk_waypoints'
            ) THEN
                ALTER TABLE weather_forecasts ADD CONSTRAINT weather_fk_waypoints
                    FOREIGN KEY (waypoint_id) REFERENCES route_waypoints(waypoint_id) ON DELETE CASCADE;
            END IF;
        END $$;
    """)

    # weather_unique may already exist from before the refactor, targeting
    # (mountain_id, hiking_date) — checking existence by name alone (as this
    # used to) leaves that stale constraint in place forever, so every
    # ON CONFLICT (waypoint_id, hiking_date) upsert keeps failing. Verify the
    # constraint actually covers the columns the app upserts on, and rebuild
    # it if not.
    cursor.execute("""
        SELECT array_agg(a.attname ORDER BY k.ord)
        FROM pg_constraint c
        JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
        WHERE c.conname = 'weather_unique'
        GROUP BY c.oid
    """)
    row = cursor.fetchone()
    current_cols = row[0] if row else None
    if current_cols != ["waypoint_id", "hiking_date"]:
        if current_cols is not None:
            cursor.execute("ALTER TABLE weather_forecasts DROP CONSTRAINT weather_unique")
        cursor.execute(
            "ALTER TABLE weather_forecasts ADD CONSTRAINT weather_unique UNIQUE (waypoint_id, hiking_date)"
        )

    # Demo registrar account for testing POST /trails/create without granting
    # full admin access. Seeded here too since the INSERT in tarapeak.sql only
    # runs on a brand-new database.
    cursor.execute(
        """
        INSERT INTO users (first_name, last_name, username, email, password, hiker_experience, role)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (email) DO NOTHING
        """,
        (
            "Rio", "Domingo", "rio.domingo", "registrar@tarapeak.com",
            "$2b$12$gujVneZjqDPAPAr.cBmS1.QL2nZc7bKU8j/GyB.4k8LLLANdnZk2e",
            "expert", "registrar",
        ),
    )
    conn.commit()

    cursor.execute("SELECT COUNT(*) FROM route_waypoints")
    if cursor.fetchone()[0] == 0:
        cursor.execute(WAYPOINTS_SEED_SQL)
        conn.commit()

    cursor.execute("SELECT COUNT(*) FROM trail_checkpoints")
    if cursor.fetchone()[0] == 0:
        # Only safe when the waypoint ids line up with the seed order above.
        cursor.execute("SELECT MIN(waypoint_id), COUNT(*) FROM route_waypoints")
        min_id, count = cursor.fetchone()
        if min_id == 1 and count == 11:
            cursor.execute(CHECKPOINTS_SEED_SQL)
            conn.commit()
        else:
            print(
                "[init_db] Skipping checkpoint seed: route_waypoints ids do not match "
                "the expected 1-11 seed range. Add checkpoints manually."
            )

    cursor.execute("SELECT COUNT(*) FROM weather_forecasts")
    if cursor.fetchone()[0] == 0:
        cursor.execute(WEATHER_SEED_SQL)
        conn.commit()

    cursor.execute(HAZARDS_SEED_SQL)
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


def get_weather_forecast(waypoint_id: int, hiking_date: date):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT temperature, humidity, wind_speed, precipitation, weather_code 
        FROM weather_forecasts 
        WHERE waypoint_id = %s AND hiking_date = %s
        """,
        (waypoint_id, hiking_date),
    )
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if row:
        return {
            "waypoint_id": waypoint_id,
            "hiking_date": hiking_date.isoformat(),
            "temperature": float(row[0]),
            "humidity": int(row[1]) if row[1] is not None else None,
            "wind_speed": float(row[2]) if row[2] is not None else None,
            "precipitation_mm": float(row[3]) if row[3] is not None else 0.0,
            "weather_code": int(row[4]) if row[4] is not None else None,
        }
    return None

def save_weather_forecast(
    waypoint_id: int, 
    hiking_date: date, 
    temp: float, 
    hum: int, 
    wind: float, 
    precipitation: float, 
    weather_code: int
):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO weather_forecasts (waypoint_id, hiking_date, temperature, humidity, wind_speed, precipitation, weather_code)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (waypoint_id, hiking_date) DO UPDATE 
            SET temperature = EXCLUDED.temperature, 
                humidity = EXCLUDED.humidity, 
                wind_speed = EXCLUDED.wind_speed,
                precipitation = EXCLUDED.precipitation,
                weather_code = EXCLUDED.weather_code
            """,
            (waypoint_id, hiking_date, temp, hum, wind, precipitation, weather_code),
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

def get_user_experience(user_id: int) -> str:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT hiker_experience FROM users WHERE user_id = %s", (user_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return row[0] if row and row[0] else "Beginner"


def get_plan_checkpoints(plan_id: int) -> list:
    """Fetch the ordered checkpoints along the trail a plan is booked on."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        """
        SELECT c.*
        FROM trail_checkpoints c
        JOIN plans p ON p.waypoint_id = c.route_waypoint_id
        WHERE p.plan_id = %s
        ORDER BY c.sequence_order ASC
        """,
        (plan_id,),
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(row) for row in rows]


def create_notification(
    cursor,
    user_id: int,
    title: str,
    message: str,
    type_: str,
    reference_id: Optional[int] = None,
) -> None:
    """Queue an in-app alert for a user.

    Takes an open cursor so the notification commits atomically with whatever
    change triggered it — an invite that rolls back leaves no orphan alert.
    """
    cursor.execute(
        """
        INSERT INTO notifications (user_id, title, message, type, reference_id)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (user_id, title, message, type_, reference_id),
    )


def get_climate_baseline_years(waypoint_id: int, month: int, years: list) -> list:
    """Whichever of the requested years are already cached for this
    waypoint/month. The predictive endpoint only re-fetches the gap."""
    if not years:
        return []
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        """
        SELECT year, avg_temperature, avg_humidity, avg_wind_speed, avg_precipitation
        FROM weather_climate_baseline
        WHERE waypoint_id = %s AND month = %s AND year = ANY(%s)
        ORDER BY year
        """,
        (waypoint_id, month, years),
    )
    rows = [dict(r) for r in cursor.fetchall()]
    cursor.close()
    conn.close()
    return rows


def save_climate_baseline_year(waypoint_id: int, year: int, month: int, averages: dict) -> None:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO weather_climate_baseline
            (waypoint_id, year, month, avg_temperature, avg_humidity, avg_wind_speed, avg_precipitation)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (waypoint_id, year, month) DO UPDATE
        SET avg_temperature = EXCLUDED.avg_temperature,
            avg_humidity = EXCLUDED.avg_humidity,
            avg_wind_speed = EXCLUDED.avg_wind_speed,
            avg_precipitation = EXCLUDED.avg_precipitation,
            fetched_at = CURRENT_TIMESTAMP
        """,
        (
            waypoint_id, year, month,
            averages.get("avg_temperature"), averages.get("avg_humidity"),
            averages.get("avg_wind_speed"), averages.get("avg_precipitation"),
        ),
    )
    conn.commit()
    cursor.close()
    conn.close()
