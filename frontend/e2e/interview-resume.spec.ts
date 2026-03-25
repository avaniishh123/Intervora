import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth.helper';
import { generateTestUser, waitForApiResponse } from './helpers/test-data';

test.describe('Resume-Based Interview Flow', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);

    // Create and login user
    const user = generateTestUser('interview');
    await authHelper.signup(user.email, user.password, user.name, user.role);
    
    if (!page.url().includes('/dashboard')) {
      await authHelper.login(user.email, user.password);
    }
  });

  test('should complete full resume-based interview flow', async ({ page }) => {
    // Navigate to interview setup
    await page.goto('/interview-setup');
    await expect(page).toHaveURL('/interview-setup');

    // Select job role
    await page.selectOption('select[name="jobRole"]', 'Software Engineer');

    // Select resume-based mode
    await page.click('text=/resume/i');

    // Create a mock resume file
    const resumeContent = `
      John Doe
      Software Engineer
      
      EXPERIENCE:
      - 5 years of JavaScript development
      - React and Node.js expert
      - Built scalable web applications
      
      SKILLS:
      JavaScript, TypeScript, React, Node.js, MongoDB
    `;

    // Upload resume (create a temporary file)
    const fileInput = page.locator('input[type="file"]');
    
    // Create a buffer from the resume content
    const encoder = new TextEncoder();
    const buffer = encoder.encode(resumeContent);
    await fileInput.setInputFiles({
      name: 'resume.txt',
      mimeType: 'text/plain',
      buffer: buffer,
    });

    // Wait for upload and analysis
    await page.waitForTimeout(2000);

    // Start interview
    await page.click('button:has-text("Start Interview")');

    // Should navigate to interview page
    await expect(page).toHaveURL(/\/interview/);

    // Wait for first question to load
    await expect(page.locator('[data-testid="question-display"], .question-text')).toBeVisible({ 
      timeout: 10000 
    });

    // Answer first question
    const answerInput = page.locator('textarea[name="answer"], textarea.answer-input').first();
    await answerInput.fill('This is my answer to the first question. I have extensive experience in this area.');

    // Submit answer
    await page.click('button:has-text("Submit")');

    // Wait for evaluation
    await page.waitForTimeout(3000);

    // Should see next question or feedback
    await expect(page.locator('text=/question|feedback|score/i')).toBeVisible({ timeout: 10000 });

    // Answer second question
    await answerInput.fill('Here is my answer to the second question with relevant details.');
    await page.click('button:has-text("Submit")');

    // Wait for evaluation
    await page.waitForTimeout(3000);

    // Complete interview (if there's an end button)
    const endButton = page.locator('button:has-text("End Interview"), button:has-text("Complete")');
    if (await endButton.isVisible()) {
      await endButton.click();
    }

    // Should navigate to results page
    await expect(page).toHaveURL(/\/results/, { timeout: 15000 });

    // Should see performance report
    await expect(page.locator('text=/performance|score|report/i')).toBeVisible({ timeout: 10000 });

    // Should see overall score
    await expect(page.locator('text=/score|rating/i')).toBeVisible();

    // Should see strengths and weaknesses
    await expect(page.locator('text=/strength|weakness|improvement/i')).toBeVisible();
  });

  test('should handle resume upload validation', async ({ page }) => {
    await page.goto('/interview-setup');

    // Select resume-based mode
    await page.click('text=/resume/i');

    // Try to proceed without uploading resume
    const startButton = page.locator('button:has-text("Start Interview")');
    
    if (await startButton.isVisible()) {
      await startButton.click();
      
      // Should show error or stay on setup page
      await page.waitForTimeout(1000);
      const url = page.url();
      expect(url).toContain('/interview-setup');
    }
  });

  test('should display resume analysis results', async ({ page }) => {
    await page.goto('/interview-setup');

    // Select resume-based mode
    await page.click('text=/resume/i');

    // Upload resume
    const resumeContent = 'John Doe\nSoftware Engineer\nSkills: JavaScript, React, Node.js';
    const encoder = new TextEncoder();
    const buffer = encoder.encode(resumeContent);
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'resume.txt',
      mimeType: 'text/plain',
      buffer: buffer,
    });

    // Wait for analysis
    await page.waitForTimeout(3000);

    // Should show analysis results (skills, suggestions, etc.)
    await expect(page.locator('text=/skill|experience|suggestion/i')).toBeVisible({ 
      timeout: 10000 
    });
  });

  test('should allow voice input during interview', async ({ page }) => {
    // Grant microphone permissions
    await page.context().grantPermissions(['microphone']);

    await page.goto('/interview-setup');
    await page.selectOption('select[name="jobRole"]', 'Software Engineer');
    await page.click('text=/general/i');
    await page.click('button:has-text("Start Interview")');

    await expect(page).toHaveURL(/\/interview/);

    // Wait for question
    await expect(page.locator('[data-testid="question-display"], .question-text')).toBeVisible({ 
      timeout: 10000 
    });

    // Check if voice recorder is available
    const voiceButton = page.locator('button:has-text("Record"), button[aria-label*="record"]');
    
    if (await voiceButton.isVisible()) {
      await expect(voiceButton).toBeEnabled();
    }
  });

  test('should show timer during interview', async ({ page }) => {
    await page.goto('/interview-setup');
    await page.selectOption('select[name="jobRole"]', 'Software Engineer');
    await page.click('text=/general/i');
    await page.click('button:has-text("Start Interview")');

    await expect(page).toHaveURL(/\/interview/);

    // Should see timer
    await expect(page.locator('[data-testid="timer"], .timer')).toBeVisible({ timeout: 10000 });
  });

  test('should show progress bar during interview', async ({ page }) => {
    await page.goto('/interview-setup');
    await page.selectOption('select[name="jobRole"]', 'Software Engineer');
    await page.click('text=/general/i');
    await page.click('button:has-text("Start Interview")');

    await expect(page).toHaveURL(/\/interview/);

    // Should see progress indicator
    await expect(page.locator('[data-testid="progress"], .progress-bar')).toBeVisible({ 
      timeout: 10000 
    });
  });
});
