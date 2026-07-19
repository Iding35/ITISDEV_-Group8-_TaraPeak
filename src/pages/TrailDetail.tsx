import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchMountain, type Mountain } from '../api';
import Navbar from '../components/Navbar';

export default function TrailDetail() {
  const { id } = useParams<{ id: string }>();
  const [mountain, setMountain] = useState<Mountain | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    setLoading(true);

    fetchMountain(id)
      .then(setMountain)
      .catch((error) => {
        console.error('Error loading mountain:', error);
        alert('Unable to load mountain details.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="bg-background text-gray-800 min-h-screen">
      <Navbar />

      <main className="max-w-7xl mx-auto px-8 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-8">
          <span className="material-symbols-outlined">arrow_back</span>
          Back to Map
        </Link>

        {mountain && (
          <>
            <img
              src={`/${mountain.image_url}`}
              alt={mountain.mountain_name}
              className="w-full h-[420px] rounded-2xl object-cover shadow-lg"
            />

            <section className="mt-10">
              <h1 className="text-5xl font-bold text-primary">{mountain.mountain_name}</h1>
              <p className="text-xl text-gray-500 mt-3">{mountain.location}</p>
            </section>

            <section className="mt-10">
              <h2 className="text-2xl font-semibold text-primary mb-4">Description</h2>
              <p className="leading-8 text-gray-700">{mountain.description}</p>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <p className="text-sm uppercase tracking-wider text-gray-500">Difficulty</p>
                <h3 className="text-3xl font-bold text-primary mt-3">{mountain.difficulty}</h3>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <p className="text-sm uppercase tracking-wider text-gray-500">Distance</p>
                <h3 className="text-3xl font-bold text-primary mt-3">{mountain.distance} km</h3>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <p className="text-sm uppercase tracking-wider text-gray-500">Estimated Time</p>
                <h3 className="text-3xl font-bold text-primary mt-3">{mountain.estimated_time} hrs</h3>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <p className="text-sm uppercase tracking-wider text-gray-500">Total Hikers</p>
                <h3 className="text-3xl font-bold text-primary mt-3">{mountain.total_hikers}</h3>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-2xl font-semibold text-primary mb-4">Terrain</h2>
                <p className="leading-8 text-gray-700">{mountain.terrain}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-2xl font-semibold text-primary mb-4">Hazards</h2>
                <p className="leading-8 text-gray-700">{mountain.hazards}</p>
              </div>
            </section>

            <section className="mt-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-primary">Trail Reports</h2>
              </div>
              <div className="space-y-4">
                <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
                  No trail reports available.
                </div>
              </div>
            </section>

            <section className="mt-12">
              <h2 className="text-3xl font-bold text-primary mb-6">Mountain Information</h2>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <tbody>
                    <tr className="border-b">
                      <td className="font-semibold p-4 w-1/3">Mountain Name</td>
                      <td className="p-4">{mountain.mountain_name}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="font-semibold p-4">Location</td>
                      <td className="p-4">{mountain.location}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="font-semibold p-4">Difficulty</td>
                      <td className="p-4">{mountain.difficulty}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="font-semibold p-4">Distance</td>
                      <td className="p-4">{mountain.distance} km</td>
                    </tr>
                    <tr className="border-b">
                      <td className="font-semibold p-4">Estimated Time</td>
                      <td className="p-4">{mountain.estimated_time} hrs</td>
                    </tr>
                    <tr>
                      <td className="font-semibold p-4">Total Hikers</td>
                      <td className="p-4">{mountain.total_hikers}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {loading && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-800 border-t-transparent" />
              <p className="text-gray-600">Loading trail information...</p>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-20 bg-white border-t">
        <div className="max-w-7xl mx-auto px-8 py-8 flex flex-col md:flex-row justify-between items-center">
          <div>
            <h3 className="text-2xl font-bold text-primary">TaraPeak</h3>
            <p className="text-gray-500 mt-2">Explore mountains with confidence.</p>
          </div>
          <div className="mt-6 md:mt-0 text-gray-500">© 2026 TaraPeak. All Rights Reserved.</div>
        </div>
      </footer>
    </div>
  );
}
