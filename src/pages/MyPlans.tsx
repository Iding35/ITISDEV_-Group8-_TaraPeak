import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  acceptPlanInvite,
  declinePlanInvite,
  deletePlan,
  fetchPlanInvites,
  fetchPlans,
  invitePlanMember,
  type Plan,
  type PlanInvite,
} from '../api';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function InviteForm({ planId, onSent }: { planId: number; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    try {
      await invitePlanMember(planId, email);
      setStatus('sent');
      setEmail('');
      onSent();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not send invite');
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:underline"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
          person_add
        </span>
        Invite someone
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setStatus('idle');
          }}
          placeholder="hiker@example.com"
          className="min-w-0 flex-1 rounded-lg border border-secondary/20 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 font-label-md text-label-md text-on-primary disabled:opacity-50"
        >
          {status === 'sending' ? 'Sending…' : 'Send'}
        </button>
      </div>
      {status === 'sent' && <p className="text-primary text-xs">Invite sent — pending until they accept.</p>}
      {status === 'error' && error && <p className="text-error text-xs">{error}</p>}
    </form>
  );
}

export default function MyPlans() {
  const { user, loading: authLoading } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [invites, setInvites] = useState<PlanInvite[]>([]);
  const [respondingId, setRespondingId] = useState<number | null>(null);

  function loadPlans() {
    return fetchPlans()
      .then(setPlans)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load plans'));
  }

  function loadInvites() {
    return fetchPlanInvites()
      .then(setInvites)
      .catch(() => setInvites([]));
  }

  useEffect(() => {
    if (!user) return;
    Promise.all([loadPlans(), loadInvites()]).finally(() => setIsLoading(false));
  }, [user]);

  async function handleDelete(planId: number) {
    const previous = plans;
    setPlans((current) => current.filter((p) => p.plan_id !== planId));
    try {
      await deletePlan(planId);
    } catch {
      setPlans(previous);
    }
  }

  async function handleAcceptInvite(planMemberId: number) {
    setRespondingId(planMemberId);
    try {
      await acceptPlanInvite(planMemberId);
      setInvites((current) => current.filter((i) => i.plan_member_id !== planMemberId));
      await loadPlans();
    } finally {
      setRespondingId(null);
    }
  }

  async function handleDeclineInvite(planMemberId: number) {
    setRespondingId(planMemberId);
    try {
      await declinePlanInvite(planMemberId);
      setInvites((current) => current.filter((i) => i.plan_member_id !== planMemberId));
    } finally {
      setRespondingId(null);
    }
  }

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />
      <main className="max-w-7xl mx-auto px-margin-desktop py-lg">
        <h1 className="font-display-lg text-display-lg text-primary animated-text leading-tight mb-lg">My Saved Trails</h1>

        {invites.length > 0 && (
          <section className="mb-xl">
            <h2 className="font-headline-md text-headline-md text-primary mb-3">
              Plan Invitations ({invites.length})
            </h2>
            <div className="flex flex-col gap-3">
              {invites.map((invite) => (
                <div
                  key={invite.plan_member_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-secondary/20 bg-surface-container-lowest p-4"
                >
                  <div>
                    <p className="font-label-md text-label-md text-on-surface">
                      <span className="font-semibold">{invite.invited_by_name || 'Someone'}</span> invited you to{' '}
                      <span className="font-semibold">{invite.mountain_name}</span> on {formatDate(invite.date)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAcceptInvite(invite.plan_member_id)}
                      disabled={respondingId === invite.plan_member_id}
                      className="rounded-lg bg-primary px-3 py-1.5 font-label-md text-label-md text-on-primary disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineInvite(invite.plan_member_id)}
                      disabled={respondingId === invite.plan_member_id}
                      className="rounded-lg border border-secondary/20 px-3 py-1.5 font-label-md text-label-md text-on-surface-variant disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {isLoading && <p className="text-on-surface-variant">Loading your plans…</p>}
        {error && <p className="text-error">{error}</p>}

        {!isLoading && !error && plans.length === 0 && (
          <div className="flex flex-col items-center gap-base py-xl text-center">
            <span aria-hidden="true" className="material-symbols-outlined text-5xl text-outline">
              event_upcoming
            </span>
            <p className="font-headline-md text-headline-md text-primary">No hiking plans yet</p>
            <p className="font-body-md text-on-surface-variant max-w-sm">
              Pick a trail and save a plan with your hiking date to see it here.
            </p>
            <Link
              to="/"
              className="mt-2 rounded-xl bg-primary px-md py-2 font-label-md text-label-md text-on-primary transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              Explore trails
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {plans.map((plan) => {
            // Filter out the currently logged-in user so we only show other members/organizer
            const otherMembersFirstNames = plan.members
              .filter((m) => m.user_id !== user.user_id)
              .map((m) => (m.name ? m.name.split(' ')[0] : ''))
              .filter(Boolean);

         
            const displayNames = otherMembersFirstNames.slice(0, 3);

            return (
              <div
                key={plan.plan_id}
                className="relative rounded-xl border border-secondary/20 bg-surface-container-lowest overflow-hidden shadow-sm"
              >
                <Link to={`/plans/${plan.plan_id}`} className="block">
                  <div
                    className="h-40 w-full bg-cover bg-center"
                    style={{ backgroundImage: `url('/${plan.image_url}')` }}
                  />
                  <div className="p-md flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-headline-md text-headline-md text-primary">{plan.mountain_name}</h3>
                      {!plan.is_owner && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-label-md text-[11px] text-primary">
                          Shared with you
                        </span>
                      )}
                    </div>
                    <p className="font-label-md text-label-md text-on-surface-variant">{plan.location}</p>
                    <p className="font-label-md text-label-md text-secondary mt-1">{formatDate(plan.date)}</p>
                    {displayNames.length > 0 && (
                      <p className="font-label-md text-label-md text-on-surface-variant mt-1">
                        With {displayNames.join(', ')}
                        {otherMembersFirstNames.length > 3 ? '...' : ''}
                      </p>
                    )}
                  </div>
                </Link>

                {plan.is_owner && (
                  <div className="px-md pb-md">
                    <InviteForm planId={plan.plan_id} onSent={loadPlans} />
                  </div>
                )}

                {plan.is_owner && (
                  <button
                    type="button"
                    onClick={() => handleDelete(plan.plan_id)}
                    aria-label={`Remove plan for ${plan.mountain_name}`}
                    className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-on-surface-variant transition-colors hover:text-error"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                      delete
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}