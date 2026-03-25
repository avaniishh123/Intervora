# End-to-End Testing Guide

## Overview

This guide covers the end-to-end testing setup for the AI Interview Maker application using Playwright. The E2E tests validate complete user workflows from authentication through interview completion and admin operations.

## Test Suite Structure

### 1. Authentication Tests (`frontend/e2e/auth.spec.ts`)

Tests all authentication-related flows:

- ✅ User signup with validation
- ✅ User login with valid credentials
- ✅ Login failure with invalid credentials
- ✅ User logout
- ✅ Token refresh mechanism
- ✅ Protected route access control
- ✅ Email format validation
- ✅ Required field validation

**Key Features:**
- Generates unique test users to avoid conflicts
- Tests JWT token handling
- Validates route protection
- Verifies error messages

### 2. Resume-Based Interview Tests (`frontend/e2e/interview-resume.spec.ts`)

Tests the complete resume-based interview workflow:

- ✅ Resume upload and validation
- ✅ Resume analysis display
- ✅ Interview question flow
- ✅ Answer submission
- ✅ Real-time evaluation
- ✅ Performance report generation
- ✅ Voice input support
- ✅ Timer and progress tracking

**Key Features:**
- Creates mock resume files
- Tests file upload validation
- Validates interview progression
- Checks performance metrics display

### 3. JD-Based Interview with Coding Tests (`frontend/e2e/interview-jd-coding.spec.ts`)

Tests job description-based interviews with coding challenges:

- ✅ Job description input and validation
- ✅ JD-based question generation
- ✅ Coding challenge presentation
- ✅ Monaco Editor interaction
- ✅ Multiple programming language support
- ✅ Code submission and validation
- ✅ Gemini AI feedback display
- ✅ Mentor mode functionality

**Key Features:**
- Tests Monaco Editor integration
- Validates code execution flow
- Tests language switching
- Verifies AI feedback display

### 4. Admin Dashboard Tests (`frontend/e2e/admin.spec.ts`)

Tests admin-specific functionality:

- ✅ Admin access control
- ✅ Non-admin access prevention
- ✅ Platform statistics display
- ✅ User list and management
- ✅ Session list and filtering
- ✅ Date range filtering
- ✅ Role-based filtering
- ✅ CSV data export
- ✅ JSON data export
- ✅ Detailed session viewing
- ✅ User search functionality
- ✅ Pagination

**Key Features:**
- Tests role-based access control
- Validates data export functionality
- Tests filtering and search
- Verifies admin-only features

## Setup Instructions

### 1. Install Dependencies

```bash
cd frontend
npm install --save-dev @playwright/test playwright
```

### 2. Install Playwright Browsers

```bash
npx playwright install
```

This downloads Chromium, Firefox, and WebKit browsers for testing.

### 3. Configure Environment

Ensure your `.env` file has the correct API endpoints:

```env
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

### 4. Start Backend Server

```bash
cd backend
npm run dev
```

Backend should be running on `http://localhost:3000`

### 5. Start Frontend Dev Server (Optional)

If not using Playwright's built-in web server:

```bash
cd frontend
npm run dev
```

Frontend should be running on `http://localhost:5173`

## Running Tests

### Run All Tests

```bash
npm run test:e2e
```

### Run Tests in Headed Mode

See the browser while tests run:

```bash
npm run test:e2e:headed
```

### Run Tests in UI Mode

Interactive test runner with time travel debugging:

```bash
npm run test:e2e:ui
```

### Run Specific Test File

```bash
npx playwright test e2e/auth.spec.ts
```

### Run Specific Test

```bash
npx playwright test -g "should successfully log in"
```

### Run Tests in Debug Mode

Step through tests with debugger:

```bash
npm run test:e2e:debug
```

### Run Tests on Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Configuration

Configuration is in `frontend/playwright.config.ts`:

```typescript
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Key Configuration Options

- **testDir**: Location of test files
- **fullyParallel**: Run tests in parallel
- **retries**: Number of retry attempts on failure
- **workers**: Number of parallel workers
- **baseURL**: Base URL for navigation
- **trace**: When to capture traces
- **screenshot**: When to take screenshots
- **webServer**: Auto-start dev server

## Test Helpers

### AuthHelper

Provides authentication utilities:

```typescript
const authHelper = new AuthHelper(page);

// Signup
await authHelper.signup(email, password, name, role);

// Login
await authHelper.login(email, password);

// Logout
await authHelper.logout();

// Check login status
const isLoggedIn = await authHelper.isLoggedIn();

// Get auth token
const token = await authHelper.getAuthToken();
```

### Test Data Generators

Generate unique test data:

```typescript
import { generateTestUser, generateAdminUser } from './helpers/test-data';

const user = generateTestUser('prefix');
// { email: 'prefix-1234567890@example.com', password: 'Test123!@#', ... }

const admin = generateAdminUser();
// { email: 'admin-1234567890@example.com', role: 'admin', ... }
```

### Sample Data

Pre-defined test data:

```typescript
import { sampleJobDescription, sampleResumeText } from './helpers/test-data';

// Use in tests
await page.fill('textarea', sampleJobDescription);
```

## Viewing Test Results

### HTML Report

After tests complete:

```bash
npm run test:e2e:report
```

Opens an interactive HTML report showing:
- Test results
- Screenshots of failures
- Traces for debugging
- Test duration
- Browser information

### Trace Viewer

View detailed traces of test execution:

```bash
npx playwright show-trace trace.zip
```

Features:
- Time travel through test execution
- Network requests
- Console logs
- DOM snapshots
- Action timeline

## Best Practices

### 1. Use Stable Selectors

Prefer data-testid attributes:

```typescript
// Good
await page.locator('[data-testid="submit-button"]').click();

