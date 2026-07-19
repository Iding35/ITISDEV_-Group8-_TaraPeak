import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMountains, type Mountain } from '../api';
import Navbar from '../components/Navbar';

function TrailCard({ mountain }: { mountain: Mountain }) {
  return (
    <Link
      to={`/trail/${mountain.mountain_id}`}
      className="trail-card group relative bg-surface-container-lowest rounded-xl overflow-hidden border border-secondary/20 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer block"
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
          <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">
            arrow_forward
          </span>
        </div>
        <div className="grid grid-cols-2 gap-base pt-2">
          <div className="bg-surface-container-low p-sm rounded-lg">
            <span className="block font-label-sm text-label-sm text-outline uppercase tracking-wider">
              TOTAL HIKERS
            </span>
            <span className="font-headline-md text-headline-md text-primary">{mountain.total_hikers}</span>
          </div>
          <div className="bg-surface-container-low p-sm rounded-lg">
            <span className="block font-label-sm text-label-sm text-outline uppercase tracking-wider">
              DIFFICULTY
            </span>
            <span className="font-headline-md text-headline-md text-secondary">{mountain.difficulty}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Mountains() {
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchMountains(search)
      .then(setMountains)
      .catch((error) => {
        console.error('Error fetching mountains:', error);
        setMountains([]);
      });
  }, [search]);

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />
      <main className="max-w-7xl mx-auto px-margin-desktop py-lg">
        <section className="mb-xl">
          <div className="flex flex-col gap-base">
            <h1 className="font-display-lg text-display-lg text-primary leading-tight">
              Explore the <span className="text-secondary">Ecosystem</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
              Select a trail to begin your biophilic analysis. Each location provides real-time biodiversity
              metrics, soil health tracking, and canopy coverage reports.
            </p>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-gutter mb-lg">
          <div className="relative w-full max-w-md">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
              search
            </span>
            <input
              className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow font-body-md"
              placeholder="Search trails by ecosystem type..."
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {mountains.map((mountain) => (
            <TrailCard key={mountain.mountain_id} mountain={mountain} />
          ))}
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-4 pt-2 bg-surface shadow-[0_-4px_20px_rgba(45,90,39,0.15)] rounded-t-xl">
        <a className="flex flex-col items-center justify-center text-on-surface-variant" href="#">
          <span className="material-symbols-outlined">explore</span>
          <span className="font-label-sm text-label-sm">Explore</span>
        </a>
        <a
          className="flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-full px-6 py-1 transition-all duration-300 scale-90"
          href="#"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            map
          </span>
          <span className="font-label-sm text-label-sm">My Trails</span>
        </a>
        <a className="flex flex-col items-center justify-center text-on-surface-variant" href="#">
          <span className="material-symbols-outlined">query_stats</span>
          <span className="font-label-sm text-label-sm">Analytics</span>
        </a>
        <a className="flex flex-col items-center justify-center text-on-surface-variant" href="#">
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-sm text-label-sm">Profile</span>
        </a>
      </nav>
    </div>
  );
}
