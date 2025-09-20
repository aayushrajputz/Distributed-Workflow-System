const express = require('express');
const { body, query, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const notificationService = require('../services/notificationService');
const notificationMetricsService = require('../services/notificationMetricsService');
const notificationTemplateService = require('../services/notificationTemplateService');
const pushService = require('../services/pushService');
const Notification = require('../models/Notification');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const {
  notificationSend,
  bulkNotification,
  systemAnnouncement,
  preferencesUpdate,
  tokenRegistration,
  notificationRead,
  getRateLimitStatus,
} = require('../middleware/notificationRateLimit');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Validation for notification queries
const getNotificationsValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  query('unreadOnly')
    .optional()
    .isBoolean()
    .withMessage('unreadOnly must be a boolean'),
  query('type')
    .optional()
    .isIn(['task_assigned', 'task_completed', 'task_overdue', 'task_escalated', 'task_updated', 'workflow_completed'])
    .withMessage('Invalid notification type'),
];

// Validation for marking notifications as read
const markAsReadValidation = [
  body('notificationIds')
    .optional()
    .isArray()
    .withMessage('notificationIds must be an array'),
  body('notificationIds.*')
    .optional()
    .isMongoId()
    .withMessage('Each notification ID must be a valid MongoDB ObjectId'),
];

// @desc    Get notifications for authenticated user
// @route   GET /api/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
  const {
    limit = 20,
    offset = 0,
    unreadOnly = false,
    type = null,
  } = req.query;

  const result = await notificationService.getNotificationsForUser(req.user._id, {
    limit: parseInt(limit),
    offset: parseInt(offset),
    unreadOnly: unreadOnly === 'true',
    type,
  });

  res.json({
    success: true,
    data: result.notifications,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      total: result.total,
      hasMore: result.hasMore,
    },
    unreadCount: result.unreadCount,
  });
});

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await Notification.getUnreadCount(req.user._id);

  res.json({
    success: true,
    data: {
      unreadCount,
    },
  });
});

// @desc    Mark notifications as read
// @route   POST /api/notifications/mark-read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
  const { notificationIds = [] } = req.body;

  const result = await notificationService.markAsRead(req.user._id, notificationIds);

  res.json({
    success: true,
    message: notificationIds.length > 0
      ? `${notificationIds.length} notifications marked as read`
      : 'All notifications marked as read',
    data: {
      modifiedCount: result.modifiedCount,
    },
  });
});

// @desc    Mark all notifications as read
// @route   POST /api/notifications/mark-all-read
// @access  Private
const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllAsRead(req.user._id);

  res.json({
    success: true,
    message: 'All notifications marked as read',
    data: {
      modifiedCount: result.modifiedCount,
    },
  });
});

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await notificationService.deleteNotification(req.params.id, req.user._id);

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found',
    });
  }

  res.json({
    success: true,
    message: 'Notification deleted successfully',
  });
});

// @desc    Get notification statistics
// @route   GET /api/notifications/stats
// @access  Private
const getNotificationStats = asyncHandler(async (req, res) => {
  const stats = await notificationService.getNotificationStats(req.user._id);

  res.json({
    success: true,
    data: stats,
  });
});

// @desc    Update notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const { email, slack, inApp } = req.body;

  const { user } = req;

  if (email) {
    Object.assign(user.notificationPreferences.email, email);
  }

  if (slack) {
    Object.assign(user.notificationPreferences.slack, slack);
  }

  if (inApp) {
    Object.assign(user.notificationPreferences.inApp, inApp);
  }

  await user.save();

  res.json({
    success: true,
    message: 'Notification preferences updated successfully',
    data: {
      notificationPreferences: user.notificationPreferences,
    },
  });
});

// @desc    Get notification preferences
// @route   GET /api/notifications/preferences
// @access  Private
const getNotificationPreferences = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      notificationPreferences: req.user.notificationPreferences,
    },
  });
});

// @desc    Test notification (for development/admin)
// @route   POST /api/notifications/test
// @access  Private (Admin only)
const testNotification = asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }

  const {
    type = 'system_alert', title, message, priority = 'medium',
  } = req.body;

  const notification = await notificationService.sendNotification({
    recipient: req.user._id,
    type,
    title: title || 'Test Notification',
    message: message || 'This is a test notification from the system.',
    priority,
  });

  res.json({
    success: true,
    message: 'Test notification sent successfully',
    data: notification,
  });
});

