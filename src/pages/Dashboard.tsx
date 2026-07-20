import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";    
import { useAuth } from "../context/AuthContext";
import {
  fetchMountains,
  fetchWaypoints,
  type Mountain,
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

  function submitReport(e: React.FormEvent) {
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

    // TODO:
    // await createTrailReport(...)

    alert("Trail report submitted!");

    setRating(0);
    setComment("");
    setCondition(CONDITIONS[0]);
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
          <h1 className="font-display-lg text-display-lg text-primary leading-tight">
            My Trails
          </h1>

          <p className="text-on-surface/70 mt-2">
            Welcome back, {user.first_name}! Share your latest hiking
            experience to help fellow hikers.
          </p>
        </div>

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

            <button
              type="submit"
              className="w-full bg-primary hover:opacity-90 transition text-white font-semibold rounded-xl py-4"
            >
              Submit Trail Report
            </button>

          </form>

        </div>
          )}
        </div>

      </main>
    </div>
  );
}
