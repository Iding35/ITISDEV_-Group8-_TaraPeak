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
  username: string;
  email: string;
  hiker_experience: string;
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
  waypoint_id: number;
  updated_at: string | null;
  is_owner: boolean;
  members: PlanMember[];
  mountain_id: number;
  mountain_name: string;
  location: string;
  image_url: string;
  trail_name: string;
  trail_description: string;
  description: string;
  difficulty: string;
  estimated_time: number;
  distance_from_start_km: number;
  terrain: string;
  hazards: string | null;
  status?: string;
  checkpoint_id?: number;
  checkpoint_name?: string;
  // Returned by both GET /plans and GET /plans/{id} (main.py casts
  // completed_at/completion_time to ::text so they serialize as strings).
  is_completed?: boolean;
  completion_time?: string;
  completed_at?: string;
}

export interface GearItem {
  gear_id?: number;
  gear_name: string;
  category: string;
  is_required: boolean;
  reason: string;
}

export interface GearRecommendation {
  summary: string;
  items: GearItem[];
  /** 'ai' when the model answered, 'fallback' when the rule-based list was used. */
  source: 'ai' | 'fallback';
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
  gear: GearItem[];
  ai_gear_summary: string | null;
  ai_difficulty_analysis: string | null;
  ai_safety_analysis: string | null;
  ai_route_plan: string | null;
  notes?: string | null;
}

export type NotificationType =
  | 'invite_received'
  | 'invite_accepted'
  | 'invite_declined'
  | 'plan_updated'
  | 'member_removed';

