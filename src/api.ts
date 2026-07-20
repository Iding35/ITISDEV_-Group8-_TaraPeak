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

export interface User {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PlanMember {
  user_id: number;
  name: string;
}

export interface Plan {
  plan_id: number;
  date: string;
  owner_id: number;
  is_owner: boolean;
  members: PlanMember[];
  mountain_id: number;
  mountain_name: string;
  location: string;
  image_url: string;
}

export interface PlanInvite {
  plan_member_id: number;
  plan_id: number;
  date: string;
  mountain_id: number;
  mountain_name: string;
  location: string;
  image_url: string;
  invited_by_name: string | null;
}

export interface WeatherForecast {
  weather_id: number;
  mountain_id: number;
  hiking_date: string;
  temperature: number;
  humidity: number;
  wind_speed: number;
}

export interface WeatherCheckResponse {
  date_valid: boolean;
  forecast: WeatherForecast | null;
}

export interface Waypoint {
  waypoint_id: number;
  mountain_id: number;
  sequence_order: number;
  name: string;
  description: string;
  longitude: number;
  latitude: number;
  elevation_m: number;
  difficulty: string;
  estimated_time: number;
  distance_from_start_km: number;
}

export interface TrailReport {
  report_id?: number;
  mountain_id: number;
  waypoint_id?: number | null;
  waypoint_name?: string | null;
  user_id?: number | null;
  user_name?: string | null;
  rating: number;
  condition: string;
  comment: string;
  created_at?: string;
}

const API_URL = 'http://127.0.0.1:8000';
const TOKEN_KEY = 'tarapeak_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function extractError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(body?.detail || fallback);
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

export async function signup(data: {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw await extractError(response, 'Signup failed');
  return response.json();
}

export async function login(data: { email: string; password: string }): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw await extractError(response, 'Login failed');
  return response.json();
}

export async function fetchCurrentUser(): Promise<User> {
  const response = await fetch(`${API_URL}/auth/me`, { headers: authHeaders() });
  if (!response.ok) throw new Error('Not authenticated');
  return response.json();
}

export async function createPlan(mountainId: number, hikingDate: string): Promise<Plan> {
  const response = await fetch(`${API_URL}/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ mountain_id: mountainId, date: hikingDate }),
  });
  if (!response.ok) throw await extractError(response, 'Could not save plan');
  return response.json();
}

export async function fetchPlans(): Promise<Plan[]> {
  const response = await fetch(`${API_URL}/plans`, { headers: authHeaders() });
  if (!response.ok) throw await extractError(response, 'Could not load plans');
  return response.json();
}

export async function deletePlan(planId: number): Promise<void> {
  const response = await fetch(`${API_URL}/plans/${planId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) throw await extractError(response, 'Could not delete plan');
}

export async function checkWeather(
  mountainId: number,
  hikingDate: string,
  latitude: number,
  longitude: number,
): Promise<WeatherCheckResponse> {
  const params = new URLSearchParams({
    date: hikingDate,
    latitude: String(latitude),
    longitude: String(longitude),
  });
  const response = await fetch(`${API_URL}/weather/${mountainId}?${params}`, { headers: authHeaders() });
  if (!response.ok) throw await extractError(response, 'Could not check weather');
  return response.json();
}

export async function fetchWaypoints(mountainId: number): Promise<Waypoint[]> {
  const response = await fetch(`${API_URL}/waypoints/${mountainId}`);
  if (!response.ok) throw await extractError(response, 'Could not load route data');
  return response.json();
}

export async function fetchDifficultyAnalysis(mountainId: number): Promise<string> {
  const res = await fetch(`${API_URL}/ai/difficulty/${mountainId}`, { method: 'POST', headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed' }));
    throw new Error(err.detail || 'Difficulty analysis failed');
  }
  const data = await res.json();
  return data.analysis;
}

export async function fetchSafetyAnalysis(mountainId: number, date?: string): Promise<string> {
  const url = date
    ? `${API_URL}/ai/safety/${mountainId}?date=${date}`
    : `${API_URL}/ai/safety/${mountainId}`;
  const res = await fetch(url, { method: 'POST', headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed' }));
    throw new Error(err.detail || 'Safety analysis failed');
  }
  const data = await res.json();
  return data.analysis;
}

export async function fetchRouteOptimization(mountainId: number): Promise<{ plan: string }> {
  const res = await fetch(`${API_URL}/ai/route-optimization/${mountainId}`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed' }));
    throw new Error(err.detail || 'Route optimization failed');
  }
  return res.json();
}

export async function fetchTrailReports(mountainId: number): Promise<TrailReport[]> {
  const response = await fetch(`${API_URL}/trail-reports/${mountainId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch trail reports');
  }
  return response.json();
}

export async function createTrailReport(
  mountainId: number,
  data: { waypoint_id?: number | null; rating: number; condition: string; comment: string },
): Promise<TrailReport> {
  const response = await fetch(`${API_URL}/trail-reports/${mountainId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw await extractError(response, 'Could not submit trail report');
  return response.json();
}

export async function invitePlanMember(planId: number, email: string): Promise<{ plan_member_id: number; status: string }> {
  const response = await fetch(`${API_URL}/plans/${planId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw await extractError(response, 'Could not send invite');
  return response.json();
}

export async function fetchPlanInvites(): Promise<PlanInvite[]> {
  const response = await fetch(`${API_URL}/plans/invites`, { headers: authHeaders() });
  if (!response.ok) throw await extractError(response, 'Could not load invites');
  return response.json();
}

export async function acceptPlanInvite(planMemberId: number): Promise<void> {
  const response = await fetch(`${API_URL}/plans/invites/${planMemberId}/accept`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) throw await extractError(response, 'Could not accept invite');
}

export async function declinePlanInvite(planMemberId: number): Promise<void> {
  const response = await fetch(`${API_URL}/plans/invites/${planMemberId}/decline`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) throw await extractError(response, 'Could not decline invite');
}