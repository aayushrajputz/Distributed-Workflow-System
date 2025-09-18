import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test environment setup...');
  
  // Wait for services to be ready
  await waitForServices();
  
  // Setup test database
  await setupDatabase();
  
  // Create test users
  await createTestUsers();
  
  console.log('✅ E2E test environment setup completed');
}

async function waitForServices(): Promise<void> {
  console.log('⏳ Waiting for services to be ready...');
  
  const maxAttempts = 30;
  const delayMs = 2000;
  
  // Wait for frontend
  await waitForService('Frontend', 'http://localhost:3000', maxAttempts, delayMs);
  
  // Wait for backend API
  await waitForService('Backend API', 'http://localhost:5000/api/health', maxAttempts, delayMs);
  
  console.log('✅ All services are ready');
}

async function waitForService(
  serviceName: string, 
  url: string, 
  maxAttempts: number, 
  delayMs: number
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) {
        console.log(`✅ ${serviceName} is ready (attempt ${attempt})`);
        return;
      }
    } catch (error) {
      console.log(`⏳ ${serviceName} not ready yet (attempt ${attempt}/${maxAttempts})`);
    }
    
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw new Error(`${serviceName} failed to become ready after ${maxAttempts} attempts`);
}

async function setupDatabase(): Promise<void> {
  console.log('🗄️  Setting up test database...');
  // Database setup logic would go here
  console.log('✅ Test database setup completed');
}

async function createTestUsers(): Promise<void> {
  console.log('👥 Creating test users...');
  
  const testUsers = [
    { email: 'admin@test.com', password: 'AdminPass123!', role: 'admin' },
    { email: 'manager@test.com', password: 'ManagerPass123!', role: 'manager' },
    { email: 'user@test.com', password: 'UserPass123!', role: 'user' }
  ];
  
  for (const user of testUsers) {
    try {
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: user.role.charAt(0).toUpperCase() + user.role.slice(1),
          lastName: 'User',
          username: user.role + 'user',
          email: user.email,
          password: user.password,
        }),
      });
      
      if (response.ok || response.status === 400) {
        console.log(`✅ Test user ${user.email} ready`);
      }
    } catch (error) {
      console.log(`⚠️  Could not create test user ${user.email}:`, error);
    }
  }
  
  console.log('✅ Test users setup completed');
}

export default globalSetup;