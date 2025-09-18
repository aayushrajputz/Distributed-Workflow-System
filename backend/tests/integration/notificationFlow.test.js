const request = require('supertest');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const app = require('../../app');
const Task = require('../../models/Task');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const notificationService = require('../../services/notificationService');
const emailService = require('../../services/emailService');
const pushService = require('../../services/pushService');
const slackService = require('../../services/slackService');
const { generateToken } = require('../../config/jwt');

describe('Notification Flow Integration Tests', () => {
  let server, io, clientSocket, testUser, testManager, authToken, managerToken;
  const port = 3003;

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
      notificationPreferences: {
        inApp: { enabled: true },
        email: { enabled: true },
        push: { enabled: true },
        slack: { enabled: false },
      },
      pushTokens: [
        {
          token: 'test_push_token_' + 'x'.repeat(50),
          platform: 'web',
          registeredAt: new Date(),
        },
      ],
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
      notificationPreferences: {
        inApp: { enabled: true },
        email: { enabled: true },
        push: { enabled: false },
        slack: { enabled: true, webhookUrl: 'https://hooks.slack.com/test' },
      },
    });

    // Generate auth tokens
    authToken = generateToken(testUser._id);
    managerToken = generateToken(testManager._id);

    // Setup Socket.IO server for testing
    io = new Server(port);
    server = io.listen(port);

    // Initialize notification service with socket
    notificationService.initialize(io);
  });

  afterAll(async () => {
    // Clean up
    await User.deleteMany({});
    await Task.deleteMany({});
    await Notification.deleteMany({});
    
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

  describe('Task Assignment Notification Flow', () => {
    test('should send notifications through all channels when task is assigned', async () => {
      // Mock external services
      const emailSpy = jest.spyOn(emailService, 'sendNotificationEmail')
        .mockResolvedValue({ success: true });
      const pushSpy = jest.spyOn(pushService, 'sendToUser')
        .mockResolvedValue({ success: true });

      // Create a task (which should trigger assignment notification)
      const taskData = {
        title: 'Integration Test Task',
        description: 'Task for testing notification flow',
        priority: 'high',
        assignedTo: testUser._id,
        project: 'Integration Test Project',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        scheduledDate: new Date(),
      };

      const createResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(taskData)
        .expect(201);

      const createdTask = createResponse.body.data;

      // Wait for async notification processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify notification was created in database
      const notifications = await Notification.find({
        recipient: testUser._id,
        type: 'task_assigned',
        'data.taskId': createdTask._id,
      });

      expect(notifications).toHaveLength(1);
      const notification = notifications[0];
      expect(notification.title).toContain('New Task Assigned');
      expect(notification.channels.inApp.sent).toBe(true);

      // Verify email service was called
      expect(emailSpy).toHaveBeenCalledWith(
        testUser.email,
        expect.stringContaining('New Task Assigned'),
        expect.any(String),
        expect.objectContaining({
          taskId: createdTask._id,
        })
      );

      // Verify push service was called
      expect(pushSpy).toHaveBeenCalledWith(
        testUser._id.toString(),
        expect.objectContaining({
          title: expect.stringContaining('New Task Assigned'),
          type: 'task_assigned',
          priority: 'high',
        })
      );

      // Clean up mocks
      emailSpy.mockRestore();
      pushSpy.mockRestore();
    });

    test('should send real-time WebSocket notification for task assignment', (done) => {
      // Connect socket client
      clientSocket = new Client(`http://localhost:${port}`);

      clientSocket.on('connect', async () => {
        // Authenticate socket
        clientSocket.emit('authenticate', { token: authToken });

        clientSocket.on('authenticated', async () => {
          // Listen for notification
          clientSocket.on('notification', (data) => {
            expect(data.type).toBe('task_assigned');
            expect(data.title).toContain('New Task Assigned');
            expect(data.data.taskId).toBeDefined();
            done();
          });

          // Create task to trigger notification
          await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({
              title: 'WebSocket Test Task',
              description: 'Task for WebSocket notification test',
              priority: 'medium',
              assignedTo: testUser._id,
              project: 'WebSocket Test',
              dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
              scheduledDate: new Date(),
            });
        });
      });
    });
  });

  describe('Task Status Change Notification Flow', () => {
    test('should notify manager when task is completed', async () => {
      // Mock Slack service
      const slackSpy = jest.spyOn(slackService, 'sendSlackNotification')
        .mockResolvedValue({ success: true });

      // Create a task first
      const task = await Task.create({
        title: 'Completion Test Task',
        description: 'Task for completion notification test',
        priority: 'medium',
        assignedTo: testUser._id,
        assignedBy: testManager._id,
        project: 'Completion Test',
        status: 'in_progress',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scheduledDate: new Date(),
      });

      // Complete the task
      await request(app)
        .patch(`/api/tasks/${task._id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'completed' })
        .expect(200);

      // Wait for async notification processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify completion notification was sent to manager
      const managerNotifications = await Notification.find({
        recipient: testManager._id,
        type: 'task_completed',
        'data.taskId': task._id,
      });

      expect(managerNotifications).toHaveLength(1);
      const notification = managerNotifications[0];
      expect(notification.title).toContain('Task Completed');
      expect(notification.message).toContain(testUser.firstName);

      // Verify Slack notification was sent (manager has Slack enabled)
      expect(slackSpy).toHaveBeenCalledWith(
        testManager.notificationPreferences.slack.webhookUrl,
        expect.objectContaining({
          title: expect.stringContaining('Task Completed'),
          type: 'task_completed',
        })
      );

      slackSpy.mockRestore();
    });

    test('should send real-time status change notifications', (done) => {
      let taskId;
      
      clientSocket = new Client(`http://localhost:${port}`);

      clientSocket.on('connect', async () => {
        clientSocket.emit('authenticate', { token: managerToken });

        clientSocket.on('authenticated', async () => {
          // Listen for task status change notification
          clientSocket.on('notification', (data) => {
            if (data.type === 'task_completed' && data.data.taskId === taskId) {
              expect(data.title).toContain('Task Completed');
              expect(data.data.completedAt).toBeDefined();
              done();
            }
          });

          // Create and complete a task
          const createResponse = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({
              title: 'Status Change Test Task',
              description: 'Task for status change notification test',
              priority: 'low',
              assignedTo: testUser._id,
              project: 'Status Change Test',
              dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
              scheduledDate: new Date(),
            });

          taskId = createResponse.body.data._id;

          // Complete the task
          setTimeout(async () => {
            await request(app)
              .patch(`/api/tasks/${taskId}/status`)
              .set('Authorization', `Bearer ${authToken}`)
              .send({ status: 'completed' });
          }, 100);
        });
      });
    });
  });

  describe('System Announcement Notifications', () => {
    test('should broadcast system announcements to all users', async () => {
      const announcementData = {
        title: 'System Maintenance Notice',
        message: 'The system will be down for maintenance on Sunday at 2 AM.',
        type: 'system_announcement',
        priority: 'high',
      };

      // Send bulk notification to all users
      const recipients = [testUser._id.toString(), testManager._id.toString()];
      const result = await notificationService.sendBulkNotifications(recipients, announcementData);

      expect(result.success).toBe(true);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);

      // Verify notifications were created for both users
      const notifications = await Notification.find({
        type: 'system_announcement',
        title: 'System Maintenance Notice',
      });

      expect(notifications).toHaveLength(2);
      
      const userNotification = notifications.find(n => n.recipient.toString() === testUser._id.toString());
      const managerNotification = notifications.find(n => n.recipient.toString() === testManager._id.toString());

      expect(userNotification).toBeDefined();
      expect(managerNotification).toBeDefined();
    });

    test('should handle system announcements via API endpoint', async () => {
      const announcementData = {
        title: 'API System Announcement',
        message: 'This is a system announcement sent via API.',
        type: 'system_announcement',
        priority: 'medium',
        recipients: 'all', // Send to all users
      };

      const response = await request(app)
        .post('/api/notifications/broadcast')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(announcementData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sent).toBeGreaterThan(0);

      // Verify notifications were created
      const notifications = await Notification.find({
        type: 'system_announcement',
        title: 'API System Announcement',
      });

      expect(notifications.length).toBeGreaterThan(0);
    });
  });

  describe('Notification Read Status and Unread Count', () => {
    test('should update unread count when notifications are marked as read', async () => {
      // Create multiple notifications for user
      const notifications = await Promise.all([
        notificationService.sendNotification({
          recipient: testUser._id,
          title: 'Test Notification 1',
          message: 'First test notification',
          type: 'test',
        }),
        notificationService.sendNotification({
          recipient: testUser._id,
          title: 'Test Notification 2',
          message: 'Second test notification',
          type: 'test',
        }),
        notificationService.sendNotification({
          recipient: testUser._id,
          title: 'Test Notification 3',
          message: 'Third test notification',
          type: 'test',
        }),
      ]);

      // Wait for notifications to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get initial unread count
      let unreadCount = await notificationService.getUnreadCount(testUser._id);
      expect(unreadCount).toBe(3);

      // Mark some notifications as read
      const notificationIds = [
        notifications[0].notificationId,
        notifications[1].notificationId,
      ];

      const markReadResult = await notificationService.markAsRead(testUser._id, notificationIds);
      expect(markReadResult.success).toBe(true);
      expect(markReadResult.markedCount).toBe(2);

      // Verify unread count decreased
      unreadCount = await notificationService.getUnreadCount(testUser._id);
      expect(unreadCount).toBe(1);
    });

    test('should sync unread count via WebSocket', (done) => {
      clientSocket = new Client(`http://localhost:${port}`);

      clientSocket.on('connect', async () => {
        clientSocket.emit('authenticate', { token: authToken });

        clientSocket.on('authenticated', async () => {
          // Listen for unread count updates
          clientSocket.on('unread_count_updated', (data) => {
            expect(data.userId).toBe(testUser._id.toString());
            expect(typeof data.unreadCount).toBe('number');
            expect(data.unreadCount).toBeGreaterThan(0);
            done();
          });

          // Send a notification to trigger unread count update
          await notificationService.sendNotification({
            recipient: testUser._id,
            title: 'Unread Count Test',
            message: 'This should update unread count',
            type: 'test',
          });
        });
      });
    });
  });

  describe('Notification Preferences Integration', () => {
    test('should respect user notification preferences', async () => {
      // Update user preferences to disable email
      await User.findByIdAndUpdate(testUser._id, {
        'notificationPreferences.email.enabled': false,
      });

      const emailSpy = jest.spyOn(emailService, 'sendNotificationEmail')
        .mockResolvedValue({ success: true });
      const pushSpy = jest.spyOn(pushService, 'sendToUser')
        .mockResolvedValue({ success: true });

      // Send notification
      const result = await notificationService.sendNotification({
        recipient: testUser._id,
        title: 'Preference Test Notification',
        message: 'Testing user preferences',
        type: 'test',
      });

      expect(result.success).toBe(true);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Email should not be sent (disabled)
      expect(emailSpy).not.toHaveBeenCalled();
      
      // Push should be sent (enabled)
      expect(pushSpy).toHaveBeenCalled();

      // Restore user preferences
      await User.findByIdAndUpdate(testUser._id, {
        'notificationPreferences.email.enabled': true,
      });

      emailSpy.mockRestore();
      pushSpy.mockRestore();
    });

    test('should handle notification preferences via API', async () => {
      const newPreferences = {
        inApp: { enabled: true },
        email: { enabled: false },
        push: { enabled: true },
        slack: { enabled: false },
      };

      const response = await request(app)
        .put('/api/users/preferences/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notificationPreferences: newPreferences })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify preferences were updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.notificationPreferences.email.enabled).toBe(false);
      expect(updatedUser.notificationPreferences.push.enabled).toBe(true);
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle notification service failures gracefully', async () => {
      // Mock email service to fail
      const emailSpy = jest.spyOn(emailService, 'sendNotificationEmail')
        .mockResolvedValue({ success: false, error: 'SMTP server unavailable' });

      // Send notification
      const result = await notificationService.sendNotification({
        recipient: testUser._id,
        title: 'Error Handling Test',
        message: 'Testing error handling',
        type: 'test',
      });

      // Notification should still succeed overall (other channels work)
      expect(result.success).toBe(true);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify notification was created despite email failure
      const notification = await Notification.findOne({
        recipient: testUser._id,
        title: 'Error Handling Test',
      });

      expect(notification).toBeDefined();
      expect(notification.channels.email.sent).toBe(false);
      expect(notification.channels.email.error).toBeDefined();

      emailSpy.mockRestore();
    });

    test('should handle database connection issues', async () => {
      // Mock Notification.create to fail
      const createSpy = jest.spyOn(Notification, 'create')
        .mockRejectedValue(new Error('Database connection failed'));

      const result = await notificationService.sendNotification({
        recipient: testUser._id,
        title: 'Database Error Test',
        message: 'Testing database error handling',
        type: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');

      createSpy.mockRestore();
    });
  });

  describe('Performance Under Load', () => {
    test('should handle concurrent notification requests', async () => {
      const concurrentRequests = 20;
      const promises = [];

      const startTime = Date.now();

      // Send multiple concurrent notifications
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          notificationService.sendNotification({
            recipient: testUser._id,
            title: `Concurrent Notification ${i}`,
            message: `Message ${i}`,
            type: 'test',
          })
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // All notifications should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete within reasonable time (less than 3 seconds)
      expect(endTime - startTime).toBeLessThan(3000);

      // Verify all notifications were created
      const notifications = await Notification.find({
        recipient: testUser._id,
        title: { $regex: /^Concurrent Notification/ },
      });

      expect(notifications).toHaveLength(concurrentRequests);
    });

    test('should handle bulk notification operations efficiently', async () => {
      // Create additional test users
      const bulkUsers = [];
      for (let i = 0; i < 10; i++) {
        const user = await User.create({
          firstName: `Bulk${i}`,
          lastName: 'User',
          email: `bulk${i}@example.com`,
          password: 'password123',
          role: 'user',
          isActive: true,
          isEmailVerified: true,
        });
        bulkUsers.push(user._id.toString());
      }

      const startTime = Date.now();

      const result = await notificationService.sendBulkNotifications(bulkUsers, {
        title: 'Bulk Notification Test',
        message: 'This is a bulk notification for performance testing',
        type: 'system_announcement',
      });

      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.sent).toBe(10);
      expect(result.failed).toBe(0);

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(2000);

      // Clean up bulk users
      await User.deleteMany({ _id: { $in: bulkUsers } });
    });
  });
});