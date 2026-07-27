import { Link, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import {
  acceptPlanInvite,
  createTrailReport,
  declinePlanInvite,
  fetchMountains,
  fetchNotifications,
  fetchPlanInvites,
  fetchWaypoints,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type Mountain,
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
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
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
            Welcome back, {user.first_name}! Share your latest hiking
            experience to help fellow hikers.
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

        <div className="max-w-3xl">

          <button
            onClick={() => setShowTrailReport(!showTrailReport)}
            className="w-full bg-white rounded-3xl shadow-lg border border-gray-200 p-6 flex justify-between items-center hover:shadow-xl transition"
          >

            <div className="text-left">

              <h2 className="flex items-center gap-2 text-2xl font-semibold text-primary mb-2">
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined"
                >
                  edit_note
                </span>
                Submit Trail Report
              </h2>

              <p className="text-sm text-gray-500 mb-4">
                Share your hiking experience with the community.
              </p>

              </div>

            <span className="text-3xl">
              {showTrailReport ? "⌄" : "›"}
            </span>

          </button>

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

      </main>
    </div>
  );
}
