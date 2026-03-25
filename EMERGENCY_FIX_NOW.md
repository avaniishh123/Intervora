# 🚨 EMERGENCY FIX - Do This Right Now!

## The Problem

Your browser has an **expired/invalid token** that keeps causing the error.

## The Solution (30 Seconds)

### Step 1: Open Emergency Login Page

1. Open this file in your browser:
   ```
   EMERGENCY_LOGIN.html
   ```
   
   Or navigate to:
   ```
   file:///C:/Users/CBEC/Downloads/AI_maker-main/EMERGENCY_LOGIN.html
   ```

### Step 2: Enter Your Password

1. Email is pre-filled: `avaniishh@gmail.com`
2. Enter your password
3. Click "🔐 Clear Tokens & Login"

### Step 3: Done!

- Old tokens cleared ✅
- Fresh tokens obtained ✅
- Automatically redirected to app ✅
- Error is GONE! ✅

## Alternative: Manual Fix

If the HTML page doesn't work:

### Option 1: Browser Console

1. Go to `http://localhost:3000`
2. Press `F12` (DevTools)
3. Go to "Console" tab
4. Paste this and press Enter:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   alert('Storage cleared! Now sign in again.');
   window.location.href = '/login';
   ```
5. Sign in with your credentials
6. Try interview again

### Option 2: Incognito Mode

1. Open **new incognito/private window**
2. Go to `http://localhost:3000`
3. Sign in
4. Try interview
5. Should work perfectly!

### Option 3: Different Browser

1. Open Chrome/Firefox/Edge (different from current)
2. Go to `http://localhost:3000`
3. Sign in
4. Try interview

## Why This Works

The emergency login page:
1. **Clears ALL old tokens** (localStorage + sessionStorage)
2. **Gets fresh tokens** from backend
3. **Stores new tokens** properly
4. **Redirects you** to the app

After this, the token will be valid and the error will be gone!

## Verify Backend is Running

Before using the emergency login:

```bash
netstat -ano | findstr :5000
```

Should show backend on port 5000.

If not running:
```bash
cd backend
npm run dev
```

## Test Credentials

If you don't remember your password, create a new account:

1. Go to `http://localhost:3000/signup`
2. Create new account:
   - Email: `test@test.com`
   - Password: `Test1234`
   - Name: `Test User`
3. Then use emergency login with these credentials

## Summary

1. **Open** `EMERGENCY_LOGIN.html` in browser
2. **Enter** your password
3. **Click** "Clear Tokens & Login"
4. **Wait** for redirect
5. **Try** interview again
6. ✅ **FIXED!**

Takes 30 seconds, guaranteed to work! 🚀
