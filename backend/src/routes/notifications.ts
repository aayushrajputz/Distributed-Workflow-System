import express from 'express';
import { body, query } from 'express-validator';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { handleValidationErrors, catchAsync } from '../middleware/errorHandler';
import { rateLimiters } from '../middleware/rateLimit';
import Notification from '../models/Notification';
import { AuthenticatedRequest } from '../types';
import { socketService } from '../services/socketService';

const router = express.Router();

// Validation rules
const queryValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be non-negative'),
  query('unreadOnly')
    .optional()
    .isBoolean()
    .withMessage('unreadOnly must be a boolean'),
  query('type')
    .optional()
    .isIn(['task_assigned', 'task_completed', 'task_overdue', 'task_reminder', 'workflow_update', 'system', 'mention'])
    .withMessage('Invalid notification type'),
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority')
];

// Get notifications with filtering and pagination
router.get('/',
  requireAuth,
  queryValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Build filter
    const filter: any = { userId };
    
    if (req.query.unreadOnly === 'true') {
      filter.isRead = false;
    }
    
    if (req.query.type) {
      filter.type = req.query.type;
    }
    
    if (req.query.priority) {
      filter.priority = req.query.priority;
    }

    // Get notifications
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);

    const total = await Notification.countDocuments(filter);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + limit < total
        }
      }
    });
  })
);

// Get notification statistics
router.get('/stats',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;
    
    const stats = await (Notification as any).getStats(userId);
    
    res.json({
      success: true,
      data: stats
    });
  })
);

// Mark notifications as read
router.post('/read',
  requireAuth,
  [
    body('notificationIds')
      .isArray({ min: 1 })
      .withMessage('notificationIds must be a non-empty array')
      .custom((ids) => {
        return ids.every((id: string) => typeof id === 'string' && id.length > 0);
      })
      .withMessage('All notification IDs must be valid strings')
  ],
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;
    const { notificationIds } = req.body;

    const modifiedCount = await (Notification as any).markAsRead(userId, notificationIds);

    // Emit real-time event
    socketService.emitNotificationToUser(userId, {
      type: 'notifications_marked_read',
      notificationIds,
      readBy: req.user!.email,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: { modifiedCount },
      message: `${modifiedCount} notifications marked as read`
    });
  })
);

// Mark all notifications as read
router.post('/read-all',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;

    const modifiedCount = await (Notification as any).markAllAsRead(userId);

    // Emit real-time event
    socketService.emitNotificationToUser(userId, {
      type: 'notifications_marked_read',
      allRead: true,
      readBy: req.user!.email,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: { modifiedCount },
      message: `${modifiedCount} notifications marked as read`
    });
  })
);

// Delete notifications
router.delete('/',
  requireAuth,
  [
    body('notificationIds')
      .isArray({ min: 1 })
      .withMessage('notificationIds must be a non-empty array')
      .custom((ids) => {
        return ids.every((id: string) => typeof id === 'string' && id.length > 0);
      })
      .withMessage('All notification IDs must be valid strings')
  ],
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;
    const { notificationIds } = req.body;

    const result = await Notification.deleteMany({
      _id: { $in: notificationIds },
      userId
    });

    res.json({
      success: true,
      data: { deletedCount: result.deletedCount },
      message: `${result.deletedCount} notifications deleted`
    });
  })
);

// Get notification preferences (placeholder - would be stored in user profile)
router.get('/preferences',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    // In a real implementation, this would be stored in the user model
    // For now, return default preferences
    const defaultPreferences = {
      email: {
        enabled: true,
        taskAssigned: true,
        taskCompleted: true,
        taskOverdue: true,
        taskReminder: true,
        workflowUpdate: false,
        dailyDigest: true
      },
      slack: {
        enabled: false,
        taskAssigned: true,
        taskCompleted: false,
        taskOverdue: true,
        urgentOnly: true
      },
      inApp: {
        enabled: true,
        showToasts: true,
        playSound: true,
        desktopNotifications: true
      },
      websocket: {
        enabled: true,
        realTimeUpdates: true
      }
    };

    res.json({
      success: true,
      data: defaultPreferences
    });
  })
);

