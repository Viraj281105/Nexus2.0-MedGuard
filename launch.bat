@echo off
title MedGuard AI Launcher

echo =============================================
echo   MedGuard AI + AdvocAI  -  Auto Launcher
echo =============================================

echo.
echo [1/3] Starting Next.js Frontend in a new window...
start "MedGuard Frontend" cmd /k "cd frontend && npm install && npm run dev"

echo.
echo [2/3] Starting FastAPI Backend in a new window...
start "MedGuard Backend" cmd /k "cd backend && (if not exist venv\ python -m venv venv) && call venv\Scripts\activate.bat && pip install -r requirements.txt && python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

echo.
echo [3/3] Waiting 15 seconds for servers to start up...
timeout /t 15 /nobreak

echo.
echo Opening MedGuard in your default web browser...
start http://localhost:3000

echo.
echo Launch sequence complete! 
echo Note: Keep the two newly opened terminal windows running.
echo You can safely close this launcher window now.
pause
