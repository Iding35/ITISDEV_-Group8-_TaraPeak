interface Mountain {
    mountain_id: number;
    mountain_name: string;
    location: string;
    description: string;
    image_url: string;
    difficulty: string;
    distance: string;
    estimated_time: string;
    terrain: string;
    hazards: string;
    total_hikers: number;
}

const API_URL = 'http://127.0.0.1:8000';

const params = new URLSearchParams(window.location.search);
const mountainId = params.get("id");

const loading = document.getElementById("loading") as HTMLElement;

async function fetchMountain(id: string): Promise<Mountain> {

    const response = await fetch(`${API_URL}/mountains/${id}`);

    if (!response.ok) {
        throw new Error("Unable to load mountain.");
    }

    return await response.json();

}

function setText(id: string, value: string | number): void {

    const element = document.getElementById(id);

    if (element) {
        element.textContent = String(value);
    }

}

function setImage(id: string, src: string, alt: string): void {

    const image = document.getElementById(id) as HTMLImageElement;

    if (image) {
        image.src = src;
        image.alt = alt;
    }

}

async function loadMountain(): Promise<void> {

    if (!mountainId) {
        alert("No mountain selected.");
        return;
    }

    loading.classList.remove("hidden");

    try {

        const mountain = await fetchMountain(mountainId);

        // Hero Image
        setImage(
            "heroImage",
            mountain.image_url,
            mountain.mountain_name
        );

        // Header
        setText("mountainName", mountain.mountain_name);
        setText("location", mountain.location);
        setText("description", mountain.description);

        // Information Cards
        setText("difficulty", mountain.difficulty);
        setText("distance", mountain.distance);
        setText("estimatedTime", mountain.estimated_time);
        setText("totalHikers", mountain.total_hikers);

        // Terrain & Hazards
        setText("terrain", mountain.terrain);
        setText("hazards", mountain.hazards);

        // Mountain Information Table
        setText("tableMountainName", mountain.mountain_name);
        setText("tableLocation", mountain.location);
        setText("tableDifficulty", mountain.difficulty);
        setText("tableDistance", mountain.distance);
        setText("tableTime", mountain.estimated_time);
        setText("tableHikers", mountain.total_hikers);

    }

    catch (error) {

        console.error("Error loading mountain:", error);

        alert("Unable to load mountain details.");

    }

    finally {

        loading.classList.add("hidden");

    }

}

document.addEventListener("DOMContentLoaded", () => {

    loadMountain();

});

export {};