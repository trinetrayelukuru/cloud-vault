# ☁️ Cloud Vault — Secure Cloud Storage System

## Project Overview
- **Project Name:** Cloud Vault (CloudeVault)
- **Type:** College project — must actually work locally on PC
- **Path:** D:\cloude architecture design\cloudevault
- **Goal:** Secure cloud-based file storage & management system
- **Deployment:** Local first → AWS later (user will provide AWS credentials)

## Tech Stack
- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Database:** SQLite (local) → can migrate later
- **Storage:** Local filesystem first → AWS S3 later
- **Auth:** Google OAuth 2.0, TOTP MFA (Aegis), WebAuthn/Windows Hello
- **Security:** bcrypt hashing, JWT sessions, CSRF protection, rate limiting

## Two User Roles
1. **User** — uploads, manages, downloads files securely
2. **Vault Admin** — monitors users, storage, security events (CANNOT view file contents)

## Key Security Features
- Google OAuth 2.0 (real implementation)
- TOTP MFA with Aegis Authenticator (real QR code + verification)
- WebAuthn / Windows Hello / Passkeys
- Cloud Vault security password (hashed with bcrypt)
- SHA-256 file integrity verification
- Upload security verification (MFA or WebAuthn before upload)
- Download step-up authentication (password + MFA + optional WebAuthn)
- Failed login lockout (3 attempts → temporary lock)
- Rate limiting
- RBAC (role-based access control)
- Audit logging of all security events
- File type detection via MIME validation (not just extension)
- Secure filename handling
- Storage abstraction layer (LocalStorage ↔ S3Storage)

## Architecture
```
Browser → React Frontend → Express Backend API → SQLite DB
                                               → Storage Layer (Local/S3)
```

Later with AWS:
```
Browser → Frontend → Backend API → AWS SDK → S3
                                  → EC2/EBS/EFS/ELB/Auto Scaling/Glacier
```

## Storage Structure
```
cloud-vault-storage/
  images/user-id/
  documents/user-id/
  videos/user-id/
  archives/user-id/
```

## AWS Services (Later)
- S3 — primary file storage
- EC2 — compute
- EBS — EC2 block storage
- EFS — shared filesystem
- ELB — load balancing
- Auto Scaling — instance scaling
- S3 Lifecycle — storage transitions
- Glacier — archival

## Admin Capabilities
- User management (list, suspend, terminate)
- Storage monitoring (per-user and total)
- Security monitoring (login attempts, failed MFA, suspicious activity)
- Activity logs (uploads, downloads, deletes, shares)
- CANNOT view/download actual user file contents

## Development Phases (27 total)
- [x] Phase 1: Project setup and folder structure
- [x] Phase 2: Frontend landing/role-selection page
- [x] Phase 3: User authentication
- [x] Phase 4: Vault Admin authentication
- [x] Phase 5: Database
- [x] Phase 6: User dashboard
- [x] Phase 7: File upload
- [x] Phase 8: File type detection and validation
- [x] Phase 9: Local secure storage (AES-256-GCM + per-user keys)
- [ ] Phase 10: File listing/search/management
- [ ] Phase 11: Secure download
- [ ] Phase 12: SHA-256 file integrity
- [ ] Phase 13: Aegis TOTP MFA
- [ ] Phase 14: WebAuthn/Windows Hello
- [ ] Phase 15: Upload security
- [ ] Phase 16: Download step-up security
- [ ] Phase 17: Security activity/audit logs
- [ ] Phase 18: Vault Admin monitoring
- [ ] Phase 19: User suspension/termination
- [ ] Phase 20: Storage usage/cost dashboard
- [ ] Phase 21: Security hardening/testing
- [ ] Phase 22: AWS S3 integration
- [ ] Phase 23: AWS security/IAM
- [ ] Phase 24: S3 lifecycle/storage classes
- [ ] Phase 25: EC2/EBS/EFS architecture
- [ ] Phase 26: ELB + Auto Scaling architecture
- [ ] Phase 27: Final testing and project documentation

## Important Rules
- Step-by-step development (no code dumps)
- Each phase must work before moving to next
- Security features must be REAL (not fake UI)
- Local development first, AWS later
- No paid services required initially
- Admin cannot see file contents (privacy/separation of duties)
- Passwords never stored as plaintext
- Frontend never receives AWS credentials
- Storage abstraction layer for easy Local→S3 swap

## Session Log
### Session 1 — 2026-09-03
- Project initialized
- Full requirements documented (33 sections)
- Tech stack decided: React 19 + Node/Express + SQLite3 + Tailwind CSS
- Phase 1 completed:
  - Complete folder structure created
  - Backend initialized with all dependencies (express, sqlite3, bcrypt, otplib, webauthn, helmet, etc.)
  - Frontend initialized with Vite + React + Tailwind CSS
  - Verified backend modules and frontend build
  - README.md and root package.json created
