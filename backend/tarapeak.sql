CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mountains (
    mountain_id SERIAL PRIMARY KEY,
    mountain_name VARCHAR(50) NOT NULL,
    location VARCHAR(200),
    description TEXT,
    image_url VARCHAR(200),
    --estimated_time FLOAT,
    --difficulty VARCHAR(20),
    --distance FLOAT,
    terrain VARCHAR(100),
    --hazards VARCHAR(200),
    total_hikers INT DEFAULT 0
);


CREATE TABLE IF NOT EXISTS weather_forecasts (
    weather_id SERIAL PRIMARY KEY,
    mountain_id INT,
    hiking_date DATE,
    temperature DECIMAL(3,1),
    humidity INT,
    wind_speed INT,
    CONSTRAINT weather_fk_mountains FOREIGN KEY (mountain_id) REFERENCES mountains(mountain_id)
);



CREATE TABLE IF NOT EXISTS plans (
    plan_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    mountain_id INT NOT NULL,
    date DATE NOT NULL,
    CONSTRAINT plans_fk_users FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT plans_fk_mountains FOREIGN KEY (mountain_id) REFERENCES mountains(mountain_id)
);

CREATE TABLE IF NOT EXISTS gear_recommendations (
    gear_id SERIAL PRIMARY KEY,
    plan_id INT NOT NULL,
    gear_name VARCHAR(50),
    is_required BOOLEAN DEFAULT TRUE,
    CONSTRAINT gear_fk_plans FOREIGN KEY (plan_id) REFERENCES plans(plan_id)
);

