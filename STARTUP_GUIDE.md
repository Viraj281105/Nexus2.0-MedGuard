# 🚀 MedGuard AI + AdvocAI — Complete Startup Guide

## Quick Start (One Click!)

### **Option 1: Full Stack with Docker (Recommended)**
```bash
start-all.bat
```
This launches everything in separate terminals:
- **Terminal 1**: PostgreSQL Database (Docker)
- **Terminal 2**: FastAPI Backend
- **Terminal 3**: Next.js Frontend
- Automatically opens browser at `http://localhost:3000`

---

## Available Scripts

### 1. **start-all.bat** ⭐ (Use This!)
Complete startup script that launches all services in separate terminals.

**What it does:**
- ✅ Checks for Docker installation
- ✅ Starts PostgreSQL + pgvector in Docker
- ✅ Starts FastAPI Backend (port 8000)
- ✅ Starts Next.js Frontend (port 3000)
- ✅ Waits for services to stabilize
- ✅ Opens browser automatically

**How to use:**
1. Double-click `start-all.bat` in the root folder
2. Wait for all three terminal windows to open
3. Monitor each terminal for status messages
4. Browser opens automatically at `http://localhost:3000`

**Terminal Breakdown:**
| Terminal | Service | Port | Purpose |
|----------|---------|------|---------|
| MedGuard Database | PostgreSQL + pgvector | 5432 | Data storage with vector embeddings |
| MedGuard Backend | FastAPI | 8000 | API & AI agents |
| MedGuard Frontend | Next.js | 3000 | Web interface |

---

### 2. **stop-all.bat** 🛑
Gracefully shuts down all services.

```bash
stop-all.bat
```

**What it does:**
- Stops all Docker containers
- Cleans up resources
- Safe to run anytime

---

### 3. **status-check.bat** 📊
Checks if all services are running properly.

```bash
status-check.bat
```

**What it shows:**
- Docker status
- Which services are running
- Which ports are active
- Quick access to all URLs

---

## Prerequisites

Before running the startup scripts, ensure you have:

### Required:
- ✅ **Docker Desktop** — [Download](https://www.docker.com/products/docker-desktop)
- ✅ **Node.js** (for frontend) — [Download](https://nodejs.org/)
- ✅ **Python 3.11+** (for backend) — [Download](https://www.python.org/)

### Recommended:
- ✅ Environment variables configured (see below)

---

## Environment Variables

### For Backend (FastAPI)

Create a `.env` file in the `backend/` folder:

```env
# LLM Configuration
LLM_BACKEND=groq
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama3-70b-8192

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=advocai
POSTGRES_USER=postgres
POSTGRES_PASSWORD=advocai123

# JWT
JWT_SECRET=your_jwt_secret_here

# PubMed API (optional)
PUBMED_API_KEY=your_pubmed_key_here
```

### For Frontend (Next.js)

Create a `.env.local` file in the `frontend/` folder:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

---

## Access Points

Once all services are running:

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3000 | Web interface for users |
| **Backend API** | http://127.0.0.1:8000 | REST API endpoints |
| **API Docs** | http://127.0.0.1:8000/docs | Interactive API documentation (Swagger) |
| **Database** | localhost:5432 | PostgreSQL (internal) |

---

## Typical Startup Timeline

```
00s - start-all.bat runs
05s - Docker services starting...
15s - Database ready ✓
30s - Backend starting...
45s - Frontend starting...
60s - Browser opens at localhost:3000 ✓

Total: ~60-90 seconds
```

---

## Troubleshooting

### Issue: Docker is not installed
**Solution:** Download [Docker Desktop](https://www.docker.com/products/docker-desktop)

### Issue: Port already in use
**Error:** `Port 3000 is already in use`

**Solution:**
```bash
# Kill the process using the port
netstat -ano | find "3000"
taskkill /PID <PID> /F
```

### Issue: Frontend won't connect to Backend
**Check:**
- Backend terminal shows no errors
- `NEXT_PUBLIC_API_URL` is correct in `.env.local`
- Both are running on expected ports (3000 and 8000)

### Issue: Database connection failed
**Check:**
```bash
docker ps
```
Ensure `db` container is running and healthy.

### Issue: Node modules not installed
**Solution:** The script runs `npm install` automatically, but if it fails:
```bash
cd frontend
npm install
npm run dev
```

### Issue: Python virtual environment issues
**Solution:** The script creates and activates `venv` automatically, but if it fails:
```bash
cd backend
python -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

---

## Manual Startup (Alternative)

If you prefer to start services manually:

### Terminal 1: Database
```bash
docker-compose up db
```

### Terminal 2: Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Terminal 3: Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Docker-Only Startup (All in Docker)

If you prefer everything in Docker containers:

```bash
docker-compose up --build    # First time
docker-compose up            # Subsequent runs
```

To stop:
```bash
docker-compose down
```

---

## Common Commands

| Command | Description |
|---------|-------------|
| `start-all.bat` | Start everything in separate terminals |
| `stop-all.bat` | Stop all services |
| `status-check.bat` | Check service status |
| `docker-compose ps` | List running Docker containers |
| `docker-compose logs backend` | View backend logs |
| `docker-compose logs frontend` | View frontend logs |
| `docker-compose logs db` | View database logs |
| `docker-compose down` | Stop and remove all containers |
| `docker-compose down -v` | Stop and remove volumes (clean slate) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│         MedGuard AI (Web Browser)           │
│         http://localhost:3000               │
└────────────────────┬────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼─────────┐    ┌─────────▼─────────┐
│  Frontend       │    │  Backend API      │
│  Next.js 15     │    │  FastAPI          │
│  Port 3000      │    │  Port 8000        │
│  (React+TS)     │    │  (Python 3.11)    │
└────────┬────────┘    └─────────┬─────────┘
         │                       │
         │      ┌────────────────┘
         │      │
         │  ┌───▼────────────────┐
         │  │  PostgreSQL 16     │
         │  │  + pgvector        │
         │  │  Port 5432         │
         │  │  (Vector Embeddings)
         │  └────────────────────┘
         │
    ┌────▼────────────────┐
    │  AI Agent Pipeline  │
    ├─────────────────────┤
    │  1. Auditor         │
    │  2. Clinician       │
    │  3. Regulatory      │
    │  4. Barrister       │
    │  5. Judge           │
    └─────────────────────┘
```

---

## Need Help?

- Check the main [README.md](README.md) for detailed documentation
- Review [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) for API details
- Monitor terminal windows for real-time logs and error messages

---

**Happy Testing! 🚀**
