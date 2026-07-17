CREATE DATABASE IF NOT EXISTS tarapeak;
USE tarapeak;
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(50) NOT NULL,
    password VARCHAR(50) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mountains (
    mountain_id INT AUTO_INCREMENT PRIMARY KEY,
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
    weather_id INT AUTO_INCREMENT PRIMARY KEY,
    mountain_id INT,
    hiking_date DATE,
    temperature DECIMAL(3,1),
    humidity INT,
    wind_speed INT,
    CONSTRAINT weather_fk_mountains FOREIGN KEY (mountain_id) REFERENCES mountains(mountain_id)
);

CREATE TABLE IF NOT EXISTS plans (
    plan_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    mountain_id INT NOT NULL,
    date DATE NOT NULL,
    CONSTRAINT plans_fk_users FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT plans_fk_mountains FOREIGN KEY (mountain_id) REFERENCES mountains(mountain_id)
);

CREATE TABLE IF NOT EXISTS gear_recommendations (
    gear_id INT AUTO_INCREMENT PRIMARY KEY,
    plan_id INT NOT NULL,
    gear_name VARCHAR(50),
    is_required BOOLEAN DEFAULT TRUE,
    CONSTRAINT gear_fk_plans FOREIGN KEY (plan_id) REFERENCES plans(plan_id)
);

CREATE TABLE IF NOT EXISTS trail_reports (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    mountain_id INT NOT NULL,
    user_id INT NOT NULL,
    report_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    report_status VARCHAR(20),
    report_description VARCHAR(200),
    CONSTRAINT trail_fk_mountains FOREIGN KEY (mountain_id) REFERENCES mountains(mountain_id),
	CONSTRAINT trail_fk_users FOREIGN KEY (user_id) REFERENCES users(user_id)
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

SELECT * FROM mountains;