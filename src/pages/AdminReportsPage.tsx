import { useEffect, useState } from 'react';
import AdminNavbar from '../components/AdminNavbar';
import { fetchMountains, fetchTrailReports, type Mountain, type TrailReport } from '../api';

export default function AdminReportsPage() {
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [selectedMountainId, setSelectedMountainId] = useState<number | 'all'>('all');
  const [reports, setReports] = useState<TrailReport[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const data = await fetchMountains();
        setMountains(data);
      } catch (err) {
        console.error('Error loading mountains:', err);
      }
    }
    init();
  }, []);

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      try {
        if (selectedMountainId === 'all') {
          const allReportsPromises = mountains.map((m) => fetchTrailReports(m.mountain_id));
          const allResults = await Promise.all(allReportsPromises);
          const flattened = allResults.flat();
          setReports(flattened);
        } else {
          const data = await fetchTrailReports(selectedMountainId);
          setReports(data);
        }
      } catch (err) {
        console.error('Error loading reports:', err);
      } finally {
        setLoading(false);
      }
    }
    
    if (mountains.length > 0) {
      loadReports();
    }
  }, [selectedMountainId, mountains]);

  // Filter reports by search query and date range
  const filteredReports = reports.filter((report) => {
    const query = searchQuery.toLowerCase().trim();
    
    // Search query check
    const userName = (report.user_name || 'anonymous').toLowerCase();
    const condition = (report.condition || '').toLowerCase();
    const comment = (report.comment || '').toLowerCase();
    const waypoint = (report.waypoint_name || '').toLowerCase();

    const matchesSearch = 
      query === '' ||
      userName.includes(query) ||
      condition.includes(query) ||
      comment.includes(query) ||
      waypoint.includes(query);

    // Date range check
    if (!report.created_at) return matchesSearch;
    
    const reportDate = new Date(report.created_at);
    reportDate.setHours(0, 0, 0, 0);

    let matchesDate = true;
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (reportDate < start) matchesDate = false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (reportDate > end) matchesDate = false;
    }

    return matchesSearch && matchesDate;
  });

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="bg-background min-h-screen text-gray-800">
      <AdminNavbar />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Trail Reports Management</h1>
        <p className="text-sm text-gray-500 mb-6">Inspect, filter, and manage user condition reports submitted per mountain.</p>

        {/* Filters Container */}
        <div className="border-b border-gray-200 mb-6 pb-4 space-y-3">
          
          {/* Mountain Tabs & Search Bar */}
          <div className="flex flex-col lg:flex-row gap-3 justify-between items-center">
            
            {/* Mountain Selection*/}
            <div className="flex gap-2 overflow-x-auto pb-1 w-full lg:w-auto">
              <button
                onClick={() => setSelectedMountainId('all')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedMountainId === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-600 border border-gray-100 hover:bg-slate-50'
                }`}
              >
                All Mountains
              </button>
              {mountains.map((m) => (
                <button
                  key={m.mountain_id}
                  onClick={() => setSelectedMountainId(m.mountain_id)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedMountainId === m.mountain_id
                      ? 'bg-primary text-white'
                      : 'bg-white text-gray-600 border border-gray-100 hover:bg-slate-50'
                  }`}
                >
                  {m.mountain_name}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="w-full lg:w-72 relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by user, condition, comment..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-xs text-slate-800 font-medium placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary shadow-sm transition-all"
              />
            </div>

          </div>

          {/* Date Filters */}
          <div className="flex flex-wrap items-center gap-2 justify-end pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="p-2 bg-white border border-gray-200 rounded-lg text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-primary shadow-sm"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="p-2 bg-white border border-gray-200 rounded-lg text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-primary shadow-sm"
              />
            </div>

            {(startDate || endDate) && (
              <button
                onClick={clearDateFilter}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
              >
                Clear Dates
              </button>
            )}
          </div>

        </div>

        {/* Reports List */}
        {loading ? (
          <div className="text-center py-8 text-xs text-gray-500">Loading trail reports...</div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-gray-100 text-center text-sm text-gray-500">
            No reports found matching your search, date range, or filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredReports.map((report) => (
              <div key={report.report_id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-2 hover:border-gray-200 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold text-primary">{report.waypoint_name || 'General Trail'}</span>
                    <h4 className="font-bold text-slate-900 text-sm">{report.condition}</h4>
                  </div>
                  <span className="text-xs font-bold text-amber-500">★ {report.rating}/5</span>
                </div>
                <p className="text-xs text-gray-600 italic">"{report.comment}"</p>
                <div className="flex justify-between items-center text-[11px] text-gray-400 pt-2 border-t border-gray-50">
                  <span>Submitted by: <strong className="text-slate-700">{report.user_name || 'Anonymous'}</strong></span>
                  <span>{report.created_at ? new Date(report.created_at).toLocaleDateString() : ''}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}