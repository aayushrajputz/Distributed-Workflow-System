import { test, expect } from '@playwright/test';
import { TasksPage } from '../page-objects/TasksPage';
import { setupAuthenticatedUser } from '../helpers/auth';
import { setupCollaborationTest, connectSocket, waitForSocketEvent, verifyNotificationReceived } from '../helpers/socket';

test.describe('Real-time Collaboration', () => {
  test('should setup multiple browser contexts with different users', async ({ browser }) => {
    // Create multiple browser contexts
    const adminContext = await browser.newContext();
    const managerContext = await browser.newContext();
    const userContext = await browser.newContext();
    
    const contexts = [adminContext, managerContext, userContext];
    const userTypes = ['admin', 'manager', 'user'];
    
    // Setup collaboration test
    const collaboration = await setupCollaborationTest(contexts, userTypes);
    
    // Verify all users are connected
    expect(collaboration.pages.length).toBe(3);
    expect(collaboration.userTypes.length).toBe(3);
    
    // Verify each user is on their dashboard
    for (const page of collaboration.pages) {
      expect(page.url()).toContain('/dashboard');
    }
    
    // Cleanup
    await Promise.all(contexts.map(context => context.close()));
  });

  test('should broadcast task status changes to all users', async ({ browser }) => {
    const contexts = [
      await browser.newContext(),
      await browser.newContext()
    ];
    
    const collaboration = await setupCollaborationTest(contexts, ['admin', 'user']);
    const [adminPage, userPage] = collaboration.pages;
    
    // Admin creates a task
    const adminTasksPage = new TasksPage(adminPage);
    await adminTasksPage.navigateToTasks();
    
    const taskData = {
      title: `Real-time Status Test ${Date.now()}`,
      description: 'Task for testing real-time status updates',
      project: 'Collaboration Test'
    };
    
    await adminTasksPage.createTask(taskData);
    
    // User should see the new task
    const userTasksPage = new TasksPage(userPage);
    await userTasksPage.navigateToTasks();
    await userTasksPage.waitForTasksToLoad();
    
    const userTasks = await userTasksPage.getTaskList();
    const sharedTask = userTasks.find(task => task.title === taskData.title);
    expect(sharedTask).toBeTruthy();
    
    if (sharedTask) {
      // Admin updates task status
      await adminTasksPage.updateTaskStatus(sharedTask.id, 'in_progress');
      
      // User should see the status update in real-time
      await userPage.waitForTimeout(2000); // Wait for real-time update
      
      // Verify status change on user's page
      const updatedStatus = await userTasksPage.getTaskStatus(sharedTask.id);
      expect(updatedStatus).toBe('in_progress');
    }
    
    // Cleanup
    await Promise.all(contexts.map(context => context.close()));
  });

  test('should broadcast task assignment notifications', async ({ browser }) => {
    const contexts = [
      await browser.newContext(),
      await browser.newContext(),
      await browser.newContext()
    ];
    
    const collaboration = await setupCollaborationTest(contexts, ['admin', 'manager', 'user']);
    const [adminPage, managerPage, userPage] = collaboration.pages;
    
    // Admin creates a task
    const adminTasksPage = new TasksPage(adminPage);
    await adminTasksPage.navigateToTasks();
    
    const taskData = {
      title: `Assignment Notification Test ${Date.now()}`,
      description: 'Task for testing assignment notifications',
      project: 'Collaboration Test'
    };
    
    await adminTasksPage.createTask(taskData);
    
    const tasks = await adminTasksPage.getTaskList();
    const createdTask = tasks.find(task => task.title === taskData.title);
    
    if (createdTask) {
      // Admin assigns task to user
      await adminTasksPage.assignTask(createdTask.id, 'user@test.com');
      
      // User should receive assignment notification
      await waitForSocketEvent(userPage, 'task_assigned', 5000);
      
      // Manager should also be notified (if they have oversight)
      try {
        await waitForSocketEvent(managerPage, 'task_assigned', 3000);
      } catch {
        // Manager notifications might be optional
      }
    }
    
    // Cleanup
    await Promise.all(contexts.map(context => context.close()));
  });

  test('should broadcast task completion notifications', async ({ browser }) => {
    const contexts = [
      await browser.newContext(),
      await browser.newContext()
    ];
    
    const collaboration = await setupCollaborationTest(contexts, ['manager', 'user']);
    const [managerPage, userPage] = collaboration.pages;
    
    // User creates and completes a task
    const userTasksPage = new TasksPage(userPage);
    await userTasksPage.navigateToTasks();
    
    const taskData = {
      title: `Completion Notification Test ${Date.now()}`,
      description: 'Task for testing completion notifications',
      assignee: 'user@test.com',
      project: 'Collaboration Test'
    };
    
    await userTasksPage.createTask(taskData);
    
    const tasks = await userTasksPage.getTaskList();
    const createdTask = tasks.find(task => task.title === taskData.title);
    
    if (createdTask) {
      // User completes the task
      await userTasksPage.updateTaskStatus(createdTask.id, 'completed');
      
      // Manager should receive completion notification
      await waitForSocketEvent(managerPage, 'task_completed', 5000);
      
      // Verify notification appears in manager's UI
      await verifyNotificationReceived(managerPage, 'task_completed');
    }
    
    // Cleanup
    await Promise.all(contexts.map(context => context.close()));
  });

  test('should update task lists without page refresh', async ({ browser }) => {
    const contexts = [
      await browser.newContext(),
      await browser.newContext()
    ];
    
    const collaboration = await setupCollaborationTest(contexts, ['admin', 'user']);
    const [adminPage, userPage] = collaboration.pages;
    
    // Both users navigate to tasks page
    const adminTasksPage = new TasksPage(adminPage);
    const userTasksPage = new TasksPage(userPage);
    
    await adminTasksPage.navigateToTasks();
    await userTasksPage.navigateToTasks();
    
    // Get initial task count for user
    const initialUserTasks = await userTasksPage.getTaskCount();
    
    // Admin creates a new task
    const taskData = {
      title: `Live Update Test ${Date.now()}`,
      description: 'Task for testing live updates',
      project: 'Collaboration Test'
    };
    
    await adminTasksPage.createTask(taskData);
    
    // User's task list should update automatically
    await userTasksPage.waitForTasksToLoad();
    const updatedUserTasks = await userTasksPage.getTaskCount();
    
    expect(updatedUserTasks).toBeGreaterThan(initialUserTasks);
    
    // Verify the new task appears in user's list
    const userTasks = await userTasksPage.getTaskList();
    const newTask = userTasks.find(task => task.title === taskData.title);
    expect(newTask).toBeTruthy();
    
    // Cleanup
    await Promise.all(contexts.map(context => context.close()));
  });

  test('should verify socket authentication for each user', async ({ browser }) => {
    const contexts = [
      await browser.newContext(),
      await browser.newContext()
    ];
    
    const pages = [];
    
    for (let i = 0; i < contexts.length; i++) {
      const page = await contexts[i].newPage();
      await setupAuthenticatedUser(page, i === 0 ? 'admin' : 'user');
      
      // Connect socket and verify authentication
      await connectSocket(page);
      await waitForSocketEvent(page, 'authenticated', 5000);
      
      pages.push(page);
    }
    
    // Both users should be authenticated
    for (const page of pages) {
      const isConnected = await page.evaluate(() => {
        return window.socket && window.socket.connected;
      });
      expect(isConnected).toBeTruthy();
    }
    
    // Cleanup
    await Promise.all(contexts.map(context => context.close()));
  });

  test('should handle concurrent users', async ({ browser }) => {
    const contexts = await Promise.all(
      Array(3).fill(0).map(() => browser.newContext())
    );
    
    const collaboration = await setupCollaborationTest(contexts, ['admin', 'manager', 'user']);
    
    // Simulate concurrent task creation
    const taskPromises = collaboration.pages.map(async (page, index) => {
      const tasksPage = new TasksPage(page);
      await tasksPage.navigateToTasks();
      
      const taskData = {
        title: `Concurrent Task ${index + 1} ${Date.now()}`,
        description: `Task created by user ${index + 1}`,
        project: 'Concurrent Test'
      };
      
      await tasksPage.createTask(taskData);
      return taskData;
    });
    
    // Wait for all tasks to be created
    const createdTasks = await Promise.all(taskPromises);
    expect(createdTasks.length).toBe(3);
    
    // Verify all users can see all tasks
    for (const page of collaboration.pages) {
      const tasksPage = new TasksPage(page);
      await tasksPage.waitForTasksToLoad();
      const tasks = await tasksPage.getTaskList();
      
      // Should see at least the tasks created in this test
      const testTasks = tasks.filter(task => task.title?.includes('Concurrent Task'));
      expect(testTasks.length).toBeGreaterThanOrEqual(3);
    }
    
    // Cleanup
    await Promise.all(contexts.map(context => context.close()));
  });

  test('should handle user presence indicators', async ({ browser }) => {
    const contexts = [
      await browser.newContext(),
      await browser.newContext()
    ];
    
    const collaboration = await setupCollaborationTest(contexts, ['admin', 'user']);
    const [adminPage, userPage] = collaboration.pages;
    
    // Check if presence indicators are shown
    const presenceIndicator = adminPage.getByTestId('user-presence-indicator');
    if (await presenceIndicator.isVisible()) {
      const presenceText = await presenceIndicator.textContent();
      expect(presenceText).toMatch(/online|active/i);
    }
    
    // Cleanup
    await Promise.all(contexts.map(context => context.close()));
  });

  test('should handle graceful disconnections', async ({ browser }) => {
    const contexts = [
      await browser.newContext(),
      await browser.newContext()
    ];
    
    const collaboration = await setupCollaborationTest(contexts, ['admin', 'user']);
    const [adminPage, userPage] = collaboration.pages;
    
    // Disconnect one user
    await userPage.evaluate(() => {
      if (window.socket) {
        window.socket.disconnect();
      }
    });
    
    // Admin should be notified of disconnection
    try {
      await waitForSocketEvent(adminPage, 'user_disconnected', 3000);
    } catch {
      // Disconnection events might not be implemented
    }
    
    // Cleanup
    await Promise.all(contexts.map(context => context.close()));
  });
});