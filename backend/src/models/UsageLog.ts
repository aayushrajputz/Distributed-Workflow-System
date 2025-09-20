import mongoose, { Schema } from 'mongoose';
import { IUsageLog } from '../types';

const usageLogSchema = new Schema<IUsageLog>({
  apiKeyId: {
    type: String,
    ref: 'ApiKey',
    index: true
  },
  userId: {
    type: String,
    ref: 'User',
    index: true
  },
  endpoint: {
    type: String,
    required: true,
    index: true
  },
  method: {
    type: String,
    required: true,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
  },
  statusCode: {
    type: Number,
    required: true,
    index: true
  },
  responseTimeMs: {
    type: Number,
    required: true,
    min: 0
  },
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String
  },
  requestSize: {
    type: Number,
    min: 0
  },
  responseSize: {
    type: Number,
    min: 0
  },
  errorMessage: {
    type: String
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }, // Only need createdAt
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for analytics queries
usageLogSchema.index({ createdAt: -1 });
usageLogSchema.index({ apiKeyId: 1, createdAt: -1 });
usageLogSchema.index({ userId: 1, createdAt: -1 });
usageLogSchema.index({ endpoint: 1, method: 1 });
usageLogSchema.index({ statusCode: 1, createdAt: -1 });
usageLogSchema.index({ responseTimeMs: -1 });

// Compound indexes for common queries
usageLogSchema.index({ apiKeyId: 1, endpoint: 1, createdAt: -1 });
usageLogSchema.index({ statusCode: 1, endpoint: 1, createdAt: -1 });

// TTL index to automatically delete old logs (keep for 90 days)
usageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Static methods for analytics
usageLogSchema.statics.getUsageStats = async function(filters: any = {}, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const matchStage: any = {
    createdAt: { $gte: startDate },
    ...filters
  };
  
  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        successfulRequests: { $sum: { $cond: [{ $lt: ['$statusCode', 400] }, 1, 0] } },
        failedRequests: { $sum: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] } },
        avgResponseTime: { $avg: '$responseTimeMs' },
        uniqueEndpoints: { $addToSet: '$endpoint' },
        uniqueIPs: { $addToSet: '$ipAddress' }
      }
    },
    {
      $project: {
        totalRequests: 1,
        successfulRequests: 1,
        failedRequests: 1,
        avgResponseTime: { $round: ['$avgResponseTime', 2] },
        successRate: {
          $round: [
            { $multiply: [{ $divide: ['$successfulRequests', '$totalRequests'] }, 100] },
            2
          ]
        },
        uniqueEndpoints: { $size: '$uniqueEndpoints' },
        uniqueIPs: { $size: '$uniqueIPs' }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    successRate: 0,
    uniqueEndpoints: 0,
    uniqueIPs: 0
  };
};

usageLogSchema.statics.getEndpointStats = async function(filters: any = {}, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const matchStage: any = {
    createdAt: { $gte: startDate },
    ...filters
  };
  
  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: { endpoint: '$endpoint', method: '$method' },
        requestCount: { $sum: 1 },
        successfulRequests: { $sum: { $cond: [{ $lt: ['$statusCode', 400] }, 1, 0] } },
        avgResponseTime: { $avg: '$responseTimeMs' }
      }
    },
    {
      $project: {
        endpoint: '$_id.endpoint',
        method: '$_id.method',
        requestCount: 1,
        avgResponseTime: { $round: ['$avgResponseTime', 2] },
        successRate: {
          $round: [
            { $multiply: [{ $divide: ['$successfulRequests', '$requestCount'] }, 100] },
            2
          ]
        }
      }
    },
    { $sort: { requestCount: -1 as const } },
    { $limit: 50 }
  ];
  
  return await this.aggregate(pipeline);
};

usageLogSchema.statics.getDailyStats = async function(filters: any = {}, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const matchStage: any = {
    createdAt: { $gte: startDate },
    ...filters
  };
  
  const pipeline: any[] = [
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        requestCount: { $sum: 1 },
        successfulRequests: { $sum: { $cond: [{ $lt: ['$statusCode', 400] }, 1, 0] } },
        failedRequests: { $sum: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] } },
        avgResponseTime: { $avg: '$responseTimeMs' }
      }
    },
    {
      $project: {
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day'
          }
        },
        requestCount: 1,
        successfulRequests: 1,
        failedRequests: 1,
        avgResponseTime: { $round: ['$avgResponseTime', 2] },
        successRate: {
          $round: [
            { $multiply: [{ $divide: ['$successfulRequests', '$requestCount'] }, 100] },
            2
          ]
        }
      }
    },
    { $sort: { date: 1 as const } } as const
  ];
  
  return await this.aggregate(pipeline);
};

usageLogSchema.statics.getApiKeyStats = async function(apiKeyId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const pipeline = [
    {
      $match: {
        apiKeyId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        successfulRequests: { $sum: { $cond: [{ $lt: ['$statusCode', 400] }, 1, 0] } },
        failedRequests: { $sum: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] } },
        avgResponseTime: { $avg: '$responseTimeMs' }
      }
    },
    {
      $project: {
        totalRequests: 1,
        successfulRequests: 1,
        failedRequests: 1,
        avgResponseTime: { $round: ['$avgResponseTime', 2] },
        successRate: {
          $round: [
            { $multiply: [{ $divide: ['$successfulRequests', '$totalRequests'] }, 100] },
            2
          ]
        }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    successRate: 0
  };
};

export default mongoose.model<IUsageLog>('UsageLog', usageLogSchema);
