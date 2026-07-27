CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    username VARCHAR(50) UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    hiker_experience VARCHAR(50) DEFAULT 'beginner',
    role VARCHAR(50) DEFAULT 'user',
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

CREATE TABLE IF NOT EXISTS weather_forecasts (
    weather_id SERIAL PRIMARY KEY,
    mountain_id INT,
    hiking_date DATE,
    temperature DECIMAL(3,1),
    humidity INT,
    wind_speed INT,
    CONSTRAINT weather_fk_mountains FOREIGN KEY (mountain_id) REFERENCES mountains(mountain_id),
    CONSTRAINT weather_unique UNIQUE (mountain_id, hiking_date)
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
    CONSTRAINT waypoint_fk_mountains FOREIGN KEY (mountain_id) REFERENCES mountains(mountain_id) ON DELETE CASCADE
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
    date DATE NOT NULL,

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
        REFERENCES route_waypoints(waypoint_id)
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

-- WEATHER FORECASTS
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

-- ROUTE WAYPOINTS (Trails)
INSERT INTO route_waypoints (mountain_id, sequence_order, name, description, longitude, latitude, elevation_m, difficulty, estimated_time, distance_from_start_km, total_hikers) VALUES
-- Mount Ulap Trails (IDs: 1, 2, 3)
-- Mount Ulap Trails (Total Hikers: 15 + 25 + 60 = 100)
(1, 1, 'Ambacao Paway Ridge', 'A scenic ridge offering panoramic views of the surrounding mountains and valleys.', 120.6358, 16.2947, 1520, 'Easy', 0.2, 0.5, 15),
(1, 2, 'Ampucao Trailhead', 'One of the main access points to the Mount Ulap Eco-Trail, featuring registration facilities and the first panoramic views of the Itogon ridgelines.', 120.6358, 16.2947, 1520, 'Easy', 0.2, 0.5, 25),
(1, 3, 'Mount Ulap Eco-Trail','The official hiking route of Mount Ulap. This 9.4 km trail passes through scenic pine forests, the Ambanao Paway ridge, the iconic Gungal Rock, and ends at the 1,846-meter summit with panoramic views of the Cordillera mountain range.', 120.6312, 16.2904, 1846, 'Moderate', 4.5, 9.4, 60),
-- Mount Yangbew Trails (IDs: 4, 5, 6, 7)
-- Mount Yangbew Trails (Total Hikers: 10 + 20 + 30 + 40 = 100)
(2, 1, 'Yangbew Trailhead', 'The main jump-off point for Mount Yangbew, also known as Little Pulag because of its grassland scenery resembling Mount Pulag.', 120.607052, 16.453989, 1446, 'Easy', 0.30, 3.2, 10),
(2, 2, 'Grassland Ridge', 'An open grassland section offering panoramic views of La Trinidad Valley and the surrounding mountains.', 120.5906, 16.4580, 1510, 'Easy', 0.3, 1.2, 20),
(2, 3, 'Rock Formation Viewpoint', 'A popular photo stop featuring natural rock formations overlooking the valley below.', 120.5925, 16.4605, 1560, 'Easy', 0.7, 2.3, 30),
(2, 4, 'Mount Yangbew Summit', 'The summit of Mount Yangbew offers breathtaking sunrise and sunset views over La Trinidad and Baguio City.', 120.5940, 16.4622, 1609, 'Easy', 1.1, 3.3, 40),
-- Mount Pulag Trails (IDs: 8, 9, 10, 11)
-- Mount Pulag Trails (Total Hikers: 50 + 20 + 20 + 10 = 100)
(3, 1, 'Ambangeg Trail', 'The most popular and beginner-friendly trail to Mount Pulag, often called the "Artista Trail". The summit is typically reached in 3 to 4 hours.', 121.08612, 16.52075, 2250, 'Easy', 4.0, 7.0, 50),
(3, 2, 'Tawangan Trail', 'A scenic trail passing through traditional Ibaloi communities, mossy forests, and grasslands before reaching the summit.', 120.89917, 16.5975, 2200, 'Moderate', 18.0, 12.0, 20),
(3, 3, 'Akiki Trail', 'Known as the "Killer Trail", Akiki is recommended for experienced hikers due to its steep ascents and multi-day trek.', 120.8992, 16.5975, 2260, 'Hard', 14.0, 20.4, 20),
(3, 4, 'Ambaguio Trail', 'A less frequently used route approaching Mount Pulag from Nueva Vizcaya, known for its long forest sections.', 121.0564, 16.5794, 2150, 'Hard', 24.0, 16.0, 10);

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
(1, 1, 2, 'Pine Grove Rest Area', 'Shaded pine area along the initial incline.', 120.6380, 16.2970, 1580, 'Easy', 0.2, 0.8),
(1, 1, 3, 'Ambacao Ridge Viewpoint', 'A scenic ridge offering panoramic views of the surrounding mountains and valleys.', 120.6410, 16.3010, 1680, 'Easy', 0.8, 2.1),
(1, 1, 4, 'Grassland Slope', 'Gentle slope running parallel to the main ridge line.', 120.6435, 16.3035, 1720, 'Easy', 1.2, 3.0),
(1, 1, 5, 'Paway High Point', 'Summit ridge point of the Ambacao section.', 120.6471, 16.3060, 1788, 'Easy', 1.8, 4.2),

-- Trail 2: Ampucao Out-and-Back Trail (route_waypoint_id = 2)
(1, 2, 1, 'Ampucao Barangay Hall', 'Main registration and guide assembly hall.', 120.6550, 16.3253, 1497, 'Easy', 0.0, 0.0),
(1, 2, 2, 'Totomtombek Rest Stop', 'First covered rest shelter surrounded by Benguet pines.', 120.6482, 16.3218, 1552, 'Easy', 0.3, 1.0),
(1, 2, 3, 'Corral Rock Formation', 'Distinct rock outcrop along the ridge trail.', 120.6475, 16.3130, 1603, 'Easy', 0.8, 2.0),
(1, 2, 4, 'Ambanao Paway Peak', 'Grassland peak with wide open views of Benguet.', 120.6471, 16.3060, 1788, 'Easy', 1.5, 3.6),
(1, 2, 5, 'Ampucao Turnaround Point', 'Popular midpoint turnaround spot for shorter day hikes.', 120.6410, 16.3010, 1750, 'Easy', 2.0, 4.5),

-- Trail 3: Mount Ulap Eco-Trail (route_waypoint_id = 3)
(1, 3, 1, 'Ampucao Trailhead', 'Starting jump-off point at Barangay Ampucao registration hall.', 120.6550, 16.3253, 1497, 'Easy', 0.0, 0.0),
(1, 3, 2, 'Totomtombek Rest Stop', 'First resting shelter surrounded by Benguet pine trees.', 120.6482, 16.3218, 1559, 'Easy', 0.3, 1.2),
(1, 3, 3, 'Ambanao Paway Ridge', 'First major peak with rolling grasslands and scenic vistas.', 120.6471, 16.3060, 1788, 'Easy', 1.5, 3.6),
(1, 3, 4, 'Gungal Rock', 'The iconic cliff-side rock formation and popular photo stop.', 120.6368, 16.2950, 1814, 'Moderate', 3.0, 5.4),
(1, 3, 5, 'Mount Ulap Summit', 'Highest point along the trail offering 360-degree Cordillera views.', 120.6310, 16.2900, 1846, 'Moderate', 4.0, 6.5),
(1, 3, 6, 'Sta. Fe Exit', 'End of the traverse trail leading down to hanging bridges.', 120.6215, 16.2810, 1277, 'Moderate', 6.0, 9.4),


-- ==========================================================
-- MOUNT YANGBEW (mountain_id = 2)
-- ==========================================================

-- Trail 1: Yangbew Main Trailhead Route (route_waypoint_id = 4)
(2, 4, 1, 'Yangbew Trailhead Gate', 'The main jump-off point for Mount Yangbew near the barangay hall.', 120.6070, 16.4540, 1446, 'Easy', 0.0, 0.0),
(2, 4, 2, 'Pine Grove Path', 'Early pine tree shade before the open grassland.', 120.6050, 16.4555, 1490, 'Easy', 0.2, 0.6),
(2, 4, 3, 'Middle Slope Rest Stop', 'Small open clearing with view of La Trinidad valley.', 120.6010, 16.4570, 1530, 'Easy', 0.5, 1.2),
(2, 4, 4, 'Yangbew Plateau Entry', 'Entry point onto the grassy upper summit plateau.', 120.5960, 16.4600, 1585, 'Easy', 0.8, 2.2),
(2, 4, 5, 'Main Summit Marker', 'Main summit sign and horse riding area on the grassland.', 120.5940, 16.4622, 1609, 'Easy', 1.0, 3.2),

-- Trail 2: Grassland Ridge Trail (route_waypoint_id = 5)
(2, 5, 1, 'Grassland Ridge Start', 'Starting point along the eastern open ridge slope.', 120.5906, 16.4580, 1510, 'Easy', 0.0, 0.0),
(2, 5, 2, 'Lower Meadow Walk', 'Gentle trail section walking across green pasture land.', 120.5915, 16.4590, 1535, 'Easy', 0.2, 0.5),
(2, 5, 3, 'East Viewpoint Hill', 'Scenic hill overlook facing eastern mountain ranges.', 120.5928, 16.4600, 1570, 'Easy', 0.4, 0.9),
(2, 5, 4, 'Upper Ridge Junction', 'Junction joining the main summit trail on the ridge.', 120.5940, 16.4618, 1600, 'Easy', 0.6, 1.2),

-- Trail 3: Rock Formation Viewpoint Trail (route_waypoint_id = 6)
(2, 6, 1, 'Rock Formation Trailhead', 'Starting point near the northern rocky approaches.', 120.5925, 16.4605, 1560, 'Easy', 0.0, 0.0),
(2, 6, 2, 'Bouldering Outcrop', 'Scattered limestone rock formations ideal for quick photo stops.', 120.5932, 16.4612, 1585, 'Easy', 0.2, 0.8),
(2, 6, 3, 'Valley Viewpoint Rock', 'The highest rock cluster offering clear views of La Trinidad Valley.', 120.5938, 16.4618, 1602, 'Easy', 0.4, 1.5),
(2, 6, 4, 'Summit Plateau Connector', 'Short grassy path connecting the rock formations to the main summit.', 120.5940, 16.4622, 1609, 'Easy', 0.6, 2.3),

-- Trail 4: Yangbew Summit Mix Route (route_waypoint_id = 7)
(2, 7, 1, 'Tawang Base Jump-off', 'Main registration and parking area at the base of Mount Yangbew.', 120.6070, 16.4540, 1446, 'Easy', 0.0, 0.0),
(2, 7, 2, 'Pine Forest Pass', 'Shaded woodland trail connecting the lower valley to the upper ridge.', 120.6035, 16.4565, 1515, 'Easy', 0.3, 0.9),
(2, 7, 3, 'Rock Formation Overlook', 'Natural limestone outcrop offering scenic photo spots over La Trinidad.', 120.5980, 16.4600, 1565, 'Easy', 0.6, 1.8),
(2, 7, 4, 'Mount Yangbew Summit Plateau', 'The main summit area with 360-degree views of Baguio and La Trinidad Valley.', 120.5940, 16.4622, 1609, 'Easy', 0.9, 2.6),
(2, 7, 5, 'Grassland Ridge Descent', 'Open grassland pasture trail descending back towards the Tawang exit.', 120.5910, 16.4585, 1520, 'Easy', 1.1, 3.3),


-- ==========================================================
-- MOUNT PULAG (mountain_id = 3)
-- ==========================================================

-- Trail 1: Ambangeg Trail (route_waypoint_id = 8)
(3, 8, 1, 'Babadak Ranger Station', 'Main jump-off center for registration, guides, and briefing.', 120.8804, 16.5722, 2400, 'Easy', 0.0, 0.0),
(3, 8, 2, 'Camp 1 Shelter', 'First major resting point along the shaded pine forest section.', 120.8905, 16.5815, 2577, 'Easy', 1.0, 2.5),
(3, 8, 3, 'Camp 2 (Mossy Forest Exit)', 'Campsite marking the boundary between mossy forest and dwarf bamboo grassland.', 120.8982, 16.5910, 2690, 'Moderate', 3.0, 5.2),
(3, 8, 4, 'Saddle Campsite', 'High-altitude campsite right below the summit peak.', 120.8990, 16.5960, 2800, 'Moderate', 4.0, 7.0),
(3, 8, 5, 'Mount Pulag Summit', 'The highest peak in Luzon (2,928m) famous for the sea of clouds.', 120.8992, 16.5975, 2928, 'Moderate', 4.5, 8.0),

-- Trail 2: Tawangan Trail (route_waypoint_id = 9)
(3, 9, 1, 'Tawangan Barangay Hall', 'Jump-off point in Barangay Tawangan, Kabayan.', 120.8750, 16.6320, 1480, 'Hard', 0.0, 0.0),
(3, 9, 2, 'Tawangan Mossy Forest Camp', 'Deep mossy forest campsite with high humidity and lush vegetation.', 120.8870, 16.6180, 2100, 'Hard', 5.0, 7.5),
(3, 9, 3, 'Mount Pulag Summit', 'Summit junction approaching from the northern mossy forest trail.', 120.8992, 16.5975, 2928, 'Hard', 10.0, 13.0),

-- Trail 3: Akiki Trail (route_waypoint_id = 10)
(3, 10, 1, 'Akiki Jump-Off Point', 'Starting point at Barangay Doacan, Kabayan.', 120.8421, 16.5812, 1250, 'Hard', 0.0, 0.0),
(3, 10, 2, 'Eddet River Camp', 'Riverside campsite after a steep downhill descent from jump-off.', 120.8605, 16.5790, 1650, 'Hard', 3.0, 4.5),
(3, 10, 3, 'Marlboro Country Camp', 'Mid-trail campsite located in a lush pine forest area.', 120.8780, 16.5855, 2130, 'Hard', 7.0, 9.2),
(3, 10, 4, 'Akiki Mossy Forest Exit', 'Dense forest section leading to the open grasslands.', 120.8920, 16.5925, 2600, 'Hard', 10.0, 12.5),
(3, 10, 5, 'Mount Pulag Summit', 'Reaches the main peak from the western ridgeline.', 120.8992, 16.5975, 2928, 'Hard', 12.0, 14.5),

-- Trail 4: Ambaguio Trail (route_waypoint_id = 11)
(3, 11, 1, 'Ambaguio Jump-off', 'Starting point in Ambaguio, Nueva Vizcaya.', 121.0150, 16.5210, 1100, 'Hard', 0.0, 0.0),
(3, 11, 2, 'Upper Napo Shelter', 'First day rest stop along the forest ridgeline.', 120.9750, 16.5450, 1850, 'Hard', 8.0, 12.0),
(3, 11, 3, 'Mount Pulag Summit', 'Approaches the peak from the eastern slope.', 120.8992, 16.5975, 2928, 'Hard', 16.0, 24.0);
-- USERS
INSERT INTO users (first_name, last_name, username, email, password, hiker_experience, role) VALUES
('Alex', 'Rivera', 'alex.rivera', 'alex.rivera@example.com', '$2b$12$U142o1R5v9EYyPQ5eBMtLuflnt/G832bpDLJGN7sjdbMf/At8ZSCu', 'beginner', 'user'),
('Maria', 'Santos', 'maria.santos', 'maria.santos@example.com', '$2b$12$EY4bVXmsJ94o5nOTlMB9Ku61aH1ryG7B78a6lQnNb1Sy6OyNpuBua', 'intermediate','user'),
('John', 'Doe', 'john.doe', 'john.doe@example.com', '$2b$12$XAN4i.zDasHrQ1L5GP.zV.IgBbFzcVb.AnA07picJ8srjSsXMRVnG', 'expert', 'user'),
('Elena', 'Cruz', 'elena.cruz', 'elena.cruz@example.com', '$2b$12$ohavHqkSIE7eXgC70vtPbuGZ4.c8Vv/EvHbXjK6jInWXb4x830oum', 'beginner','user'),
('Ramon', 'Reyes', 'ramon.reyes', 'ramon.reyes@example.com', '$2b$12$He0BBjubopiXw9mctoHjD.XgAvO1GvB7eD9QRTjCx9c4cryIMyHVy', 'intermediate', 'user'),
('Cheska', 'Martinez', 'admin', 'admin@tarapeak.com', '$2b$12$33zauXWVwEOUUAMYDH.Y.uUQOKa5jaynXXNGeZPOaBnDaWvk2jQCi', 'expert','admin');

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
INSERT INTO plans (user_id, mountain_id, waypoint_id, date) VALUES
(1, 1, 3, CURRENT_DATE),
(2, 1, 1, CURRENT_DATE),
(3, 1, 2, CURRENT_DATE),
(4, 1, 3, CURRENT_DATE),
(5, 2, 7, CURRENT_DATE),

(1, 1, 2, CURRENT_DATE + 5),
(2, 1, 3, CURRENT_DATE + 12),
(3, 3, 10, CURRENT_DATE + 10),
(4, 3, 8, CURRENT_DATE + 10),
(5, 3, 11, CURRENT_DATE + 20),
(1, 2, 5, CURRENT_DATE + 7);