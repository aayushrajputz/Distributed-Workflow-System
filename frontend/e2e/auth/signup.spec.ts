import { test, expect } from '@playwright/test';
import { AuthPage } from '../page-objects/AuthPage';
import { createUserData } from '../fixtures/test-data';

test.describe('Signup Flow', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    await authPage.navigateToAuth();
  });

  test('should signup successfully with valid user data', async ({ page }) => {
    const userData = createUserData('user', {
      email: `newuser${Date.now()}@test.com`,
      username: `newuser${Date.now()}`
    });
    
    await authPage.switchToSignupTab();
    await authPage.fillSignupForm(userData);
    await authPage.submitSignup();
    await authPage.waitForSignupSuccess();
    
    // In development mode, might redirect to dashboard
    // In production, might show email verification message
    const currentUrl = page.url();
    const isOnDashboard = currentUrl.includes('/dashboard');
    const hasSuccessMessage = await authPage.authSuccess.isVisible();
    
    expect(isOnDashboard || hasSuccessMessage).toBeTruthy();
  });

  test('should show error for duplicate email', async ({ page }) => {
    const userData = createUserData('user', {
      email: 'user@test.com', // Existing test user email
      username: `newuser${Date.now()}`
    });
    
    await authPage.switchToSignupTab();
    await authPage.fillSignupForm(userData);
    await authPage.submitSignup();
    
    const errorMessage = await authPage.getSignupError();
    expect(errorMessage).toBeTruthy();
    expect(errorMessage).toMatch(/email.*already.*exists|email.*taken/i);
  });

  test('should validate all required fields', async ({ page }) => {
    await authPage.switchToSignupTab();
    
    // Try to submit empty form
    await authPage.submitSignup();
    
    // Check for validation errors on required fields
    const requiredFields = [
      'signup-firstname-input',
      'signup-lastname-input', 
      'signup-username-input',
      'signup-email-input',
      'signup-password-input'
    ];
    
    for (const fieldId of requiredFields) {
      const field = page.getByTestId(fieldId);
      const validity = await field.evaluate((el: HTMLInputElement) => el.validity.valid);
      expect(validity).toBeFalsy();
    }
  });

  test('should validate username format', async ({ page }) => {
    const userData = createUserData('user', {
      username: 'invalid-username!', // Contains invalid characters
      email: `test${Date.now()}@test.com`
    });
    
    await authPage.switchToSignupTab();
    await authPage.fillSignupForm(userData);
    await authPage.submitSignup();
    
    const validationError = await authPage.waitForValidationError('signup-username');
    expect(validationError).toMatch(/username.*alphanumeric|username.*letters.*numbers/i);
  });

  test('should validate password complexity', async ({ page }) => {
    await authPage.switchToSignupTab();
    
    // Test weak password
    const userData = createUserData('user', {
      password: 'weak',
      email: `test${Date.now()}@test.com`,
      username: `test${Date.now()}`
    });
    
    await authPage.fillSignupForm(userData);
    
    // Check password validation indicators
    const validation = await authPage.getPasswordValidation();
    expect(validation.hasMinLength).toBeFalsy();
    expect(validation.hasUppercase).toBeFalsy();
    expect(validation.hasNumber).toBeFalsy();
    expect(validation.hasSpecialChar).toBeFalsy();
  });

  test('should show real-time password strength indicator', async ({ page }) => {
    await authPage.switchToSignupTab();
    
    const passwordInput = page.getByTestId('signup-password-input');
    
    // Type progressively stronger passwords
    await passwordInput.fill('weak');
    let validation = await authPage.getPasswordValidation();
    expect(validation.hasMinLength).toBeFalsy();
    
    await passwordInput.fill('WeakPassword');
    validation = await authPage.getPasswordValidation();
    expect(validation.hasMinLength).toBeTruthy();
    expect(validation.hasUppercase).toBeTruthy();
    
    await passwordInput.fill('WeakPassword123!');
    validation = await authPage.getPasswordValidation();
    expect(validation.hasNumber).toBeTruthy();
    expect(validation.hasSpecialChar).toBeTruthy();
  });

  test('should switch between login and signup tabs', async ({ page }) => {
    // Should start on login tab by default
    expect(await authPage.isOnLoginTab()).toBeTruthy();
    
    // Switch to signup tab
    await authPage.switchToSignupTab();
    expect(await authPage.isOnSignupTab()).toBeTruthy();
    expect(await authPage.isOnLoginTab()).toBeFalsy();
    
    // Switch back to login tab
    await authPage.switchToLoginTab();
    expect(await authPage.isOnLoginTab()).toBeTruthy();
    expect(await authPage.isOnSignupTab()).toBeFalsy();
  });

  test('should handle server validation errors', async ({ page }) => {
    // Mock server validation error
    await page.route('**/api/auth/register', route => {
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Validation failed',
          details: {
            email: 'Email format is invalid',
            username: 'Username already exists'
          }
        })
      });
    });
    
    const userData = createUserData('user', {
      email: `test${Date.now()}@test.com`,
      username: `test${Date.now()}`
    });
    
    await authPage.switchToSignupTab();
    await authPage.fillSignupForm(userData);
    await authPage.submitSignup();
    
    const errorMessage = await authPage.getSignupError();
    expect(errorMessage).toBeTruthy();
  });

  test('should create user and allow immediate login', async ({ page }) => {
    const userData = createUserData('user', {
      email: `integration${Date.now()}@test.com`,
      username: `integration${Date.now()}`
    });
    
    // Sign up
    await authPage.signup(userData);
    
    // If redirected to dashboard, user is automatically logged in
    if (page.url().includes('/dashboard')) {
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeTruthy();
    } else {
      // Otherwise, try to log in with the new account
      await page.goto('/auth');
      await authPage.login(userData.email, userData.password);
      expect(page.url()).toContain('/dashboard');
    }
  });
});