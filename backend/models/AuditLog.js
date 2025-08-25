const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional for system-level logs
  },
  action: {
    type: String,
    required: true,
    trim: true,
  },
  resource: {
    type: String,
    required: true,
    trim: true,
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  resourceName: {
    type: String,
    required: false,
    trim: true,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
  },
  ipAddress: {
    type: String,
    required: false,
  },
  userAgent: {
    type: String,
    required: false,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for performance
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });

// Static method to log actions
auditLogSchema.statics.logAction = async function (logData) {
  try {
    const auditLog = new this({
      userId: logData.userId,
      action: logData.action,
      resource: logData.resource,
      resourceId: logData.resourceId,
      resourceName: logData.resourceName,
      details: logData.details || {},
      severity: logData.severity || 'low',
      ipAddress: logData.ipAddress,
      userAgent: logData.userAgent,
    });

    await auditLog.save();
    return auditLog;
  } catch (error) {
    console.error('Failed to log audit action:', error);
    // Don't throw error to prevent breaking the main flow
    return null;
  }
};

// Method to get logs for a specific resource
auditLogSchema.statics.getResourceLogs = function (resource, resourceId, options = {}) {
  const query = { resource, resourceId };

  if (options.userId) {
    query.userId = options.userId;
  }

  if (options.action) {
    query.action = options.action;
  }

  if (options.severity) {
    query.severity = options.severity;
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 100)
    .populate('userId', 'username email firstName lastName');
};

// Method to get user activity logs
auditLogSchema.statics.getUserActivity = function (userId, options = {}) {
  const query = { userId };

  if (options.action) {
    query.action = options.action;
  }

  if (options.resource) {
    query.resource = options.resource;
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 50);
};

// Method to get system logs by severity
auditLogSchema.statics.getSystemLogs = function (severity, options = {}) {
  const query = { severity };

  if (options.action) {
    query.action = options.action;
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 100)
    .populate('userId', 'username email firstName lastName');
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
