import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import userService from '../services/userService';
import {
  User,
  Upload,
  Files,
  Shield,
  Activity,
  HardDrive,
  LogOut,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Image,
  Film,
  Archive,
  AlertCircle,
  TrendingUp
} from 'lucide-react';

export default function UserDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const data = await userService.getDashboard();
      setDashboard(data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getCategoryIcon = (category) => {
    switch (category?.toLowerCase()) {
      case 'images': return <Image className="w-4 h-4" />;
      case 'documents': return <FileText className="w-4 h-4" />;
      case 'videos': return <Film className="w-4 h-4" />;
      case 'archives': return <Archive className="w-4 h-4" />;
      default: return <Files className="w-4 h-4" />;
    }
  };

  const getEventIcon = (status) => {
    return status === 'success'
      ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      : <XCircle className="w-4 h-4 text-rose-400" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-mono">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">
              Welcome back, <span className="text-sky-400">{user?.name}</span>
            </h1>
            <p className="text-sm text-slate-400">Your secure cloud storage dashboard</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {error}
          </div>
        )}

        {/* Quick Stats Grid */}
        {dashboard && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Total Files */}
            <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <Files className="w-5 h-5 text-sky-400" />
                <span className="text-2xl font-bold text-white">{dashboard.storage.totalFiles}</span>
              </div>
              <p className="text-xs font-medium text-slate-400">Total Files</p>
            </div>

            {/* Storage Used */}
            <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <HardDrive className="w-5 h-5 text-purple-400" />
                <span className="text-2xl font-bold text-white">{formatBytes(dashboard.storage.used)}</span>
              </div>
              <p className="text-xs font-medium text-slate-400">Storage Used</p>
            </div>

            {/* Storage Quota */}
            <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <span className="text-2xl font-bold text-white">{dashboard.storage.percentage}%</span>
              </div>
              <p className="text-xs font-medium text-slate-400">Quota Used</p>
            </div>

            {/* Account Status */}
            <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <Shield className="w-5 h-5 text-amber-400" />
                <span className="text-lg font-bold text-white">
                  {dashboard.profile.mfaEnabled ? '🔐' : '⚠️'}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-400">
                {dashboard.profile.mfaEnabled ? 'MFA Active' : 'MFA Disabled'}
              </p>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Storage Overview */}
          {dashboard && (
            <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <HardDrive className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-semibold text-white">Storage Overview</h3>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-300 font-medium">
                    {formatBytes(dashboard.storage.used)} of {formatBytes(dashboard.storage.quota)}
                  </span>
                  <span className="text-sky-400 font-mono">{dashboard.storage.percentage}%</span>
                </div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      dashboard.storage.percentage > 90 ? 'bg-rose-500' :
                      dashboard.storage.percentage > 70 ? 'bg-amber-500' :
                      'bg-sky-500'
                    }`}
                    style={{ width: `${Math.min(dashboard.storage.percentage, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Category Breakdown */}
              {dashboard.categoryBreakdown && dashboard.categoryBreakdown.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Files by Category
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {dashboard.categoryBreakdown.map((cat, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/50">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
                          {getCategoryIcon(cat.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white capitalize truncate">{cat.category || 'Other'}</p>
                          <p className="text-[10px] text-slate-400">{cat.count} files • {formatBytes(cat.totalSize)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-semibold text-white mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link
                to="/user/upload"
                className="flex items-center gap-3 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 text-sky-300 hover:text-sky-200 transition-colors group"
              >
                <Upload className="w-5 h-5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Upload Files</p>
                  <p className="text-xs text-slate-400">Phase 7</p>
                </div>
              </Link>

              <Link
                to="/user/files"
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <Files className="w-5 h-5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">My Files</p>
                  <p className="text-xs text-slate-400">Phase 10</p>
                </div>
              </Link>

              <Link
                to="/user/security"
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <Shield className="w-5 h-5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Security Settings</p>
                  <p className="text-xs text-slate-400">MFA • WebAuthn</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Files */}
          {dashboard && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Files className="w-5 h-5 text-purple-400" />
                  <h3 className="text-base font-semibold text-white">Recent Files</h3>
                </div>
                <Link to="/user/files" className="text-xs text-sky-400 hover:text-sky-300">
                  View all →
                </Link>
              </div>

              {dashboard.recentFiles && dashboard.recentFiles.length > 0 ? (
                <div className="space-y-2">
                  {dashboard.recentFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/50 hover:border-slate-700 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                        {getCategoryIcon(file.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {formatBytes(file.size)} • {formatTimestamp(file.uploadedAt)}
                        </p>
                      </div>
                      {file.isShared && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30">
                          Shared
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  <Files className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No files yet. Upload your first file!</p>
                </div>
              )}
            </div>
          )}

          {/* Security Activity */}
          {dashboard && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-white">Recent Security Activity</h3>
              </div>

              {dashboard.recentActivity && dashboard.recentActivity.length > 0 ? (
                <div className="space-y-2">
                  {dashboard.recentActivity.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/50"
                    >
                      {getEventIcon(event.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white">
                          {event.type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatTimestamp(event.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
