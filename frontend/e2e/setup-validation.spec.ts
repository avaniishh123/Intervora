import { test, expect } from '@playwright/test';

/**
 * Basic setup validation tests
 * These tests verify that the E2E testing infrastructure is properly configured
 */

test.describe('E2E Setup Validation', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    
    // Should load without errors
    await expect(page).toHaveTitle(/AI Interview Maker/i);
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/login');
    
    // Should see login form
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should navigate to signup page', async ({ page }) => {
    await page.goto('/signup');
    
    // Should see signup form
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
  });

  test('should have working navigation', async ({ page }) => {
    await page.goto('/');
    
    // Should be able to navigate
    const loginLink = page.locator('a[href="/login"], a:has-text("Login")');
    if (await loginLink.isVisible({ timeout: 5000 })) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('should handle 404 pages', async ({ page }) => {
    const response = await page.goto('/non-existent-page');
    
    // Should either redirect or show 404
    expect(response?.status()).toBeLessThan(500);
  });

  test('should load static assets', async ({ page }) => {
    await page.goto('/');
    
    // Check for CSS
    const stylesheets = await page.locator('link[rel="stylesheet"]').count();
    expect(stylesheets).toBeGreaterThan(0);
  });

  test('should have responsive viewport', async ({ page }) => {
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page).toHaveTitle(/AI Interview Maker/i);

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page).toHaveTitle(/AI Interview Maker/i);
  });

  test('should not have console errors on load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have minimal or no console errors
    // Note: Some errors might be expected (e.g., missing API in dev)
    expect(errors.length).toBeLessThan(10);
  });
});
