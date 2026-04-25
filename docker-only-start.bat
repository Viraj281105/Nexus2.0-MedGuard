@echo off
REM =============================================================================
REM MedGuard AI + AdvocAI — Docker-Only Startup
REM All services run in Docker containers (no local dependencies)
REM =============================================================================

setlocal enabledelayedexpansion

echo.
echo =====================================================
echo   MedGuard AI + AdvocAI - Docker-Only Launch
echo =====================================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
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

echo =====================================================
echo   Building and Starting Services...
echo =====================================================
echo.

echo [1/1] Starting all services with Docker Compose...
echo This may take 2-3 minutes on first run for building images.
echo.

docker-compose up --build

echo.
echo =====================================================
echo   ❌ Services Stopped
echo =====================================================
echo.
echo To start again, run: docker-compose up
echo To stop: Press Ctrl+C in the terminal above
echo To clean up: docker-compose down
echo.
pause
