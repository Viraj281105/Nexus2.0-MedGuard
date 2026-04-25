@echo off
REM =============================================================================
REM MedGuard AI + AdvocAI — Status Check Script
REM Checks the health of all running services
REM =============================================================================

setlocal enabledelayedexpansion

echo.
echo =====================================================
echo   MedGuard AI + AdvocAI - Service Status
echo =====================================================
echo.

REM Check Docker
echo [*] Checking Docker...
docker --version >nul 2>&1
if errorlevel 0 (
    echo [✓] Docker is installed
) else (
    echo [✗] Docker is NOT installed
)

echo.

REM Check Docker Compose
echo [*] Checking Docker Compose services...
docker-compose ps

echo.

REM Check Frontend
echo [*] Checking Frontend (Port 3000)...
netstat -ano | find "3000" >nul
if errorlevel 0 (
    echo [✓] Frontend is running on Port 3000
) else (
    echo [✗] Frontend is NOT running on Port 3000
)

echo.

REM Check Backend
echo [*] Checking Backend (Port 8000)...
netstat -ano | find "8000" >nul
if errorlevel 0 (
    echo [✓] Backend is running on Port 8000
) else (
    echo [✗] Backend is NOT running on Port 8000
)

echo.

REM Check Database
echo [*] Checking Database (Port 5432)...
netstat -ano | find "5432" >nul
if errorlevel 0 (
    echo [✓] Database is running on Port 5432
) else (
    echo [✗] Database is NOT running on Port 5432
)

echo.
echo =====================================================
echo   Access Points:
echo   ├─ Frontend:   http://localhost:3000
echo   ├─ Backend:    http://127.0.0.1:8000
echo   └─ API Docs:   http://127.0.0.1:8000/docs
echo =====================================================
echo.
pause
