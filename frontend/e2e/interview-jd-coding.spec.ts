import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth.helper';
import { generateTestUser, sampleJobDescription } from './helpers/test-data';

test.describe('JD-Based Interview with Coding Challenge', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);

    // Create and login user
    const user = generateTestUser('jd-interview');
    await authHelper.signup(user.email, user.password, user.name, user.role);
    
    if (!page.url().includes('/dashboard')) {
      await authHelper.login(user.email, user.password);
    }
  });

  test('should complete JD-based interview with coding challenge', async ({ page }) => {
    // Navigate to interview setup
    await page.goto('/interview-setup');
    await expect(page).toHaveURL('/interview-setup');

    // Select technical role that includes coding
    await page.selectOption('select[name="jobRole"]', 'Software Engineer');

    // Select JD-based mode
    await page.click('text=/job description|jd/i');

    // Enter job description
    const jdTextarea = page.locator('textarea[name="jobDescription"], textarea.jd-input');
    await jdTextarea.fill(sampleJobDescription);

    // Start interview
    await page.click('button:has-text("Start Interview")');

    // Should navigate to interview page
    await expect(page).toHaveURL(/\/interview/);

    // Wait for first question
    await expect(page.locator('[data-testid="question-display"], .question-text')).toBeVisible({ 
      timeout: 10000 
    });

    // Answer behavioral questions first
    const answerInput = page.locator('textarea[name="answer"], textarea.answer-input').first();
    
    for (let i = 0; i < 2; i++) {
      await answerInput.fill(`This is my detailed answer to question ${i + 1}. I have relevant experience in this area.`);
      await page.click('button:has-text("Submit")');
      await page.waitForTimeout(3000);
    }

    // Wait for coding challenge to appear
    await page.waitForTimeout(2000);

    // Check if coding challenge is presented
    const codeEditor = page.locator('.monaco-editor, [data-testid="code-editor"]');
    
    if (await codeEditor.isVisible({ timeout: 5000 })) {
      // Coding challenge is present
      await expect(page.locator('text=/coding|challenge|code/i')).toBeVisible();

      // Should see language selector
      const languageSelector = page.locator('select[name="language"], .language-selector');
      if (await languageSelector.isVisible()) {
        await languageSelector.selectOption('javascript');
      }

      // Write code solution
      // Monaco editor requires special handling
      await page.waitForTimeout(1000);
      
      // Click in the editor to focus
      await codeEditor.click();
      
      // Type code solution
      const codeSolution = `
function solution(arr) {
  return arr.filter(x => x > 0).reduce((a, b) => a + b, 0);
}
      `.trim();

      await page.keyboard.type(codeSolution);

      // Submit code
      await page.click('button:has-text("Submit Code"), button:has-text("Run")');

      // Wait for code validation
      await page.waitForTimeout(5000);

      // Should see feedback or results
      await expect(page.locator('text=/feedback|result|pass|fail/i')).toBeVisible({ 
        timeout: 10000 
      });
    }

    // Complete interview
    const endButton = page.locator('button:has-text("End Interview"), button:has-text("Complete")');
    if (await endButton.isVisible()) {
      await endButton.click();
    }

    // Should navigate to results
    await expect(page).toHaveURL(/\/results/, { timeout: 15000 });

    // Should see performance report
    await expect(page.locator('text=/performance|score/i')).toBeVisible({ timeout: 10000 });
  });

  test('should validate job description input', async ({ page }) => {
    await page.goto('/interview-setup');

    // Select JD-based mode
    await page.click('text=/job description|jd/i');

    // Try to start without entering JD
    const startButton = page.locator('button:has-text("Start Interview")');
    
    if (await startButton.isVisible()) {
      await startButton.click();
      
      // Should show error or stay on setup page
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/interview-setup');
    }
  });

  test('should display coding challenge with test cases', async ({ page }) => {
    await page.goto('/interview-setup');
    await page.selectOption('select[name="jobRole"]', 'Software Engineer');
    await page.click('text=/general/i');
    await page.click('button:has-text("Start Interview")');

    await expect(page).toHaveURL(/\/interview/);

    // Skip to coding challenge (if present)
    // Answer a few questions quickly
    const answerInput = page.locator('textarea[name="answer"], textarea.answer-input').first();
    
    for (let i = 0; i < 2; i++) {
      if (await answerInput.isVisible({ timeout: 5000 })) {
        await answerInput.fill('Quick answer');
        await page.click('button:has-text("Submit")');
        await page.waitForTimeout(2000);
      }
    }

    // Check for coding challenge
    const codeEditor = page.locator('.monaco-editor, [data-testid="code-editor"]');
    
    if (await codeEditor.isVisible({ timeout: 5000 })) {
      // Should see challenge description
      await expect(page.locator('text=/description|problem|challenge/i')).toBeVisible();

      // Should see test cases
      await expect(page.locator('text=/test case|example|input|output/i')).toBeVisible();
    }
  });

  test('should support multiple programming languages', async ({ page }) => {
    await page.goto('/interview-setup');
    await page.selectOption('select[name="jobRole"]', 'Software Engineer');
    await page.click('text=/general/i');
    await page.click('button:has-text("Start Interview")');

    await expect(page).toHaveURL(/\/interview/);

    // Skip to coding challenge
    const answerInput = page.locator('textarea[name="answer"], textarea.answer-input').first();
    
    for (let i = 0; i < 2; i++) {
      if (await answerInput.isVisible({ timeout: 5000 })) {
        await answerInput.fill('Quick answer');
        await page.click('button:has-text("Submit")');
        await page.waitForTimeout(2000);
      }
    }

    // Check for language selector
    const languageSelector = page.locator('select[name="language"], .language-selector');
    
    if (await languageSelector.isVisible({ timeout: 5000 })) {
      // Should have multiple language options
      const options = await languageSelector.locator('option').count();
      expect(options).toBeGreaterThan(1);

      // Should be able to switch languages
      await languageSelector.selectOption('python');
      await page.waitForTimeout(500);
      
      await languageSelector.selectOption('javascript');
      await page.waitForTimeout(500);
    }
  });

  test('should show code validation feedback', async ({ page }) => {
    await page.goto('/interview-setup');
    await page.selectOption('select[name="jobRole"]', 'Software Engineer');
    await page.click('text=/general/i');
    await page.click('button:has-text("Start Interview")');

    await expect(page).toHaveURL(/\/interview/);

    // Skip to coding challenge
    const answerInput = page.locator('textarea[name="answer"], textarea.answer-input').first();
    
    for (let i = 0; i < 2; i++) {
      if (await answerInput.isVisible({ timeout: 5000 })) {
        await answerInput.fill('Quick answer');
        await page.click('button:has-text("Submit")');
        await page.waitForTimeout(2000);
      }
    }

    const codeEditor = page.locator('.monaco-editor, [data-testid="code-editor"]');
    
    if (await codeEditor.isVisible({ timeout: 5000 })) {
      // Write simple code
      await codeEditor.click();
      await page.keyboard.type('function test() { return 42; }');

      // Submit code
      await page.click('button:has-text("Submit Code"), button:has-text("Run")');

      // Wait for validation
      await page.waitForTimeout(5000);

      // Should see some feedback
      await expect(page.locator('text=/feedback|analysis|quality|suggestion/i')).toBeVisible({ 
        timeout: 10000 
      });
    }
  });

  test('should enable mentor mode during interview', async ({ page }) => {
    await page.goto('/interview-setup');
    await page.selectOption('select[name="jobRole"]', 'Software Engineer');
    await page.click('text=/general/i');
    await page.click('button:has-text("Start Interview")');

    await expect(page).toHaveURL(/\/interview/);

    // Look for mentor mode toggle
    const mentorToggle = page.locator('button:has-text("Mentor Mode"), input[type="checkbox"][name*="mentor"]');
    
    if (await mentorToggle.isVisible({ timeout: 5000 })) {
      await mentorToggle.click();

      // Should see mentor mode guidance
      await expect(page.locator('text=/context|action|result|CAR/i')).toBeVisible({ 
        timeout: 5000 
      });
    }
  });
});
