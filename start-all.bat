@echo off
setlocal enabledelayedexpansion

REM =============================================================================
REM MedGuard AI + AdvocAI — Complete Startup Script (FIXED)
REM =============================================================================

REM Get the directory where this script is located
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

echo.
echo =====================================================
echo   MedGuard AI + AdvocAI - Complete Launch
echo =====================================================
echo.

REM --- Check Docker ---
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed or not in PATH
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
echo [✓] Docker detected

REM --- Check Docker Compose ---
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] docker-compose is not available
    pause
    exit /b 1
)
echo [✓] Docker Compose detected

REM --- Check Node.js ---
node --version >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Node.js not found. Frontend will fail to start.
)
echo.

REM =====================================================
echo   Starting Services in Separate Terminals...
echo =====================================================
echo.

REM --- 1. Database ---
echo [1/3] Starting Database (PostgreSQL + pgvector)...
start "MedGuard Database" cmd /c "cd /d "%PROJECT_DIR%" && docker-compose up db"
echo [*] Waiting for database to start (30 seconds)...
timeout /t 30 /nobreak
echo.

REM --- 2. Backend ---
echo [2/3] Starting Backend (FastAPI)...
start "MedGuard Backend" cmd /c "cd /d "%PROJECT_DIR%backend" && if not exist venv\ (python -m venv venv && call venv\Scripts\activate.bat && pip install -r requirements.txt) else (call venv\Scripts\activate.bat) && python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"
echo [*] Waiting for backend to start (15 seconds)...
timeout /t 15 /nobreak
echo.

REM --- 3. Frontend ---
echo [3/3] Starting Frontend (Next.js)...
start "MedGuard Frontend" cmd /c "cd /d "%PROJECT_DIR%frontend" && call npm install && call npm run dev"
echo.

echo =====================================================
echo   ✅ Launch Sequence Complete!
echo =====================================================
echo.
echo   🌐 ACCESS POINTS:
echo   ├─ Frontend:     http://localhost:3000
echo   ├─ Backend API:  http://127.0.0.1:8000
echo   └─ API Docs:     http://127.0.0.1:8000/docs
echo.
echo   ⏱️  STARTUP TIME:
echo   ├─ Database:  ~15 seconds
echo   ├─ Backend:   ~10 seconds
echo   └─ Frontend:  ~20-30 seconds (Turbopack compilation)
echo.
echo   💡 TIPS:
echo   ├─ Keep all three terminals running
echo   ├─ Monitor each terminal for errors/logs
echo   ├─ To stop everything: close each terminal window
echo   └─ Or run: docker-compose down (in a new terminal)
echo.
timeout /t 5 /nobreak
start http://localhost:3000

echo ✅ All services launched! Monitor the terminal windows for status.
echo You can safely close this launcher window.
pause