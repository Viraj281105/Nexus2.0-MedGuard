@echo off
title MedGuard AI Launcher

echo =============================================
echo   MedGuard AI + AdvocAI  -  Auto Launcher
echo =============================================

echo.
echo [1/3] Starting Next.js Frontend in a new window...
start "MedGuard Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo [2/3] Starting FastAPI Backend in a new window...
start "MedGuard Backend" cmd /k "cd backend && call venv\Scripts\activate.bat && python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

echo.
echo [3/3] Waiting for servers to start up...
echo Please wait while Turbopack compiles the frontend...
timeout /t 30 /nobreak

echo.
echo Opening MedGuard in your default web browser...
start http://localhost:3000

echo.   
echo Launch sequence complete! 
echo Frontend: http://localhost:3000
echo Backend:  http://127.0.0.1:8000
echo Note: Keep the two newly opened terminal windows running.
echo You can safely close this launcher window now.
pause
