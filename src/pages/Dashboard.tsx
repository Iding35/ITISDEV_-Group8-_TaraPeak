import { Link, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import {
  acceptPlanInvite,
  createTrailReport,
  declinePlanInvite,
  deletePlan,
  fetchMountains,
  fetchNotifications,
  fetchPlanInvites,
  fetchPlans,
  fetchMyTrailReports,
  type MyTrailReport,
  fetchWaypoints,
  invitePlanMember, 
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type Mountain,
  type Plan,
  type PlanInvite,
  type Waypoint,
} from "../api";

const CONDITIONS = [
  "Clear & Well-Marked",
  "Muddy / Slippery",
  "Rocky Terrain",
  "Overgrown Vegetation",
  "Foggy / Low Visibility",
  "Steep Sections",
  "River Crossing",
  "Very Crowded",
  "Dry & Dusty",
];

/** How often the dashboard re-polls for new alerts while the tab is open. */
const NOTIFICATION_POLL_MS = 30_000;

const NOTIFICATION_ICONS: Record<string, string> = {
  invite_received: "person_add",
  invite_accepted: "check_circle",
  invite_declined: "cancel",
  plan_updated: "sync",
  member_removed: "person_remove",
};

function formatPlanDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(timestamp: string): string {
  const then = new Date(timestamp).getTime();
  if (Number.isNaN(then)) return "";

  const diffMinutes = Math.round((Date.now() - then) / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 1440) return `${Math.round(diffMinutes / 60)}h ago`;
  return `${Math.round(diffMinutes / 1440)}d ago`;
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
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 font-label-md text-label-md text-primary transition-colors hover:bg-primary/10"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
          person_add
        </span>
        Invite someone
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 rounded-xl border border-secondary/20 bg-surface-container-low p-3">
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setStatus('idle');
          }}
          placeholder="hiker@example.com"
          className="min-w-0 flex-1 rounded-lg border border-secondary/20 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary transition hover:opacity-90 disabled:opacity-50"
        >
          {status === 'sending' ? 'Sending…' : 'Send'}
        </button>
      </div>
      {status === 'sent' && <p className="text-primary text-xs font-medium">Invite sent — pending until they accept.</p>}
      {status === 'error' && error && <p className="text-error text-xs font-medium">{error}</p>}
    </form>
  );
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();

  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  const [selectedMountain, setSelectedMountain] = useState("");
  const [selectedWaypoint, setSelectedWaypoint] = useState("");

  const [condition, setCondition] = useState(CONDITIONS[0]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const [loadingMountains, setLoadingMountains] = useState(true);
  const [loadingTrails, setLoadingTrails] = useState(false);

  const [showTrailReport, setShowTrailReport] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [myReports, setMyReports] = useState<MyTrailReport[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [invites, setInvites] = useState<PlanInvite[]>([]);
  const [respondingId, setRespondingId] = useState<number | null>(null);

  // Alerts land on login and keep refreshing while the dashboard is open.
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadAlerts() {
      try {
        const [feed, pending] = await Promise.all([fetchNotifications(), fetchPlanInvites()]);
        if (cancelled) return;
        setNotifications(feed.notifications);
        setUnreadCount(feed.unread_count);
        setInvites(pending);
      } catch {
        // A failed poll should not tear down the dashboard.
      }
    }

    loadAlerts();
    const timer = setInterval(loadAlerts, NOTIFICATION_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);

  async function handleAcceptInvite(planMemberId: number) {
    setRespondingId(planMemberId);
    try {
      await acceptPlanInvite(planMemberId);
      setInvites((current) => current.filter((i) => i.plan_member_id !== planMemberId));
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

  async function handleDismissNotification(notificationId: number) {
    setNotifications((current) =>
      current.map((n) => (n.notification_id === notificationId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await markNotificationRead(notificationId);
    } catch {
      // Optimistic update stands; the next poll reconciles.
    }
  }

  async function handleMarkAllRead() {
    setNotifications((current) => current.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      // Same as above.
    }
  }

  useEffect(() => {
    async function loadMountains() {
      try {
        const data = await fetchMountains();
        setMountains(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMountains(false);
      }
    }

    loadMountains();
  }, []);

  function loadPlans() {
    return fetchPlans()
      .then(setPlans)
      .catch(console.error);
  }

  useEffect(() => {
    if (!user) return;

    loadPlans();

    fetchMyTrailReports()
      .then(setMyReports)
      .catch(console.error);
  }, [user]);

  async function handleDelete() {
    if (planToDelete === null) return;

    const previous = plans;

    setPlans((current) =>
      current.filter((p) => p.plan_id !== planToDelete)
    );

    try {
      await deletePlan(planToDelete);
      setShowDeleteModal(false);
      setPlanToDelete(null);
    } catch {
      setPlans(previous);
      alert("Failed to delete hiking plan.");
    }
  }

  useEffect(() => {
    if (!selectedMountain) {
      setWaypoints([]);
      setSelectedWaypoint("");
      return;
    }

    async function loadTrails() {
      try {
        setLoadingTrails(true);
        const data = await fetchWaypoints(Number(selectedMountain));
        setWaypoints(data);

        if (data.length > 0) {
          setSelectedWaypoint(String(data[0].waypoint_id));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingTrails(false);
      }
    }

    loadTrails();
  }, [selectedMountain]);

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedMountain) {
      alert("Please select a mountain.");
      return;
    }

    if (!selectedWaypoint) {
      alert("Please select a trail.");
      return;
    }

    if (rating === 0) {
      alert("Please give a rating.");
      return;
    }

    if (comment.trim().length < 10) {
      alert("Please enter a longer description.");
      return;
    }

    setSubmitStatus("submitting");
    setSubmitError(null);

    try {
      await createTrailReport(Number(selectedMountain), {
        waypoint_id: Number(selectedWaypoint),
        rating,
        condition,
        comment,
      });

      setSubmitStatus("success");
      setRating(0);
      setComment("");
      setCondition(CONDITIONS[0]);
    } catch (err) {
      setSubmitStatus("error");
      setSubmitError(err instanceof Error ? err.message : "Could not submit trail report");
    }
  }

  function Star({ index }: { index: number }) {
    return (
      <button
        type="button"
        onClick={() => setRating(index)}
        className={`text-3xl transition hover:scale-110 ${
          rating >= index ? "text-yellow-400" : "text-secondary/30"
        }`}
      >
        ★
      </button>
    );
  }

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  // Filter logic separating active vs completed hikes based on an is_completed flag or similar indicator if present
  const activePlans = plans.filter((p: any) => !p.is_completed);
  const completedPlans = plans.filter((p: any) => p.is_completed);

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        
        <div className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-secondary/10 pb-6">
          <div>
            <h1 className="font-display-lg text-display-lg text-primary animated-text leading-tight">
            My Dashboard
            </h1>
            <p className="text-on-surface/70 mt-2">
              Welcome back, <span className="font-semibold text-on-surface">{user.first_name}</span>! Ready to start your next adventure?
            </p>
          </div>
        </div>

       
        {invites.length > 0 && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm mb-8">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-900 mb-4">
              <span aria-hidden="true" className="material-symbols-outlined text-[22px]">
                group_add
              </span>
              Pending Invitations ({invites.length})
            </h2>

            <div className="flex flex-col gap-3">
              {invites.map((invite) => (
                <div
                  key={invite.plan_member_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
                >
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">{invite.invited_by_name || "Someone"}</span>{" "}
                    invited you to <span className="font-semibold">{invite.mountain_name}</span> on{" "}
                    {formatPlanDate(invite.date)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAcceptInvite(invite.plan_member_id)}
                      disabled={respondingId === invite.plan_member_id}
                      className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineInvite(invite.plan_member_id)}
                      disabled={respondingId === invite.plan_member_id}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-600 disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Main Content Layout: Left = Hiking Plans (2 cols in 1 row), Right = Activity Feed stacked above Trail Reports */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Side: Hiking Plans (Taking 2 columns width in the 3-col grid) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between mb-2 border-b border-secondary/10 pb-4">
              <div>
                
                  <h2 className="text-3xl font-bold text-primary">
                  My Hiking Plans
                </h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  View, manage, and share your upcoming hiking adventures.
                </p>
              </div>

              {activePlans.length > 0 && (
                <span className="rounded-full bg-primary/10 px-3.5 py-1 text-sm text-primary font-semibold">
                  {activePlans.length} {activePlans.length === 1 ? "Plan" : "Plans"}
                </span>
              )}
            </div>

            {activePlans.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-secondary/30 p-12 text-center bg-surface-container-low">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">hiking</span>
                <p className="font-body-md text-on-surface-variant">
                  You don't have any active hiking plans yet. Create or join one to get started!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activePlans.map((plan) => {
                  const otherMembersFirstNames = plan.members
                    .filter((m) => m.user_id !== user.user_id)
                    .map((m) => (m.name ? m.name.split(' ')[0] : ''))
                    .filter(Boolean);

                  const displayNames = otherMembersFirstNames.slice(0, 3);

                  return (
                    <div
                      key={plan.plan_id}
                      className="group relative flex flex-col justify-between rounded-3xl border border-secondary/20 bg-surface-container-lowest overflow-hidden shadow-sm transition-all hover:shadow-md"
                    >
                      <div>
                        <Link to={`/plans/${plan.plan_id}`} className="block">
                          <div className="relative h-48 w-full bg-cover bg-center" style={{ backgroundImage: `url('/${plan.image_url}')` }}>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                            <div className="absolute bottom-4 left-4 right-4">
                              <h3 className="font-headline-md text-xl font-bold text-white tracking-wide">
                                {plan.mountain_name}
                              </h3>
                              <p className="text-xs text-white/90 flex items-center gap-1 mt-0.5">
                                <span className="material-symbols-outlined text-[14px]">location_on</span>
                                {plan.location}
                              </p>
                            </div>
                          </div>

                          <div className="p-5 flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-primary text-sm flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[18px]">hiking</span>
                                {plan.trail_name}
                              </span>
                              {!plan.is_owner && (
                                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 font-label-md text-[11px] text-primary font-medium">
                                  Shared with you
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-secondary">
                              <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                              <p className="font-label-md text-xs font-medium">
                                {formatPlanDate(plan.date)}
                              </p>
                            </div>

                            {displayNames.length > 0 && (
                              <p className="font-label-md text-xs text-on-surface-variant flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">group</span>
                                With {displayNames.join(', ')}
                                {otherMembersFirstNames.length > 3 ? '...' : ''}
                              </p>
                            )}
                          </div>
                        </Link>

                        {plan.is_owner && (
                          <div className="px-5 pb-4">
                            <InviteForm planId={plan.plan_id} onSent={loadPlans} />
                          </div>
                        )}
                      </div>

                      {plan.is_owner && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setPlanToDelete(plan.plan_id);
                            setShowDeleteModal(true);
                          }}
                          aria-label={`Remove plan for ${plan.mountain_name}`}
                          className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-on-surface-variant shadow-xs transition-colors hover:text-error hover:bg-surface"
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                            delete
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Side Panel: Activity Feed stacked above Trail Reports Panel */}
          <div className="space-y-6">
            
            {/* Activity Feed Panel */}
            <section className="rounded-3xl border border-secondary/20 bg-surface-container-lowest p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
                  <span aria-hidden="true" className="material-symbols-outlined text-[22px]">
                    notifications
                  </span>
                  Activity Feed
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-on-primary">
                      {unreadCount}
                    </span>
                  )}
                </h2>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <p className="text-sm text-on-surface-variant py-4 text-center">No recent activity.</p>
              ) : (
                <ul className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
                  {notifications.map((notification) => (
                    <li
                      key={notification.notification_id}
                      className={`flex items-start gap-3.5 rounded-2xl border p-4 transition-colors ${
                        notification.is_read
                          ? "border-secondary/10 bg-surface"
                          : "border-primary/30 bg-primary/5"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5"
                      >
                        {NOTIFICATION_ICONS[notification.type] ?? "notifications"}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-on-surface text-sm">{notification.title}</p>
                          {!notification.is_read && (
                            <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />
                          )}
                          <span className="text-xs text-on-surface-variant/70 ml-auto">
                            {formatRelative(notification.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-on-surface-variant mt-1">{notification.message}</p>
                        {notification.reference_id && (
                          <Link
                            to={`/plans/${notification.reference_id}`}
                            className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
                          >
                            View plan →
                          </Link>
                        )}
                      </div>

                      {!notification.is_read && (
                        <button
                          type="button"
                          onClick={() => handleDismissNotification(notification.notification_id)}
                          aria-label={`Mark "${notification.title}" as read`}
                          className="text-on-surface-variant/60 hover:text-primary transition-colors p-1 rounded-lg hover:bg-surface-container"
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                            done
                          </span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Trail Reports Panel */}
            <div className="rounded-3xl border border-secondary/20 bg-surface-container-lowest p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-2xl">edit_note</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-primary">Trail Reports</h2>
                    <p className="text-xs text-on-surface-variant">Contribute & check conditions</p>
                  </div>
                </div>
                <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
                  Share real-time trail conditions, weather updates, and hazards, or review your historical submissions to help the community.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTrailReport(true)}
                  className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-on-primary transition hover:opacity-90 flex items-center justify-center gap-2 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[20px]">add_circle</span>
                  Write Report
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportsModal(true)}
                  className="w-full rounded-xl border border-secondary/20 bg-surface px-4 py-3 font-semibold text-on-surface transition hover:bg-surface-container flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">history</span>
                  View My Reports ({myReports.length})
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* Line Divider */}
        <hr className="my-12 border-secondary/20" />

        {/* Completed Hikes Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-3xl font-bold text-primary flex items-center gap-2">
                My Completed Hikes
              </h2>
              <p className="text-sm text-on-surface-variant mt-1">
                A historical log of your successfully completed hiking adventures.
              </p>
            </div>
            {completedPlans.length > 0 && (
              <span className="rounded-full bg-secondary/10 px-3.5 py-1 text-sm text-secondary font-semibold">
                {completedPlans.length} {completedPlans.length === 1 ? "Hike" : "Hikes"}
              </span>
            )}
          </div>

          {completedPlans.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-secondary/30 p-10 text-center bg-surface-container-low">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">landscape</span>
              <p className="font-body-md text-on-surface-variant">
                No completed hikes recorded yet. Once you complete your trips, they will appear here!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {completedPlans.map((plan: any) => {
                const otherMembersFirstNames = (plan.members || [])
                  .filter((m: any) => m.user_id !== user.user_id)
                  .map((m: any) => (m.name ? m.name.split(' ')[0] : ''))
                  .filter(Boolean);

                const displayNames = otherMembersFirstNames.slice(0, 3);

                return (
                  <div
                    key={plan.plan_id}
                    className="group relative flex flex-col justify-between rounded-3xl border border-secondary/20 bg-surface-container-low overflow-hidden shadow-sm transition-all hover:shadow-md"
                  >
                    <Link to={`/plans/completed/${plan.plan_id}`} className="block">
                      <div className="relative h-44 w-full bg-cover bg-center" style={{ backgroundImage: `url('/${plan.image_url}')` }}>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                        <div className="absolute top-3 left-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-3 py-1 text-xs font-semibold text-white shadow-xs">
                            <span className="material-symbols-outlined text-[14px]">check</span>
                            Completed
                          </span>
                        </div>
                        <div className="absolute bottom-4 left-4 right-4">
                          <h3 className="font-headline-md text-xl font-bold text-white tracking-wide">
                            {plan.mountain_name}
                          </h3>
                          <p className="text-xs text-white/90 flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[14px]">location_on</span>
                            {plan.location}
                          </p>
                        </div>
                      </div>

                      <div className="p-5 flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-on-surface-variant text-sm flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[18px]">hiking</span>
                            {plan.trail_name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-secondary">
                          <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                          <p className="font-label-md text-xs font-medium">
                            {formatPlanDate(plan.date)}
                          </p>
                        </div>

                        {displayNames.length > 0 && (
                          <p className="font-label-md text-xs text-on-surface-variant flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">group</span>
                            With {displayNames.join(', ')}
                            {otherMembersFirstNames.length > 3 ? '...' : ''}
                          </p>
                        )}
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </main>

      {/* Trail Report Modal */}
      {showTrailReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-secondary/20 flex flex-col">
            <div className="flex items-center justify-between border-b border-secondary/10 px-6 py-5 bg-surface-container-low">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold text-primary">
                  <span className="material-symbols-outlined">edit_note</span>
                  Submit Trail Report
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Help other hikers by sharing trail conditions and your experience.
                </p>
              </div>
              <button
                onClick={() => setShowTrailReport(false)}
                className="material-symbols-outlined text-2xl text-on-surface-variant hover:text-primary transition"
              >
                close
              </button>
            </div>

            <div className="overflow-y-auto p-6 flex-1">
              <form onSubmit={submitReport} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    Mountain
                  </label>
                  <select
                    value={selectedMountain}
                    onChange={(e) => setSelectedMountain(e.target.value)}
                    disabled={loadingMountains}
                    className="w-full rounded-xl border border-secondary/20 bg-surface px-4 py-3 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                  >
                    <option value="">Select Mountain</option>
                    {mountains.map((mountain) => (
                      <option key={mountain.mountain_id} value={mountain.mountain_id}>
                        {mountain.mountain_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    Trail
                  </label>
                  <select
                    value={selectedWaypoint}
                    onChange={(e) => setSelectedWaypoint(e.target.value)}
                    disabled={!selectedMountain || loadingTrails}
                    className="w-full rounded-xl border border-secondary/20 bg-surface px-4 py-3 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                  >
                    <option value="">Select Trail</option>
                    {waypoints.map((trail) => (
                      <option key={trail.waypoint_id} value={trail.waypoint_id}>
                        {trail.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    Trail Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full rounded-xl border border-secondary/20 bg-surface px-4 py-3 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                  >
                    {CONDITIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    Rating
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} index={star} />
                    ))}
                    <span className="ml-3 text-sm font-semibold text-on-surface-variant">
                      {rating}/5
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    Your Experience
                  </label>
                  <textarea
                    rows={5}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share trail conditions, hazards, weather, scenery..."
                    className="w-full rounded-xl border border-secondary/20 bg-surface px-4 py-3 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition resize-none"
                  />
                </div>

                {submitStatus === "success" && (
                  <p className="text-primary font-semibold text-sm">
                    Thanks! Your trail report was submitted successfully.
                  </p>
                )}
                {submitStatus === "error" && submitError && (
                  <p className="text-error font-semibold text-sm">{submitError}</p>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-secondary/10">
                  <button
                    type="button"
                    onClick={() => setShowTrailReport(false)}
                    className="px-5 py-2.5 rounded-xl border border-secondary/20 bg-surface font-semibold text-on-surface-variant hover:bg-surface-container transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitStatus === "submitting"}
                    className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-semibold hover:opacity-90 transition disabled:opacity-50"
                  >
                    {submitStatus === "submitting" ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* My Reports Modal */}
      {showReportsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-secondary/20 flex flex-col">
            <div className="flex items-center justify-between border-b border-secondary/10 px-6 py-5 bg-surface-container-low">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold text-primary">
                  <span className="material-symbols-outlined">history</span>
                  My Trail Reports ({myReports.length})
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Review the history of trail reports you have submitted.
                </p>
              </div>
              <button
                onClick={() => setShowReportsModal(false)}
                className="material-symbols-outlined text-2xl text-on-surface-variant hover:text-primary transition"
              >
                close
              </button>
            </div>

            <div className="overflow-y-auto p-6 flex-1 space-y-4">
              {myReports.length === 0 ? (
                <p className="text-center text-on-surface-variant py-8">You haven't submitted any trail reports yet.</p>
              ) : (
                myReports.map((rep) => (
                  <div key={rep.report_id} className="rounded-2xl border border-secondary/20 bg-surface-container-low p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-primary">{rep.mountain_name} — {rep.trail_name}</h3>
                      <span className="text-xs text-on-surface-variant">{new Date(rep.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-semibold">{rep.condition}</span>
                      <span className="text-yellow-500 font-bold">{"★".repeat(rep.rating)}{"☆".repeat(5 - rep.rating)}</span>
                    </div>
                    <p className="text-sm text-on-surface">{rep.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Plan Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-secondary/20 p-6 space-y-4">
            <h3 className="text-xl font-semibold text-primary">Delete Hiking Plan?</h3>
            <p className="text-sm text-on-surface-variant">
              Are you sure you want to permanently delete this hiking plan?
            </p>
            <p className="mt-1 text-center text-sm text-red-500">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setPlanToDelete(null);
                }}
                className="px-4 py-2 rounded-xl border border-secondary/20 bg-surface font-semibold text-on-surface-variant hover:bg-surface-container transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-error text-white font-semibold hover:opacity-90 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}