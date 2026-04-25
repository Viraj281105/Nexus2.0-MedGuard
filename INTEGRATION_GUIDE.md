# Backend-Frontend Integration Guide

## Overview
The AdvocAI backend and frontend have been fully integrated with the following key features:
- **User Authentication**: JWT-based authentication with PostgreSQL persistence
- **User-Specific Cases**: Each user can only view and manage their own cases
- **Database Persistence**: All cases are stored in PostgreSQL with proper schema
- **Real-time Streaming**: Live event streaming as the AI agents process cases
- **Secure API Endpoints**: All endpoints (except auth) require authentication

---

## Architecture

### Database Schema Changes
✅ **Schema Updated** - `backend/advocai/storage/postgres/schema.sql`

New tables added:
- **users**: Stores user accounts with email and hashed passwords
- **user_sessions**: Links users to their case sessions (ownership tracking)
- **sessions**: Enhanced with case metadata (patient_name, insurer_name, procedure_denied, denial_date, notes, denial_path, policy_path, status)

### Backend API Endpoints

#### Authentication Endpoints
- **POST `/api/auth/register`** - Register new user
  - Body: `{ "email": "user@example.com", "password": "password123" }`
  - Returns: `{ "access_token": "...", "token_type": "bearer", "user": {...} }`

- **POST `/api/auth/login`** - Login existing user
  - Body: `{ "email": "user@example.com", "password": "password123" }`
  - Returns: `{ "access_token": "...", "token_type": "bearer", "user": {...} }`

- **GET `/api/auth/me`** - Get current user info (protected)
  - Headers: `Authorization: Bearer {token}`
  - Returns: `{ "id": "123", "email": "user@example.com" }`

- **POST `/api/auth/logout`** - Logout (protected)
  - Returns: 204 No Content

#### Case Management Endpoints
- **POST `/api/submit`** - Submit new case for analysis (protected)
  - Form data:
    - `bill_pdf` or `claim_pdf` (file)
    - `policy_pdf` (file)
    - `patient_name` (string)
    - `insurer_name` (string)
    - `procedure_billed` or `claim_issue` (string)
    - `bill_date` or `claim_date` (string)
    - `notes` (string)
    - `analysis_type` (string: "bill" or "insurance")
  - Returns: `{ "session_id": "...", "status": "queued" }`

- **GET `/api/cases`** - List all user's cases (protected)
  - Headers: `Authorization: Bearer {token}`
  - Returns: `{ "cases": [...] }`

- **GET `/api/case/{session_id}/stream`** - Stream case processing events (protected)
  - Headers: `Authorization: Bearer {token}`
  - Returns: Server-sent events stream
  - Event types: `agent_start`, `agent_done`, `agent_error`, `agent_stream`, `pipeline_done`, `error`

- **GET `/api/case/{session_id}/status`** - Get case status (protected)
  - Headers: `Authorization: Bearer {token}`
  - Returns: `{ "session_id": "...", "status": "queued|running|done|error", "events": [...] }`

- **GET `/api/case/{session_id}/result`** - Get case analysis result (protected)
  - Headers: `Authorization: Bearer {token}`
  - Returns: Analysis results from all agents

- **POST `/api/case/{session_id}/rescore`** - Rescore case with edited text (protected)
  - Headers: `Authorization: Bearer {token}`
  - Body: `{ "edited_text": "..." }`
  - Returns: Updated judge scorecard

- **GET `/api/case/{session_id}/download`** - Download appeal PDF (protected)
  - Headers: `Authorization: Bearer {token}`
  - Returns: PDF file download

- **DELETE `/api/case/{session_id}`** - Delete a case (protected)
  - Headers: `Authorization: Bearer {token}`
  - Returns: 204 No Content

---

## Frontend Integration

### API Client Configuration
✅ **Frontend API Configuration** - `frontend/src/lib/api.ts`

The frontend uses:
- **Base URL**: `process.env.NEXT_PUBLIC_API_URL` (set to `http://backend:8000` in docker-compose)
- **Token Storage**: localStorage with keys `advocai_token` and `advocai_user`
- **Auth Header**: `Authorization: Bearer {token}` for protected endpoints

### Frontend Pages
1. **Login/Register** (`/login`, `/register`)
   - Calls: `POST /api/auth/login` and `POST /api/auth/register`
   - Stores token and user info in localStorage

2. **Submit Case** (`/submit`)
   - Calls: `POST /api/submit` with form data
   - Redirects to case detail page with session_id

3. **Case Details** (`/case/[id]`)
   - Calls: `GET /api/case/{id}/stream` for real-time events
   - Displays agent progress and live letter generation

4. **History/Dashboard** (`/history`)
   - Calls: `GET /api/cases` to list user's cases

5. **Results** (`/results`)
   - Displays analysis results from case

---

## Authentication Flow

### User Registration
```
Frontend → POST /api/auth/register
           ↓
Backend → Validate email & password
         Create user in PostgreSQL
         Generate JWT token
         ↓
Frontend ← Return token + user info
           Store in localStorage
           Redirect to dashboard
```

