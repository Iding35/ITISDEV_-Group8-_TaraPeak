import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  checkWeather,
  createPlan,
  fetchMountains,
  fetchWaypoints,
  generateGearRecommendation,
  type GearRecommendation,
  type Mountain,
  type Waypoint,
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

function GearList({ recommendation }: { recommendation: GearRecommendation }) {
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

  const [selectedMountain, setSelectedMountain] = useState('');
  const [selectedTrail, setSelectedTrail] = useState('');
  const [date, setDate] = useState('');

  const [loadingMountains, setLoadingMountains] = useState(true);
  const [loadingTrails, setLoadingTrails] = useState(false);

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

  const trail = trails.find((t) => String(t.waypoint_id) === selectedTrail) ?? null;
  const canSave = Boolean(selectedMountain && selectedTrail && date);

  useEffect(() => {
    fetchMountains()
      .then(setMountains)
      .catch(() => setMountains([]))
      .finally(() => setLoadingMountains(false));
  }, []);

  // Trail options depend on the selected mountain.
  useEffect(() => {
    setSelectedTrail('');
    setTrails([]);
    if (!selectedMountain) return;

    let cancelled = false;
    setLoadingTrails(true);
    fetchWaypoints(Number(selectedMountain))
      .then((data) => {
        if (cancelled) return;
        setTrails(data);
        if (data.length > 0) setSelectedTrail(String(data[0].waypoint_id));
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

  // Any change to the trip invalidates the generated gear and save state.
  useEffect(() => {
    setGear(null);
    setGearStatus('idle');
    setSaveStatus('idle');
  }, [selectedMountain, selectedTrail, date]);

  useEffect(() => {
    if (!selectedMountain || !selectedTrail || !date || isBeyondForecast) {
      setWeather(null);
      return;
    }

    let cancelled = false;
    setCheckingWeather(true);
    checkWeather(Number(selectedMountain), date, Number(selectedTrail))
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
    if (!canSave) return;
    setGearStatus('loading');
    setGearError(null);
    try {
      const result = await generateGearRecommendation(
        Number(selectedMountain),
        Number(selectedTrail),
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
    if (!canSave) return;
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const plan = await createPlan(Number(selectedMountain), Number(selectedTrail), date, {
        ai_gear_summary: gear?.summary ?? null,
        gear: gear?.items ?? [],
      });
      setSaveStatus('saved');
      navigate(`/plans/${plan.plan_id}`);
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Could not save plan');
    }
  }

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const selectClass =
    'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition disabled:opacity-60 disabled:cursor-not-allowed';

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />

      <main className="max-w-7xl mx-auto px-margin-desktop py-lg">
        <div className="mb-8">
          <h1 className="font-display-lg text-display-lg text-primary animated-text leading-tight">
            Plan a Hike
          </h1>
          <p className="text-on-surface/70 mt-2">
            Pick your mountain, choose a trail, set a date, and let TaraPeak build your packing list.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: the form */}
          <div className="lg:col-span-5 bg-white rounded-3xl shadow-lg border border-gray-200 p-6 sm:p-8">
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label htmlFor="planner-mountain" className="block text-sm text-gray-500 mb-2">
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
                <label htmlFor="planner-trail" className="block text-sm text-gray-500 mb-2">
                  2. Trail
                </label>
                <select
                  id="planner-trail"
                  value={selectedTrail}
                  onChange={(e) => setSelectedTrail(e.target.value)}
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
                {trail && (
                  <p className="mt-2 text-xs text-gray-500">
                    {trail.difficulty} • {trail.distance_from_start_km} km • ~{trail.estimated_time} hrs
                    {trail.elevation_m ? ` • ${trail.elevation_m} m peak` : ''}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="planner-date" className="block text-sm text-gray-500 mb-2">
                  3. Hiking date
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
                    You can still save this plan, but forecasts only reach {FORECAST_WINDOW_DAYS} days
                    ahead.
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100 space-y-3">
                <button
                  type="button"
                  onClick={handleGenerateGear}
                  disabled={!canSave || gearStatus === 'loading'}
                  className="w-full rounded-xl border border-primary px-4 py-3 font-semibold text-primary transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {gearStatus === 'loading' ? 'Building your packing list…' : 'Generate AI Gear List'}
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave || saveStatus === 'saving'}
                  className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveStatus === 'saving' ? 'Saving…' : 'Save Plan'}
                </button>

                {!canSave && (
                  <p className="text-xs text-gray-500 text-center">
                    Choose a mountain, trail, and date to continue.
                  </p>
                )}
                {saveError && <p className="text-red-600 text-xs">{saveError}</p>}
                {gearError && <p className="text-red-600 text-xs">{gearError}</p>}
              </div>
            </form>
          </div>

          {/* Right: forecast + gear output */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
                  <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                    partly_cloudy_day
                  </span>
                  Forecast
                </h2>
                <span className="text-xs font-semibold bg-gray-50 px-2 py-1 rounded-md border border-gray-200 text-gray-600">
                  {date || 'No date selected'}
                </span>
              </div>

              {!canSave ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  Complete the form to preview conditions for your hike.
                </p>
              ) : isBeyondForecast ? (
                <p className="text-sm text-amber-700 py-4 text-center">
                  That date is beyond the {FORECAST_WINDOW_DAYS}-day forecast window.
                </p>
              ) : checkingWeather ? (
                <div className="flex items-center justify-center gap-2 text-gray-500 py-4 text-sm">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Checking conditions…
                </div>
              ) : weather?.forecast ? (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Temp', value: `${weather.forecast.temperature}°C`, icon: 'thermostat' },
                    { label: 'Humidity', value: `${weather.forecast.humidity}%`, icon: 'humidity_percentage' },
                    { label: 'Wind', value: `${weather.forecast.wind_speed} km/h`, icon: 'air' },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="bg-gray-50 p-3 rounded-xl border border-gray-200/60"
                    >
                      <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                        <span aria-hidden="true" className="material-symbols-outlined text-primary text-xs">
                          {metric.icon}
                        </span>
                        {metric.label}
                      </span>
                      <span className="block text-lg font-bold text-gray-800 mt-1">{metric.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No forecast data available for this date yet.
                </p>
              )}
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-primary mb-1">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                  backpack
                </span>
                AI Gear Recommendations
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Built from the trail profile, the forecast, recent hiker reports, and your experience
                level.
              </p>

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

              {gear && gearStatus !== 'loading' && <GearList recommendation={gear} />}
            </div>
          </div>
        </div>

        <p className="mt-8 text-sm text-on-surface-variant">
          Already planned something?{' '}
          <Link to="/plans" className="text-primary font-semibold hover:underline">
            View your saved plans
          </Link>
        </p>
      </main>
    </div>
  );
}