export interface AppNotification {
  notification_id: number;
  user_id: number;
  title: string;
  message: string;
  type: NotificationType | string;
  reference_id: number | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationFeed {
  unread_count: number;
  notifications: AppNotification[];
}

export interface WeatherForecast {
  weather_id: number;
  mountain_id: number;
  hiking_date: string;
  temperature: number;
  humidity: number;
  wind_speed: number;
  precipitation_mm: number;
  weather_code: number;
}

export interface WeatherCheckResponse {
  date_valid: boolean;
  forecast: WeatherForecast | null;
}

export interface ClimateBaselineYear {
  year: number;
  avg_temperature: number | null;
  avg_humidity: number | null;
  avg_wind_speed: number | null;
  avg_precipitation: number | null;
}

export interface WeatherBaseline {
  waypoint_id: number;
  month: number;
  years_requested: number[];
  trend: ClimateBaselineYear[];
  baseline: {
    avg_temperature: number | null;
    avg_humidity: number | null;
    avg_wind_speed: number | null;
    avg_precipitation: number | null;
  } | null;
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
  accessibility: string;
  avg_rating: number | null;
  distance: number;
}

export interface DiagnosticGroupRow {
  times_selected: number;
  avg_rating: number | null;
  report_count: number;
  difficulty?: string;
  terrain?: string;
  accessibility?: string;
}

export interface DiagnosticCorrelations {
  by_difficulty: DiagnosticGroupRow[];
  by_terrain: DiagnosticGroupRow[];
  by_accessibility: DiagnosticGroupRow[];
  narrative: string;
  source: 'ai' | 'fallback';
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

export interface MostTakenTrail {
  mountain_id: number;
  mountain_name: string;
  trail_name: string;
  total_completed_hikes: number;
  most_taken_checkpoint: string | null;
}
export interface CompletePlanPayload {
  completion_date: string; // ISO date string or YYYY-MM-DD
  completion_time: string; // HH:MM or interval string
}


// Defaults to port 8000. Override with VITE_API_URL in a .env file when that
// port is taken by another project on your machine.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
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

export interface MountainTrailStats {
  mountain_id: number;
  date: string;
  crowd_count: number;
  avg_completion_minutes: number | null;
  completions_logged: number;
}

export async function fetchMountainTrailStats(mountainId: number, targetDate?: string): Promise<MountainTrailStats> {
  const params = targetDate ? `?date=${targetDate}` : '';
  const response = await fetch(`${API_URL}/mountains/${mountainId}/trail-stats${params}`);
  if (!response.ok) throw await extractError(response, 'Could not load trail stats');
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
  hiker_experience: string;
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

export interface SavePlanAiOutputs {
  ai_gear_summary?: string | null;
  ai_difficulty_analysis?: string | null;
  ai_safety_analysis?: string | null;
  ai_route_plan?: string | null;
  gear?: GearItem[];
}

/** Saves the final mountain, trail, date, and any AI output generated for them. */
export async function createPlan(
  mountainId: number,
  waypointId: number,
  hikingDate: string,
  checkpointId?: number,
  aiOutputs: SavePlanAiOutputs = {}
): Promise<Plan> {
  const response = await fetch(`${API_URL}/plans/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({
      mountain_id: mountainId,
      waypoint_id: waypointId,
      date: hikingDate,
      checkpoint_id: checkpointId,
      ...aiOutputs,
    }),
  });

  if (!response.ok) {
    throw await extractError(response, 'Could not save plan');
  }

  return response.json();
}

export async function updatePlanNotes(
  planId: number,
  notes: string
): Promise<DetailedPlan> {
  const response = await fetch(`${API_URL}/plans/${planId}/notes`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ notes }),
  });

  if (!response.ok) {
    throw await extractError(response, 'Could not update notes');
  }

  return response.json();
}

/** Organizer-only edit. The backend syncs every member record in the same transaction. */
export async function updatePlan(
  planId: number,
  changes: { date?: string; waypoint_id?: number }
): Promise<{ changed: boolean; members_synced: number }> {
  const response = await fetch(`${API_URL}/plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(changes),
  });
  if (!response.ok) throw await extractError(response, 'Could not update plan');
  return response.json();
}

export async function completePlan(
  planId: number | string,
  payload: { completion_date: string; completion_time: string }
) {
  const res = await fetch(`${API_URL}/plans/${planId}/complete`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to mark plan as complete');
  }

  return res.json();
}
/** Generates a packing list for a prospective plan without saving anything. */
export async function generateGearRecommendation(
  mountainId: number,
  waypointId: number,
  hikingDate?: string
): Promise<GearRecommendation> {
  const params = new URLSearchParams({ waypoint_id: String(waypointId) });
  if (hikingDate) params.set('date', hikingDate);

  const response = await fetch(`${API_URL}/ai/gear/${mountainId}?${params}`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) throw await extractError(response, 'Could not generate gear recommendations');
  return response.json();
}

/** Regenerates and persists the packing list for an already-saved plan. */
export async function regeneratePlanGear(planId: number): Promise<GearRecommendation> {
  const response = await fetch(`${API_URL}/plans/${planId}/gear`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) throw await extractError(response, 'Could not regenerate gear');
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

export async function removePlanMember(planId: number, planMemberId: number): Promise<void> {
  const response = await fetch(`${API_URL}/plans/${planId}/members/${planMemberId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) throw await extractError(response, 'Could not remove member');
}

export async function fetchNotifications(unreadOnly = false): Promise<NotificationFeed> {
  const params = unreadOnly ? '?unread_only=true' : '';
  const response = await fetch(`${API_URL}/notifications${params}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await extractError(response, 'Could not load notifications');
  return response.json();
}

export async function markNotificationRead(notificationId: number): Promise<void> {
  const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) throw await extractError(response, 'Could not update notification');
}

export async function markAllNotificationsRead(): Promise<void> {
  const response = await fetch(`${API_URL}/notifications/read-all`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) throw await extractError(response, 'Could not update notifications');
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

export interface SafetyChecklistItem {
  item: string;
  reason: string;
  is_critical: boolean;
}

export interface PrescriptiveSafety {
  mountain_id: number;
  waypoint_id: number;
  security_index: number;
  risk_label: string;
  reasons: string[];
  summary: string;
  checklist: SafetyChecklistItem[];
  source: 'ai' | 'fallback';
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatReply {
  reply: string;
  source: 'ai' | 'fallback';
}

export async function sendChatMessage(message: string, history: ChatMessage[]): Promise<ChatReply> {
  const response = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ message, history }),
  });
  if (!response.ok) throw await extractError(response, 'Could not reach the assistant');
  return response.json();
}

export async function fetchPrescriptiveSafety(
  mountainId: number,
  waypointId: number,
  hikingDate?: string
): Promise<PrescriptiveSafety> {
  const params = new URLSearchParams({ mountain_id: String(mountainId), waypoint_id: String(waypointId) });
  if (hikingDate) params.set('date', hikingDate);
  const response = await fetch(`${API_URL}/prescriptive/safety-index?${params}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await extractError(response, 'Could not generate the safety checklist');
  return response.json();
}

export async function fetchWeatherBaseline(
  mountainId: number,
  waypointId: number,
  targetDate: string
): Promise<WeatherBaseline> {
  const params = new URLSearchParams({ mountain_id: String(mountainId), waypoint_id: String(waypointId), date: targetDate });
  const response = await fetch(`${API_URL}/predictive/weather-baseline?${params}`);
  if (!response.ok) throw await extractError(response, 'Could not load historical weather baseline');
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

export async function fetchSafetyAnalysis(
  mountainId: number,
  date?: string,
  waypointId?: number
): Promise<string> {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (waypointId !== undefined) params.append('waypoint_id', waypointId.toString());

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const url = `${API_URL}/ai/safety/${mountainId}${queryString}`;

  const res = await fetch(url, { method: 'POST', headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed' }));
    throw new Error(err.detail || 'Safety analysis failed');
  }
  const data = await res.json();
  return data.analysis;
}

export async function fetchRouteOptimization(
  mountainId: number
): Promise<{ plan: string }> {
  const res = await fetch(`${API_URL}/ai/route-optimization/${mountainId}`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
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

export interface MyTrailReport {
  report_id: number;
  mountain_name: string;
  image_url: string;
  trail_name: string | null;
  rating: number;
  condition: string;
  comment: string;
  created_at: string;
}

export async function fetchMyTrailReports(): Promise<MyTrailReport[]> {
  const response = await fetch(`${API_URL}/trail-reports/me`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await extractError(response, "Could not load your trail reports");
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

/** `identifier` accepts either a TaraPeak username or an email address. */
export async function invitePlanMember(
  planId: number,
  identifier: string
): Promise<{ plan_member_id: number; status: string }> {
  const response = await fetch(`${API_URL}/plans/${planId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ identifier }),
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

export async function fetchDiagnosticCorrelations(): Promise<DiagnosticCorrelations> {
  const res = await fetch(`${API_URL}/analytics/diagnostic-correlations`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load diagnostic correlations');
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

export async function fetchMostTakenTrails(): Promise<MostTakenTrail[]> {
  const response = await fetch(`${API_URL}/analytics/most-taken-trails`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw await extractError(response, 'Could not load completed trail analytics');
  return response.json();
}

