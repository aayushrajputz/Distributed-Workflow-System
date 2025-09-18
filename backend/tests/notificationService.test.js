const notificationService = require('../services/notificationService');
const Notification = require('../models/Notification');
const User = require('../models/User');
const emailService = require('../services/emailService');
const pushService = require('../services/pushService');
const slackService = require('../services/slackService');
const notificationCacheService = require('../services/notificationCacheService');

// Mock dependencies
jest.mock('../models/Notification');
jest.mock('../models/User');
jest.mock('../services/emailService');
jest.mock('../services/pushService');
jest.mock('../services/slackService');
jest.mock('../services/notificationCacheService');
jest.mock('../services/prometheusService', () => ({
  getPrometheusService: () => ({
    recordNotificationSent: jest.fn(),
    recordNotificationDelivery: jest.fn(),
  }),
}));

describe('NotificationService', () => {
  let mockUser, mockNotification, mockSocketHandler;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock user
    mockUser = {
      _id: 'user123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      notificationPreferences: {
        inApp: { enabled: true },
        email: { enabled: true },
        push: { enabled: true },
        slack: { enabled: false, webhookUrl: null },
      },
      pushTokens: [
        { token: 'push_token_123', platform: 'web' },
        { token: 'push_token_456', platform: 'mobile' },
      ],
    };

    // Mock notification
    mockNotification = {
      _id: 'notif123',
      recipient: 'user123',
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: 'You have been assigned a new task',
      data: { taskId: 'task123' },
      priority: 'medium',
      channels: {
        inApp: { sent: false, read: false },
        email: { sent: false },
        push: { sent: false },
        websocket: { sent: false },
        slack: { sent: false },
      },
      save: jest.fn().mockResolvedValue(),
    };

    // Mock socket handler
    mockSocketHandler = {
      broadcastNotificationToUser: jest.fn().mockReturnValue(true),
      isUserConnected: jest.fn().mockReturnValue(true),
    };

    // Setup default mocks
    User.findById.mockResolvedValue(mockUser);
    Notification.create.mockResolvedValue(mockNotification);
    notificationCacheService.getUserPreferences.mockResolvedValue(null);
    notificationCacheService.setUserPreferences.mockResolvedValue(true);
    notificationCacheService.incrementUnreadCount.mockResolvedValue(1);
    emailService.sendNotificationEmail.mockResolvedValue({ success: true });
    pushService.sendToUser.mockResolvedValue({ success: true });
    slackService.sendSlackNotification.mockResolvedValue({ success: true });
  });

  describe('Initialization', () => {
    test('should initialize with socket handler', () => {
      notificationService.initialize(mockSocketHandler);
      expect(notificationService.socketHandler).toBe(mockSocketHandler);
    });

    test('should handle missing socket handler gracefully', () => {
      expect(() => {
        notificationService.initialize(null);
      }).not.toThrow();
    });
  });

  describe('Send Notification', () => {
    test('should send notification to all enabled channels', async () => {
      const notificationData = {
        recipient: 'user123',
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: 'You have been assigned a new task',
        data: { taskId: 'task123' },
        priority: 'medium',
      };

      notificationService.initialize(mockSocketHandler);
      const result = await notificationService.sendNotification(notificationData);

      expect(result.success).toBe(true);
      expect(result.notificationId).toBe('notif123');
      expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({
        recipient: 'user123',
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: 'You have been assigned a new task',
      }));
    });

    test('should handle missing recipient gracefully', async () => {
      User.findById.mockResolvedValue(null);

      const result = await notificationService.sendNotification({
        recipient: 'nonexistent',
        title: 'Test',
        message: 'Test message',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Recipient not found');
    });

    test('should validate required fields', async () => {
      const result = await notificationService.sendNotification({
        recipient: 'user123',
        // Missing title and message
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Title and message are required');
    });
  });

  describe('Channel Delivery', () => {
    beforeEach(() => {
      notificationService.initialize(mockSocketHandler);
    });

    test('should send email notification', async () => {
      const result = await notificationService.sendEmailNotification(mockUser, mockNotification);

      expect(result.success).toBe(true);
      expect(emailService.sendNotificationEmail).toHaveBeenCalledWith(
        'john.doe@example.com',
        'New Task Assigned',
        'You have been assigned a new task',
        { taskId: 'task123' }
      );
    });

    test('should send push notification', async () => {
      const result = await notificationService.sendPushNotification(mockUser, mockNotification);

      expect(result.success).toBe(true);
      expect(pushService.sendToUser).toHaveBeenCalledWith('user123', expect.objectContaining({
        title: 'New Task Assigned',
        message: 'You have been assigned a new task',
        type: 'task_assigned',
        priority: 'medium',
      }));
    });

    test('should send WebSocket notification', async () => {
      const result = await notificationService.sendWebSocketNotification(mockUser, mockNotification);

      expect(result.success).toBe(true);
      expect(mockSocketHandler.broadcastNotificationToUser).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          title: 'New Task Assigned',
          message: 'You have been assigned a new task',
          type: 'task_assigned',
        })
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      notificationService.initialize(mockSocketHandler);
    });

    test('should handle email service failure', async () => {
      emailService.sendNotificationEmail.mockResolvedValue({
        success: false,
        error: 'SMTP connection failed',
      });

      const result = await notificationService.sendEmailNotification(mockUser, mockNotification);

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
    });

    test('should continue with other channels when one fails', async () => {
      emailService.sendNotificationEmail.mockResolvedValue({
        success: false,
        error: 'Email failed',
      });

      const result = await notificationService.sendNotification({
        recipient: 'user123',
        title: 'Test',
        message: 'Test message',
      });

      expect(result.success).toBe(true);
      expect(pushService.sendToUser).toHaveBeenCalled();
      expect(mockSocketHandler.broadcastNotificationToUser).toHaveBeenCalled();
    });
  });

  describe('Notification Retrieval', () => {
    test('should get notifications for user', async () => {
      const mockNotifications = [
        { _id: 'notif1', title: 'Notification 1' },
        { _id: 'notif2', title: 'Notification 2' },
      ];

      Notification.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockResolvedValue(mockNotifications),
            }),
          }),
        }),
      });

      Notification.countDocuments.mockResolvedValue(25);

      const result = await notificationService.getNotificationsForUser('user123', {
        page: 1,
        limit: 10,
      });

      expect(result.notifications).toEqual(mockNotifications);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.pages).toBe(3);
    });

    test('should get unread count for user', async () => {
      notificationCacheService.getUnreadCount.mockResolvedValue(5);

      const count = await notificationService.getUnreadCount('user123');

      expect(count).toBe(5);
      expect(notificationCacheService.getUnreadCount).toHaveBeenCalledWith('user123');
    });
  });

  describe('Mark as Read', () => {
    test('should mark notifications as read', async () => {
      const notificationIds = ['notif1', 'notif2'];
      
      Notification.updateMany.mockResolvedValue({ modifiedCount: 2 });
      notificationCacheService.decrementUnreadCount.mockResolvedValue(3);

      const result = await notificationService.markAsRead('user123', notificationIds);

      expect(result.success).toBe(true);
      expect(result.markedCount).toBe(2);
    });
  });

  describe('Service Health', () => {
    test('should return health status', () => {
      const health = notificationService.getHealthStatus();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('channels');
      expect(health).toHaveProperty('metrics');
    });
  });
});