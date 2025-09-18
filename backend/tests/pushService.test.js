const pushService = require('../services/pushService');
const User = require('../models/User');
const admin = require('firebase-admin');

// Mock dependencies
jest.mock('../models/User');
jest.mock('firebase-admin');
jest.mock('../services/prometheusService', () => ({
  getPrometheusService: () => ({
    recordPushNotification: jest.fn(),
  }),
}));

describe('PushService', () => {
  let mockMessaging, mockUser;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock Firebase Admin
    mockMessaging = {
      sendMulticast: jest.fn(),
    };

    admin.initializeApp.mockReturnValue({});
    admin.credential = {
      cert: jest.fn().mockReturnValue({}),
    };
    admin.messaging.mockReturnValue(mockMessaging);

    // Mock user
    mockUser = {
      _id: 'user123',
      pushTokens: [
        {
          token: 'valid_token_123',
          platform: 'web',
          registeredAt: new Date(),
          lastUsed: new Date(),
        },
        {
          token: 'valid_token_456',
          platform: 'mobile',
          registeredAt: new Date(),
          lastUsed: new Date(),
        },
      ],
      save: jest.fn().mockResolvedValue(),
    };

    User.findById.mockResolvedValue(mockUser);
    User.findByIdAndUpdate.mockResolvedValue();
    User.updateMany.mockResolvedValue();

    // Mock environment variables
    process.env.FCM_SERVICE_ACCOUNT_KEY = JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
      private_key_id: 'test-key-id',
      private_key: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----\n',
      client_email: 'test@test-project.iam.gserviceaccount.com',
      client_id: 'test-client-id',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    });
    process.env.FCM_PROJECT_ID = 'test-project';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.FCM_SERVICE_ACCOUNT_KEY;
    delete process.env.FCM_PROJECT_ID;
  });

  describe('Initialization', () => {
    test('should initialize FCM when credentials are provided', () => {
      // Create new instance to test initialization
      const PushServiceClass = require('../services/pushService').constructor;
      const newPushService = new PushServiceClass();

      expect(admin.initializeApp).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'test-project',
        }),
        'push-service'
      );
      expect(newPushService.enabled).toBe(true);
    });

    test('should disable service when credentials are missing', () => {
      delete process.env.FCM_SERVICE_ACCOUNT_KEY;
      delete process.env.FCM_PROJECT_ID;

      const PushServiceClass = require('../services/pushService').constructor;
      const newPushService = new PushServiceClass();

      expect(newPushService.enabled).toBe(false);
    });

    test('should handle invalid service account key format', () => {
      process.env.FCM_SERVICE_ACCOUNT_KEY = 'invalid-json';

      const PushServiceClass = require('../services/pushService').constructor;
      const newPushService = new PushServiceClass();

      expect(newPushService.enabled).toBe(false);
    });
  });

  describe('Send Push Notifications', () => {
    test('should send push notifications successfully', async () => {
      const tokens = ['token1', 'token2'];
      const payload = {
        title: 'Test Notification',
        message: 'Test message',
        type: 'test',
        data: { key: 'value' },
      };

      mockMessaging.sendMulticast.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        responses: [
          { success: true },
          { success: true },
        ],
      });

      const result = await pushService.sendPush(tokens, payload);

      expect(result.success).toBe(true);
      expect(result.totalSent).toBe(2);
      expect(result.totalFailed).toBe(0);
      expect(mockMessaging.sendMulticast).toHaveBeenCalledWith({
        tokens,
        notification: {
          title: 'Test Notification',
          body: 'Test message',
        },
        data: {
          type: 'test',
          timestamp: expect.any(String),
          key: 'value',
        },
      });
    });

    test('should handle empty token array', async () => {
      const result = await pushService.sendPush([], {
        title: 'Test',
        message: 'Test message',
      });

      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
      expect(mockMessaging.sendMulticast).not.toHaveBeenCalled();
    });

    test('should handle service disabled', async () => {
      // Disable the service
      pushService.enabled = false;

      const result = await pushService.sendPush(['token1'], {
        title: 'Test',
        message: 'Test message',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Push service not enabled');
    });

    test('should validate token formats', async () => {
      const tokens = [
        'valid_token_with_more_than_50_characters_abcdefghijklmnopqrstuvwxyz123456789',
        'short', // Invalid: too short
        'invalid-chars!@#$%', // Invalid: special characters
      ];

      mockMessaging.sendMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      const result = await pushService.sendPush(tokens, {
        title: 'Test',
        message: 'Test message',
      });

      expect(result.success).toBe(true);
      expect(mockMessaging.sendMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ['valid_token_with_more_than_50_characters_abcdefghijklmnopqrstuvwxyz123456789'],
        })
      );
    });

    test('should handle FCM errors and clean up invalid tokens', async () => {
      const tokens = ['valid_token', 'invalid_token'];

      mockMessaging.sendMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true },
          {
            success: false,
            error: { code: 'messaging/invalid-registration-token' },
          },
        ],
      });

      const result = await pushService.sendPush(tokens, {
        title: 'Test',
        message: 'Test message',
      });

      expect(result.success).toBe(true);
      expect(result.totalSent).toBe(1);
      expect(result.totalFailed).toBe(1);
      expect(result.invalidTokens).toBe(1);
      expect(User.updateMany).toHaveBeenCalledWith(
        { 'pushTokens.token': { $in: ['invalid_token'] } },
        { $pull: { pushTokens: { token: { $in: ['invalid_token'] } } } }
      );
    });
  });

  describe('Batch Processing', () => {
    test('should process large token arrays in batches', async () => {
      // Create array with more tokens than batch size
      const tokens = Array.from({ length: 1000 }, (_, i) => `token_${i}_${'x'.repeat(50)}`);

      mockMessaging.sendMulticast.mockResolvedValue({
        successCount: 500,
        failureCount: 0,
        responses: Array.from({ length: 500 }, () => ({ success: true })),
      });

      const result = await pushService.sendPush(tokens, {
        title: 'Batch Test',
        message: 'Batch test message',
      });

      expect(result.success).toBe(true);
      expect(mockMessaging.sendMulticast).toHaveBeenCalledTimes(2); // 1000 tokens / 500 batch size = 2 batches
    });

    test('should handle batch failures gracefully', async () => {
      const tokens = Array.from({ length: 100 }, (_, i) => `token_${i}_${'x'.repeat(50)}`);

      mockMessaging.sendMulticast
        .mockResolvedValueOnce({
          successCount: 50,
          failureCount: 0,
          responses: Array.from({ length: 50 }, () => ({ success: true })),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await pushService.sendPush(tokens, {
        title: 'Test',
        message: 'Test message',
      });

      expect(result.success).toBe(true);
      expect(result.totalSent).toBe(50);
      expect(result.totalFailed).toBe(50);
    });
  });

  describe('Message Building', () => {
    test('should build basic FCM message', () => {
      const payload = {
        title: 'Test Title',
        message: 'Test Message',
        type: 'test',
        data: { key: 'value' },
      };

      const message = pushService.buildMessage(payload);

      expect(message).toEqual({
        notification: {
          title: 'Test Title',
          body: 'Test Message',
        },
        data: {
          type: 'test',
          timestamp: expect.any(String),
          key: 'value',
        },
      });
    });

    test('should build message with Android configuration', () => {
      const payload = {
        title: 'Test Title',
        message: 'Test Message',
        priority: 'urgent',
        android: {
          icon: 'custom_icon',
          color: '#FF0000',
          sound: 'custom_sound',
          clickAction: 'OPEN_ACTIVITY',
        },
      };

      const message = pushService.buildMessage(payload);

      expect(message.android).toEqual({
        priority: 'high',
        notification: {
          icon: 'custom_icon',
          color: '#FF0000',
          sound: 'custom_sound',
          clickAction: 'OPEN_ACTIVITY',
        },
      });
    });

    test('should build message with iOS configuration', () => {
      const payload = {
        title: 'Test Title',
        message: 'Test Message',
        apns: {
          badge: 5,
          sound: 'custom_sound',
          contentAvailable: true,
        },
      };

      const message = pushService.buildMessage(payload);

      expect(message.apns).toEqual({
        payload: {
          aps: {
            alert: {
              title: 'Test Title',
              body: 'Test Message',
            },
            badge: 5,
            sound: 'custom_sound',
            'content-available': 1,
          },
        },
      });
    });

    test('should build message with web push configuration', () => {
      const payload = {
        title: 'Test Title',
        message: 'Test Message',
        webpush: {
          icon: '/custom-icon.png',
          badge: '/custom-badge.png',
          requireInteraction: true,
          link: 'https://example.com/notification',
        },
      };

      const message = pushService.buildMessage(payload);

      expect(message.webpush).toEqual({
        notification: {
          title: 'Test Title',
          body: 'Test Message',
          icon: '/custom-icon.png',
          badge: '/custom-badge.png',
          requireInteraction: true,
        },
        fcmOptions: {
          link: 'https://example.com/notification',
        },
      });
    });
  });

  describe('Token Management', () => {
    test('should register push token for user', async () => {
      const result = await pushService.registerToken('user123', 'new_token_' + 'x'.repeat(50), {
        platform: 'web',
        deviceId: 'device123',
        appVersion: '1.0.0',
      });

      expect(result).toBe(true);
      expect(mockUser.pushTokens).toContainEqual(
        expect.objectContaining({
          token: 'new_token_' + 'x'.repeat(50),
          platform: 'web',
          deviceId: 'device123',
          appVersion: '1.0.0',
        })
      );
      expect(mockUser.save).toHaveBeenCalled();
    });

    test('should reject invalid token format', async () => {
      const result = await pushService.registerToken('user123', 'invalid_token');

      expect(result).toBe(false);
      expect(mockUser.save).not.toHaveBeenCalled();
    });

    test('should limit tokens per user', async () => {
      // Add 5 existing tokens
      mockUser.pushTokens = Array.from({ length: 5 }, (_, i) => ({
        token: `existing_token_${i}_${'x'.repeat(50)}`,
        platform: 'web',
        registeredAt: new Date(Date.now() - i * 1000),
      }));

      const result = await pushService.registerToken('user123', 'new_token_' + 'x'.repeat(50));

      expect(result).toBe(true);
      expect(mockUser.pushTokens).toHaveLength(5); // Should still be 5 (oldest removed)
      expect(mockUser.pushTokens[0].token).toBe('new_token_' + 'x'.repeat(50)); // Newest first
    });

    test('should unregister push token', async () => {
      const result = await pushService.unregisterToken('user123', 'token_to_remove');

      expect(result).toBe(true);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { $pull: { pushTokens: { token: 'token_to_remove' } } }
      );
    });

    test('should get user tokens', async () => {
      const tokens = await pushService.getUserTokens('user123');

      expect(tokens).toEqual(['valid_token_123', 'valid_token_456']);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { $set: { 'pushTokens.$[].lastUsed': expect.any(Date) } }
      );
    });

    test('should handle user not found', async () => {
      User.findById.mockResolvedValue(null);

      const tokens = await pushService.getUserTokens('nonexistent');

      expect(tokens).toEqual([]);
    });
  });

  describe('User-specific Sending', () => {
    test('should send push to specific user', async () => {
      mockMessaging.sendMulticast.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        responses: [{ success: true }, { success: true }],
      });

      const result = await pushService.sendToUser('user123', {
        title: 'User Notification',
        message: 'Message for user',
      });

      expect(result.success).toBe(true);
      expect(mockMessaging.sendMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ['valid_token_123', 'valid_token_456'],
        })
      );
    });

    test('should handle user with no tokens', async () => {
      mockUser.pushTokens = [];

      const result = await pushService.sendToUser('user123', {
        title: 'Test',
        message: 'Test message',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('No push tokens for user');
      expect(mockMessaging.sendMulticast).not.toHaveBeenCalled();
    });

    test('should send push to multiple users', async () => {
      const user2 = {
        ...mockUser,
        _id: 'user456',
        pushTokens: [{ token: 'user2_token_' + 'x'.repeat(50) }],
      };

      User.findById
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(user2);

      mockMessaging.sendMulticast.mockResolvedValue({
        successCount: 3,
        failureCount: 0,
        responses: [{ success: true }, { success: true }, { success: true }],
      });

      const result = await pushService.sendToUsers(['user123', 'user456'], {
        title: 'Multi-user Notification',
        message: 'Message for multiple users',
      });

      expect(result.success).toBe(true);
      expect(mockMessaging.sendMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ['valid_token_123', 'valid_token_456', 'user2_token_' + 'x'.repeat(50)],
        })
      );
    });
  });

  describe('Service Health and Metrics', () => {
    test('should return service metrics', () => {
      const metrics = pushService.getMetrics();

      expect(metrics).toHaveProperty('sent');
      expect(metrics).toHaveProperty('failed');
      expect(metrics).toHaveProperty('invalidTokens');
      expect(metrics).toHaveProperty('batchesSent');
      expect(metrics).toHaveProperty('enabled');
      expect(metrics).toHaveProperty('successRate');
    });

    test('should return health status', () => {
      const health = pushService.getHealthStatus();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('enabled');
      expect(health).toHaveProperty('metrics');
      expect(health.status).toBe('healthy');
    });

    test('should return disabled status when service is disabled', () => {
      pushService.enabled = false;

      const health = pushService.getHealthStatus();

      expect(health.status).toBe('disabled');
      expect(health.enabled).toBe(false);
    });
  });

  describe('Test Push', () => {
    test('should send test push notification', async () => {
      mockMessaging.sendMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      const result = await pushService.testPush('test_token_' + 'x'.repeat(50));

      expect(result.success).toBe(true);
      expect(mockMessaging.sendMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ['test_token_' + 'x'.repeat(50)],
          notification: {
            title: 'Test Notification',
            body: 'This is a test push notification',
          },
          data: {
            type: 'test',
            test: 'true',
            timestamp: expect.any(String),
          },
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle FCM service errors', async () => {
      mockMessaging.sendMulticast.mockRejectedValue(new Error('FCM service unavailable'));

      const result = await pushService.sendPush(['token1'], {
        title: 'Test',
        message: 'Test message',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Push send failed');
    });

    test('should handle token registration errors', async () => {
      User.findById.mockRejectedValue(new Error('Database error'));

      const result = await pushService.registerToken('user123', 'token_' + 'x'.repeat(50));

      expect(result).toBe(false);
    });

    test('should handle token cleanup errors gracefully', async () => {
      User.updateMany.mockRejectedValue(new Error('Database error'));

      const tokens = ['valid_token', 'invalid_token'];
      mockMessaging.sendMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true },
          {
            success: false,
            error: { code: 'messaging/invalid-registration-token' },
          },
        ],
      });

      // Should not throw despite cleanup error
      const result = await pushService.sendPush(tokens, {
        title: 'Test',
        message: 'Test message',
      });

      expect(result.success).toBe(true);
    });
  });
});