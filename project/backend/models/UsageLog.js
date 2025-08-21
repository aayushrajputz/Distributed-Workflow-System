const mongoose = require('mongoose');

const usageLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  apiKeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApiKey',
    required: true,
  },
  endpoint: {
    type: String,
    required: true,
    maxlength: 255,
  },
  method: {
    type: String,
    required: true,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  },
  statusCode: {
    type: Number,
    required: true,
  },
  responseTimeMs: {
    type: Number,
    required: true,
  },
  requestSize: {
    type: Number,
    default: 0,
  },
  responseSize: {
    type: Number,
    default: 0,
  },
  ipAddress: {
    type: String,
    required: true,
  },
  userAgent: {
    type: String,
    default: '',
  },
  requestHeaders: {
    type: Map,
    of: String,
    default: {},
  },
  queryParams: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  errorMessage: {
    type: String,
    default: null,
  },
  metadata: {
    region: String,
    version: String,
    feature: String,
  },
}, {
  timestamps: true,
});

// Indexes for performance and analytics
usageLogSchema.index({ userId: 1, createdAt: -1 });
usageLogSchema.index({ apiKeyId: 1, createdAt: -1 });
usageLogSchema.index({ endpoint: 1, method: 1 });
usageLogSchema.index({ statusCode: 1 });
usageLogSchema.index({ createdAt: -1 });
usageLogSchema.index({ ipAddress: 1 });

// Compound indexes for analytics
usageLogSchema.index({ userId: 1, endpoint: 1, createdAt: -1 });
usageLogSchema.index({ apiKeyId: 1, statusCode: 1, createdAt: -1 });

// Static method to log API usage
usageLogSchema.statics.logUsage = async function(data) {
  try {
    const log = new this(data);
    await log.save();
    return log;
  } catch (error) {
    console.error('Failed to log API usage:', error);
    // Don't throw error to avoid breaking API requests
    return null;
  }
};

// Static method to get user analytics
usageLogSchema.statics.getUserAnalytics = async function(userId, options = {}) {
  const {
    days = 30,
    startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    endDate = new Date(),
  } = options;

  const pipeline = [
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        uniqueEndpoints: { $addToSet: '$endpoint' },
        successfulRequests: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ['$statusCode', 200] }, { $lt: ['$statusCode', 300] }] },
              1,
              0,
            ],
          },
        },
        failedRequests: {
          $sum: {
            $cond: [{ $gte: ['$statusCode', 400] }, 1, 0],
          },
        },
        avgResponseTime: { $avg: '$responseTimeMs' },
        totalDataTransfer: { $sum: { $add: ['$requestSize', '$responseSize'] } },
        lastRequestAt: { $max: '$createdAt' },
      },
    },
    {
      $project: {
        totalRequests: 1,
        uniqueEndpoints: { $size: '$uniqueEndpoints' },
        successfulRequests: 1,
        failedRequests: 1,
        avgResponseTime: { $round: ['$avgResponseTime', 2] },
        totalDataTransfer: 1,
        lastRequestAt: 1,
        successRate: {
          $cond: [
            { $gt: ['$totalRequests', 0] },
            { $round: [{ $multiply: [{ $divide: ['$successfulRequests', '$totalRequests'] }, 100] }, 2] },
            0,
          ],
        },
      },
    },
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalRequests: 0,
    uniqueEndpoints: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    totalDataTransfer: 0,
    lastRequestAt: null,
    successRate: 0,
  };
};

// Static method to get endpoint analytics
usageLogSchema.statics.getEndpointAnalytics = async function(userId, options = {}) {
  const {
    days = 30,
    limit = 10,
    startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    endDate = new Date(),
  } = options;

  return await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { endpoint: '$endpoint', method: '$method' },
        requestCount: { $sum: 1 },
        avgResponseTime: { $avg: '$responseTimeMs' },
        successfulRequests: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ['$statusCode', 200] }, { $lt: ['$statusCode', 300] }] },
              1,
              0,
            ],
          },
        },
        failedRequests: {
          $sum: {
            $cond: [{ $gte: ['$statusCode', 400] }, 1, 0],
          },
        },
        lastUsed: { $max: '$createdAt' },
      },
    },
    {
      $project: {
        endpoint: '$_id.endpoint',
        method: '$_id.method',
        requestCount: 1,
        avgResponseTime: { $round: ['$avgResponseTime', 2] },
        successfulRequests: 1,
        failedRequests: 1,
        lastUsed: 1,
        successRate: {
          $cond: [
            { $gt: ['$requestCount', 0] },
            { $round: [{ $multiply: [{ $divide: ['$successfulRequests', '$requestCount'] }, 100] }, 2] },
            0,
          ],
        },
      },
    },
    { $sort: { requestCount: -1 } },
    { $limit: limit },
  ]);
};

// Static method to get daily analytics
usageLogSchema.statics.getDailyAnalytics = async function(userId, options = {}) {
  const {
    days = 30,
    startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    endDate = new Date(),
  } = options;

  return await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        },
        date: { $first: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
        requestCount: { $sum: 1 },
        successfulRequests: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ['$statusCode', 200] }, { $lt: ['$statusCode', 300] }] },
              1,
              0,
            ],
          },
        },
        failedRequests: {
          $sum: {
            $cond: [{ $gte: ['$statusCode', 400] }, 1, 0],
          },
        },
        avgResponseTime: { $avg: '$responseTimeMs' },
      },
    },
    {
      $project: {
        date: 1,
        requestCount: 1,
        successfulRequests: 1,
        failedRequests: 1,
        avgResponseTime: { $round: ['$avgResponseTime', 2] },
        successRate: {
          $cond: [
            { $gt: ['$requestCount', 0] },
            { $round: [{ $multiply: [{ $divide: ['$successfulRequests', '$requestCount'] }, 100] }, 2] },
            0,
          ],
        },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
  ]);
};

// Static method to cleanup old logs
usageLogSchema.statics.cleanup = async function(daysToKeep = 90) {
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  
  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate },
  });

  console.log(`Cleaned up ${result.deletedCount} old usage log records`);
  return result.deletedCount;
};

module.exports = mongoose.model('UsageLog', usageLogSchema);