CREATE TABLE IF NOT EXISTS trail_reports (
    report_id SERIAL PRIMARY KEY,
    mountain_id INT REFERENCES mountains(mountain_id) ON DELETE CASCADE,
    waypoint_id INT REFERENCES route_waypoints(waypoint_id) ON DELETE CASCADE, -- Tied to specific trail/waypoint
    user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    condition VARCHAR(100) NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS route_waypoints (
    waypoint_id SERIAL PRIMARY KEY,
    mountain_id INT NOT NULL,
    sequence_order INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    longitude FLOAT NOT NULL, --add
    latitude FLOAT NOT NULL, --add
    elevation_m INT,
    difficulty VARCHAR(20) NOT NULL, --add
    estimated_time FLOAT NOT NULL, --add
    distance_from_start_km DECIMAL(4,1),
    CONSTRAINT waypoint_fk_mountains FOREIGN KEY (mountain_id) REFERENCES mountains(mountain_id)
);

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


-- BAGUIO MOUNTAINS TABLE --
INSERT INTO mountains (mountain_name, location, description, image_url, terrain, total_hikers) VALUES
('Mount Ulap', 'Itogon, Benguet', 'A beginner-friendly mountain known for its pine forests, scenic grasslands, and panoramic ridge views.', 'img/mt-ulap.svg', 'Pine Forest', 100),
('Mount Yangbew', 'La Trinidad, Benguet', 'A short hiking destination famous for its sunrise views, rock formations, and colorful flower gardens.', 'img/mt-yangbew.svg', 'Grassland', 100),
('Mount Pulag', 'Kabayan, Benguet', 'The third highest mountain in the Philippines, renowned for its sea of clouds, mossy forests, and breathtaking sunrise.', 'img/mt-pulag.svg', 'Mossy Forest', 100);

-- WEATHER FORECASTS --
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

-- ROUTE WAYPOINTS --
INSERT INTO route_waypoints (mountain_id, sequence_order, name, description, longitude, latitude, elevation_m, difficulty, estimated_time, distance_from_start_km) VALUES
-- ==========================
-- MOUNT ULAP
-- ==========================
(1, 1, 'Ambacao Paway Ridge', 'A scenic ridge offering panoramic views of the surrounding mountains and valleys.', 120.6358, 16.2947, 1520, 'Easy', 0.2, 0.5),
(1, 2, 'Ampucao Trailhead', 'One of the main access points to the Mount Ulap Eco-Trail, featuring registration facilities and the first panoramic views of the Itogon ridgelines.', 120.6358, 16.2947, 1520, 'Easy', 0.2, 0.5),
(1, 3,'Mount Ulap Eco-Trail','The official hiking route of Mount Ulap. This 9.4 km trail passes through scenic pine forests, the Ambanao Paway ridge, the iconic Gungal Rock, and ends at the 1,846-meter summit with panoramic views of the Cordillera mountain range.', 120.6312, 16.2904, 1846, 'Moderate', 4.5, 9.4),

-- ==========================
-- MOUNT YANGBEW
-- ==========================
(2, 1, 'Yangbew Trailhead', 'The main jump-off point for Mount Yangbew, also known as Little Pulag because of its grassland scenery resembling Mount Pulag.', 120.607052, 16.453989, 1446, 'Easy', 0.30, 3.2),
(2, 2, 'Grassland Ridge', 'An open grassland section offering panoramic views of La Trinidad Valley and the surrounding mountains.', 120.5906, 16.4580, 1510, 'Easy', 0.3, 1.2),
(2, 3, 'Rock Formation Viewpoint', 'A popular photo stop featuring natural rock formations overlooking the valley below.', 120.5925, 16.4605, 1560, 'Easy', 0.7, 2.3),
(2, 4, 'Mount Yangbew Summit', 'The summit of Mount Yangbew offers breathtaking sunrise and sunset views over La Trinidad and Baguio City.', 120.5940, 16.4622, 1609, 'Easy', 1.1, 3.3),

-- ==========================
-- MOUNT PULAG
-- ==========================
(3, 1, 'Ambangeg Trail', 'The most popular and beginner-friendly trail to Mount Pulag, often called the "Artista Trail". The summit is typically reached in 3 to 4 hours.', 121.08612, 16.52075, 2250, 'Easy', 4.0, 7.0),
(3, 2, 'Tawangan Trail', 'A scenic trail passing through traditional Ibaloi communities, mossy forests, and grasslands before reaching the summit.', 120.89917, 16.5975, 2200, 'Moderate', 18.0, 12.0),
(3, 3, 'Akiki Trail', 'Known as the "Killer Trail", Akiki is recommended for experienced hikers due to its steep ascents and multi-day trek.', 120.8992, 16.5975, 2260, 'Hard', 14.0, 20.4),
(3, 4, 'Ambaguio Trail', 'A less frequently used route approaching Mount Pulag from Nueva Vizcaya, known for its long forest sections.', 121.0564, 16.5794, 2150, 'Hard', 24.0, 16.0);

INSERT INTO users (first_name, last_name, email, password, role) VALUES
('Alex', 'Rivera', 'alex.rivera@example.com', 'pass1234', 'user'),
('Maria', 'Santos', 'maria.santos@example.com', 'pass5678', 'user'),
('John', 'Doe', 'john.doe@example.com', 'passabcd', 'user'),
('Elena', 'Cruz', 'elena.cruz@example.com', 'passwxyz', 'user'),
('Ramon', 'Reyes', 'ramon.reyes@example.com', 'pass8765', 'user');

INSERT INTO trail_reports (mountain_id, waypoint_id, user_id, rating, condition, comment, created_at) VALUES
-- Mount Ulap Reports
(1, 3, 1, 4, 'Muddy / Slippery', 'Trail had significant mud near Gungal Rock on the Eco-Trail. Trekking poles recommended.', '2026-07-13 09:30:00+00'),
(1, 2, 2, 5, 'Clear & Well-Marked', 'Great visibility early in the morning near Ampucao Trailhead! Markings are clear.', '2026-07-13 14:15:00+00'),

-- Mount Yangbew Reports
(2, 2, 3, 3, 'Overgrown Vegetation', 'Lots of tall grass along Grassland Ridge. Wear long sleeves to protect yourself.', '2026-07-13 11:00:00+00'),
(2, 4, 4, 5, 'Clear & Dry', 'Short and easy hike at Mount Yangbew Summit. Excellent conditions throughout.', '2026-07-13 16:20:00+00'),

-- Mount Pulag Reports
(3, 1, 5, 3, 'Foggy / Low Visibility', 'Very cold and low visibility along Ambangeg Trail. Bring proper cold weather gear.', '2026-07-13 05:45:00+00');