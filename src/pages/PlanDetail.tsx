import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import {
  fetchPlanDetail,
  fetchWaypoints,
  fetchTrailCheckpoints,
  invitePlanMember,
  regeneratePlanGear,
  removePlanMember,
  updatePlan,
  updatePlanNotes,
  type DetailedPlan,
  type Waypoint,
  type TrailCheckpoint,
} from '../api';
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

/** Organizer-only form: invites a member by username or email address. */
function InviteMemberForm({ planId, onInvited }: { planId: number; onInvited: () => void }) {
  const [identifier, setIdentifier] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;

    setStatus('sending');
    setMessage(null);
    try {
      await invitePlanMember(planId, identifier.trim());
      setStatus('sent');
      setMessage(`Invitation sent to ${identifier.trim()} — pending until they accept.`);
      setIdentifier('');
      onInvited();
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Could not send invite');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="invite-identifier" className="text-sm text-on-surface-variant">
        Invite by username or email
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="invite-identifier"
          type="text"
          required
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value);
            setStatus('idle');
            setMessage(null);
          }}
          placeholder="maria.santos or hiker@example.com"
          className="min-w-0 flex-1 rounded-lg border border-secondary/20 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={status === 'sending' || !identifier.trim()}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary disabled:opacity-50"
        >
          {status === 'sending' ? 'Sending…' : 'Send invite'}
        </button>
      </div>
      {message && (
        <p className={`text-xs ${status === 'error' ? 'text-error' : 'text-primary'}`}>{message}</p>
      )}
    </form>
  );
}

