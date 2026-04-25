@echo off
title MedGuard AI Backend

echo ========================================
echo Starting MedGuard AI...
echo ========================================

echo.
echo [1/2] Starting Next.js Frontend in a new window...
start "MedGuard AI Frontend" cmd /k "cd frontend && echo Installing NPM dependencies (if any)... && npm install && echo Starting Next.js development server... && npm run dev"

echo.
echo [2/2] Starting FastAPI Backend...
cd backend

IF NOT EXIST "venv\" (
    echo Virtual environment not found. Creating 'venv'...
    python -m venv venv
    echo Activating virtual environment and installing requirements...
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
) ELSE (
    echo Activating existing virtual environment...
    call venv\Scripts\activate.bat
)

echo.
echo Starting FastAPI server on port 8000...
python -m uvicorn main:app --reload --port 8000

pause
