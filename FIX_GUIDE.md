# Nexus 2.0 — Complete Fix & Setup Guide

## Overview
Your Nexus 2.0 project has **connection issues due to environment misconfiguration, database schema mismatches, and frontend routing problems**. This guide walks through all fixes in order.

---

## 🚀 Quick Start (Follow in Order)

### Step 1: Create `.env` File (CRITICAL)
**Location:** `d:\Hackathons\Nexus2.0\.env`

Create this file with the following content:
```env
# =====================================================================
# LLM Configuration (Groq)
# =====================================================================
LLM_BACKEND=groq
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama3-70b-8192

# =====================================================================
# Database Configuration (PostgreSQL)
# =====================================================================
PERSISTENCE_BACKEND=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=advocai
POSTGRES_USER=postgres
POSTGRES_PASSWORD=advocai123
DB_ENABLE_POOL=true

# =====================================================================
# Authentication Configuration
# =====================================================================
DEMO_MODE=false
JWT_SECRET=your_jwt_secret_here_use_32_chars_minimum
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# =====================================================================
# Optional
# =====================================================================
PUBMED_API_KEY=
```

**⚠️ IMPORTANT:**
- Get your `GROQ_API_KEY` from https://console.groq.com/keys
- Generate `JWT_SECRET` with: `python -c "import secrets; print(secrets.token_hex(32))"`
- **Never commit this file** — add to `.gitignore`

---

### Step 2: Verify Fixes Applied ✅
The following fixes have already been implemented:

#### ✅ Fixed: Database Config Variable Names
**File:** `backend/advocai/config/settings.py`
- Changed from `DB_*` to `POSTGRES_*` for consistency
- Now matches `docker-compose.yml` and `connection.py`

#### ✅ Fixed: Frontend `.env.local`
**File:** `frontend/.env.local`
- Created with `NEXT_PUBLIC_API_URL=http://localhost:8000`
- Enables local development without CORS issues

