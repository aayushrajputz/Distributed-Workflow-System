import mongoose, { Schema } from 'mongoose';
import { INotification } from '../types';

const notificationSchema = new Schema<INotification>({
  userId: {
    type: String,
    required: true,
    ref: 'User',
    index: true
  },
  type: {
    type: String,
    enum: ['task_assigned', 'task_completed', 'task_overdue', 'task_reminder', 'workflow_update', 'system', 'mention'],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  data: {
    taskId: String,
    workflowId: String,
    projectName: String,
    assignedBy: String,
    dueDate: Date,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    url: String
  },
  channels: [{
    type: String,
    enum: ['in_app', 'email', 'slack', 'websocket'],
    default: 'in_app'
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ userId: 1, priority: 1 });
notificationSchema.index({ createdAt: -1 });

// TTL index for expired notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to set readAt timestamp
notificationSchema.pre('save', function(next) {
  if (this.isModified('isRead') && this.isRead && !this.readAt) {
    this.readAt = new Date();
  }
  next();
});

// Static method to mark notifications as read
notificationSchema.statics.markAsRead = async function(userId: string, notificationIds: string[]) {
  const result = await this.updateMany(
    {
      _id: { $in: notificationIds },
      userId,
      isRead: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );
  
  return result.modifiedCount;
};

// Static method to mark all notifications as read for a user
notificationSchema.statics.markAllAsRead = async function(userId: string) {
  const result = await this.updateMany(
    {
      userId,
      isRead: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );
  
  return result.modifiedCount;
};

// Static method to get notification statistics
notificationSchema.statics.getStats = async function(userId: string) {
  const pipeline = [
    { $match: { userId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
        urgent: { $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] } },
        high: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
        medium: { $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] } },
        low: { $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] } },
        task_assigned: { $sum: { $cond: [{ $eq: ['$type', 'task_assigned'] }, 1, 0] } },
        task_completed: { $sum: { $cond: [{ $eq: ['$type', 'task_completed'] }, 1, 0] } },
        task_overdue: { $sum: { $cond: [{ $eq: ['$type', 'task_overdue'] }, 1, 0] } },
        task_reminder: { $sum: { $cond: [{ $eq: ['$type', 'task_reminder'] }, 1, 0] } },
        workflow_update: { $sum: { $cond: [{ $eq: ['$type', 'workflow_update'] }, 1, 0] } },
        system: { $sum: { $cond: [{ $eq: ['$type', 'system'] }, 1, 0] } },
        mention: { $sum: { $cond: [{ $eq: ['$type', 'mention'] }, 1, 0] } }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    total: 0,
    unread: 0,
    byPriority: { urgent: 0, high: 0, medium: 0, low: 0 },
    byType: {
      task_assigned: 0,
      task_completed: 0,
      task_overdue: 0,
      task_reminder: 0,
      workflow_update: 0,
      system: 0,
      mention: 0
    }
  };
};

// Static method to create notification
notificationSchema.statics.createNotification = async function(data: any) {
  // Set default expiration (30 days from now)
  if (!data.expiresAt) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    data.expiresAt = expiresAt;
  }
  
  return await this.create(data);
};

// Static method to cleanup old notifications
notificationSchema.statics.cleanup = async function(daysOld: number = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate },
    isRead: true
  });
  
  return result.deletedCount;
};

export default mongoose.model<INotification>('Notification', notificationSchema);