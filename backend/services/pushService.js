const admin = require('firebase-admin');
const User = require('../models/User');
const { getPrometheusService } = require('./prometheusService');

class PushService {
  constructor() {
    this.enabled = false;
    this.fcmApp = null;
    this.batchSize = 500; // FCM batch limit
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
    this.metrics = {
      sent: 0,
      failed: 0,
      invalidTokens: 0,
      batchesSent: 0,
    };
    
    this.initialize();
  }

  /**
   * Initialize Firebase Admin SDK
   */
  initialize() {
    try {
      const serviceAccountKey = process.env.FCM_SERVICE_ACCOUNT_KEY;
      const projectId = process.env.FCM_PROJECT_ID;

      if (!serviceAccountKey || !projectId) {
        console.warn('⚠️ FCM credentials not configured. Push notifications disabled.');
        return;
      }

      // Parse service account key if it's a JSON string
      let serviceAccount;
      try {
        serviceAccount = typeof serviceAccountKey === 'string' 
          ? JSON.parse(serviceAccountKey) 
          : serviceAccountKey;
      } catch (parseError) {
        console.error('❌ Invalid FCM service account key format:', parseError.message);
        return;
      }

      // Initialize Firebase Admin
      this.fcmApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId,
      }, 'push-service');

      this.enabled = true;
      console.log('✅ Firebase Cloud Messaging initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize FCM:', error.message);
      this.enabled = false;
    }
  }

  /**
   * Send push notifications to multiple tokens
   * @param {Array} tokens - Array of FCM tokens
   * @param {Object} payload - Notification payload
   * @returns {Object} - Send result
   */
  async sendPush(tokens = [], payload = {}) {
    try {
      if (!this.enabled) {
        console.warn('⚠️ Push service not enabled');
        return { success: false, error: 'Push service not enabled' };
      }

      if (!Array.isArray(tokens) || tokens.length === 0) {
        return { success: true, results: [] };
      }

      // Validate and clean tokens
      const validTokens = await this.validateTokens(tokens);
      if (validTokens.length === 0) {
        return { success: true, results: [], invalidTokens: tokens.length };
      }

      console.log(`📲 Sending push to ${validTokens.length} device(s): ${payload.title || payload.type}`);

      // Send in batches
      const results = await this.sendInBatches(validTokens, payload);
      
      // Update metrics
      this.updateMetrics(results);
      
      // Record Prometheus metrics
      this.recordPrometheusMetrics(results);

      return {
        success: true,
        results,
        totalSent: results.reduce((sum, batch) => sum + batch.successCount, 0),
        totalFailed: results.reduce((sum, batch) => sum + batch.failureCount, 0),
        invalidTokens: results.reduce((sum, batch) => sum + (batch.invalidTokens || 0), 0),
      };
    } catch (error) {
      console.error('❌ Push send failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notifications in batches
   * @param {Array} tokens - Valid FCM tokens
   * @param {Object} payload - Notification payload
   * @returns {Array} - Batch results
   */
  async sendInBatches(tokens, payload) {
    const batches = this.createBatches(tokens, this.batchSize);
    const results = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 Sending batch ${i + 1}/${batches.length} (${batch.length} tokens)`);

      try {
        const batchResult = await this.sendBatch(batch, payload);
        results.push(batchResult);
        this.metrics.batchesSent++;
      } catch (error) {
        console.error(`❌ Batch ${i + 1} failed:`, error.message);
        results.push({
          batchIndex: i,
          successCount: 0,
          failureCount: batch.length,
          errors: [error.message],
        });
      }

      // Small delay between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await this.delay(100);
      }
    }

    return results;
  }

  /**
   * Send a single batch of notifications
   * @param {Array} tokens - Batch of FCM tokens
   * @param {Object} payload - Notification payload
   * @returns {Object} - Batch result
   */
  async sendBatch(tokens, payload) {
    const message = this.buildMessage(payload);
    
    try {
      const response = await admin.messaging(this.fcmApp).sendMulticast({
        tokens,
        ...message,
      });

      const invalidTokens = [];
      const errors = [];

      // Process individual responses
      response.responses.forEach((resp, index) => {
        if (!resp.success) {
          const error = resp.error;
          if (this.isInvalidToken(error)) {
            invalidTokens.push(tokens[index]);
          }
          errors.push(error.message || error.code);
        }
      });

      // Clean up invalid tokens
      if (invalidTokens.length > 0) {
        await this.cleanupInvalidTokens(invalidTokens);
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens: invalidTokens.length,
        errors: [...new Set(errors)], // Remove duplicates
      };
    } catch (error) {
      throw new Error(`FCM batch send failed: ${error.message}`);
    }
  }

  /**
   * Build FCM message from payload
   * @param {Object} payload - Notification payload
   * @returns {Object} - FCM message
   */
  buildMessage(payload) {
    const message = {
      notification: {
        title: payload.title || 'Notification',
        body: payload.message || payload.body || '',
      },
      data: {
        type: payload.type || 'general',
        timestamp: new Date().toISOString(),
        ...(payload.data || {}),
      },
    };

    // Add Android-specific configuration
    if (payload.android) {
      message.android = {
        priority: payload.priority === 'urgent' ? 'high' : 'normal',
        notification: {
          icon: payload.android.icon || 'ic_notification',
          color: payload.android.color || '#2196F3',
          sound: payload.android.sound || 'default',
          clickAction: payload.android.clickAction,
        },
        ...payload.android,
      };
    }

    // Add iOS-specific configuration
    if (payload.apns) {
      message.apns = {
        payload: {
          aps: {
            alert: {
              title: message.notification.title,
              body: message.notification.body,
            },
            badge: payload.apns.badge,
            sound: payload.apns.sound || 'default',
            'content-available': payload.apns.contentAvailable ? 1 : 0,
          },
        },
        ...payload.apns,
      };
    }

    // Add web push configuration
    if (payload.webpush) {
      message.webpush = {
        notification: {
          title: message.notification.title,
          body: message.notification.body,
          icon: payload.webpush.icon || '/icon-192x192.png',
          badge: payload.webpush.badge || '/badge-72x72.png',
          requireInteraction: payload.webpush.requireInteraction || false,
        },
        fcmOptions: {
          link: payload.webpush.link,
        },
        ...payload.webpush,
      };
    }

    return message;
  }

  /**
   * Validate FCM tokens
   * @param {Array} tokens - Array of tokens to validate
   * @returns {Array} - Valid tokens
   */
  async validateTokens(tokens) {
    const validTokens = [];
    
    for (const token of tokens) {
      if (this.isValidTokenFormat(token)) {
        validTokens.push(token);
      } else {
        console.warn(`⚠️ Invalid token format: ${token.substring(0, 20)}...`);
        this.metrics.invalidTokens++;
      }
    }

    return validTokens;
  }

  /**
   * Check if token format is valid
   * @param {string} token - FCM token
   * @returns {boolean} - Is valid
   */
  isValidTokenFormat(token) {
    return typeof token === 'string' && 
           token.length > 50 && 
           /^[A-Za-z0-9_-]+$/.test(token);
  }

  /**
   * Check if error indicates invalid token
   * @param {Object} error - FCM error
   * @returns {boolean} - Is invalid token error
   */
  isInvalidToken(error) {
    const invalidTokenCodes = [
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
      'messaging/invalid-argument',
    ];
    
    return invalidTokenCodes.includes(error.code);
  }

  /**
   * Clean up invalid tokens from user records
   * @param {Array} invalidTokens - Invalid FCM tokens
   */
  async cleanupInvalidTokens(invalidTokens) {
    try {
      console.log(`🧹 Cleaning up ${invalidTokens.length} invalid tokens`);
      
      await User.updateMany(
        { 'pushTokens.token': { $in: invalidTokens } },
        { $pull: { pushTokens: { token: { $in: invalidTokens } } } }
      );

      this.metrics.invalidTokens += invalidTokens.length;
    } catch (error) {
      console.error('❌ Failed to cleanup invalid tokens:', error.message);
    }
  }

  /**
   * Register push token for user
   * @param {string} userId - User ID
   * @param {string} token - FCM token
   * @param {Object} deviceInfo - Device information
   * @returns {boolean} - Success
   */
  async registerToken(userId, token, deviceInfo = {}) {
    try {
      if (!this.isValidTokenFormat(token)) {
        throw new Error('Invalid token format');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Remove existing token if present
      user.pushTokens = user.pushTokens.filter(t => t.token !== token);

      // Add new token
      user.pushTokens.push({
        token,
        platform: deviceInfo.platform || 'unknown',
        deviceId: deviceInfo.deviceId,
        appVersion: deviceInfo.appVersion,
        registeredAt: new Date(),
        lastUsed: new Date(),
      });

      // Keep only last 5 tokens per user
      if (user.pushTokens.length > 5) {
        user.pushTokens = user.pushTokens
          .sort((a, b) => b.registeredAt - a.registeredAt)
          .slice(0, 5);
      }

      await user.save();
      console.log(`✅ Registered push token for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to register push token:', error.message);
      return false;
    }
  }

  /**
   * Unregister push token
   * @param {string} userId - User ID
   * @param {string} token - FCM token
   * @returns {boolean} - Success
   */
  async unregisterToken(userId, token) {
    try {
      await User.findByIdAndUpdate(
        userId,
        { $pull: { pushTokens: { token } } }
      );

      console.log(`✅ Unregistered push token for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to unregister push token:', error.message);
      return false;
    }
  }

  /**
   * Get user's push tokens
   * @param {string} userId - User ID
   * @returns {Array} - Push tokens
   */
  async getUserTokens(userId) {
    try {
      const user = await User.findById(userId).select('pushTokens');
      if (!user || !user.pushTokens) {
        return [];
      }

      // Update last used timestamp
      const tokens = user.pushTokens.map(tokenObj => tokenObj.token);
      if (tokens.length > 0) {
        await User.findByIdAndUpdate(
          userId,
          { $set: { 'pushTokens.$[].lastUsed': new Date() } }
        );
      }

      return tokens;
    } catch (error) {
      console.error('❌ Failed to get user tokens:', error.message);
      return [];
    }
  }

  /**
   * Send push notification to specific user
   * @param {string} userId - User ID
   * @param {Object} payload - Notification payload
   * @returns {Object} - Send result
   */
  async sendToUser(userId, payload) {
    const tokens = await this.getUserTokens(userId);
    if (tokens.length === 0) {
      return { success: true, message: 'No push tokens for user' };
    }

    return await this.sendPush(tokens, payload);
  }

  /**
   * Send push notification to multiple users
   * @param {Array} userIds - Array of user IDs
   * @param {Object} payload - Notification payload
   * @returns {Object} - Send result
   */
  async sendToUsers(userIds, payload) {
    const allTokens = [];
    
    for (const userId of userIds) {
      const tokens = await this.getUserTokens(userId);
      allTokens.push(...tokens);
    }

    if (allTokens.length === 0) {
      return { success: true, message: 'No push tokens for users' };
    }

    return await this.sendPush(allTokens, payload);
  }

  /**
   * Create batches from array
   * @param {Array} array - Input array
   * @param {number} batchSize - Batch size
   * @returns {Array} - Array of batches
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} - Delay promise
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update internal metrics
   * @param {Array} results - Batch results
   */
  updateMetrics(results) {
    results.forEach(result => {
      this.metrics.sent += result.successCount;
      this.metrics.failed += result.failureCount;
      this.metrics.invalidTokens += result.invalidTokens || 0;
    });
  }

  /**
   * Record Prometheus metrics
   * @param {Array} results - Batch results
   */
  recordPrometheusMetrics(results) {
    try {
      const prometheusService = getPrometheusService();
      if (prometheusService) {
        results.forEach(result => {
          prometheusService.recordPushNotification(
            result.successCount,
            result.failureCount,
            result.invalidTokens || 0
          );
        });
      }
    } catch (error) {
      console.error('❌ Failed to record Prometheus metrics:', error.message);
    }
  }

  /**
   * Get service metrics
   * @returns {Object} - Service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      enabled: this.enabled,
      batchSize: this.batchSize,
      successRate: this.metrics.sent + this.metrics.failed > 0 
        ? ((this.metrics.sent / (this.metrics.sent + this.metrics.failed)) * 100).toFixed(2) + '%'
        : '0%',
    };
  }

  /**
   * Health check
   * @returns {Object} - Health status
   */
  getHealthStatus() {
    return {
      status: this.enabled ? 'healthy' : 'disabled',
      enabled: this.enabled,
      metrics: this.getMetrics(),
      lastError: this.lastError,
    };
  }

  /**
   * Test push notification
   * @param {string} token - Test token
   * @returns {Object} - Test result
   */
  async testPush(token) {
    const testPayload = {
      title: 'Test Notification',
      message: 'This is a test push notification',
      type: 'test',
      data: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    };

    return await this.sendPush([token], testPayload);
  }
}

module.exports = new PushService();


