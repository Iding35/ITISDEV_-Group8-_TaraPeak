// src/pages/TrailDetail.tsx
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  checkWeather,
  createPlan,
  fetchDifficultyAnalysis,
  fetchMountain,
  fetchRouteOptimization,
  fetchSafetyAnalysis,
  fetchWaypoints, // Fetches trails from route_waypoints
  fetchTrailCheckpoints, // Fetches checkpoints from trail_checkpoints
  fetchTrailReports,
  type Mountain,
  type WeatherCheckResponse,
  type Waypoint,
  type TrailCheckpoint,
  type TrailReport,
} from '../api';
import Navbar from '../components/Navbar';
import TrailMap from '../components/TrailMap';
import { useAuth } from '../context/AuthContext';

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
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-primary">
          <span aria-hidden="true" className="material-symbols-outlined">
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
            className="rounded-xl bg-primary px-4 py-2 font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
          >
            {loading ? 'Analyzing…' : buttonLabel}
          </button>
        )}
      </div>

      {disabled && !analysis && disabledHint && <p className="text-gray-500 text-sm">{disabledHint}</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading && (
        <div className="flex items-center gap-3 text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Asking the AI for an analysis…
        </div>
      )}
      {analysis && <AnalysisText text={analysis} />}
    </div>
  );
}

