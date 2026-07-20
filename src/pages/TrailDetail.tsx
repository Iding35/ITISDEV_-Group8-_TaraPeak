import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  checkWeather,
  createPlan,
  fetchDifficultyAnalysis,
  fetchMountain,
  fetchRouteOptimization,
  fetchSafetyAnalysis,
  fetchWaypoints,
  fetchTrailReports,
  type Mountain,
  type WeatherCheckResponse,
  type Waypoint,
  type TrailReport,
} from '../api';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';


/** Renders **bold** segments and preserves line breaks from AI text responses. */
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

function SavePlanSection({
  mountainId,
  date,
  onDateChange,
  selectedWaypoint,
}: {
  mountainId: number;
  date: string;
  onDateChange: (date: string) => void;
  selectedWaypoint: Waypoint | null;
}) {
  const { user } = useAuth();
  const [weather, setWeather] = useState<WeatherCheckResponse | null>(null);
  const [checkingWeather, setCheckingWeather] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!date || !selectedWaypoint) return;
    let cancelled = false;
    setCheckingWeather(true);
    checkWeather(mountainId, date)
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
  }, [mountainId, date, selectedWaypoint]);

  async function handleSave() {
    setSaveStatus('saving');
    setSaveError(null);
    try {
      await createPlan(mountainId, date);
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Could not save plan');
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="flex items-center gap-2 text-2xl font-semibold text-primary mb-4">
        <span aria-hidden="true" className="material-symbols-outlined">
          bookmark_add
        </span>
        Save a Hiking Plan
      </h2>

      {!selectedWaypoint ? (
        <p className="text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 text-sm">
          ⚠️ Please select an available trail checkpoint above before choosing a date.
        </p>
      ) : (
        <>
          <div className="mb-4 text-sm font-medium text-primary bg-primary/10 p-3 rounded-lg inline-block">
            Selected Checkpoint: <span className="font-bold">{selectedWaypoint.name}</span>
          </div>

          <label className="flex flex-col gap-1 max-w-xs">
            <span className="text-sm font-semibold text-gray-600">Hiking date</span>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                onDateChange(e.target.value);
                setSaveStatus('idle');
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </label>

          <div className="mt-4">
            {checkingWeather && <p className="text-gray-500 text-sm">Checking conditions for this date…</p>}
            {!checkingWeather && weather?.forecast && (
              <div className="flex flex-wrap gap-4 rounded-lg bg-surface-container-low p-4 text-sm">
                <span>🌡️ {weather.forecast.temperature}°C</span>
                <span>💧 {weather.forecast.humidity}% humidity</span>
                <span>💨 {weather.forecast.wind_speed} km/h wind</span>
              </div>
            )}
            {!checkingWeather && weather && !weather.forecast && (
              <p className="text-gray-500 text-sm">No weather forecast available for this date yet.</p>
            )}
          </div>

          <div className="mt-4">
            {!user && (
              <p className="text-gray-600 text-sm">
                <Link to="/login" className="text-primary font-semibold hover:underline">
                  Log in
                </Link>{' '}
                to save this plan.
              </p>
            )}
            {user && saveStatus === 'saved' && (
              <p className="text-primary font-semibold text-sm">
                Plan saved!{' '}
                <Link to="/plans" className="underline">
                  View my plans
                </Link>
              </p>
            )}
            {user && saveStatus !== 'saved' && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saveStatus === 'saving' || !date}
                className="rounded-xl bg-primary px-4 py-2 font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
              >
                {saveStatus === 'saving' ? 'Saving…' : 'Save Plan'}
              </button>
            )}
            {saveError && <p className="text-red-600 text-sm mt-2">{saveError}</p>}
          </div>
        </>
      )}
    </div>
  );
}

