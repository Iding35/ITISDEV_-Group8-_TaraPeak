// Get the mountain ID from the URL
const params = new URLSearchParams(window.location.search);
const mountainId = params.get("id");

// Show loading spinner
const loading = document.getElementById("loading");

async function loadMountain() {

    if (!mountainId) {
        alert("No mountain selected.");
        return;
    }

    loading.classList.remove("hidden");

    try {

        const response = await fetch(`http://127.0.0.1:8000/mountains/${mountainId}`);

        if (!response.ok) {
            throw new Error("Mountain not found.");
        }

        const mountain = await response.json();

        // Hero
        document.getElementById("heroImage").src = mountain.image_url;
        document.getElementById("heroImage").alt = mountain.mountain_name;

        // Header
        document.getElementById("mountainName").textContent = mountain.mountain_name;
        document.getElementById("location").textContent = mountain.location;
        document.getElementById("description").textContent = mountain.description;

        // Cards
        document.getElementById("difficulty").textContent = mountain.difficulty;
        document.getElementById("distance").textContent = mountain.distance;
        document.getElementById("estimatedTime").textContent = mountain.estimated_time;
        document.getElementById("totalHikers").textContent = mountain.total_hikers;

        // Details
        document.getElementById("terrain").textContent = mountain.terrain;
        document.getElementById("hazards").textContent = mountain.hazards;

        // Table
        document.getElementById("tableMountainName").textContent = mountain.mountain_name;
        document.getElementById("tableLocation").textContent = mountain.location;
        document.getElementById("tableDifficulty").textContent = mountain.difficulty;
        document.getElementById("tableDistance").textContent = mountain.distance;
        document.getElementById("tableTime").textContent = mountain.estimated_time;
        document.getElementById("tableHikers").textContent = mountain.total_hikers;

    }

    catch (error) {

        console.error(error);

        alert("Unable to load mountain details.");

    }

    finally {

        loading.classList.add("hidden");

    }

}

loadMountain();