function TrailAndCheckpointSection({
  mountainId,
  selectedTrail,
  onSelectTrail,
  selectedCheckpoint,
  onSelectCheckpoint,
  onCheckpointsLoaded,
}: {
  mountainId: number;
  selectedTrail: Waypoint | null;
  onSelectTrail: (trail: Waypoint) => void;
  selectedCheckpoint: TrailCheckpoint | null;
  onSelectCheckpoint: (cp: TrailCheckpoint | null) => void;
  onCheckpointsLoaded: (checkpoints: TrailCheckpoint[]) => void;
}) {
  const [trails, setTrails] = useState<Waypoint[]>([]);
  const [checkpoints, setCheckpoints] = useState<TrailCheckpoint[]>([]);
  const [loadingTrails, setLoadingTrails] = useState(true);
  const [loadingCheckpoints, setLoadingCheckpoints] = useState(false);

  // 1. Fetch Trails for Mountain
  useEffect(() => {
    setLoadingTrails(true);
    fetchWaypoints(mountainId)
      .then((data) => {
        setTrails(data);
        if (data.length > 0 && !selectedTrail) {
          onSelectTrail(data[0]); // Default to first trail
        }
      })
      .finally(() => setLoadingTrails(false));
  }, [mountainId]);

  // 2. Fetch Checkpoints when Selected Trail changes
  useEffect(() => {
    if (!selectedTrail) {
      setCheckpoints([]);
      onCheckpointsLoaded([]);
      return;
    }

    setLoadingCheckpoints(true);
    fetchTrailCheckpoints(selectedTrail.waypoint_id)
      .then((cps) => {
        setCheckpoints(cps);
        onCheckpointsLoaded(cps);
        onSelectCheckpoint(null); // Reset checkpoint selection on trail change
      })
      .finally(() => setLoadingCheckpoints(false));
  }, [selectedTrail]);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col h-full">
      {/* Step 1: Select Trail */}
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-primary mb-1">
          <span aria-hidden="true" className="material-symbols-outlined">
            alt_route
          </span>
          1. Select Trail
        </h2>
        <p className="text-sm text-gray-500">Select a trail route to view its checkpoints.</p>

        {loadingTrails ? (
          <p className="text-sm text-gray-500 mt-3">Loading mountain trails…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {trails.map((t) => {
              const isSelected = selectedTrail?.waypoint_id === t.waypoint_id;
              return (
                <button
                  type="button"
                  key={t.waypoint_id}
                  onClick={() => onSelectTrail(t)}
                  className={`p-3.5 text-left rounded-xl border transition-all ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20 bg-primary/10 font-bold text-primary'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-base font-semibold">{t.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t.difficulty} • {t.distance_from_start_km} km
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <hr className="border-gray-100 my-6" />

      {/* Step 2: Select Checkpoint inside chosen trail */}
      <div className="flex flex-col flex-1 min-h-0">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-800 mb-1">
          <span aria-hidden="true" className="material-symbols-outlined">
            location_on
          </span>
          2. Checkpoints along {selectedTrail ? selectedTrail.name : 'Trail'}
        </h3>

        {loadingCheckpoints && <p className="text-sm text-gray-500 mt-2">Loading checkpoints…</p>}

        {!loadingCheckpoints && checkpoints.length > 0 && (
          <ol className="flex flex-col gap-3 mt-3 overflow-y-auto pr-1 flex-1">
            {checkpoints.map((cp) => {
              const isSelected = selectedCheckpoint?.checkpoint_id === cp.checkpoint_id;

              return (
                <li
                  key={cp.checkpoint_id}
                  onClick={() => onSelectCheckpoint(cp)}
                  className={`flex gap-3.5 items-start p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-sm'
                      : 'border-gray-200/80 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {cp.sequence_order}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-semibold text-slate-900 text-base">{cp.name}</h4>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200/60">
                        {cp.distance_from_start_km} km • {cp.elevation_m}m
                      </span>
                    </div>
                    {cp.description && <p className="text-sm text-slate-600 mt-1">{cp.description}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {!loadingCheckpoints && checkpoints.length === 0 && (
          <p className="text-sm text-gray-500 mt-2">No checkpoints registered for this trail yet.</p>
        )}
      </div>
    </div>
  );
}
function SavePlanSection({
  mountainId,
  date,
  onDateChange,
  selectedTrail,
  selectedCheckpoint,
}: {
  mountainId: number;
  date: string;
  onDateChange: (date: string) => void;
  selectedTrail: Waypoint | null;
  selectedCheckpoint: TrailCheckpoint | null;
}) {
  const { user } = useAuth();
  const [weather, setWeather] = useState<WeatherCheckResponse | null>(null);
  const [checkingWeather, setCheckingWeather] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Compute 2-week limit boundaries
  const today = new Date();
  const maxDateObj = new Date();
  maxDateObj.setDate(today.getDate() + 14);
  const maxDateStr = maxDateObj.toISOString().slice(0, 10);
  const minDateStr = today.toISOString().slice(0, 10);

  // Check if selected date exceeds 2-week window
  const isBeyondTwoWeeks = date ? date > maxDateStr : false;

  useEffect(() => {
    if (!date || !selectedTrail || !user || isBeyondTwoWeeks) {
      setWeather(null);
      return;
    }
    let cancelled = false;
    setCheckingWeather(true);

    checkWeather(mountainId, date, selectedTrail.waypoint_id)
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
  }, [mountainId, date, selectedTrail, user, isBeyondTwoWeeks]);

  async function handleSave() {
    if (!selectedTrail) return;
    setSaveStatus('saving');
    setSaveError(null);
    try {
      await createPlan(mountainId, selectedTrail.waypoint_id, date);
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Could not save plan');
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col h-full">
      <h2 className="flex items-center gap-2 text-2xl font-semibold text-primary mb-4">
        <span aria-hidden="true" className="material-symbols-outlined">
          calendar_month
        </span>
        3. Select Date &amp; Save Plan
      </h2>

      {!selectedTrail ? (
        <p className="text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 text-sm">
          ⚠️ Please select a trail above before picking a date.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1">
          {/* Left Column: Input Form & Save Control */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div className="flex flex-col gap-4">
              <div className="text-sm font-medium text-primary bg-primary/10 p-3 rounded-lg flex flex-col gap-1">
                <div>
                  Selected Trail: <span className="font-bold">{selectedTrail.name}</span>
                </div>
                {selectedCheckpoint && (
                  <div>
                    Selected Checkpoint: <span className="font-bold">{selectedCheckpoint.name}</span>
                  </div>
                )}
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-gray-700">Hiking date</span>
                <input
                  type="date"
                  value={date}
                  min={minDateStr}
                  onChange={(e) => {
                    onDateChange(e.target.value);
                    setSaveStatus('idle');
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent outline-none w-full"
                />
              </label>
            </div>

            <div className="pt-4">
              {!user && (
                <p className="text-gray-600 text-xs mb-2">
                  <Link to="/login" className="text-primary font-semibold hover:underline">
                    Log in
                  </Link>{' '}
                  to check the forecast for this date.
                </p>
              )}
              {user && saveStatus === 'saved' && (
                <p className="text-primary font-semibold text-xs mb-2">
                  Plan saved!{' '}
                  <Link to="/plans" className="underline">
                    View my plans
                  </Link>
                </p>
              )}
              {user && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveStatus === 'saving' || saveStatus === 'saved' || !date}
                  className="w-full rounded-xl bg-primary px-4 py-2.5 font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
                >
                  {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved Plan' : 'Save Plan'}
                </button>
              )}
              {saveError && <p className="text-red-600 text-xs mt-1.5">{saveError}</p>}
            </div>
          </div>

          {/* Right Column: Weather Metrics & Warnings */}
          <div className="lg:col-span-7 bg-surface-container-low border border-gray-200/80 rounded-xl p-5 flex flex-col justify-between">
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
              ) : isBeyondTwoWeeks ? (
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
              ) : (
                <div className="py-3 text-center">
                  <p className="text-xs text-gray-500">
                    {date ? 'No metrics available for this particular date.' : 'Select a target date to preview metrics.'}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2.5 mt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px] text-gray-400">
              <span>Forecasts available up to 2 weeks ahead.</span>
              
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RouteOptimizationSection({
  mountainId,
  selectedTrail,
  date,
}: {
  mountainId: number;
  selectedTrail: Waypoint | null;
  date: string;
}) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOptimize() {
    setLoadingPlan(true);
    setError(null);
    try {
      const result = await fetchRouteOptimization(mountainId);
      setPlan(result.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Route optimization failed');
    } finally {
      setLoadingPlan(false);
    }
  }

  const pacingDisabledReason = !user
    ? 'Log in to generate an AI pacing plan.'
    : !selectedTrail || !date
      ? 'Please select a trail and hiking date to generate an AI pacing plan.'
      : undefined;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-primary">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-primary">
            <span aria-hidden="true" className="material-symbols-outlined">
              route
            </span>
            AI Route &amp; Pacing Optimization
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Generate a personalized pacing schedule and rest-stop recommendations based on trail elevation.
          </p>
        </div>

        {!plan && (
          <button
            type="button"
            onClick={handleOptimize}
            disabled={loadingPlan || !!pacingDisabledReason}
            className="shrink-0 rounded-xl bg-primary px-4 py-2.5 font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
            title={pacingDisabledReason}
          >
            {loadingPlan ? 'Optimizing…' : 'Generate AI Pacing Plan'}
          </button>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      {loadingPlan && (
        <div className="flex items-center gap-3 text-gray-500 mt-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Working out the best pacing plan…
        </div>
      )}
      {pacingDisabledReason && !plan && <p className="text-gray-500 text-sm mt-2">{pacingDisabledReason}</p>}
      {plan && (
        <div className="mt-4 border-t pt-4">
          <AnalysisText text={plan} />
        </div>
      )}
    </div>
  );
}

function TrailReportsSection({
  mountainId,
  selectedTrail,
}: {
  mountainId: number;
  selectedTrail: Waypoint | null;
}) {
  const [reports, setReports] = useState<TrailReport[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mountainId) return;

    setLoading(true);
    fetchTrailReports(mountainId)
      .then(setReports)
      .catch((err) => {
        console.error('Failed to load reports:', err);
        setReports([]);
      })
      .finally(() => setLoading(false));
  }, [mountainId]);

  const filteredReports = selectedTrail
    ? reports.filter((r) => r.waypoint_id === selectedTrail.waypoint_id)
    : reports;

  return (
    <section className="mt-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-primary">Trail Reports</h2>
          {selectedTrail ? (
            <p className="text-sm text-gray-500 mt-1">
              Showing reports for: <span className="font-semibold text-primary">{selectedTrail.name}</span>
            </p>
          ) : (
            <p className="text-sm text-gray-500 mt-1">Showing all reports for this mountain.</p>
          )}
        </div>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading reports...</p>}

      {!loading && filteredReports.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
          No trail reports recorded for {selectedTrail ? selectedTrail.name : 'this mountain'} yet.
        </div>
      )}

      {!loading && filteredReports.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReports.map((report, idx) => (
            <div
              key={report.report_id ?? idx}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">{report.user_name || 'Anonymous Hiker'}</span>
                  <span className="text-xs text-gray-400">
                    {report.created_at ? new Date(report.created_at).toLocaleDateString() : 'Recently'}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {report.rating ?? 0}/5
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface-container-low text-primary">
                    {report.condition}
                  </span>
                </div>

                <p className="text-gray-700 text-sm leading-relaxed">{report.comment}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function TrailDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [mountain, setMountain] = useState<Mountain | null>(null);
  const [selectedTrail, setSelectedTrail] = useState<Waypoint | null>(null);
  const [checkpoints, setCheckpoints] = useState<TrailCheckpoint[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<TrailCheckpoint | null>(null);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchMountain(id)
      .then(setMountain)
      .catch((err) => console.error('Failed to load mountain details:', err))
      .finally(() => setLoading(false));
  }, [id]);

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
    <div className="bg-background text-gray-800 min-h-screen">
      <Navbar />

      <main className="max-w-7xl mx-auto px-8 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-6">
          <span className="material-symbols-outlined">arrow_back</span> Back to Map
        </Link>

        {loading && <p className="text-gray-500">Loading mountain details...</p>}

        {mountain && (
          <div className="flex flex-col gap-8">
            <div>
              <h1 className="text-4xl font-bold text-primary mb-2">{mountain.mountain_name}</h1>
              <p className="text-gray-500">
                {mountain.location} • {mountain.terrain}
              </p>
            </div>
            <img
              src={`/${mountain.image_url}`}
              alt={mountain.mountain_name}
              className="w-full h-[420px] rounded-2xl object-cover shadow-lg"
            />
            <section className="mb-2">
              <h2 className="text-2xl font-semibold text-primary mb-4">Description</h2>
              <p className="leading-8 text-gray-700">{mountain.description}</p>
            </section>

            {/* DUAL LAYOUT: Left map matches right trail panel height */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              
              {/* Left Column: Interactive Map wrapped to fill the height */}
              <div className="lg:col-span-6 lg:sticky lg:top-24 flex flex-col h-[650px]">
                <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col h-full [&>div]:flex-1">
                  <TrailMap
                    checkpoints={checkpoints}
                    selectedCheckpoint={selectedCheckpoint}
                    onSelectCheckpoint={setSelectedCheckpoint}
                  />
                </div>
              </div>

              {/* Right Column: Trail & Checkpoint Selection Section */}
              <div className="lg:col-span-6 flex flex-col h-[650px]">
                <TrailAndCheckpointSection
                  mountainId={mountain.mountain_id}
                  selectedTrail={selectedTrail}
                  onSelectTrail={setSelectedTrail}
                  selectedCheckpoint={selectedCheckpoint}
                  onSelectCheckpoint={setSelectedCheckpoint}
                  onCheckpointsLoaded={setCheckpoints}
                />
              </div>
            </div>

            {/* SEPARATE BOTTOM SECTIONS: Step 3, AI Cards, & Reports */}
            <div className="flex flex-col gap-8">
              {/* Step 3: Date Selection & Save Plan */}
              <SavePlanSection
                mountainId={mountain.mountain_id}
                date={date}
                onDateChange={setDate}
                selectedTrail={selectedTrail}
                selectedCheckpoint={selectedCheckpoint}
              />

              {/* AI Optimization Card */}
              <RouteOptimizationSection
                mountainId={mountain.mountain_id}
                selectedTrail={selectedTrail}
                date={date}
              />

              {/* AI Difficulty & Safety Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AIAnalysisCard
                  title="AI Trail Difficulty Analysis"
                  icon="fitness_center"
                  buttonLabel="Analyze Difficulty"
                  disabled={!!difficultyDisabledReason}
                  disabledHint={difficultyDisabledReason}
                  fetcher={() => fetchDifficultyAnalysis(mountain.mountain_id)}
                />

                <AIAnalysisCard
                  title="AI Safety Advisory"
                  icon="shield"
                  buttonLabel="Check Safety"
                  disabled={!!safetyDisabledReason}
                  disabledHint={safetyDisabledReason}
                  fetcher={() => fetchSafetyAnalysis(mountain.mountain_id, date)}
                />
              </div>

              {/* Trail Reports Section */}
              <TrailReportsSection mountainId={mountain.mountain_id} selectedTrail={selectedTrail} />
            </div>
          </div>
        )}
      </main>

      <footer className="mt-20 bg-white border-t">
        <div className="max-w-7xl mx-auto px-8 py-8 flex flex-col md:flex-row justify-between items-center">
          <div>
            <h3 className="text-2xl font-bold text-primary">TaraPeak</h3>
            <p className="text-gray-500 mt-2">Explore mountains with confidence.</p>
          </div>
          <div className="mt-6 md:mt-0 text-gray-500">© 2026 TaraPeak. All Rights Reserved.</div>
        </div>
      </footer>
    </div>
  );
}