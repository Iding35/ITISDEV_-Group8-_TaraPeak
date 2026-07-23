import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { fetchPlanDetail, removePlanMember, type DetailedPlan } from '../api';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<DetailedPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchPlanDetail(Number(id))
      .then(setPlan)
      .catch((err) => setError(err instanceof Error ? err.message : 'Plan not found'))
      .finally(() => setIsLoading(false));
  }, [id]);

  async function handleRemoveMember(planMemberId: number) {
    if (!confirm('Are you sure you want to remove this member? Their access will be revoked immediately.')) return;
    try {
      await removePlanMember(planMemberId);
      setPlan((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.filter((m) => m.plan_member_id !== planMemberId),
            }
          : null
      );
    } catch {
      alert('Could not remove member.');
    }
  }

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface text-on-surface">
        <Navbar />
        <main className="max-w-5xl mx-auto px-margin-desktop py-lg">
          <p className="text-on-surface-variant">Loading plan details...</p>
        </main>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-surface text-on-surface">
        <Navbar />
        <main className="max-w-5xl mx-auto px-margin-desktop py-lg text-center">
          <p className="text-error font-headline-md mb-4">{error || 'Plan not found'}</p>
          <button
            onClick={() => navigate('/plans')}
            className="rounded-xl bg-primary px-4 py-2 font-label-md text-on-primary"
          >
            Back to My Plans
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />
      <main className="max-w-5xl mx-auto px-margin-desktop py-lg">
        <button
          onClick={() => navigate('/plans')}
          className="inline-flex items-center gap-1 text-primary text-sm mb-4 hover:underline"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back to Plans
        </button>

        <div className="rounded-2xl border border-secondary/20 bg-surface-container-lowest overflow-hidden shadow-sm">
          <div
            className="h-64 w-full bg-cover bg-center"
            style={{ backgroundImage: `url('/${plan.image_url}')` }}
          />
          <div className="p-xl flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="text-secondary font-label-md uppercase tracking-wider">{plan.location}</span>
                <h1 className="font-display-lg text-display-lg text-primary">{plan.mountain_name}</h1>
                <p className="mt-2 text-primary font-semibold">
                  {plan.trail_name}
                </p>

                <p className="mt-4 text-on-surface-variant">
                  {plan.description}
                </p>

                <div className="grid grid-cols-2 gap-4 mt-6">
                <p><strong>Difficulty:</strong> {plan.difficulty}</p>
                <p><strong>Estimated Time:</strong> {plan.estimated_time} mins</p>
                <p><strong>Terrain:</strong> {plan.terrain}</p>
                <p><strong>Distance:</strong> {plan.distance_from_start_km} km</p>
            </div>

            <p className="mt-4 text-red-600">
                <strong>Hazards:</strong> {plan.hazards}
            </p>
                <p className="font-headline-sm text-on-surface-variant mt-1">{formatDate(plan.date)}</p>
              </div>
              {plan.is_owner ? (
                <span className="rounded-full bg-primary/10 px-3 py-1 font-label-md text-primary">Organizer</span>
              ) : (
                <span className="rounded-full bg-secondary/10 px-3 py-1 font-label-md text-secondary">Invited Guest</span>
              )}
            </div>

            <section>
              <h2 className="font-headline-md text-primary mb-3">Group Members ({plan.members?.length || 0})</h2>
              <div className="border border-secondary/20 rounded-xl overflow-hidden divide-y divide-secondary/10">
                {plan.members?.map((member) => (
                  <div key={member.plan_member_id || member.user_id} className="flex items-center justify-between p-4 bg-surface-container-lowest">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-on-surface">{member.name}</p>
                      </div>
                      <p className="text-xs text-on-surface-variant">{member.email}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* If the current viewer is the owner and this member is the organizer, skip showing any badge. Otherwise show organizer/status badge. */}
                      {!(plan.is_owner && member.role === 'organizer') && (
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            member.role === 'organizer'
                              ? 'bg-primary/10 text-primary'
                              : member.status === 'accepted'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : member.status === 'declined'
                              ? 'bg-red-500/10 text-red-600'
                              : 'bg-amber-500/10 text-amber-600'
                          }`}
                        >
                          {member.role === 'organizer'
                            ? 'Organizer'
                            : member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                        </span>
                      )}

                      {/* Only show remove button if current user is owner AND target member is not the organizer */}
                      {plan.is_owner && member.role !== 'organizer' && (
                        <button
                          onClick={() => handleRemoveMember(member.plan_member_id)}
                          title="Remove member"
                          className="text-on-surface-variant hover:text-error transition-colors p-1"
                        >
                          <span className="material-symbols-outlined text-[18px]">person_remove</span>
                        </button>
                      )}
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