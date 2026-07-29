import { Link, useParams, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { fetchPlans, fetchPlanDetail, fetchWaypoints, fetchTrailCheckpoints, type DetailedPlan, type TrailCheckpoint } from "../api";

function formatPlanDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function PlanDetailCompleted() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<DetailedPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<TrailCheckpoint[]>([]);

  useEffect(() => {
    async function loadPlan() {
      try {
        const plans = await fetchPlans();
        const foundSummary = plans.find((p) => p.plan_id === Number(id));
        
        if (foundSummary && !foundSummary.is_completed) {
          navigate(`/plans/${id}`, { replace: true });
          return;
        }

        const planData = await fetchPlanDetail(Number(id));
        if (!planData.is_completed) {
          navigate(`/plans/${id}`, { replace: true });
          return;
        }

        setPlan(planData);

        try {
          const waypoints = await fetchWaypoints(planData.mountain_id);
          const targetWaypoint = waypoints.find(w => w.waypoint_id === planData.waypoint_id) || waypoints[0];
          
          if (targetWaypoint) {
            const trailCps = await fetchTrailCheckpoints(targetWaypoint.waypoint_id);
            const planCheckpoints = (planData as any).checkpoints || [];
            
            if (planCheckpoints.length > 0) {
              setCheckpoints(planCheckpoints);
            } else {
              const selectedCpId = planData.checkpoint_id ? Number(planData.checkpoint_id) : null;
              let targetCp = selectedCpId ? trailCps.find(c => Number(c.checkpoint_id) === selectedCpId) : null;
              
              const checkpointName = planData.checkpoint_name;
              if (!targetCp && checkpointName) {
                targetCp = trailCps.find(c => c.name.toLowerCase() === checkpointName.toLowerCase());
              }

              let filteredCps = trailCps;
              if (targetCp && targetCp.sequence_order !== undefined) {
                const targetSeq = targetCp.sequence_order;
                filteredCps = trailCps.filter(cp => (cp.sequence_order ?? 0) <= targetSeq);
              }
              setCheckpoints(filteredCps);
            }
          }
        } catch {
          setCheckpoints([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load completed plan details.");
      } finally {
        setLoading(false);
      }
    }

    if (user && id) {
      loadPlan();
    }
  }, [user, id, navigate]);

  if (authLoading || loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-surface text-on-surface">
        <Navbar />
        <main className="max-w-5xl mx-auto px-margin-desktop py-lg text-center">
          <span className="material-symbols-outlined text-5xl text-error mb-3">error</span>
          <h1 className="text-2xl font-bold text-primary mb-2">Plan Not Found</h1>
          <p className="text-on-surface-variant mb-6">{error || "The requested completed hike could not be retrieved."}</p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Dashboard
          </Link>
        </main>
      </div>
    );
  }

  const selectedCheckpointData = checkpoints.find(cp => cp.checkpoint_id === plan.checkpoint_id);
  const targetDistance = selectedCheckpointData?.distance_from_start_km ?? plan.distance_from_start_km;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />

      <main className="max-w-5xl mx-auto px-margin-desktop py-lg space-y-8">
        
        {/* Back Link */}
        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Dashboard
          </Link>
        </div>

        {/* Hero Card / Details Container */}
        <div className="rounded-2xl border border-secondary/20 bg-surface-container-lowest overflow-hidden shadow-sm">
          <div
            className="relative h-64 md:h-80 w-full bg-cover bg-center"
            style={{ backgroundImage: `url('/${plan.image_url}')` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            
            <div className="absolute top-4 left-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1 text-xs font-semibold text-white shadow-sm">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Completed Hike Log
              </span>
            </div>

            <div className="absolute bottom-6 left-6 right-6">
              <span className="text-white/80 font-label-md uppercase tracking-wider">
                {plan.location}
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-wide mt-1">
                {plan.mountain_name}
              </h1>
              <p className="text-sm text-white/90 flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-[16px]">hiking</span>
                {plan.trail_name}
              </p>
            </div>
          </div>

          <div className="p-xl space-y-6">
            
            {/* Trail Description & Info Grid */}
            <div>
              {plan.trail_description && (
                <p className="text-on-surface-variant mb-6">{plan.trail_description}</p>
              )}

              <div className="grid grid-cols-2 gap-4 mt-6">
                  <p>
                    <strong>Difficulty:</strong> {plan.difficulty}
                  </p>
                  <p>
                    <strong>Estimated Time:</strong> {plan.estimated_time} hrs
                  </p>
                  <p>
                    <strong>Terrain:</strong> {plan.terrain}
                  </p>
                  <p>
                    <strong>Distance:</strong> {targetDistance} km
                  </p>
                </div>
              {plan.hazards && (
                  <p className="mt-4 text-red-600 text-sm">
                    <strong>Hazards:</strong> {plan.hazards}
                  </p>
                )}
            </div>

            {/* Completion Details Banner */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <span className="material-symbols-outlined">task_alt</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Planned Hike Successfully Accomplished</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Completed on {formatPlanDate(plan.completed_at?.slice(0, 10) || plan.date)} 
                    {plan.completion_time && ` • Duration: ${plan.completion_time}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Chosen Trail Checkpoints Section */}
            <section className="border-t border-secondary/10 pt-6">
              <h2 className="font-medium font-headline-md text-primary mb-2">
                <strong>Chosen Trail: </strong><span className="font-medium">{plan.trail_name}</span>
              </h2>
              <p className="text-xs text-on-surface-variant mb-4">Checkpoints from the start point up to your selected target milestone.</p>
              
              {checkpoints.length > 0 ? (
                <div className="relative pl-6 border-l-2 border-primary/30 space-y-4 my-2">
                  {checkpoints.map((cp) => (
                    <div key={cp.checkpoint_id} className="relative">
                      <span className="absolute -left-[31px] bottom-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-4 ring-surface" />
                      <div className="bg-surface-container-low p-3.5 rounded-xl border border-secondary/10">
                        <div className="flex justify-between items-center">
                          <h4 className="font-semibold text-sm text-on-surface">{cp.name}</h4>
                          {cp.distance_from_start_km !== undefined && (
                            <span className="text-xs font-medium text-primary">
                              {cp.distance_from_start_km} km
                            </span>
                          )}
                        </div>
                        {cp.description && <p className="text-xs text-on-surface-variant mt-1">{cp.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant italic">No intermediate checkpoints found for this trail section.</p>
              )}
            </section>

            {/* Participants / Companions */}
            <section className="border-t border-secondary/10 pt-6">
              <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">group</span>
                Hike Participants ({plan.members?.length || 0})
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {plan.members?.map((member) => (
                  <div
                    key={member.user_id || member.plan_member_id}
                    className="flex items-center justify-between rounded-2xl border border-secondary/20 bg-surface p-3.5 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-sm">
                        {member.name ? member.name.charAt(0).toUpperCase() : "H"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{member.name || "Hiker"}</p>
                        <p className="text-xs text-on-surface-variant">{member.email}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>
        </div>

      </main>
    </div>
  );
}