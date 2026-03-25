# DO THIS NOW - 3 Simple Steps

## Step 1: Run Test Script

Open terminal and run:

```bash
node test-login.js
```

This will:
- ✅ Check if backend is running
- ✅ Create a test user
- ✅ Get valid tokens
- ✅ Save tokens to file

## Step 2: Clear Browser Storage

1. Open browser to `http://localhost:3000`
2. Press `F12`
3. Go to Console tab
4. Type this and press Enter:
   ```javascript
   localStorage.clear()
   ```
5. Close DevTools

## Step 3: Login

1. Go to `http://localhost:3000/login`
2. Login with:
   - **Email**: `test@test.com`
   - **Password**: `Test1234`
3. Click "Sign In"

## Step 4: Try Interview

1. Go to Interview Setup
2. Select any options
3. Click Continue
4. Allow camera/mic
5. ✅ **SHOULD WORK NOW!**

---

## If Backend Not Running

```bash
cd backend
npm run dev
```

Wait for: `🚀 Server running on port 5000`

Then do steps 1-4 above.

---

## Alternative: Use Emergency Login Page

1. Open `EMERGENCY_LOGIN.html` in browser
2. Enter password
3. Click "Clear Tokens & Login"
4. Done!

---

## That's It!

One of these methods WILL fix the token error.

The issue is just old/expired tokens in your browser.

Fresh login = Fresh tokens = No error! 🎉
