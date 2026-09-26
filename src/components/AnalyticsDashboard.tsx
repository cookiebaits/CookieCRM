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

  const totalScammerCost =
    summary?.scammerCostTotal !== undefined
      ? summary.scammerCostTotal
      : (summary?.totalWastedMinutes || 0) * 0.17;

  return (
    <div className="space-y-5">
      {/* TOP STAT METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Time Wasted This Week */}
        <div className="bg-slate-900/80 border border-amber-500/20 rounded-xl p-4 shadow-md relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              This Week Wasted
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-300">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-amber-200 font-mono">
              {summary?.weekTotalHours !== undefined ? `${summary.weekTotalHours}h` : '0h'}{' '}
              <span className="text-xs font-normal text-amber-400/80">
                ({summary?.weekTotalMinutes || 0}m)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Across {summary?.weekCallsCount || 0} baiting interactions
            </p>
          </div>
        </div>

        {/* Card 2: Today's Baiting Time */}
        <div className="bg-slate-900/80 border border-emerald-500/20 rounded-xl p-4 shadow-md relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              Today&apos;s Active Time
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-300">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-emerald-300 font-mono">
              {summary?.todayTotalMinutes || 0}{' '}
              <span className="text-xs font-normal text-slate-400">mins</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Across {summary?.todayCallsCount || 0} calls today
            </p>
          </div>
        </div>

        {/* Card 3: All-Time Wasted Time */}
        <div className="bg-slate-900/80 border border-rose-500/20 rounded-xl p-4 shadow-md relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
              Total Time Burned
            </span>
            <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-300">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-rose-200 font-mono">
              {summary?.totalWastedHours || 0}{' '}
              <span className="text-xs font-normal text-rose-400/80">hrs</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {summary?.totalWastedMinutes || 0} total minutes on call
            </p>
          </div>
        </div>

        {/* Card 4: Scammer Cost */}
        <div className="bg-slate-900/80 border border-sky-500/20 rounded-xl p-4 shadow-md relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-sky-400" />
              Scammer Cost
            </span>
            <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-300">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-sky-200 font-mono">
              ${totalScammerCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Calculated at $0.17 / min wasted time
            </p>
          </div>
        </div>

        {/* Card 5: Flagged Fraud Accounts */}
        <div className="bg-slate-900/80 border border-purple-500/20 rounded-xl p-4 shadow-md relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
              Mule Accounts
            </span>
            <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-300">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-purple-200 font-mono">
              {summary?.totalFraudAccounts || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Mule banks & crypto wallets frozen
            </p>
          </div>
        </div>
      </div>

      {/* Main Analytics Chart */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 mb-5">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              Monthly Scammer Baiting Time Visualization
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cumulative efficiency and scambaiter operational hours wasted monthly across all targets
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setViewMetric('hours')}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  viewMetric === 'hours'
                    ? 'bg-rose-600/80 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Hours Wasted
              </button>
              <button
                type="button"
                onClick={() => setViewMetric('calls')}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  viewMetric === 'calls'
                    ? 'bg-rose-600/80 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Call Volume
              </button>
            </div>

            <button
              type="button"
              onClick={fetchAnalytics}
              className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white transition"
              title="Refresh statistics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {viewMetric === 'hours' ? (
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit="h" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                  }}
                  formatter={(value: any) => [`${value} hours`, 'Time Wasted']}
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorHours)"
                />
              </AreaChart>
            ) : (
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [`${value} calls`, 'Total Interactions']}
                />
                <Bar dataKey="callsCount" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* DUAL SECTION: Top Baited Scammers Leaderboard & Scam Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEADERBOARD */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-md">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-3.5">
            <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Top Baited Scammers (Leaderboard)
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">Most Time Wasted</span>
          </div>

          <div className="space-y-2">
            {summary?.topScammers && summary.topScammers.length > 0 ? (
              summary.topScammers.map((scammer, index) => {
                const rankColor =
                  index === 0
                    ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                    : index === 1
                    ? 'text-slate-300 border-slate-500/30 bg-slate-500/10'
                    : index === 2
                    ? 'text-amber-600 border-amber-700/30 bg-amber-700/10'
                    : 'text-slate-400 border-slate-800 bg-slate-900';

                return (
                  <div
                    key={scammer.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center text-[11px] font-bold shrink-0 ${rankColor}`}
                      >
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          {scammer.fullName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {scammer.phoneNumber}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold font-mono text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/20">
                        {formatDuration(scammer.totalMinutes)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {scammer.callsCount} {scammer.callsCount === 1 ? 'call' : 'calls'}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-xs text-slate-500">
                Log calls to see top baited scammers on the leaderboard.
              </div>
            )}
          </div>
        </div>

        {/* SCAM TYPE BREAKDOWN */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-md">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-3.5">
            <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-400" />
              Scam Operation Categories
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">Time & Count Distribution</span>
          </div>

          <div className="space-y-2.5">
            {summary?.scamTypeStats && summary.scamTypeStats.length > 0 ? (
              summary.scamTypeStats.map((st, idx) => (
                <div key={st.scamType} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">{st.scamType}</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {st.count} targets • <strong className="text-amber-300">{formatDuration(st.totalMinutes)}</strong> ({st.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
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
              <div className="text-center py-6 text-xs text-slate-500">
                Assign scam types to targets to view category distribution.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Scammer Stage Distribution */}
      {summary && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-md">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
            Active Scambaiting Stage Distribution
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-sky-500/20">
              <span className="text-xs text-sky-400 font-medium block">1. New / Uncalled</span>
              <span className="text-lg font-semibold text-slate-100 font-mono">
                {summary.pipelineCounts['New / Uncalled'] || summary.pipelineCounts['New'] || summary.pipelineCounts['New Scammer'] || 0}
              </span>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-teal-500/20">
              <span className="text-xs text-teal-400 font-medium block">2. Currently Baiting</span>
              <span className="text-lg font-semibold text-slate-100 font-mono">
                {summary.pipelineCounts['Currently Baiting'] || summary.pipelineCounts['Qualified'] || summary.pipelineCounts['Actively baiting'] || 0}
              </span>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-amber-500/20">
              <span className="text-xs text-amber-400 font-medium block">3. Top Scams</span>
              <span className="text-lg font-semibold text-slate-100 font-mono">
                {summary.pipelineCounts['Top Scams'] || summary.pipelineCounts['Proposition'] || summary.pipelineCounts['Payment Pending'] || 0}
              </span>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-emerald-500/20">
              <span className="text-xs text-emerald-400 font-medium block">4. Reported / Down</span>
              <span className="text-lg font-semibold text-slate-100 font-mono">
                {summary.pipelineCounts['Reported / Down'] || summary.pipelineCounts['Won'] || summary.pipelineCounts['Revealed / Reported'] || 0}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