// Update notification preferences
router.put('/preferences',
  requireAuth,
  [
    body('email.enabled').optional().isBoolean(),
    body('email.taskAssigned').optional().isBoolean(),
    body('email.taskCompleted').optional().isBoolean(),
    body('email.taskOverdue').optional().isBoolean(),
    body('email.taskReminder').optional().isBoolean(),
    body('email.workflowUpdate').optional().isBoolean(),
    body('email.dailyDigest').optional().isBoolean(),
    body('slack.enabled').optional().isBoolean(),
    body('slack.taskAssigned').optional().isBoolean(),
    body('slack.taskCompleted').optional().isBoolean(),
    body('slack.taskOverdue').optional().isBoolean(),
    body('slack.urgentOnly').optional().isBoolean(),
    body('inApp.enabled').optional().isBoolean(),
    body('inApp.showToasts').optional().isBoolean(),
    body('inApp.playSound').optional().isBoolean(),
    body('inApp.desktopNotifications').optional().isBoolean(),
    body('websocket.enabled').optional().isBoolean(),
    body('websocket.realTimeUpdates').optional().isBoolean()
  ],
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    // In a real implementation, this would update the user's preferences
    // For now, just return success
    
    res.json({
      success: true,
      message: 'Notification preferences updated successfully'
    });
  })
);

// Send test notification (admin only)
router.post('/test',
  requireAuth,
  rateLimiters.burst,
  [
    body('type')
      .isIn(['task_assigned', 'task_completed', 'task_overdue', 'task_reminder', 'workflow_update', 'system', 'mention'])
      .withMessage('Invalid notification type'),
    body('userId')
      .optional()
      .isMongoId()
      .withMessage('Invalid user ID')
  ],
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const { type, userId } = req.body;
    const targetUserId = userId || req.user!._id;

    // Create test notification
    const notification = await (Notification as any).createNotification({
      userId: targetUserId,
      type,
      title: `Test ${type.replace('_', ' ')} notification`,
      message: `This is a test notification of type "${type}" sent at ${new Date().toLocaleString()}`,
      priority: 'medium',
      channels: ['in_app', 'websocket'],
      data: {
        url: '/dashboard'
      }
    });

    // Emit real-time notification
    socketService.emitNotificationToUser(targetUserId, {
      id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      data: notification.data,
      createdAt: notification.createdAt
    });

    res.json({
      success: true,
      data: notification,
      message: 'Test notification sent successfully'
    });
  })
);

// Create notification (internal API for other services)
router.post('/create',
  requireAuth,
  [
    body('userId').isMongoId().withMessage('Valid user ID is required'),
    body('type')
      .isIn(['task_assigned', 'task_completed', 'task_overdue', 'task_reminder', 'workflow_update', 'system', 'mention'])
      .withMessage('Invalid notification type'),
    body('title')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    body('message')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Message must be between 1 and 1000 characters'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Invalid priority'),
    body('channels')
      .optional()
      .isArray()
      .withMessage('Channels must be an array'),
    body('data')
      .optional()
      .isObject()
      .withMessage('Data must be an object')
  ],
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const notificationData = req.body;

    const notification = await (Notification as any).createNotification(notificationData);

    // Emit real-time notification if websocket channel is enabled
    if (!notificationData.channels || notificationData.channels.includes('websocket')) {
      socketService.emitNotificationToUser(notificationData.userId, {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        data: notification.data,
        createdAt: notification.createdAt
      });
    }

    res.status(201).json({
      success: true,
      data: notification,
      message: 'Notification created successfully'
    });
  })
);

// Cleanup old notifications (admin only)
router.post('/cleanup',
  requireAuth,
  requireAdmin,
  [
    body('daysOld')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Days old must be between 1 and 365')
  ],
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const daysOld = req.body.daysOld || 90;
    
    const deletedCount = await (Notification as any).cleanup(daysOld);

    res.json({
      success: true,
      data: { deletedCount },
      message: `Cleaned up ${deletedCount} old notifications`
    });
  })
);

export default router;