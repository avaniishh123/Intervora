@echo off
echo ========================================
echo RESTARTING BACKEND SERVER
echo ========================================
echo.
echo Step 1: Killing existing backend process...
taskkill /F /PID 23852 2>nul
timeout /t 2 /nobreak >nul
echo Done!
echo.
echo Step 2: Starting backend with new CORS configuration...
cd backend
start cmd /k "npm run dev"
echo.
echo ========================================
echo Backend is restarting in a new window!
echo ========================================
echo.
echo Wait 5 seconds for it to fully start, then try logging in again.
echo.
pause
