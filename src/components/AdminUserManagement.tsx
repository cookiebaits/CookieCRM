import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  ShieldCheck,
  UserPlus,
  Search,
  Key,
  Trash2,
  Edit,
  Mail,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Lock,
  UserCheck,
  PhoneCall,
  Crown,
} from 'lucide-react';
import { api } from '../api.ts';
import type { User, ManagedUser, AdminStats } from '../types.ts';

interface AdminUserManagementProps {
  currentUser: User;
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'scambaiter'>('all');

  // Modals
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isResetPwOpen, setIsResetPwOpen] = useState(false);
  const [selectedUserForPw, setSelectedUserForPw] = useState<ManagedUser | null>(null);

  // New user form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'scambaiter' | 'admin'>('scambaiter');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Password reset state
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // Delete confirmation
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminUsers();
      setUsers(res.users);
      setStats(res.stats);
    } catch (err) {
      console.error('Failed to fetch admin users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    try {
      const res = await api.createAdminUser({
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
      });

      setUsers((prev) => [res.user, ...prev]);
      setIsAddUserOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('scambaiter');
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user account');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleRoleToggle = async (targetUser: ManagedUser) => {
    const nextRole = targetUser.role === 'admin' ? 'scambaiter' : 'admin';
    try {
      const res = await api.updateAdminUser(targetUser.id, { role: nextRole });
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? res.user : u)));
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user role');
    }
  };

  const handleOpenResetPassword = (targetUser: ManagedUser) => {
    setSelectedUserForPw(targetUser);
    setResetPasswordVal('');
    setResetError(null);
    setResetSuccess(null);
    setIsResetPwOpen(true);
  };

  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPw || !resetPasswordVal.trim()) return;

    setResetSubmitting(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      await api.updateAdminUser(selectedUserForPw.id, { password: resetPasswordVal.trim() });
      setResetSuccess(`Password successfully reset for ${selectedUserForPw.name}.`);
      setTimeout(() => {
        setIsResetPwOpen(false);
        setSelectedUserForPw(null);
        setResetSuccess(null);
      }, 1500);
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset user password');
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleDeleteUser = async (targetUser: ManagedUser) => {
    if (targetUser.id === currentUser.id) {
      alert('You cannot delete your own logged-in administrator account.');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete user "${targetUser.name}" (${targetUser.email})? This action is permanent.`
      )
    ) {
      return;
    }

    setDeletingUserId(targetUser.id);
    try {
      await api.deleteAdminUser(targetUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter === 'admin' && u.role !== 'admin' && u.role !== 'admin_scambaiter') return false;
    if (roleFilter === 'scambaiter' && (u.role === 'admin' || u.role === 'admin_scambaiter'))
      return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-600 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-950/30">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Agent & User Management</h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-semibold uppercase tracking-wider">
                Administrator Section
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Control access permissions, manage registered scambaiters, and configure accounts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchUsers}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
            title="Refresh Users"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            id="admin-add-user-btn"
            onClick={() => setIsAddUserOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold transition shadow-lg shadow-rose-950/40 flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Total Users</span>
              <Users className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-white mt-2">{stats.totalUsers}</div>
            <div className="text-[11px] text-slate-400 mt-1">Registered in system</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center justify-between">
              <span>Command Admins</span>
              <Crown className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 mt-2">{stats.totalAdmins}</div>
            <div className="text-[11px] text-slate-400 mt-1">Full privileged access</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-[11px] font-medium text-rose-400 uppercase tracking-wider flex items-center justify-between">
              <span>Scammer Dossiers</span>
              <Shield className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400 mt-2">{stats.totalScammers}</div>
            <div className="text-[11px] text-slate-400 mt-1">Across all team pipelines</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center justify-between">
              <span>Total Calls Logged</span>
              <PhoneCall className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-2">{stats.totalCalls}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              {Math.floor(stats.totalBaitTimeMinutes / 60)} hrs wasted
            </div>
          </div>
        </div>
      )}

      {/* Controls: Search & Role Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            id="admin-search-users"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 hidden sm:inline font-medium">Filter:</span>
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`flex-1 sm:flex-none px-3 py-1 rounded-lg font-medium transition ${
                roleFilter === 'all'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Users ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('admin')}
              className={`flex-1 sm:flex-none px-3 py-1 rounded-lg font-medium transition ${
                roleFilter === 'admin'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Admins
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('scambaiter')}
              className={`flex-1 sm:flex-none px-3 py-1 rounded-lg font-medium transition ${
                roleFilter === 'scambaiter'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Agents
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4 sm:px-6">User / Call Sign</th>
                <th className="py-3.5 px-4">Role & Status</th>
                <th className="py-3.5 px-4">Registration & Auth</th>
                <th className="py-3.5 px-4 text-center">Cases Logged</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mx-auto mb-2"></div>
                    Loading registered users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isAdmin = u.role === 'admin' || u.role === 'admin_scambaiter';
                  const isCurrent = u.id === currentUser.id;
                  const isGmailLinked = Boolean(u.googleId || u.email.endsWith('@gmail.com'));

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition">
                      {/* Name & Avatar */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt={u.name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-700"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold">
                              {u.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[10px] font-semibold border border-rose-500/30">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-500" />
                              <span>{u.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                              isAdmin
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}
                          >
                            {isAdmin ? (
                              <>
                                <Crown className="w-3 h-3 text-amber-400" />
                                <span>Administrator</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-3 h-3 text-blue-400" />
                                <span>Scambaiter Agent</span>
                              </>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* Auth Type & Date */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                            {isGmailLinked ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                Google / Gmail Auth
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                Email & Password
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </td>

                      {/* Cases count */}
                      <td className="py-4 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs">
                          {u.scammersCount}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Toggle Role */}
                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() => handleRoleToggle(u)}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                              isCurrent
                                ? 'opacity-40 cursor-not-allowed bg-slate-800 border-slate-700 text-slate-500'
                                : isAdmin
                                ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700 hover:border-slate-600'
                                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
                            }`}
                            title={
                              isCurrent
                                ? 'Cannot modify your own active role'
                                : isAdmin
                                ? 'Demote to Scambaiter Agent'
                                : 'Promote to Administrator'
                            }
                          >
                            {isAdmin ? 'Make Agent' : 'Make Admin'}
                          </button>

                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => handleOpenResetPassword(u)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition"
                            title="Reset Password"
                          >
                            <Key className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            disabled={isCurrent || deletingUserId === u.id}
                            onClick={() => handleDeleteUser(u)}
                            className={`p-1.5 rounded-lg border transition ${
                              isCurrent
                                ? 'opacity-40 cursor-not-allowed bg-slate-800 border-slate-700 text-slate-600'
                                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                            }`}
                            title={
                              isCurrent
                                ? 'Cannot delete your own account'
                                : 'Delete User Permanently'
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New User */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-white">Create New User Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Full Name / Agent Moniker
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scambaiter Dan"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="agent@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Assigned Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="scambaiter">Scambaiter Agent (Standard CRM Access)</option>
                  <option value="admin">Administrator (Full CRM + User Management)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                >
                  {formSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {isResetPwOpen && selectedUserForPw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-white">Reset User Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsResetPwOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Set a new password for <span className="text-white font-semibold">{selectedUserForPw.name}</span> ({selectedUserForPw.email}).
            </p>

            {resetSuccess && (
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{resetSuccess}</span>
              </div>
            )}

            {resetError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleSaveResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    placeholder="Enter new password"
                    value={resetPasswordVal}
                    onChange={(e) => setResetPasswordVal(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetPwOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  {resetSubmitting ? 'Saving...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
