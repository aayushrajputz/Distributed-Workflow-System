const Notification = require('../models/Notification');
const User = require('../models/User');
const emailService = require('./emailService');
const pushService = require('./pushService');

class NotificationService {
  constructor() {
    this.io = null; // Will be set when WebSocket is initialized
    this.slackWebhooks = new Map();
  }

  // Initialize with Socket.io instance
  initialize(socketIo) {
    this.io = socketIo;
    console.log('📡 Notification Service initialized with WebSocket support');
  }

  // Main method to send notifications across all channels
  async sendNotification(notificationData) {
    try {
      // Create notification record
      const notification = await Notification.create(notificationData);

      // Get recipient preferences
      const recipient = await User.findById(notificationData.recipient);
      if (!recipient) {
        throw new Error('Recipient not found');
      }

      const promises = [];

      // Send in-app notification (always enabled)
      promises.push(this.sendInAppNotification(notification, recipient));

      // Send email notification if enabled
      if (recipient.notificationPreferences.email[notification.type]) {
        promises.push(this.sendEmailNotification(notification, recipient));
      }

      // Send Slack notification if enabled (REAL implementation)
      if (recipient.notificationPreferences?.slack?.enabled
          && recipient.notificationPreferences.slack[notification.type]
          && recipient.notificationPreferences.slack.webhookUrl) {
        promises.push(this.sendSlackNotification(notification, recipient));
      }

      // Send WebSocket notification
      promises.push(this.sendWebSocketNotification(notification, recipient));

      // Send push notification if enabled
      if (recipient.notificationPreferences?.push?.enabled && recipient.notificationPreferences.push[notification.type] !== false) {
        const tokens = (recipient.notificationPreferences.push.devices || []).map(d => d.token).filter(Boolean);
        if (tokens.length > 0) {
          promises.push(this.sendPushNotification(notification, recipient, tokens));
        }
      }

      // Execute all notifications
      await Promise.allSettled(promises);

      return notification;
    } catch (error) {
      console.error('❌ Error sending notification:', error);
      throw error;
    }
  }

  // Send Push notification
  async sendPushNotification(notification, recipient, tokens) {
    try {
      const payload = {
        title: notification.title,
        body: notification.message,
        type: notification.type,
        data: {
          taskId: notification.data?.taskId?.toString?.() || notification.data?.taskId,
        },
      };
      await pushService.sendPush(tokens, payload);
      console.log(`📲 Push notification queued to ${tokens.length} device(s) for ${recipient.email}`);
      return true;
    } catch (e) {
      console.error('❌ Error sending push notification:', e);
      return false;
    }
  }

