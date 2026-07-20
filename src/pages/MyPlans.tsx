import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { deletePlan, fetchPlans, type Plan } from '../api';
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

export default function MyPlans() {
  const { user, loading: authLoading } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchPlans()
      .then(setPlans)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load plans'))
      .finally(() => setIsLoading(false));
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

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />
      <main className="max-w-7xl mx-auto px-margin-desktop py-lg">
        <h1 className="font-display-lg text-display-lg text-primary leading-tight mb-lg">My Trails</h1>

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
          {plans.map((plan) => (
            <div
              key={plan.plan_id}
              className="relative rounded-xl border border-secondary/20 bg-surface-container-lowest overflow-hidden shadow-sm"
            >
              <Link to={`/trail/${plan.mountain_id}`} className="block">
                <div
                  className="h-40 w-full bg-cover bg-center"
                  style={{ backgroundImage: `url('/${plan.image_url}')` }}
                />
                <div className="p-md flex flex-col gap-1">
                  <h3 className="font-headline-md text-headline-md text-primary">{plan.mountain_name}</h3>
                  <p className="font-label-md text-label-md text-on-surface-variant">{plan.location}</p>
                  <p className="font-label-md text-label-md text-secondary mt-1">{formatDate(plan.date)}</p>
                </div>
              </Link>
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
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
