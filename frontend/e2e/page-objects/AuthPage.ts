import { Page, Locator, expect } from '@playwright/test';

export class AuthPage {
  readonly page: Page;
  readonly loginTab: Locator;
  readonly signupTab: Locator;
  
  // Login form elements
  readonly loginEmailInput: Locator;
  readonly loginPasswordInput: Locator;
  readonly loginSubmitButton: Locator;
  
  // Signup form elements
  readonly signupFirstNameInput: Locator;
  readonly signupLastNameInput: Locator;
  readonly signupUsernameInput: Locator;
  readonly signupEmailInput: Locator;
  readonly signupPasswordInput: Locator;
  readonly signupSubmitButton: Locator;
  
  // Common elements
  readonly authError: Locator;
  readonly authSuccess: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.loginTab = page.getByTestId('login-tab');
    this.signupTab = page.getByTestId('signup-tab');
    
    // Login form
    this.loginEmailInput = page.getByTestId('login-email-input');
    this.loginPasswordInput = page.getByTestId('login-password-input');
    this.loginSubmitButton = page.getByTestId('login-submit-button');
    
    // Signup form
    this.signupFirstNameInput = page.getByTestId('signup-firstname-input');
    this.signupLastNameInput = page.getByTestId('signup-lastname-input');
    this.signupUsernameInput = page.getByTestId('signup-username-input');
    this.signupEmailInput = page.getByTestId('signup-email-input');
    this.signupPasswordInput = page.getByTestId('signup-password-input');
    this.signupSubmitButton = page.getByTestId('signup-submit-button');
    
    // Common elements
    this.authError = page.locator('[role="alert"]').first();
    this.authSuccess = page.locator('.success-message').first();
    this.loadingSpinner = page.locator('.animate-spin').first();
  }

  async navigateToAuth() {
    await this.page.goto('/auth');
    await this.page.waitForLoadState('networkidle');
  }

  async switchToLoginTab() {
    await this.loginTab.click();
    await expect(this.loginEmailInput).toBeVisible();
  }

  async switchToSignupTab() {
    await this.signupTab.click();
    await expect(this.signupFirstNameInput).toBeVisible();
  }

  async fillLoginForm(email: string, password: string) {
    await this.loginEmailInput.fill(email);
    await this.loginPasswordInput.fill(password);
  }

  async submitLogin() {
    await this.loginSubmitButton.click();
  }

  async login(email: string, password: string) {
    await this.switchToLoginTab();
    await this.fillLoginForm(email, password);
    await this.submitLogin();
    await this.waitForLoginSuccess();
  }

  async fillSignupForm(userData: any) {
    await this.signupFirstNameInput.fill(userData.firstName);
    await this.signupLastNameInput.fill(userData.lastName);
    await this.signupUsernameInput.fill(userData.username);
    await this.signupEmailInput.fill(userData.email);
    await this.signupPasswordInput.fill(userData.password);
  }

  async submitSignup() {
    await this.signupSubmitButton.click();
  }

  async signup(userData: any) {
    await this.switchToSignupTab();
    await this.fillSignupForm(userData);
    await this.submitSignup();
    await this.waitForSignupSuccess();
  }

  async waitForLoginSuccess() {
    await this.page.waitForURL('**/dashboard', { timeout: 10000 });
  }

  async waitForSignupSuccess() {
    // Wait for either redirect to dashboard or success message
    try {
      await this.page.waitForURL('**/dashboard', { timeout: 5000 });
    } catch {
      await expect(this.authSuccess).toBeVisible({ timeout: 5000 });
    }
  }

  async getLoginError(): Promise<string | null> {
    try {
      await this.authError.waitFor({ timeout: 3000 });
      return await this.authError.textContent();
    } catch {
      return null;
    }
  }

  async getSignupError(): Promise<string | null> {
    try {
      await this.authError.waitFor({ timeout: 3000 });
      return await this.authError.textContent();
    } catch {
      return null;
    }
  }

  async isLoading(): Promise<boolean> {
    try {
      await this.loadingSpinner.waitFor({ timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  async isOnLoginTab(): Promise<boolean> {
    return await this.loginEmailInput.isVisible();
  }

  async isOnSignupTab(): Promise<boolean> {
    return await this.signupFirstNameInput.isVisible();
  }

  async getPasswordValidation() {
    // This would check password validation indicators
    return {
      hasMinLength: await this.page.locator('text=At least 8 characters').isVisible(),
      hasUppercase: await this.page.locator('text=One uppercase letter').isVisible(),
      hasLowercase: await this.page.locator('text=One lowercase letter').isVisible(),
      hasNumber: await this.page.locator('text=One number').isVisible(),
      hasSpecialChar: await this.page.locator('text=One special character').isVisible()
    };
  }

  async waitForValidationError(fieldName: string): Promise<string> {
    const errorLocator = this.page.locator(`[data-testid="${fieldName}"] + .error-message`);
    await errorLocator.waitFor({ timeout: 3000 });
    return await errorLocator.textContent() || '';
  }
}