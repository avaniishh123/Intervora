@echo off
echo ========================================
echo RESTARTING Backend Server
echo ========================================
echo.
echo Step 1: Stopping any existing backend process...
echo.

REM Kill any process using port 5000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    echo Killing process %%a
    taskkill /F /PID %%a 2>nul
)

echo.
echo Waiting 3 seconds...
timeout /t 3 /nobreak >nul

echo.
echo Step 2: Starting backend with updated CORS configuration...
echo.

cd backend
echo Backend starting on port 5000...
echo CORS configured for: http://localhost:3000
echo.
npm run dev

pause
