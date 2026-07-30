import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LabelList
} from 'recharts';
import AdminNavbar from '../components/AdminNavbar';
import {
  fetchMountains,
  fetchReportsByTrail,
  fetchReportsByMountain,
  fetchQuarterlyRegistrations,
  fetchPopularityDrivers,
  fetchMostTakenTrails,
  fetchDiagnosticCorrelations,
  type Mountain,
  type TrailReportSummary,
  type MountainReportSummary,
  type QuarterlyRegistration,
  type PopularityDriver,
  type MostTakenTrail,
  type DiagnosticCorrelations,
  type DiagnosticGroupRow,
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

  const [loading, setLoading] = useState(true);
  const [selectedTrailMountainFilter, setSelectedTrailMountainFilter] = useState<number | ''>('');
  const [mostTakenTrails, setMostTakenTrails] = useState<MostTakenTrail[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticCorrelations | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(true);

  // Filter states for the Diagnostic Completion Section matching the filter flow
  const [diagnosticMountainFilter, setDiagnosticMountainFilter] = useState<string>('');
  const [diagnosticTrailFilter] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      try {
        const [mts, reports, mountainReports, quarters, popularity, topTrails] = await Promise.all([
          fetchMountains(),
          fetchReportsByTrail(),
          fetchReportsByMountain(),
          fetchQuarterlyRegistrations(),
          fetchPopularityDrivers(),
          fetchMostTakenTrails(),
        ]);
        setMountains(mts);
        setReportSummaries(reports);
        setMountainReportSummaries(mountainReports);
        setQuarterlyData(quarters);
        setPopularityData(popularity);
        setMostTakenTrails(topTrails);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Fetched separately from the Promise.all batch above: the AI narrative
  // takes longer than the plain SQL-backed charts, and shouldn't delay them.
  useEffect(() => {
    fetchDiagnosticCorrelations()
      .then(setDiagnostics)
      .catch((err) => console.error(err))
      .finally(() => setDiagnosticsLoading(false));
  }, []);

  const handleTrailMountainFilterChange = (mountainId: number | '') => {
    setSelectedTrailMountainFilter(mountainId);
  };

  const trailReportSummaries = selectedTrailMountainFilter === ''
    ? reportSummaries
    : reportSummaries.filter((item) => item.mountain_id === selectedTrailMountainFilter);

  
  
  const availableYears = Array.from(
  new Set(quarterlyData.map((item) => {
    const match = String(item.quarter || '').match(/\d{4}/);
    return match ? match[0] : '';
  }))
).filter(Boolean).sort() as string[];

  const [selectedYearFilter, setSelectedYearFilter] = useState('all');

  const filteredQuarterlyData = quarterlyData.filter((item) => {
    if (selectedYearFilter === 'all') return true;
    return String(item.quarter || '').includes(selectedYearFilter);
  });
  const handleExportPDF = () => {
    window.print();
  };

  // Unique lists for the cascading filters
  const uniqueMountainsFromTrails = Array.from(new Set(mostTakenTrails.map(t => t.mountain_name)));
  
  

  // Final filtered data for chart and display
  const filteredDiagnosticData = mostTakenTrails.filter(item => {
  const matchesMountain =
    !diagnosticMountainFilter ||
    diagnosticMountainFilter === "top5" ||
    diagnosticMountainFilter === "all_mountains"
      ? true
      : item.mountain_name === diagnosticMountainFilter;

  const matchesTrail =
    !diagnosticTrailFilter ||
    item.trail_name === diagnosticTrailFilter;

  return matchesMountain && matchesTrail;
});

  return (
    <div className="bg-background min-h-screen text-gray-800">
      <AdminNavbar />

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
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
      <div>
        <h3 className="font-bold text-lg text-primary">Quarterly User Growth</h3>
        <p className="text-xs text-stone-500">New user acquisitions per fiscal quarter</p>
      </div>

      {/* Year Filter Control */}
      {availableYears.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedYearFilter}
            onChange={(e) => setSelectedYearFilter(e.target.value)}
            className="p-1.5 border border-stone-300 rounded-lg text-xs text-primary font-medium outline-none focus:ring-2 focus:ring-emerald-900 bg-stone-50"
          >
            <option value="all">All Years</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      )}
    </div>

    {filteredQuarterlyData.length > 0 && (
      <div className="grid grid-cols-3 gap-2 p-3 mb-4 bg-stone-50 border border-stone-100 rounded-lg">
        <div>
          <span className="text-[10px] uppercase font-semibold text-stone-500 block">Total Growth</span>
          <span className="text-base font-bold text-stone-900">
            {filteredQuarterlyData.reduce((acc, curr) => acc + curr.total_users, 0).toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-stone-500 block">Avg / Quarter</span>
          <span className="text-base font-bold text-stone-900">
            {Math.round(
              filteredQuarterlyData.reduce((acc, curr) => acc + curr.total_users, 0) / filteredQuarterlyData.length
            ).toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-stone-500 block">Peak Volume</span>
          <span className="text-base font-bold text-emerald-800">
            {Math.max(...filteredQuarterlyData.map((q) => q.total_users)).toLocaleString()}
          </span>
        </div>
      </div>
    )}
  </div>

  <div className="h-80 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={filteredQuarterlyData}
        layout="vertical"
        margin={{ top: 10, right: 50, left: 15, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F5F5F4" />

        <XAxis
          type="number"
          hide={true}
          domain={[0, (dataMax: number) => Math.max(dataMax * 1.2, 2)]}
        />
        <YAxis
          type="category"
          dataKey="quarter"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#44403C', fontWeight: 600 }}
          width={75}
          interval={0}
          tickFormatter={(value) => {
            const clean = String(value || '').trim();
            const match = clean.match(/^([Qq]\d)\D*(\d{4})$/);
            if (match) {
              return `${match[1].toUpperCase()} ${match[2]}`;
            }
            return clean;
          }}
        />
        <Tooltip
          cursor={{ fill: '#F5F5F4' }}
          content={({ active, payload, label }: any) => {
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
          barSize={20}
          name="New Users"
        >
          <LabelList
            dataKey="total_users"
            position="right"
            formatter={(val: any) => Number(val || 0).toLocaleString()}
            style={{ fontSize: '11px', fill: '#44403C', fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
</div>

  <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm flex flex-col">
  <div>
    <h3 className="font-bold text-lg text-primary mb-1">Condition Reports Breakdown</h3>
    <p className="text-xs text-stone-600 mb-2">Proportion of filed reports per mountain.</p>
  </div>

  <div className="h-72 w-full relative flex items-center justify-center bg-white mt-16">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Legend align="center" iconType="rect" iconSize={10} wrapperStyle={{ fontSize: '12px', color: '#000000', paddingTop: '8px', fontWeight: 500 }} />
        <Pie
          data={mountainReportSummaries}
          dataKey="total_reports"
          nameKey="mountain_name"
          cx="50%"
          cy="50%"
          innerRadius={0} 
          outerRadius={75}
          paddingAngle={2}
          label={({ percent, value }) => {
            const p = ((percent ?? 0) * 100).toFixed(0);
            return `${value} (${p}%)`;
          }}
          labelLine={true}
        >
          {mountainReportSummaries.map((_, index) => (
            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>

        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #78350F', color: '#000000', fontSize: '12px' }} />
        
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
                      <th className="p-3 text-center">Accessibility</th>
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
                        <td className="p-3 text-center font-medium text-stone-600">{item.accessibility}</td>
                        <td className="p-3 text-center font-semibold text-amber-800">★ {item.avg_rating || 'N/A'}</td>
                        <td className="p-3 text-right font-medium text-primary">{item.distance} km</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Diagnostic AI: trail-selection frequency vs. categorical attributes */}
            <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm print:shadow-none print:border-stone-300">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-lg text-primary">Diagnostic: Selection Patterns</h3>
                {diagnostics && (
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      diagnostics.source === 'ai'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {diagnostics.source === 'ai' ? 'AI-generated' : 'Rule-based fallback'}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-600 mb-4">
                How often trails are selected for a hike plan, and their average rating, broken
                down by difficulty, terrain, and accessibility.
              </p>

              {diagnosticsLoading && (
                <p className="text-xs text-stone-400 py-4">Analyzing selection patterns…</p>
              )}

              {!diagnosticsLoading && !diagnostics && (
                <p className="text-xs text-stone-400 py-4">Diagnostic analysis unavailable right now.</p>
              )}

              {diagnostics && (
                <>
                  <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line bg-stone-50 border border-stone-100 rounded-lg p-4 mb-5">
                    {diagnostics.narrative}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(
                      [
                        { title: 'By Difficulty', key: 'by_difficulty', label: (row: DiagnosticGroupRow) => row.difficulty },
                        { title: 'By Terrain', key: 'by_terrain', label: (row: DiagnosticGroupRow) => row.terrain },
                        { title: 'By Accessibility', key: 'by_accessibility', label: (row: DiagnosticGroupRow) => row.accessibility },
                      ] as const
                    ).map((col) => (
                      <div key={col.key}>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2">
                          {col.title}
                        </h4>
                        <div className="flex flex-col gap-1.5">
                          {diagnostics[col.key].map((row, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-2 bg-stone-50 border border-stone-100 rounded-lg px-3 py-2 text-xs"
                            >
                              <span className="font-semibold text-emerald-950 truncate">
                                {col.label(row) || 'Unspecified'}
                              </span>
                              <span className="shrink-0 text-stone-500">
                                {row.times_selected} selected
                                {row.avg_rating !== null && (
                                  <span className="ml-1.5 text-amber-800 font-semibold">
                                    ★ {row.avg_rating}
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                          {diagnostics[col.key].length === 0 && (
                            <p className="text-xs text-stone-400">No data.</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

<div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between">
  <div>
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
      <div>
        <h3 className="font-bold text-lg text-primary">Diagnostic Trail Completion Performance</h3>
        <p className="text-xs text-stone-500">
          {diagnosticMountainFilter === 'top5' || !diagnosticMountainFilter
            ? "Showing top 5 most taken trails overall."
            : diagnosticMountainFilter === 'all_mountains'
            ? "Showing all most taken trails across mountains."
            : `Showing most taken trails for ${diagnosticMountainFilter}.`}
        </p>
      </div>

      {/* Mountain Filter Control */}
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
        <select
          value={diagnosticMountainFilter || 'top5'}
          onChange={(e) => setDiagnosticMountainFilter(e.target.value)}
          className="p-2 border border-stone-300 rounded-lg text-xs text-primary font-medium outline-none focus:ring-2 focus:ring-emerald-900 bg-stone-50 w-full md:w-auto"
        >
          <option value="top5">Top 5 Overall</option>
          <option value="all_mountains">All Mountains</option>
          {uniqueMountainsFromTrails.map((mountainName) => (
            <option key={mountainName} value={mountainName}>{mountainName}</option>
          ))}
        </select>
      </div>
    </div>

    {/* Visual Bar Chart Comparison: Top Trails */}
    <div className="h-72 w-full mb-6">
      {(() => {
        const chartData = diagnosticMountainFilter === 'top5' || !diagnosticMountainFilter
          ? filteredDiagnosticData.slice(0, 5)
          : filteredDiagnosticData;

        if (chartData.length === 0) {
          return (
            <div className="h-full flex items-center justify-center text-stone-400 text-xs">
              No data recorded for this mountain configuration.
            </div>
          );
        }

        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F5F5F4" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#44403C' }} />
              <YAxis
                type="category"
                dataKey="trail_name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#14532D', fontWeight: 600 }}
                width={120}
              />
              <Tooltip
                cursor={{ fill: '#F5F5F4' }}
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-stone-900 text-white p-3 rounded-lg text-xs shadow-lg border border-stone-800 space-y-1">
                        <p className="font-bold text-emerald-400">{data.mountain_name}</p>
                        <p className="text-stone-300 font-medium">{data.trail_name}</p>
                        <p className="font-bold text-amber-400 mt-1">{data.total_completed_hikes} completed hikes</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="total_completed_hikes"
                fill={CHART_COLORS.darkForest}
                radius={[0, 4, 4, 0]}
                barSize={18}
                name="Completed Hikes"
              />
            </BarChart>
          </ResponsiveContainer>
        );
      })()}
    </div>
  </div>

  {/* Dynamic Bottom Summary Section */}
  <div className="border-t border-stone-100 pt-4">
    {diagnosticMountainFilter === 'top5' || !diagnosticMountainFilter ? (
      /* Top 5 State (Default) */
      <div>
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold text-xs text-primary uppercase tracking-wider">Top 5 Trails Overall</h4>
          <span className="text-[11px] text-stone-400">Showing top results</span>
        </div>
        <div className="overflow-x-auto max-h-48 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-500 font-semibold uppercase border-b border-stone-100 sticky top-0">
              <tr>
                <th className="p-2.5">Trail</th>
                <th className="p-2.5">Mountain</th>
                <th className="p-2.5 text-right">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredDiagnosticData.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-stone-400">No trails found.</td>
                </tr>
              ) : (
                filteredDiagnosticData.slice(0, 5).map((item, index) => (
                  <tr key={index} className="hover:bg-stone-50">
                    <td className="p-2.5 font-bold text-emerald-950 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-[10px] font-bold">{index + 1}</span>
                      {item.trail_name}
                    </td>
                    <td className="p-2.5 text-stone-600 font-medium">{item.mountain_name}</td>
                    <td className="p-2.5 text-right font-bold text-amber-900">{item.total_completed_hikes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    ) : diagnosticMountainFilter === 'all_mountains' ? (
      /* All Mountains State */
      <div>
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold text-xs text-primary uppercase tracking-wider">All Trails Ranking</h4>
          <span className="text-[11px] text-stone-400">Showing all results</span>
        </div>
        <div className="overflow-x-auto max-h-48 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-500 font-semibold uppercase border-b border-stone-100 sticky top-0">
              <tr>
                <th className="p-2.5">Trail</th>
                <th className="p-2.5">Mountain</th>
                <th className="p-2.5 text-right">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredDiagnosticData.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-stone-400">No trails found.</td>
                </tr>
              ) : (
                filteredDiagnosticData.map((item, index) => (
                  <tr key={index} className="hover:bg-stone-50">
                    <td className="p-2.5 font-bold text-emerald-950 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-[10px] font-bold">{index + 1}</span>
                      {item.trail_name}
                    </td>
                    <td className="p-2.5 text-stone-600 font-medium">{item.mountain_name}</td>
                    <td className="p-2.5 text-right font-bold text-amber-900">{item.total_completed_hikes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    ) : (
      /* Specific Mountain State (All Trails for that mountain, not top 5) */
      <div>
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold text-xs text-primary uppercase tracking-wider">Top Checkpoint of Each Trail ({diagnosticMountainFilter})</h4>
          <span className="text-[11px] text-stone-400">Ranked by frequency</span>
        </div>
        <div className="overflow-x-auto max-h-48 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-500 font-semibold uppercase border-b border-stone-100 sticky top-0">
              <tr>
                <th className="p-2.5">Trail</th>
                <th className="p-2.5">Top Checkpoint</th>
                <th className="p-2.5 text-right">Completed Hikes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredDiagnosticData.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-stone-400">No checkpoint data found for this mountain.</td>
                </tr>
              ) : (
                filteredDiagnosticData.map((item, index) => (
                  <tr key={index} className="hover:bg-stone-50">
                    <td className="p-2.5 font-bold text-emerald-950 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-[10px] font-bold">{index + 1}</span>
                      {item.trail_name}
                    </td>
                    <td className="p-2.5 text-stone-700 font-medium">{item.most_taken_checkpoint || 'N/A'}</td>
                    <td className="p-2.5 text-right font-bold text-amber-900">{item.total_completed_hikes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
</div>
          </div>
        )}
      </main>
    </div>
  );
}