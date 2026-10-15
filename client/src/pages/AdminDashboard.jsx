import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import adminService from '../services/adminService';
import {
  ShieldAlert,
  Users,
  HardDrive,
  Activity,
  AlertTriangle,
  LogOut,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Ban,
  Trash2,
  UserCheck
} from 'lucide-react';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [overviewData, usersData] = await Promise.all([
        adminService.getOverview(),
        adminService.getUsers()
      ]);
      setOverview(overviewData);
      setUsers(usersData.users || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      setError('Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleSuspend = async (userId, name) => {
    if (!confirm(`Suspend "${name}"? Their account will be disabled but data preserved.`)) return;
    try {
      await adminService.suspendUser(userId);
      setActionMsg(`User ${name} suspended`);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to suspend user');
    }
  };

  const handleTerminate = async (userId, name) => {
    if (!confirm(`⚠️ PERMANENTLY TERMINATE "${name}"? This disables the account and flags data for deletion.`)) return;
    try {
      await adminService.terminateUser(userId);
      setActionMsg(`User ${name} terminated`);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to terminate user');
    }
  };

  const handleReactivate = async (userId, name) => {
    try {
      await adminService.reactivateUser(userId);
      setActionMsg(`User ${name} reactivated`);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reactivate user');
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'Never';
    return new Date(ts * 1000).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-mono">Loading admin console...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">
              🛡️ Vault Admin Console
            </h1>
            <p className="text-sm text-slate-400">System oversight • Security monitoring • Zero-knowledge architecture</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Admin Info Card */}
        <div className="bg-slate-900/80 border border-purple-800/50 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">{user?.name}</h3>
              <p className="text-sm text-slate-400 mb-3">{user?.email}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 font-medium">
                  👑 Admin Role
                </span>
                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-medium flex items-center gap-1.5">
                  <EyeOff className="w-3 h-3" />
                  Zero-Knowledge: Cannot View User Files
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        {actionMsg && (
          <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {actionMsg}
            <button onClick={() => setActionMsg('')} className="ml-auto text-xs text-emerald-400">dismiss</button>
          </div>
        )}
        {error && (
          <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            {error}
            <button onClick={() => setError('')} className="ml-auto text-xs text-rose-400">dismiss</button>
          </div>
        )}

        {/* Metrics Grid */}
        {overview && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <Users className="w-5 h-5 text-sky-400" />
                <span className="text-2xl font-bold text-white">{overview.metrics.totalUsers}</span>
              </div>
              <p className="text-xs font-medium text-slate-400">Total Users</p>
            </div>
            <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-2xl font-bold text-white">{overview.metrics.activeUsers}</span>
              </div>
              <p className="text-xs font-medium text-slate-400">Active Accounts</p>
            </div>
            <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <HardDrive className="w-5 h-5 text-purple-400" />
                <span className="text-2xl font-bold text-white">{formatBytes(overview.metrics.totalStorageBytes)}</span>
              </div>
              <p className="text-xs font-medium text-slate-400">Total Storage</p>
            </div>
            <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span className="text-2xl font-bold text-white">{overview.metrics.securityAlerts}</span>
              </div>
              <p className="text-xs font-medium text-slate-400">Security Alerts</p>
            </div>
          </div>
        )}

        {/* User Management Table */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-semibold text-white">User Management</h3>
            <span className="text-xs text-slate-500 ml-auto">{users.length} total</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-3 text-xs text-slate-400 font-medium">User</th>
                  <th className="text-left py-3 px-3 text-xs text-slate-400 font-medium">Status</th>
                  <th className="text-left py-3 px-3 text-xs text-slate-400 font-medium">Storage</th>
                  <th className="text-left py-3 px-3 text-xs text-slate-400 font-medium">Last Login</th>
                  <th className="text-left py-3 px-3 text-xs text-slate-400 font-medium">Failed Attempts</th>
                  <th className="text-right py-3 px-3 text-xs text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => u.role === 'user').map((u) => (
                  <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-3 px-3">
                      <div>
                        <p className="font-medium text-white">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        u.account_status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                        u.account_status === 'suspended' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                        'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {u.account_status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-300 font-mono">
                      {formatBytes(u.storage_used_bytes)} / {formatBytes(u.storage_quota_bytes)}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-400">
                      {formatTimestamp(u.last_login)}
                    </td>
                    <td className="py-3 px-3 text-xs">
                      {u.failed_login_attempts > 0 ? (
                        <span className="text-amber-400 font-medium">{u.failed_login_attempts}/3</span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-2">
                        {u.account_status === 'active' ? (
                          <>
                            <button
                              onClick={() => handleSuspend(u.id, u.name)}
                              className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                              title="Suspend User"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleTerminate(u.id, u.name)}
                              className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                              title="Terminate User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleReactivate(u.id, u.name)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-xs font-medium flex items-center gap-1.5"
                            title="Reactivate"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.filter(u => u.role === 'user').length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">No users registered yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Security Events */}
        {overview && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-5 h-5 text-purple-400" />
              <h3 className="text-base font-semibold text-white">Security Events</h3>
            </div>

            {overview.recentEvents && overview.recentEvents.length > 0 ? (
              <div className="space-y-2">
                {overview.recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/50 hover:border-slate-700 transition-colors"
                  >
                    {event.event_status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs font-medium text-white">
                          {event.event_type.replace(/_/g, ' ')}
                        </p>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">
                          {new Date(event.timestamp * 1000).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {event.user_email && <span className="truncate">{event.user_email}</span>}
                        {event.ip_address && (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="font-mono">{event.ip_address}</span>
                          </>
                        )}
                      </div>
                      {event.details && (
                        <p className="text-[11px] text-slate-500 mt-1">{event.details}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">No security events recorded</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