  // Send in-app notification
  async sendInAppNotification(notification, recipient) {
    try {
      notification.channels.inApp.sent = true;
      notification.channels.inApp.sentAt = new Date();
      await notification.save();

      console.log(`📱 In-app notification sent to ${recipient.email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending in-app notification:', error);
      return false;
    }
  }

  // Send email notification (REAL implementation)
  async sendEmailNotification(notification, recipient) {
    try {
      console.log(`📧 Sending email notification to ${recipient.email} for ${notification.type}`);

      // Use the real email service
      const result = await emailService.sendNotificationEmail(notification, recipient);

      if (result.success) {
        notification.channels.email.sent = true;
        notification.channels.email.sentAt = new Date();
        notification.status = 'sent';
        await notification.save();

        console.log(`✅ Email notification sent successfully to ${recipient.email}`);
        return true;
      }
      throw new Error(result.error || 'Failed to send email');
    } catch (error) {
      console.error(`❌ Error sending email notification to ${recipient.email}:`, error);

      notification.channels.email.sent = false;
      notification.status = 'failed';
      notification.errorMessage = error.message;
      notification.retryCount = (notification.retryCount || 0) + 1;
      notification.lastRetryAt = new Date();
      await notification.save();

      return false;
    }
  }

  // Send Slack notification
  async sendSlackNotification(notification, recipient) {
    try {
      if (!recipient.notificationPreferences.slack.webhookUrl) {
        console.log('⚠️ No Slack webhook URL configured for user');
        return false;
      }

      const slackMessage = this.generateSlackMessage(notification, recipient);

      const response = await fetch(recipient.notificationPreferences.slack.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(slackMessage),
      });

      if (response.ok) {
        notification.channels.slack.sent = true;
        notification.channels.slack.sentAt = new Date();
        await notification.save();

        console.log(`💬 Slack notification sent to ${recipient.email}`);
        return true;
      }
      throw new Error(`Slack API error: ${response.status}`);
    } catch (error) {
      console.error('❌ Error sending Slack notification:', error);
      return false;
    }
  }

  // Send WebSocket notification (REAL implementation)
  async sendWebSocketNotification(notification, recipient) {
    try {
      if (!this.io) {
        console.log('⚠️ WebSocket not initialized');
        return false;
      }

      const notificationData = {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        priority: notification.priority,
        createdAt: notification.createdAt,
        read: false,
      };

      // Send to specific user room
      this.io.to(`user_${recipient._id}`).emit('notification', notificationData);

      // Also send unread count update
      const unreadCount = await this.getUnreadCount(recipient._id);
      this.io.to(`user_${recipient._id}`).emit('notification_count_update', {
        unreadCount: unreadCount,
      });

      notification.channels.websocket.sent = true;
      notification.channels.websocket.sentAt = new Date();
      notification.channels.websocket.connectionId = `user_${recipient._id}`;
      await notification.save();

      console.log(`🔔 Real-time notification sent to ${recipient.email} (unread: ${unreadCount})`);
      return true;
    } catch (error) {
      console.error('❌ Error sending WebSocket notification:', error);
      return false;
    }
  }

  // Generate email template
  generateEmailTemplate(notification, recipient) {
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    let actionUrl = `${baseUrl}/dashboard`;
    if (notification.data.taskId) {
      actionUrl = `${baseUrl}/tasks/${notification.data.taskId}`;
    }

    const priorityColors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444',
      urgent: '#dc2626',
    };

    const typeIcons = {
      task_assigned: '📋',
      task_completed: '✅',
      task_overdue: '⏰',
      task_escalated: '🚨',
      workflow_completed: '🎉',
    };

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${notification.title}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">
          ${typeIcons[notification.type] || '📢'} ${notification.title}
        </h1>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hi ${recipient.firstName},</p>
        
        <p style="font-size: 16px; margin-bottom: 25px;">${notification.message}</p>
        
        ${notification.data.taskId ? `
        <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${priorityColors[notification.priority]}; margin-bottom: 25px;">
          <h3 style="margin: 0 0 10px 0; color: #2d3748;">Task Details</h3>
          ${notification.data.projectName ? `<p style="margin: 5px 0;"><strong>Project:</strong> ${notification.data.projectName}</p>` : ''}
          ${notification.data.priority ? `<p style="margin: 5px 0;"><strong>Priority:</strong> <span style="color: ${priorityColors[notification.data.priority]}; font-weight: bold; text-transform: uppercase;">${notification.data.priority}</span></p>` : ''}
          ${notification.data.dueDate ? `<p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(notification.data.dueDate).toLocaleDateString()}</p>` : ''}
        </div>
        ` : ''}
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${actionUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            View Task
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
        
        <p style="font-size: 14px; color: #6c757d; text-align: center; margin: 0;">
          This is an automated notification from your Workflow Management System.<br>
          <a href="${baseUrl}/settings/notifications" style="color: #667eea;">Manage notification preferences</a>
        </p>
      </div>
    </body>
    </html>
    `;

    const text = `
    ${notification.title}
    
    Hi ${recipient.firstName},
    
    ${notification.message}
    
    ${notification.data.projectName ? `Project: ${notification.data.projectName}` : ''}
    ${notification.data.priority ? `Priority: ${notification.data.priority.toUpperCase()}` : ''}
    ${notification.data.dueDate ? `Due Date: ${new Date(notification.data.dueDate).toLocaleDateString()}` : ''}
    
    View task: ${actionUrl}
    
    ---
    This is an automated notification from your Workflow Management System.
    Manage preferences: ${baseUrl}/settings/notifications
    `;

    return {
      subject: notification.title,
      html,
      text,
    };
  }

  // Generate Slack message
  generateSlackMessage(notification, recipient) {
    const priorityEmojis = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      urgent: '🔴',
    };

    const typeEmojis = {
      task_assigned: '📋',
      task_completed: '✅',
      task_overdue: '⏰',
      task_escalated: '🚨',
      workflow_completed: '🎉',
    };

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${typeEmojis[notification.type] || '📢'} ${notification.title}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: notification.message,
        },
      },
    ];

    // Add task details if available
    if (notification.data.taskId) {
      const fields = [];

      if (notification.data.projectName) {
        fields.push({
          type: 'mrkdwn',
          text: `*Project:*\n${notification.data.projectName}`,
        });
      }

      if (notification.data.priority) {
        fields.push({
          type: 'mrkdwn',
          text: `*Priority:*\n${priorityEmojis[notification.data.priority]} ${notification.data.priority.toUpperCase()}`,
        });
      }

      if (notification.data.dueDate) {
        fields.push({
          type: 'mrkdwn',
          text: `*Due Date:*\n${new Date(notification.data.dueDate).toLocaleDateString()}`,
        });
      }

      if (fields.length > 0) {
        blocks.push({
          type: 'section',
          fields: fields,
        });
      }
    }

    // Add action button
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    let actionUrl = `${baseUrl}/dashboard`;
    if (notification.data.taskId) {
      actionUrl = `${baseUrl}/tasks/${notification.data.taskId}`;
    }

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Task',
          },
          url: actionUrl,
          style: 'primary',
        },
      ],
    });

    return {
      text: notification.title,
      blocks: blocks,
    };
  }

  // Get notifications for user
  async getNotificationsForUser(userId, options = {}) {
    const {
      limit = 20,
      offset = 0,
      unreadOnly = false,
      type = null,
    } = options;

    const filter = {
      recipient: userId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    };

    if (unreadOnly) {
      filter['channels.inApp.read'] = false;
    }

    if (type) {
      filter.type = type;
    }

    const notifications = await Notification.find(filter)
      .populate('sender', 'firstName lastName email avatar')
      .populate('data.taskId', 'title status priority')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.getUnreadCount(userId);

    return {
      notifications,
      total,
      unreadCount,
      hasMore: offset + limit < total,
    };
  }

  // Mark notifications as read
  async markAsRead(userId, notificationIds = []) {
    return Notification.markAsRead(userId, notificationIds);
  }

  // Mark all notifications as read for user
  async markAllAsRead(userId) {
    return Notification.markAsRead(userId);
  }

  // Delete notification
  async deleteNotification(notificationId, userId) {
    return Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isActive: false },
      { new: true },
    );
  }

  // Get unread notification count for user (REAL implementation)
  async getUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        recipient: userId,
        'channels.inApp.read': false,
        isActive: true,
        expiresAt: { $gt: new Date() },
      });
      return count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Clean up expired notifications (run periodically)
  async cleanupExpiredNotifications() {
    const result = await Notification.cleanupExpired();
    console.log(`🧹 Cleaned up ${result.deletedCount} expired notifications`);
    return result;
  }

  // Get notification statistics
  async getNotificationStats(userId) {
    const pipeline = [
      { $match: { recipient: userId, isActive: true } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          unread: {
            $sum: {
              $cond: [{ $eq: ['$channels.inApp.read', false] }, 1, 0],
            },
          },
        },
      },
    ];

    const stats = await Notification.aggregate(pipeline);
    return stats;
  }
}

// Export singleton instance
const notificationService = new NotificationService();
module.exports = notificationService;
