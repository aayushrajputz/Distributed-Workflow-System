const request = require('supertest');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const app = require('../app');
const Task = require('../models/Task');
const User = require('../models/User');
const Notification = require('../models/Notification');
const WorkflowExecution = require('../models/WorkflowExecution');
const WorkflowTemplate = require('../models/WorkflowTemplate');
const workflowEngine = require('../services/workflowEngine');
const notificationService = require('../services/notificationService');
const { generateToken } = require('../config/jwt');

describe('Workflow Lifecycle Integration Tests', () => {
  let server, io, clientSocket, testUser, testManager, authToken, managerToken;
  const port = 3002;

  beforeAll(async () => {
    // Create test users
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'testuser@example.com',
      password: 'password123',
      role: 'user',
      isActive: true,
      isEmailVerified: true,
    });

    testManager = await User.create({
      firstName: 'Test',
      lastName: 'Manager',
      email: 'manager@example.com',
      password: 'password123',
      role: 'manager',
      isActive: true,
      isEmailVerified: true,
      managedUsers: [testUser._id],
    });

    // Generate auth tokens
    authToken = generateToken(testUser._id);
    managerToken = generateToken(testManager._id);

    // Start workflow engine
    workflowEngine.start();

    // Setup Socket.IO server for testing
    io = new Server(port);
    server = io.listen(port);
  });

  afterAll(async () => {
    // Clean up
    await User.deleteMany({});
    await Task.deleteMany({});
    await Notification.deleteMany({});
    await WorkflowExecution.deleteMany({});
    await WorkflowTemplate.deleteMany({});
    
    workflowEngine.stop();
    
    if (server) {
      server.close();
    }
    
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  beforeEach(() => {
    // Clear notifications before each test
    return Notification.deleteMany({});
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Complete Task Lifecycle', () => {
    test('should handle complete task creation to completion workflow', async () => {
      // Step 1: Create a task
      const taskData = {
        title: 'Integration Test Task',
        description: 'This is a test task for integration testing',
        priority: 'high',
        assignedTo: testUser._id,
        project: 'Integration Test Project',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        scheduledDate: new Date(),
        tags: ['integration', 'test'],
      };

      const createResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(taskData)
        .expect(201);

      const createdTask = createResponse.body.data;
      expect(createdTask.title).toBe(taskData.title);
      expect(createdTask.assignedTo._id).toBe(testUser._id.toString());
      expect(createdTask.assignedBy._id).toBe(testManager._id.toString());

      // Step 2: Verify task assignment notification was created
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async operations

      const assignmentNotifications = await Notification.find({
        recipient: testUser._id,
        type: 'task_assigned',
        'data.taskId': createdTask._id,
      });

      expect(assignmentNotifications).toHaveLength(1);
      expect(assignmentNotifications[0].title).toContain('New Task Assigned');

      // Step 3: Update task status to in_progress
      const statusUpdateResponse = await request(app)
        .patch(`/api/tasks/${createdTask._id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'in_progress' })
        .expect(200);

      expect(statusUpdateResponse.body.data.status).toBe('in_progress');

      // Step 4: Complete the task
      const completionResponse = await request(app)
        .patch(`/api/tasks/${createdTask._id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'completed' })
        .expect(200);

      expect(completionResponse.body.data.status).toBe('completed');

      // Step 5: Verify task completion notifications
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait for async operations

      const completionNotifications = await Notification.find({
        recipient: testManager._id,
        type: 'task_completed',
        'data.taskId': createdTask._id,
      });

      expect(completionNotifications.length).toBeGreaterThan(0);
      expect(completionNotifications[0].title).toContain('Task Completed');
    });

    test('should handle overdue task escalation workflow', async () => {
      // Create an overdue task
      const overdueTaskData = {
        title: 'Overdue Test Task',
        description: 'This task is overdue for testing',
        priority: 'critical',
        assignedTo: testUser._id,
        project: 'Overdue Test Project',
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        scheduledDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      };

      const createResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(overdueTaskData)
        .expect(201);

      const overdueTask = createResponse.body.data;

      // Manually trigger overdue check
      await workflowEngine.checkOverdueTasks();

      // Wait for notifications to be processed
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify overdue notification was sent to assigned user
      const overdueNotifications = await Notification.find({
        recipient: testUser._id,
        type: 'task_overdue',
        'data.taskId': overdueTask._id,
      });

      expect(overdueNotifications.length).toBeGreaterThan(0);
      expect(overdueNotifications[0].title).toContain('Task Overdue');

      // Trigger escalation check
      await workflowEngine.checkTaskEscalation();

      // Wait for escalation notifications
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify escalation notifications were sent to managers
      const escalationNotifications = await Notification.find({
        recipient: testManager._id,
        type: 'task_escalated',
        'data.taskId': overdueTask._id,
      });

      expect(escalationNotifications.length).toBeGreaterThan(0);
      expect(escalationNotifications[0].title).toContain('ESCALATION');
    });

    test('should handle project completion workflow', async () => {
      const projectName = 'Multi-Task Project';

      // Create multiple tasks for the same project
      const task1Data = {
        title: 'Project Task 1',
        description: 'First task in project',
        priority: 'medium',
        assignedTo: testUser._id,
        project: projectName,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        scheduledDate: new Date(),
      };

      const task2Data = {
        title: 'Project Task 2',
        description: 'Second task in project',
        priority: 'medium',
        assignedTo: testUser._id,
        project: projectName,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        scheduledDate: new Date(),
      };

      // Create both tasks
      const task1Response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(task1Data)
        .expect(201);

      const task2Response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(task2Data)
        .expect(201);

      const task1 = task1Response.body.data;
      const task2 = task2Response.body.data;

      // Complete first task
      await request(app)
        .patch(`/api/tasks/${task1._id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'completed' })
        .expect(200);

      // Wait and check - should not have workflow completion notification yet
      await new Promise(resolve => setTimeout(resolve, 200));

      let workflowCompletionNotifications = await Notification.find({
        type: 'workflow_completed',
        'data.projectName': projectName,
      });

      expect(workflowCompletionNotifications).toHaveLength(0);

      // Complete second task
      await request(app)
        .patch(`/api/tasks/${task2._id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'completed' })
        .expect(200);

      // Wait for workflow completion check
      await new Promise(resolve => setTimeout(resolve, 200));

      // Now should have workflow completion notifications
      workflowCompletionNotifications = await Notification.find({
        type: 'workflow_completed',
        'data.projectName': projectName,
      });

      expect(workflowCompletionNotifications.length).toBeGreaterThan(0);
      expect(workflowCompletionNotifications[0].title).toContain('Project Completed');
      expect(workflowCompletionNotifications[0].data.totalTasks).toBe(2);
    });
  });

  describe('Real-time Socket Integration', () => {
    test('should broadcast task updates through sockets', (done) => {
      // Connect socket client
      clientSocket = new Client(`http://localhost:${port}`);

      clientSocket.on('connect', async () => {
        // Authenticate socket
        clientSocket.emit('authenticate', { token: authToken });

        clientSocket.on('authenticated', async () => {
          // Join task room
          clientSocket.emit('join_task', 'test-task-id');

          // Listen for task updates
          clientSocket.on('task_updated', (data) => {
            expect(data.taskId).toBe('test-task-id');
            expect(data.updatedBy).toBe(testUser._id.toString());
            expect(data.changes).toEqual({ title: 'Updated Title' });
            done();
          });

          // Emit task update
          clientSocket.emit('task_update', {
            taskId: 'test-task-id',
            changes: { title: 'Updated Title' },
          });
        });
      });
    });

    test('should handle workflow execution socket events', (done) => {
      clientSocket = new Client(`http://localhost:${port}`);

      clientSocket.on('connect', async () => {
        clientSocket.emit('authenticate', { token: authToken });

        clientSocket.on('authenticated', async () => {
          // Listen for workflow progress updates
          clientSocket.on('workflow_progress', (data) => {
            expect(data.executionId).toBe('test-execution-id');
            expect(data.progress).toEqual({ percentage: 75 });
            done();
          });

          // Simulate workflow progress broadcast
          // This would normally come from the workflow executor
          clientSocket.emit('join', 'workflow_execution_test-execution-id');
          
          // Simulate server broadcasting progress
          setTimeout(() => {
            io.to('workflow_execution_test-execution-id').emit('workflow_progress', {
              executionId: 'test-execution-id',
              progress: { percentage: 75 },
              timestamp: new Date(),
            });
          }, 100);
        });
      });
    });
  });

  describe('Workflow Template Execution', () => {
    test('should execute workflow template and track progress', async () => {
      // Create a workflow template
      const templateData = {
        name: 'Test Workflow Template',
        description: 'Template for integration testing',
        category: 'general',
        nodes: [
          {
            id: 'start',
            type: 'start',
            position: { x: 0, y: 0 },
            config: {},
          },
          {
            id: 'task1',
            type: 'task',
            position: { x: 100, y: 0 },
            config: {
              title: 'Workflow Generated Task',
              description: 'Task created by workflow execution',
              priority: 'medium',
              project: 'Workflow Project',
            },
          },
          {
            id: 'end',
            type: 'end',
            position: { x: 200, y: 0 },
            config: {},
          },
        ],
        connections: [
          { source: 'start', target: 'task1' },
          { source: 'task1', target: 'end' },
        ],
        isPublic: false,
      };

      const templateResponse = await request(app)
        .post('/api/workflows/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(templateData)
        .expect(201);

      const template = templateResponse.body.data;

      // Execute the workflow template
      const executionData = {
        variables: {
          projectName: 'Integration Test Project',
          assignedTo: testUser._id,
        },
        context: {
          executedBy: testUser._id,
        },
        name: 'Integration Test Execution',
      };

      const executionResponse = await request(app)
        .post(`/api/workflows/templates/${template._id}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(executionData)
        .expect(201);

      const execution = executionResponse.body.data;

      expect(execution.status).toBe('pending');
      expect(execution.triggeredBy._id).toBe(testUser._id.toString());
      expect(execution.workflowTemplateId._id).toBe(template._id);

      // Wait for execution to process
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check execution status
      const updatedExecution = await WorkflowExecution.findById(execution._id);
      expect(updatedExecution).toBeTruthy();
      expect(updatedExecution.steps).toHaveLength(3); // start, task, end
    });

    test('should retrieve workflow executions with proper filtering', async () => {
      // Get workflow executions
      const executionsResponse = await request(app)
        .get('/api/workflows/executions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, page: 1 })
        .expect(200);

      expect(executionsResponse.body.success).toBe(true);
      expect(executionsResponse.body.data.executions).toBeDefined();
      expect(executionsResponse.body.data.pagination).toBeDefined();
      expect(executionsResponse.body.data.pagination.page).toBe(1);
      expect(executionsResponse.body.data.pagination.limit).toBe(10);
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle multiple concurrent task operations', async () => {
      const concurrentTasks = 10;
      const taskPromises = [];

      // Create multiple tasks concurrently
      for (let i = 0; i < concurrentTasks; i++) {
        const taskData = {
          title: `Concurrent Task ${i}`,
          description: `Task ${i} for load testing`,
          priority: 'medium',
          assignedTo: testUser._id,
          project: 'Load Test Project',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          scheduledDate: new Date(),
        };

        taskPromises.push(
          request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${managerToken}`)
            .send(taskData)
        );
      }

      const responses = await Promise.all(taskPromises);

      // Verify all tasks were created successfully
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.data.title).toBe(`Concurrent Task ${index}`);
      });

      // Wait for all notifications to be processed
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify notifications were created for all tasks
      const notifications = await Notification.find({
        recipient: testUser._id,
        type: 'task_assigned',
      });

      expect(notifications.length).toBeGreaterThanOrEqual(concurrentTasks);
    });

    test('should handle workflow rule execution under load', async () => {
      const startTime = Date.now();

      // Trigger overdue check multiple times
      const checkPromises = [];
      for (let i = 0; i < 5; i++) {
        checkPromises.push(workflowEngine.checkOverdueTasks());
      }

      await Promise.all(checkPromises);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete within reasonable time (less than 5 seconds)
      expect(executionTime).toBeLessThan(5000);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle task creation with invalid data gracefully', async () => {
      const invalidTaskData = {
        title: '', // Invalid: empty title
        description: 'Valid description',
        priority: 'invalid_priority', // Invalid priority
        assignedTo: 'invalid_user_id', // Invalid user ID
        project: 'Test Project',
        dueDate: 'invalid_date', // Invalid date format
        scheduledDate: new Date(),
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(invalidTaskData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    test('should handle workflow engine errors gracefully', async () => {
      // Create a task that might cause workflow engine issues
      const taskData = {
        title: 'Error Test Task',
        description: 'Task to test error handling',
        priority: 'medium',
        assignedTo: testUser._id,
        project: 'Error Test Project',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        scheduledDate: new Date(),
      };

      // Temporarily break the workflow engine by adding a faulty rule
      const faultyRule = {
        trigger: 'event',
        condition: async () => {
          throw new Error('Simulated workflow engine error');
        },
        action: async () => {},
      };

      workflowEngine.addRule('faulty_test_rule', faultyRule);

      // Task creation should still succeed even if workflow engine fails
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(taskData.title);

      // Clean up the faulty rule
      workflowEngine.rules.delete('faulty_test_rule');
    });
  });

  describe('Data Consistency', () => {
    test('should maintain data consistency across task lifecycle', async () => {
      // Create task
      const taskData = {
        title: 'Consistency Test Task',
        description: 'Task to test data consistency',
        priority: 'high',
        assignedTo: testUser._id,
        project: 'Consistency Test Project',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        scheduledDate: new Date(),
      };

      const createResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(taskData)
        .expect(201);

      const task = createResponse.body.data;

      // Update task
      const updateData = {
        title: 'Updated Consistency Test Task',
        priority: 'critical',
      };

      const updateResponse = await request(app)
        .put(`/api/tasks/${task._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.data.title).toBe(updateData.title);
      expect(updateResponse.body.data.priority).toBe(updateData.priority);

      // Verify task in database
      const dbTask = await Task.findById(task._id);
      expect(dbTask.title).toBe(updateData.title);
      expect(dbTask.priority).toBe(updateData.priority);
      expect(dbTask.assignedTo.toString()).toBe(testUser._id.toString());

      // Complete task
      await request(app)
        .patch(`/api/tasks/${task._id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'completed' })
        .expect(200);

      // Verify completion in database
      const completedTask = await Task.findById(task._id);
      expect(completedTask.status).toBe('completed');
      expect(completedTask.completedAt).toBeDefined();
    });
  });
});