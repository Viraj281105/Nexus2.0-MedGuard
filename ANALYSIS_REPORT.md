# Nexus 2.0 Project Analysis Report
## Critical Issues Found & Fixes Required

---

## 🔴 CRITICAL ISSUES

### 1. **Environment Variable Naming Mismatch (BLOCKING)**
**Severity:** CRITICAL - Database won't connect

**Problem:**
- `backend/advocai/config/settings.py` uses: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `backend/advocai/storage/postgres/connection.py` uses: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `docker-compose.yml` provides: `POSTGRES_*` variables
- **Result:** Settings.py never receives database config → DB initialization fails

**Fix:**
Standardize all to use `POSTGRES_*` variables across all modules.

---

### 2. **Missing .env File (BLOCKING)**
**Severity:** CRITICAL - Backend won't start

**Problem:**
- No `.env` file in project root
- Backend tries to load `.env` via `load_dotenv()`
- Missing required variables: `GROQ_API_KEY`, `JWT_SECRET`, `DEMO_MODE`
- **Result:** Backend fails to initialize LLM client

**Fix:**
Create `.env` file with required configuration.

---

### 3. **Database Schema Mismatch (BLOCKING)**
**Severity:** CRITICAL - Database operations will fail

**Problem:**
- `backend/advocai/orchestrator/auth/db.py` only creates `users` table
- Repository layer expects `sessions`, `agent_outputs`, `workflow_errors`, `resume_flags` tables
- `backend/advocai/storage/postgres/schema.sql` defines these tables but may not be applied
- **Result:** Case submissions will fail with "table does not exist" errors

**Fix:**
Ensure schema.sql is properly initialized and all tables are created on startup.

---

### 4. **Frontend Route Mismatch (BLOCKING)**
**Severity:** HIGH - Login redirects to non-existent page

**Problem:**
- Login success redirects to `/dashboard` (login page line ~95)
- No `/dashboard` route exists in frontend
- Available routes: `/`, `/login`, `/register`, `/submit`, `/case/[id]`, `/history`, `/results`
- **Result:** Authenticated users see 404 after login

**Fix:**
Redirect to `/submit` or `/history` instead of `/dashboard`.

---

### 5. **Frontend API URL Configuration (BLOCKING for local dev)**
**Severity:** HIGH - Frontend can't reach backend locally

**Problem:**
- Frontend defaults to `http://127.0.0.1:8000` (api.ts line 1)
- When running locally, frontend on `localhost:3000` tries to reach `127.0.0.1:8000`
- CORS is configured but browser may reject due to localhost vs 127.0.0.1 inconsistency
- No `.env.local` or environment configuration for local development
- **Result:** Local development fails with CORS or connection errors

**Fix:**
Create `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8000`.

---

## 🟡 HIGH PRIORITY ISSUES

### 6. **Duplicate Auth Router Registration**
**Severity:** HIGH - Potential routing conflicts

**Problem:**
- Auth router registered in `main.py` line ~62: `app.include_router(auth_router)`
- Also included in `app.py` mount operation on line ~51
- **Result:** Auth endpoints may be duplicated or inaccessible

**Fix:**
Register auth router only in `app.py`, remove from `main.py`.

---

### 7. **Frontend Case Fetching Issues**
**Severity:** HIGH - Cases won't load or stream

**Problem:**
- Case page streams from `/api/case/{session_id}/stream` 
- No error handling for failed connections
- Backend SSE may not be properly configured for streaming responses
- **Result:** Case details don't update in real-time

**Fix:**
Verify FastAPI SSE configuration and add error boundaries in frontend.

---

### 8. **CORS Origin Configuration**
**Severity:** MEDIUM - Security & Cross-origin issues

**Problem:**
- CORS allows all origins: `allow_origins=["*"]`
- In production, frontend and backend may be on different domains
- Browser sends `Origin` header that may be blocked

**Fix:**
Configure CORS to whitelist specific origins in environment variables.

---

## 🟠 MEDIUM PRIORITY ISSUES

