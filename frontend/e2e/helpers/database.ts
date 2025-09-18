import { Page } from '@playwright/test';

export async function seedTestDatabase() {
  console.log('🌱 Seeding test database...');
  // Database seeding logic would go here
  // This could involve API calls to create test data
}

export async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');
  // Cleanup logic would go here
}

export async function createTestTasks(page: Page, count: number = 5) {
  const tasks = [];
  
  for (let i = 0; i < count; i++) {
    const task = {
      title: `Test Task ${i + 1}`,
      description: `This is test task number ${i + 1}`,
      status: 'pending',
      priority: 'medium',
      assignedTo: 'user@test.com',
      project: 'Test Project'
    };
    
    const response = await page.request.post('/api/tasks', {
      data: task
    });
    
    if (response.ok()) {
      const createdTask = await response.json();
      tasks.push(createdTask);
    }
  }
  
  return tasks;
}

export async function generateTaskData(overrides: any = {}) {
  const timestamp = Date.now();
  
  return {
    title: `Test Task ${timestamp}`,
    description: `Test task created at ${new Date().toISOString()}`,
    status: 'pending',
    priority: 'medium',
    assignedTo: 'user@test.com',
    assignedBy: 'admin@test.com',
    project: 'E2E Test Project',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides
  };
}