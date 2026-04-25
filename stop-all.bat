@echo off
REM =============================================================================
REM MedGuard AI + AdvocAI — Stop All Services
REM Gracefully shuts down all running services
REM =============================================================================

setlocal enabledelayedexpansion

echo.
echo =====================================================
echo   MedGuard AI + AdvocAI - Stopping All Services
echo =====================================================
echo.

REM Stop Docker Compose
echo [1/2] Stopping Docker services (Database, Backend, Frontend)...
docker-compose down

if errorlevel 0 (
    echo [✓] Docker services stopped
) else (
    echo [!] No Docker services were running or error occurred
)

echo.
echo =====================================================
echo   ✅ All services stopped!
echo =====================================================
echo.
echo   Next steps:
echo   ├─ Close any remaining terminal windows manually
echo   ├─ Or run 'docker-compose down -v' to remove volumes
echo   └─ Run 'start-all.bat' to start everything again
echo.
pause
