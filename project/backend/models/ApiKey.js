const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  keyHash: {
    type: String,
    required: true,
    unique: true,
  },
  keyPrefix: {
    type: String,
    required: true,
    maxlength: 12,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastUsedAt: {
    type: Date,
    default: null,
  },
  permissions: [{
    type: String,
    enum: ['read', 'write', 'admin'],
    default: 'read',
  }],
  rateLimit: {
    requestsPerHour: {
      type: Number,
      default: 100,
    },
    requestsPerDay: {
      type: Number,
      default: 1000,
    },
  },
  metadata: {
    createdFrom: String,
    description: String,
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'development',
    },
  },
}, {
  timestamps: true,
});

// Indexes for performance
apiKeySchema.index({ userId: 1 });
apiKeySchema.index({ keyHash: 1 });
apiKeySchema.index({ isActive: 1 });
apiKeySchema.index({ lastUsedAt: 1 });

// Static method to generate API key
apiKeySchema.statics.generateApiKey = function() {
  const keyLength = parseInt(process.env.API_KEY_LENGTH) || 32;
  const randomBytes = crypto.randomBytes(keyLength);
  const apiKey = randomBytes.toString('hex');
  
  // Create a prefix for easy identification (first 8 characters)
  const prefix = apiKey.substring(0, 8);
  
  return {
    apiKey: `sk_${apiKey}`, // Add 'sk_' prefix for secret key
    prefix: `sk_${prefix}`,
  };
};

// Static method to hash API key
apiKeySchema.statics.hashApiKey = function(apiKey) {
  const secret = process.env.API_KEY_SECRET || 'default-secret';
  return crypto.createHmac('sha256', secret).update(apiKey).digest('hex');
};

// Instance method to update last used timestamp
apiKeySchema.methods.updateLastUsed = function() {
  this.lastUsedAt = new Date();
  return this.save();
};

// Instance method to check if key is valid
apiKeySchema.methods.isValid = function() {
  return this.isActive && (!this.expiresAt || this.expiresAt > new Date());
};

// Instance method to get usage stats
apiKeySchema.methods.getUsageStats = async function(days = 30) {
  const UsageLog = mongoose.model('UsageLog');
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await UsageLog.aggregate([
    {
      $match: {
        apiKeyId: this._id,
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
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
      },
    },
  ]);

  const result = stats[0] || {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    totalDataTransfer: 0,
  };

  result.successRate = result.totalRequests > 0 
    ? ((result.successfulRequests / result.totalRequests) * 100).toFixed(2)
    : 0;

  return result;
};

// Instance method to get recent usage
apiKeySchema.methods.getRecentUsage = async function(limit = 10) {
  const UsageLog = mongoose.model('UsageLog');
  
  return await UsageLog.find({ apiKeyId: this._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'username email firstName lastName')
    .lean();
};

// Virtual for display name
apiKeySchema.virtual('displayKey').get(function() {
  return `${this.keyPrefix}...`;
});

// Transform output
apiKeySchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.keyHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('ApiKey', apiKeySchema);
