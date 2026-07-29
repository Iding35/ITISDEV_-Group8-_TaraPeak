import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  checkWeather,
  createPlan,
  fetchDifficultyAnalysis,
  fetchMountains,
  fetchSafetyAnalysis,
  fetchWaypoints,
  fetchTrailCheckpoints,
  generateGearRecommendation,
  type GearRecommendation,
  type Mountain,
  type Waypoint,
  type TrailCheckpoint,
  type WeatherCheckResponse,
} from '../api';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

/** Open-Meteo only forecasts ~16 days out; we surface a 14-day window. */
const FORECAST_WINDOW_DAYS = 14;

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const CATEGORY_ICONS: Record<string, string> = {
  Clothing: 'checkroom',
  Footwear: 'footprint',
  Navigation: 'explore',
  Safety: 'health_and_safety',
  Hydration: 'water_drop',
  Nutrition: 'nutrition',
  Shelter: 'cabin',
  Other: 'backpack',
};

function getWeatherDisplay(code: number | null | undefined) {
  if (code === null || code === undefined) return { label: 'Weather Unavailable' };
  if (code === 0) return { label: 'Clear Sky', icon: '☀️' };
  if (code === 1 || code === 2) return { label: 'Partly Cloudy', icon: '⛅️' };
  if (code === 3) return { label: 'Overcast', icon: '☁️' };
  if (code >= 51 && code <= 55) return { label: 'Drizzle', icon: '💧' };
  if (code >= 61 && code <= 65) return { label: 'Rain', icon: '🌧' };
  if (code >= 80 && code <= 82) return { label: 'Rain Showers', icon: '🌦' };
  if (code >= 95) return { label: 'Thunderstorm', icon: '⛈' };
  return { label: 'Fair / Clear', icon: '🌤' };
}

function AnalysisText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1 leading-7 text-gray-700">
      {text.split('\n').map((line, i) => {
        const parts = line.split('**');
        const content: ReactNode = parts.map((part, j) =>
          j % 2 === 1 ? <strong key={j}>{part}</strong> : part,
        );
        return line.trim() === '' ? <div key={i} className="h-2" /> : <p key={i}>{content}</p>;
      })}
    </div>
  );
}

function AIAnalysisCard({
  title,
  icon,
  buttonLabel,
  fetcher,
  disabled,
  disabledHint,
}: {
  title: string;
  icon: string;
  buttonLabel: string;
  fetcher: () => Promise<string>;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-primary">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
            {icon}
          </span>
          {title}
        </h2>
        {!analysis && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || disabled}
            title={disabled ? disabledHint : undefined}
            className="rounded-xl bg-primary px-4 py-2 font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50 text-sm"
          >
            {loading ? 'Analyzing…' : buttonLabel}
          </button>
        )}
      </div>

      {disabled && !analysis && disabledHint && <p className="text-gray-500 text-xs">{disabledHint}</p>}
      {error && <p className="text-red-600 text-xs">{error}</p>}
      {loading && (
        <div className="flex items-center gap-3 text-gray-500 text-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Asking the AI for an analysis…
        </div>
      )}
      {analysis && <AnalysisText text={analysis} />}
    </div>
  );
}