#### ✅ Fixed: Login Redirect Route
**File:** `frontend/src/app/login/page.tsx`
- Changed redirect from `/dashboard` (doesn't exist) → `/submit`
- Users now redirect to case submission page after login

#### ✅ Fixed: Duplicate Auth Router
**File:** `backend/main.py`
- Removed duplicate `app.include_router(auth_router)`
- Auth routes now registered only once via `advocai_app` mount

#### ✅ Fixed: Database Schema Initialization
**File:** `backend/advocai/storage/postgres/connection.py`
- Added automatic schema loading from `schema.sql`
- All tables created on startup (users, sessions, agent_outputs, workflow_errors, resume_flags)

#### ✅ Fixed: Backend Startup Logging
**File:** `backend/advocai/orchestrator/app.py`
- Enhanced startup logging for debugging
- Shows database initialization status

---

### Step 3: Start the Application

#### Option A: Local Development (No Docker)
```bash
# Terminal 1 — Backend
cd d:\Hackathons\Nexus2.0\backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend
cd d:\Hackathons\Nexus2.0\frontend
npm install
npm run dev
```

Backend: http://localhost:8000
Frontend: http://localhost:3000

#### Option B: Docker Compose (Recommended)
```bash
cd d:\Hackathons\Nexus2.0
docker-compose up --build
```

Backend: http://localhost:8000
Frontend: http://localhost:3000
Database: localhost:5432

---

## 🔍 Verification Checklist

### Backend Health Checks
- [ ] Backend starts without errors (no "POSTGRES_HOST not found")
- [ ] Logs show "✓ Database initialization complete"
- [ ] Health endpoint works: `curl http://localhost:8000`
- [ ] Auth routes exist: `curl http://localhost:8000/api/auth/login`
- [ ] No port 8000 already in use errors

### Frontend Health Checks
- [ ] Frontend builds successfully: `npm run build` completes
- [ ] Frontend runs: `npm run dev` starts at http://localhost:3000
- [ ] No "Cannot reach backend" errors in browser console
- [ ] Logo and UI render properly

### Connection Checks
- [ ] Frontend can reach backend (check Network tab in browser DevTools)
- [ ] No CORS errors in browser console
- [ ] Database connection works (Docker logs show no connection errors)

### Authentication Flow
- [ ] Can access login page: http://localhost:3000/login
- [ ] Can see register link: http://localhost:3000/register
- [ ] Login with demo user redirects to `/submit` (not 404)
- [ ] Token stored in localStorage after login

### Case Submission Flow
- [ ] Can upload file on `/submit` page
- [ ] Submit creates new case in database
- [ ] Can view case details on `/case/[id]` page
- [ ] Can see agent progress streaming in real-time

---

## 📊 Architecture Verification

### API Routes (Correct After Fixes)
```
Backend (8000)
├── GET / (root health check)
├── GET /docs (Swagger documentation)
├── /api/auth/*
│   ├── POST /api/auth/register (create user)
│   ├── POST /api/auth/login (authenticate)
│   ├── GET /api/auth/me (current user)
│   └── POST /api/auth/logout (client-side)
├── POST /api/submit (submit case)
├── GET /api/cases (list user cases)
├── DELETE /api/case/{session_id} (delete case)
├── GET /api/case/{session_id}/stream (SSE streaming)
├── GET /api/case/{session_id}/status (case status)
├── GET /api/case/{session_id}/result (case result)
├── POST /api/case/{session_id}/rescore (judge feedback)
└── GET /api/case/{session_id}/download (PDF packet)
```

### Database Tables (Auto-created)
```
users (for authentication)
├── id (primary key)
├── email (unique)
├── hashed_password
└── created_at, updated_at

sessions (case workflow tracking)
├── session_id (UUID)
├── patient_name, insurer_name, procedure_denied
├── status (queued, processing, completed, failed)
├── last_completed_stage
└── created_at, updated_at

user_sessions (user → session mapping)
├── user_id (FK → users)
├── session_id (FK → sessions)
└── created_at

agent_outputs (agent results)
├── session_id, agent_stage (auditor/clinician/regulatory/barrister/judge)
├── output_json, raw_text
└── created_at

workflow_errors (error tracking)
├── session_id, agent_stage
├── error_message, error_type, traceback
└── created_at

resume_flags (resume/pause tracking)
├── session_id
├── is_resumable, last_safe_stage
└── updated_at
```

---

## 🐛 Troubleshooting

### "POSTGRES_HOST not found" or Database Connection Errors
**Cause:** `.env` file not created or missing database variables
**Fix:** 
1. Create `.env` file (see Step 1)
2. Ensure variables match docker-compose.yml exactly
3. Restart backend

### "Cannot GET /submit" (404) After Login
**Cause:** Old redirect to `/dashboard` not fixed
**Status:** ✅ Already fixed in code

### CORS Errors in Browser Console
**Cause:** Frontend and backend origins mismatch
**Solutions:**
- Verify `NEXT_PUBLIC_API_URL` in `frontend/.env.local`
- Use `localhost` not `127.0.0.1` consistently
- Check browser console Network tab for actual requests

### "Port 8000 already in use"
**Solution:**
```bash
# Kill process on port 8000
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Or use the provided script:
.\demo-mode.bat  # runs on different ports if needed
```

### Database Tables Don't Exist
**Cause:** Schema not initialized
**Solution:**
1. Check if PostgreSQL is running
2. Verify database exists: `psql -U postgres -d advocai`
3. Check logs for schema initialization errors
4. Manually run: `psql -U postgres -d advocai < backend/advocai/storage/postgres/schema.sql`

### JWT Tokens Not Persisting
**Cause:** Browser localStorage not available or cleared
**Solution:**
- Check browser DevTools → Application tab → localStorage
- Verify `apiUrl` function in `frontend/src/lib/api.ts` uses correct URL
- Check Network tab to see actual request/response

---

## 📝 What Was Fixed

| Issue | Root Cause | Fix | Status |
|-------|-----------|-----|--------|
| DB connection fails | Mismatched env var names (DB_* vs POSTGRES_*) | Use POSTGRES_* consistently | ✅ Fixed |
| Login redirects to 404 | Route `/dashboard` doesn't exist | Redirect to `/submit` | ✅ Fixed |
| No .env file | Not in repo | Create with all required vars | ✅ Document provided |
| Frontend can't reach backend | No API URL config for localhost | Created `frontend/.env.local` | ✅ Created |
| Duplicate auth routes | Auth router registered twice | Remove duplicate include_router | ✅ Fixed |
| Schema not initialized | Connection pool doesn't load schema.sql | Auto-load schema on pool init | ✅ Fixed |
| Unclear startup issues | Poor logging | Enhanced startup logs | ✅ Fixed |

---

## 🚀 Next Steps

1. **Create `.env` file** (Step 1 above)
2. **Start services** (Step 3 above)
3. **Run verification checklist** to confirm all working
4. **Check logs** if any issues:
   - Backend: `docker logs nexus2_0-backend-1` (or terminal output)
   - Frontend: Check browser console
   - Database: `docker logs nexus2_0-db-1`

---

## 📞 Still Having Issues?

If something isn't working:

1. **Check logs first** — they contain the actual error
2. **Verify .env file** exists and has all required variables
3. **Ensure ports available** (8000, 3000, 5432)
4. **Check environment variables** match exactly (case-sensitive on Linux)
5. **Rebuild Docker** if using containers: `docker-compose down && docker-compose up --build`

---

## 📚 Additional Resources

- **Groq API Keys:** https://console.groq.com/keys
- **FastAPI Docs:** http://localhost:8000/docs (when running)
- **Next.js Docs:** https://nextjs.org/docs
- **Docker Compose:** https://docs.docker.com/compose/

---

**Last Updated:** 2026-04-26
**Project:** Nexus 2.0 (MedGuard AI + AdvocAI)
**Status:** Core connection issues fixed ✅
