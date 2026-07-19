export interface Mountain {
  mountain_id: number;
  mountain_name: string;
  location: string;
  description: string;
  image_url: string;
  difficulty: string;
  distance: number;
  estimated_time: number;
  terrain: string;
  hazards: string;
  total_hikers: number;
}

const API_URL = 'http://127.0.0.1:8000';

export async function fetchMountains(search = ''): Promise<Mountain[]> {
  const url = search ? `${API_URL}/get?search=${encodeURIComponent(search)}` : `${API_URL}/get`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Network response was not ok');
  return response.json();
}

export async function fetchMountain(id: string): Promise<Mountain> {
  const response = await fetch(`${API_URL}/mountains/${id}`);
  if (!response.ok) throw new Error('Unable to load mountain.');
  return response.json();
}
