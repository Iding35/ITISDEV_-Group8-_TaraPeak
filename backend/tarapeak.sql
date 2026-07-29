CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    username VARCHAR(50) UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    hiker_experience VARCHAR(50) DEFAULT 'beginner',
    role VARCHAR(50) NOT NULL DEFAULT 'hiker' CHECK (role IN ('hiker', 'admin', 'registrar')),
    -- Failed-login counter and the lockout it triggers; see auth.py login().
    login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mountains (
    mountain_id SERIAL PRIMARY KEY,
    mountain_name VARCHAR(50) NOT NULL,
    location VARCHAR(200),
    description TEXT,
    image_url VARCHAR(200),
    terrain VARCHAR(100),
    hazards VARCHAR(300),
    total_hikers INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS route_waypoints (
    waypoint_id SERIAL PRIMARY KEY,
    mountain_id INT NOT NULL,
    sequence_order INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    longitude FLOAT NOT NULL,
    latitude FLOAT NOT NULL,
    elevation_m INT,
    difficulty VARCHAR(20) NOT NULL,
    estimated_time FLOAT NOT NULL,
    distance_from_start_km DECIMAL(4,1),
    total_hikers INT DEFAULT 0, -- added total hikers PER TRAIL (PHILLIN)
    accessibility VARCHAR(50),
    CONSTRAINT waypoint_fk_mountains FOREIGN KEY (mountain_id) REFERENCES mountains(mountain_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weather_forecasts (
    weather_id SERIAL PRIMARY KEY,
    waypoint_id INT NOT NULL,
    mountain_id INT,
    hiking_date DATE NOT NULL,
    temperature DECIMAL(3,1),
    humidity INT,
    wind_speed DECIMAL(4,1), 
    precipitation DECIMAL(5,1), 
    weather_code INT,          
    CONSTRAINT weather_fk_waypoints FOREIGN KEY (waypoint_id) REFERENCES route_waypoints(waypoint_id) ON DELETE CASCADE,
    CONSTRAINT weather_fk_mountains FOREIGN KEY (mountain_id) REFERENCES mountains(mountain_id) ON DELETE CASCADE,
    CONSTRAINT weather_unique UNIQUE (waypoint_id, hiking_date)
);

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
    CONSTRAINT checkpoint_fk_mountains FOREIGN KEY (mountain_id) REFERENCES mountains(mountain_id) ON DELETE CASCADE,
    CONSTRAINT checkpoint_fk_route_waypoints FOREIGN KEY (route_waypoint_id) REFERENCES route_waypoints(waypoint_id) ON DELETE CASCADE
    
);

-- Saved hike plans. `plans` is the hike_plans table referenced in the specs.
-- The four ai_* columns persist the AI output that was generated for THIS
-- plan's exact mountain/trail/date combination, so a saved plan keeps the
-- advice it was created with even after ai_analysis_cache is refreshed.
CREATE TABLE IF NOT EXISTS plans (
    plan_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    mountain_id INT NOT NULL,
    waypoint_id INT NOT NULL,
    checkpoint_id INT NULL, 
    date DATE NOT NULL,
    notes TEXT NULL,

    is_completed BOOLEAN DEFAULT FALSE,
    completion_time INTERVAL NULL, 
    completed_at TIMESTAMP NULL,

    ai_gear_summary TEXT,
    ai_difficulty_analysis TEXT,
    ai_safety_analysis TEXT,
    ai_route_plan TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT plans_fk_users
        FOREIGN KEY (user_id)
        REFERENCES users(user_id),

    CONSTRAINT plans_fk_mountains
        FOREIGN KEY (mountain_id)
        REFERENCES mountains(mountain_id),

    CONSTRAINT plans_fk_waypoints
        FOREIGN KEY (waypoint_id)
        REFERENCES route_waypoints(waypoint_id),

    CONSTRAINT plans_fk_checkpoints
        FOREIGN KEY (checkpoint_id)
        REFERENCES trail_checkpoints(checkpoint_id) 
        ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS plan_checkpoints (
            plan_id INT REFERENCES plans(plan_id) ON DELETE CASCADE,
            checkpoint_id INT REFERENCES trail_checkpoints(checkpoint_id) ON DELETE CASCADE,
            PRIMARY KEY (plan_id, checkpoint_id)
        );
CREATE TABLE IF NOT EXISTS plan_completed_checkpoints (
    plan_checkpoint_id SERIAL PRIMARY KEY,
    plan_id INT NOT NULL,
    checkpoint_id INT NOT NULL, 
    reached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT NULL,

    CONSTRAINT fk_plan_completed_cp_plans
        FOREIGN KEY (plan_id)
        REFERENCES plans(plan_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_plan_completed_cp_trail_cp
        FOREIGN KEY (checkpoint_id)
        REFERENCES trail_checkpoints(checkpoint_id)
        ON DELETE CASCADE,

    CONSTRAINT uc_plan_checkpoint UNIQUE (plan_id, checkpoint_id)
);

CREATE TABLE IF NOT EXISTS gear_recommendations (
    gear_id SERIAL PRIMARY KEY,
    plan_id INT NOT NULL,
    gear_name VARCHAR(100),
    category VARCHAR(50),
    reason TEXT,
    is_required BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT gear_fk_plans FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE CASCADE
);



CREATE TABLE IF NOT EXISTS trail_reports (
    report_id SERIAL PRIMARY KEY,
    mountain_id INT REFERENCES mountains(mountain_id) ON DELETE CASCADE,
    waypoint_id INT REFERENCES route_waypoints(waypoint_id) ON DELETE CASCADE,
    user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    condition VARCHAR(100) NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Links users to a hike plan with an invitation status.
-- `synced_at` is bumped for every member whenever the organizer edits the
-- plan, so each member record carries proof of the last propagated change.
CREATE TABLE IF NOT EXISTS plan_members (
    plan_member_id SERIAL PRIMARY KEY,
    plan_id INT NOT NULL REFERENCES plans(plan_id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    invited_by INT REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT plan_members_unique UNIQUE (plan_id, user_id),
    CONSTRAINT plan_members_status_check CHECK (status IN ('pending', 'accepted', 'declined'))
);

-- In-app alerts surfaced on the dashboard: invitations received, invitation
-- responses, plan edits propagated to members, and removals.
CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) NOT NULL,
    reference_id INT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_analysis_cache (
    cache_id SERIAL PRIMARY KEY,
    mountain_id INT NOT NULL,
    analysis_type VARCHAR(20) NOT NULL,
    cache_key VARCHAR(20) NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ai_cache_fk_mountains FOREIGN KEY (mountain_id) REFERENCES mountains(mountain_id),
    CONSTRAINT ai_cache_unique UNIQUE (mountain_id, analysis_type, cache_key)
);

-- TRIGGER FUNCTION TO AUTO-SUM TOTAL HIKERS IN THE MOUNTAINS TABLE

CREATE OR REPLACE FUNCTION sync_mountain_total_hikers()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the mountain's total_hikers based on the sum of all its waypoints
    UPDATE mountains
    SET total_hikers = COALESCE((
        SELECT SUM(total_hikers) 
        FROM route_waypoints 
        WHERE mountain_id = COALESCE(NEW.mountain_id, OLD.mountain_id)
    ), 0)
    WHERE mountain_id = COALESCE(NEW.mountain_id, OLD.mountain_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger fires after INSERT, UPDATE, or DELETE on route_waypoints
CREATE OR REPLACE TRIGGER trg_sync_mountain_hikers
AFTER INSERT OR UPDATE OF total_hikers OR DELETE
ON route_waypoints
FOR EACH ROW
EXECUTE FUNCTION sync_mountain_total_hikers();

-- ==========================================================
-- INSERTS
-- ==========================================================

-- MOUNTAINS
INSERT INTO mountains (mountain_name, location, description, image_url, terrain, hazards, total_hikers) VALUES
('Mount Ulap', 'Itogon, Benguet', 'A beginner-friendly mountain known for its pine forests, scenic grasslands, and panoramic ridge views.', 'img/mt-ulap.svg', 'Pine Forest', 'Exposed ridgelines with no shade, slippery clay when wet, steep drop-offs near Gungal Rock, limited water sources along the traverse.', 0),
('Mount Yangbew', 'La Trinidad, Benguet', 'A short hiking destination famous for its sunrise views, rock formations, and colorful flower gardens.', 'img/mt-yangbew.svg', 'Grassland', 'Loose rock near the formations, strong crosswinds on the open plateau, sun exposure with almost no tree cover, crowding at sunrise.', 0),
('Mount Pulag', 'Kabayan, Benguet', 'The third highest mountain in the Philippines, renowned for its sea of clouds, mossy forests, and breathtaking sunrise.', 'img/mt-pulag.svg', 'Mossy Forest', 'Hypothermia risk from near-freezing summit temperatures, altitude sickness above 2,500 m, dense fog with low visibility, slippery mossy roots, long emergency evacuation times.', 0);

-- ROUTE WAYPOINTS (Trails)
-- accessibility reflects how reachable the trailhead/route itself is, distinct
-- from `difficulty` (how hard the hike is once you're on it).
INSERT INTO route_waypoints (mountain_id, sequence_order, name, description, longitude, latitude, elevation_m, difficulty, estimated_time, distance_from_start_km, total_hikers, accessibility) VALUES
-- Mount Ulap Trails (IDs: 1, 2, 3)
-- Mount Ulap Trails (Total Hikers: 15 + 25 + 60 = 100)
(1, 1, 'Ambacao Paway Ridge', 'A scenic ridge offering panoramic views of the surrounding mountains and valleys.', 120.6358, 16.2947, 1520, 'Easy', 0.2, 0.5, 15, 'Paved Road Access'),
(1, 2, 'Ampucao Trailhead', 'One of the main access points to the Mount Ulap Eco-Trail, featuring registration facilities and the first panoramic views of the Itogon ridgelines.', 120.6358, 16.2947, 1520, 'Easy', 0.2, 0.5, 25, 'Paved Road Access'),
(1, 3, 'Mount Ulap Eco-Trail','The official hiking route of Mount Ulap. This 9.4 km trail passes through scenic pine forests, the Ambanao Paway ridge, the iconic Gungal Rock, and ends at the 1,846-meter summit with panoramic views of the Cordillera mountain range.', 120.6312, 16.2904, 1846, 'Moderate', 4.5, 9.4, 60, 'Unpaved Trailhead'),
-- Mount Yangbew Trails (IDs: 4, 5, 6, 7)
-- Mount Yangbew Trails (Total Hikers: 10 + 20 + 30 + 40 = 100)
(2, 1, 'Yangbew Trailhead', 'The main jump-off point for Mount Yangbew, also known as Little Pulag because of its grassland scenery resembling Mount Pulag.', 120.607052, 16.453989, 1446, 'Easy', 0.30, 3.2, 10, 'Paved Road Access'),
(2, 2, 'Grassland Ridge', 'An open grassland section offering panoramic views of La Trinidad Valley and the surrounding mountains.', 120.5906, 16.4580, 1510, 'Easy', 0.3, 1.2, 20, 'Paved Road Access'),
(2, 3, 'Rock Formation Viewpoint', 'A popular photo stop featuring natural rock formations overlooking the valley below.', 120.5925, 16.4605, 1560, 'Easy', 0.7, 2.3, 30, 'Paved Road Access'),
(2, 4, 'Mount Yangbew Summit', 'The summit of Mount Yangbew offers breathtaking sunrise and sunset views over La Trinidad and Baguio City.', 120.5940, 16.4622, 1609, 'Easy', 1.1, 3.3, 40, 'Unpaved Trailhead'),
-- Mount Pulag Trails (IDs: 8, 9, 10, 11)
-- Mount Pulag Trails (Total Hikers: 50 + 20 + 20 + 10 = 100)
(3, 1, 'Ambangeg Trail', 'The most popular and beginner-friendly trail to Mount Pulag, often called the "Artista Trail". The summit is typically reached in 3 to 4 hours.', 121.08612, 16.52075, 2250, 'Easy', 4.0, 7.0, 50, 'Unpaved Trailhead'),
(3, 2, 'Tawangan Trail', 'A scenic trail passing through traditional Ibaloi communities, mossy forests, and grasslands before reaching the summit.', 120.89917, 16.5975, 2200, 'Moderate', 18.0, 12.0, 20, '4x4 / High-Clearance Required'),
(3, 3, 'Akiki Trail', 'Known as the "Killer Trail", Akiki is recommended for experienced hikers due to its steep ascents and multi-day trek.', 120.8992, 16.5975, 2260, 'Hard', 14.0, 20.4, 20, 'Remote / Difficult Access'),
(3, 4, 'Ambaguio Trail', 'A less frequently used route approaching Mount Pulag from Nueva Vizcaya, known for its long forest sections.', 121.0564, 16.5794, 2150, 'Hard', 24.0, 16.0, 10, 'Remote / Difficult Access');

-- ==========================================================
-- TRAIL CHECKPOINTS INSERT
-- ==========================================================
INSERT INTO trail_checkpoints 
(mountain_id, route_waypoint_id, sequence_order, name, description, longitude, latitude, elevation_m, difficulty, estimated_time, distance_from_start_km) 
VALUES

-- ==========================================================
-- MOUNT ULAP (mountain_id = 1)
-- ==========================================================

-- Trail 1: Ambacao Paway Ridge Traverse (route_waypoint_id = 1)
(1, 1, 1, 'Ampucao Entry Gate', 'Starting point near Philex Road heading up to Ambacao Paway.', 120.6358, 16.2947, 1520, 'Easy', 0.0, 0.0),
(1, 1, 2, 'Pine Grove Rest Area', 'Shaded pine area along the initial incline.', 120.6380, 16.2970, 1580, 'Easy', 0.2, 0.43),
(1, 1, 3, 'Ambacao Ridge Viewpoint', 'A scenic ridge offering panoramic views of the surrounding mountains and valleys.', 120.6410, 16.3010, 1680, 'Easy', 0.5, 1.12),
(1, 1, 4, 'Grassland Slope', 'Gentle slope running parallel to the main ridge line.', 120.6435, 16.3035, 1720, 'Easy', 0.8, 1.60),
(1, 1, 5, 'Paway High Point', 'Summit ridge point of the Ambacao section.', 120.6471, 16.3060, 1788, 'Easy', 1.2, 2.19),

-- Trail 2: Ampucao Out-and-Back Trail (route_waypoint_id = 2)
(1, 2, 1, 'Ampucao Barangay Hall', 'Main registration and guide assembly hall.', 120.6550, 16.3253, 1497, 'Easy', 0.0, 0.0),
(1, 2, 2, 'Totomtombek Rest Stop', 'First covered rest shelter surrounded by Benguet pines.', 120.6482, 16.3218, 1552, 'Easy', 0.3, 1.03),
(1, 2, 3, 'Corral Rock Formation', 'Distinct rock outcrop along the ridge trail.', 120.6475, 16.3130, 1603, 'Easy', 0.8, 2.26),
(1, 2, 4, 'Ambanao Paway Peak', 'Grassland peak with wide open views of Benguet.', 120.6471, 16.3060, 1788, 'Easy', 1.3, 3.23),
(1, 2, 5, 'Ampucao Turnaround Point', 'Popular midpoint turnaround spot for shorter day hikes.', 120.6410, 16.3010, 1750, 'Easy', 1.8, 4.30),

-- Trail 3: Mount Ulap Eco-Trail (route_waypoint_id = 3)
(1, 3, 1, 'Ampucao Trailhead', 'Starting jump-off point at Barangay Ampucao registration hall.', 120.6550, 16.3253, 1497, 'Easy', 0.0, 0.0),
(1, 3, 2, 'Totomtombek Rest Stop', 'First resting shelter surrounded by Benguet pine trees.', 120.6482, 16.3218, 1559, 'Easy', 0.3, 1.03),
(1, 3, 3, 'Ambanao Paway Ridge', 'First major peak with rolling grasslands and scenic vistas.', 120.6471, 16.3060, 1788, 'Easy', 1.3, 3.23),
(1, 3, 4, 'Gungal Rock', 'The iconic cliff-side rock formation and popular photo stop.', 120.6368, 16.2950, 1814, 'Moderate', 2.3, 5.29),
(1, 3, 5, 'Mount Ulap Summit', 'Highest point along the trail offering 360-degree Cordillera views.', 120.6310, 16.2900, 1846, 'Moderate', 3.0, 6.33),
(1, 3, 6, 'Sta. Fe Exit', 'End of the traverse trail leading down to hanging bridges.', 120.6215, 16.2810, 1277, 'Moderate', 4.5, 8.11),


-- ==========================================================
-- MOUNT YANGBEW (mountain_id = 2)
-- ==========================================================

-- Trail 1: Yangbew Main Trailhead Route (route_waypoint_id = 4)
(2, 4, 1, 'Yangbew Trailhead Gate', 'The main jump-off point for Mount Yangbew near the barangay hall.', 120.6070, 16.4540, 1446, 'Easy', 0.0, 0.0),
(2, 4, 2, 'Pine Grove Path', 'Early pine tree shade before the open grassland.', 120.6050, 16.4555, 1490, 'Easy', 0.2, 0.32),
(2, 4, 3, 'Tayawan Viewdeck Rest Stop', 'Small open clearing with view of La Trinidad valley.', 120.60210687432455, 16.460902637071587, 1530, 'Easy', 0.4, 0.87),
(2, 4, 4, 'Yangbew Plateau Entry', 'Entry point onto the grassy upper summit plateau.', 120.5960, 16.4600, 1585, 'Easy', 0.8, 1.63),
(2, 4, 5, 'Main Summit Marker', 'Main summit sign and horse riding area on the grassland.', 120.5940, 16.4622, 1609, 'Easy', 1.0, 2.02),

-- Trail 2: Grassland Ridge Trail (route_waypoint_id = 5)
(2, 5, 1, 'Grassland Ridge Start', 'Starting point along the eastern open ridge slope.', 120.5906, 16.4580, 1510, 'Easy', 0.0, 0.0),
(2, 5, 2, 'Lower Meadow Walk', 'Gentle trail section walking across green pasture land.', 120.5915, 16.4590, 1535, 'Easy', 0.1, 0.18),
(2, 5, 3, 'East Viewpoint Hill', 'Scenic hill overlook facing eastern mountain ranges.', 120.5928, 16.4600, 1570, 'Easy', 0.2, 0.39),
(2, 5, 4, 'Upper Ridge Junction', 'Junction joining the main summit trail on the ridge.', 120.5940, 16.4618, 1600, 'Easy', 0.4, 0.67),

-- Trail 3: Rock Formation Viewpoint Trail (route_waypoint_id = 6)
(2, 6, 1, 'Rock Formation Trailhead', 'Starting point near the northern rocky approaches.', 120.5925, 16.4605, 1560, 'Easy', 0.0, 0.0),
(2, 6, 2, 'Bouldering Outcrop', 'Scattered limestone rock formations ideal for quick photo stops.', 120.5932, 16.4612, 1585, 'Easy', 0.1, 0.13),
(2, 6, 3, 'Valley Viewpoint Rock', 'The highest rock cluster offering clear views of La Trinidad Valley.', 120.5938, 16.4618, 1602, 'Easy', 0.2, 0.24),
(2, 6, 4, 'Summit Plateau Connector', 'Short grassy path connecting the rock formations to the main summit.', 120.5940, 16.4622, 1609, 'Easy', 0.3, 0.30),

-- Trail 4: Yangbew Summit Mix Route (route_waypoint_id = 7)
(2, 7, 1, 'Tawang Base Jump-off', 'Main registration and parking area at the base of Mount Yangbew.', 120.6070, 16.4540, 1446, 'Easy', 0.0, 0.0),
(2, 7, 2, 'Pine Forest Pass', 'Shaded woodland trail connecting the lower valley to the upper ridge.', 120.6035, 16.4565, 1515, 'Easy', 0.3, 0.56),
(2, 7, 3, 'Rock Formation Overlook', 'Natural limestone outcrop offering scenic photo spots over La Trinidad.', 120.5980, 16.4600, 1565, 'Easy', 0.7, 1.40),
(2, 7, 4, 'Mount Yangbew Summit Plateau', 'The main summit area with 360-degree views of Baguio and La Trinidad Valley.', 120.5940, 16.4622, 1609, 'Easy', 1.0, 1.99),
(2, 7, 5, 'Grassland Ridge Descent', 'Open grassland pasture trail descending back towards the Tawang exit.', 120.5910, 16.4585, 1520, 'Easy', 1.3, 2.62),

-- ==========================================================
-- MOUNT PULAG (mountain_id = 3)
-- ==========================================================

-- Trail 1: Ambangeg Trail (route_waypoint_id = 8)
(3, 8, 1, 'Babadak Ranger Station', 'Main jump-off center for registration, guides, and briefing.', 120.8988, 16.5492, 2400, 'Easy', 0.0, 0.0),
(3, 8, 2, 'Camp 1 Shelter', 'First major resting point along the shaded pine forest section.', 120.89301825507796, 16.579809470696365, 2530, 'Easy', 1.0, 2.5),
(3, 8, 3, 'Camp 2 (Mossy Forest Exit)', 'Campsite marking the boundary between mossy forest and dwarf bamboo grassland.', 120.90730, 16.58404, 2685, 'Easy', 3.0, 5.8),
(3, 8, 4, 'Saddle Campsite', 'High-altitude campsite right below the summit peak.', 120.8959, 16.59735, 2840, 'Easy', 3.5, 6.8),
(3, 8, 5, 'Mount Pulag Summit', 'The highest peak in Luzon (2,928m) famous for the sea of clouds.', 120.89879, 16.59772, 2928, 'Easy', 4.0, 8.3),

-- Trail 2: Tawangan Trail (route_waypoint_id = 9)
(3, 9, 1, 'Tawangan Barangay Hall', 'Jump-off point and registration area in Barangay Tawangan, Kabayan.', 120.9272, 16.6917, 1480, 'Hard', 0.0, 0.0),
(3, 9, 2, 'Tawangan Mossy Forest Camp', 'Deep mossy forest campsite with high humidity, moss-covered trails, and leeches.', 120.9255, 16.6508, 2150, 'Hard', 5.0, 7.5),
(3, 9, 3, 'Ta-aw Junction / Grassland', 'The transition area where the dense mossy forest opens up to the cold dwarf bamboo grassland.', 120.9290, 16.6210, 2710, 'Hard', 8.5, 11.5),
(3, 9, 4, 'Mount Pulag Summit', 'Summit junction approaching from the northern mossy forest trail.', 120.89879, 16.59772, 2928, 'Hard', 10.0, 13.5),

-- Trail 3: Akiki Trail (route_waypoint_id = 10)
(3, 10, 1, 'Akiki Jump-off (Ranger Station)', 'The official starting point of the Akiki Trail in Kabayan, Benguet.', 120.84014, 16.61011, 2260, 'Hard', 0.0, 0.0),
(3, 10, 2, 'Eddet Campsite', 'A popular rest stop and campsite featuring a hanging bridge and freshwater source.', 120.86420, 16.60630, 1650, 'Hard', 3.0, 2.5),
(3, 10, 3, 'Marlboro Campsite', 'An open grassland campsite known for its scenic views and pine tree surroundings.', 120.87838, 16.60403, 2200, 'Hard', 7.0, 6.8),
(3, 10, 4, 'Viewpoint Halsema Highway', 'A high-altitude vantage point showcasing distant mountain ridges, deep valleys, and sweeping sights.', 120.87838, 16.60403, 2450, 'Hard', 10.0, 10.5),
(3, 10, 5, 'Pulag Saddle Camp', 'The final campsite located just below the summit, known for extreme cold temperatures.', 120.89589, 16.59735, 2840, 'Hard', 13.0, 14.2),
(3, 10, 6, 'Mount Pulag Summit', 'The highest peak in Luzon (2,928m) offering the famous 360-degree sea of clouds view.', 120.89879, 16.59772, 2928, 'Hard', 14.0, 15.4),

-- Trail 4: Ambaguio Trail (route_waypoint_id = 11)
(3, 11, 1, 'Ambaguio Jump-off (Poblacion)', 'Starting point and registration center in Poblacion, Ambaguio, Nueva Vizcaya.', 121.0235, 16.5381, 1100, 'Hard', 0.0, 0.0),
(3, 11, 2, 'Upper Napo Rest Stop', 'First major resting point along the challenging mossy forest ridgeline.', 120.9850, 16.5495, 1850, 'Hard', 4.5, 11.5),
(3, 11, 3, 'Lusod Village', 'A remote, high-altitude mountain village serving as the primary overnight campsite for day one.', 120.9620, 16.5640, 1920, 'Hard', 7.5, 16.0),
(3, 11, 4, 'Bantay Lakay Pine Ridge', 'A scenic, open pine ridge trail presenting rolling hills and steep climbs.', 120.9415, 16.5855, 2350, 'Hard', 11.0, 21.5),
(3, 11, 5, 'Mount Pulag Summit', 'The highest peak in Luzon (2,928m), approaching directly from the eastern Nueva Vizcaya slope.', 120.89879, 16.59772, 2928, 'Hard', 14.0, 24.5);


-- WEATHER FORECASTS
INSERT INTO weather_forecasts (waypoint_id, mountain_id, hiking_date, temperature, humidity, wind_speed, precipitation, weather_code) VALUES
(1, 1, CURRENT_DATE, 18.5, 70, 12.0, 0.0, 0),
(1, 1, CURRENT_DATE + 1, 19.0, 65, 10.0, 0.0, 0),
(1, 1, CURRENT_DATE + 2, 17.5, 75, 15.0, 1.2, 51),
(1, 1, CURRENT_DATE + 3, 18.0, 72, 13.0, 0.5, 2),
(4, 2, CURRENT_DATE, 20.0, 60, 8.0, 0.0, 0),
(4, 2, CURRENT_DATE + 1, 21.0, 55, 9.0, 0.0, 0),
(4, 2, CURRENT_DATE + 2, 19.5, 68, 11.0, 0.0, 1),
(4, 2, CURRENT_DATE + 3, 20.5, 58, 8.0, 0.0, 0),
(8, 3, CURRENT_DATE, 8.0, 85, 25.0, 4.5, 61),
(8, 3, CURRENT_DATE + 1, 7.5, 88, 30.0, 8.2, 63),
(8, 3, CURRENT_DATE + 2, 9.0, 80, 22.0, 1.0, 51),
(8, 3, CURRENT_DATE + 3, 8.5, 83, 27.0, 3.1, 61);


-- USERS
-- role is one of hiker/admin/registrar. Demo registrar account lets you test
-- POST /trails/create without granting full admin access.
INSERT INTO users (first_name, last_name, username, email, password, hiker_experience, role) VALUES
('Alex', 'Rivera', 'alex.rivera', 'alex.rivera@example.com', '$2b$12$U142o1R5v9EYyPQ5eBMtLuflnt/G832bpDLJGN7sjdbMf/At8ZSCu', 'beginner', 'hiker'),
('Maria', 'Santos', 'maria.santos', 'maria.santos@example.com', '$2b$12$EY4bVXmsJ94o5nOTlMB9Ku61aH1ryG7B78a6lQnNb1Sy6OyNpuBua', 'intermediate','hiker'),
('John', 'Doe', 'john.doe', 'john.doe@example.com', '$2b$12$XAN4i.zDasHrQ1L5GP.zV.IgBbFzcVb.AnA07picJ8srjSsXMRVnG', 'expert', 'hiker'),
('Elena', 'Cruz', 'elena.cruz', 'elena.cruz@example.com', '$2b$12$ohavHqkSIE7eXgC70vtPbuGZ4.c8Vv/EvHbXjK6jInWXb4x830oum', 'beginner','hiker'),
('Ramon', 'Reyes', 'ramon.reyes', 'ramon.reyes@example.com', '$2b$12$He0BBjubopiXw9mctoHjD.XgAvO1GvB7eD9QRTjCx9c4cryIMyHVy', 'intermediate', 'hiker'),
('Cheska', 'Martinez', 'admin', 'admin@tarapeak.com', '$2b$12$33zauXWVwEOUUAMYDH.Y.uUQOKa5jaynXXNGeZPOaBnDaWvk2jQCi', 'expert','admin'),
('Rio', 'Domingo', 'rio.domingo', 'registrar@tarapeak.com', '$2b$12$gujVneZjqDPAPAr.cBmS1.QL2nZc7bKU8j/GyB.4k8LLLANdnZk2e', 'expert','registrar');
-- registrar@tarapeak.com password: registrar123

UPDATE users SET created_at = '2025-01-15 10:00:00' WHERE email = 'alex.rivera@example.com';
UPDATE users SET created_at = '2025-04-20 11:30:00' WHERE email = 'maria.santos@example.com';
UPDATE users SET created_at = '2025-07-10 14:15:00' WHERE email = 'john.doe@example.com';
UPDATE users SET created_at = '2025-10-18 09:00:00' WHERE email = 'elena.cruz@example.com';
UPDATE users SET created_at = '2026-01-05 16:45:00' WHERE email = 'ramon.reyes@example.com';
-- TRAIL REPORTS
INSERT INTO trail_reports (mountain_id, waypoint_id, user_id, rating, condition, comment, created_at) VALUES
(1, 3, 1, 4, 'Muddy / Slippery', 'Trail had significant mud near Gungal Rock on the Eco-Trail. Trekking poles recommended.', '2026-07-13 09:30:00+00'),
(1, 2, 2, 5, 'Clear & Well-Marked', 'Great visibility early in the morning near Ampucao Trailhead! Markings are clear.', '2026-07-13 14:15:00+00'),
(2, 5, 3, 3, 'Overgrown Vegetation', 'Lots of tall grass along Grassland Ridge. Wear long sleeves to protect yourself.', '2026-07-13 11:00:00+00'),
(2, 4, 4, 5, 'Clear & Dry', 'Short and easy hike at Mount Yangbew Summit. Excellent conditions throughout.', '2026-07-13 16:20:00+00'),
(3, 8, 5, 3, 'Foggy / Low Visibility', 'Very cold and low visibility along Ambangeg Trail. Bring proper cold weather gear.', '2026-07-13 05:45:00+00'),
(1, 1, 1, 4, 'Muddy / Slippery', 'Loose soil on the initial ridge ascent.', NOW()),
(1, 2, 2, 3, 'Rocky Terrain', 'Sign post area has rocky, uneven footing.', NOW()),
(1, 1, 3, 2, 'Steep Sections', 'Heavy foot traffic causing soil erosion along Ambacao.', NOW()),
(1, 3, 4, 5, 'Clear & Well-Marked', 'Clear skies at the Eco-Trail summit area.', NOW()),
(3, 9, 4, 4, 'Foggy / Low Visibility', 'Tawangan Trail mossy forest section is very damp and foggy.', NOW()),
(3, 10, 5, 5, 'Steep Sections', 'Akiki Trail is dry but tough as usual with steep climbs.', NOW());

-- ==========================================================
-- PLANNED TRIPS (`plans`)
-- ==========================================================

INSERT INTO plans (user_id, mountain_id, waypoint_id, date, is_completed, completion_time, completed_at) VALUES
(1, 1, 3, CURRENT_DATE, TRUE, INTERVAL '4 hours 30 minutes', CURRENT_TIMESTAMP),
(2, 1, 1, CURRENT_DATE, FALSE, NULL, NULL),
(3, 1, 2, CURRENT_DATE, TRUE, INTERVAL '5 hours 15 minutes', CURRENT_TIMESTAMP),
(4, 1, 3, CURRENT_DATE, FALSE, NULL, NULL),
(5, 2, 7, CURRENT_DATE, FALSE, NULL, NULL),

(1, 1, 2, CURRENT_DATE + INTERVAL '5 days', FALSE, NULL, NULL),
(2, 1, 3, CURRENT_DATE + INTERVAL '12 days', FALSE, NULL, NULL),
(3, 3, 10, CURRENT_DATE + INTERVAL '10 days', FALSE, NULL, NULL),
(4, 3, 8, CURRENT_DATE + INTERVAL '10 days', FALSE, NULL, NULL),
(5, 3, 11, CURRENT_DATE + INTERVAL '20 days', FALSE, NULL, NULL),
(1, 2, 5, CURRENT_DATE + INTERVAL '7 days', FALSE, NULL, NULL);


-- ==========================================
--  `plan_completed_checkpoints`
-- ==========================================
INSERT INTO plan_completed_checkpoints (plan_id, checkpoint_id, reached_at, notes) VALUES
(1, 1, CURRENT_TIMESTAMP - INTERVAL '4 hours', 'Hit the trailhead on time.'),
(1, 2, CURRENT_TIMESTAMP - INTERVAL '2 hours', 'Made it past the ridge checkpoint.'),
(3, 2, CURRENT_TIMESTAMP - INTERVAL '3 hours', 'Paused briefly at the standard lookout.');