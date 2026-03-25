import { Page } from '@playwright/test';

export class AuthHelper {
  constructor(private page: Page) {}

  async signup(email: string, password: string, name: string, role: string = 'candidate') {
    await this.page.goto('/signup');
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.fill('input[name="name"]', name);
    await this.page.selectOption('select[name="role"]', role);
    await this.page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard or login
    await this.page.waitForURL(/\/(dashboard|login)/);
  }

  async login(email: string, password: string) {
    await this.page.goto('/login');
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard
    await this.page.waitForURL('/dashboard', { timeout: 10000 });
  }

  async logout() {
    await this.page.click('button:has-text("Logout")');
    await this.page.waitForURL('/login');
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      // Check if we can access dashboard
      const response = await this.page.goto('/dashboard');
      return response?.status() !== 401;
    } catch {
      return false;
    }
  }

  async getAuthToken(): Promise<string | null> {
    return await this.page.evaluate(() => {
      return localStorage.getItem('token');
    });
  }
}
