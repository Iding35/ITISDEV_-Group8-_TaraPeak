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

  async function handleDelete(planId: number) {
  const confirmed = window.confirm(
    "Are you sure you want to delete this hiking plan?"
  );

  if (!confirmed) return;

  const previous = plans;
  setPlans((current) => current.filter((p) => p.plan_id !== planId));

  try {
    await deletePlan(planId);
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

        const data = await fetchWaypoints(
          Number(selectedMountain)
        );

        setWaypoints(data);

        if (data.length > 0) {
          setSelectedWaypoint(
            String(data[0].waypoint_id)
          );
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

  function Star({
    index,
  }: {
    index: number;
  }) {
    return (
      <button
        type="button"
        onClick={() => setRating(index)}
        className={`text-3xl transition hover:scale-110 ${
          rating >= index
            ? "text-yellow-400"
            : "text-gray-300"
        }`}
      >
        ★
      </button>
    );
  }

  if (authLoading) return null;

  if (!user)
    return <Navigate to="/login" replace />;
    return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />

      <main className="max-w-7xl mx-auto px-margin-desktop py-lg">

        <div className="mb-10">
          <h1 className="font-display-lg text-display-lg text-primary animated-text leading-tight">
            My Dashboard
          </h1>

          <p className="text-on-surface/70 mt-2">
            Welcome back, {user.first_name}! Ready to start your next adventure?
          </p>
        </div>

        {/* Pending group invitations */}
        {invites.length > 0 && (
          <section className="max-w-3xl mb-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-primary mb-3">
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
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

        {/* Activity alerts */}
        {notifications.length > 0 && (
          <section className="max-w-3xl mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                  notifications
                </span>
                Activity
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </h2>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-sm text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <ul className="flex flex-col gap-2">
              {notifications.map((notification) => (
                <li
                  key={notification.notification_id}
                  className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
                    notification.is_read
                      ? "border-gray-200 bg-white"
                      : "border-primary/30 bg-primary/5"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined text-primary text-[20px] shrink-0"
                  >
                    {NOTIFICATION_ICONS[notification.type] ?? "notifications"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{notification.title}</p>
                      {!notification.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />
                      )}
                      <span className="text-xs text-gray-400">
                        {formatRelative(notification.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{notification.message}</p>
                    {notification.reference_id && (
                      <Link
                        to={`/plans/${notification.reference_id}`}
                        className="mt-1 inline-block text-xs font-semibold text-primary hover:underline"
                      >
                        View plan
                      </Link>
                    )}
                  </div>

                  {!notification.is_read && (
                    <button
                      type="button"
                      onClick={() => handleDismissNotification(notification.notification_id)}
                      aria-label={`Mark "${notification.title}" as read`}
                      className="text-gray-400 hover:text-primary transition-colors p-1"
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                        done
                      </span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )} 
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">

        <div>

        <h2 className="font-headline-md text-headline-md text-primary">
          My Hiking Plans
        </h2>

        <p className="text-sm text-on-surface-variant mt-1">
          View, manage, and share your upcoming hiking adventures.
        </p>

      </div>

      {plans.length > 0 && (
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary font-medium">
          {plans.length} {plans.length === 1 ? "Plan" : "Plans"}
        </span>
      )}

        </div>

          {plans.length === 0 ? (

            <p className="font-body-md text-on-surface-variant">
              You don't have any hiking plans yet.
            </p>

           ) : (
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
                          <div className="relative">

                            <div
                              className="h-48 w-full bg-cover bg-center"
                              style={{
                                backgroundImage: `url('/${plan.image_url}')`,
                              }}
                            />

                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                            <div className="absolute bottom-4 left-4">

                              <h3 className="font-headline-md text-headline-md text-white">
                                {plan.mountain_name}
                              </h3>

                              <p className="text-sm text-white/90">
                                {plan.location}
                              </p>

                            </div>

                          </div>
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
                              <div className="flex items-center gap-2">

                              <span className="material-symbols-outlined text-[18px] text-primary">
                              hiking
                              </span>

                              <p className="text-sm text-primary">
                                {plan.trail_name}
                              </p>

                            </div>
                              <div className="flex items-center gap-2">

                              <span className="material-symbols-outlined text-[18px] text-secondary">
                                calendar_month
                              </span>

                              <p className="font-label-md text-label-md text-secondary">
                                {formatPlanDate(plan.date)}
                              </p>

                            </div>
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
           )}
        </section>

        <div className="max-w-3xl">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">

        {/* Submit Report */}

        <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-6">

          <span className="material-symbols-outlined text-primary text-4xl mb-4">
            edit_note
          </span>

          <h2 className="text-2xl font-semibold text-primary mb-2">
            Submit Report
          </h2>

          <p className="text-sm text-gray-500 mb-6">
            Share trail conditions, weather, hazards and tips for future hikers.
          </p>

          <button
            onClick={() => setShowTrailReport(!showTrailReport)}
            className="rounded-xl bg-primary text-white px-5 py-3 font-semibold hover:opacity-90 transition"
          >
            {showTrailReport ? "Close Form" : "Write Report"}
          </button>

        </div>

        {/* Your Reports */}

        <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-6">

          <span className="material-symbols-outlined text-primary text-4xl mb-4">
            history
          </span>

          <h2 className="text-2xl font-semibold text-primary mb-2">
            Your Reports
          </h2>

          <p className="text-sm text-gray-500">
            View all of the trail reports you've submitted.
          </p>
          
          <div className="mt-8">
          
          <button
              onClick={() => setShowReportsModal(true)}
              className="rounded-xl bg-primary text-white px-5 py-3 font-semibold hover:opacity-90 transition"
            >
              View Reports
            </button>
          </div>
        </div>
        </div>

          {showTrailReport && (

            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-8 mt-5">

          <h2 className="flex items-center gap-2 text-2xl font-semibold text-primary mb-2">
            Trail Report
          </h2>

          <p className="text-sm text-gray-500 mb-4">
            Help other hikers by sharing trail conditions,
            hazards, and your overall experience.
          </p>

          <form
            onSubmit={submitReport}
            className="space-y-6"
          >

            {/* Mountain */}

            <div>
              <label className="block text-sm text-gray-500 mb-2">
                Mountain
              </label>

              <select
                value={selectedMountain}
                onChange={(e) =>
                  setSelectedMountain(e.target.value)
                }
                disabled={loadingMountains}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
              >
                <option value="">
                  Select Mountain
                </option>

                {mountains.map((mountain) => (
                  <option
                    key={mountain.mountain_id}
                    value={mountain.mountain_id}
                  >
                    {mountain.mountain_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Trail */}

            <div>
              <label className="block text-sm text-gray-500 mb-2">
                Trail
              </label>

              <select
                value={selectedWaypoint}
                onChange={(e) =>
                  setSelectedWaypoint(e.target.value)
                }
                disabled={
                  !selectedMountain || loadingTrails
                }
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
              >
                <option value="">
                  Select Trail
                </option>

                {waypoints.map((trail) => (
                  <option
                    key={trail.waypoint_id}
                    value={trail.waypoint_id}
                  >
                    {trail.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Condition */}

            <div>
              <label className="block text-sm text-gray-500 mb-2">
                Trail Condition
              </label>

              <select
                value={condition}
                onChange={(e) =>
                  setCondition(e.target.value)
                }
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
              >
                {CONDITIONS.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {/* Rating */}

            <div>
              <label className="block text-sm text-gray-500 mb-2">
                Rating
              </label>

              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    index={star}
                  />
                ))

                }

                <span className="ml-4 text-gray-500">
                  {rating}/5
                </span>
              </div>
            </div>

            {/* Description */}


            <div>
              <label className="block text-sm text-gray-500 mb-2">
                Your Experience
              </label>

              <textarea
                rows={6}
                value={comment}
                onChange={(e) =>
                  setComment(e.target.value)
                }
                placeholder="Share trail conditions, hazards, weather, scenery, or anything future hikers should know..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>

            {submitStatus === "success" && (
              <p className="text-primary font-semibold text-sm">
                Thanks! Your trail report was submitted.
              </p>
            )}
            {submitStatus === "error" && submitError && (
              <p className="text-red-600 text-sm">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitStatus === "submitting"}
              className="w-full bg-primary hover:opacity-90 transition text-white font-semibold rounded-xl py-4 disabled:opacity-50"
            >
              {submitStatus === "submitting" ? "Submitting…" : "Submit Trail Report"}
            </button>

          </form>

        </div>
          )}
        </div>

        {showReportsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">

          <div className="bg-white rounded-3xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden">

            <div className="flex items-center justify-between border-b p-6">

              <div>
                <h2 className="text-2xl font-semibold text-primary">
                  Your Trail Reports
                </h2>

                <p className="text-sm text-gray-500">
                  {myReports.length} reports submitted
                </p>
              </div>

              <button
                onClick={() => setShowReportsModal(false)}
                className="material-symbols-outlined text-3xl text-gray-500 hover:text-primary"
              >
                close
              </button>

            </div>

            <div className="overflow-y-auto max-h-[65vh] p-6 space-y-5">

              {myReports.length === 0 ? (

                <p className="text-center text-gray-500">
                  No reports yet.
                </p>

              ) : (

                myReports.map((report) => (
                  <div
                    key={report.report_id}
                    className="rounded-2xl border border-gray-200 overflow-hidden"
                  >

                    <img
                      src={report.image_url}
                      alt={report.mountain_name}
                      className="h-48 w-full object-cover"
                    />

                    <div className="p-5">

                      <h3 className="text-xl font-semibold text-primary">
                        {report.mountain_name}
                      </h3>

                      <p className="text-gray-500">
                        {report.trail_name}
                      </p>

                      <div className="flex items-center gap-3 mt-3">

                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <span
                              key={index}
                              className={`material-symbols-outlined text-[20px] ${
                                index < report.rating
                                  ? "text-amber-500"
                                  : "text-gray-300"
                              }`}
                            >
                              star
                            </span>
                          ))}
                        </div>

                        <span className="font-semibold">
                          {report.rating.toFixed(1)}
                        </span>

                        <span className="text-gray-300">•</span>

                        <span className="text-gray-600">
                          {report.condition}
                        </span>

                      </div>

                      <p className="mt-4 text-gray-700">
                        {report.comment}
                      </p>

                      <p className="mt-4 text-sm text-gray-400">
                        {new Date(report.created_at).toLocaleDateString()}
                      </p>

                    </div>

                  </div>
                ))

              )}

            </div>

          </div>

        </div>
        )}

      </main>
    </div>
  );
}
