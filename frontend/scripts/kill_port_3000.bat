@echo off
rem Kill any process listening on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| find "LISTENING"') do (
    echo Killing PID %%a on port 3000
    taskkill /PID %%a /F >nul 2>&1
)
echo Port 3000 cleared.
