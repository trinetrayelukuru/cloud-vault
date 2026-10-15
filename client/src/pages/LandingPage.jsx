import React from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  ShieldCheck,
  Lock,
  HardDrive,
  Fingerprint,
  Smartphone,
  FileCheck2,
  Activity,
  ArrowRight,
  ShieldAlert,
  Server,
  CloudUpload,
  CheckCircle2,
  Layers,
  ChevronRight
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
        {/* Background Glowing Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-sky-500/10 blur-[130px] rounded-full pointer-events-none"></div>
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[250px] bg-purple-500/10 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Top Project Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 shadow-inner mb-8">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            <span className="text-xs font-medium text-slate-300">
              College Capstone Project • Local-First Architecture
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-none mb-6">
            ☁️ CLOUD <span className="bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">VAULT</span>
          </h1>

          <p className="max-w-3xl mx-auto text-lg sm:text-xl text-slate-400 mb-12 leading-relaxed">
            Enterprise-grade secure cloud storage with multi-layered authentication,
            biometric passkeys, cryptographic file integrity verification, and zero-knowledge administration.
          </p>

          {/* TWO PRIMARY ROLE SELECTION CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left mb-16">

            {/* ROLE 1: USER */}
            <div className="relative group rounded-2xl p-1 bg-gradient-to-b from-sky-500/30 via-slate-800/50 to-slate-900 border border-sky-500/30 hover:border-sky-400/60 transition-all duration-300 shadow-xl shadow-sky-950/40 hover:-translate-y-1">
              <div className="bg-slate-950/90 backdrop-blur-xl rounded-[14px] p-7 sm:p-8 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:bg-sky-500/20 transition-colors">
                      <User className="w-8 h-8" />
                    </div>
                    <span className="px-3 py-1 rounded-full text-[11px] font-mono tracking-wider font-semibold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/30">
                      Standard Client
                    </span>
                  </div>

                  <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-sky-300 transition-colors">
                    👤 USER
                  </h2>
                  <p className="text-sm text-slate-400 mb-6 font-medium">
                    Secure Storage & Private File Management
                  </p>

                  <div className="space-y-3 mb-8 text-xs text-slate-300">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                      <span>Upload & categorize files with MIME-type byte validation</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                      <span>Dual-layer protection: Aegis TOTP MFA + Windows Hello / WebAuthn</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                      <span>Pre-download verification & cryptographic SHA-256 validation</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                      <span>Real-time personal storage telemetry and activity audit log</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80">
                  <Link
                    to="/user/login"
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-sky-600/25 transition-all group-hover:shadow-sky-500/40"
                  >
                    <span>Enter as User</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                  <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500 px-1">
                    <span>New here?</span>
                    <Link to="/user/register" className="text-sky-400 hover:underline font-medium">
                      Create an account →
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* ROLE 2: VAULT ADMIN */}
            <div className="relative group rounded-2xl p-1 bg-gradient-to-b from-purple-500/30 via-slate-800/50 to-slate-900 border border-purple-500/30 hover:border-purple-400/60 transition-all duration-300 shadow-xl shadow-purple-950/40 hover:-translate-y-1">
              <div className="bg-slate-950/90 backdrop-blur-xl rounded-[14px] p-7 sm:p-8 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                      <ShieldAlert className="w-8 h-8" />
                    </div>
                    <span className="px-3 py-1 rounded-full text-[11px] font-mono tracking-wider font-semibold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/30">
                      Security Lead
                    </span>
                  </div>

                  <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                    🛡️ VAULT ADMIN
                  </h2>
                  <p className="text-sm text-slate-400 mb-6 font-medium">
                    Security Oversight & Infrastructure Auditing
                  </p>

                  <div className="space-y-3 mb-8 text-xs text-slate-300">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                      <span><strong>Zero-Knowledge:</strong> Strictly cannot view or open user file contents</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                      <span>Real-time failed login monitoring & automated 3-attempt lockout alerts</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                      <span>Storage capacity, quota allocation, and per-user consumption stats</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                      <span>Account management: Temporary suspension and policy-based termination</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80">
                  <Link
                    to="/admin/login"
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-sm shadow-lg shadow-purple-600/25 transition-all group-hover:shadow-purple-500/40"
                  >
                    <span>Access Admin Console</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                  <div className="flex items-center justify-center mt-3 text-[11px] text-slate-500">
                    <span>Restricted to authorized vault operators</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Live Workflow Pipeline */}
          <div className="max-w-5xl mx-auto bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-md">
            <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-6 flex items-center justify-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              End-to-End Cryptographic Security Workflow
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center text-xs">
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                <div className="text-sky-400 font-bold mb-1">1. AUTH</div>
                <p className="text-[11px] text-slate-400">OAuth / Passwords</p>
              </div>
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                <div className="text-sky-400 font-bold mb-1">2. MFA</div>
                <p className="text-[11px] text-slate-400">Aegis / WebAuthn</p>
              </div>
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                <div className="text-sky-400 font-bold mb-1">3. INSPECT</div>
                <p className="text-[11px] text-slate-400">MIME byte detection</p>
              </div>
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                <div className="text-sky-400 font-bold mb-1">4. DIGEST</div>
                <p className="text-[11px] text-slate-400">SHA-256 calculation</p>
              </div>
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                <div className="text-sky-400 font-bold mb-1">5. STORE</div>
                <p className="text-[11px] text-slate-400">Isolated directory/S3</p>
              </div>
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                <div className="text-sky-400 font-bold mb-1">6. STEP-UP</div>
                <p className="text-[11px] text-slate-400">Pre-download verify</p>
              </div>
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl col-span-2 sm:col-span-1">
                <div className="text-emerald-400 font-bold mb-1">7. VERIFY</div>
                <p className="text-[11px] text-slate-400">Hash match & egress</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section className="py-16 bg-slate-950/70 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Built on Real Security Engineering
            </h2>
            <p className="text-sm text-slate-400">
              No simulated states or mock forms. Every feature implements standard cryptographic algorithms and protocols.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Feature 1 */}
            <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center mb-4">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">Aegis Authenticator TOTP</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scan standard RFC 6238 QR codes with Aegis on Android/iOS. Generates dynamic 30-second time-based one-time passwords for step-up actions.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
                <Fingerprint className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">Windows Hello / Passkeys</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Native WebAuthn biometric and PIN challenges utilizing your hardware security module without ever leaking biometric templates to the server.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">SHA-256 File Integrity</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Bit-level integrity validation during both ingress and egress streams. Detects unauthorized file alteration or bit rot in storage.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">Zero-Knowledge Admin</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Role-based separation ensures Vault Admins can monitor traffic spikes, failed logins, and disk quotas without any route to read raw payload data.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">Lockout & Rate Limiting</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                3-attempt brute-force protection with progressive backoff penalties and immediate administrative security event notifications.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
                <HardDrive className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">Storage Abstraction Layer</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Built-in driver interface allowing immediate local disk operation with seamless migration path to Amazon S3, Glacier, and EBS block storage.
              </p>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
