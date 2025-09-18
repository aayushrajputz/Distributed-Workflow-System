import { test, expect } from '@playwright/test';
import { TasksPage } from '../page-objects/TasksPage';
import { setupAuthenticatedUser } from '../helpers/auth';
import { connectSocket, waitForSocketEvent } from '../helpers/socket';
import { createTaskData } from '../fixtures/test-data';

test.describe('Task Lifecycle', () => {
  let tasksPage: TasksPage;

  test.beforeEach(async ({ page }) => {
    // Setup authenticated user
    await setupAuthenticatedUser(page, 'user');
    
    tasksPage = new TasksPage(page);
    await tasksPage.navigateToTasks();
    await tasksPage.waitForTasksToLoad();
    
    // Setup socket connection for real-time updates
    await connectSocket(page);
  });

  test('should create new task with all required fields', async ({ page }) => {
    const taskData = {
      title: `E2E Test Task ${Date.now()}`,
      description: 'This is a test task created during E2E testing',
      assignee: 'Test User',
      priority: 'medium',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      project: 'E2E Testing'
    };

    await tasksPage.createTask(taskData);

    // Verify task appears in list
    const tasks = await tasksPage.getTaskList();
    const createdTask = tasks.find(task => task.title === taskData.title);
    expect(createdTask).toBeTruthy();
    expect(createdTask?.status).toBe('pending');
  });

  test('should assign task to another user', async ({ page }) => {
    // First create a task
    const taskData = {
      title: `Assignment Test Task ${Date.now()}`,
      description: 'Task for testing assignment functionality',
      project: 'E2E Testing'
    };

    await tasksPage.createTask(taskData);
    
    // Get the created task
    const tasks = await tasksPage.getTaskList();
    const createdTask = tasks.find(task => task.title === taskData.title);
    expect(createdTask).toBeTruthy();

    if (createdTask) {
      // Assign task to another user
      await tasksPage.assignTask(createdTask.id, 'manager@test.com');
      
      // Verify assignment
      const isAssigned = await tasksPage.verifyTaskAssignment(createdTask.id, 'manager@test.com');
      expect(isAssigned).toBeTruthy();
    }
  });

  test('should change task status from pending to in-progress', async ({ page }) => {
    // Create a pending task
    const taskData = {
      title: `Status Update Test ${Date.now()}`,
      description: 'Task for testing status updates',
      project: 'E2E Testing'
    };

    await tasksPage.createTask(taskData);
    
    const tasks = await tasksPage.getTaskList();
    const createdTask = tasks.find(task => task.title === taskData.title);
    expect(createdTask?.status).toBe('pending');

    if (createdTask) {
      // Update status to in-progress
      await tasksPage.updateTaskStatus(createdTask.id, 'in_progress');
      
      // Verify status change
      const isStatusUpdated = await tasksPage.verifyTaskStatus(createdTask.id, 'in_progress');
      expect(isStatusUpdated).toBeTruthy();
    }
  });

  test('should mark task as completed', async ({ page }) => {
    // Create an in-progress task
    const taskData = {
      title: `Completion Test ${Date.now()}`,
      description: 'Task for testing completion',
      project: 'E2E Testing'
    };

    await tasksPage.createTask(taskData);
    
    const tasks = await tasksPage.getTaskList();
    const createdTask = tasks.find(task => task.title === taskData.title);

    if (createdTask) {
      // First move to in-progress
      await tasksPage.updateTaskStatus(createdTask.id, 'in_progress');
      
      // Then mark as completed
      await tasksPage.updateTaskStatus(createdTask.id, 'completed');
      
      // Verify completion
      const isCompleted = await tasksPage.verifyTaskStatus(createdTask.id, 'completed');
      expect(isCompleted).toBeTruthy();
    }
  });

  test('should filter and search tasks', async ({ page }) => {
    // Create tasks with different statuses
    const taskData1 = {
      title: `Search Test Task 1 ${Date.now()}`,
      description: 'First task for search testing',
      project: 'E2E Testing'
    };
    
    const taskData2 = {
      title: `Search Test Task 2 ${Date.now()}`,
      description: 'Second task for search testing',
      project: 'E2E Testing'
    };

    await tasksPage.createTask(taskData1);
    await tasksPage.createTask(taskData2);
    
    // Update one task to in-progress
    const tasks = await tasksPage.getTaskList();
    const task1 = tasks.find(task => task.title === taskData1.title);
    if (task1) {
      await tasksPage.updateTaskStatus(task1.id, 'in_progress');
    }

    // Test search functionality
    await tasksPage.searchTasks('Search Test Task 1');
    await page.waitForTimeout(1000); // Wait for search to complete
    
    const searchResults = await tasksPage.getTaskList();
    expect(searchResults.length).toBe(1);
    expect(searchResults[0].title).toContain('Search Test Task 1');

    // Clear search
    await tasksPage.searchTasks('');
    
    // Test status filter
    await tasksPage.filterByStatus('in_progress');
    await page.waitForTimeout(1000);
    
    const filteredResults = await tasksPage.getTaskList();
    const inProgressTasks = filteredResults.filter(task => task.status === 'in_progress');
    expect(inProgressTasks.length).toBeGreaterThan(0);
  });

  test('should show real-time updates across multiple users', async ({ page, browser }) => {
    // Setup multiple user contexts
    const user2Context = await browser.newContext();
    const user2Page = await user2Context.newPage();
    await setupAuthenticatedUser(user2Page, 'manager');
    
    const user2TasksPage = new TasksPage(user2Page);
    await user2TasksPage.navigateToTasks();
    await connectSocket(user2Page);

    // Create task as user 1
    const taskData = {
      title: `Collaboration Test ${Date.now()}`,
      description: 'Task for testing real-time collaboration',
      project: 'E2E Testing'
    };

    await tasksPage.createTask(taskData);
    
    // User 2 should see the new task
    await user2TasksPage.waitForTasksToLoad();
    const user2Tasks = await user2TasksPage.getTaskList();
    const sharedTask = user2Tasks.find(task => task.title === taskData.title);
    expect(sharedTask).toBeTruthy();

    if (sharedTask) {
      // User 2 updates task status
      await user2TasksPage.updateTaskStatus(sharedTask.id, 'in_progress');
      
      // User 1 should see the status update in real-time
      await page.waitForTimeout(2000); // Wait for real-time update
      const updatedStatus = await tasksPage.getTaskStatus(sharedTask.id);
      expect(updatedStatus).toBe('in_progress');
    }

    await user2Context.close();
  });

  test('should handle task blocking and unblocking', async ({ page }) => {
    const taskData = {
      title: `Blocking Test ${Date.now()}`,
      description: 'Task for testing blocking functionality',
      project: 'E2E Testing'
    };

    await tasksPage.createTask(taskData);
    
    const tasks = await tasksPage.getTaskList();
    const createdTask = tasks.find(task => task.title === taskData.title);

    if (createdTask) {
      // Block the task
      await tasksPage.updateTaskStatus(createdTask.id, 'blocked');
      
      // Verify blocked status
      const isBlocked = await tasksPage.verifyTaskStatus(createdTask.id, 'blocked');
      expect(isBlocked).toBeTruthy();
      
      // Unblock the task
      await tasksPage.updateTaskStatus(createdTask.id, 'pending');
      
      // Verify unblocked
      const isUnblocked = await tasksPage.verifyTaskStatus(createdTask.id, 'pending');
      expect(isUnblocked).toBeTruthy();
    }
  });

  test('should persist task data in database', async ({ page }) => {
    const taskData = {
      title: `Persistence Test ${Date.now()}`,
      description: 'Task for testing data persistence',
      project: 'E2E Testing'
    };

    await tasksPage.createTask(taskData);
    
    // Refresh page to verify data persistence
    await page.reload();
    await tasksPage.waitForTasksToLoad();
    
    const tasks = await tasksPage.getTaskList();
    const persistedTask = tasks.find(task => task.title === taskData.title);
    expect(persistedTask).toBeTruthy();
  });
});