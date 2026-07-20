import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMountains, type Mountain } from '../api';
import Navbar from '../components/Navbar';

const SEARCH_DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

function TrailCard({ mountain, index }: { mountain: Mountain; index: number }) {
  return (
    <Link
      to={`/trail/${mountain.mountain_id}`}
      className="trail-card trail-card-enter group relative block rounded-xl border border-secondary/20 bg-surface-container-lowest overflow-hidden shadow-sm outline-none transition-[box-shadow,transform] duration-200 ease-out hover:shadow-lg active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      <div className="h-64 overflow-hidden relative">
        <div
          className="trail-image w-full h-full bg-cover bg-center transition-transform duration-500"
          style={{ backgroundImage: `url('/${mountain.image_url}')` }}
        />
      </div>
      <div className="p-md flex flex-col gap-sm">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-headline-md text-headline-md text-primary">{mountain.mountain_name}</h3>
            <p className="font-label-md text-label-md text-on-surface-variant">{mountain.location}</p>
          </div>
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-outline transition-colors group-hover:text-primary"
          >
            arrow_forward
          </span>
        </div>
        <div className="grid grid-cols-2 gap-base pt-2">
          <div className="bg-surface-container-low p-sm rounded-lg">
            <span className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              TOTAL HIKERS
            </span>
            <span className="font-headline-md text-headline-md text-primary">{mountain.total_hikers}</span>
          </div>
          <div className="bg-surface-container-low p-sm rounded-lg">
            <span className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              TERRAIN
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant">{mountain.terrain}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function TrailCardSkeleton() {
  return (
    <div className="rounded-xl border border-secondary/20 bg-surface-container-lowest overflow-hidden shadow-sm">
      <div className="skeleton h-64 bg-surface-container-low" />
      <div className="p-md flex flex-col gap-sm">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-6 w-2/3 rounded bg-surface-container-low" />
          <div className="skeleton h-4 w-1/2 rounded bg-surface-container-low" />
        </div>
        <div className="grid grid-cols-2 gap-base pt-2">
          <div className="skeleton h-14 rounded-lg bg-surface-container-low" />
          <div className="skeleton h-14 rounded-lg bg-surface-container-low" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ search, onClear }: { search: string; onClear: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center gap-base py-xl text-center">
      <span aria-hidden="true" className="material-symbols-outlined text-5xl text-outline">
        travel_explore
      </span>
      <p className="font-headline-md text-headline-md text-primary">No trails match "{search}"</p>
      <p className="font-body-md text-on-surface-variant max-w-sm">
        Try a different location or ecosystem type, or clear your search to see every trail.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-2 rounded-xl bg-primary px-md py-2 font-label-md text-label-md text-on-primary transition-transform duration-150 ease-out active:scale-[0.97]"
      >
        Clear search
      </button>
    </div>
  );
}

export default function Mountains() {
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetchMountains(debouncedSearch)
      .then((results) => {
        if (!cancelled) setMountains(results);
      })
      .catch((error) => {
        console.error('Error fetching mountains:', error);
        if (!cancelled) setMountains([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />
      <main className="max-w-7xl mx-auto px-margin-desktop pt-lg pb-32 md:pb-lg">
        <section className="mb-8">
          <div className="flex flex-col gap-base">
            <h1 className="font-display-lg text-display-lg text-primary animated-text leading-tight">
              Where are you hiking next?
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-none">
              Explore Benguet's mountains with detailed trail information, including difficulty, elevation, terrain, and potential hazards.
            </p>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-gutter mb-lg">
          <div className="relative w-full max-w-md">
            <span
              aria-hidden="true"
              className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline"
            >
              search
            </span>
            <input
              className="w-full pl-12 pr-12 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow font-body-md"
              placeholder="Search mountain by name..."
              aria-label="Search trails"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-outline transition-colors hover:text-primary"
              >
                <span aria-hidden="true" className="material-symbols-outlined">
                  close
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <TrailCardSkeleton key={i} />)
          ) : mountains.length === 0 ? (
            <EmptyState search={search} onClear={() => setSearch('')} />
          ) : (
            mountains.map((mountain, index) => (
              <TrailCard key={mountain.mountain_id} mountain={mountain} index={index} />
            ))
          )}
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-4 pt-2 bg-surface shadow-[0_-4px_20px_rgba(45,90,39,0.15)] rounded-t-xl">
        <Link
          to="/"
          className="flex min-h-11 min-w-11 flex-col items-center justify-center rounded-full bg-secondary-container px-6 py-2 text-on-secondary-container transition-all duration-300"
        >
          <span aria-hidden="true" className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            explore
          </span>
          <span className="font-label-sm text-label-sm">Explore</span>
        </Link>
        <Link
          to="/plans"
          className="flex min-h-11 min-w-11 flex-col items-center justify-center py-2 text-on-surface-variant transition-colors hover:text-primary"
        >
          <span aria-hidden="true" className="material-symbols-outlined">
            map
          </span>
          <span className="font-label-sm text-label-sm">My Trails</span>
        </Link>
        <span
          aria-disabled="true"
          className="flex min-h-11 min-w-11 flex-col items-center justify-center py-2 text-on-surface-variant/40 cursor-not-allowed"
        >
          <span aria-hidden="true" className="material-symbols-outlined">
            query_stats
          </span>
          <span className="font-label-sm text-label-sm">Analytics</span>
        </span>
        <span
          aria-disabled="true"
          className="flex min-h-11 min-w-11 flex-col items-center justify-center py-2 text-on-surface-variant/40 cursor-not-allowed"
        >
          <span aria-hidden="true" className="material-symbols-outlined">
            person
          </span>
          <span className="font-label-sm text-label-sm">Profile</span>
        </span>
      </nav>
    </div>
  );
}