- Phase 2 completed:
  - Beautiful landing page with User and Vault Admin role cards
  - React Router navigation setup
  - Navbar and Footer components with security badges
  - 7-step cryptographic workflow visualization
  - Placeholder login pages
- Phase 3 completed:
  - SQLite database schema (users, security_events, files tables)
  - User and SecurityEvent models with full CRUD operations
  - bcrypt password hashing (10 rounds)
  - JWT authentication middleware
  - Auth routes: register, login, logout, /me profile
  - 3-attempt failed login lockout (15 min timeout)
  - Security event logging for all auth actions
  - Frontend AuthContext with React Context API
  - Protected route wrapper component
  - Interactive User Login page with password visibility toggle
  - Interactive User Registration with real-time password strength indicator
  - User Dashboard with welcome screen
  - Dynamic Navbar showing logged-in user and logout button
  - Frontend build verified: 1,668 modules, 0 errors
- Phase 5 completed:
  - Enhanced database configuration with WAL mode for concurrent operations
  - Foreign key enforcement and comprehensive indexing on all tables
  - Complete File model with SHA-256 hash calculation and integrity verification
  - ShareLink model with secure token generation, expiration, and download limits
  - Enhanced User model with storage quota management (10 GB default)
  - Transaction helper for atomic database operations
  - Database migration tool for schema upgrades (`utils/migrate.js`)
  - Comprehensive database diagnostics script (`utils/dbCheck.js`)
  - All diagnostic tests passed: integrity check, user creation, file storage, SHA-256, share links, security events
- Phase 6 completed:
  - User dashboard API routes (`/api/user/dashboard`, `/api/user/profile`)
  - Real-time storage metrics (used/quota/percentage)
  - Recent files widget with live data from database
  - File category breakdown visualization
  - Security activity feed with event logging
  - Profile management endpoints
  - Enhanced UserDashboard.jsx with complete data visualization
  - Interactive quick action cards
  - Responsive grid layouts for all dashboard widgets
- Phase 7 completed:
  - LocalStorage abstraction layer (`storage/LocalStorage.js`)
  - Automatic directory initialization for file categories (images, documents, videos, archives, other)
  - File upload API routes (`/api/files/upload`, `/list`, `/search`, `/:fileId`, `DELETE /:fileId`)
  - Multer integration for multipart form data (1 GB file size limit)
  - Storage quota enforcement before upload
  - Automatic file category detection from MIME type
  - SHA-256 hash calculation for file integrity
  - Security event logging for all file operations (upload, delete)
  - FileUpload.jsx component with drag-and-drop support
  - Real-time upload progress tracking
  - Beautiful UI with file type icons (image, video, document, archive)
  - File size formatting and validation
  - Upload success/error messaging
  - Integration with dashboard storage metrics
  - Route added to App.jsx (`/user/upload`)
  - Backend and frontend both tested and running successfully

### Session 2 — 2026-09-04
- Phase 7 tested & verified:
  - Live upload, disk storage in category folders, SHA-256 hash match, search, and delete verified
- Phase 8 completed: File Type Detection and Validation
  - Built `server/utils/fileValidator.js` with comprehensive security inspection
  - Magic number / binary file signature detection for images, documents, archives, audio, video
  - Prohibited executable & script list strictly blocked (`.exe`, `.bat`, `.sh`, `.dll`, `.js`, etc.)
  - Extension vs binary spoofing detection (detects EXE disguised as PNG/PDF)
  - Filename sanitization against directory traversal (`../`, illegal Windows/Unix chars)
  - Security event logging for all blocked attacks and suspicious upload attempts
  - Revamped `client/src/pages/FileUpload.jsx` with dark-cyber UI, live pre-upload validation badge, and security info
  - Automated integration test suite (`server/utils/testValidation.js`) with 100% pass rate
- Phase 9 COMPLETED: Local Secure Storage (AES-256-GCM + per-user keys)
  - Per-user encryption keys via HKDF-SHA256 (master key + unique salt per user)
  - Per-file encryption salts for layered security
  - Encrypted filenames on disk (filenames unreadable without user's key)
  - Atomic writes (temp file + rename) for crash safety
  - Crypto-shredding deletion (3-pass overwrite + unlink)
  - SHA-256 integrity verification at rest
  - Secure temp directory with restrictive permissions (0o700)
  - File access audit logging (downloads, deletes, integrity checks, admin audit)
  - Admin audit endpoints: `/api/admin/audit/file-access`, `/audit/encryption-status`, `/audit/verify-all-files`
  - Storage abstraction maintained (LocalStorage ↔ S3Storage)
  - All 44 Phase 9 security tests PASS (0 failures)
