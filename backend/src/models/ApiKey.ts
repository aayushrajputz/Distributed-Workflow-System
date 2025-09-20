import mongoose, { Schema } from 'mongoose';
import crypto from 'crypto';
import { IApiKey } from '../types';

const apiKeySchema = new Schema<IApiKey>({
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  name: {
    type: String,
    required: [true, 'API key name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  keyHash: {
    type: String,
    required: true,
    select: false // Never return the hash
  },
  keyPrefix: {
    type: String,
    required: true,
    index: true
  },
  permissions: [{
    type: String,
    enum: ['read', 'write', 'admin'],
    default: 'read'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsedAt: {
    type: Date
  },
  rateLimit: {
    requestsPerHour: {
      type: Number,
      default: 1000,
      min: [1, 'Rate limit must be at least 1 request per hour'],
      max: [10000, 'Rate limit cannot exceed 10000 requests per hour']
    },
    requestsPerDay: {
      type: Number,
      default: 10000,
      min: [1, 'Rate limit must be at least 1 request per day'],
      max: [100000, 'Rate limit cannot exceed 100000 requests per day']
    }
  },
  metadata: {
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'development'
    },
    createdFrom: {
      type: String,
      default: 'dashboard'
    },
    userAgent: String
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.keyHash;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
apiKeySchema.index({ userId: 1 });
apiKeySchema.index({ keyPrefix: 1 });
apiKeySchema.index({ isActive: 1 });
apiKeySchema.index({ createdAt: -1 });
apiKeySchema.index({ lastUsedAt: -1 });

// Static method to generate API key
apiKeySchema.statics.generateApiKey = function(): { key: string; hash: string; prefix: string } {
  // Generate a secure random key
  const key = `sk_${crypto.randomBytes(32).toString('hex')}`;
  
  // Create hash for storage
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  
  // Create prefix for display (first 20 characters)
  const prefix = key.substring(0, 20);
  
  return { key, hash, prefix };
};

// Static method to hash a key for comparison
apiKeySchema.statics.hashKey = function(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
};

// Static method to find by key
apiKeySchema.statics.findByKey = function(key: string) {
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return this.findOne({ keyHash: hash, isActive: true }).populate('userId', 'firstName lastName email');
};

// Method to update last used timestamp
apiKeySchema.methods.updateLastUsed = function() {
  this.lastUsedAt = new Date();
  return this.save();
};

// Virtual for stats (to be populated by analytics service)
apiKeySchema.virtual('stats', {
  ref: 'UsageLog',
  localField: '_id',
  foreignField: 'apiKeyId',
  justOne: false
});

export default mongoose.model<IApiKey>('ApiKey', apiKeySchema);