### 9. **Database Connection Pool Issues**
**Severity:** MEDIUM - May cause connection exhaustion

**Problem:**
- PostgreSQL pool uses `SimpleConnectionPool` (minconn=1, maxconn=10)
- No connection recycling or timeout configuration
- Repository layer doesn't always call `putconn()` after exceptions
- **Result:** Connection pool may exhaust under load

**Fix:**
Implement proper connection lifecycle management with try-finally blocks.

---

### 10. **JWT Secret Regeneration on Restart**
**Severity:** MEDIUM - Sessions invalidated on restart

**Problem:**
- Auth config generates random JWT_SECRET if not provided (config.py line 31)
- Every backend restart generates new key
- All existing tokens become invalid
- **Result:** Users logged out after any deployment

**Fix:**
Require `JWT_SECRET` in `.env` file (already planned but needs enforcement).

---

### 11. **Missing Error Logging**
**Severity:** MEDIUM - Difficult to debug issues

**Problem:**
- Limited logging across pipeline
- No persistent error logs visible to frontend
- Backend errors don't propagate to frontend clearly
- **Result:** Debugging is difficult

**Fix:**
Add structured logging and expose error details to frontend in case detail response.

---

### 12. **Authentication Bypass in Demo Mode**
**Severity:** MEDIUM - Security risk if left in production

**Problem:**
- DEMO_MODE bypasses all JWT authentication (config.py line 20)
- May be accidentally left enabled in production
- No clear warning in logs when demo mode is active
- **Result:** Potential security vulnerability

**Fix:**
Add strict environment validation and visible warning on startup.

---

## 📋 ROUTING & CONNECTION SUMMARY

### Backend Entry Points
```
main.py (8000)
├── /api/* routes (AdvocAI endpoints)
├── /advocai/* mount (AdvocAI sub-app)
└── Health checks, file uploads

app.py (sub-application)
├── /api/auth/* (Authentication)
├── /api/submit (Case submission)
├── /api/cases (List cases)
└── /api/case/{id}/* (Case details, streaming, download)
```

### Frontend Routes
```
/ (home)
├── /login (authentication)
├── /register (new users)
├── /submit (case submission)
├── /case/[id] (case details + streaming)
├── /history (user's past cases)
└── /results (not fully documented)
```

### Database Tables (Expected)
```
users (created by db.py)
├── id, email, hashed_password, timestamps

sessions (created by schema.sql)
├── session_id, patient_name, insurer_name, procedure_denied, denial_date, ...

agent_outputs (created by schema.sql)
├── session_id, agent_stage, output_json, raw_text, timestamps

workflow_errors (created by schema.sql)
├── session_id, agent_stage, error_message, error_type, traceback

resume_flags (created by schema.sql)
├── session_id, is_resumable, last_safe_stage

user_sessions (junction table - NOT automatically created)
├── user_id, session_id (links users to their cases)
```

---

## ✅ REQUIRED FIXES (In Order)

1. **Create `.env` file** with proper database and LLM configuration
2. **Standardize env variable names** to use `POSTGRES_*` everywhere
3. **Fix frontend `.env.local`** for local development
4. **Create missing database tables** (`user_sessions` junction table)
5. **Fix frontend redirect** from `/dashboard` to `/submit`
6. **Remove duplicate auth router** registration
7. **Add proper error handling** for database and API failures
8. **Configure CORS properly** with environment-based origins
9. **Add comprehensive logging** for debugging

---

## 🔍 VERIFICATION CHECKLIST

After fixes:
- [ ] Backend starts without database errors
- [ ] Frontend can reach backend at localhost:8000
- [ ] Login → redirects to submit page (not 404)
- [ ] Submit case → creates session in database
- [ ] Case details page → streams agent progress
- [ ] Case download → generates PDF
- [ ] User sessions → properly linked to user accounts
- [ ] Docker compose up → all services healthy
- [ ] No CORS errors in browser console
- [ ] JWT tokens persist across page reloads

