import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Shield,
  Smartphone,
  Key,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Fingerprint
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function SecuritySettings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // TOTP MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSetupMode, setMfaSetupMode] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [mfaMessage, setMfaMessage] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  // WebAuthn state
  const [webauthnAvailable, setWebauthnAvailable] = useState(false);
  const [webauthnCredentials, setWebauthnCredentials] = useState([]);
  const [webauthnMessage, setWebauthnMessage] = useState('');
  const [webauthnError, setWebauthnError] = useState('');

  const token = localStorage.getItem('cloudvault_token');

  useEffect(() => {
    // Check WebAuthn browser support
    if (window.PublicKeyCredential) {
      setWebauthnAvailable(true);
    }
    // Load current MFA status
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMfaEnabled(res.data.user.mfaEnabled);
      if (res.data.user.webauthnEnabled) {
        try {
          setWebauthnCredentials(JSON.parse(res.data.user.webauthnEnabled));
        } catch { setWebauthnCredentials([]); }
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  // =================== TOTP MFA ===================

  const startMfaSetup = async () => {
    setMfaError('');
    setMfaMessage('');
    try {
      const res = await axios.post(`${API_URL}/api/auth/mfa/setup`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQrCode(res.data.qrCodeUrl);
      setSecret(res.data.secret);
      setMfaSetupMode(true);
    } catch (err) {
      setMfaError(err.response?.data?.error || 'Failed to start MFA setup');
    }
  };

  const verifyTotpCode = async () => {
    setMfaError('');
    setMfaMessage('');
    if (!totpCode || totpCode.length !== 6) {
      setMfaError('Enter a 6-digit code from your authenticator');
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/api/auth/mfa/verify`, { code: totpCode }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.valid) {
        setMfaMessage('MFA enabled successfully! Your account is now protected.');
        setMfaEnabled(true);
        setMfaSetupMode(false);
        setTotpCode('');
        setQrCode('');
        setSecret('');
      } else {
        setMfaError('Invalid code. Check your authenticator and try again.');
      }
    } catch (err) {
      setMfaError(err.response?.data?.error || 'Verification failed');
    }
  };

  const disableMfa = async () => {
    if (!confirm('Disable MFA? Your account will be less secure.')) return;
    setMfaError('');
    setMfaMessage('');
    try {
      await axios.post(`${API_URL}/api/auth/mfa/disable`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMfaEnabled(false);
      setMfaMessage('MFA has been disabled.');
    } catch (err) {
      setMfaError('Failed to disable MFA');
    }
  };

  // =================== WEBAUTHN / PASSKEY ===================

  const registerPasskey = async () => {
    setWebauthnError('');
    setWebauthnMessage('');
    try {
      // Get registration options from server
      const optionsRes = await axios.get(`${API_URL}/api/auth/webauthn/register-options`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const options = optionsRes.data.options;

      // Call browser WebAuthn API (triggers Windows Hello / Face / Fingerprint)
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: (() => { const s = options.challenge.replace(/-/g,'+').replace(/_/g,'/'); const b = atob(s); const u = new Uint8Array(b.length); for (let i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u.buffer; })(),
          rp: { name: 'Cloud Vault', id: 'localhost' },
          user: {
            id: new TextEncoder().encode(options.user?.id || 'cloudvault-user'),
            name: options.user?.name || 'user',
            displayName: options.user?.displayName || 'CloudVault User'
          },
          pubKeyCredParams: options.pubKeyCredParams || [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required'
          },
          timeout: 60000
        }
      });

      // Send credential to server for verification
      const toBase64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
      await axios.post(`${API_URL}/api/auth/webauthn/register-verify`, {
        credential: {
          id: toBase64url(credential.rawId),
          type: credential.type,
          rawId: toBase64url(credential.rawId),
          response: {
            clientDataJSON: toBase64url(credential.response.clientDataJSON),
            attestationObject: toBase64url(credential.response.attestationObject),
            authenticatorData: toBase64url(credential.response.authenticatorData)
          },
          clientExtensionResults: credential.getClientExtensionResults ? credential.getClientExtensionResults() : {}
        },
        expectedChallenge: options.challenge
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setWebauthnMessage('Passkey registered! You can now use Windows Hello / biometric login.');
      loadProfile();
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setWebauthnError('Authentication cancelled. Please try again.');
      } else {
        setWebauthnError(err.response?.data?.error || 'Passkey registration failed. Make sure your browser supports WebAuthn.');
      }
    }
  };

  const authenticatePasskey = async () => {
    setWebauthnError('');
    setWebauthnMessage('');
    try {
      const optionsRes = await axios.get(`${API_URL}/api/auth/webauthn/auth-options`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const options = optionsRes.data.options;

      await navigator.credentials.get({
        publicKey: {
          challenge: (() => { const s = options.challenge.replace(/-/g,'+').replace(/_/g,'/'); const b = atob(s); const u = new Uint8Array(b.length); for (let i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u.buffer; })(),
          timeout: 60000,
          userVerification: 'required'
        }
      });

      setWebauthnMessage('Passkey verified! Windows Hello authentication working.');
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setWebauthnError('Authentication cancelled.');
      } else {
        setWebauthnError('Passkey authentication failed.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4 text-slate-100">
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-6">
          <Link to="/user/dashboard" className="hover:text-sky-400 transition-colors">DASHBOARD</Link>
          <span>/</span>
          <span className="text-sky-400">SECURITY SETTINGS</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Security Settings
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Configure Aegis Authenticator, Passkeys & Windows Hello
              </p>
            </div>
          </div>
        </div>

        {/* =================== AEGIS TOTP MFA SECTION =================== */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Aegis Authenticator (TOTP MFA)</h2>
              <p className="text-xs text-slate-400">Standard 6-digit code from your phone</p>
            </div>
            <div className="ml-auto">
              {mfaEnabled ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Disabled
                </span>
              )}
            </div>
          </div>

          {!mfaSetupMode && !mfaEnabled && (
            <div>
              <p className="text-sm text-slate-300 mb-4">
                Enable MFA to protect your uploads and downloads with a 6-digit code from Aegis Authenticator.
              </p>
              <button
                onClick={startMfaSetup}
                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20"
              >
                Enable Aegis MFA
              </button>
            </div>
          )}

          {mfaSetupMode && (
            <div className="space-y-6">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Step 1: Scan QR Code in Aegis</h3>
                <div className="flex flex-col sm:flex-row gap-6 items-center">
                  {qrCode && (
                    <div className="bg-white p-3 rounded-xl">
                      <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
                    </div>
                  )}
                  <div className="flex-1 space-y-3">
                    <p className="text-xs text-slate-400">
                      Open <span className="text-white font-semibold">Aegis Authenticator</span> on your phone.
                      Tap <span className="text-white font-semibold">+</span> → <span className="text-white font-semibold">Scan QR Code</span>.
                    </p>
                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 mb-1 font-mono">Manual entry key:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-amber-400 font-mono flex-1 break-all">
                          {showSecret ? secret : '••••••••••••••••'}
                        </code>
                        <button
                          onClick={() => setShowSecret(!showSecret)}
                          className="p-1.5 text-slate-400 hover:text-white"
                        >
                          {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => { navigator.clipboard.writeText(secret); }}
                          className="p-1.5 text-slate-400 hover:text-white"
                          title="Copy"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Step 2: Enter 6-digit code</h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-center text-xl font-mono text-white tracking-[0.3em] focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    onClick={verifyTotpCode}
                    disabled={totpCode.length !== 6}
                    className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                      totpCode.length === 6
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    Verify & Enable
                  </button>
                </div>
                <button
                  onClick={() => { setMfaSetupMode(false); setQrCode(''); setSecret(''); setTotpCode(''); }}
                  className="mt-3 text-xs text-slate-500 hover:text-slate-300"
                >
                  Cancel setup
                </button>
              </div>
            </div>
          )}

          {mfaEnabled && !mfaSetupMode && (
            <div className="flex items-center gap-4">
              <p className="text-sm text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                MFA is protecting your account
              </p>
              <button
                onClick={disableMfa}
                className="px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-colors"
              >
                Disable MFA
              </button>
            </div>
          )}

          {mfaMessage && (
            <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {mfaMessage}
            </div>
          )}
          {mfaError && (
            <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              {mfaError}
            </div>
          )}
        </div>

        {/* =================== WEBAUTHN / PASSKEY SECTION =================== */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Windows Hello / Passkey</h2>
              <p className="text-xs text-slate-400">Biometric / PIN / Face recognition</p>
            </div>
            <div className="ml-auto">
              {webauthnAvailable ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Supported
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" />
                  Not Available
                </span>
              )}
            </div>
          </div>

          {webauthnAvailable ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                Register a passkey to use your laptop's Windows Hello (face, fingerprint, or PIN) for upload and download security.
              </p>

              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={registerPasskey}
                  className="px-6 py-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-sm transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  Register Passkey
                </button>
                {webauthnCredentials.length > 0 && (
                  <button
                    onClick={authenticatePasskey}
                    className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-all border border-slate-700 flex items-center gap-2"
                  >
                    <Fingerprint className="w-4 h-4" />
                    Test Passkey
                  </button>
                )}
              </div>

              {webauthnCredentials.length > 0 && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-2">Registered passkeys:</p>
                  {webauthnCredentials.map((cred, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-mono text-xs truncate">{cred.id?.substring(0, 30)}...</span>
                      <span className="text-xs text-slate-500">({cred.type})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-6 text-center">
              <Lock className="w-8 h-8 text-slate-500 mx-auto mb-3" />
              <p className="text-sm text-slate-400">
                Your browser doesn't support WebAuthn. Use Chrome or Edge on Windows 10/11.
              </p>
            </div>
          )}

          {webauthnMessage && (
            <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {webauthnMessage}
            </div>
          )}
          {webauthnError && (
            <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              {webauthnError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
