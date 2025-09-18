const { Server } = require('socket.io');
const Client = require('socket.io-client');
const TaskSocketHandler = require('../sockets/taskSocket');
const notificationService = require('../services/notificationService');
const { verifyToken } = require('../config/jwt');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Mock dependencies
jest.mock('../config/jwt');
jest.mock('../models/User');
jest.mock('../models/Notification');
jest.mock('../services/notificationService');
jest.mock('../services/prometheusService', () => ({
  getPrometheusService: () => ({
    updateSocketMetrics: jest.fn(),
    recordNotificationDelivery: jest.fn(),
  }),
}));

describe('Notification Socket Integration Tests', () => {
  let io, serverSocket, clientSocket, taskSocketHandler;
  const port = 3004;

  beforeAll((done) => {
    // Create Socket.IO server
    io = new Server(port);
    taskSocketHandler = new TaskSocketHandler(io);
    
    // Initialize notification service with socket handler
    notificationService.initialize(taskSocketHandler);
    
    // Start server
    io.listen(port);
    done();
  });

  afterAll(() => {
    io.close();
    if (taskSocketHandler) {
      taskSocketHandler.destroy();
    }
  });

  beforeEach((done) => {
    // Create client socket
    clientSocket = new Client(`http://localhost:${port}`);
    
    // Wait for connection
    io.on('connection', (socket) => {
      serverSocket = socket;
    });
    
    clientSocket.on('connect', done);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Notification Broadcasting', () => {
    beforeEach(async () => {
      // Authenticate the socket
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      const mockDecoded = { userId: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      return new Promise((resolve) => {
        clientSocket.on('authenticated', () => resolve());
        clientSocket.emit('authenticate', { token: 'valid-token' });
      });
    });

    test('should broadcast notification to connected user', (done) => {
      const testNotification = {
        _id: 'notif123',
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: 'You have been assigned a new task',
        data: { taskId: 'task123' },
        priority: 'medium',
        createdAt: new Date(),
      };

      clientSocket.on('notification', (data) => {
        expect(data._id).toBe('notif123');
        expect(data.type).toBe('task_assigned');
        expect(data.title).toBe('New Task Assigned');
        expect(data.message).toBe('You have been assigned a new task');
        expect(data.data.taskId).toBe('task123');
        expect(data.priority).toBe('medium');
        done();
      });

      // Broadcast notification using the socket handler
      const result = taskSocketHandler.broadcastNotificationToUser('user123', testNotification);
      expect(result).toBe(true);
    });

    test('should handle notification broadcasting to offline user', () => {
      const testNotification = {
        type: 'task_completed',
        title: 'Task Completed',
        message: 'Your task has been completed',
      };

      // Try to broadcast to non-connected user
      const result = taskSocketHandler.broadcastNotificationToUser('offline_user', testNotification);
      expect(result).toBe(false);
    });

    test('should broadcast system announcements to all connected users', (done) => {
      const announcement = {
        type: 'system_announcement',
        title: 'System Maintenance',
        message: 'System will be down for maintenance',
        priority: 'urgent',
      };

      clientSocket.on('system_announcement', (data) => {
        expect(data.type).toBe('system_announcement');
        expect(data.title).toBe('System Maintenance');
        expect(data.priority).toBe('urgent');
        done();
      });

      taskSocketHandler.broadcastSystemAnnouncement(announcement);
    });

    test('should broadcast unread count updates', (done) => {
      const unreadData = {
        userId: 'user123',
        unreadCount: 5,
        lastNotificationAt: new Date(),
      };

      clientSocket.on('unread_count_updated', (data) => {
        expect(data.userId).toBe('user123');
        expect(data.unreadCount).toBe(5);
        expect(data.lastNotificationAt).toBeDefined();
        done();
      });

      taskSocketHandler.broadcastUnreadCountUpdate('user123', unreadData);
    });
  });

  describe('Notification Read Acknowledgments', () => {
    beforeEach(async () => {
      // Authenticate the socket
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      const mockDecoded = { userId: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      return new Promise((resolve) => {
        clientSocket.on('authenticated', () => resolve());
        clientSocket.emit('authenticate', { token: 'valid-token' });
      });
    });

    test('should handle notification read acknowledgments', (done) => {
      const notificationIds = ['notif1', 'notif2', 'notif3'];

      notificationService.markAsRead.mockResolvedValue({
        success: true,
        markedCount: 3,
        newUnreadCount: 2,
      });

      clientSocket.on('notifications_marked_read', (data) => {
        expect(data.notificationIds).toEqual(notificationIds);
        expect(data.markedCount).toBe(3);
        expect(data.newUnreadCount).toBe(2);
        done();
      });

      clientSocket.emit('notification_read', notificationIds);
    });

    test('should handle invalid notification read requests', (done) => {
      clientSocket.on('error', (error) => {
        expect(error.message).toContain('Invalid notification IDs');
        done();
      });

      // Send invalid data
      clientSocket.emit('notification_read', 'invalid_data');
    });

    test('should handle notification read errors', (done) => {
      notificationService.markAsRead.mockResolvedValue({
        success: false,
        error: 'Database error',
      });

      clientSocket.on('error', (error) => {
        expect(error.message).toContain('Failed to mark notifications as read');
        done();
      });

      clientSocket.emit('notification_read', ['notif1']);
    });
  });

  describe('Notification Room Management', () => {
    beforeEach(async () => {
      // Authenticate the socket
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      const mockDecoded = { userId: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      return new Promise((resolve) => {
        clientSocket.on('authenticated', () => resolve());
        clientSocket.emit('authenticate', { token: 'valid-token' });
      });
    });

    test('should join user to notification room on authentication', () => {
      // User should be automatically joined to their notification room
      const userRooms = Array.from(serverSocket.rooms);
      expect(userRooms).toContain('notifications_user123');
    });

    test('should handle notification room events', (done) => {
      const roomNotification = {
        type: 'room_notification',
        title: 'Room Test',
        message: 'Testing room-based notifications',
      };

      clientSocket.on('room_notification', (data) => {
        expect(data.type).toBe('room_notification');
        expect(data.title).toBe('Room Test');
        done();
      });

      // Broadcast to notification room
      io.to('notifications_user123').emit('room_notification', roomNotification);
    });

    test('should leave notification room on disconnect', (done) => {
      const initialRooms = Array.from(serverSocket.rooms);
      expect(initialRooms).toContain('notifications_user123');

      serverSocket.on('disconnect', () => {
        // Room should be cleaned up on disconnect
        const finalRooms = Array.from(serverSocket.rooms);
        expect(finalRooms).not.toContain('notifications_user123');
        done();
      });

      clientSocket.disconnect();
    });
  });

  describe('Real-time Notification Delivery', () => {
    beforeEach(async () => {
      // Authenticate the socket
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      const mockDecoded = { userId: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      return new Promise((resolve) => {
        clientSocket.on('authenticated', () => resolve());
        clientSocket.emit('authenticate', { token: 'valid-token' });
      });
    });

    test('should deliver notifications in real-time', (done) => {
      const notification = {
        _id: 'realtime_notif',
        type: 'urgent_alert',
        title: 'Urgent Alert',
        message: 'This is an urgent notification',
        priority: 'urgent',
        timestamp: new Date(),
      };

      clientSocket.on('notification', (data) => {
        expect(data._id).toBe('realtime_notif');
        expect(data.type).toBe('urgent_alert');
        expect(data.priority).toBe('urgent');
        
        // Should receive notification within reasonable time
        const deliveryTime = new Date() - new Date(notification.timestamp);
        expect(deliveryTime).toBeLessThan(100); // Less than 100ms
        done();
      });

      // Simulate real-time notification delivery
      taskSocketHandler.broadcastNotificationToUser('user123', notification);
    });

    test('should handle notification delivery confirmation', (done) => {
      const notification = {
        _id: 'confirm_notif',
        type: 'delivery_test',
        title: 'Delivery Test',
        message: 'Testing delivery confirmation',
      };

      clientSocket.on('notification', (data) => {
        // Send delivery confirmation
        clientSocket.emit('notification_delivered', {
          notificationId: data._id,
          deliveredAt: new Date(),
        });
      });

      // Listen for delivery confirmation on server side
      serverSocket.on('notification_delivered', (data) => {
        expect(data.notificationId).toBe('confirm_notif');
        expect(data.deliveredAt).toBeDefined();
        done();
      });

      taskSocketHandler.broadcastNotificationToUser('user123', notification);
    });

    test('should queue notifications for offline users', () => {
      const notification = {
        type: 'queued_notification',
        title: 'Queued Notification',
        message: 'This should be queued for offline user',
      };

      // Try to send to offline user
      const result = taskSocketHandler.broadcastNotificationToUser('offline_user', notification);
      expect(result).toBe(false);

      // Notification should be queued (handled by notification service)
      // This would typically be stored in database for later delivery
    });
  });

  describe('Notification Preferences and Filtering', () => {
    beforeEach(async () => {
      // Authenticate the socket with specific preferences
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
        notificationPreferences: {
          inApp: { enabled: true },
          realTime: { enabled: true, types: ['urgent_alert', 'task_assigned'] },
        },
      };

      const mockDecoded = { userId: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      return new Promise((resolve) => {
        clientSocket.on('authenticated', () => resolve());
        clientSocket.emit('authenticate', { token: 'valid-token' });
      });
    });

    test('should respect user real-time notification preferences', (done) => {
      let notificationCount = 0;

      clientSocket.on('notification', (data) => {
        notificationCount++;
        
        // Should only receive allowed notification types
        expect(['urgent_alert', 'task_assigned']).toContain(data.type);
        
        if (notificationCount === 2) {
          done();
        }
      });

      // Send allowed notification types
      taskSocketHandler.broadcastNotificationToUser('user123', {
        type: 'urgent_alert',
        title: 'Urgent Alert',
        message: 'This should be delivered',
      });

      taskSocketHandler.broadcastNotificationToUser('user123', {
        type: 'task_assigned',
        title: 'Task Assigned',
        message: 'This should be delivered',
      });

      // Send disallowed notification type
      taskSocketHandler.broadcastNotificationToUser('user123', {
        type: 'low_priority_info',
        title: 'Low Priority',
        message: 'This should be filtered out',
      });
    });

    test('should handle notification preference updates', (done) => {
      const newPreferences = {
        inApp: { enabled: true },
        realTime: { enabled: false },
      };

      clientSocket.on('preferences_updated', (data) => {
        expect(data.preferences.realTime.enabled).toBe(false);
        done();
      });

      clientSocket.emit('update_notification_preferences', newPreferences);
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle socket disconnection gracefully', (done) => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      const mockDecoded = { userId: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      clientSocket.on('authenticated', () => {
        // Simulate network disconnection
        clientSocket.disconnect();
      });

      serverSocket.on('disconnect', (reason) => {
        expect(reason).toBeDefined();
        
        // Socket handler should clean up user tracking
        expect(taskSocketHandler.isUserConnected('user123')).toBe(false);
        done();
      });

      clientSocket.emit('authenticate', { token: 'valid-token' });
    });

    test('should handle notification broadcasting errors', () => {
      // Mock socket emit to throw error
      const originalEmit = serverSocket.emit;
      serverSocket.emit = jest.fn().mockImplementation(() => {
        throw new Error('Socket emit failed');
      });

      const notification = {
        type: 'error_test',
        title: 'Error Test',
        message: 'Testing error handling',
      };

      // Should not throw error
      expect(() => {
        taskSocketHandler.broadcastNotificationToUser('user123', notification);
      }).not.toThrow();

      // Restore original emit
      serverSocket.emit = originalEmit;
    });

    test('should handle malformed notification data', () => {
      const malformedNotification = {
        // Missing required fields
        invalidField: 'invalid',
      };

      // Should handle gracefully without crashing
      expect(() => {
        taskSocketHandler.broadcastNotificationToUser('user123', malformedNotification);
      }).not.toThrow();
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle multiple concurrent notification broadcasts', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      const mockDecoded = { userId: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      await new Promise((resolve) => {
        clientSocket.on('authenticated', () => resolve());
        clientSocket.emit('authenticate', { token: 'valid-token' });
      });

      const startTime = Date.now();
      const notificationCount = 100;
      let receivedCount = 0;

      clientSocket.on('notification', () => {
        receivedCount++;
        if (receivedCount === notificationCount) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Should handle 100 notifications within reasonable time
          expect(duration).toBeLessThan(1000); // Less than 1 second
          expect(receivedCount).toBe(notificationCount);
        }
      });

      // Send multiple notifications concurrently
      for (let i = 0; i < notificationCount; i++) {
        taskSocketHandler.broadcastNotificationToUser('user123', {
          _id: `notif_${i}`,
          type: 'load_test',
          title: `Load Test ${i}`,
          message: `Load testing notification ${i}`,
        });
      }
    });

    test('should maintain performance with multiple connected users', async () => {
      const userCount = 10;
      const clients = [];
      const connectedUsers = [];

      // Create multiple client connections
      for (let i = 0; i < userCount; i++) {
        const client = new Client(`http://localhost:${port}`);
        clients.push(client);

        const mockUser = {
          _id: `user${i}`,
          email: `user${i}@example.com`,
          role: 'user',
          isActive: true,
          isEmailVerified: true,
          permissions: [],
        };

        const mockDecoded = { userId: `user${i}`, exp: Math.floor(Date.now() / 1000) + 3600 };

        verifyToken.mockResolvedValue(mockDecoded);
        User.findById.mockResolvedValue(mockUser);
        notificationService.getNotificationsForUser.mockResolvedValue({
          notifications: [],
          unreadCount: 0,
        });

        await new Promise((resolve) => {
          client.on('authenticated', () => {
            connectedUsers.push(`user${i}`);
            resolve();
          });
          client.emit('authenticate', { token: `token${i}` });
        });
      }

      expect(connectedUsers).toHaveLength(userCount);

      // Broadcast system announcement to all users
      const startTime = Date.now();
      taskSocketHandler.broadcastSystemAnnouncement({
        type: 'system_announcement',
        title: 'Performance Test',
        message: 'Testing performance with multiple users',
      });
      const endTime = Date.now();

      // Should broadcast to all users quickly
      expect(endTime - startTime).toBeLessThan(100);

      // Clean up clients
      clients.forEach(client => client.disconnect());
    });
  });
});