@echo off
title MedGuard AI + AdvocAI

echo =============================================
echo   MedGuard AI + AdvocAI  -  Starting...
echo =============================================

echo.
echo [1/2] Starting Next.js Frontend in a new window...
start "MedGuard Frontend" cmd /k "cd frontend && npm install && npm run dev"

echo.
echo [2/2] Starting FastAPI Backend...
cd backend

IF NOT EXIST "venv\" (
    echo Virtual environment not found. Creating 'venv'...
    python -m venv venv
    echo Activating and installing requirements...
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
) ELSE (
    echo Activating existing virtual environment...
    call venv\Scripts\activate.bat
)

echo.
echo Starting FastAPI on port 8000...
echo.
echo  Frontend  -> http://localhost:3000
echo  Backend   -> http://127.0.0.1:8000
echo  API Docs  -> http://127.0.0.1:8000/docs
echo.
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

pause
