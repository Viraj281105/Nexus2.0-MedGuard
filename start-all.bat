@echo off
REM =============================================================================
REM MedGuard AI + AdvocAI — Complete Startup Script
REM Launches: Database (Docker) → Backend → Frontend in separate terminals
REM =============================================================================

setlocal enabledelayedexpansion

echo.
echo =====================================================
echo   MedGuard AI + AdvocAI - Complete Launch
echo =====================================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Docker is not installed or not in PATH
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

echo [✓] Docker detected
echo.

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] docker-compose is not available
    pause
    exit /b 1
)

echo [✓] Docker Compose detected
echo.

REM Check if Node.js is installed (for frontend)
node --version >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Node.js not found. Frontend will fail to start.
    echo Please install Node.js from: https://nodejs.org/
    echo.
)

REM Check if Python is installed (for backend)
python --version >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Python not found. Backend may fail to start.
    echo Please install Python from: https://www.python.org/
    echo.
)

echo.
echo =====================================================
echo   Starting Services in Separate Terminals...
echo =====================================================
echo.

REM Terminal 1: PostgreSQL + pgvector (Docker)
echo [1/3] Starting Database (PostgreSQL + pgvector) in new terminal...
start "MedGuard Database" cmd /k "docker-compose up db && pause"

REM Wait for database to be ready
echo.
echo [*] Waiting for database to start (30 seconds)...
timeout /t 30 /nobreak

echo.

REM Terminal 2: Backend (FastAPI)
echo [2/3] Starting Backend (FastAPI) in new terminal...
start "MedGuard Backend" cmd /k ^
  "cd backend && ^
   if not exist venv\ ( ^
     echo Creating virtual environment... && ^
     python -m venv venv && ^
     call venv\Scripts\activate.bat && ^
     echo Installing dependencies... && ^
     pip install -r requirements.txt ^
   ) else ( ^
     call venv\Scripts\activate.bat ^
   ) && ^
   echo. && ^
   echo Backend starting on http://127.0.0.1:8000 && ^
   echo API Docs: http://127.0.0.1:8000/docs && ^
   echo. && ^
   python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

REM Wait a bit for backend to start
echo.
echo [*] Waiting for backend to start (15 seconds)...
timeout /t 15 /nobreak

echo.

REM Terminal 3: Frontend (Next.js)
echo [3/3] Starting Frontend (Next.js) in new terminal...
start "MedGuard Frontend" cmd /k ^
  "cd frontend && ^
   npm install && ^
   echo. && ^
   echo Frontend starting on http://localhost:3000 && ^
   echo. && ^
   npm run dev"

echo.
echo =====================================================
echo   ✅ Launch Sequence Complete!
echo =====================================================
echo.
echo   📊 MONITORING TERMINALS:
echo   ├─ MedGuard Database  → PostgreSQL + pgvector
echo   ├─ MedGuard Backend   → FastAPI (Port 8000)
echo   └─ MedGuard Frontend  → Next.js (Port 3000)
echo.
echo   🌐 ACCESS POINTS:
echo   ├─ Frontend:     http://localhost:3000
echo   ├─ Backend API:  http://127.0.0.1:8000
echo   └─ API Docs:     http://127.0.0.1:8000/docs
echo.
echo   ⏱️  STARTUP TIME:
echo   ├─ Database:  ~15 seconds (already running)
echo   ├─ Backend:   ~10 seconds (Python compilation)
echo   └─ Frontend:  ~20-30 seconds (Turbopack compilation)
echo.
echo   💡 TIPS:
echo   ├─ Keep all three terminals running
echo   ├─ Monitor each terminal for errors/logs
echo   ├─ To stop everything: close each terminal window
echo   ├─ Or run: docker-compose down (in a new terminal)
echo   └─ Frontend auto-reloads on file changes
echo.
echo   🔗 Opening frontend in browser...
timeout /t 5 /nobreak

start http://localhost:3000

echo.
echo ✅ All services launched! Monitor the terminal windows for status.
echo.
echo You can safely close this launcher window.
echo.
pause
