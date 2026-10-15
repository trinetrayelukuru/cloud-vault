# ☁️ Cloud Vault - Secure Cloud Storage System

A full-stack secure cloud storage application built for college project demonstration.

## 🎯 Project Overview

Cloud Vault is a secure file storage and management system with **two user roles**:
- **👤 User** - Upload, manage, and securely download files
- **🛡️ Vault Admin** - Monitor users, storage, and security events (cannot view file contents)

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + Vite 6 + Tailwind CSS 3 |
| **Backend** | Node.js + Express 4 |
| **Database** | SQLite 3 |
| **Authentication** | Google OAuth 2.0, JWT, Passport.js |
| **MFA** | TOTP (Aegis Authenticator compatible) |
| **WebAuthn** | Windows Hello / Passkeys |
| **Security** | bcrypt, Helmet, Rate Limiting, CSRF Protection |
| **Storage** | Local filesystem → AWS S3 (later) |

## 🔐 Security Features

✅ Google OAuth 2.0 (real implementation)  
✅ TOTP MFA with Aegis Authenticator  
✅ WebAuthn / Windows Hello / Passkeys  
✅ SHA-256 file integrity verification  
✅ Upload security verification  
✅ Download step-up authentication  
✅ Failed login lockout (3 attempts)  
✅ Rate limiting & brute force protection  
✅ RBAC (role-based access control)  
✅ Audit logging  
✅ File type detection via MIME validation  
✅ Secure password hashing (bcrypt)  
✅ Storage abstraction (Local ↔ S3)  

## 📁 Project Structure

```
cloudevault/
├── client/              # React frontend (Vite)
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Full page components
│   │   ├── services/    # API service layer
│   │   └── App.jsx
│   └── package.json
├── server/              # Express backend
│   ├── config/          # Database, Passport, Storage
│   ├── middleware/      # Auth, Rate Limiting, RBAC
│   ├── models/          # User, File, SecurityEvent
│   ├── routes/          # API endpoints
│   ├── services/        # Storage, Integrity, MFA
│   ├── storage/         # Local file storage
│   ├── database/        # SQLite database
│   └── server.js
└── docs/                # Architecture diagrams (later)
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ (you have v24.14.0 ✅)
- **npm** v9+ (you have v11.19.1 ✅)

### Installation

**1. Navigate to project folder:**
```bash
cd "D:\cloude architecture design\cloudevault"
```

**2. Install all dependencies:**
```bash
npm run install:all
```

Or install separately:
```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### Running the Application

**Option 1: Run separately in two terminals**

Terminal 1 (Backend):
```bash
cd server
npm run dev
```

Terminal 2 (Frontend):
```bash
cd client
npm run dev
```

**Option 2: Use root scripts**
```bash
# From project root
npm run server   # Start backend
npm run client   # Start frontend
```

### Access the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **Health Check:** http://localhost:3001/health

## 📋 Development Phases

- [x] **Phase 1:** Project setup and folder structure ✅
- [ ] **Phase 2:** Frontend landing/role-selection page
- [ ] **Phase 3:** User authentication
- [ ] **Phase 4:** Vault Admin authentication
- [ ] **Phase 5:** Database schema & models
- [ ] **Phase 6:** User dashboard
- [ ] **Phase 7:** File upload
- [ ] **Phase 8:** File type detection and validation
- [ ] **Phase 9:** Local secure storage
- [ ] **Phase 10:** File listing/search/management
- [ ] **Phase 11:** Secure download
- [ ] **Phase 12:** SHA-256 file integrity
- [ ] **Phase 13:** Aegis TOTP MFA
- [ ] **Phase 14:** WebAuthn/Windows Hello
- [ ] **Phase 15:** Upload security verification
- [ ] **Phase 16:** Download step-up security
- [ ] **Phase 17:** Security activity/audit logs
- [ ] **Phase 18:** Vault Admin monitoring
- [ ] **Phase 19:** User suspension/termination
- [ ] **Phase 20:** Storage usage/cost dashboard
- [ ] **Phase 21:** Security hardening/testing
- [ ] **Phase 22:** AWS S3 integration
- [ ] **Phase 23:** AWS security/IAM
- [ ] **Phase 24:** S3 lifecycle/storage classes
- [ ] **Phase 25:** EC2/EBS/EFS architecture
- [ ] **Phase 26:** ELB + Auto Scaling architecture
- [ ] **Phase 27:** Final testing and project documentation

## 🔧 Configuration

Backend configuration is in `server/.env`:
- JWT secret
- Google OAuth credentials (configure later)
- Storage type (local/s3)
- WebAuthn settings
- Rate limiting

## ☁️ AWS Integration (Later)

After local development is complete, AWS services will be integrated:
- **S3** - Primary file storage
- **EC2** - Compute instances
- **EBS** - EC2 block storage
- **EFS** - Shared filesystem
- **ELB** - Load balancing
- **Auto Scaling** - Instance scaling
- **Glacier** - Long-term archival

## 📝 Important Notes

- **Local First:** Application works completely offline on your PC
- **Real Security:** All security features are real implementations, not fake UI
- **Admin Privacy:** Vault Admin cannot view actual file contents
- **Step-by-Step:** Each phase must work before moving to next
- **Storage Abstraction:** Easy swap from local storage to AWS S3

## 🎓 College Project

This is a complete working application suitable for college demonstration, showcasing:
- Full-stack development
- Secure authentication & authorization
- Multi-factor authentication
- File storage & management
- Cloud architecture (AWS)
- Security best practices

---

**Status:** Phase 1 Complete ✅ (2026-09-03)
