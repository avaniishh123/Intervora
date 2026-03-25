@echo off
echo ========================================
echo Starting AI Interview Maker
echo ========================================
echo.

echo Checking if backend is already running...
netstat -ano | findstr :5000 > nul
if %errorlevel% == 0 (
    echo Backend is already running on port 5000
    echo.
) else (
    echo Starting backend...
    start "Backend Server" cmd /k "cd backend && npm run dev"
    echo Waiting for backend to start...
    timeout /t 5 /nobreak > nul
    echo.
)

echo Checking if frontend is already running...
netstat -ano | findstr :3000 > nul
if %errorlevel% == 0 (
    echo Frontend is already running on port 3000
    echo.
) else (
    echo Starting frontend...
    start "Frontend Server" cmd /k "cd frontend && npm run dev"
    echo Waiting for frontend to start...
    timeout /t 5 /nobreak > nul
    echo.
)

echo ========================================
echo DONE!
echo ========================================
echo.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Press any key to open the app in browser...
pause > nul

start http://localhost:3000

echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
echo.
pause
