CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mountains (
    mountain_id SERIAL PRIMARY KEY,
    mountain_name VARCHAR(50) NOT NULL,
    location VARCHAR(200),
    description VARCHAR(200),
    image_url VARCHAR(200),
    estimated_time FLOAT,
    difficulty VARCHAR(20),
    distance FLOAT,
    terrain VARCHAR(100),
    hazards VARCHAR(200),
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
    mountain_id INT NOT NULL,
    user_id INT NOT NULL,
    report_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    report_status VARCHAR(20),
    report_description VARCHAR(200),
    CONSTRAINT trail_fk_mountains FOREIGN KEY (mountain_id) REFERENCES mountains(mountain_id),
    CONSTRAINT trail_fk_users FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS route_waypoints (
    waypoint_id SERIAL PRIMARY KEY,
    mountain_id INT NOT NULL,
    sequence_order INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(200),
    elevation_m INT,
    distance_from_start_km DECIMAL(4,1),
    CONSTRAINT waypoint_fk_mountains FOREIGN KEY (mountain_id) REFERENCES mountains(mountain_id)
);


-- BAGUIO MOUNTAINS TABLE --
INSERT INTO mountains (
    mountain_name,
    location,
    description,
    image_url,
    estimated_time,
    difficulty,
    distance,
    terrain,
    hazards,
    total_hikers
) VALUES
(
    'Mount Ulap',
    'Itogon, Benguet',
    'A beginner-friendly mountain known for its pine forests, scenic grasslands, and panoramic ridge views.',
    'img/mt-ulap.svg',
    4.5,
    'Easy',
    8.0,
    'Pine Forest and Grassland',
    'Slippery trails during rain, steep descents',
    100
),
(
    'Mount Yangbew',
    'La Trinidad, Benguet',
    'A short hiking destination famous for its sunrise views, rock formations, and colorful flower gardens.',
    'img/mt-yangbew.svg',
    2.0,
    'Easy',
    4.0,
    'Grassland and Rocky Trail',
    'Slippery rocks, strong winds',
    100
),
(
    'Mount Pulag',
    'Kabayan, Benguet',
    'The third highest mountain in the Philippines, renowned for its sea of clouds, mossy forests, and breathtaking sunrise.',
    'img/mt-pulag.svg',
    10.0,
    'Hard',
    18.0,
    'Mossy Forest and Grassland',
    'Cold temperatures, steep ascents, rapidly changing weather',
    100
);

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
