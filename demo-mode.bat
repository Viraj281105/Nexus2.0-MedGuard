@echo off
REM =============================================================================
REM Enable Demo Mode and Start Backend
REM Bypasses authentication for testing and demonstrations
REM =============================================================================

setlocal enabledelayedexpansion

echo.
echo =====================================================
echo   AdvocAI - Demo Mode Backend Start
echo =====================================================
echo.
echo Enabling Demo Mode (authentication disabled)...
echo.

set DEMO_MODE=true
set GROQ_API_KEY=%GROQ_API_KEY%
set GROQ_MODEL=%GROQ_MODEL%

cd backend

if not exist "venv\" (
    echo Creating virtual environment...
    python -m venv venv
    call venv\Scripts\activate.bat
    echo Installing dependencies...
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

echo.
echo =====================================================
echo   🔓 DEMO MODE ENABLED
echo =====================================================
echo.
echo   Authentication:  DISABLED
echo   Demo User:       demo@advocai.local (ID: 999)
echo   Auto-login:      Yes, all requests authenticated
echo.
echo   Backend will start on http://127.0.0.1:8000
echo   API Docs:        http://127.0.0.1:8000/docs
echo.
echo   ⚠️  WARNING: Demo mode for testing only!
echo   Never enable in production.
echo.
echo =====================================================
echo.

python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

pause
