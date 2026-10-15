import React from 'react';
import { Shield, Key, Fingerprint, Lock, Cpu, Server } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-900 text-slate-400 text-xs mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">

          {/* Col 1: Project Identity */}
          <div className="md:col-span-1">
            <div className="flex items-center space-x-2 text-white font-bold mb-2">
              <span className="text-base">☁️ CLOUD VAULT</span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed mb-4">
              Advanced college project demonstrating full-stack cloud security, multi-factor authentication, cryptographic verification, and scalable storage tiering.
            </p>
            <div className="text-[11px] text-slate-500 font-mono">
              Designed for local development with AWS S3/EC2 migration capability.
            </div>
          </div>

          {/* Col 2: Security Specifications */}
          <div>
            <h4 className="text-slate-200 font-semibold mb-3 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-sky-400" />
              Security Standards
            </h4>
            <ul className="space-y-2 text-slate-500">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                <span>SHA-256 Digest Integrity</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                <span>RFC 6238 TOTP (Aegis)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                <span>FIDO2 / WebAuthn Passkeys</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                <span>Bcrypt Password Hashing</span>
              </li>
            </ul>
          </div>

          {/* Col 3: Architecture Layers */}
          <div>
            <h4 className="text-slate-200 font-semibold mb-3 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-purple-400" />
              Architecture
            </h4>
            <ul className="space-y-2 text-slate-500">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                <span>Frontend: React 19 + Vite</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                <span>Backend: Node.js + Express 4</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                <span>DB: SQLite3 with Strict Types</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                <span>Storage: Pluggable Local ↔ S3</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Roles & Privacy */}
          <div>
            <h4 className="text-slate-200 font-semibold mb-3 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-400" />
              Separation of Duties
            </h4>
            <p className="text-slate-500 leading-relaxed">
              <strong className="text-slate-300">Vault Admin</strong> is strictly restricted from viewing, inspecting, or downloading user files. All administrative panels render metadata and security telemetry only.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-slate-600 text-[11px]">
          <div>
            © {new Date().getFullYear()} Cloud Vault Project — Secure File Management System
          </div>
          <div className="mt-2 sm:mt-0 font-mono text-slate-500 flex items-center gap-3">
            <span>Status: Phase 2 in progress</span>
            <span>•</span>
            <span>Environment: Localhost</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
