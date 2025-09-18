const Notification = require('../models/Notification');
const User = require('../models/User');
const notificationService = require('./notificationService');
const backgroundWorker = require('./backgroundWorker');
const { getPrometheusService } = require('./prometheusService');

class NotificationRetryService {
  constructor() {
    this.isRunning = false;
    this.retryInterval = parseInt(process.env.NOTIFICATION_RETRY_INTERVAL) || 5 * 60 * 1000; // 5 minutes
    this.maxRetries = parseInt(process.env.NOTIFICATION_MAX_RETRIES) || 3;
    this.retryBackoffMultiplier = parseFloat(process.env.NOTIFICATION_RETRY_BACKOFF) || 2;
    this.cleanupInterval = parseInt(process.env.NOTIFICATION_CLEANUP_INTERVAL) || 24 * 60 * 60 * 1000; // 24 hours
    this.maxAge = parseInt(process.env.NOTIFICATION_MAX_AGE) || 7 * 24 * 60 * 60 * 1000; // 7 days
    
    this.metrics = {
      retriesAttempted: 0,
      retriesSucceeded: 0,
      retriesFailed: 0,
      escalationsTriggered: 0,
      notificationsCleaned: 0,
    };

    this.retryIntervalId = null;
    this.cleanupIntervalId = null;
  }

