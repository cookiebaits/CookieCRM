import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import { Clock, ShieldAlert, DollarSign, TrendingUp, Users, RefreshCw } from 'lucide-react';
import { api } from '../api.ts';
import type { MonthlyDataPoint, AnalyticsSummary } from '../types.ts';

interface AnalyticsDashboardProps {
  onRefreshTrigger?: number;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ onRefreshTrigger }) => {
  const [monthlyData, setMonthlyData] = useState<MonthlyDataPoint[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [viewMetric, setViewMetric] = useState<'hours' | 'calls'>('hours');
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.getMonthlyAnalytics();
      setMonthlyData(res.monthlyData);
      setSummary(res.summary);
    } catch (err) {
      console.error('Fetch analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [onRefreshTrigger]);

  const totalMonthlyHours = monthlyData.reduce((sum, m) => sum + m.hours, 0);
  const totalMonthlySavings = monthlyData.reduce((sum, m) => sum + m.estimatedSavings, 0);

  return (
    <div className="space-y-6">
      {/* Top Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Dynamic Baiting Time */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Today&apos;s Active Time
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-extrabold text-emerald-400">
              {summary?.todayTotalMinutes || 0}{' '}
              <span className="text-sm font-medium text-slate-400">mins</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Across {summary?.todayCallsCount || 0} calls today
            </p>
          </div>
        </div>

        {/* Card 2: Total Wasted Time across all scammers */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Time Wasted
            </span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-extrabold text-slate-100">
              {summary?.totalWastedHours || 0}{' '}
              <span className="text-sm font-medium text-slate-400">hrs</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {summary?.totalWastedMinutes || 0} total minutes on call
            </p>
          </div>
        </div>

        {/* Card 3: Estimated Losses Prevented */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Estimated Loss Prevented
            </span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-extrabold text-amber-400">
              ${totalMonthlySavings.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Based on scambaiter time diversion
            </p>
          </div>
        </div>

        {/* Card 4: Flagged Fraud Accounts */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Fraud Accounts Flagged
            </span>
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-extrabold text-purple-400">
              {summary?.totalFraudAccounts || 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Mule bank accounts & crypto wallets
            </p>
          </div>
        </div>
      </div>

      {/* Main Chart Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Monthly Scammer Baiting Time Visualization
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cumulative efficiency and scambaiter operational hours wasted monthly across all targets
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setViewMetric('hours')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  viewMetric === 'hours'
                    ? 'bg-rose-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Hours Wasted
              </button>
              <button
                type="button"
                onClick={() => setViewMetric('calls')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  viewMetric === 'calls'
                    ? 'bg-rose-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Call Volume
              </button>
            </div>

            <button
              type="button"
              onClick={fetchAnalytics}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white transition"
              title="Refresh statistics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {viewMetric === 'hours' ? (
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} unit="h" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                  }}
                  formatter={(value: any) => [`${value} hours`, 'Baiting Time']}
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorHours)"
                />
              </AreaChart>
            ) : (
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [`${value} calls`, 'Total Interactions']}
                />
                <Bar dataKey="callsCount" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Pipeline Distribution Bar */}
        {summary && (
          <div className="mt-8 pt-6 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Active Scammer Pipeline Distribution
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-amber-500/20">
                <span className="text-xs text-amber-400 font-semibold block">New Scammers</span>
                <span className="text-2xl font-bold text-slate-100">
                  {summary.pipelineCounts['New Scammer'] || 0}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-emerald-500/20">
                <span className="text-xs text-emerald-400 font-semibold block">Actively Baiting</span>
                <span className="text-2xl font-bold text-slate-100">
                  {summary.pipelineCounts['Actively baiting'] || 0}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-purple-500/20">
                <span className="text-xs text-purple-400 font-semibold block">Payment Pending</span>
                <span className="text-2xl font-bold text-slate-100">
                  {summary.pipelineCounts['Payment Pending'] || 0}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-rose-500/20">
                <span className="text-xs text-rose-400 font-semibold block">Revealed / Reported</span>
                <span className="text-2xl font-bold text-slate-100">
                  {summary.pipelineCounts['Revealed / Reported'] || 0}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
