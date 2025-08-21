const mongoose = require('mongoose');

const integrationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  type: { 
    type: String, 
    required: true,
    enum: ['slack', 'github', 'jira', 'asana', 'salesforce', 'hubspot', 'webhook', 'email']
  },
  
  name: { 
    type: String, 
    required: true 
  },
  
  description: String,
  
  isActive: { 
    type: Boolean, 
    default: true 
  },
  
  // Encrypted credentials storage
  credentials: {
    // Slack
    webhookUrl: String,
    channel: String,
    botToken: String,
    
    // GitHub
    accessToken: String,
    repository: String,
    webhookSecret: String,
    
    // Jira
    domain: String,
    email: String,
    apiToken: String,
    projectKey: String,
    
    // Asana
    personalAccessToken: String,
    workspaceId: String,
    projectId: String,
    
    // Salesforce
    clientId: String,
    clientSecret: String,
    refreshToken: String,
    instanceUrl: String,
    
    // HubSpot
    apiKey: String,
    portalId: String,
    
    // Generic webhook
    url: String,
    headers: mongoose.Schema.Types.Mixed,
    
    // Email
    smtpHost: String,
    smtpPort: Number,
    smtpUser: String,
    smtpPassword: String,
    fromEmail: String
  },
  
  // Integration-specific settings
  settings: {
    // Slack settings
    notifications: {
      taskCompleted: { type: Boolean, default: true },
      taskFailed: { type: Boolean, default: true },
      workflowStarted: { type: Boolean, default: false },
      workflowCompleted: { type: Boolean, default: true },
      workflowFailed: { type: Boolean, default: true },
      systemAlerts: { type: Boolean, default: false }
    },
    
    // GitHub settings
    events: {
      push: { type: Boolean, default: true },
      pullRequest: { type: Boolean, default: true },
      issues: { type: Boolean, default: false },
      release: { type: Boolean, default: false }
    },
    
    // Jira settings
    sync: {
      importIssues: { type: Boolean, default: false },
      exportTasks: { type: Boolean, default: false },
      bidirectionalSync: { type: Boolean, default: false },
      statusMapping: mongoose.Schema.Types.Mixed
    },
    
    // Asana settings
    projectSync: {
      enabled: { type: Boolean, default: false },
      direction: { type: String, enum: ['import', 'export', 'bidirectional'], default: 'export' }
    },
    
    // Salesforce settings
    objectMapping: {
      tasks: { type: String, default: 'Task' },
      workflows: { type: String, default: 'Case' }
    },
    
    // HubSpot settings
    dealSync: {
      enabled: { type: Boolean, default: false },
      pipelineId: String
    },
    
    // Webhook settings
    retryPolicy: {
      enabled: { type: Boolean, default: true },
      maxRetries: { type: Number, default: 3 },
      retryDelay: { type: Number, default: 1000 }
    },
    
    // Email settings
    templates: {
      taskCompleted: String,
      taskFailed: String,
      workflowCompleted: String,
      workflowFailed: String
    }
  },
  
  // Sync status and statistics
  lastSyncAt: Date,
  lastErrorAt: Date,
  lastError: String,
  
  stats: {
    totalSyncs: { type: Number, default: 0 },
    successfulSyncs: { type: Number, default: 0 },
    failedSyncs: { type: Number, default: 0 },
    lastSyncDuration: Number, // milliseconds
    avgSyncDuration: Number // milliseconds
  },
  
  // Rate limiting
  rateLimits: {
    requestsPerMinute: { type: Number, default: 60 },
    requestsPerHour: { type: Number, default: 1000 },
    requestsPerDay: { type: Number, default: 10000 }
  },
  
  // Webhook verification
  webhookConfig: {
    secret: String,
    verificationToken: String,
    signatureHeader: String
  },
  
  // OAuth tokens (for services that require OAuth)
  oauth: {
    accessToken: String,
    refreshToken: String,
    tokenType: String,
    expiresAt: Date,
    scope: [String]
  },
  
  // Custom fields for extensibility
  customFields: mongoose.Schema.Types.Mixed,
  
  // Tags for organization
  tags: [String]
}, {
  timestamps: true
});

// Indexes for performance
integrationSchema.index({ userId: 1, type: 1 });
integrationSchema.index({ userId: 1, isActive: 1 });
integrationSchema.index({ type: 1, isActive: 1 });

// Methods
integrationSchema.methods.updateStats = function(success, duration) {
  this.stats.totalSyncs += 1;
  
  if (success) {
    this.stats.successfulSyncs += 1;
    this.lastSyncAt = new Date();
  } else {
    this.stats.failedSyncs += 1;
    this.lastErrorAt = new Date();
  }
  
  if (duration) {
    this.stats.lastSyncDuration = duration;
    
    // Calculate rolling average
    const totalDuration = (this.stats.avgSyncDuration || 0) * (this.stats.totalSyncs - 1) + duration;
    this.stats.avgSyncDuration = Math.round(totalDuration / this.stats.totalSyncs);
  }
  
  return this.save();
};

integrationSchema.methods.isRateLimited = function() {
  // Simple rate limiting check - in production, use Redis or similar
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60000);
  const oneHourAgo = new Date(now.getTime() - 3600000);
  const oneDayAgo = new Date(now.getTime() - 86400000);
  
  // This would need to be implemented with actual request tracking
  return false;
};

integrationSchema.methods.getSuccessRate = function() {
  if (this.stats.totalSyncs === 0) return 0;
  return Math.round((this.stats.successfulSyncs / this.stats.totalSyncs) * 100);
};

integrationSchema.methods.canSync = function() {
  return this.isActive && !this.isRateLimited();
};

// Static methods
integrationSchema.statics.getActiveIntegrations = function(userId, type = null) {
  const query = { userId, isActive: true };
  if (type) query.type = type;
  return this.find(query);
};

integrationSchema.statics.getIntegrationStats = function(userId) {
  return this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$type',
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
        totalSyncs: { $sum: '$stats.totalSyncs' },
        successfulSyncs: { $sum: '$stats.successfulSyncs' },
        failedSyncs: { $sum: '$stats.failedSyncs' }
      }
    }
  ]);
};

// Pre-save middleware to encrypt sensitive data
integrationSchema.pre('save', function(next) {
  // In production, encrypt sensitive credentials here
  // For now, we'll just proceed
  next();
});

// Virtual for success rate
integrationSchema.virtual('successRate').get(function() {
  return this.getSuccessRate();
});

// Ensure virtual fields are serialized
integrationSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Integration', integrationSchema);