### User Login
```
Frontend → POST /api/auth/login
           ↓
Backend → Verify credentials from PostgreSQL
         Generate JWT token
         ↓
Frontend ← Return token + user info
           Store in localStorage
           Redirect to dashboard
```

### Case Submission
```
Frontend → POST /api/submit (with auth token)
           ↓
Backend → Verify JWT token
         Check user ownership
         Create user_sessions entry
         Store files on disk
         Store metadata in PostgreSQL
         Queue async pipeline task
         ↓
Frontend ← Return session_id
           Redirect to /case/{session_id}
           Start SSE stream
```

### Case Retrieval
```
Frontend → GET /api/cases (with auth token)
           ↓
Backend → Verify JWT token
         Query user_sessions for user_id
         Return only user's cases
         ↓
Frontend ← Display user's case list
```

---

## Data Flow

### Case Processing Pipeline
```
1. User submits case files + metadata
   ↓
2. Backend creates PostgreSQL entries:
   - sessions table (case metadata + status)
   - user_sessions table (ownership link)
   ↓
3. Backend queues async pipeline task
   ↓
4. Async task runs agents sequentially:
   - Auditor (document parsing)
   - Clinician (medical review)
   - Regulatory (regulation analysis)
   - Barrister (appeal letter writing)
   - Judge (quality scoring)
   ↓
5. Each agent step emits events → stored in memory
   ↓
6. Frontend streams events via SSE
   - Updates UI with agent progress
   - Displays live letter generation
   ↓
7. Pipeline completes
   - Result stored in memory
   - PDF compiled
   - Status updated in PostgreSQL
   - SSE stream closes
```

---

## Configuration

### Environment Variables (Backend)

```bash
# Database
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=advocai
POSTGRES_USER=postgres
POSTGRES_PASSWORD=advocai123

# Auth
JWT_SECRET=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# LLM
LLM_BACKEND=groq
GROQ_API_KEY=your-groq-key
GROQ_MODEL=llama3-70b-8192

# Other
PUBMED_API_KEY=optional
```

### Docker Compose Configuration

```yaml
frontend:
  environment:
    NEXT_PUBLIC_API_URL: http://backend:8000
  ports:
    - "3000:3000"

backend:
  depends_on:
    db:
      condition: service_healthy
  environment:
    POSTGRES_HOST: db
    POSTGRES_PORT: 5432
  ports:
    - "8000:8000"

db:
  environment:
    POSTGRES_DB: advocai
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: advocai123
  ports:
    - "5432:5432"
```

---

## Key Implementation Details

### User Ownership Enforcement
✅ Every protected endpoint verifies:
1. JWT token is valid
2. User exists in PostgreSQL
3. Case belongs to the user (via user_sessions table)

```python
# Example from app.py
@app.get("/api/case/{session_id}/stream")
async def stream_case(
    session_id: str,
    current_user: Annotated[UserRecord, Depends(get_current_user)] = None,
):
    # Check ownership
    case = get_case_by_id(current_user.id, session_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or not owned by user")
```

### Database Functions
✅ All case operations in `backend/advocai/orchestrator/auth/db.py`:
- `create_case()` - Create new case with user_id
- `get_user_cases()` - Query user's cases
- `get_case_by_id()` - Get case if owned by user
- `update_case_status()` - Update case status
- `delete_case()` - Delete case if owned by user

### Event Streaming
✅ Real-time SSE stream from `/api/case/{session_id}/stream`:
- Emits agent progress events
- Streams barrister's letter generation
- Closes when pipeline completes
- Requires authentication and ownership

---

## Testing Checklist

- [ ] User can register
- [ ] User can login
- [ ] User can submit a case
- [ ] Case submission creates database entry
- [ ] User can list their cases
- [ ] User cannot see other users' cases
- [ ] Real-time streaming works
- [ ] Case can be deleted by owner
- [ ] Case cannot be accessed without auth token
- [ ] Case cannot be accessed by non-owner
- [ ] PDF download works after pipeline completes

---

## Deployment

### Local Development
```bash
docker-compose up --build
```

### Production Considerations
- [ ] Change `JWT_SECRET` to secure random value
- [ ] Use environment-specific configuration
- [ ] Enable HTTPS
- [ ] Set up proper database backups
- [ ] Configure CORS properly (currently allows all)
- [ ] Add rate limiting
- [ ] Add request validation
- [ ] Enable audit logging

---

## Common Issues & Solutions

### Issue: "Case not found or not owned by user"
**Solution**: Verify JWT token is valid and session_id belongs to current user

### Issue: "Unauthorized" on case endpoints
**Solution**: Include `Authorization: Bearer {token}` header in requests

### Issue: Frontend can't connect to backend
**Solution**: Verify `NEXT_PUBLIC_API_URL` environment variable is set correctly

### Issue: Database connection fails
**Solution**: Verify PostgreSQL is running and credentials are correct

---

## Summary

The integration provides:
✅ Secure user authentication with JWT  
✅ PostgreSQL persistence for users and cases  
✅ User-specific case isolation  
✅ Real-time event streaming  
✅ Protected API endpoints  
✅ Async case processing  
✅ Comprehensive error handling  

The backend now supports the complete frontend workflow with proper security and data isolation.