  /**
   * Start the retry service
   */
  start() {
    if (this.isRunning) {
      console.warn('⚠️ Notification retry service is already running');
      return;
    }

    console.log('🔄 Starting notification retry service...');
    this.isRunning = true;

    // Schedule retry processing
    this.retryIntervalId = setInterval(() => {
      this.processRetries().catch(error => {
        console.error('❌ Error in retry processing:', error);
      });
    }, this.retryInterval);

    // Schedule cleanup processing
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpiredNotifications().catch(error => {
        console.error('❌ Error in cleanup processing:', error);
      });
    }, this.cleanupInterval);

    // Initial processing
    this.processRetries().catch(error => {
      console.error('❌ Error in initial retry processing:', error);
    });

    console.log('✅ Notification retry service started');
  }

  /**
   * Stop the retry service
   */
  stop() {
    if (!this.isRunning) {
      console.warn('⚠️ Notification retry service is not running');
      return;
    }

    console.log('⏹️ Stopping notification retry service...');
    this.isRunning = false;

    if (this.retryIntervalId) {
      clearInterval(this.retryIntervalId);
      this.retryIntervalId = null;
    }

    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    console.log('✅ Notification retry service stopped');
  }

  /**
   * Process failed notifications for retry
   */
  async processRetries() {
    try {
      console.log('🔍 Scanning for failed notifications to retry...');

      // Find notifications that should be retried
      const failedNotifications = await this.findNotificationsToRetry();
      
      if (failedNotifications.length === 0) {
        console.log('✅ No notifications need retry');
        return;
      }

      console.log(`📋 Found ${failedNotifications.length} notifications to retry`);

      // Process each notification
      for (const notification of failedNotifications) {
        await this.retryNotification(notification);
      }

      // Record metrics
      this.recordRetryMetrics(failedNotifications.length);

    } catch (error) {
      console.error('❌ Error processing retries:', error);
      throw error;
    }
  }

  /**
   * Find notifications that should be retried
   * @returns {Array} - Notifications to retry
   */
  async findNotificationsToRetry() {
    const now = new Date();
    
    return await Notification.find({
      $and: [
        // Has failed deliveries
        {
          $or: [
            { 'channels.email.sent': false, 'channels.email.error': { $exists: true } },
            { 'channels.slack.sent': false, 'channels.slack.error': { $exists: true } },
            { 'channels.push.sent': false, 'channels.push.error': { $exists: true } },
            { 'channels.websocket.sent': false, 'channels.websocket.error': { $exists: true } },
          ]
        },
        // Not exceeded max retries
        { retryCount: { $lt: this.maxRetries } },
        // Ready for next retry (based on backoff)
        {
          $or: [
            { nextRetryAt: { $exists: false } },
            { nextRetryAt: { $lte: now } }
          ]
        },
        // Not too old
        { createdAt: { $gt: new Date(now.getTime() - this.maxAge) } },
        // Not already being processed
        { isRetrying: { $ne: true } }
      ]
    }).populate('recipient', 'firstName lastName email notificationPreferences')
      .sort({ priority: -1, createdAt: 1 })
      .limit(100); // Process in batches
  }

  /**
   * Retry a specific notification
   * @param {Object} notification - Notification to retry
   */
  async retryNotification(notification) {
    try {
      console.log(`🔄 Retrying notification ${notification._id} (attempt ${notification.retryCount + 1})`);

      // Mark as being processed
      await Notification.findByIdAndUpdate(notification._id, {
        isRetrying: true,
        lastRetryAt: new Date()
      });

      this.metrics.retriesAttempted++;

      // Determine which channels failed and need retry
      const failedChannels = this.getFailedChannels(notification);
      
      if (failedChannels.length === 0) {
        console.log(`✅ No failed channels for notification ${notification._id}`);
        await this.markRetryComplete(notification._id, true);
        return;
      }

      // Retry failed channels
      const retryResults = await this.retryFailedChannels(notification, failedChannels);
      
      // Update notification with retry results
      await this.updateNotificationAfterRetry(notification, retryResults);

      // Check if we should escalate
      if (this.shouldEscalate(notification, retryResults)) {
        await this.escalateNotification(notification);
      }

      this.metrics.retriesSucceeded++;
      console.log(`✅ Retry completed for notification ${notification._id}`);

    } catch (error) {
      console.error(`❌ Failed to retry notification ${notification._id}:`, error);
      this.metrics.retriesFailed++;
      
      // Mark retry as failed
      await this.markRetryComplete(notification._id, false, error.message);
    }
  }

  /**
   * Get failed channels from notification
   * @param {Object} notification - Notification object
   * @returns {Array} - Failed channel names
   */
  getFailedChannels(notification) {
    const failedChannels = [];
    
    if (notification.channels.email.error && !notification.channels.email.sent) {
      failedChannels.push('email');
    }
    if (notification.channels.slack.error && !notification.channels.slack.sent) {
      failedChannels.push('slack');
    }
    if (notification.channels.push.error && !notification.channels.push.sent) {
      failedChannels.push('push');
    }
    if (notification.channels.websocket.error && !notification.channels.websocket.sent) {
      failedChannels.push('websocket');
    }

    return failedChannels;
  }

  /**
   * Retry failed channels for a notification
   * @param {Object} notification - Notification object
   * @param {Array} failedChannels - Channels to retry
   * @returns {Object} - Retry results
   */
  async retryFailedChannels(notification, failedChannels) {
    const results = {};

    for (const channel of failedChannels) {
      try {
        console.log(`📤 Retrying ${channel} for notification ${notification._id}`);
        
        let success = false;
        let error = null;

        switch (channel) {
          case 'email':
            success = await this.retryEmailChannel(notification);
            break;
          case 'slack':
            success = await this.retrySlackChannel(notification);
            break;
          case 'push':
            success = await this.retryPushChannel(notification);
            break;
          case 'websocket':
            success = await this.retryWebSocketChannel(notification);
            break;
        }

        results[channel] = { success, error };
        
      } catch (channelError) {
        console.error(`❌ Failed to retry ${channel}:`, channelError);
        results[channel] = { success: false, error: channelError.message };
      }
    }

    return results;
  }

  /**
   * Retry email channel
   * @param {Object} notification - Notification object
   * @returns {boolean} - Success
   */
  async retryEmailChannel(notification) {
    if (!notification.recipient.email || 
        !notification.recipient.notificationPreferences?.email?.enabled) {
      return false;
    }

    const emailService = require('./emailService');
    const result = await emailService.sendNotificationEmail(
      notification.recipient.email,
      notification.title,
      notification.message,
      notification.data
    );

    return result.success;
  }

  /**
   * Retry Slack channel
   * @param {Object} notification - Notification object
   * @returns {boolean} - Success
   */
  async retrySlackChannel(notification) {
    if (!notification.recipient.notificationPreferences?.slack?.enabled ||
        !notification.recipient.notificationPreferences?.slack?.webhookUrl) {
      return false;
    }

    const slackService = require('./slackService');
    const result = await slackService.sendSlackNotification(
      notification.recipient.notificationPreferences.slack.webhookUrl,
      {
        title: notification.title,
        message: notification.message,
        type: notification.type,
        data: notification.data
      }
    );

    return result.success;
  }

  /**
   * Retry push channel
   * @param {Object} notification - Notification object
   * @returns {boolean} - Success
   */
  async retryPushChannel(notification) {
    if (!notification.recipient.notificationPreferences?.push?.enabled) {
      return false;
    }

    const pushService = require('./pushService');
    const result = await pushService.sendToUser(notification.recipient._id, {
      title: notification.title,
      message: notification.message,
      type: notification.type,
      data: notification.data,
      priority: notification.priority
    });

    return result.success;
  }

  /**
   * Retry WebSocket channel
   * @param {Object} notification - Notification object
   * @returns {boolean} - Success
   */
  async retryWebSocketChannel(notification) {
    if (!notification.recipient.notificationPreferences?.inApp?.enabled) {
      return false;
    }

    // WebSocket retry through notification service
    const result = await notificationService.sendWebSocketNotification(
      notification.recipient._id,
      {
        title: notification.title,
        message: notification.message,
        type: notification.type,
        data: notification.data,
        priority: notification.priority
      }
    );

    return result.success;
  }

  /**
   * Update notification after retry attempt
   * @param {Object} notification - Original notification
   * @param {Object} retryResults - Results from retry attempts
   */
  async updateNotificationAfterRetry(notification, retryResults) {
    const updateData = {
      retryCount: notification.retryCount + 1,
      isRetrying: false,
      lastRetryAt: new Date()
    };

    // Update channel statuses
    for (const [channel, result] of Object.entries(retryResults)) {
      if (result.success) {
        updateData[`channels.${channel}.sent`] = true;
        updateData[`channels.${channel}.sentAt`] = new Date();
        updateData[`channels.${channel}.error`] = undefined;
      } else {
        updateData[`channels.${channel}.error`] = result.error;
      }
    }

    // Calculate next retry time with exponential backoff
    if (notification.retryCount + 1 < this.maxRetries) {
      const backoffDelay = Math.pow(this.retryBackoffMultiplier, notification.retryCount + 1) * 60 * 1000; // minutes to ms
      updateData.nextRetryAt = new Date(Date.now() + backoffDelay);
    }

    await Notification.findByIdAndUpdate(notification._id, updateData);
  }

  /**
   * Mark retry as complete
   * @param {string} notificationId - Notification ID
   * @param {boolean} success - Whether retry was successful
   * @param {string} error - Error message if failed
   */
  async markRetryComplete(notificationId, success, error = null) {
    const updateData = {
      isRetrying: false,
      lastRetryAt: new Date()
    };

    if (!success && error) {
      updateData.retryError = error;
    }

    await Notification.findByIdAndUpdate(notificationId, updateData);
  }

  /**
   * Check if notification should be escalated
   * @param {Object} notification - Notification object
   * @param {Object} retryResults - Retry results
   * @returns {boolean} - Should escalate
   */
  shouldEscalate(notification, retryResults) {
    // Escalate if max retries reached and still has failures
    if (notification.retryCount + 1 >= this.maxRetries) {
      const hasFailures = Object.values(retryResults).some(result => !result.success);
      return hasFailures;
    }

    return false;
  }

  /**
   * Escalate notification to administrators
   * @param {Object} notification - Failed notification
   */
  async escalateNotification(notification) {
    try {
      console.log(`🚨 Escalating notification ${notification._id} to administrators`);

      // Find administrators
      const admins = await User.find({
        role: 'admin',
        isActive: true,
        'notificationPreferences.email.enabled': true
      });

      if (admins.length === 0) {
        console.warn('⚠️ No administrators found for escalation');
        return;
      }

      // Create escalation notification
      const escalationData = {
        originalNotificationId: notification._id,
        recipient: notification.recipient.firstName + ' ' + notification.recipient.lastName,
        recipientEmail: notification.recipient.email,
        notificationType: notification.type,
        title: notification.title,
        message: notification.message,
        retryCount: notification.retryCount,
        failedChannels: this.getFailedChannels(notification),
        createdAt: notification.createdAt,
      };

      // Send escalation to each admin
      for (const admin of admins) {
        await notificationService.sendNotification({
          recipient: admin._id,
          type: 'notification_escalation',
          title: `Notification Delivery Failed - Escalation Required`,
          message: `A notification to ${escalationData.recipient} has failed delivery after ${notification.retryCount} retry attempts.`,
          data: escalationData,
          priority: 'urgent',
          channels: {
            inApp: { sent: false, read: false },
            email: { sent: false },
            websocket: { sent: false },
          }
        });
      }

      // Mark notification as escalated
      await Notification.findByIdAndUpdate(notification._id, {
        escalated: true,
        escalatedAt: new Date()
      });

      this.metrics.escalationsTriggered++;
      console.log(`✅ Escalation completed for notification ${notification._id}`);

    } catch (error) {
      console.error(`❌ Failed to escalate notification ${notification._id}:`, error);
    }
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications() {
    try {
      console.log('🧹 Cleaning up expired notifications...');

      const cutoffDate = new Date(Date.now() - this.maxAge);
      
      // Find expired notifications
      const expiredNotifications = await Notification.find({
        createdAt: { $lt: cutoffDate },
        $or: [
          { retryCount: { $gte: this.maxRetries } },
          { escalated: true }
        ]
      });

      if (expiredNotifications.length === 0) {
        console.log('✅ No expired notifications to clean up');
        return;
      }

      console.log(`🗑️ Removing ${expiredNotifications.length} expired notifications`);

      // Archive or delete expired notifications
      const result = await Notification.deleteMany({
        _id: { $in: expiredNotifications.map(n => n._id) }
      });

      this.metrics.notificationsCleaned += result.deletedCount;
      console.log(`✅ Cleaned up ${result.deletedCount} expired notifications`);

    } catch (error) {
      console.error('❌ Error cleaning up expired notifications:', error);
    }
  }

  /**
   * Manually retry a specific notification
   * @param {string} notificationId - Notification ID
   * @returns {Object} - Retry result
   */
  async manualRetry(notificationId) {
    try {
      const notification = await Notification.findById(notificationId)
        .populate('recipient', 'firstName lastName email notificationPreferences');

      if (!notification) {
        throw new Error('Notification not found');
      }

      if (notification.retryCount >= this.maxRetries) {
        throw new Error('Maximum retry attempts exceeded');
      }

      await this.retryNotification(notification);
      
      return { success: true, message: 'Manual retry completed' };
    } catch (error) {
      console.error(`❌ Manual retry failed for ${notificationId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get retry statistics
   * @returns {Object} - Retry statistics
   */
  getRetryStats() {
    return {
      ...this.metrics,
      isRunning: this.isRunning,
      retryInterval: this.retryInterval,
      maxRetries: this.maxRetries,
      backoffMultiplier: this.retryBackoffMultiplier,
      successRate: this.metrics.retriesAttempted > 0 
        ? ((this.metrics.retriesSucceeded / this.metrics.retriesAttempted) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Record retry metrics
   * @param {number} count - Number of retries processed
   */
  recordRetryMetrics(count) {
    try {
      const prometheusService = getPrometheusService();
      if (prometheusService) {
        prometheusService.recordNotificationRetries(count);
      }
    } catch (error) {
      console.error('❌ Failed to record retry metrics:', error);
    }
  }

  /**
   * Health check
   * @returns {Object} - Health status
   */
  getHealthStatus() {
    return {
      status: this.isRunning ? 'healthy' : 'stopped',
      isRunning: this.isRunning,
      metrics: this.getRetryStats(),
      lastProcessedAt: this.lastProcessedAt,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      retriesAttempted: 0,
      retriesSucceeded: 0,
      retriesFailed: 0,
      escalationsTriggered: 0,
      notificationsCleaned: 0,
    };
  }
}

// Create singleton instance
const notificationRetryService = new NotificationRetryService();

// Auto-start if not in test environment
if (process.env.NODE_ENV !== 'test') {
  // Start after a short delay to ensure other services are initialized
  setTimeout(() => {
    notificationRetryService.start();
  }, 5000);
}

module.exports = notificationRetryService;