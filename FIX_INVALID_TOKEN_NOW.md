# Fix Invalid Token Error - IMMEDIATE SOLUTION

## Problem
You're seeing "Invalid token. Please provide a valid authorization token" error on the interview page.

## Quick Fix - Do This Now

### Step 1: Clear Browser Storage
1. Press **F12** to open Developer Tools
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Click **Local Storage** → **http://localhost:3000**
4. Click **Clear All** or delete these keys:
   - `accessToken`
   - `refreshToken`
5. Close Developer Tools

### Step 2: Logout and Login Again
1. Go back to the home page: http://localhost:3000
2. Click **Logout** (if you see it)
3. Go to **Login** page: http://localhost:3000/login
4. Login with your credentials

### Step 3: Try Interview Again
1. After successful login, go to **Interview Setup**
2. Configure your interview
3. Click **Continue**
4. The token error should be gone!

## If That Doesn't Work - Create New Account

### Option 1: Sign Up New Account
1. Go to: http://localhost:3000/signup
2. Create a new account:
   - Name: Test User
   - Email: test@example.com
   - Password: Test123!
   - Role: Candidate
3. Click **Sign Up**
4. You'll be logged in automatically
5. Try the interview again

### Option 2: Use Existing Test Account
If you already have an account, just login:
- Email: Your registered email
- Password: Your password

## Why This Happens

The "Invalid token" error occurs when:
1. Your login session expired
2. Token was corrupted in browser storage
3. You logged in before backend was fully started
4. MongoDB connection was lost during login

## Permanent Fix

To prevent this in the future:

1. **Always start backend first**:
   ```bash
   START_BACKEND_ONLY.bat
   ```
   Wait for "MongoDB connected successfully"

2. **Then start frontend** or use:
   ```bash
   START_EVERYTHING.bat
   ```

3. **Login fresh** after starting services

## Technical Details

The token error happens because:
- Socket.IO requires a valid JWT token for authentication
- The token is stored in `localStorage.accessToken`
- If the token is missing, expired, or invalid, Socket.IO rejects the connection

## Browser Console Check

Press F12 and check console for:
```
❌ Socket connection error: Authentication error
❌ Invalid token
```

After fixing, you should see:
```
✅ Connected to interview socket
```

## Quick Commands

### Clear localStorage via Console
Press F12, go to Console tab, and run:
```javascript
localStorage.clear();
window.location.href = '/login';
```

This will clear storage and redirect to login.

## Summary

1. Clear browser localStorage
2. Logout and login again
3. Try interview again
4. If still failing, create new account

The issue is with the authentication token, not the camera/mic fix we just applied!
