import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  File,
  Image,
  Video,
  Archive,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Binary,
  Lock,
  HardDrive
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DANGEROUS_EXTS = [
  '.exe', '.dll', '.bat', '.cmd', '.sh', '.bash', '.vbs', '.js',
  '.ps1', '.msi', '.com', '.scr', '.jar', '.reg', '.apk', '.bin'
];

export default function FileUpload() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [clientValidation, setClientValidation] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedFileData, setUploadedFileData] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [verifyingMfa, setVerifyingMfa] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);
  const fileInputRef = useRef(null);

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Check file extension client-side
  const performClientValidation = (file) => {
    const name = file.name.toLowerCase();
    const isDangerous = DANGEROUS_EXTS.some(ext => name.endsWith(ext));

    if (isDangerous) {
      return {
        safe: false,
        warning: true,
        message: 'Executable/script files are prohibited by Vault Security Policies.'
      };
    }

    return {
      safe: true,
      warning: false,
      message: 'File passed client preliminary security checks. Server binary magic-number validation will execute upon upload.'
    };
  };

  // Get file icon based on type
  const getFileIcon = (file) => {
    if (!file) return <File className="w-12 h-12 text-slate-500" />;

    const type = file.type || '';
    const name = (file.name || '').toLowerCase();

    if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(name)) {
      return <Image className="w-12 h-12 text-sky-400" />;
    }
    if (type.startsWith('video/') || /\.(mp4|mkv|webm|avi|mov)$/.test(name)) {
      return <Video className="w-12 h-12 text-purple-400" />;
    }
    if (type.includes('pdf') || /\.(pdf|doc|docx|txt|md|csv|xlsx|pptx)$/.test(name)) {
      return <FileText className="w-12 h-12 text-emerald-400" />;
    }
    if (type.includes('zip') || /\.(zip|rar|7z|tar|gz|bz2)$/.test(name)) {
      return <Archive className="w-12 h-12 text-amber-400" />;
    }
    return <File className="w-12 h-12 text-slate-400" />;
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file) => {
    setSelectedFile(file);
    setUploadSuccess(false);
    setUploadedFileData(null);
    setUploadError('');
    const validation = performClientValidation(file);
    setClientValidation(validation);
  };

  // Handle drag events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Handle drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const verifyMfa = async () => {
    const code = mfaCode.trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) { setMfaError('Enter a valid 6-digit Aegis TOTP code'); return; }
    setVerifyingMfa(true); setMfaError('');
    try {
      const token = localStorage.getItem('cloudvault_token');
      const res = await axios.post(`${API_URL}/api/auth/mfa/verify`, { code }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.valid) { setMfaVerified(true); setMfaError(''); }
      else { setMfaError('Invalid TOTP code. Check Aegis and retry.'); setMfaVerified(false); }
    } catch (e) {
      setMfaError(e.response?.data?.error || 'TOTP verification failed'); setMfaVerified(false);
    } finally { setVerifyingMfa(false); }
  };

  // Handle file upload
  const handleUpload = async () => {
    if (!selectedFile) return;

    if (clientValidation && !clientValidation.safe) {
      setUploadError('Upload blocked: ' + clientValidation.message);
      return;
    }

    setUploading(true);
    if (!mfaVerified) { setUploadError('Upload security required. Verify MFA with Aegis first.'); setUploading(false); return; }
    setUploadProgress(0);
    setUploadError('');
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      // Phase 15: server-side MFA/WebAuthn verification enforced — do not send client boolean

      const token = localStorage.getItem('cloudvault_token');

      const response = await axios.post(`${API_URL}/api/files/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      if (response.data.success) {
        setUploadSuccess(true);
        setUploadedFileData(response.data.file);
        setUploadProgress(100);
      }
    } catch (err) {
      console.error('Upload error:', err);
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to upload file. Please try again.';
      setUploadError(errMsg);
    } finally {
      setUploading(false);
    }
  };

  // Clear selected file
  const clearFile = () => {
    setSelectedFile(null);
    setClientValidation(null);
    setUploadProgress(0);
    setUploadSuccess(false);
    setUploadedFileData(null);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4 text-slate-100">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb / Nav */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-6">
          <Link to="/user/dashboard" className="hover:text-sky-400 transition-colors">DASHBOARD</Link>
          <span>/</span>
          <span className="text-sky-400">SECURE UPLOAD</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Secure File Ingestion & Validation
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Phase 8 — Deep binary inspection, magic-number detection, SHA-256 integrity & sanitized storage
              </p>
            </div>
          </div>
        </div>

        {/* Upload Card */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          {/* Drag and Drop Area */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all ${
              dragActive
                ? 'border-sky-500 bg-sky-500/10'
                : 'border-slate-700/80 hover:border-slate-500 bg-slate-950/40 hover:bg-slate-950/70'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              disabled={uploading}
            />

            {!selectedFile ? (
              <label htmlFor="file-upload" className="cursor-pointer block">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                  <Upload className="w-8 h-8" />
                </div>
                <p className="text-base sm:text-lg font-semibold text-slate-200 mb-1">
                  Drag and drop files here, or <span className="text-sky-400 underline">browse</span>
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  Max file size: 1 GB • Binary type verification active
                </p>
              </label>
            ) : (
              <div className="space-y-6">
                {/* File Preview */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-4 min-w-0">
                    {getFileIcon(selectedFile)}
                    <div className="text-left truncate">
                      <p className="font-semibold text-white truncate text-sm sm:text-base">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">
                        {formatFileSize(selectedFile.size)} • {selectedFile.type || 'MIME unknown'}
                      </p>
                    </div>
                  </div>

                  {!uploading && (
                    <button
                      onClick={clearFile}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Remove file"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Pre-upload Validation Badge */}
                {clientValidation && (
                  <div
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left text-xs ${
                      clientValidation.safe
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {clientValidation.safe ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold">
                        {clientValidation.safe ? 'Pre-check Passed' : 'Security Warning'}:
                      </span>{' '}
                      {clientValidation.message}
                    </div>
                  </div>
                )}

                {/* Upload Progress */}
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-mono text-slate-300">
                      <span>Uploading & analyzing binary signature...</span>
                      <span className="text-sky-400">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Success Message & Hash Details */}
                {uploadSuccess && uploadedFileData && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-left space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Upload & Integrity Verification Complete</span>
                    </div>
                    <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-xs font-mono space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Validated Type:</span>
                        <span className="text-slate-200">{uploadedFileData.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Vault Category:</span>
                        <span className="text-sky-400 uppercase">{uploadedFileData.category}</span>
                      </div>
                      <div className="pt-1">
                        <span className="text-slate-400 block mb-0.5">SHA-256 Checksum:</span>
                        <span className="text-amber-400 break-all text-[11px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {uploadedFileData.hash}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* MFA Verification Block */}
                {!mfaVerified && (
                  <div className="bg-amber-900/20 border border-amber-500/40 rounded-xl p-5 mb-4">
                    <h3 className="text-amber-300 font-bold mb-2">Upload Security — Aegis TOTP Required</h3>
                    <p className="text-xs text-amber-200/80 mb-3">Your account has TOTP MFA enabled. Enter your 6-digit Aegis Authenticator code and click Verify, then upload.</p>
                    <div className="flex flex-col sm:flex-row gap-2 mb-2">
                      <input type="text" inputMode="numeric" maxLength={6} value={mfaCode} onChange={e => { const v = e.target.value.replace(/\D/g,'').slice(0,6); setMfaCode(v); setMfaError(''); }} placeholder="Aegis verification code (6 digits)" className="bg-slate-950 border border-amber-500 px-3 py-2 rounded flex-1 text-sm font-mono tracking-widest" />
                      <button onClick={verifyMfa} disabled={verifyingMfa || mfaCode.trim().length !== 6} className="bg-amber-500 hover:bg-amber-400 px-4 py-2 rounded font-semibold text-slate-950 text-sm disabled:opacity-50">{verifyingMfa ? 'Verifying...' : 'Verify & Enable Upload'}</button>
                    </div>
                    {mfaError && <div className="text-red-300 text-xs">{mfaError}</div>}
                  </div>
                )}

                {/* Error Message */}
                {uploadError && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-left text-xs">
                    <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm mb-0.5">Upload Blocked by Security Rule</p>
                      <p>{uploadError}</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {!uploadSuccess ? (
                    <button
                      onClick={handleUpload}
                      disabled={uploading || (clientValidation && !clientValidation.safe)}
                      className={`flex-1 py-3 px-6 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                        uploading || (clientValidation && !clientValidation.safe)
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-lg shadow-sky-500/20'
                      }`}
                    >
                      <Lock className="w-4 h-4" />
                      {uploading ? 'Validating & Uploading...' : 'Upload Securely'}
                    </button>
                  ) : (
                    <button
                      onClick={clearFile}
                      className="flex-1 py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-all"
                    >
                      Upload Another File
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Validation & Security Checklist */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-slate-800/80">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/40 border border-slate-800">
              <Binary className="w-5 h-5 text-sky-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-white text-xs">Magic Number Detection</p>
                <p className="text-[11px] text-slate-400">Deep binary header inspection blocks extension spoofing</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/40 border border-slate-800">
              <ShieldAlert className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-white text-xs">Prohibited Types Blocked</p>
                <p className="text-[11px] text-slate-400">Strictly blocks executables (.exe, .bat, .elf, scripts)</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/40 border border-slate-800">
              <HardDrive className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-white text-xs">Sanitized Storage</p>
                <p className="text-[11px] text-slate-400">Prevents directory traversal & illegal characters</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
