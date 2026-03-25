@echo off
echo ========================================
echo CONNECTION VERIFICATION
echo ========================================
echo.

echo Checking Backend (Port 5000)...
netstat -ano | findstr :5000 | findstr LISTENING
if %errorlevel% equ 0 (
    echo [OK] Backend is running on port 5000
) else (
    echo [ERROR] Backend is NOT running on port 5000
)
echo.

echo Checking Frontend (Port 3000)...
netstat -ano | findstr :3000 | findstr LISTENING
if %errorlevel% equ 0 (
    echo [OK] Frontend is running on port 3000
) else (
    echo [ERROR] Frontend is NOT running on port 3000
)
echo.

echo Testing Backend Health Endpoint...
curl -s http://localhost:5000/health
echo.
echo.

echo Testing Backend CORS...
curl -s -H "Origin: http://localhost:3000" -I http://localhost:5000/health | findstr "Access-Control"
echo.

echo ========================================
echo VERIFICATION COMPLETE
echo ========================================
echo.
echo If both services are running, simply:
echo 1. Open http://localhost:3000 in your browser
echo 2. Press Ctrl+Shift+R to hard refresh
echo 3. Try logging in again
echo.
pause
