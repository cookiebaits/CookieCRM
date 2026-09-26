import React from 'react';
import {
  Search,
  Plus,
  BarChart3,
  LayoutDashboard,
  LogOut,
  User as UserIcon,
  ShieldAlert,
  Users,
  Crown,
} from 'lucide-react';
import type { User } from '../types.ts';

interface NavbarProps {
  user: User;
  activeView: 'pipeline' | 'analytics' | 'users';
  onChangeView: (view: 'pipeline' | 'analytics' | 'users') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  flaggedOnly: boolean;
  onToggleFlagged: () => void;
  onOpenQuickAdd: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeView,
  onChangeView,
  searchQuery,
  onSearchChange,
  flaggedOnly,
  onToggleFlagged,
  onOpenQuickAdd,
  onLogout,
}) => {
  const isGmail = user.email.toLowerCase().endsWith('@gmail.com');
  const isAdmin = user.role === 'admin' || user.role === 'admin_scambaiter';

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-2.5">
      <div className="max-w-[1800px] w-full mx-auto flex flex-wrap items-center justify-between gap-3 sm:gap-6">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => {
              onChangeView('pipeline');
              onSearchChange('');
            }}
            className="flex items-center hover:opacity-90 transition focus:outline-none cursor-pointer relative z-20 shrink-0"
            title="Scambaiter CRM Intelligence - Return to Dashboard"
          >
            <img
              src="/logo.png"
              alt="Scambaiter CRM Intelligence"
              className="h-9 sm:h-10 w-auto object-contain max-w-[220px] transition-transform hover:scale-102"
            />
          </button>

          {/* View Toggle Tabs */}
          <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              id="view-pipeline-btn"
              onClick={() => onChangeView('pipeline')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeView === 'pipeline'
                  ? 'bg-rose-600/90 text-white shadow-sm ring-1 ring-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-rose-300" />
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              id="view-analytics-btn"
              onClick={() => onChangeView('analytics')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeView === 'analytics'
                  ? 'bg-indigo-600/90 text-white shadow-sm ring-1 ring-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-300" />
              <span>Analytics</span>
            </button>

            {/* Admin-only User Management tab */}
            {isAdmin && (
              <button
                type="button"
                id="view-users-btn"
                onClick={() => onChangeView('users')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                  activeView === 'users'
                    ? 'bg-amber-600/90 text-white shadow-sm ring-1 ring-amber-500/30'
                    : 'text-amber-400/80 hover:text-amber-300'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Users</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              </button>
            )}
          </div>
        </div>

        {/* Center: Search & Filter */}
        <div className="flex-1 max-w-md hidden md:flex items-center gap-2">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              id="search-scammers-input"
              placeholder="Search by name, alias, phone, or VoIP carrier..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium text-slate-100 placeholder-slate-400 focus:outline-none focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/30 transition"
            />
          </div>

          <button
            type="button"
            id="filter-flagged-btn"
            onClick={onToggleFlagged}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
              flaggedOnly
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Filter by Flagged Fraudulent only"
          >
            <ShieldAlert className={`w-3.5 h-3.5 ${flaggedOnly ? 'text-rose-400' : 'text-slate-400'}`} />
            <span className="hidden lg:inline">Flagged</span>
          </button>
        </div>

        {/* Right: Actions & User Menu */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            id="nav-quick-add-btn"
            onClick={onOpenQuickAdd}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-xs transition shadow-md shadow-rose-950/30 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Scammer</span>
          </button>

          {/* User Profile Badge */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800/80">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-slate-700 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
              </div>
            )}

            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-slate-100 truncate max-w-[150px] flex items-center gap-1">
                <span>{user.name}</span>
                {isAdmin && (
                  <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Administrator" />
                )}
              </div>
              <div className="text-[11px] font-normal text-slate-400 flex items-center gap-1 truncate max-w-[130px]">
                {isAdmin ? (
                  <span className="text-amber-400/90 font-medium">Admin</span>
                ) : isGmail ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                    <span>Agent</span>
                  </>
                ) : (
                  <span>{user.email}</span>
                )}
              </div>
            </div>

            <button
              type="button"
              id="logout-btn"
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800/60 transition"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
