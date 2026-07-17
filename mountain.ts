interface Mountain {
    id: number;
    name: string;
    location: string;
    image_url: string;
    total_hikers: string;
    difficulty: string;
}

const API_URL = 'http://127.0.0.1:8000';

async function fetchMountains(searchQuery: string = ''): Promise<Mountain[]> {
    try {
        const url = searchQuery ? `${API_URL}/get?search=${encodeURIComponent(searchQuery)}` : `${API_URL}/get`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Error fetching mountains:', error);
        return [];
    }
}

function renderMountains(mountains: Mountain[]) {
    const grid = document.getElementById('trails-grid');
    if (!grid) return;

    grid.innerHTML = '';

    for (const mountain of mountains) {
        const card = document.createElement('div');
        card.className = 'trail-card group relative bg-surface-container-lowest rounded-xl overflow-hidden border border-secondary/20 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer';

        card.innerHTML = `
            <div class="h-64 overflow-hidden relative">
                <div class="trail-image w-full h-full bg-cover bg-center transition-transform duration-500"
                    style="background-image: url('${mountain.image_url}')">
                </div>
            </div>
            <div class="p-md flex flex-col gap-sm">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-headline-md text-headline-md text-primary">${mountain.name}</h3>
                        <p class="font-label-md text-label-md text-on-surface-variant">${mountain.location}</p>
                    </div>
                    <a href="mountain_details.html?id=${mountain.id}" class="material-symbols-outlined text-outline group-hover:text-primary transition-colors">arrow_forward</a>
                </div>
                <div class="grid grid-cols-2 gap-base pt-2">
                    <div class="bg-surface-container-low p-sm rounded-lg">
                        <span class="block font-label-sm text-label-sm text-outline uppercase tracking-wider">TOTAL HIKERS</span>
                        <span class="font-headline-md text-headline-md text-primary">${mountain.total_hikers}</span>
                    </div>
                    <div class="bg-surface-container-low p-sm rounded-lg">
                        <span class="block font-label-sm text-label-sm text-outline uppercase tracking-wider">DIFFICULTY</span>
                        <span class="font-headline-md text-headline-md text-secondary">${mountain.difficulty}</span>
                    </div>
                </div>
            </div>
        `;

        card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-4px)'; });
        card.addEventListener('mouseleave', () => { card.style.transform = 'translateY(0)'; });
        card.addEventListener('mousedown', () => { card.style.transform = 'scale(0.98)'; });
        card.addEventListener('mouseup', () => { card.style.transform = 'translateY(-4px)'; });

        grid.appendChild(card);
    }
}

async function init() {
    const mountains = await fetchMountains();
    renderMountains(mountains);

    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            const val = (e.target as HTMLInputElement).value;
            const res = await fetchMountains(val);
            renderMountains(res);
        });
    }
}

document.addEventListener('DOMContentLoaded', init);