function RouteSection({
  mountain,
  selectedWaypoint,
  onSelectWaypoint,
  date,
}: {
  mountain: Mountain;
  selectedWaypoint: Waypoint | null;
  onSelectWaypoint: (wp: Waypoint) => void;
  date: string;
}) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [loadingWaypoints, setLoadingWaypoints] = useState(true);
  const [plan, setPlan] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWaypoints(mountain.mountain_id)
      .then(setWaypoints)
      .catch(() => setWaypoints([]))
      .finally(() => setLoadingWaypoints(false));
  }, [mountain.mountain_id]);

  async function handleOptimize() {
    setLoadingPlan(true);
    setError(null);
    try {
      const result = await fetchRouteOptimization(mountain.mountain_id);
      setPlan(result.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Route optimization failed');
    } finally {
      setLoadingPlan(false);
    }
  }

  const difficultyWeight: Record<string, number> = {
    easy: 1,
    moderate: 2,
    medium: 2,
    hard: 3,
    critical: 4,
  };

  const sortedWaypoints = [...waypoints].sort((a, b) => {
    const diffA = difficultyWeight[a.difficulty?.toLowerCase() || ''] || 99;
    const diffB = difficultyWeight[b.difficulty?.toLowerCase() || ''] || 99;

    if (diffA !== diffB) {
      return diffA - diffB;
    }
    return (a.sequence_order || 0) - (b.sequence_order || 0);
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-primary mb-2">
          <span aria-hidden="true" className="material-symbols-outlined">
            map
          </span>
          Available Trail Checkpoints
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Select a checkpoint below to enable date picking and safety evaluation.
        </p>

        {loadingWaypoints && <p className="text-gray-500 text-sm">Loading trail checkpoints…</p>}

        {!loadingWaypoints && sortedWaypoints.length > 0 && (
          <ol className="flex flex-col gap-3">
            {sortedWaypoints.map((w) => {
              const isSelected = selectedWaypoint?.waypoint_id === w.waypoint_id;
              const difficultyKey = w.difficulty?.toLowerCase();
              let difficultyStyle = "bg-slate-100 text-slate-700 border-slate-200/60";

              if (difficultyKey === "easy") {
                difficultyStyle = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
              } else if (difficultyKey === "moderate" || difficultyKey === "medium") {
                difficultyStyle = "bg-yellow-50 text-yellow-800 border-yellow-200/80";
              } else if (difficultyKey === "hard") {
                difficultyStyle = "bg-orange-50 text-orange-700 border-orange-200/80";
              } else if (difficultyKey === "critical") {
                difficultyStyle = "bg-red-50 text-red-700 border-red-200/80";
              }

              return (
                <li
                  key={w.waypoint_id}
                  onClick={() => onSelectWaypoint(w)}
                  className={`flex gap-3.5 items-start p-4 rounded-xl border cursor-pointer transition-all ${isSelected
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-sm'
                    : 'border-gray-200/80 bg-white hover:border-gray-300 hover:shadow-sm'
                    }`}
                >
                  <input
                    type="radio"
                    name="checkpoint"
                    checked={isSelected}
                    onChange={() => onSelectWaypoint(w)}
                    className="mt-1.5 h-4 w-4 text-primary focus:ring-primary accent-primary"
                  />

                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {w.sequence_order}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-semibold text-slate-900 text-base leading-snug truncate">
                        {w.name}
                      </h4>

                      <div className="flex items-center gap-1.5 text-xs">
                        {w.difficulty && (
                          <span className={`px-2 py-0.5 rounded-md font-medium border capitalize ${difficultyStyle}`}>
                            {w.difficulty}
                          </span>
                        )}

                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium border border-slate-200/60">
                          {w.distance_from_start_km} km • {w.elevation_m}m
                        </span>

                        {w.estimated_time && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium border border-slate-200/60">
                            {w.estimated_time} hrs
                          </span>
                        )}
                      </div>
                    </div>

                    {w.description && (
                      <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                        {w.description}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {!loadingWaypoints && sortedWaypoints.length === 0 && (
          <p className="text-gray-500 text-sm">No trail checkpoint data available for this mountain yet.</p>
        )}
      </div>


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

          {!plan && waypoints.length > 0 && (
            <button
              type="button"
              onClick={handleOptimize}
              disabled={loadingPlan || !selectedWaypoint || !date}
              className="shrink-0 rounded-xl bg-primary px-4 py-2.5 font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
              title={(!selectedWaypoint || !date) ? "Please select a checkpoint and hiking date to generate an AI pacing plan." : undefined}
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

        {(!selectedWaypoint || !date) && !plan && (
          <p className="text-gray-500 text-sm mt-2">
            Please select a checkpoint and hiking date to generate an AI pacing plan.
          </p>
        )}

        {plan && (
          <div className="mt-4 border-t pt-4">
            <AnalysisText text={plan} />
          </div>
        )}
      </div>
    </div>
  );
}

function TrailReportsSection({ mountainId }: { mountainId: number }) {
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

  return (
    <section className="mt-12">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-primary">Trail Reports</h2>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading reports...</p>}

      {!loading && reports.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
          No trail reports recorded yet.
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((report, idx) => (
            <div
              key={report.report_id ?? idx}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">
                    {report.user_name || 'Anonymous Hiker'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {report.created_at
                      ? new Date(report.created_at).toLocaleDateString()
                      : 'Recently'}
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

                <p className="text-gray-700 text-sm leading-relaxed">
                  {report.comment}
                </p>
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
  const [mountain, setMountain] = useState<Mountain | null>(null);
  const [loading, setLoading] = useState(true);
  const [plannedDate, setPlannedDate] = useState('');
  const [selectedWaypoint, setSelectedWaypoint] = useState<Waypoint | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);

    fetchMountain(id)
      .then(setMountain)
      .catch((error) => {
        console.error('Error loading mountain:', error);
        alert('Unable to load mountain details.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="bg-background text-gray-800 min-h-screen">
      <Navbar />

      <main className="max-w-7xl mx-auto px-8 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-8">
          <span className="material-symbols-outlined">arrow_back</span>
          Back to Map
        </Link>

        {mountain && (
          <>
            <img
              src={`/${mountain.image_url}`}
              alt={mountain.mountain_name}
              className="w-full h-[420px] rounded-2xl object-cover shadow-lg"
            />

            <section className="mt-10">
              <h1 className="text-5xl font-bold text-primary">{mountain.mountain_name}</h1>
              <p className="text-xl text-gray-500 mt-3">{mountain.location}</p>
            </section>

            <section className="mt-10">
              <h2 className="text-2xl font-semibold text-primary mb-4">Description</h2>
              <p className="leading-8 text-gray-700">{mountain.description}</p>
            </section>

            <section className="mt-8">

              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <tbody>
                    <tr className="border-b">
                      <td className="font-semibold p-4">Location</td>
                      <td className="p-4">{mountain.location}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="font-semibold p-4">Terrain</td>
                      <td className="p-4">{mountain.terrain}</td>
                    </tr>
                    <tr >
                      <td className="font-semibold p-4">Total Hikers</td>
                      <td className="p-4">{mountain.total_hikers}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>


            <section className="mt-10">
              <SavePlanSection
                mountainId={mountain.mountain_id}
                date={plannedDate}
                onDateChange={setPlannedDate}
                selectedWaypoint={selectedWaypoint}
              />
            </section>

            <section className="mt-10">
              <RouteSection
                mountain={mountain}
                selectedWaypoint={selectedWaypoint}
                onSelectWaypoint={setSelectedWaypoint}
                date={plannedDate}
              />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
              <AIAnalysisCard
                title="AI Difficulty Analysis"
                icon="trending_up"
                buttonLabel="Analyze Difficulty"
                disabled={!selectedWaypoint || !plannedDate}
                disabledHint="Select a checkpoint and hiking date first to run difficulty analysis."
                fetcher={() => fetchDifficultyAnalysis(mountain.mountain_id)}
              />
              <AIAnalysisCard
                title="AI Safety Analysis"
                icon="health_and_safety"
                buttonLabel={plannedDate ? `Analyze Safety for ${plannedDate}` : 'Analyze Safety'}
                disabled={!selectedWaypoint || !plannedDate}
                disabledHint="Select a checkpoint and hiking date first to run safety analysis."
                fetcher={() => fetchSafetyAnalysis(mountain.mountain_id, plannedDate)}
              />
            </section>

            <TrailReportsSection mountainId={mountain.mountain_id} />


          </>
        )}

        {loading && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-800 border-t-transparent" />
              <p className="text-gray-600">Loading trail information...</p>
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