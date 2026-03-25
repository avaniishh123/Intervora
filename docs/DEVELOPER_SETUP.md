# AI Interview Maker 2.0 - Developer Setup Guide

## Overview

This guide provides comprehensive instructions for setting up the AI Interview Maker 2.0 development environment. Follow these steps to get the application running locally for development, testing, and contribution.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [System Requirements](#system-requirements)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Database Setup](#database-setup)
6. [Running the Application](#running-the-application)
7. [Development Workflow](#development-workflow)
8. [Testing](#testing)
9. [Debugging](#debugging)
10. [Common Issues](#common-issues)
11. [Contributing](#contributing)
12. [Additional Resources](#additional-resources)

---

## Prerequisites

### Required Software

Before starting, ensure you have the following installed:

#### 1. Node.js and npm

**Version**: Node.js 18.x or higher, npm 9.x or higher

**Installation**:

**macOS** (using Homebrew):
```bash
brew install node
```

**Windows** (using installer):
- Download from [nodejs.org](https://nodejs.org/)
- Run the installer
- Verify installation:
```bash
node --version
npm --version
```

**Linux** (Ubuntu/Debian):
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 2. MongoDB

**Version**: MongoDB 6.0 or higher

**Installation**:

**macOS** (using Homebrew):
```bash
brew tap mongodb/brew
brew install mongodb-community@6.0
brew services start mongodb-community@6.0
```

**Windows**:
- Download from [mongodb.com](https://www.mongodb.com/try/download/community)
- Run the installer
- Start MongoDB service

**Linux** (Ubuntu):
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

**Alternative**: Use MongoDB Atlas (cloud-hosted)
- Sign up at [mongodb.com/atlas](https://www.mongodb.com/atlas)
- Create a free cluster
- Get connection string

#### 3. Git

**Version**: Git 2.x or higher

**Installation**:

**macOS**:
```bash
brew install git
```

**Windows**:
- Download from [git-scm.com](https://git-scm.com/)
- Run the installer

**Linux**:
```bash
sudo apt-get install git
```

#### 4. Code Editor

**Recommended**: Visual Studio Code

**Installation**:
- Download from [code.visualstudio.com](https://code.visualstudio.com/)
- Install recommended extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features
  - MongoDB for VS Code
  - REST Client

### Optional Tools

**Postman or Insomnia**: For API testing
**MongoDB Compass**: GUI for MongoDB
**Docker**: For containerized development
**Redis**: For caching (optional)

---

## System Requirements

### Minimum Requirements

- **OS**: macOS 10.15+, Windows 10+, or Linux (Ubuntu 20.04+)
- **CPU**: Dual-core processor
- **RAM**: 8GB
- **Storage**: 10GB free space
- **Internet**: Stable connection for API calls

### Recommended Requirements

- **OS**: Latest macOS, Windows 11, or Ubuntu 22.04
- **CPU**: Quad-core processor
- **RAM**: 16GB
- **Storage**: 20GB free space (SSD preferred)
- **Internet**: High-speed connection (10+ Mbps)

---

## Installation

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/your-org/ai-interview-maker-v2.git

# Navigate to project directory
cd ai-interview-maker-v2
```

### Step 2: Install Backend Dependencies

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Return to root
cd ..
```

**Expected Output**:
```
added 250 packages, and audited 251 packages in 15s
```

### Step 3: Install Frontend Dependencies

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Return to root
cd ..
```

**Expected Output**:
```
added 1200 packages, and audited 1201 packages in 30s
```

### Step 4: Verify Installation

```bash
# Check backend
cd backend
npm list --depth=0

# Check frontend
cd ../frontend
npm list --depth=0
```

---

## Configuration

### Backend Configuration

#### Step 1: Create Environment File

```bash
cd backend
cp .env.example .env
```

#### Step 2: Configure Environment Variables

Edit `backend/.env`:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/ai-interview-maker
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-interview-maker

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this
JWT_REFRESH_EXPIRES_IN=7d

# Gemini AI Configuration
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-1.5-pro
GEMINI_FLASH_MODEL=gemini-1.5-flash

# File Upload Configuration
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@aiinterviewmaker.com

# Cloud Storage (Optional - for production)
# AWS_ACCESS_KEY_ID=your-aws-key
# AWS_SECRET_ACCESS_KEY=your-aws-secret
# AWS_REGION=us-east-1
# AWS_S3_BUCKET=ai-interview-maker-uploads

# Redis (Optional - for caching)
# REDIS_URL=redis://localhost:6379
```

#### Step 3: Obtain Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key
5. Paste it in `.env` as `GEMINI_API_KEY`

**Note**: Free tier includes 60 requests per minute. For production, consider paid plans.

### Frontend Configuration

#### Step 1: Create Environment File

```bash
cd frontend
cp .env.example .env
```

#### Step 2: Configure Environment Variables

Edit `frontend/.env`:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000

# Environment
VITE_ENV=development

# Feature Flags (Optional)
VITE_ENABLE_MENTOR_MODE=true
VITE_ENABLE_CODING_CHALLENGES=true
VITE_ENABLE_LEADERBOARD=true

# Analytics (Optional)
# VITE_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
```

---

## Database Setup

### Option 1: Local MongoDB

#### Start MongoDB Service

**macOS**:
```bash
brew services start mongodb-community@6.0
```

**Windows**:
- MongoDB should start automatically as a service
- Or run: `net start MongoDB`

**Linux**:
```bash
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### Verify MongoDB is Running

```bash
mongosh
```

Expected output:
```
Current Mongosh Log ID: 507f1f77bcf86cd799439011
Connecting to: mongodb://127.0.0.1:27017
Using MongoDB: 6.0.0
```

#### Create Database and Initial Admin User

```bash
cd backend
npm run setup-db
```

This script will:
1. Create the database
2. Create indexes
3. Create an initial admin user
4. Seed sample data (optional)

**Default Admin Credentials**:
- Email: `admin@aiinterviewmaker.com`
- Password: `Admin123!` (change immediately)

### Option 2: MongoDB Atlas (Cloud)

1. Sign up at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a new cluster (free tier available)
3. Create a database user
4. Whitelist your IP address (or use 0.0.0.0/0 for development)
5. Get connection string
6. Update `MONGODB_URI` in `backend/.env`

Example connection string:
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/ai-interview-maker?retryWrites=true&w=majority
```

### Database Migrations

Run migrations to set up schema:

```bash
cd backend
npm run migrate
```

### Seed Sample Data (Optional)

For development and testing:

```bash
cd backend
npm run seed
```

This creates:
- 10 sample users
- 50 sample sessions
- Coding challenges for all roles
- Leaderboard entries

---

## Running the Application

### Development Mode

#### Option 1: Run Backend and Frontend Separately

**Terminal 1 - Backend**:
```bash
cd backend
npm run dev
```

Expected output:
```
[nodemon] starting `ts-node src/server.ts`
Server running on port 5000
MongoDB connected successfully
Socket.io initialized
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
```

Expected output:
```
VITE v4.5.0  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

#### Option 2: Run Both Concurrently (from root)

```bash
npm run dev
```

This uses `concurrently` to run both servers.

### Production Build

#### Build Backend

```bash
cd backend
npm run build
```

Output: `backend/dist/` directory

#### Build Frontend

```bash
cd frontend
npm run build
```

Output: `frontend/dist/` directory

#### Run Production Build

```bash
# Backend
cd backend
npm start

# Frontend (serve static files)
cd frontend
npm run preview
```

### Docker Setup (Alternative)

#### Build and Run with Docker Compose

```bash
# From root directory
docker-compose up --build
```

This starts:
- Backend server (port 5000)
- Frontend server (port 5173)
- MongoDB (port 27017)
- Redis (optional, port 6379)

#### Stop Docker Containers

```bash
docker-compose down
```

---

## Development Workflow

### Project Structure

```
ai-interview-maker-v2/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration files
│   │   ├── controllers/     # Route controllers
│   │   ├── middleware/      # Express middleware
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── socket/          # Socket.io handlers
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Utility functions
│   │   └── server.ts        # Entry point
│   ├── uploads/             # File uploads
│   ├── .env                 # Environment variables
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   ├── hooks/           # Custom hooks
│   │   ├── store/           # State management
│   │   ├── styles/          # CSS files
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Utility functions
│   │   ├── App.tsx          # Main app component
│   │   └── main.tsx         # Entry point
│   ├── public/              # Static assets
│   ├── .env                 # Environment variables
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── docs/                    # Documentation
├── scripts/                 # Utility scripts
├── docker-compose.yml
└── README.md
```

### Code Style and Linting

#### ESLint Configuration

Backend and frontend use ESLint for code quality.

**Run linter**:
```bash
# Backend
cd backend
npm run lint

# Frontend
cd frontend
npm run lint
```

**Auto-fix issues**:
```bash
npm run lint:fix
```

#### Prettier Configuration

Code formatting is handled by Prettier.

**Format code**:
```bash
# Backend
cd backend
npm run format

# Frontend
cd frontend
npm run format
```

#### Pre-commit Hooks

Husky is configured to run linting and formatting before commits:

```bash
# Install Husky
npm run prepare
```

### Git Workflow

#### Branch Naming Convention

- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `hotfix/description` - Urgent fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

#### Commit Message Format

Follow conventional commits:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

**Examples**:
```
feat(auth): add two-factor authentication
fix(sessions): resolve session timeout issue
docs(api): update endpoint documentation
```

### Making Changes

#### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

#### 2. Make Changes

Edit files as needed.

#### 3. Test Changes

```bash
# Run tests
npm test

# Run linter
npm run lint

# Test manually
npm run dev
```

#### 4. Commit Changes

```bash
git add .
git commit -m "feat(scope): description"
```

#### 5. Push Changes

```bash
git push origin feature/your-feature-name
```

#### 6. Create Pull Request

- Go to GitHub repository
- Click "New Pull Request"
- Select your branch
- Fill in PR template
- Request review

---

## Testing

### Backend Testing

#### Unit Tests

**Framework**: Jest

**Run all tests**:
```bash
cd backend
npm test
```

**Run specific test file**:
```bash
npm test -- AuthController.test.ts
```

**Run with coverage**:
```bash
npm run test:coverage
```

**Watch mode**:
```bash
npm run test:watch
```

#### Integration Tests

Test API endpoints:

```bash
npm run test:integration
```

#### Test Structure

```typescript
// Example: AuthController.test.ts
import request from 'supertest';
import app from '../server';

describe('Auth Controller', () => {
  describe('POST /auth/signup', () => {
    it('should create a new user', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'Test123!',
          name: 'Test User'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });
});
```

### Frontend Testing

#### Unit Tests

**Framework**: Vitest + React Testing Library

**Run all tests**:
```bash
cd frontend
npm test
```

**Run with UI**:
```bash
npm run test:ui
```

**Coverage**:
```bash
npm run test:coverage
```

#### Component Tests

```typescript
// Example: LoginPage.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import LoginPage from './LoginPage';

describe('LoginPage', () => {
  it('renders login form', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('submits form with valid data', async () => {
    render(<LoginPage />);
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'Test123!' }
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    // Assert expected behavior
  });
});
```

### End-to-End Tests

**Framework**: Playwright

**Run E2E tests**:
```bash
cd frontend
npm run test:e2e
```

**Run with UI**:
```bash
npm run test:e2e:ui
```

**Generate report**:
```bash
npm run test:e2e:report
```

#### E2E Test Example

```typescript
// Example: auth.spec.ts
import { test, expect } from '@playwright/test';

test('user can sign up and log in', async ({ page }) => {
  // Sign up
  await page.goto('/signup');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'Test123!');
  await page.fill('input[name="name"]', 'Test User');
  await page.click('button[type="submit"]');
  
  // Verify redirect to dashboard
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

---

## Debugging

### Backend Debugging

#### VS Code Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/backend",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

**Usage**:
1. Set breakpoints in code
2. Press F5 or click "Run and Debug"
3. Debugger will pause at breakpoints

#### Console Logging

```typescript
// Use structured logging
import logger from './utils/logger';

logger.info('User logged in', { userId, email });
logger.error('Database error', { error: err.message });
logger.debug('Request received', { method, path, body });
```

#### Debugging Gemini API Calls

```typescript
// Enable verbose logging
const response = await geminiService.generateQuestions({
  role: 'Software Engineer',
  resume: resumeText,
  debug: true // Logs full request/response
});
```

### Frontend Debugging

#### React DevTools

Install browser extension:
- [Chrome](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

**Features**:
- Inspect component tree
- View props and state
- Profile performance
- Track re-renders

#### VS Code Debug Configuration

Add to `.vscode/launch.json`:

```json
{
  "type": "chrome",
  "request": "launch",
  "name": "Debug Frontend",
  "url": "http://localhost:5173",
  "webRoot": "${workspaceFolder}/frontend/src",
  "sourceMapPathOverrides": {
    "webpack:///src/*": "${webRoot}/*"
  }
}
```

#### Browser DevTools

**Console Logging**:
```typescript
console.log('User data:', user);
console.error('API error:', error);
console.table(sessions); // Display array as table
```

**Network Tab**:
- Monitor API requests
- Check request/response headers
- View payload data
- Identify slow requests

**Performance Tab**:
- Profile component rendering
- Identify performance bottlenecks
- Analyze memory usage

### Database Debugging

#### MongoDB Compass

1. Open MongoDB Compass
2. Connect to `mongodb://localhost:27017`
3. Browse collections
4. Run queries
5. View indexes

#### Mongoose Debug Mode

Enable in development:

```typescript
// backend/src/config/database.ts
if (process.env.NODE_ENV === 'development') {
  mongoose.set('debug', true);
}
```

This logs all database queries to console.

---

## Common Issues

### Issue 1: Port Already in Use

**Error**: `EADDRINUSE: address already in use :::5000`

**Solution**:
```bash
# Find process using port
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Or change port in .env
PORT=5001
```

### Issue 2: MongoDB Connection Failed

**Error**: `MongooseServerSelectionError: connect ECONNREFUSED`

**Solutions**:
1. Ensure MongoDB is running:
   ```bash
   brew services list  # macOS
   sudo systemctl status mongod  # Linux
   ```

2. Check connection string in `.env`

3. Verify MongoDB is listening:
   ```bash
   mongosh
   ```

4. Check firewall settings

### Issue 3: Gemini API Key Invalid

**Error**: `API key not valid`

**Solutions**:
1. Verify API key in `.env`
2. Check for extra spaces or quotes
3. Regenerate key in Google AI Studio
4. Ensure key has proper permissions

### Issue 4: CORS Errors

**Error**: `Access to fetch at 'http://localhost:5000' from origin 'http://localhost:5173' has been blocked by CORS policy`

**Solutions**:
1. Verify `CORS_ORIGIN` in backend `.env`:
   ```env
   CORS_ORIGIN=http://localhost:5173
   ```

2. Check CORS middleware configuration:
   ```typescript
   app.use(cors({
     origin: process.env.CORS_ORIGIN,
     credentials: true
   }));
   ```

### Issue 5: File Upload Fails

**Error**: `File upload failed` or `ENOENT: no such file or directory`

**Solutions**:
1. Create uploads directory:
   ```bash
   mkdir -p backend/uploads/resumes
   mkdir -p backend/uploads/recordings
   ```

2. Check file permissions:
   ```bash
   chmod 755 backend/uploads
   ```

3. Verify `UPLOAD_DIR` in `.env`

### Issue 6: TypeScript Compilation Errors

**Error**: Various TypeScript errors

**Solutions**:
1. Clear TypeScript cache:
   ```bash
   rm -rf node_modules/.cache
   ```

2. Reinstall dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. Check `tsconfig.json` configuration

4. Update TypeScript:
   ```bash
   npm install -D typescript@latest
   ```

### Issue 7: Tests Failing

**Solutions**:
1. Clear test cache:
   ```bash
   npm test -- --clearCache
   ```

2. Update snapshots:
   ```bash
   npm test -- -u
   ```

3. Check test environment variables

4. Ensure test database is clean

### Issue 8: Slow Performance

**Solutions**:
1. Check database indexes:
   ```bash
   npm run check-indexes
   ```

2. Enable caching (Redis)

3. Optimize Gemini API calls (use Flash model for simple tasks)

4. Profile application:
   ```bash
   npm run profile
   ```

5. Check for memory leaks

---

## Contributing

### Contribution Guidelines

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Write/update tests**
5. **Update documentation**
6. **Submit a pull request**

### Pull Request Checklist

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No merge conflicts
- [ ] PR description is clear and complete

### Code Review Process

1. Submit PR with clear description
2. Automated checks run (CI/CD)
3. Reviewer assigned
4. Address feedback
5. Approval and merge

### Reporting Issues

**Bug Reports**:
- Use issue template
- Provide steps to reproduce
- Include error messages
- Specify environment details

**Feature Requests**:
- Describe the feature
- Explain use case
- Provide examples
- Discuss alternatives

---

## Additional Resources

### Documentation

- [API Documentation](./API_DOCUMENTATION.md)
- [User Guide](./USER_GUIDE.md)
- [Admin Guide](./ADMIN_GUIDE.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)

### External Resources

**Backend**:
- [Express.js Documentation](https://expressjs.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [Socket.io Documentation](https://socket.io/docs/)
- [Gemini API Documentation](https://ai.google.dev/docs)

**Frontend**:
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [React Router Documentation](https://reactrouter.com/)
- [Three.js Documentation](https://threejs.org/docs/)

**Testing**:
- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)

### Community

- **GitHub Discussions**: Ask questions and share ideas
- **Discord Server**: Real-time chat with developers
- **Stack Overflow**: Tag questions with `ai-interview-maker`

### Getting Help

**For Development Issues**:
- Check this guide first
- Search existing GitHub issues
- Ask in Discord #dev-help channel
- Create a new GitHub issue

**For Contributions**:
- Read CONTRIBUTING.md
- Join Discord #contributors channel
- Attend weekly dev meetings (Fridays 2 PM EST)

---

## Conclusion

You're now ready to develop on the AI Interview Maker 2.0 platform! This guide covers the essentials, but don't hesitate to explore the codebase and experiment.

**Next Steps**:
1. Complete the setup
2. Run the application locally
3. Explore the codebase
4. Pick an issue to work on
5. Submit your first PR

**Happy coding! 🚀**

---

*Last Updated: January 2024*
*Version: 2.0*
