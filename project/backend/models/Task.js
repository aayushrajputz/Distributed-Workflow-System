const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Task title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Task description is required'],
    trim: true,
    maxlength: [1000, 'Task description cannot exceed 1000 characters']
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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Task must be assigned to a user']
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Task must have an assigner']
  },
  project: {
    type: String,
    required: [true, 'Task must belong to a project'],
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  dueDate: {
    type: Date,
    required: [true, 'Task must have a due date']
  },
  scheduledDate: {
    type: Date,
    required: [true, 'Task must have a scheduled date']
  },
  estimatedHours: {
    type: Number,
    min: [0, 'Estimated hours cannot be negative'],
    max: [1000, 'Estimated hours cannot exceed 1000']
  },
  actualHours: {
    type: Number,
    min: [0, 'Actual hours cannot be negative'],
    default: 0
  },
  progress: {
    type: Number,
    min: [0, 'Progress cannot be negative'],
    max: [100, 'Progress cannot exceed 100%'],
    default: 0
  },
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    text: {
      type: String,
      required: true,
      maxlength: [500, 'Comment cannot exceed 500 characters']
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
  timestamps: true
});

// Indexes for better query performance
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ priority: 1, status: 1 });
taskSchema.index({ createdAt: -1 });

// Virtual for task progress calculation
taskSchema.virtual('progressPercentage').get(function() {
  if (this.estimatedHours && this.actualHours) {
    return Math.min((this.actualHours / this.estimatedHours) * 100, 100);
  }
  return this.progress || 0;
});

// Virtual for overdue status
taskSchema.virtual('isOverdue').get(function() {
  return this.dueDate < new Date() && this.status !== 'completed';
});

// Virtual for days remaining
taskSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const diffTime = this.dueDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to update completedAt
taskSchema.pre('save', function(next) {
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
    this.progress = 100;
  } else if (this.status !== 'completed') {
    this.completedAt = undefined;
  }
  next();
});

// Static method to get task statistics
taskSchema.statics.getTaskStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { assignedTo: mongoose.Types.ObjectId(userId), isActive: true } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    blocked: 0,
    cancelled: 0
  };

  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });

  return result;
};

// Static method to get overdue tasks
taskSchema.statics.getOverdueTasks = async function(userId) {
  return this.find({
    assignedTo: userId,
    dueDate: { $lt: new Date() },
    status: { $nin: ['completed', 'cancelled'] },
    isActive: true
  }).populate('assignedBy', 'firstName lastName email');
};

// Static method to get upcoming tasks
taskSchema.statics.getUpcomingTasks = async function(userId, days = 7) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  return this.find({
    assignedTo: userId,
    dueDate: { $gte: new Date(), $lte: endDate },
    status: { $nin: ['completed', 'cancelled'] },
    isActive: true
  }).sort({ dueDate: 1 }).populate('assignedBy', 'firstName lastName email');
};

module.exports = mongoose.model('Task', taskSchema);
