import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import AdminNavbar from '../components/AdminNavbar';
import {
  fetchMountains,
  fetchReportsByTrail,
  fetchReportsByMountain,
  fetchQuarterlyRegistrations,
  fetchHikersByDate,
  fetchPopularityDrivers,
  type Mountain,
  type TrailReportSummary,
  type MountainReportSummary,
  type QuarterlyRegistration,
  type PopularityDriver,
} from '../api';

const CHART_COLORS = {
  darkForest: '#14532D',  
  saddleBrown: '#78350F', 
  mossGreen: '#3F6212',   
  amberEarth: '#B45309', 
  darkOlive: '#365314',  
};

const PIE_COLORS = [
  CHART_COLORS.darkForest,
  CHART_COLORS.saddleBrown,
  CHART_COLORS.mossGreen,
  CHART_COLORS.amberEarth,
  CHART_COLORS.darkOlive,
];

export default function AdminDashboard() {
  const [reportSummaries, setReportSummaries] = useState<TrailReportSummary[]>([]);
  const [mountainReportSummaries, setMountainReportSummaries] = useState<MountainReportSummary[]>([]);
  const [quarterlyData, setQuarterlyData] = useState<QuarterlyRegistration[]>([]);
  const [popularityData, setPopularityData] = useState<PopularityDriver[]>([]);
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [selectedMountain, setSelectedMountain] = useState<number | ''>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [hikerCount, setHikerCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedTrailMountainFilter, setSelectedTrailMountainFilter] = useState<number | ''>('');

  useEffect(() => {
    async function loadData() {
      try {
        const [mts, reports, mountainReports, quarters, popularity] = await Promise.all([
          fetchMountains(),
          fetchReportsByTrail(),
          fetchReportsByMountain(),
          fetchQuarterlyRegistrations(),
          fetchPopularityDrivers(),
        ]);
        setMountains(mts);
        setReportSummaries(reports);
        setMountainReportSummaries(mountainReports);
        setQuarterlyData(quarters);
        setPopularityData(popularity);
        if (mts.length > 0) setSelectedMountain(mts[0].mountain_id);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleTrailMountainFilterChange = (mountainId: number | '') => {
    setSelectedTrailMountainFilter(mountainId);
  };

  const trailReportSummaries = selectedTrailMountainFilter === ''
    ? reportSummaries
    : reportSummaries.filter((item) => item.mountain_id === selectedTrailMountainFilter);
  
  const handleCheckHikers = async () => {
    if (!selectedMountain || !selectedDate) return;
    const data = await fetchHikersByDate(Number(selectedMountain), selectedDate);
    setHikerCount(data.total_hikers);
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="bg-background min-h-screen text-gray-800">
      <div className="print:hidden">
        <AdminNavbar />
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8 print:px-0 print:py-0 print:max-w-none">
        <div className="hidden print:block mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold text-black">Mountain System Analytics Report</h1>
          <p className="text-xs text-stone-500">
            Generated on: {new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 print:hidden">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-1">Analytics & System Usage</h1>
            <p className="text-sm text-gray-500">Visual summaries of mountain usage, registrations, and report density.</p>
          </div>

          <button
            onClick={handleExportPDF}
            className="bg-primary hover:opacity-90 text-white font-semibold py-2 px-4 rounded-lg text-xs whitespace-nowrap transition-colors shadow-sm flex items-center justify-center gap-2 self-start sm:self-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF Report
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-gray-500">Loading charts...</div>
        ) : (
          <div className="space-y-8 print:space-y-6">
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              
              <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between overflow-hidden">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-primary">Quarterly User Growth</h3>
                      <p className="text-xs text-stone-500">New user acquisitions per fiscal quarter</p>
                    </div>
                  </div>

                  {quarterlyData.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 p-3 mb-4 bg-stone-50 border border-stone-100 rounded-lg">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-stone-500 block">Total Growth</span>
                        <span className="text-base font-bold text-stone-900">
                          {quarterlyData.reduce((acc, curr) => acc + curr.total_users, 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-stone-500 block">Avg / Quarter</span>
                        <span className="text-base font-bold text-stone-900">
                          {Math.round(
                            quarterlyData.reduce((acc, curr) => acc + curr.total_users, 0) / quarterlyData.length
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-stone-500 block">Peak Volume</span>
                        <span className="text-base font-bold text-emerald-800">
                          {Math.max(...quarterlyData.map((q) => q.total_users)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={quarterlyData}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F5F5F4" />
                      
                      <XAxis 
                        type="number" 
                        hide={true} 
                        domain={[0, (dataMax: number) => Math.max(dataMax + 1, 2)]} 
                      />
                      <YAxis
                        type="category"
                        dataKey="quarter"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#44403C', fontWeight: 600 }}
                        width={65} 
                      />
                      <Tooltip
                        cursor={{ fill: '#F5F5F4' }}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const val = payload[0].value as number;
                            return (
                              <div className="bg-stone-900 text-white p-2.5 rounded-lg text-xs shadow-lg border border-stone-800">
                                <p className="font-semibold text-stone-300">{label}</p>
                                <p className="font-bold text-emerald-400 text-sm mt-0.5">
                                  {val.toLocaleString()} <span className="text-[10px] font-normal text-stone-400">new users</span>
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="total_users"
                        fill={CHART_COLORS.darkForest}
                        radius={[0, 4, 4, 0]}
                        barSize={16}
                        name="New Users"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

                            <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between overflow-hidden">
                <div>
                  <h3 className="font-bold text-lg text-primary mb-1">Condition Reports Breakdown</h3>
                  <p className="text-xs text-stone-600 mb-2">Proportion of filed reports per mountain.</p>
                </div>
                
                <div className="h-64 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mountainReportSummaries}
                        dataKey="total_reports"
                        nameKey="mountain_name"
                        cx="50%"
                        cy="45%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                      >
                        {mountainReportSummaries.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>

                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #78350F', color: '#000000', fontSize: '12px' }} />
                      <Legend verticalAlign="bottom" align="center" iconType="rect" iconSize={10} wrapperStyle={{ fontSize: '12px', color: '#000000', paddingTop: '12px', fontWeight: 500 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>


            </div>

            <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm print:shadow-none print:border-stone-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-bold text-lg text-primary mb-1">Trail-Specific Report Dissection</h3>
                  <p className="text-xs text-stone-600">Detailed breakdown of condition reports submitted per specific trail/waypoint point.</p>
                </div>
                
                <div className="w-full sm:w-64">
                  <select
                    value={selectedTrailMountainFilter}
                    onChange={(e) => handleTrailMountainFilterChange(e.target.value ? Number(e.target.value) : '')}
                    className="w-full p-2 border border-stone-300 rounded-lg text-xs text-primary font-medium outline-none focus:ring-2 focus:ring-emerald-900 bg-stone-50"
                  >
                    <option value="">All Mountains (Default)</option>
                    {mountains.map((m) => (
                      <option key={m.mountain_id} value={m.mountain_id}>{m.mountain_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100 text-primary font-bold uppercase border-b border-stone-200">
                    <tr>
                      <th className="p-3">Mountain Name</th>
                      <th className="p-3">Trail / Waypoint Point</th>
                      <th className="p-3 text-right">Total Reports</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {trailReportSummaries.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-stone-400">No report data found for this selection.</td>
                      </tr>
                    ) : (
                      trailReportSummaries.map((item, index) => (
                        <tr key={index} className="hover:bg-stone-50">
                          <td className="p-3 font-bold text-emerald-950">{item.mountain_name}</td>
                          <td className="p-3 font-medium text-stone-700">{item.trail_name || 'General Trail'}</td>
                          <td className="p-3 text-right font-bold text-amber-900">{item.total_reports}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm print:shadow-none print:border-stone-300">
              <h3 className="font-bold text-lg text-primary mb-1">Popularity & Diagnostic Summary</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100 text-primary font-bold uppercase border-b border-stone-200">
                    <tr>
                      <th className="p-3">Mountain Name</th>
                      <th className="p-3 text-center">Planned Trips</th>
                      <th className="p-3 text-center">Difficulty</th>
                      <th className="p-3 text-center">Avg Rating</th>
                      <th className="p-3 text-right">Distance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {popularityData.map((item) => (
                      <tr key={item.mountain_name} className="hover:bg-stone-50">
                        <td className="p-3 font-bold text-emerald-950">{item.mountain_name}</td>
                        <td className="p-3 text-center font-bold text-amber-900">{item.total_plans}</td>
                        <td className="p-3 text-center font-medium text-primary">{item.difficulty}</td>
                        <td className="p-3 text-center font-semibold text-amber-800">★ {item.avg_rating || 'N/A'}</td>
                        <td className="p-3 text-right font-medium text-primary">{item.distance} km</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            
            <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm print:shadow-none print:border-stone-300">
              <h3 className="font-bold text-lg text-primary mb-1">Daily Crowdedness Check</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 items-end print:hidden">
                <div>
                  <label className="text-xs font-bold text-primary">Mountain</label>
                  <select
                    value={selectedMountain}
                    onChange={(e) => setSelectedMountain(Number(e.target.value))}
                    className="w-full p-2 border border-stone-300 rounded-lg text-xs mt-1 text-primary font-medium outline-none focus:ring-2 focus:ring-emerald-900"
                  >
                    {mountains.map((m) => (
                      <option key={m.mountain_id} value={m.mountain_id}>{m.mountain_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-primary">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-lg text-xs mt-1 text-primary font-medium outline-none focus:ring-2 focus:ring-emerald-900"
                  />
                </div>
                <button
                  onClick={handleCheckHikers}
                  className="bg-primary hover:opacity-90 text-white font-semibold py-2 px-4 rounded-lg text-xs whitespace-nowrap transition-colors shadow-sm"
                >
                  Query Crowdedness
                </button>
              </div>

              {hikerCount !== null && (
                <div className="mt-4 p-3 bg-stone-100 border border-emerald-900/30 rounded-lg text-xs font-bold text-emerald-950">
                  Estimated Hikers ({selectedDate}): {hikerCount}
                </div>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}