@echo off
echo ========================================
echo GETTING YOUR CURRENT IP ADDRESS
echo ========================================
echo.
echo Your current public IP address is:
echo.

curl -s ifconfig.me
echo.
echo.

echo ========================================
echo NEXT STEPS:
echo ========================================
echo.
echo 1. Copy the IP address shown above
echo 2. Go to: https://cloud.mongodb.com/
echo 3. Login to your MongoDB Atlas account
echo 4. Click "Network Access" in the left sidebar
echo 5. Click "Add IP Address"
echo 6. Paste your IP address OR click "Add Current IP Address"
echo 7. Click "Confirm"
echo 8. Wait 1-2 minutes for changes to apply
echo 9. Run START_BACKEND_ONLY.bat to restart backend
echo.
echo OR for quick development access:
echo - Click "Allow Access from Anywhere"
echo - This adds 0.0.0.0/0 to whitelist
echo.
pause
