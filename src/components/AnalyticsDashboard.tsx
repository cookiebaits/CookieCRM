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
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  Clock,
  ShieldAlert,
  Flame,
  Zap,
  TrendingUp,
  RefreshCw,
  Trophy,
  Tag,
  AlertTriangle,
  Building,
  Calendar,
} from 'lucide-react';
import { api } from '../api.ts';
import type { MonthlyDataPoint, AnalyticsSummary } from '../types.ts';
import { formatDuration } from './PipelineBoard.tsx';

interface AnalyticsDashboardProps {
  onRefreshTrigger?: number;
}

const COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899'];

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

  const totalMonthlySavings =
    summary?.estimatedSavingsPrevented ||
    monthlyData.reduce((sum, m) => sum + (m.estimatedSavings || 0), 0);

  return (
    <div className="space-y-6">
      {/* TOP STAT METRICS (Cool Scambaiting Stats) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Time Wasted This Week (HERO STAT) */}
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 shadow-lg relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 animate-pulse text-amber-400" />
              This Week Wasted
            </span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-amber-200 font-mono">
              {summary?.weekTotalHours !== undefined ? `${summary.weekTotalHours}h` : '0h'}{' '}
              <span className="text-xs font-semibold text-amber-400/80">
                ({summary?.weekTotalMinutes || 0}m)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Across {summary?.weekCallsCount || 0} baiting interactions
            </p>
          </div>
        </div>

        {/* Card 2: Today's Baiting Time */}
        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 shadow-lg relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              Today&apos;s Active Time
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-300 font-mono">
              {summary?.todayTotalMinutes || 0}{' '}
              <span className="text-xs font-medium text-slate-400">mins</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Across {summary?.todayCallsCount || 0} calls today
            </p>
          </div>
        </div>

        {/* Card 3: All-Time Wasted Time across all scammers */}
        <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-4 shadow-lg relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
              Total Time Burned
            </span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-rose-200 font-mono">
              {summary?.totalWastedHours || 0}{' '}
              <span className="text-xs font-semibold text-rose-400/80">hrs</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {summary?.totalWastedMinutes || 0} total minutes on call
            </p>
          </div>
        </div>

        {/* Card 4: Estimated Losses Prevented */}
        <div className="bg-slate-900/90 border border-sky-500/30 rounded-2xl p-4 shadow-lg relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-sky-400" />
              Losses Prevented
            </span>
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-300">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-sky-200 font-mono">
              ${totalMonthlySavings.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Estimated victim fraud diversion
            </p>
          </div>
        </div>

        {/* Card 5: Flagged Fraud Accounts */}
        <div className="bg-slate-900/90 border border-purple-500/30 rounded-2xl p-4 shadow-lg relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
              Mule Accounts
            </span>
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-purple-200 font-mono">
              {summary?.totalFraudAccounts || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Mule banks & crypto wallets frozen
            </p>
          </div>
        </div>
      </div>

      {/* Main Analytics Chart */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-6">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
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
                    ? 'bg-[#714B67] text-white shadow'
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
                    ? 'bg-[#714B67] text-white shadow'
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
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
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
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
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
                  formatter={(value: any) => [`${value} hours`, 'Time Wasted']}
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="#f59e0b"
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
      </div>

      {/* DUAL SECTION: Top Baited Scammers Leaderboard & Scam Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEADERBOARD: Top 5 Scammers Wasted */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Top Baited Scammers (Leaderboard)
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">Most Time Wasted</span>
          </div>

          <div className="space-y-2.5">
            {summary?.topScammers && summary.topScammers.length > 0 ? (
              summary.topScammers.map((scammer, index) => {
                const rankColor =
                  index === 0
                    ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                    : index === 1
                    ? 'text-slate-300 border-slate-500/40 bg-slate-500/10'
                    : index === 2
                    ? 'text-amber-600 border-amber-700/40 bg-amber-700/10'
                    : 'text-slate-400 border-slate-800 bg-slate-900';

                return (
                  <div
                    key={scammer.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-black shrink-0 ${rankColor}`}
                      >
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-100 truncate">
                          {scammer.fullName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {scammer.phoneNumber}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                        {formatDuration(scammer.totalMinutes)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {scammer.callsCount} {scammer.callsCount === 1 ? 'call' : 'calls'}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-xs text-slate-500">
                Log calls to see top baited scammers on the leaderboard.
              </div>
            )}
          </div>
        </div>

        {/* SCAM TYPE BREAKDOWN */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-400" />
              Scam Operation Categories
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">Time & Count Distribution</span>
          </div>

          <div className="space-y-3">
            {summary?.scamTypeStats && summary.scamTypeStats.length > 0 ? (
              summary.scamTypeStats.map((st, idx) => (
                <div key={st.scamType} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{st.scamType}</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {st.count} targets • <strong className="text-amber-300">{formatDuration(st.totalMinutes)}</strong> ({st.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(4, st.percentage)}%`,
                        backgroundColor: COLORS[idx % COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-xs text-slate-500">
                Assign scam types to targets to view category distribution.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Scammer Stage Distribution */}
      {summary && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
            Active Scambaiting Stage Distribution
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 p-3 rounded-xl border border-sky-500/30">
              <span className="text-xs text-sky-400 font-semibold block">1. Uncalled</span>
              <span className="text-2xl font-bold text-slate-100 font-mono">
                {summary.pipelineCounts['Uncalled'] || summary.pipelineCounts['New'] || summary.pipelineCounts['New Scammer'] || 0}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-teal-500/30">
              <span className="text-xs text-teal-400 font-semibold block">2. In Progress</span>
              <span className="text-2xl font-bold text-slate-100 font-mono">
                {summary.pipelineCounts['In Progress'] || summary.pipelineCounts['Qualified'] || summary.pipelineCounts['Actively baiting'] || 0}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-amber-500/30">
              <span className="text-xs text-amber-400 font-semibold block">3. Top Baits</span>
              <span className="text-2xl font-bold text-slate-100 font-mono">
                {summary.pipelineCounts['Top Baits'] || summary.pipelineCounts['Proposition'] || summary.pipelineCounts['Payment Pending'] || 0}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-emerald-500/30">
              <span className="text-xs text-emerald-400 font-semibold block">4. Reported / Down</span>
              <span className="text-2xl font-bold text-slate-100 font-mono">
                {summary.pipelineCounts['Reported / Down'] || summary.pipelineCounts['Won'] || summary.pipelineCounts['Revealed / Reported'] || 0}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
