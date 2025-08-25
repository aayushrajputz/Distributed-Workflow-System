const express = require('express');
const { body, query } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const notificationService = require('../services/notificationService');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');

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

// Routes
router.get('/', getNotificationsValidation, handleValidationErrors, getNotifications);
router.get('/unread-count', getUnreadCount);
router.get('/stats', getNotificationStats);
router.get('/preferences', getNotificationPreferences);
router.post('/mark-read', markAsReadValidation, handleValidationErrors, markAsRead);
router.post('/mark-all-read', markAllAsRead);
router.post('/test', testNotification);
router.put('/preferences', updateNotificationPreferences);
router.delete('/:id', deleteNotification);

module.exports = router;
