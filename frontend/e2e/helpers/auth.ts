import { Page, BrowserContext } from '@playwright/test';

export const testUsers = {
  admin: { email: 'admin@test.com', password: 'AdminPass123!', role: 'admin' },
  manager: { email: 'manager@test.com', password: 'ManagerPass123!', role: 'manager' },
  user: { email: 'user@test.com', password: 'UserPass123!', role: 'user' }
};

export async function loginAsUser(page: Page, userType: keyof typeof testUsers) {
  const user = testUsers[userType];
  
  await page.goto('/auth');
  await page.getByTestId('login-tab').click();
  await page.getByTestId('login-email-input').fill(user.email);
  await page.getByTestId('login-password-input').fill(user.password);
  await page.getByTestId('login-submit-button').click();
  
  // Wait for successful login
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

export async function loginViaAPI(page: Page, userType: keyof typeof testUsers) {
  const user = testUsers[userType];
  
  const response = await page.request.post('/api/auth/login', {
    data: {
      email: user.email,
      password: user.password
    }
  });
  
  const data = await response.json();
  
  // Set token in localStorage
  await page.addInitScript((token) => {
    localStorage.setItem('token', token);
  }, data.token);
  
  return data.token;
}

export async function setupAuthenticatedUser(page: Page, userType: keyof typeof testUsers) {
  await loginViaAPI(page, userType);
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
}

export async function createAuthState(context: BrowserContext, userType: keyof typeof testUsers) {
  const page = await context.newPage();
  await loginAsUser(page, userType);
  await page.close();
}

export async function clearAuthState(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  });
}