/** Organizer-only form: edits date/trail, which the backend syncs to all members. */
function EditPlanForm({
  plan,
  onUpdated,
}: {
  plan: DetailedPlan;
  onUpdated: (syncedCount: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [trails, setTrails] = useState<Waypoint[]>([]);
  const [date, setDate] = useState(plan.date);
  const [waypointId, setWaypointId] = useState(String(plan.waypoint_id));
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetchWaypoints(plan.mountain_id)
      .then(setTrails)
      .catch(() => setTrails([]));
  }, [open, plan.mountain_id]);

  const isDirty = date !== plan.date || waypointId !== String(plan.waypoint_id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirty) return;

    setStatus('saving');
    setError(null);
    try {
      const result = await updatePlan(plan.plan_id, {
        date,
        waypoint_id: Number(waypointId),
      });
      setStatus('idle');
      setOpen(false);
      onUpdated(result.members_synced);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not update plan');
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-secondary/20 px-3 py-1.5 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
          edit_calendar
        </span>
        Edit plan
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-xl border border-secondary/20 bg-surface-container-lowest p-4 flex flex-col gap-3"
    >
      <p className="font-label-md text-label-md text-on-surface-variant">
        Changes sync to every member of this plan immediately.
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-on-surface-variant">Hiking date</span>
        <input
          type="date"
          value={date}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-secondary/20 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-on-surface-variant">Trail</span>
        <select
          value={waypointId}
          onChange={(e) => setWaypointId(e.target.value)}
          className="rounded-lg border border-secondary/20 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        >
          {trails.length === 0 && <option value={waypointId}>{plan.trail_name}</option>}
          {trails.map((t) => (
            <option key={t.waypoint_id} value={t.waypoint_id}>
              {t.name} — {t.difficulty}, {t.distance_from_start_km} km
            </option>
          ))}
        </select>
      </label>

      <p className="text-xs text-on-surface-variant">
        Editing the trail or date clears the saved AI gear list, since it was generated for the
        previous setup.
      </p>

      {error && <p className="text-error text-xs">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!isDirty || status === 'saving'}
          className="rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary disabled:opacity-50"
        >
          {status === 'saving' ? 'Syncing…' : 'Save & sync'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setDate(plan.date);
            setWaypointId(String(plan.waypoint_id));
            setError(null);
          }}
          className="rounded-lg border border-secondary/20 px-4 py-2 font-label-md text-label-md text-on-surface-variant"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<DetailedPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [gearStatus, setGearStatus] = useState<'idle' | 'loading'>('idle');

  const [checkpoints, setCheckpoints] = useState<TrailCheckpoint[]>([]);
  const [notes, setNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  
  function loadPlan(preserveNotes = false) {
    if (!id) return Promise.resolve();
    return fetchPlanDetail(Number(id))
      .then(async (planData) => {
        setPlan(planData);

        if (!preserveNotes) {
          setNotes((planData as any).notes || '');
        }

        try {
          const waypoints = await fetchWaypoints(planData.mountain_id);
          const targetWaypoint = waypoints.find(w => w.waypoint_id === planData.waypoint_id) || waypoints[0];
          
          if (targetWaypoint) {
            const trailCps = await fetchTrailCheckpoints(targetWaypoint.waypoint_id);
            
            // Extract checkpoints specific to this plan if returned by detailed plan, 
            // or filter the trail checkpoints based on the plan's target checkpoint sequence/id.
            const planCheckpoints = (planData as any).checkpoints || [];
            
            if (planCheckpoints.length > 0) {
              setCheckpoints(planCheckpoints);
            } else {
              const selectedCpId = planData.checkpoint_id ? Number(planData.checkpoint_id) : null;
              let targetCp = selectedCpId ? trailCps.find(c => Number(c.checkpoint_id) === selectedCpId) : null;
              
              if (!targetCp && planData.checkpoint_name) {
                targetCp = trailCps.find(c => c.name.toLowerCase() === planData.checkpoint_name.toLowerCase());
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
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Plan not found'));
  }

  useEffect(() => {
    if (!id) return;
    loadPlan(false).finally(() => setIsLoading(false));
  }, [id]);

  async function handleRemoveMember(planMemberId: number) {
    if (!plan) return; 
    
    if (
      !confirm('Are you sure you want to remove this member? Their access will be revoked immediately.')
    )
      return;
    try {
      await removePlanMember(plan.plan_id, planMemberId);
      setPlan((prev) =>
        prev
          ? { ...prev, members: prev.members.filter((m) => m.plan_member_id !== planMemberId) }
          : null
      );
      setBanner('Member removed. Their access to this plan was revoked.');
    } catch {
      setBanner('Could not remove member.');
    }
  }
  async function handleRegenerateGear() {
    if (!plan) return;
    setGearStatus('loading');
    try {
      const result = await regeneratePlanGear(plan.plan_id);
      setPlan((prev) =>
        prev ? { ...prev, gear: result.items, ai_gear_summary: result.summary } : null
      );
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Could not regenerate gear');
    } finally {
      setGearStatus('idle');
    }
  }

  async function handleSaveNotes() {
    if (!plan) return;
    setIsSavingNotes(true);
    setNotesError(null);
    try {
      if (typeof updatePlanNotes === 'function') {
        await updatePlanNotes(plan.plan_id, notes);
      }
      setIsEditingNotes(false);
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setIsSavingNotes(false);
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
            onClick={() => navigate('/dashboard')}
            className="rounded-xl bg-primary px-4 py-2 font-label-md text-on-primary"
          >
            Back to My Plans
          </button>
        </main>
      </div>
    );
  }

  const requiredGear = plan.gear?.filter((g) => g.is_required) ?? [];
  const optionalGear = plan.gear?.filter((g) => !g.is_required) ?? [];

  const selectedCheckpointData = checkpoints.find(cp => cp.checkpoint_id === plan.checkpoint_id);
  const targetDistance = selectedCheckpointData?.distance_from_start_km ?? plan.distance_from_start_km;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />
      <main className="max-w-5xl mx-auto px-margin-desktop py-lg">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1 text-primary text-sm mb-4 hover:underline"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back to Plans
        </button>

        {banner && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary flex items-center justify-between gap-3"
          >
            <span>{banner}</span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              aria-label="Dismiss"
              className="text-primary/70 hover:text-primary"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                close
              </span>
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-secondary/20 bg-surface-container-lowest overflow-hidden shadow-sm">
          <div
            className="h-64 w-full bg-cover bg-center"
            style={{ backgroundImage: `url('/${plan.image_url}')` }}
          />
          <div className="p-xl flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="text-secondary font-label-md uppercase tracking-wider">
                  {plan.location}
                </span>
                <h1 className="font-display-lg text-display-lg text-primary">{plan.mountain_name}</h1>
                <p className="mt-2 text-primary font-semibold">{plan.trail_name}</p>

                {plan.trail_description && (
                  <p className="mt-4 text-on-surface-variant">{plan.trail_description}</p>
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
                <p className="font-headline-sm text-on-surface-variant mt-3">
                  {formatDate(plan.date)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {plan.is_owner ? (
                  <span className="rounded-full bg-primary/10 px-3 py-1 font-label-md text-primary">
                    Organizer
                  </span>
                ) : (
                  <span className="rounded-full bg-secondary/10 px-3 py-1 font-label-md text-secondary">
                    Invited Guest
                  </span>
                )}
              </div>
            </div>

            {plan.is_owner && (
              <EditPlanForm
                plan={plan}
                onUpdated={(synced) => {
                  setBanner(
                    synced > 0
                      ? `Plan updated. ${synced} member${synced === 1 ? '' : 's'} synced and notified.`
                      : 'Plan updated.'
                  );
                  loadPlan(true);
                }}
              />
            )}

            {/* Chosen Trail Checkpoints Section */}
            <section className="border-t border-secondary/10 pt-6">
              <h2 className="font-medium font-headline-md text-primary mb-2"><strong>Chosen Trail: </strong><span className="font-medium">{plan.trail_name}</span></h2>
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

            {/* --- Organizer Notes / Announcements Board --- */}
            <section className="border-t border-secondary/10 pt-6">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-headline-md text-primary">Announcement Board</h2>
                {plan.is_owner && (
                  <button
                    onClick={() => {
                      if (isEditingNotes) {
                        handleSaveNotes();
                      } else {
                        setIsEditingNotes(true);
                      }
                    }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {isEditingNotes ? (isSavingNotes ? 'Saving...' : 'Save Notes') : 'Edit Announcements'}
                  </button>
                )}
              </div>
              <p className="text-xs text-on-surface-variant mb-3">Important updates or reminders posted by the organizer for all members.</p>

              {notesError && <p className="text-error text-xs mb-2">{notesError}</p>}

              {isEditingNotes ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Write announcements for members here..."
                    className="w-full rounded-xl border border-secondary/20 p-3 text-sm outline-none focus:ring-2 focus:ring-primary bg-surface text-on-surface"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setIsEditingNotes(false)}
                      disabled={isSavingNotes}
                      className="rounded-lg bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-highest"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary disabled:opacity-50"
                    >
                      {isSavingNotes ? 'Updating...' : 'Update Board'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50/50 border border-amber-200/60 p-4 rounded-xl text-sm text-amber-900 whitespace-pre-wrap">
                  {notes || 'No announcements posted yet by the organizer.'}
                </div>
              )}
            </section>

            {/* Gear */}
            <section className="border-t border-secondary/10 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h2 className="font-headline-md text-primary">
                  Gear Checklist ({plan.gear?.length ?? 0})
                </h2>
                {plan.is_owner && (
                  <button
                    type="button"
                    onClick={handleRegenerateGear}
                    disabled={gearStatus === 'loading'}
                    className="inline-flex items-center gap-1 rounded-lg border border-secondary/20 px-3 py-1.5 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors disabled:opacity-50"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                      auto_awesome
                    </span>
                    {gearStatus === 'loading'
                      ? 'Generating…'
                      : plan.gear?.length
                      ? 'Regenerate'
                      : 'Generate gear list'}
                  </button>
                )}
              </div>

              {plan.ai_gear_summary && (
                <p className="text-sm leading-relaxed text-on-surface-variant bg-primary/5 border border-primary/15 rounded-xl p-3 mb-3">
                  {plan.ai_gear_summary}
                </p>
              )}

              {plan.gear?.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[...requiredGear, ...optionalGear].map((item) => (
                    <div
                      key={item.gear_id ?? item.gear_name}
                      className="flex gap-3 rounded-xl border border-secondary/20 bg-surface-container-lowest p-3"
                    >
                      <span
                        aria-hidden="true"
                        className="material-symbols-outlined text-primary text-[20px] shrink-0"
                      >
                        {CATEGORY_ICONS[item.category] ?? 'backpack'}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-on-surface text-sm">{item.gear_name}</p>
                          {item.is_required && (
                            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-600">
                              Essential
                            </span>
                          )}
                        </div>
                        {item.reason && (
                          <p className="text-xs text-on-surface-variant mt-0.5">{item.reason}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant">
                  No gear list saved for this plan yet.
                </p>
              )}
            </section>

            {/* Group collaboration */}
            <section className="border-t border-secondary/10 pt-6">
              <h2 className="font-headline-md text-primary mb-3">
                Group Members ({plan.members?.length || 0})
              </h2>

              {plan.is_owner && (
                <div className="mb-4 rounded-xl border border-secondary/20 bg-surface-container-lowest p-4">
                  <InviteMemberForm planId={plan.plan_id} onInvited={() => loadPlan(true)} />
                </div>
              )}

              <div className="border border-secondary/20 rounded-xl overflow-hidden divide-y divide-secondary/10">
                {plan.members?.map((member) => (
                  <div
                    key={member.plan_member_id || member.user_id}
                    className="flex items-center justify-between p-4 bg-surface-container-lowest"
                  >
                    <div>
                      <p className="font-semibold text-on-surface">{member.name}</p>
                      <p className="text-xs text-on-surface-variant">{member.email}</p>
                    </div>

                    <div className="flex items-center gap-3">
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

                      {plan.is_owner && member.role !== 'organizer' && (
                        <button
                          onClick={() => handleRemoveMember(member.plan_member_id)}
                          title="Remove member"
                          aria-label={`Remove ${member.name}`}
                          className="text-on-surface-variant hover:text-error transition-colors p-1"
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                            person_remove
                          </span>
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