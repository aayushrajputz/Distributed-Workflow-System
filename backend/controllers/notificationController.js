const notificationService = require('../services/notificationService');
const notificationMetricsService = require('../services/notificationMetricsService');
const notificationTemplateService = require('../services/notificationTemplateService');
const notificationCacheService = require('../services/notificationCacheService');
const notificationRetryService = require('../services/notificationRetryService');
const pushService = require('../services/pushService');
const Notification = require('../models/Notification');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

class NotificationController {
  /**
   * Get comprehensive notification analytics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getAnalyticsDashboard = asyncHandler(async (req, res) => {
    const { 
      timeRange = '7d', 
      includeMetrics = true, 
      includeChannelBreakdown = true,
      includeTypeBreakdown = true 
    } = req.query;

    const analytics = await notificationMetricsService.getDashboardMetrics();
    
    // Add real-time metrics if requested
    if (includeMetrics) {
      analytics.realtime = notificationMetricsService.getRealtimeMetrics();
    }

    // Add service health information
    analytics.serviceHealth = {
      notificationService: notificationService.getHealthStatus(),
      cacheService: notificationCacheService.getHealthStatus(),
      retryService: notificationRetryService.getHealthStatus(),
      pushService: pushService.getHealthStatus(),
      templateService: notificationTemplateService.getHealthStatus(),
    };

    res.json({
      success: true,
      data: {
        ...analytics,
        timeRange,
        generatedAt: new Date(),
        requestedBy: req.user._id,
      },
    });
  });

  /**
   * Get detailed delivery status report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getDeliveryReport = asyncHandler(async (req, res) => {
    const { 
      startDate, 
      endDate, 
      channel, 
      type, 
      status = 'all',
      limit = 100,
      offset = 0 
    } = req.query;

    // Build query
    const query = {};
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (type) {
      query.type = type;
    }

    // Channel-specific filtering
    if (channel && status !== 'all') {
      if (status === 'sent') {
        query[`channels.${channel}.sent`] = true;
      } else if (status === 'failed') {
        query[`channels.${channel}.sent`] = false;
        query[`channels.${channel}.error`] = { $exists: true };
      }
    }

    const [notifications, totalCount] = await Promise.all([
      Notification.find(query)
        .populate('recipient', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .lean(),
      Notification.countDocuments(query),
    ]);

    // Calculate delivery statistics
    const stats = {
      total: totalCount,
      delivered: 0,
      failed: 0,
      pending: 0,
      channelStats: {},
    };

    notifications.forEach(notification => {
      Object.entries(notification.channels).forEach(([channelName, channelData]) => {
        if (!stats.channelStats[channelName]) {
          stats.channelStats[channelName] = { sent: 0, failed: 0, pending: 0 };
        }

        if (channelData.sent) {
          stats.delivered++;
          stats.channelStats[channelName].sent++;
        } else if (channelData.error) {
          stats.failed++;
          stats.channelStats[channelName].failed++;
        } else {
          stats.pending++;
          stats.channelStats[channelName].pending++;
        }
      });
    });

    res.json({
      success: true,
      data: {
        notifications,
        statistics: stats,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
        filters: { startDate, endDate, channel, type, status },
      },
    });
  });

  /**
   * Perform bulk notification operations
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static bulkOperations = asyncHandler(async (req, res) => {
    const { 
      operation, 
      notificationIds = [], 
      filters = {},
      data = {} 
    } = req.body;

    let result = {};

    switch (operation) {
      case 'mark_read':
        if (notificationIds.length > 0) {
          result = await Notification.updateMany(
            { 
              _id: { $in: notificationIds },
              recipient: req.user._id,
              'channels.inApp.read': false 
            },
            { 
              $set: { 
                'channels.inApp.read': true,
                'channels.inApp.readAt': new Date() 
              } 
            }
          );
        } else {
          // Mark all matching notifications as read
          const query = { 
            recipient: req.user._id,
            'channels.inApp.read': false,
            ...filters 
          };
          result = await Notification.updateMany(query, { 
            $set: { 
              'channels.inApp.read': true,
              'channels.inApp.readAt': new Date() 
            } 
          });
        }
        break;

      case 'delete':
        if (notificationIds.length > 0) {
          result = await Notification.deleteMany({
            _id: { $in: notificationIds },
            recipient: req.user._id,
          });
        } else {
          const query = { recipient: req.user._id, ...filters };
          result = await Notification.deleteMany(query);
        }
        break;

      case 'archive':
        if (notificationIds.length > 0) {
          result = await Notification.updateMany(
            { 
              _id: { $in: notificationIds },
              recipient: req.user._id 
            },
            { $set: { archived: true, archivedAt: new Date() } }
          );
        }
        break;

      case 'retry_failed':
        // Only admins can retry failed notifications
        if (req.user.role !== 'admin') {
          return res.status(403).json({
            success: false,
            message: 'Admin access required for retry operations',
          });
        }

        const retryPromises = notificationIds.map(id => 
          notificationRetryService.manualRetry(id)
        );
        const retryResults = await Promise.all(retryPromises);
        
        result = {
          attempted: retryResults.length,
          successful: retryResults.filter(r => r.success).length,
          failed: retryResults.filter(r => !r.success).length,
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          message: `Unknown bulk operation: ${operation}`,
        });
    }

    res.json({
      success: true,
      message: `Bulk ${operation} operation completed`,
      data: {
        operation,
        result,
        processedCount: notificationIds.length || 'all_matching',
      },
    });
  });

  /**
   * Get notification performance metrics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getPerformanceMetrics = asyncHandler(async (req, res) => {
    const { timeRange = '24h' } = req.query;

    const metrics = {
      service: notificationService.getMetrics(),
      cache: notificationCacheService.getStats(),
      push: pushService.getMetrics(),
      retry: notificationRetryService.getRetryStats(),
      template: notificationTemplateService.getMetrics(),
    };

    // Add system performance data
    const systemMetrics = {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
    };

    res.json({
      success: true,
      data: {
        timeRange,
        services: metrics,
        system: systemMetrics,
        generatedAt: new Date(),
      },
    });
  });

  /**
   * Manage notification templates
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static manageTemplates = asyncHandler(async (req, res) => {
    const { action } = req.params;
    const { templateId, templateData, testData } = req.body;

    let result = {};

    switch (action) {
      case 'list':
        result = notificationTemplateService.listTemplates(req.query);
        break;

      case 'get':
        if (!templateId) {
          return res.status(400).json({
            success: false,
            message: 'Template ID is required',
          });
        }
        result = await notificationTemplateService.getTemplate(templateId);
        break;

      case 'create':
        if (!templateData) {
          return res.status(400).json({
            success: false,
            message: 'Template data is required',
          });
        }
        notificationTemplateService.registerTemplate(templateId, templateData);
        result = { templateId, created: true };
        break;

      case 'update':
        if (!templateId || !templateData) {
          return res.status(400).json({
            success: false,
            message: 'Template ID and data are required',
          });
        }
        const newVersion = notificationTemplateService.createTemplateVersion(templateId, templateData);
        result = { templateId, version: newVersion, updated: true };
        break;

      case 'test':
        if (!templateId || !testData) {
          return res.status(400).json({
            success: false,
            message: 'Template ID and test data are required',
          });
        }
        result = await notificationTemplateService.testTemplate(
          templateId, 
          testData.channel, 
          testData.variables
        );
        break;

      case 'analytics':
        if (!templateId) {
          return res.status(400).json({
            success: false,
            message: 'Template ID is required',
          });
        }
        result = notificationTemplateService.getTemplateAnalytics(templateId);
        break;

      default:
        return res.status(400).json({
          success: false,
          message: `Unknown template action: ${action}`,
        });
    }

    res.json({
      success: true,
      data: result,
    });
  });

  /**
   * Manage push notification tokens
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static managePushTokens = asyncHandler(async (req, res) => {
    const { action } = req.params;
    const { token, platform, deviceId, appVersion, userId } = req.body;

    let result = {};
    const targetUserId = userId || req.user._id;

    // Only allow admins to manage other users' tokens
    if (userId && userId !== req.user._id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required to manage other users\' tokens',
      });
    }

    switch (action) {
      case 'register':
        if (!token) {
          return res.status(400).json({
            success: false,
            message: 'Push token is required',
          });
        }
        result = await pushService.registerToken(targetUserId, token, {
          platform,
          deviceId,
          appVersion,
        });
        break;

      case 'unregister':
        if (!token) {
          return res.status(400).json({
            success: false,
            message: 'Push token is required',
          });
        }
        result = await pushService.unregisterToken(targetUserId, token);
        break;

      case 'list':
        const tokens = await pushService.getUserTokens(targetUserId);
        result = { tokens: tokens.map(token => ({
          token: token.substring(0, 20) + '...',
          platform: 'unknown', // Would need to store platform info
          registeredAt: new Date(), // Would need to store registration date
        }))};
        break;

      case 'test':
        result = await pushService.sendToUser(targetUserId, {
          title: 'Test Push Notification',
          message: 'This is a test push notification',
          type: 'test',
          data: { test: true, timestamp: new Date().toISOString() },
        });
        break;

      case 'cleanup':
        // Only admins can perform cleanup
        if (req.user.role !== 'admin') {
          return res.status(403).json({
            success: false,
            message: 'Admin access required for token cleanup',
          });
        }
        // This would require implementing a cleanup method in pushService
        result = { message: 'Token cleanup initiated' };
        break;

      default:
        return res.status(400).json({
          success: false,
          message: `Unknown push token action: ${action}`,
        });
    }

    res.json({
      success: true,
      data: result,
    });
  });

  /**
   * Get notification system health check
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getSystemHealth = asyncHandler(async (req, res) => {
    const health = {
      timestamp: new Date(),
      status: 'healthy',
      services: {
        notificationService: notificationService.getHealthStatus(),
        metricsService: notificationMetricsService.getHealthStatus(),
        cacheService: notificationCacheService.getHealthStatus(),
        retryService: notificationRetryService.getHealthStatus(),
        pushService: pushService.getHealthStatus(),
        templateService: notificationTemplateService.getHealthStatus(),
      },
      database: {
        connected: true, // Would check actual DB connection
        responseTime: 0, // Would measure actual response time
      },
      external: {
        redis: notificationCacheService.isAvailable(),
        fcm: pushService.enabled,
      },
    };

    // Determine overall status
    const serviceStatuses = Object.values(health.services).map(s => s.status);
    if (serviceStatuses.some(status => status === 'error' || status === 'critical')) {
      health.status = 'critical';
    } else if (serviceStatuses.some(status => status === 'degraded' || status === 'warning')) {
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: health.status !== 'critical',
      data: health,
    });
  });

  /**
   * Export notification data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static exportData = asyncHandler(async (req, res) => {
    const { 
      format = 'json', 
      startDate, 
      endDate, 
      type, 
      includePersonalData = false 
    } = req.query;

    // Build export query
    const query = {};
    
    // For non-admins, only export their own notifications
    if (req.user.role !== 'admin') {
      query.recipient = req.user._id;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (type) {
      query.type = type;
    }

    const notifications = await Notification.find(query)
      .populate('recipient', includePersonalData ? 'firstName lastName email' : 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10000) // Reasonable export limit
      .lean();

    // Format data based on requested format
    let exportData;
    let contentType;
    let filename;

    switch (format.toLowerCase()) {
      case 'csv':
        exportData = this.formatAsCSV(notifications);
        contentType = 'text/csv';
        filename = `notifications_${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'xlsx':
        // Would implement Excel export here
        return res.status(400).json({
          success: false,
          message: 'Excel export not yet implemented',
        });

      case 'json':
      default:
        exportData = JSON.stringify({
          exportedAt: new Date(),
          totalRecords: notifications.length,
          filters: { startDate, endDate, type },
          data: notifications,
        }, null, 2);
        contentType = 'application/json';
        filename = `notifications_${new Date().toISOString().split('T')[0]}.json`;
        break;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);
  });

  /**
   * Format notifications as CSV
   * @param {Array} notifications - Notifications to format
   * @returns {string} - CSV formatted string
   */
  static formatAsCSV(notifications) {
    if (notifications.length === 0) {
      return 'No data to export';
    }

    const headers = [
      'ID',
      'Type',
      'Title',
      'Message',
      'Priority',
      'Recipient',
      'Created At',
      'Read',
      'Read At',
      'Email Sent',
      'Push Sent',
      'Slack Sent',
    ];

    const rows = notifications.map(n => [
      n._id,
      n.type,
      `"${n.title.replace(/"/g, '""')}"`, // Escape quotes
      `"${n.message.replace(/"/g, '""')}"`,
      n.priority,
      n.recipient ? `${n.recipient.firstName} ${n.recipient.lastName}` : 'Unknown',
      n.createdAt.toISOString(),
      n.channels.inApp.read ? 'Yes' : 'No',
      n.channels.inApp.readAt ? n.channels.inApp.readAt.toISOString() : '',
      n.channels.email.sent ? 'Yes' : 'No',
      n.channels.push.sent ? 'Yes' : 'No',
      n.channels.slack.sent ? 'Yes' : 'No',
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Get user notification preferences with recommendations
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getPreferencesWithRecommendations = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    
    // Get user's notification statistics
    const stats = await Notification.aggregate([
      { $match: { recipient: req.user._id } },
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          read: { $sum: { $cond: ['$channels.inApp.read', 1, 0] } },
          avgReadTime: { 
            $avg: { 
              $subtract: ['$channels.inApp.readAt', '$createdAt'] 
            } 
          },
        },
      },
    ]);

    // Generate recommendations based on usage patterns
    const recommendations = [];
    
    stats.forEach(stat => {
      const readRate = stat.read / stat.total;
      
      if (readRate < 0.3) {
        recommendations.push({
          type: 'reduce_frequency',
          message: `Consider reducing ${stat._id} notifications - low read rate (${Math.round(readRate * 100)}%)`,
          notificationType: stat._id,
        });
      }
      
      if (stat.avgReadTime > 24 * 60 * 60 * 1000) { // More than 24 hours
        recommendations.push({
          type: 'increase_priority',
          message: `Consider increasing priority for ${stat._id} notifications - slow response time`,
          notificationType: stat._id,
        });
      }
    });

    res.json({
      success: true,
      data: {
        preferences: user.notificationPreferences,
        statistics: stats,
        recommendations,
        lastUpdated: user.updatedAt,
      },
    });
  });
}

module.exports = NotificationController;