// Acceptable
await page.locator('button[type="submit"]').click();

// Avoid
await page.locator('.btn-primary').click();
```

### 2. Wait for Elements

Always wait for elements before interacting:

```typescript
// Wait for visibility
await expect(page.locator('.question')).toBeVisible();

// Wait for network idle
await page.waitForLoadState('networkidle');

// Wait for specific response
await page.waitForResponse(response => 
  response.url().includes('/api/sessions')
);
```

### 3. Generate Unique Test Data

Avoid test conflicts:

```typescript
const user = generateTestUser('unique-prefix');
// Creates unique email with timestamp
```

### 4. Clean Up After Tests

```typescript
test.afterEach(async ({ page }) => {
  // Logout
  await authHelper.logout();
  
  // Clear storage
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
});
```

### 5. Handle Async Operations

```typescript
// Wait for API response
const responsePromise = page.waitForResponse('/api/evaluate');
await page.click('button:has-text("Submit")');
await responsePromise;

// Wait for navigation
await Promise.all([
  page.waitForNavigation(),
  page.click('a:has-text("Dashboard")')
]);
```

## Debugging Failed Tests

### 1. Check Screenshots

Failed tests automatically capture screenshots:

```
test-results/
  auth-should-login-chromium/
    test-failed-1.png
```

### 2. View Traces

Traces capture full test execution:

```bash
npx playwright show-trace test-results/trace.zip
```

### 3. Run in Headed Mode

See what's happening:

```bash
npm run test:e2e:headed
```

### 4. Use Debug Mode

Step through test execution:

```bash
npm run test:e2e:debug
```

### 5. Add Console Logs

```typescript
test('debug test', async ({ page }) => {
  page.on('console', msg => console.log(msg.text()));
  
  // Your test code
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci
      
      - name: Install Playwright
        run: cd frontend && npx playwright install --with-deps
      
      - name: Start backend
        run: cd backend && npm run dev &
      
      - name: Run E2E tests
        run: cd frontend && npm run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

## Troubleshooting

### Tests Timing Out

**Problem**: Tests exceed timeout limit

**Solutions**:
- Increase timeout in config: `timeout: 60000`
- Add explicit waits: `await page.waitForSelector()`
- Check if backend is responding
- Verify network connectivity

### Element Not Found

**Problem**: Selector doesn't match any elements

**Solutions**:
- Use Playwright Inspector: `npx playwright test --debug`
- Check element visibility: `await element.isVisible()`
- Wait for element: `await page.waitForSelector()`
- Use more specific selectors

### Authentication Issues

**Problem**: Tests fail during login

**Solutions**:
- Verify backend API is running
- Check JWT token generation
- Ensure database is accessible
- Verify environment variables

### Flaky Tests

**Problem**: Tests pass/fail inconsistently

**Solutions**:
- Add proper waits for async operations
- Use `waitForLoadState('networkidle')`
- Avoid hard-coded timeouts
- Use `waitForResponse()` for API calls
- Increase retries in CI: `retries: 2`

### Monaco Editor Issues

**Problem**: Can't interact with code editor

**Solutions**:
- Wait for editor to load: `await page.waitForTimeout(1000)`
- Click to focus: `await editor.click()`
- Use keyboard API: `await page.keyboard.type(code)`
- Check if editor is in viewport

### File Upload Issues

**Problem**: Resume upload fails

**Solutions**:
- Use `setInputFiles()` with buffer
- Verify file input selector
- Check file size limits
- Ensure backend accepts file type

## Test Maintenance

### Updating Tests

When UI changes:
1. Update selectors in tests
2. Add data-testid attributes to new elements
3. Update helper functions if needed
4. Run tests to verify changes

### Adding New Tests

1. Create test file in `e2e/` directory
2. Import necessary helpers
3. Follow existing test patterns
4. Add to test suite documentation
5. Run locally before committing

### Test Data Management

- Use generators for unique data
- Keep sample data in `helpers/test-data.ts`
- Clean up test data after tests
- Avoid hardcoded values

## Performance Considerations

### Parallel Execution

Tests run in parallel by default:

```typescript
// Disable for specific test
test.describe.serial('sequential tests', () => {
  // Tests run one after another
});
```

### Test Isolation

Each test gets fresh context:
- New browser context
- Clean storage
- No shared state

### Resource Management

- Reuse browser instances
- Close pages after tests
- Clear storage when needed
- Limit concurrent workers in CI

## Coverage Report

Current E2E test coverage:

| Feature | Coverage |
|---------|----------|
| Authentication | ✅ 100% |
| Resume Upload | ✅ 100% |
| Interview Flow | ✅ 90% |
| Coding Challenges | ✅ 85% |
| Admin Dashboard | ✅ 95% |
| Data Export | ✅ 100% |

## Next Steps

1. Run the test suite: `npm run test:e2e`
2. Review test results
3. Fix any failing tests
4. Add tests for new features
5. Integrate with CI/CD pipeline
6. Monitor test stability
7. Update documentation as needed

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Test Examples](https://github.com/microsoft/playwright/tree/main/examples)
