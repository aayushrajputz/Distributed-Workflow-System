const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Notification recipient is required'],
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // System notifications won't have a sender
  },
  type: {
    type: String,
    enum: [
      'task_assigned',
      'task_completed',
      'task_overdue',
      'task_escalated',
      'task_updated',
      'task_deleted',
      'task_comment',
      'workflow_completed',
      'system_alert',
    ],
    required: [true, 'Notification type is required'],
  },
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    maxlength: [1000, 'Message cannot exceed 1000 characters'],
  },
  data: {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
    },
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workflow',
    },
    projectName: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
    },
    dueDate: Date,
    additionalData: mongoose.Schema.Types.Mixed,
  },
  channels: {
    inApp: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      read: { type: Boolean, default: false },
      readAt: Date,
    },
    email: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      delivered: { type: Boolean, default: false },
      deliveredAt: Date,
      opened: { type: Boolean, default: false },
      openedAt: Date,
    },
    slack: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      messageId: String,
      channelId: String,
    },
    websocket: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      connectionId: String,
    },
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'expired'],
    default: 'pending',
  },
  scheduledFor: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: function () {
      // Notifications expire after 30 days
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    },
  },
  retryCount: {
    type: Number,
    default: 0,
    max: 3,
  },
  lastRetryAt: Date,
  errorMessage: String,
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Indexes for performance
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ type: 1, status: 1 });
notificationSchema.index({ scheduledFor: 1, status: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ 'data.taskId': 1 });
notificationSchema.index({ 'channels.inApp.read': 1, recipient: 1 });

// Virtual for checking if notification is overdue
notificationSchema.virtual('isOverdue').get(function () {
  return this.scheduledFor < new Date() && this.status === 'pending';
});

// Static method to get unread count for user
notificationSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({
    recipient: userId,
    'channels.inApp.read': false,
    isActive: true,
    expiresAt: { $gt: new Date() },
  });
};

// Static method to get recent notifications for user
notificationSchema.statics.getRecentNotifications = async function (userId, limit = 20) {
  return this.find({
    recipient: userId,
    isActive: true,
    expiresAt: { $gt: new Date() },
  })
    .populate('sender', 'firstName lastName email avatar')
    .populate('data.taskId', 'title status priority')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to mark notifications as read
notificationSchema.statics.markAsRead = async function (userId, notificationIds = []) {
  const filter = {
    recipient: userId,
    isActive: true,
  };

  if (notificationIds.length > 0) {
    filter._id = { $in: notificationIds };
  }

  return this.updateMany(filter, {
    'channels.inApp.read': true,
    'channels.inApp.readAt': new Date(),
  });
};

// Static method to clean up expired notifications
notificationSchema.statics.cleanupExpired = async function () {
  return this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
};

// Instance method to mark as sent for specific channel
notificationSchema.methods.markAsSent = function (channel, additionalData = {}) {
  if (this.channels[channel]) {
    this.channels[channel].sent = true;
    this.channels[channel].sentAt = new Date();

    // Add any additional data (like messageId for Slack)
    Object.assign(this.channels[channel], additionalData);

    // Update overall status if all required channels are sent
    this.status = 'sent';
  }
  return this.save();
};

// Instance method to mark as failed
notificationSchema.methods.markAsFailed = function (errorMessage) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  this.retryCount += 1;
  this.lastRetryAt = new Date();
  return this.save();
};

// Instance method to check if should retry
notificationSchema.methods.shouldRetry = function () {
  return this.status === 'failed'
         && this.retryCount < 3
         && this.expiresAt > new Date();
};

// Pre-save middleware to update status
notificationSchema.pre('save', function (next) {
  // If scheduled for future, keep as pending
  if (this.scheduledFor > new Date()) {
    this.status = 'pending';
  }

  // Check if expired
  if (this.expiresAt < new Date()) {
    this.status = 'expired';
    this.isActive = false;
  }

  next();
});

module.exports = mongoose.model('Notification', notificationSchema);
