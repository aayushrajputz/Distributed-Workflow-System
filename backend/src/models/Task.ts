import mongoose, { Schema } from 'mongoose';
import { ITask } from '../types';

const taskSchema = new Schema<ITask>({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Task description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'blocked', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  assignedTo: {
    type: String,
    ref: 'User'
  },
  assignedBy: {
    type: String,
    required: true,
    ref: 'User'
  },
  project: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [100, 'Project name cannot exceed 100 characters']
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  scheduledDate: {
    type: Date,
    required: [true, 'Scheduled date is required']
  },
  estimatedHours: {
    type: Number,
    min: [0, 'Estimated hours cannot be negative'],
    max: [1000, 'Estimated hours cannot exceed 1000']
  },
  actualHours: {
    type: Number,
    default: 0,
    min: [0, 'Actual hours cannot be negative']
  },
  progress: {
    type: Number,
    default: 0,
    min: [0, 'Progress cannot be less than 0'],
    max: [100, 'Progress cannot exceed 100']
  },
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    user: {
      type: String,
      required: true,
      ref: 'User'
    },
    text: {
      type: String,
      required: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  completedAt: {
    type: Date
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
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ assignedBy: 1 });
taskSchema.index({ project: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ priority: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ createdAt: -1 });
taskSchema.index({ updatedAt: -1 });
taskSchema.index({ tags: 1 });
taskSchema.index({ isActive: 1 });

// Compound indexes
taskSchema.index({ status: 1, priority: 1 });
taskSchema.index({ assignedTo: 1, dueDate: 1 });
taskSchema.index({ project: 1, status: 1 });

// Virtual for overdue status
taskSchema.virtual('isOverdue').get(function() {
  return this.dueDate < new Date() && this.status !== 'completed' && this.status !== 'cancelled';
});

// Virtual for days remaining
taskSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to set completedAt
taskSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'completed' && !this.completedAt) {
      this.completedAt = new Date();
      this.progress = 100;
    } else if (this.status !== 'completed') {
      this.completedAt = undefined;
    }
  }
  next();
});

// Static method to get task statistics
taskSchema.statics.getStats = async function(filters: any = {}) {
  const pipeline = [
    { $match: { isActive: true, ...filters } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        in_progress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        blocked: { $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        low: { $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] } },
        medium: { $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] } },
        high: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
        critical: { $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] } },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: ['$dueDate', new Date()] },
                  { $nin: ['$status', ['completed', 'cancelled']] }
                ]
              },
              1,
              0
            ]
          }
        },
        avgActualHours: { $avg: '$actualHours' }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    blocked: 0,
    cancelled: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
    overdue: 0,
    avgActualHours: 0
  };
};

// Static method to get project statistics
taskSchema.statics.getProjectStats = async function() {
  const pipeline: any[] = [
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$project',
        totalTasks: { $sum: 1 },
        completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        avgProgress: { $avg: '$progress' }
      }
    },
    {
      $project: {
        name: '$_id',
        totalTasks: 1,
        completedTasks: 1,
        progress: { $round: ['$avgProgress', 1] }
      }
    },
    { $sort: { totalTasks: -1 as 1 | -1 } }
  ];

  return await (this as any).aggregate(pipeline as any[]);
};

export default mongoose.model<ITask>('Task', taskSchema);
