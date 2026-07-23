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
  trail_name: string;
  trail_description: string;
  difficulty: string;
  estimated_time: number;
  distance_from_start_km: number;
  terrain: string;
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

export interface DetailedPlanMember {
  plan_member_id: number;
  user_id: number;
  name: string;
  email: string;
  role: 'organizer' | 'member';
  status: 'pending' | 'accepted' | 'declined';
}

export interface DetailedPlan extends Plan {
  members: DetailedPlanMember[];
}

export interface AppNotification {
  notification_id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  reference_id: number;
  is_read: boolean;
  created_at: string;
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
  route_id?: number;
  sequence_order: number;
  name: string;
  description?: string;
  longitude: number;
  latitude: number;
  elevation_m?: number;
  difficulty: string;
  estimated_time: number;
  distance_from_start_km: number;
}

export interface TrailCheckpoint {
  checkpoint_id: number;
  mountain_id: number;
  route_waypoint_id: number;
  sequence_order: number;
  name: string;
  description?: string;
  longitude: number;
  latitude: number;
  elevation_m?: number;
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

export interface TrailReportSummary {
  mountain_id: number;
  mountain_name: string;
  trail_name: string; 
  total_reports: number;
  latest_report?: string;
}

export interface QuarterlyRegistration {
  quarter: string;
  total_users: number;
}

export interface PopularityDriver {
  mountain_name: string;
  total_plans: number;
  difficulty: string;
  avg_rating: number | null;
  distance: number;
}

export interface AdminUserView {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface MountainReportSummary {
  mountain_id: number;
  mountain_name: string;
  total_reports: number;
  latest_report?: string;
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

export async function fetchPlanDetail(planId: number): Promise<DetailedPlan> {
  const response = await fetch(`${API_URL}/plans/${planId}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await extractError(response, 'Could not load plan details');
  return response.json();
}

export async function removePlanMember(planMemberId: number): Promise<void> {
  const response = await fetch(`${API_URL}/plan-members/${planMemberId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) throw await extractError(response, 'Could not remove member');
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const response = await fetch(`${API_URL}/notifications`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await extractError(response, 'Could not load notifications');
  return response.json();
}

export async function checkWeather(
  mountainId: number,
  hikingDate: string,
  waypointId: number
): Promise<WeatherCheckResponse> {
  const params = new URLSearchParams({
    date: hikingDate,
    waypoint_id: String(waypointId),
  });
  const response = await fetch(`${API_URL}/weather/${mountainId}?${params}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await extractError(response, 'Could not check weather');
  return response.json();
}

export async function fetchWaypoints(mountainId: number): Promise<Waypoint[]> {
  const response = await fetch(`${API_URL}/waypoints/${mountainId}`);
  if (!response.ok) throw await extractError(response, 'Could not load route data');
  return response.json();
}

/** Fetches specific checkpoints for a given trail/route (trail_checkpoints) */
export async function fetchTrailCheckpoints(routeWaypointId: number): Promise<TrailCheckpoint[]> {
  const response = await fetch(`${API_URL}/checkpoints/${routeWaypointId}`);
  if (!response.ok) throw await extractError(response, 'Could not load checkpoint data');
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
export async function fetchORSRoute(
  waypoints: (Waypoint | TrailCheckpoint)[],
  profile: string = 'foot-hiking'
): Promise<[number, number][]> {
  if (waypoints.length < 2) return [];

  try {
    const response = await fetch(`${API_URL}/ors/route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ waypoints, profile }),
    });

    if (!response.ok) {
      throw new Error('Backend ORS proxy call failed');
    }

    const data = await response.json();
    return data.route || [];
  } catch (err) {
    console.warn('Backend ORS proxy error. Falling back to straight lines:', err);
    return waypoints.map((wp) => [Number(wp.latitude), Number(wp.longitude)]);
  }
}

export async function fetchReportsByTrail(mountainId?: number | ''): Promise<TrailReportSummary[]> {
  const url = mountainId 
    ? `${API_URL}/analytics/reports-by-trail?mountain_id=${mountainId}` 
    : `${API_URL}/analytics/reports-by-trail`;
    
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load report analytics');
  return res.json();
}

export async function fetchQuarterlyRegistrations(): Promise<QuarterlyRegistration[]> {
  const res = await fetch(`${API_URL}/analytics/registrations-quarterly`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load registration trends');
  return res.json();
}

export async function fetchHikersByDate(mountainId: number, date: string): Promise<{ total_hikers: number }> {
  const params = new URLSearchParams({ mountain_id: String(mountainId), date });
  const res = await fetch(`${API_URL}/analytics/hikers-by-date?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load hiker counts');
  return res.json();
}

export async function fetchPopularityDrivers(): Promise<PopularityDriver[]> {
  const res = await fetch(`${API_URL}/analytics/popularity-drivers`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load popularity drivers');
  return res.json();
}

export async function fetchAdminUsers(): Promise<AdminUserView[]> {
  const res = await fetch(`${API_URL}/analytics/users`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function fetchReportsByMountain(): Promise<MountainReportSummary[]> {
  const res = await fetch(`${API_URL}/analytics/reports-by-mountain`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch mountain report summaries');
  return res.json();
}

