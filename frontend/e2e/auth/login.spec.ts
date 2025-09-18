import { test, expect } from '@playwright/test';
import { AuthPage } from '../page-objects/AuthPage';
import { testUsers } from '../fixtures/test-data';

test.describe('Login Flow', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    await authPage.navigateToAuth();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    const user = testUsers.user;
    
    await authPage.switchToLoginTab();
    await authPage.fillLoginForm(user.email, user.password);
    await authPage.submitLogin();
    await authPage.waitForLoginSuccess();
    
    // Verify we're on the dashboard
    expect(page.url()).toContain('/dashboard');
    
    // Verify token is stored
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await authPage.switchToLoginTab();
    await authPage.fillLoginForm('invalid@email.com', 'wrongpassword');
    await authPage.submitLogin();
    
    const errorMessage = await authPage.getLoginError();
    expect(errorMessage).toBeTruthy();
    expect(errorMessage).toContain('Invalid credentials');
  });

  test('should validate empty email field', async ({ page }) => {
    await authPage.switchToLoginTab();
    await authPage.fillLoginForm('', 'password123');
    await authPage.submitLogin();
    
    // Check for validation error
    const emailInput = page.getByTestId('login-email-input');
    const validationMessage = await emailInput.getAttribute('validationMessage');
    expect(validationMessage).toBeTruthy();
  });

  test('should validate empty password field', async ({ page }) => {
    await authPage.switchToLoginTab();
    await authPage.fillLoginForm('test@email.com', '');
    await authPage.submitLogin();
    
    // Check for validation error
    const passwordInput = page.getByTestId('login-password-input');
    const validationMessage = await passwordInput.getAttribute('validationMessage');
    expect(validationMessage).toBeTruthy();
  });

  test('should persist session across browser refresh', async ({ page }) => {
    const user = testUsers.user;
    
    await authPage.login(user.email, user.password);
    
    // Refresh the page
    await page.reload();
    
    // Should still be authenticated
    expect(page.url()).toContain('/dashboard');
    
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });

  test('should redirect to dashboard when already authenticated', async ({ page }) => {
    const user = testUsers.user;
    
    // First login
    await authPage.login(user.email, user.password);
    
    // Navigate back to auth page
    await page.goto('/auth');
    
    // Should automatically redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 5000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/auth/login', route => {
      route.abort('failed');
    });
    
    const user = testUsers.user;
    await authPage.switchToLoginTab();
    await authPage.fillLoginForm(user.email, user.password);
    await authPage.submitLogin();
    
    // Should show network error message
    const errorMessage = await authPage.getLoginError();
    expect(errorMessage).toBeTruthy();
  });

  test('should work with different user roles', async ({ page }) => {
    // Test admin login
    const admin = testUsers.admin;
    await authPage.login(admin.email, admin.password);
    expect(page.url()).toContain('/dashboard');
    
    // Logout and test manager login
    await page.evaluate(() => localStorage.clear());
    await page.goto('/auth');
    
    const manager = testUsers.manager;
    await authPage.login(manager.email, manager.password);
    expect(page.url()).toContain('/dashboard');
  });
});