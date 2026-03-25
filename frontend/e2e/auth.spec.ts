import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth.helper';
import { generateTestUser } from './helpers/test-data';

test.describe('Authentication Flows', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
  });

  test('should successfully sign up a new user', async ({ page }) => {
    const user = generateTestUser('signup');

    await authHelper.signup(user.email, user.password, user.name, user.role);

    // Should redirect to login or dashboard
    const url = page.url();
    expect(url).toMatch(/\/(dashboard|login)/);

    // If redirected to login, verify we can log in
    if (url.includes('/login')) {
      await authHelper.login(user.email, user.password);
      await expect(page).toHaveURL('/dashboard');
    }
  });

  test('should successfully log in with valid credentials', async ({ page }) => {
    const user = generateTestUser('login');

    // First create the user
    await authHelper.signup(user.email, user.password, user.name, user.role);

    // Navigate to login if not already there
    if (!page.url().includes('/login')) {
      await page.goto('/login');
    }

    // Login
    await authHelper.login(user.email, user.password);

    // Should be on dashboard
    await expect(page).toHaveURL('/dashboard');

    // Should see user's name or welcome message
    await expect(page.locator('text=/welcome|dashboard/i')).toBeVisible({ timeout: 5000 });
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'nonexistent@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=/invalid|error|incorrect/i')).toBeVisible({ timeout: 5000 });

    // Should still be on login page
    expect(page.url()).toContain('/login');
  });

  test('should successfully log out', async ({ page }) => {
    const user = generateTestUser('logout');

    // Create user and login
    await authHelper.signup(user.email, user.password, user.name, user.role);
    
    if (!page.url().includes('/dashboard')) {
      await authHelper.login(user.email, user.password);
    }

    // Should be logged in
    await expect(page).toHaveURL('/dashboard');

    // Logout
    await authHelper.logout();

    // Should be redirected to login
    await expect(page).toHaveURL('/login');

    // Should not be able to access dashboard without login
    await page.goto('/dashboard');
    await page.waitForURL('/login', { timeout: 5000 });
  });

  test('should handle token refresh', async ({ page }) => {
    const user = generateTestUser('refresh');

    // Create user and login
    await authHelper.signup(user.email, user.password, user.name, user.role);
    
    if (!page.url().includes('/dashboard')) {
      await authHelper.login(user.email, user.password);
    }

    // Get initial token
    const initialToken = await authHelper.getAuthToken();
    expect(initialToken).toBeTruthy();

    // Wait a bit and make an API call that might trigger refresh
    await page.waitForTimeout(2000);
    
    // Navigate to a page that requires authentication
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Token should still be valid (or refreshed)
    const currentToken = await authHelper.getAuthToken();
    expect(currentToken).toBeTruthy();
  });

  test('should validate required fields on signup', async ({ page }) => {
    await page.goto('/signup');

    // Try to submit without filling fields
    await page.click('button[type="submit"]');

    // Should show validation errors or prevent submission
    const url = page.url();
    expect(url).toContain('/signup');
  });

  test('should validate email format on signup', async ({ page }) => {
    await page.goto('/signup');

    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="password"]', 'Test123!@#');
    await page.fill('input[name="name"]', 'Test User');
    await page.click('button[type="submit"]');

    // Should show validation error or stay on signup page
    const url = page.url();
    expect(url).toContain('/signup');
  });

  test('should protect routes that require authentication', async ({ page }) => {
    // Try to access protected routes without authentication
    const protectedRoutes = ['/dashboard', '/interview-setup', '/admin'];

    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should redirect to login
      await page.waitForURL('/login', { timeout: 5000 });
    }
  });
});
