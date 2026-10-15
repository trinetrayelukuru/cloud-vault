import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import userService from '../services/userService';
import axios from 'axios';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const api = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cloudvault_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function FileManager() {
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  const loadFiles = async () => {
    setLoading(true);
    try {
      const q = { q: search, category };
      const data = search.trim() ? await userService.getFiles(q) : await userService.getFiles({ category })
      setFiles(data.files || []);
      setMsg('');
    } catch (e) {
      setMsg('Failed to load files');
    }
    setLoading(false);
  };

  useEffect(() => { loadFiles(); }, [category]);

  const handleSearch = (e) => { e.preventDefault(); loadFiles(); };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? (crypto-shredding applies)`)) return;
    try {
      await userService.deleteFile(id);
      loadFiles();
      setMsg('File securely deleted');
    } catch { setMsg('Delete failed'); }
  };

  const [stepupPassword, setStepupPassword] = useState('');
  const [stepupCode, setStepupCode] = useState('');
  const [stepupMode, setStepupMode] = useState(false);
  const [stepupFileId, setStepupFileId] = useState(null);
  const [stepupError, setStepupError] = useState('');

  const handleDownload = async (id) => {
    setStepupFileId(id);
    setStepupMode(true);
    setStepupError('');
    setStepupPassword('');
    setStepupCode('');
  };

  const submitStepup = async () => {
    if (!stepupPassword || stepupPassword.trim().length < 1) { setStepupError('Vault security password is required'); return; }
    const code = stepupCode.trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) { setStepupError('Enter a valid 6-digit TOTP code from Aegis'); return; }
    try {
      const stepup = await api.post(`/files/${stepupFileId}/stepup`, { vaultPassword: stepupPassword.trim(), totpCode: code });
      if (!stepup.data.stepUpVerified) { setStepupError('Step-up failed: ' + (stepup.data?.message || 'invalid credentials')); return; }
      const token = stepup.data.downloadToken;
      const fileName = stepup.data.fileName;
      const res = await api.get(`/files/download/${stepupFileId}`, {
        headers: { 'x-download-token': token },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'download';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setStepupMode(false); setStepupFileId(null); setStepupError('');
      setMsg('Download complete');
    } catch (e) {
      setStepupError(e.response?.data?.error || 'Step-up/download failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">File Vault</h1>
      <p className="text-slate-400 mb-6">List · Search · Download · Delete · Verify integrity</p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files..." className="bg-slate-900 border border-slate-700 px-3 py-2 rounded flex-1 min-w-[250px]" />
        <select value={category} onChange={e => setCategory(e.target.value)} className="bg-slate-900 border border-slate-700 px-3 py-2 rounded">
          <option value="">All</option>
          <option value="image">Images</option>
          <option value="document">Documents</option>
          <option value="video">Videos</option>
          <option value="archive">Archives</option>
        </select>
        <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded font-medium">Search</button>
      </form>

      {stepupMode && (
        <div className="bg-slate-900 border border-cyan-700 rounded-xl p-6 mb-6 shadow-lg shadow-cyan-900/20">
          <h2 className="text-lg font-bold text-cyan-300 mb-1">Step-Up Authentication</h2>
          <p className="text-xs text-slate-400 mb-4">Vault password + 6-digit TOTP from Aegis required to download.</p>
          <div className="flex flex-col md:flex-row gap-3 mb-3">
            <input type="password" value={stepupPassword} onChange={e => { setStepupPassword(e.target.value); setStepupError(''); }} placeholder="Vault security password" className="bg-slate-950 border border-slate-600 px-3 py-2 rounded flex-1 min-w-[220px] text-sm" />
            <input type="text" inputMode="numeric" maxLength={6} value={stepupCode} onChange={e => { const v = e.target.value.replace(/\D/g,'').slice(0,6); setStepupCode(v); setStepupError(''); }} placeholder="TOTP code (6 digits)" className="bg-slate-950 border border-slate-600 px-3 py-2 rounded flex-1 min-w-[200px] text-sm tracking-widest font-mono" />
          </div>
          {stepupError && <div className="text-red-300 text-sm mb-2">{stepupError}</div>}
          <div className="flex gap-2">
            <button onClick={submitStepup} className="bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded font-medium">Verify & Download</button>
            <button onClick={() => { setStepupMode(false); setStepupFileId(null); setStepupError(''); }} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded">Cancel</button>
          </div>
        </div>
      )}

      {msg && <div className="bg-emerald-900/40 border border-emerald-500/30 text-emerald-200 px-4 py-2 rounded mb-4">{msg}</div>}

      {loading ? <p>Loading...</p> : (
        <div className="grid gap-3">
          {files.map(f => (
            <div key={f.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold">{f.name}</h3>
                <p className="text-xs text-slate-500">{f.category} · {f.mimeType} · {(f.size/1024).toFixed(1)} KB · {new Date(f.uploadedAt*1000).toLocaleDateString()}</p>
                <p className="text-xs font-mono text-cyan-400">SHA-256: {f.hash?.substring(0, 16)}...</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleDownload(f.id)} className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded text-sm">Download</button>
                <button onClick={() => navigate(`/user/files/${f.id}`)} className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-sm">Details</button>
                <button onClick={() => navigate('/user/dashboard')} className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded text-sm">Back to Dashboard</button>
                <button onClick={() => handleDelete(f.id, f.name)} className="bg-red-700 hover:bg-red-600 px-3 py-1.5 rounded text-sm">Delete</button>
              </div>
            </div>
          ))}
          {files.length === 0 && <p className="text-slate-500">No files found.</p>}
        </div>
      )}
    </div>
  );
}