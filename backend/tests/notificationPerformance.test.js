const notificationService = require('../services/notificationService');
const notificationCacheService = require('../services/notificationCacheService');
const pushService = require('../services/pushService');
const emailService = require('../services/emailService');
const backgroundWorker = require('../services/backgroundWorker');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Mock dependencies for performance testing
jest.mock('../models/User');
jest.mock('../models/Notification');
jest.mock('../services/emailService');
jest.mock('../services/pushService');
jest.mock('../services/slackService');
jest.mock('../services/notificationCacheService');
jest.mock('../services/backgroundWorker');
jest.mock('../services/prometheusService', () => ({
  getPrometheusService: () => ({
    recordNotificationSent: jest.fn(),
    recordNotificationDelivery: jest.fn(),
    recordCacheOperation: jest.fn(),
  }),
}));

describe('Notification Performance Tests', () => {
  let mockUsers, mockSocketHandler;

  beforeAll(() => {
    // Create mock users for performance testing
    mockUsers = Array.from({ length: 1000 }, (_, i) => ({
      _id: `user${i}`,
      firstName: `User${i}`,
      lastName: 'Test',
      email: `user${i}@example.com`,
      notificationPreferences: {
        inApp: { enabled: true },
        email: { enabled: i % 2 === 0 }, // 50% have email enabled
        push: { enabled: i % 3 === 0 }, // 33% have push enabled
        slack: { enabled: false },
      },
      pushTokens: i % 3 === 0 ? [{ token: `token${i}_${'x'.repeat(50)}` }] : [],
    }));

    // Mock socket handler
    mockSocketHandler = {
      broadcastNotificationToUser: jest.fn().mockReturnValue(true),
      broadcastSystemAnnouncement: jest.fn(),
      isUserConnected: jest.fn().mockReturnValue(true),
    };

    // Initialize notification service
    notificationService.initialize(mockSocketHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    User.findById.mockImplementation((id) => 
      Promise.resolve(mockUsers.find(u => u._id === id))
    );
    User.find.mockImplementation((query) => {
      if (query._id && query._id.$in) {
        return Promise.resolve(mockUsers.filter(u => query._id.$in.includes(u._id)));
      }
      return Promise.resolve(mockUsers);
    });
    
    Notification.create.mockImplementation((data) => 
      Promise.resolve({ _id: `notif_${Date.now()}_${Math.random()}`, ...data })
    );
    Notification.find.mockResolvedValue([]);
    Notification.countDocuments.mockResolvedValue(0);
    
    emailService.sendNotificationEmail.mockResolvedValue({ success: true });
    pushService.sendToUser.mockResolvedValue({ success: true });
    notificationCacheService.getUserPreferences.mockResolvedValue(null);
    notificationCacheService.incrementUnreadCount.mockResolvedValue(1);
  });

  describe('High Volume Notification Delivery', () => {
    test('should handle 1000 concurrent individual notifications efficiently', async () => {
      const startTime = Date.now();
      const promises = [];

      // Send 1000 individual notifications concurrently
      for (let i = 0; i < 1000; i++) {
        promises.push(
          notificationService.sendNotification({
            recipient: `user${i}`,
            title: `Performance Test ${i}`,
            message: `Testing notification performance ${i}`,
            type: 'performance_test',
            priority: 'medium',
          })
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance assertions
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // All notifications should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.notificationId).toBeDefined();
      });

      console.log(`✅ 1000 individual notifications completed in ${duration}ms`);
      console.log(`📊 Average: ${(duration / 1000).toFixed(2)}ms per notification`);
    });

    test('should handle bulk notifications to 1000 users efficiently', async () => {
      const recipients = mockUsers.slice(0, 1000).map(u => u._id);
      const notificationData = {
        title: 'Bulk Performance Test',
        message: 'Testing bulk notification performance',
        type: 'system_announcement',
        priority: 'low',
      };

      const startTime = Date.now();
      const result = await notificationService.sendBulkNotifications(recipients, notificationData);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance assertions
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
      expect(result.success).toBe(true);
      expect(result.sent).toBe(1000);
      expect(result.failed).toBe(0);

      console.log(`✅ Bulk notification to 1000 users completed in ${duration}ms`);
      console.log(`📊 Average: ${(duration / 1000).toFixed(2)}ms per user`);
    });

    test('should maintain performance under memory pressure', async () => {
      const iterations = 10;
      const usersPerIteration = 100;
      const durations = [];

      for (let i = 0; i < iterations; i++) {
        const recipients = Array.from({ length: usersPerIteration }, (_, j) => `user${i * usersPerIteration + j}`);
        
        const startTime = Date.now();
        const result = await notificationService.sendBulkNotifications(recipients, {
          title: `Memory Test Iteration ${i}`,
          message: `Testing memory usage iteration ${i}`,
          type: 'memory_test',
        });
        const endTime = Date.now();
        
        durations.push(endTime - startTime);
        expect(result.success).toBe(true);
        expect(result.sent).toBe(usersPerIteration);
      }

      // Performance should remain consistent (no significant degradation)
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      
      // Max duration shouldn't be more than 2x the average (indicating memory issues)
      expect(maxDuration).toBeLessThan(avgDuration * 2);
      
      console.log(`📊 Memory pressure test - Avg: ${avgDuration.toFixed(2)}ms, Min: ${minDuration}ms, Max: ${maxDuration}ms`);
    });
  });

  describe('Database Query Performance', () => {
    test('should efficiently retrieve notifications with pagination', async () => {
      // Mock large dataset
      const mockNotifications = Array.from({ length: 10000 }, (_, i) => ({
        _id: `notif${i}`,
        title: `Notification ${i}`,
        message: `Message ${i}`,
        type: 'test',
        createdAt: new Date(Date.now() - i * 1000),
      }));

      Notification.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockImplementation((skip) => {
                const limit = 50; // Default limit
                return Promise.resolve(mockNotifications.slice(skip, skip + limit));
              }),
            }),
          }),
        }),
      });

      Notification.countDocuments.mockResolvedValue(10000);

      const startTime = Date.now();
      
      // Test multiple page retrievals
      const pagePromises = [];
      for (let page = 1; page <= 10; page++) {
        pagePromises.push(
          notificationService.getNotificationsForUser('user123', {
            page,
            limit: 50,
          })
        );
      }

      const results = await Promise.all(pagePromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance assertions
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      
      results.forEach((result, index) => {
        expect(result.notifications).toHaveLength(50);
        expect(result.pagination.page).toBe(index + 1);
        expect(result.pagination.total).toBe(10000);
      });

      console.log(`✅ 10 paginated queries completed in ${duration}ms`);
    });

    test('should efficiently handle unread count queries', async () => {
      const userIds = mockUsers.slice(0, 100).map(u => u._id);
      
      // Mock cache misses to test database performance
      notificationCacheService.getUnreadCount.mockResolvedValue(null);
      Notification.countDocuments.mockImplementation(() => 
        Promise.resolve(Math.floor(Math.random() * 20))
      );

      const startTime = Date.now();
      
      const countPromises = userIds.map(userId => 
        notificationService.getUnreadCount(userId)
      );

      const results = await Promise.all(countPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance assertions
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(results).toHaveLength(100);
      results.forEach(count => {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });

      console.log(`✅ 100 unread count queries completed in ${duration}ms`);
    });
  });

  describe('Cache Performance', () => {
    test('should demonstrate cache performance benefits', async () => {
      const userId = 'user123';
      const userPreferences = mockUsers[123].notificationPreferences;

      // Test without cache (cold)
      notificationCacheService.getUserPreferences.mockResolvedValueOnce(null);
      
      const coldStartTime = Date.now();
      await notificationService.sendNotification({
        recipient: userId,
        title: 'Cache Test Cold',
        message: 'Testing cache performance - cold',
        type: 'cache_test',
      });
      const coldEndTime = Date.now();
      const coldDuration = coldEndTime - coldStartTime;

      // Test with cache (warm)
      notificationCacheService.getUserPreferences.mockResolvedValue(userPreferences);
      
      const warmStartTime = Date.now();
      await notificationService.sendNotification({
        recipient: userId,
        title: 'Cache Test Warm',
        message: 'Testing cache performance - warm',
        type: 'cache_test',
      });
      const warmEndTime = Date.now();
      const warmDuration = warmEndTime - warmStartTime;

      // Cache should provide performance benefit
      expect(warmDuration).toBeLessThan(coldDuration);
      
      console.log(`📊 Cache performance - Cold: ${coldDuration}ms, Warm: ${warmDuration}ms`);
      console.log(`🚀 Cache speedup: ${((coldDuration - warmDuration) / coldDuration * 100).toFixed(1)}%`);
    });

    test('should handle cache failures gracefully without performance degradation', async () => {
      // Mock cache service to fail
      notificationCacheService.getUserPreferences.mockRejectedValue(new Error('Cache unavailable'));
      notificationCacheService.incrementUnreadCount.mockRejectedValue(new Error('Cache unavailable'));

      const startTime = Date.now();
      
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          notificationService.sendNotification({
            recipient: `user${i}`,
            title: `Cache Failure Test ${i}`,
            message: `Testing cache failure handling ${i}`,
            type: 'cache_failure_test',
          })
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should still complete efficiently despite cache failures
      expect(duration).toBeLessThan(3000);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      console.log(`✅ 50 notifications with cache failures completed in ${duration}ms`);
    });
  });

  describe('WebSocket Broadcasting Performance', () => {
    test('should efficiently broadcast to many connected users', async () => {
      const connectedUserCount = 500;
      
      // Mock many connected users
      mockSocketHandler.isUserConnected.mockImplementation((userId) => {
        const userIndex = parseInt(userId.replace('user', ''));
        return userIndex < connectedUserCount;
      });

      const notification = {
        type: 'broadcast_test',
        title: 'Broadcast Performance Test',
        message: 'Testing broadcast performance',
        priority: 'medium',
      };

      const startTime = Date.now();
      
      // Broadcast to all connected users
      const broadcastPromises = [];
      for (let i = 0; i < connectedUserCount; i++) {
        broadcastPromises.push(
          Promise.resolve(mockSocketHandler.broadcastNotificationToUser(`user${i}`, notification))
        );
      }

      const results = await Promise.all(broadcastPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance assertions
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(results.every(result => result === true)).toBe(true);

      console.log(`✅ Broadcast to ${connectedUserCount} users completed in ${duration}ms`);
    });

    test('should handle system announcements efficiently', async () => {
      const announcement = {
        type: 'system_announcement',
        title: 'Performance Test Announcement',
        message: 'Testing system announcement performance',
        priority: 'urgent',
      };

      const startTime = Date.now();
      
      // Send system announcement multiple times to test performance
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve(mockSocketHandler.broadcastSystemAnnouncement(announcement))
        );
      }

      await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500); // Should be very fast
      expect(mockSocketHandler.broadcastSystemAnnouncement).toHaveBeenCalledTimes(10);

      console.log(`✅ 10 system announcements completed in ${duration}ms`);
    });
  });

  describe('Email Template Rendering Performance', () => {
    test('should efficiently render email templates', async () => {
      const templateData = {
        title: 'Performance Test Email {{userName}}',
        message: 'Hello {{userName}}, you have {{taskCount}} tasks due in {{project}}.',
      };

      const variables = {
        userName: 'John Doe',
        taskCount: 5,
        project: 'Performance Testing Project',
      };

      const startTime = Date.now();
      
      // Render templates multiple times
      const renderPromises = [];
      for (let i = 0; i < 1000; i++) {
        renderPromises.push(
          Promise.resolve(notificationService.processTemplate(templateData, {
            ...variables,
            userName: `User ${i}`,
            taskCount: i % 10,
          }))
        );
      }

      const results = await Promise.all(renderPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance assertions
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(results).toHaveLength(1000);
      
      results.forEach((result, index) => {
        expect(result.title).toBe(`Performance Test Email User ${index}`);
        expect(result.message).toContain(`User ${index}`);
        expect(result.message).toContain(`${index % 10} tasks`);
      });

      console.log(`✅ 1000 template renders completed in ${duration}ms`);
      console.log(`📊 Average: ${(duration / 1000).toFixed(2)}ms per template`);
    });
  });

  describe('Memory Usage and Cleanup', () => {
    test('should not leak memory during high-volume operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform memory-intensive operations
      for (let batch = 0; batch < 10; batch++) {
        const promises = [];
        
        for (let i = 0; i < 100; i++) {
          promises.push(
            notificationService.sendNotification({
              recipient: `user${batch * 100 + i}`,
              title: `Memory Test Batch ${batch} Item ${i}`,
              message: `Testing memory usage in batch ${batch}, item ${i}`,
              type: 'memory_test',
              data: {
                batch,
                item: i,
                timestamp: new Date(),
                largeData: 'x'.repeat(1000), // Add some bulk to test memory
              },
            })
          );
        }
        
        await Promise.all(promises);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncreaseMB).toBeLessThan(50);

      console.log(`📊 Memory usage - Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`📊 Memory usage - Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`📊 Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
    });
  });

  describe('Error Recovery Performance', () => {
    test('should maintain performance during partial service failures', async () => {
      // Mock email service to fail 50% of the time
      emailService.sendNotificationEmail.mockImplementation(() => {
        return Math.random() > 0.5 
          ? Promise.resolve({ success: true })
          : Promise.resolve({ success: false, error: 'SMTP timeout' });
      });

      // Mock push service to fail 30% of the time
      pushService.sendToUser.mockImplementation(() => {
        return Math.random() > 0.3
          ? Promise.resolve({ success: true })
          : Promise.resolve({ success: false, error: 'FCM unavailable' });
      });

      const startTime = Date.now();
      const promises = [];

      for (let i = 0; i < 200; i++) {
        promises.push(
          notificationService.sendNotification({
            recipient: `user${i}`,
            title: `Error Recovery Test ${i}`,
            message: `Testing error recovery ${i}`,
            type: 'error_recovery_test',
          })
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should still complete efficiently despite failures
      expect(duration).toBeLessThan(4000);
      
      // All notifications should succeed (at least in-app delivery)
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      console.log(`✅ 200 notifications with service failures completed in ${duration}ms`);
    });
  });

  describe('Concurrent User Load', () => {
    test('should handle notifications for concurrent active users', async () => {
      const concurrentUsers = 100;
      const notificationsPerUser = 5;

      const startTime = Date.now();
      const userPromises = [];

      // Simulate concurrent users each receiving multiple notifications
      for (let userId = 0; userId < concurrentUsers; userId++) {
        const userNotificationPromises = [];
        
        for (let notifId = 0; notifId < notificationsPerUser; notifId++) {
          userNotificationPromises.push(
            notificationService.sendNotification({
              recipient: `user${userId}`,
              title: `Concurrent Test ${notifId}`,
              message: `User ${userId} notification ${notifId}`,
              type: 'concurrent_test',
            })
          );
        }
        
        userPromises.push(Promise.all(userNotificationPromises));
      }

      const allResults = await Promise.all(userPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const totalNotifications = concurrentUsers * notificationsPerUser;
      
      // Performance assertions
      expect(duration).toBeLessThan(6000); // Should complete within 6 seconds
      expect(allResults).toHaveLength(concurrentUsers);
      
      allResults.forEach(userResults => {
        expect(userResults).toHaveLength(notificationsPerUser);
        userResults.forEach(result => {
          expect(result.success).toBe(true);
        });
      });

      console.log(`✅ ${totalNotifications} notifications for ${concurrentUsers} concurrent users completed in ${duration}ms`);
      console.log(`📊 Average: ${(duration / totalNotifications).toFixed(2)}ms per notification`);
    });
  });
});