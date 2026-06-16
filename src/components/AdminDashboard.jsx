import React, { useEffect, useState } from 'react';
import { Activity, Users, AlertTriangle, Clock, Map as MapIcon, LogOut } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { requestJson, buildApiUrl } from '../lib/incidentApi';

function heatPointPosition(point, bounds) {
  const lonRange = bounds.maxLon - bounds.minLon || 0.01;
  const latRange = bounds.maxLat - bounds.minLat || 0.01;
  return {
    left: `${Math.min(96, Math.max(4, ((point.lon - bounds.minLon) / lonRange) * 92 + 4))}%`,
    top: `${Math.min(92, Math.max(8, (1 - ((point.lat - bounds.minLat) / latRange)) * 84 + 8))}%`,
  };
}

const AdminDashboard = ({ session, onSignOut }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const result = await requestJson(buildApiUrl('/webhook/system/analytics'));
        if (result && result.status === 'success') {
          setData(result);
        }
      } catch (err) {
        console.error('Failed to fetch analytics', err);
      }
    };
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return <div className="flex h-screen items-center justify-center text-white">Loading Command Center...</div>;
  }

  const chartData = Object.keys(data.type_counts).map(key => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    count: data.type_counts[key]
  }));
  const heatmapPoints = data.heatmap_data || [];
  const latitudes = heatmapPoints.map((point) => point.lat);
  const longitudes = heatmapPoints.map((point) => point.lon);
  const heatBounds = {
    minLat: latitudes.length ? Math.min(...latitudes) - 0.02 : 30.12,
    maxLat: latitudes.length ? Math.max(...latitudes) + 0.02 : 30.29,
    minLon: longitudes.length ? Math.min(...longitudes) - 0.02 : 71.40,
    maxLon: longitudes.length ? Math.max(...longitudes) + 0.02 : 71.56,
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 pb-20 text-slate-200 selection:bg-violet-500/30 font-sans">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-violet-500/20 bg-slate-900/50 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/30">
            <Activity className="h-7 w-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">City Command Center</h1>
            </div>
            <p className="text-sm font-medium text-slate-400">Multan Emergency Operations</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/50 px-5 py-3">
            <div className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-sm font-medium text-slate-300">Live Analytics</span>
          </div>
          <div className="hidden rounded-2xl border border-slate-700 bg-slate-800/50 px-5 py-3 text-sm font-medium text-slate-300 sm:block">
            <span className="uppercase tracking-wider text-slate-500 text-xs mr-2">Signed in as</span>
            {session?.displayName}
          </div>
          <button
            onClick={onSignOut}
            aria-label="Sign out"
            className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Stats Row */}
        <div className="col-span-1 grid grid-cols-1 gap-6 lg:col-span-4 lg:grid-cols-4">
          <div className="rounded-3xl border border-violet-500/20 bg-slate-900/50 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Total Incidents</p>
                <p className="mt-2 text-4xl font-bold text-white">{data.total_incidents}</p>
              </div>
              <div className="rounded-full bg-violet-500/20 p-4">
                <Activity className="h-6 w-6 text-violet-400" />
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-red-500/20 bg-slate-900/50 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Critical Alerts</p>
                <p className="mt-2 text-4xl font-bold text-white">{data.severity_counts.Critical}</p>
              </div>
              <div className="rounded-full bg-red-500/20 p-4">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-blue-500/20 bg-slate-900/50 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Active Units</p>
                <p className="mt-2 text-4xl font-bold text-white">7</p> {/* Hardcoded for demo logic */}
              </div>
              <div className="rounded-full bg-blue-500/20 p-4">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-emerald-500/20 bg-slate-900/50 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Avg Resolution Time</p>
                <p className="mt-2 text-4xl font-bold text-white">{data.avg_resolution_time_minutes}m</p>
              </div>
              <div className="rounded-full bg-emerald-500/20 p-4">
                <Clock className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Heatmap */}
        <div className="relative col-span-1 h-[500px] overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/50 lg:col-span-3">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px)] bg-[size:42px_42px]" />
          <div className="absolute left-[7%] top-[18%] h-5 w-[86%] rotate-[-7deg] rounded-full bg-slate-800" />
          <div className="absolute left-[14%] top-[58%] h-5 w-[78%] rotate-[8deg] rounded-full bg-slate-800" />
          <div className="absolute left-[50%] top-0 h-full w-5 rotate-[12deg] rounded-full bg-slate-800/80" />
          <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-white">
            <MapIcon className="h-4 w-4 text-violet-400" />
            Offline Incident Heatmap
          </div>
          {heatmapPoints.map((point, index) => {
            const position = heatPointPosition(point, heatBounds);
            const size = Math.max(18, Math.min(64, point.intensity * 6));
            return (
              <div
                key={`${point.lat}-${point.lon}-${index}`}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-red-500/60 shadow-[0_0_28px_rgba(239,68,68,0.7)]"
                style={{
                  ...position,
                  width: `${size}px`,
                  height: `${size}px`,
                }}
                title={`Priority ${point.intensity}: ${point.lat}, ${point.lon}`}
              />
            );
          })}
          <div className="absolute bottom-5 left-5 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-xs text-slate-300">
            Larger circles indicate higher-priority incident clusters.
          </div>
        </div>

        {/* Chart */}
        <div className="col-span-1 rounded-3xl border border-slate-700 bg-slate-900/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Incidents by Type</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#8b5cf6' : '#ec4899'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
