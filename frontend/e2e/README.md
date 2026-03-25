# End-to-End Tests

This directory contains Playwright-based end-to-end tests for the AI Interview Maker application.

## Test Structure

- `auth.spec.ts` - Authentication flow tests (signup, login, logout, token refresh)
- `interview-resume.spec.ts` - Resume-based interview flow tests
- `interview-jd-coding.spec.ts` - JD-based interview with coding challenge tests
- `admin.spec.ts` - Admin dashboard access and data export tests
- `helpers/` - Test helper utilities and fixtures

## Prerequisites

Before running E2E tests, ensure:

1. Backend server is running on `http://localhost:3000`
2. Frontend dev server is running on `http://localhost:5173` (or configured in `playwright.config.ts`)
3. Database is accessible and seeded with test data if needed
4. Environment variables are properly configured

## Running Tests

### Install Playwright browsers (first time only)
```bash
npx playwright install
```

### Run all tests
```bash
npm run test:e2e
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Run specific test file
```bash
npx playwright test e2e/auth.spec.ts
```

### Run tests in debug mode
```bash
npx playwright test --debug
```

### Run tests in UI mode (interactive)
```bash
npx playwright test --ui
```

## Test Configuration

Configuration is in `playwright.config.ts`:

- **Base URL**: `http://localhost:5173`
- **Browsers**: Chromium, Firefox, WebKit
- **Retries**: 2 retries in CI, 0 locally
- **Timeout**: Default 30s per test
- **Screenshots**: On failure only
- **Trace**: On first retry

## Writing Tests

### Best Practices

1. **Use data-testid attributes** for stable selectors
2. **Wait for elements** before interacting
3. **Use helper classes** for common operations
4. **Generate unique test data** to avoid conflicts
5. **Clean up after tests** if needed

### Example Test

```typescript
import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth.helper';
import { generateTestUser } from './helpers/test-data';

test('should complete user flow', async ({ page }) => {
  const authHelper = new AuthHelper(page);
  const user = generateTestUser();

  await authHelper.signup(user.email, user.password, user.name);
  await authHelper.login(user.email, user.password);

  await expect(page).toHaveURL('/dashboard');
});
```

## Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

## Debugging Failed Tests

1. **Check screenshots**: `test-results/` directory
2. **View trace**: `npx playwright show-trace trace.zip`
3. **Run in headed mode**: See browser actions
4. **Use debug mode**: Step through test execution

## CI/CD Integration

Tests are configured to run in CI with:
- Retries enabled (2 attempts)
- Single worker for stability
- HTML report generation
- Failure screenshots and traces

## Troubleshooting

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Check if backend/frontend servers are running
- Verify network connectivity

### Element not found
- Add explicit waits: `await page.waitForSelector()`
- Use more specific selectors
- Check if element is in viewport

### Authentication issues
- Verify backend API is accessible
- Check JWT token generation
- Ensure database is properly seeded

### Flaky tests
- Add proper waits for async operations
- Use `waitForLoadState('networkidle')`
- Avoid hard-coded timeouts when possible

## Test Coverage

Current test coverage includes:

- ✅ User signup and registration
- ✅ User login with valid/invalid credentials
- ✅ User logout
- ✅ Token refresh mechanism
- ✅ Protected route access control
- ✅ Resume upload and analysis
- ✅ Complete resume-based interview flow
- ✅ JD-based interview setup
- ✅ Coding challenge interaction
- ✅ Multiple programming language support
- ✅ Admin dashboard access control
- ✅ Platform statistics display
- ✅ User management features
- ✅ Session filtering and search
- ✅ Data export (CSV/JSON)
- ✅ Detailed session viewing

## Future Enhancements

- [ ] Visual regression testing
- [ ] Performance testing
- [ ] Accessibility testing
- [ ] Mobile responsive testing
- [ ] API contract testing
- [ ] Load testing with multiple concurrent users