// Enhanced validation schemas
const broadcastValidation = [
  body('title').notEmpty().withMessage('Title is required'),
  body('message').notEmpty().withMessage('Message is required'),
  body('type').optional().isIn(['system_announcement', 'maintenance', 'feature_update', 'security_alert']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('recipients').optional().isArray().withMessage('Recipients must be an array'),
  body('channels').optional().isObject().withMessage('Channels must be an object'),
];

const pushTokenValidation = [
  body('token').notEmpty().withMessage('Push token is required'),
  body('platform').optional().isIn(['web', 'ios', 'android']),
  body('deviceId').optional().isString(),
  body('appVersion').optional().isString(),
];

const templateTestValidation = [
  param('templateId').notEmpty().withMessage('Template ID is required'),
  body('channel').isIn(['inApp', 'email', 'push', 'slack']).withMessage('Valid channel required'),
  body('variables').optional().isObject().withMessage('Variables must be an object'),
];

// @desc    Send bulk notifications (Admin/Manager only)
// @route   POST /api/notifications/broadcast
// @access  Private (Admin/Manager)
const broadcastNotification = asyncHandler(async (req, res) => {
  const { title, message, type = 'system_announcement', priority = 'medium', recipients, channels } = req.body;

  let targetRecipients = recipients;

  // If no specific recipients, broadcast to all active users
  if (!recipients || recipients === 'all') {
    const users = await User.find({ isActive: true }).select('_id');
    targetRecipients = users.map(user => user._id.toString());
  }

  const result = await notificationService.sendBulkNotifications(targetRecipients, {
    title,
    message,
    type,
    priority,
    channels,
  });

  res.json({
    success: true,
    message: `Broadcast notification sent to ${result.sent} users`,
    data: {
      sent: result.sent,
      failed: result.failed,
      totalRecipients: targetRecipients.length,
    },
  });
});

// @desc    Get notification analytics dashboard
// @route   GET /api/notifications/analytics
// @access  Private (Admin/Manager)
const getNotificationAnalytics = asyncHandler(async (req, res) => {
  const { timeRange = '7d' } = req.query;

  const analytics = await notificationMetricsService.getDashboardMetrics();

  res.json({
    success: true,
    data: {
      ...analytics,
      timeRange,
      generatedAt: new Date(),
    },
  });
});

// @desc    Get delivery status for notification
// @route   GET /api/notifications/:id/delivery-status
// @access  Private
const getDeliveryStatus = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipient: req.user._id,
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found',
    });
  }

  res.json({
    success: true,
    data: {
      notificationId: notification._id,
      channels: notification.channels,
      createdAt: notification.createdAt,
      deliveryStatus: {
        inApp: notification.channels.inApp.sent,
        email: notification.channels.email.sent,
        push: notification.channels.push.sent,
        websocket: notification.channels.websocket.sent,
        slack: notification.channels.slack.sent,
      },
      readStatus: {
        read: notification.channels.inApp.read,
        readAt: notification.channels.inApp.readAt,
      },
    },
  });
});

// @desc    Register push notification token
// @route   POST /api/notifications/push/register
// @access  Private
const registerPushToken = asyncHandler(async (req, res) => {
  const { token, platform = 'web', deviceId, appVersion } = req.body;

  const result = await pushService.registerToken(req.user._id, token, {
    platform,
    deviceId,
    appVersion,
  });

  if (!result) {
    return res.status(400).json({
      success: false,
      message: 'Failed to register push token',
    });
  }

  res.json({
    success: true,
    message: 'Push token registered successfully',
    data: {
      token: token.substring(0, 20) + '...',
      platform,
      registeredAt: new Date(),
    },
  });
});

// @desc    Unregister push notification token
// @route   DELETE /api/notifications/push/unregister
// @access  Private
const unregisterPushToken = asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Push token is required',
    });
  }

  const result = await pushService.unregisterToken(req.user._id, token);

  res.json({
    success: true,
    message: result ? 'Push token unregistered successfully' : 'Push token not found',
  });
});

// @desc    Test push notification
// @route   POST /api/notifications/push/test
// @access  Private
const testPushNotification = asyncHandler(async (req, res) => {
  const result = await pushService.sendToUser(req.user._id, {
    title: 'Test Push Notification',
    message: 'This is a test push notification from the system',
    type: 'test',
    data: {
      test: true,
      timestamp: new Date().toISOString(),
    },
  });

  res.json({
    success: result.success,
    message: result.success ? 'Test push notification sent' : 'Failed to send push notification',
    data: result,
  });
});

// @desc    Get notification templates
// @route   GET /api/notifications/templates
// @access  Private (Admin/Manager)
const getNotificationTemplates = asyncHandler(async (req, res) => {
  const { category, channel } = req.query;

  const templates = notificationTemplateService.listTemplates({
    category,
    channel,
    isActive: true,
  });

  res.json({
    success: true,
    data: templates,
  });
});

// @desc    Test notification template
// @route   POST /api/notifications/templates/:templateId/test
// @access  Private (Admin)
const testNotificationTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { channel, variables = {} } = req.body;

  const result = await notificationTemplateService.testTemplate(templateId, channel, variables);

  res.json({
    success: result.success,
    message: result.success ? 'Template test successful' : 'Template test failed',
    data: result,
  });
});

