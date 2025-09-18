const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * Notification utility functions and helpers
 */
class NotificationHelpers {
  /**
   * Validate notification payload
   * @param {Object} payload - Notification payload
   * @returns {Object} - Validation result
   */
  static validateNotificationPayload(payload) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!payload.recipient) {
      errors.push('Recipient is required');
    }

    if (!payload.title || payload.title.trim().length === 0) {
      errors.push('Title is required and cannot be empty');
    }

    if (!payload.message || payload.message.trim().length === 0) {
      errors.push('Message is required and cannot be empty');
    }

    // Field length validations
    if (payload.title && payload.title.length > 200) {
      errors.push('Title cannot exceed 200 characters');
    }

    if (payload.message && payload.message.length > 1000) {
      warnings.push('Message is very long (>1000 characters) - consider shortening for better readability');
    }

    // Type validation
    const validTypes = [
      'task_assigned', 'task_completed', 'task_overdue', 'task_escalated', 'task_updated',
      'workflow_completed', 'workflow_failed', 'workflow_started',
      'system_announcement', 'maintenance', 'feature_update', 'security_alert',
      'user_mention', 'comment_added', 'file_shared',
      'deadline_reminder', 'meeting_reminder',
      'approval_request', 'approval_granted', 'approval_denied',
    ];

    if (payload.type && !validTypes.includes(payload.type)) {
      warnings.push(`Unknown notification type: ${payload.type}`);
    }

    // Priority validation
    const validPriorities = ['low', 'medium', 'high', 'urgent', 'critical'];
    if (payload.priority && !validPriorities.includes(payload.priority)) {
      errors.push(`Invalid priority: ${payload.priority}. Must be one of: ${validPriorities.join(', ')}`);
    }

    // Data validation
    if (payload.data && typeof payload.data !== 'object') {
      errors.push('Data field must be an object');
    }

    // Channel validation
    if (payload.channels) {
      const validChannels = ['inApp', 'email', 'push', 'websocket', 'slack'];
      const invalidChannels = Object.keys(payload.channels).filter(
        channel => !validChannels.includes(channel)
      );
      
      if (invalidChannels.length > 0) {
        warnings.push(`Unknown channels: ${invalidChannels.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedPayload: this.sanitizePayload(payload),
    };
  }

  /**
   * Sanitize notification payload
   * @param {Object} payload - Raw payload
   * @returns {Object} - Sanitized payload
   */
  static sanitizePayload(payload) {
    const sanitized = { ...payload };

    // Trim strings
    if (sanitized.title) {
      sanitized.title = sanitized.title.trim();
    }
    if (sanitized.message) {
      sanitized.message = sanitized.message.trim();
    }

    // Set defaults
    sanitized.type = sanitized.type || 'general';
    sanitized.priority = sanitized.priority || 'medium';
    sanitized.data = sanitized.data || {};

    // Remove HTML tags from title and message for security
    sanitized.title = this.stripHtml(sanitized.title);
    sanitized.message = this.stripHtml(sanitized.message);

    return sanitized;
  }

  /**
   * Strip HTML tags from string
   * @param {string} str - String to clean
   * @returns {string} - Cleaned string
   */
  static stripHtml(str) {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/<[^>]*>/g, '');
  }

  /**
   * Resolve user notification preferences
   * @param {Object} user - User object
   * @param {string} notificationType - Type of notification
   * @returns {Object} - Resolved preferences
   */
  static resolveUserPreferences(user, notificationType) {
    const defaultPreferences = {
      inApp: { enabled: true },
      email: { enabled: true },
      push: { enabled: false },
      websocket: { enabled: true },
      slack: { enabled: false, webhookUrl: null },
    };

    if (!user || !user.notificationPreferences) {
      return defaultPreferences;
    }

    const userPrefs = user.notificationPreferences;
    const resolved = { ...defaultPreferences };

    // Merge user preferences with defaults
    Object.keys(resolved).forEach(channel => {
      if (userPrefs[channel]) {
        resolved[channel] = { ...resolved[channel], ...userPrefs[channel] };
      }
    });

    // Apply type-specific overrides
    if (userPrefs.typeOverrides && userPrefs.typeOverrides[notificationType]) {
      const typeOverrides = userPrefs.typeOverrides[notificationType];
      Object.keys(typeOverrides).forEach(channel => {
        if (resolved[channel]) {
          resolved[channel] = { ...resolved[channel], ...typeOverrides[channel] };
        }
      });
    }

    // Apply quiet hours
    if (userPrefs.quietHours && this.isInQuietHours(userPrefs.quietHours, user.timezone)) {
      // Disable non-urgent notifications during quiet hours
      if (!this.isUrgentNotification(notificationType)) {
        resolved.push = { ...resolved.push, enabled: false };
        resolved.email = { ...resolved.email, enabled: false };
      }
    }

    return resolved;
  }

  /**
   * Check if current time is in user's quiet hours
   * @param {Object} quietHours - Quiet hours configuration
   * @param {string} timezone - User's timezone
   * @returns {boolean} - Is in quiet hours
   */
  static isInQuietHours(quietHours, timezone = 'UTC') {
    if (!quietHours || !quietHours.enabled) {
      return false;
    }

    try {
      const now = new Date();
      const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const currentHour = userTime.getHours();
      const currentMinute = userTime.getMinutes();
      const currentTime = currentHour * 60 + currentMinute;

      const startTime = this.parseTime(quietHours.start);
      const endTime = this.parseTime(quietHours.end);

      if (startTime <= endTime) {
        // Same day range (e.g., 22:00 to 08:00 next day)
        return currentTime >= startTime && currentTime <= endTime;
      } else {
        // Cross-midnight range (e.g., 22:00 to 08:00 next day)
        return currentTime >= startTime || currentTime <= endTime;
      }
    } catch (error) {
      console.warn('Error checking quiet hours:', error);
      return false;
    }
  }

  /**
   * Parse time string to minutes
   * @param {string} timeStr - Time string (e.g., "22:30")
   * @returns {number} - Minutes from midnight
   */
  static parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Check if notification type is urgent
   * @param {string} type - Notification type
   * @returns {boolean} - Is urgent
   */
  static isUrgentNotification(type) {
    const urgentTypes = [
      'security_alert',
      'system_critical',
      'task_escalated',
      'approval_urgent',
      'deadline_critical',
    ];
    return urgentTypes.includes(type);
  }

  /**
   * Calculate notification priority score
   * @param {Object} notification - Notification object
   * @param {Object} user - User object
   * @returns {number} - Priority score (0-100)
   */
  static calculatePriorityScore(notification, user) {
    let score = 50; // Base score

    // Priority level scoring
    const priorityScores = {
      low: 20,
      medium: 50,
      high: 75,
      urgent: 90,
      critical: 100,
    };
    score = priorityScores[notification.priority] || 50;

    // Type-based adjustments
    const typeAdjustments = {
      security_alert: +20,
      system_announcement: +10,
      task_assigned: +5,
      task_overdue: +15,
      task_escalated: +25,
      workflow_failed: +10,
      deadline_reminder: +10,
      approval_request: +15,
    };
    score += typeAdjustments[notification.type] || 0;

    // User-specific adjustments
    if (user) {
      // If user has been mentioned or is directly assigned
      if (notification.data && notification.data.assignedTo === user._id.toString()) {
        score += 10;
      }

      // If user is a manager and this affects their team
      if (user.role === 'manager' && notification.data && notification.data.teamRelated) {
        score += 5;
      }

      // Recent activity boost
      const lastLogin = user.lastLoginAt || user.createdAt;
      const hoursSinceLogin = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLogin < 1) {
        score += 5; // User is active, boost priority
      }
    }

    // Time-based adjustments
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) {
      score += 5; // Business hours boost
    } else if (hour >= 22 || hour <= 6) {
      score -= 10; // Late night/early morning reduction
    }

    // Ensure score is within bounds
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Select optimal delivery channels based on preferences and context
   * @param {Object} preferences - User preferences
   * @param {Object} notification - Notification object
   * @param {Object} context - Additional context
   * @returns {Array} - Selected channels
   */
  static selectDeliveryChannels(preferences, notification, context = {}) {
    const selectedChannels = [];

    // Always include in-app notifications if enabled
    if (preferences.inApp && preferences.inApp.enabled) {
      selectedChannels.push('inApp');
    }

    // WebSocket for real-time if user is online
    if (preferences.websocket && preferences.websocket.enabled && context.userOnline) {
      selectedChannels.push('websocket');
    }

    // Email for important notifications or if user prefers email
    if (preferences.email && preferences.email.enabled) {
      const shouldSendEmail = 
        notification.priority === 'high' || 
        notification.priority === 'urgent' || 
        notification.priority === 'critical' ||
        preferences.email.alwaysEnabled ||
        !context.userOnline; // Send email if user is offline

      if (shouldSendEmail) {
        selectedChannels.push('email');
      }
    }

    // Push notifications for mobile users
    if (preferences.push && preferences.push.enabled && context.hasPushTokens) {
      const shouldSendPush = 
        notification.priority !== 'low' ||
        preferences.push.alwaysEnabled ||
        context.isMobileUser;

      if (shouldSendPush) {
        selectedChannels.push('push');
      }
    }

    // Slack for team notifications
    if (preferences.slack && preferences.slack.enabled && preferences.slack.webhookUrl) {
      const shouldSendSlack = 
        notification.type.includes('task_') ||
        notification.type.includes('workflow_') ||
        notification.type === 'system_announcement' ||
        preferences.slack.alwaysEnabled;

      if (shouldSendSlack) {
        selectedChannels.push('slack');
      }
    }

    return selectedChannels;
  }

  /**
   * Deduplicate notifications
   * @param {Array} notifications - Array of notifications
   * @param {Object} options - Deduplication options
   * @returns {Array} - Deduplicated notifications
   */
  static deduplicateNotifications(notifications, options = {}) {
    const {
      timeWindow = 5 * 60 * 1000, // 5 minutes
      groupBy = ['recipient', 'type', 'title'],
      keepLatest = true,
    } = options;

    const groups = new Map();
    const now = Date.now();

    notifications.forEach(notification => {
      // Skip old notifications outside time window
      if (now - notification.createdAt.getTime() > timeWindow) {
        return;
      }

      // Create grouping key
      const key = groupBy.map(field => {
        if (field === 'recipient') {
          return notification.recipient.toString();
        }
        return notification[field] || '';
      }).join('|');

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(notification);
    });

    // Keep one notification per group
    const deduplicated = [];
    groups.forEach(group => {
      if (group.length === 1) {
        deduplicated.push(group[0]);
      } else {
        // Sort by creation time and keep latest or earliest
        group.sort((a, b) => 
          keepLatest 
            ? b.createdAt.getTime() - a.createdAt.getTime()
            : a.createdAt.getTime() - b.createdAt.getTime()
        );
        deduplicated.push(group[0]);
      }
    });

    return deduplicated;
  }

  /**
   * Format notification for different channels
   * @param {Object} notification - Notification object
   * @param {string} channel - Target channel
   * @param {Object} user - User object
   * @returns {Object} - Formatted notification
   */
  static formatForChannel(notification, channel, user) {
    const baseFormat = {
      id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      data: notification.data,
      createdAt: notification.createdAt,
    };

    switch (channel) {
      case 'email':
        return {
          ...baseFormat,
          subject: this.generateEmailSubject(notification),
          htmlContent: this.generateEmailHtml(notification, user),
          textContent: this.generateEmailText(notification, user),
        };

      case 'push':
        return {
          ...baseFormat,
          title: this.truncateText(notification.title, 50),
          body: this.truncateText(notification.message, 120),
          badge: this.calculateBadgeCount(user),
          sound: this.getPushSound(notification.priority),
          data: {
            ...notification.data,
            notificationId: notification._id,
            type: notification.type,
          },
        };

      case 'slack':
        return {
          ...baseFormat,
          text: this.generateSlackText(notification),
          attachments: this.generateSlackAttachments(notification),
          channel: this.getSlackChannel(notification.type),
        };

      case 'websocket':
        return {
          ...baseFormat,
          event: 'notification',
          timestamp: Date.now(),
        };

      case 'inApp':
      default:
        return baseFormat;
    }
  }

  /**
   * Generate email subject line
   * @param {Object} notification - Notification object
   * @returns {string} - Email subject
   */
  static generateEmailSubject(notification) {
    const prefixes = {
      urgent: '[URGENT] ',
      critical: '[CRITICAL] ',
      high: '[HIGH] ',
      medium: '',
      low: '',
    };

    const prefix = prefixes[notification.priority] || '';
    return `${prefix}${notification.title}`;
  }

  /**
   * Generate email HTML content
   * @param {Object} notification - Notification object
   * @param {Object} user - User object
   * @returns {string} - HTML content
   */
  static generateEmailHtml(notification, user) {
    const userName = user ? `${user.firstName} ${user.lastName}` : 'User';
    const priorityColor = this.getPriorityColor(notification.priority);

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${priorityColor}; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">${notification.title}</h1>
        </div>
        <div style="padding: 20px; background-color: #f9f9f9;">
          <p>Hello ${userName},</p>
          <p style="font-size: 16px; line-height: 1.5;">${notification.message}</p>
          ${notification.data && notification.data.actionUrl ? 
            `<div style="text-align: center; margin: 20px 0;">
              <a href="${notification.data.actionUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Take Action
              </a>
            </div>` : ''
          }
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">
            This notification was sent at ${notification.createdAt.toLocaleString()}.
            <br>
            You can manage your notification preferences in your account settings.
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Generate email text content
   * @param {Object} notification - Notification object
   * @param {Object} user - User object
   * @returns {string} - Text content
   */
  static generateEmailText(notification, user) {
    const userName = user ? `${user.firstName} ${user.lastName}` : 'User';
    
    return `
Hello ${userName},

${notification.title}

${notification.message}

${notification.data && notification.data.actionUrl ? 
  `Action required: ${notification.data.actionUrl}` : ''
}

---
This notification was sent at ${notification.createdAt.toLocaleString()}.
You can manage your notification preferences in your account settings.
    `.trim();
  }

  /**
   * Generate Slack message text
   * @param {Object} notification - Notification object
   * @returns {string} - Slack text
   */
  static generateSlackText(notification) {
    const emoji = this.getSlackEmoji(notification.type);
    return `${emoji} *${notification.title}*\n${notification.message}`;
  }

  /**
   * Generate Slack attachments
   * @param {Object} notification - Notification object
   * @returns {Array} - Slack attachments
   */
  static generateSlackAttachments(notification) {
    return [{
      color: this.getPriorityColor(notification.priority),
      fields: [
        {
          title: 'Priority',
          value: notification.priority.toUpperCase(),
          short: true,
        },
        {
          title: 'Type',
          value: notification.type.replace(/_/g, ' ').toUpperCase(),
          short: true,
        },
      ],
      footer: 'Workflow Management System',
      ts: Math.floor(notification.createdAt.getTime() / 1000),
    }];
  }

  /**
   * Get priority color
   * @param {string} priority - Priority level
   * @returns {string} - Color code
   */
  static getPriorityColor(priority) {
    const colors = {
      low: '#28a745',
      medium: '#17a2b8',
      high: '#ffc107',
      urgent: '#fd7e14',
      critical: '#dc3545',
    };
    return colors[priority] || '#6c757d';
  }

  /**
   * Get Slack emoji for notification type
   * @param {string} type - Notification type
   * @returns {string} - Emoji
   */
  static getSlackEmoji(type) {
    const emojis = {
      task_assigned: ':clipboard:',
      task_completed: ':white_check_mark:',
      task_overdue: ':warning:',
      task_escalated: ':rotating_light:',
      workflow_completed: ':gear:',
      workflow_failed: ':x:',
      system_announcement: ':loudspeaker:',
      security_alert: ':shield:',
      approval_request: ':raised_hand:',
      deadline_reminder: ':alarm_clock:',
    };
    return emojis[type] || ':bell:';
  }

  /**
   * Get push notification sound
   * @param {string} priority - Priority level
   * @returns {string} - Sound name
   */
  static getPushSound(priority) {
    const sounds = {
      low: 'default',
      medium: 'default',
      high: 'alert',
      urgent: 'urgent',
      critical: 'critical',
    };
    return sounds[priority] || 'default';
  }

  /**
   * Get Slack channel for notification type
   * @param {string} type - Notification type
   * @returns {string} - Channel name
   */
  static getSlackChannel(type) {
    const channels = {
      system_announcement: '#general',
      security_alert: '#security',
      task_assigned: '#tasks',
      workflow_completed: '#workflows',
    };
    return channels[type] || '#notifications';
  }

  /**
   * Truncate text to specified length
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} - Truncated text
   */
  static truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Calculate badge count for user
   * @param {Object} user - User object
   * @returns {number} - Badge count
   */
  static calculateBadgeCount(user) {
    // This would typically query the database for unread count
    // For now, return a placeholder
    return 1;
  }

  /**
   * Handle timezone conversion for notifications
   * @param {Date} date - Date to convert
   * @param {string} timezone - Target timezone
   * @returns {Date} - Converted date
   */
  static convertToUserTimezone(date, timezone = 'UTC') {
    try {
      return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    } catch (error) {
      console.warn('Timezone conversion failed:', error);
      return date;
    }
  }

  /**
   * Generate notification digest for multiple notifications
   * @param {Array} notifications - Array of notifications
   * @param {Object} user - User object
   * @returns {Object} - Digest notification
   */
  static generateDigest(notifications, user) {
    if (notifications.length === 0) {
      return null;
    }

    if (notifications.length === 1) {
      return notifications[0];
    }

    // Group notifications by type
    const groups = {};
    notifications.forEach(notification => {
      if (!groups[notification.type]) {
        groups[notification.type] = [];
      }
      groups[notification.type].push(notification);
    });

    // Generate digest content
    const typeNames = {
      task_assigned: 'tasks assigned',
      task_completed: 'tasks completed',
      task_overdue: 'overdue tasks',
      workflow_completed: 'workflows completed',
      system_announcement: 'system announcements',
    };

    const summaryParts = Object.entries(groups).map(([type, notifs]) => {
      const typeName = typeNames[type] || type.replace(/_/g, ' ');
      return `${notifs.length} ${typeName}`;
    });

    return {
      type: 'digest',
      title: `You have ${notifications.length} new notifications`,
      message: `Summary: ${summaryParts.join(', ')}.`,
      priority: 'medium',
      data: {
        digest: true,
        notificationCount: notifications.length,
        types: Object.keys(groups),
        notifications: notifications.map(n => ({
          id: n._id,
          type: n.type,
          title: n.title,
          createdAt: n.createdAt,
        })),
      },
      createdAt: new Date(),
    };
  }
}

module.exports = NotificationHelpers;