function GearList({
  recommendation,
}: {
  recommendation: GearRecommendation;
}) {
  const required = recommendation.items.filter((item) => item.is_required);
  const optional = recommendation.items.filter((item) => !item.is_required);

  function renderGroup(title: string, items: typeof recommendation.items) {
    if (items.length === 0) return null;
    return (
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
          {title} ({items.length})
        </h4>
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li
              key={`${item.gear_name}-${index}`}
              className="flex gap-3 rounded-xl border border-gray-200/80 bg-white p-3"
            >
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-primary text-[20px] shrink-0"
              >
                {CATEGORY_ICONS[item.category] ?? 'backpack'}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{item.gear_name}</p>
                {item.reason && <p className="text-xs text-gray-500 mt-0.5">{item.reason}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {recommendation.summary && (
        <p className="text-sm leading-relaxed text-gray-700 bg-primary/5 border border-primary/15 rounded-xl p-3">
          {recommendation.summary}
        </p>
      )}
      {recommendation.source === 'fallback' && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          The AI service was unreachable, so this list was built from the trail, forecast, and your
          experience level using TaraPeak's built-in rules.
        </p>
      )}
      {renderGroup('Essential', required)}
      {renderGroup('Recommended', optional)}
    </div>
  );
}

export default function Planner() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [trails, setTrails] = useState<Waypoint[]>([]);
  const [checkpoints, setCheckpoints] = useState<TrailCheckpoint[]>([]);

  const [selectedMountain, setSelectedMountain] = useState('');
  const [selectedTrail, setSelectedTrail] = useState<Waypoint | null>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<TrailCheckpoint | null>(null);
  const [date, setDate] = useState('');

  const [loadingMountains, setLoadingMountains] = useState(true);
  const [loadingTrails, setLoadingTrails] = useState(false);
  const [loadingCheckpoints, setLoadingCheckpoints] = useState(false);

  const [weather, setWeather] = useState<WeatherCheckResponse | null>(null);
  const [checkingWeather, setCheckingWeather] = useState(false);

  const [gear, setGear] = useState<GearRecommendation | null>(null);
  const [gearStatus, setGearStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [gearError, setGearError] = useState<string | null>(null);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const today = new Date();
  const minDate = toISODate(today);
  const forecastLimit = new Date(today);
  forecastLimit.setDate(today.getDate() + FORECAST_WINDOW_DAYS);
  const forecastLimitStr = toISODate(forecastLimit);
  const isBeyondForecast = date ? date > forecastLimitStr : false;

  const canSave = Boolean(selectedMountain && selectedTrail && selectedCheckpoint && date);

  const weatherDetails = getWeatherDisplay(weather?.forecast?.weather_code);

  // Load mountains on mount
  useEffect(() => {
    fetchMountains()
      .then(setMountains)
      .catch(() => setMountains([]))
      .finally(() => setLoadingMountains(false));
  }, []);

  // Trail options depend on the selected mountain.
  useEffect(() => {
    setSelectedTrail(null);
    setSelectedCheckpoint(null);
    setTrails([]);
    setCheckpoints([]);
    if (!selectedMountain) return;

    let cancelled = false;
    setLoadingTrails(true);
    fetchWaypoints(Number(selectedMountain))
      .then((data) => {
        if (cancelled) return;
        setTrails(data);
        if (data.length > 0) setSelectedTrail(data[0]);
      })
      .catch(() => {
        if (!cancelled) setTrails([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTrails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMountain]);

  // Fetch checkpoints when selected trail changes
  useEffect(() => {
    if (!selectedTrail) {
      setCheckpoints([]);
      setSelectedCheckpoint(null);
      return;
    }

    let cancelled = false;
    setLoadingCheckpoints(true);
    fetchTrailCheckpoints(selectedTrail.waypoint_id)
      .then((cps) => {
        if (!cancelled) {
          setCheckpoints(cps);
          // Only allow selection from the second trail checkpoint (index 1), fallback to index 0 if only 1 exists
          if (cps.length > 1) {
            setSelectedCheckpoint(cps[1]);
          } else if (cps.length > 0) {
            setSelectedCheckpoint(cps[0]);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setCheckpoints([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCheckpoints(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTrail]);

  // Any change to the trip invalidates the generated gear and save state.
  useEffect(() => {
    setGear(null);
    setGearStatus('idle');
    setSaveStatus('idle');
  }, [selectedMountain, selectedTrail, selectedCheckpoint, date]);

  // Fetch Weather Forecast
  useEffect(() => {
    if (!selectedMountain || !selectedTrail || !date || isBeyondForecast) {
      setWeather(null);
      return;
    }

    let cancelled = false;
    setCheckingWeather(true);
    checkWeather(Number(selectedMountain), date, selectedTrail.waypoint_id)
      .then((result) => {
        if (!cancelled) setWeather(result);
      })
      .catch(() => {
        if (!cancelled) setWeather(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingWeather(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMountain, selectedTrail, date, isBeyondForecast]);

  async function handleGenerateGear() {
    if (!canSave || !selectedTrail) return;
    setGearStatus('loading');
    setGearError(null);
    try {
      const result = await generateGearRecommendation(
        Number(selectedMountain),
        selectedTrail.waypoint_id,
        date
      );
      setGear(result);
      setGearStatus('idle');
    } catch (err) {
      setGearStatus('error');
      setGearError(err instanceof Error ? err.message : 'Could not generate gear recommendations');
    }
  }

  async function handleSave() {
    if (!canSave || !selectedTrail || !selectedCheckpoint) return;
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const gearWithPackedState = gear?.items.map((item) => ({
        ...item,
        is_packed: false,
      })) ?? [];

      const plan = await createPlan(
        Number(selectedMountain),
        selectedTrail.waypoint_id,
        date,
        selectedCheckpoint.checkpoint_id, 
        {
          ai_gear_summary: gear?.summary ?? null,
          gear: gearWithPackedState,
        } 
      );
      setSaveStatus('saved');
            
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Could not save plan');
    }
  }

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const selectClass =
    'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition disabled:opacity-60 disabled:cursor-not-allowed';

  const difficultyDisabledReason = !user
    ? 'Log in to generate an AI Trail Difficulty Analysis.'
    : !selectedTrail || !date
      ? 'Please select a trail and hiking date above to analyze difficulty.'
      : undefined;

  const safetyDisabledReason = !user
    ? 'Log in to generate an AI Safety Advisory.'
    : !selectedTrail || !date
      ? 'Please select a trail and hiking date above to generate safety advisory.'
      : undefined;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary leading-tight">
            Plan a Hike
          </h1>
          <p className="text-on-surface/70 mt-2">
            Pick your mountain, choose a trail, select a target checkpoint, set a date, and let TaraPeak build your packing list.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Form & Selection controls */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-6 sm:p-8 space-y-6">
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <label htmlFor="planner-mountain" className="block text-sm text-gray-500 mb-2 font-medium">
                    1. Mountain
                  </label>
                  <select
                    id="planner-mountain"
                    value={selectedMountain}
                    onChange={(e) => setSelectedMountain(e.target.value)}
                    disabled={loadingMountains}
                    className={selectClass}
                  >
                    <option value="">
                      {loadingMountains ? 'Loading mountains…' : 'Select a mountain'}
                    </option>
                    {mountains.map((mountain) => (
                      <option key={mountain.mountain_id} value={mountain.mountain_id}>
                        {mountain.mountain_name} — {mountain.location}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="planner-trail" className="block text-sm text-gray-500 mb-2 font-medium">
                    2. Trail Route
                  </label>
                  <select
                    id="planner-trail"
                    value={selectedTrail ? String(selectedTrail.waypoint_id) : ''}
                    onChange={(e) => {
                      const found = trails.find((t) => String(t.waypoint_id) === e.target.value);
                      setSelectedTrail(found || null);
                    }}
                    disabled={!selectedMountain || loadingTrails}
                    className={selectClass}
                  >
                    <option value="">
                      {!selectedMountain
                        ? 'Select a mountain first'
                        : loadingTrails
                          ? 'Loading trails…'
                          : 'Select a trail'}
                    </option>
                    {trails.map((t) => (
                      <option key={t.waypoint_id} value={t.waypoint_id}>
                        {t.name} — {t.difficulty}, {t.distance_from_start_km} km
                      </option>
                    ))}
                  </select>
                  {selectedTrail && (
                    <p className="mt-2 text-xs text-gray-500">
                      {selectedTrail.difficulty} • {selectedTrail.distance_from_start_km} km • ~{selectedTrail.estimated_time} hrs
                      {selectedTrail.elevation_m ? ` • ${selectedTrail.elevation_m} m peak` : ''}
                    </p>
                  )}
                </div>

                {/* Checkpoints Selection Option (Required) */}
                <div>
                  <label htmlFor="planner-checkpoint" className="block text-sm text-gray-500 mb-2 font-medium">
                    3. Target Checkpoint
                  </label>
                  <select
                    id="planner-checkpoint"
                    value={selectedCheckpoint ? String(selectedCheckpoint.checkpoint_id) : ''}
                    onChange={(e) => {
                      const found = checkpoints.find((cp) => String(cp.checkpoint_id) === e.target.value);
                      setSelectedCheckpoint(found || null);
                    }}
                    disabled={!selectedTrail || loadingCheckpoints}
                    className={selectClass}
                  >
                    <option value="">
                      {!selectedTrail
                        ? 'Select a trail first'
                        : loadingCheckpoints
                          ? 'Loading checkpoints…'
                          : checkpoints.length === 0
                            ? 'No checkpoints available'
                            : 'Select target milestone'}
                    </option>
                    {checkpoints.map((cp, index) => (
                      <option key={cp.checkpoint_id} value={cp.checkpoint_id} disabled={index < 1}>
                        {cp.sequence_order}. {cp.name} ({cp.distance_from_start_km} km)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="planner-date" className="block text-sm text-gray-500 mb-2 font-medium">
                    4. Hiking date
                  </label>
                  <input
                      id="planner-date"
                      type="date"
                      value={date}
                      min={minDate}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                  />
                  {isBeyondForecast && (
                    <p className="mt-2 text-xs text-amber-700">
                      You can still save this plan, but forecasts only reach {FORECAST_WINDOW_DAYS} days ahead.
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave || saveStatus === 'saving'}
                    className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saveStatus === 'saving' ? 'Saving…' : 'Save Plan'}
                  </button>

                  {saveStatus === 'saved' && (
                    <p className="text-primary font-semibold text-xs mb-2 text-center">
                      Plan saved!{' '}
                      <Link to="/dashboard" className="underline">
                        View my plans
                      </Link>
                    </p>
                  )}

                  {!canSave && (
                    <p className="text-xs text-gray-500 text-center">
                      Choose a mountain, trail, target checkpoint, and date to continue.
                    </p>
                  )}
                  {saveError && <p className="text-red-600 text-xs">{saveError}</p>}
                  {gearError && <p className="text-red-600 text-xs">{gearError}</p>}
                </div>
              </form>
            </div>

            {/* Moved "Already planned something?" block beneath the white container card */}
            <p className="text-sm text-on-surface-variant px-2">
              Already planned something?{' '}
              <Link to="/dashboard" className="text-primary font-semibold hover:underline">
                View your saved plans
              </Link>
            </p>
          </div>

          {/* Right: Forecast + Gear Output + AI Analysis Cards */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-surface-container-low border border-gray-200/80 rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">schedule</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Weather Conditions Preview
                  </h3>
                </div>
                <span className="text-xs font-semibold bg-white px-2 py-0.5 rounded-md border border-gray-200 text-gray-600 shadow-xs">
                  {date ? date : 'No Date Selected'}
                </span>
              </div>

              <div className="flex flex-col justify-center my-auto py-1">
                {!user ? (
                  <div className="py-3 text-center">
                    <p className="text-xs text-gray-500">Log in to view detailed weather forecasts.</p>
                  </div>
                ) : isBeyondForecast ? (
                  <div className="py-2 text-center px-2">
                    <p className="text-xs text-amber-800 font-medium">
                      Plan can be saved, but weather forecasts are only available within a 14-day window.
                    </p>
                  </div>
                ) : checkingWeather ? (
                  <div className="flex items-center justify-center gap-2 text-gray-500 py-3 text-xs">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Querying weather metrics...
                  </div>
                ) : weather?.forecast ? (
                  <div className="flex flex-col gap-2.5">
                    {/* Top Row: Temp, Humidity, Wind */}
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-xs flex flex-col justify-between">
                        <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                          <span className="material-symbols-outlined text-amber-500 text-xs">thermostat</span>
                          Temp
                        </span>
                        <span className="text-xl font-bold text-gray-800 mt-1">
                          {weather.forecast.temperature}<span className="text-xs font-normal text-gray-500">°C</span>
                        </span>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-xs flex flex-col justify-between">
                        <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                          <span className="material-symbols-outlined text-blue-500 text-xs">humidity_percentage</span>
                          Humidity
                        </span>
                        <span className="text-xl font-bold text-gray-800 mt-1">
                          {weather.forecast.humidity}<span className="text-xs font-normal text-gray-500">%</span>
                        </span>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-xs flex flex-col justify-between">
                        <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                          <span className="material-symbols-outlined text-teal-500 text-xs">air</span>
                          Wind
                        </span>
                        <span className="text-xl font-bold text-gray-800 mt-1">
                          {weather.forecast.wind_speed} <span className="text-[10px] font-normal text-gray-500">km/h</span>
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Weather Condition Description & Precipitation */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-xs flex items-center justify-between">
                        <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                          <span className="material-symbols-outlined text-indigo-500 text-xs">cloud</span>
                          Condition
                        </span>
                        <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                          <span>{weatherDetails.icon}</span> {weatherDetails.label}
                        </span>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-gray-200/60 shadow-xs flex items-center justify-between">
                        <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                          <span className="material-symbols-outlined text-blue-400 text-xs">water_drop</span>
                          Rainfall
                        </span>
                        <span className="text-xs font-bold text-gray-800">
                          {weather.forecast.precipitation_mm ?? 0} <span className="text-[10px] font-normal text-gray-500">mm</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-3 text-center">
                    <p className="text-xs text-gray-500">
                      {date ? 'No metrics available for this particular date.' : 'Select a target date to preview metrics.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-primary mb-1">
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                      backpack
                    </span>
                    AI Gear Recommendations
                  </h2>
                  <p className="text-sm text-gray-500">
                    Built from the trail profile, the forecast, recent hiker reports, and your experience level.
                  </p>
                </div>
                {!gear && (
                  <button
                    type="button"
                    onClick={handleGenerateGear}
                    disabled={!canSave || gearStatus === 'loading'}
                    className="rounded-xl bg-primary px-4 py-2 font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50 text-sm shrink-0"
                  >
                    {gearStatus === 'loading' ? 'Building list…' : 'Generate AI Gear List'}
                  </button>
                )}
              </div>

              {gearStatus === 'loading' && (
                <div className="flex items-center gap-3 text-gray-500 text-sm py-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Assessing conditions and choosing gear…
                </div>
              )}

              {!gear && gearStatus !== 'loading' && (
                <p className="text-sm text-gray-500 py-4 text-center">
                  Generate a list to see what to pack. It is saved along with your plan.
                </p>
              )}

              {gear && gearStatus !== 'loading' && (
                <GearList
                  recommendation={gear}
                />
              )}
            </div>

            {/* Additional AI Analysis Cards (Always Visible, Disabled when criteria are not met) */}
            <div className="flex flex-col gap-6">
              <AIAnalysisCard
                title="AI Trail Difficulty Analysis"
                icon="fitness_center"
                buttonLabel="Analyze Difficulty"
                disabled={!!difficultyDisabledReason}
                disabledHint={difficultyDisabledReason}
                fetcher={() => fetchDifficultyAnalysis(Number(selectedMountain))}
              />

              <AIAnalysisCard
                title="AI Safety Advisory"
                icon="verified_user"
                buttonLabel="Generate Safety Advisory"
                disabled={!!safetyDisabledReason}
                disabledHint={safetyDisabledReason}
                fetcher={() => fetchSafetyAnalysis(Number(selectedMountain), date, selectedTrail!.waypoint_id)}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}