// @desc    Get rate limit status
// @route   GET /api/notifications/rate-limit-status
// @access  Private
const getRateLimitStatusEndpoint = asyncHandler(async (req, res) => {
  const { type = 'notification_send' } = req.query;

  const status = await getRateLimitStatus(req.user._id, type);

  res.json({
    success: true,
    data: {
      type,
      ...status,
    },
  });
});

// @desc    Get notification system health
// @route   GET /api/notifications/health
// @access  Private (Admin)
const getNotificationHealth = asyncHandler(async (req, res) => {
  const health = {
    notificationService: notificationService.getHealthStatus(),
    metricsService: notificationMetricsService.getHealthStatus(),
    templateService: notificationTemplateService.getHealthStatus(),
    pushService: pushService.getHealthStatus(),
  };

  const overallStatus = Object.values(health).every(service => 
    service.status === 'healthy' || service.status === 'ready'
  ) ? 'healthy' : 'degraded';

  res.json({
    success: true,
    data: {
      status: overallStatus,
      timestamp: new Date(),
      services: health,
    },
  });
});

// @desc    Bulk update notification preferences
// @route   PUT /api/notifications/preferences/bulk
// @access  Private (Admin)
const bulkUpdatePreferences = asyncHandler(async (req, res) => {
  const { userIds, preferences } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'User IDs array is required',
    });
  }

  const result = await User.updateMany(
    { _id: { $in: userIds } },
    { $set: { notificationPreferences: preferences } }
  );

  res.json({
    success: true,
    message: `Updated notification preferences for ${result.modifiedCount} users`,
    data: {
      modifiedCount: result.modifiedCount,
      requestedCount: userIds.length,
    },
  });
});

// @desc    Export notification data
// @route   GET /api/notifications/export
// @access  Private (Admin)
const exportNotificationData = asyncHandler(async (req, res) => {
  const { format = 'json', startDate, endDate } = req.query;

  const query = { recipient: req.user._id };
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(1000) // Limit export size
    .lean();

  if (format === 'csv') {
    // Convert to CSV format
    const csv = notifications.map(n => ({
      id: n._id,
      type: n.type,
      title: n.title,
      message: n.message,
      priority: n.priority,
      read: n.channels.inApp.read,
      createdAt: n.createdAt,
      readAt: n.channels.inApp.readAt,
    }));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=notifications.csv');
    
    // Simple CSV conversion (in production, use a proper CSV library)
    const csvContent = [
      Object.keys(csv[0]).join(','),
      ...csv.map(row => Object.values(row).join(','))
    ].join('\n');
    
    return res.send(csvContent);
  }

  res.json({
    success: true,
    data: {
      notifications,
      count: notifications.length,
      exportedAt: new Date(),
      format,
    },
  });
});

// Routes with rate limiting
router.get('/', notificationRead(), getNotificationsValidation, handleValidationErrors, getNotifications);
router.get('/unread-count', notificationRead(), getUnreadCount);
router.get('/stats', getNotificationStats);
router.get('/preferences', getNotificationPreferences);
// simple role-based guards using req.user.role
const requireRole = (roles) => (req, res, next) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  next();
};

router.get('/analytics', requireRole(['admin', 'manager']), getNotificationAnalytics);
router.get('/templates', requireRole(['admin', 'manager']), getNotificationTemplates);
router.get('/health', requireRole(['admin']), getNotificationHealth);
router.get('/rate-limit-status', getRateLimitStatusEndpoint);
router.get('/export', authorize(['admin']), exportNotificationData);
router.get('/:id/delivery-status', getDeliveryStatus);

router.post('/mark-read', notificationRead(), markAsReadValidation, handleValidationErrors, markAsRead);
router.post('/mark-all-read', notificationRead(), markAllAsRead);
router.post('/broadcast', requireRole(['admin', 'manager']), systemAnnouncement(), broadcastValidation, handleValidationErrors, broadcastNotification);
router.post('/test', requireRole(['admin']), notificationSend(), testNotification);
router.post('/push/register', tokenRegistration(), pushTokenValidation, handleValidationErrors, registerPushToken);
router.post('/push/test', notificationSend(), testPushNotification);
router.post('/templates/:templateId/test', requireRole(['admin']), templateTestValidation, handleValidationErrors, testNotificationTemplate);

router.put('/preferences', preferencesUpdate(), updateNotificationPreferences);
router.put('/preferences/bulk', requireRole(['admin']), bulkUpdatePreferences);

router.delete('/:id', deleteNotification);
router.delete('/push/unregister', tokenRegistration(), unregisterPushToken);

module.exports = router;
