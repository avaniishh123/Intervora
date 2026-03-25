# Fix "Invalid Token" Error - Quick Guide

## The Error

You're seeing this red banner at the top:
```
❌ Invalid token. Please provide a valid authorization token.
```

## Why This Happens

The access token stored in your browser has:
- Expired (tokens expire after 30 minutes)
- Become invalid
- Been corrupted

## Quick Fix (30 seconds)

### Option 1: Sign Out and Sign In

1. Click your profile/menu
2. Click "Sign Out"
3. Go to login page
4. Sign in with your credentials
5. Try the interview again

### Option 2: Clear Browser Storage

1. Press `F12` to open DevTools
2. Go to "Application" tab
3. Click "Local Storage" → `http://localhost:3000`
4. Right-click → "Clear"
5. Reload the page
6. Sign in again

### Option 3: Use Incognito/Private Mode

1. Open new incognito/private window
2. Go to `http://localhost:3000`
3. Sign in
4. Try the interview

## Verify the Fix

After signing in again, check:

1. **No red error banner** at the top
2. **Connection status shows "Connected"** (green dot)
3. **Camera preview works**
4. **Interview can start**

## Why Sign In Again Works

When you sign in:
1. Backend generates a **new access token**
2. Token is stored in browser's localStorage
3. Socket.io uses this token to authenticate
4. Token is valid for 30 minutes
5. Everything works again!

## Prevent This in the Future

The app should automatically refresh tokens, but if you see this error:
- Just sign in again
- Takes 10 seconds
- Generates fresh token
- Problem solved

## Technical Details

### What's Happening

```
Frontend → Socket.io → Backend
   ↓
Uses accessToken from localStorage
   ↓
Backend verifies token with JWT_SECRET
   ↓
If invalid/expired → "Invalid token" error
```

### Token Lifecycle

```
Sign In
  ↓
Generate Token (expires in 30m)
  ↓
Store in localStorage
  ↓
Use for API calls & Socket.io
  ↓
After 30 minutes → Token expires
  ↓
Need to sign in again
```

## Still Not Working?

### Check Backend is Running

```bash
netstat -ano | findstr :5000
```

Should show a process on port 5000.

### Check Backend Logs

Look for errors like:
- "Invalid token"
- "JWT verification failed"
- "Token expired"

### Restart Backend

```bash
cd backend
# Stop with Ctrl+C
npm run dev
```

### Check JWT_SECRET

In `backend/.env`:
```env
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long_change_this_in_production
```

Should be set and at least 32 characters.

## Summary

**Problem**: Invalid/expired token
**Solution**: Sign out and sign in again
**Time**: 30 seconds
**Result**: Fresh token, everything works!

Just sign in again and you're good to go! 🚀
