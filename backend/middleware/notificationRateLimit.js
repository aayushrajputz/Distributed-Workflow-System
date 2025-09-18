const Redis = require('redis');
const { getPrometheusService } = require('../services/prometheusService');

class NotificationRateLimiter {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.enabled = process.env.REDIS_URL || process.env.REDIS_HOST;
    
    // Rate limit configurations
    this.limits = {
      // General notification sending
      notification_send: {
        windowMs: 60 * 1000, // 1 minute
        max: 100, // 100 notifications per minute per user
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
      },
      
      // Bulk notification operations
      bulk_notification: {
        windowMs: 60 * 1000, // 1 minute
        max: 5, // 5 bulk operations per minute per user
        skipSuccessfulRequests: false,
        skipFailedRequests: true, // Don't count failed requests
      },
      
      // System announcements (admin only)
      system_announcement: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 10, // 10 system announcements per 5 minutes
        skipSuccessfulRequests: false,
        skipFailedRequests: true,
      },
      
      // Notification preferences updates
      preferences_update: {
        windowMs: 60 * 1000, // 1 minute
        max: 20, // 20 preference updates per minute per user
        skipSuccessfulRequests: false,
        skipFailedRequests: true,
      },
      
      // Push token registration
      token_registration: {
        windowMs: 60 * 1000, // 1 minute
        max: 10, // 10 token registrations per minute per user
        skipSuccessfulRequests: false,
        skipFailedRequests: true,
      },
      
      // Notification read operations
      notification_read: {
        windowMs: 60 * 1000, // 1 minute
        max: 200, // 200 read operations per minute per user
        skipSuccessfulRequests: false,
        skipFailedRequests: true,
      },
    };

    // Role-based multipliers
    this.roleMultipliers = {
      admin: 5, // Admins get 5x the limits
      manager: 2, // Managers get 2x the limits
      user: 1, // Regular users get base limits
    };

    // Metrics
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      bypassedRequests: 0,
      errorCount: 0,
    };

    this.initialize();
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    if (!this.enabled) {
      console.warn('⚠️ Redis not configured. Notification rate limiting disabled.');
      return;
    }

    try {
      const redisConfig = {
        url: process.env.REDIS_URL,
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB) || 1, // Use different DB for rate limiting
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      };

      // Create Redis client
      if (process.env.REDIS_URL) {
        this.redis = Redis.createClient({ url: process.env.REDIS_URL });
      } else {
        this.redis = Redis.createClient(redisConfig);
      }

      // Event handlers
      this.redis.on('connect', () => {
        console.log('🔗 Connecting to Redis for rate limiting...');
      });

      this.redis.on('ready', () => {
        console.log('✅ Redis connection established for notification rate limiting');
        this.isConnected = true;
      });

      this.redis.on('error', (error) => {
        console.error('❌ Redis rate limiting connection error:', error.message);
        this.isConnected = false;
        this.metrics.errorCount++;
      });

      this.redis.on('end', () => {
        console.log('🔌 Redis rate limiting connection closed');
        this.isConnected = false;
      });

      // Connect to Redis
      await this.redis.connect();

    } catch (error) {
      console.error('❌ Failed to initialize Redis for rate limiting:', error.message);
      this.isConnected = false;
    }
  }

  /**
   * Create rate limiting middleware
   * @param {string} limitType - Type of rate limit to apply
   * @param {Object} options - Additional options
   * @returns {Function} - Express middleware function
   */
  createMiddleware(limitType, options = {}) {
    return async (req, res, next) => {
      try {
        this.metrics.totalRequests++;

        // Skip if rate limiting is disabled
        if (!this.isConnected) {
          return next();
        }

        // Get limit configuration
        const limitConfig = this.limits[limitType];
        if (!limitConfig) {
          console.warn(`⚠️ Unknown rate limit type: ${limitType}`);
          return next();
        }

        // Get user information
        const userId = req.user?.id || req.user?._id || 'anonymous';
        const userRole = req.user?.role || 'user';

        // Check for bypass conditions
        if (this.shouldBypass(req, limitType, options)) {
          this.metrics.bypassedRequests++;
          return next();
        }

        // Apply role-based multiplier
        const roleMultiplier = this.roleMultipliers[userRole] || 1;
        const effectiveLimit = Math.floor(limitConfig.max * roleMultiplier);

        // Check rate limit
        const isAllowed = await this.checkRateLimit(
          userId,
          limitType,
          limitConfig.windowMs,
          effectiveLimit
        );

        if (!isAllowed) {
          this.metrics.blockedRequests++;
          
          // Record blocked request metrics
          this.recordMetrics(limitType, 'blocked', userRole);

          // Get remaining time
          const resetTime = await this.getRemainingTime(userId, limitType, limitConfig.windowMs);

          return res.status(429).json({
            success: false,
            error: 'Too Many Requests',
            message: `Rate limit exceeded for ${limitType}. Try again in ${Math.ceil(resetTime / 1000)} seconds.`,
            rateLimitInfo: {
              type: limitType,
              limit: effectiveLimit,
              windowMs: limitConfig.windowMs,
              resetTime: new Date(Date.now() + resetTime),
              retryAfter: Math.ceil(resetTime / 1000),
            },
          });
        }

        // Add rate limit headers
        const remaining = await this.getRemainingRequests(userId, limitType, effectiveLimit);
        const resetTime = await this.getRemainingTime(userId, limitType, limitConfig.windowMs);

        res.set({
          'X-RateLimit-Limit': effectiveLimit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': new Date(Date.now() + resetTime).toISOString(),
          'X-RateLimit-Type': limitType,
        });

        // Record successful request metrics
        this.recordMetrics(limitType, 'allowed', userRole);

        next();

      } catch (error) {
        console.error('❌ Rate limiting error:', error);
        this.metrics.errorCount++;
        
        // Continue without rate limiting on error
        next();
      }
    };
  }

  /**
   * Check if request should bypass rate limiting
   * @param {Object} req - Express request object
   * @param {string} limitType - Rate limit type
   * @param {Object} options - Additional options
   * @returns {boolean} - Should bypass
   */
  shouldBypass(req, limitType, options) {
    // Bypass for system/internal requests
    if (req.headers['x-internal-request'] === 'true') {
      return true;
    }

    // Bypass for emergency notifications
    if (options.emergency || req.body?.priority === 'emergency') {
      return true;
    }

    // Bypass for specific user roles if configured
    if (options.bypassRoles && options.bypassRoles.includes(req.user?.role)) {
      return true;
    }

    // Bypass for specific IP addresses (for testing/monitoring)
    const bypassIPs = process.env.RATE_LIMIT_BYPASS_IPS?.split(',') || [];
    if (bypassIPs.includes(req.ip)) {
      return true;
    }

    return false;
  }

  /**
   * Check rate limit for user
   * @param {string} userId - User ID
   * @param {string} limitType - Rate limit type
   * @param {number} windowMs - Time window in milliseconds
   * @param {number} maxRequests - Maximum requests allowed
   * @returns {boolean} - Is request allowed
   */
  async checkRateLimit(userId, limitType, windowMs, maxRequests) {
    if (!this.isConnected) {
      return true; // Allow if Redis is not available
    }

    try {
      const key = `rate_limit:${limitType}:${userId}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Use Redis sorted set to track requests in time window
      const pipeline = this.redis.multi();
      
      // Remove old entries
      pipeline.zRemRangeByScore(key, 0, windowStart);
      
      // Count current requests in window
      pipeline.zCard(key);
      
      // Add current request
      pipeline.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
      
      // Set expiration
      pipeline.expire(key, Math.ceil(windowMs / 1000));

      const results = await pipeline.exec();
      const currentCount = results[1][1]; // Get count result

      return currentCount < maxRequests;

    } catch (error) {
      console.error('❌ Rate limit check error:', error);
      return true; // Allow on error
    }
  }

  /**
   * Get remaining requests for user
   * @param {string} userId - User ID
   * @param {string} limitType - Rate limit type
   * @param {number} maxRequests - Maximum requests allowed
   * @returns {number} - Remaining requests
   */
  async getRemainingRequests(userId, limitType, maxRequests) {
    if (!this.isConnected) {
      return maxRequests;
    }

    try {
      const key = `rate_limit:${limitType}:${userId}`;
      const currentCount = await this.redis.zCard(key);
      return Math.max(0, maxRequests - currentCount);
    } catch (error) {
      console.error('❌ Error getting remaining requests:', error);
      return maxRequests;
    }
  }

  /**
   * Get remaining time until reset
   * @param {string} userId - User ID
   * @param {string} limitType - Rate limit type
   * @param {number} windowMs - Time window in milliseconds
   * @returns {number} - Remaining time in milliseconds
   */
  async getRemainingTime(userId, limitType, windowMs) {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const key = `rate_limit:${limitType}:${userId}`;
      const ttl = await this.redis.ttl(key);
      return ttl > 0 ? ttl * 1000 : 0;
    } catch (error) {
      console.error('❌ Error getting remaining time:', error);
      return 0;
    }
  }

  /**
   * Record metrics for monitoring
   * @param {string} limitType - Rate limit type
   * @param {string} action - Action (allowed/blocked)
   * @param {string} userRole - User role
   */
  recordMetrics(limitType, action, userRole) {
    try {
      const prometheusService = getPrometheusService();
      if (prometheusService) {
        prometheusService.recordRateLimit(limitType, action, userRole);
      }
    } catch (error) {
      console.error('❌ Failed to record rate limit metrics:', error);
    }
  }

  /**
   * Get current rate limit status for user
   * @param {string} userId - User ID
   * @param {string} limitType - Rate limit type
   * @returns {Object} - Rate limit status
   */
  async getRateLimitStatus(userId, limitType) {
    if (!this.isConnected) {
      return {
        available: true,
        remaining: 999,
        resetTime: null,
        limit: 999,
      };
    }

    const limitConfig = this.limits[limitType];
    if (!limitConfig) {
      return { available: false, error: 'Unknown limit type' };
    }

    try {
      const key = `rate_limit:${limitType}:${userId}`;
      const currentCount = await this.redis.zCard(key);
      const remaining = Math.max(0, limitConfig.max - currentCount);
      const resetTime = await this.getRemainingTime(userId, limitType, limitConfig.windowMs);

      return {
        available: remaining > 0,
        remaining,
        resetTime: resetTime > 0 ? new Date(Date.now() + resetTime) : null,
        limit: limitConfig.max,
        windowMs: limitConfig.windowMs,
      };
    } catch (error) {
      console.error('❌ Error getting rate limit status:', error);
      return {
        available: true,
        remaining: limitConfig.max,
        resetTime: null,
        limit: limitConfig.max,
        error: error.message,
      };
    }
  }

  /**
   * Reset rate limit for user (admin function)
   * @param {string} userId - User ID
   * @param {string} limitType - Rate limit type
   * @returns {boolean} - Success
   */
  async resetRateLimit(userId, limitType) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const key = `rate_limit:${limitType}:${userId}`;
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error('❌ Error resetting rate limit:', error);
      return false;
    }
  }

  /**
   * Get rate limiting metrics
   * @returns {Object} - Metrics
   */
  getMetrics() {
    const totalProcessed = this.metrics.totalRequests;
    const blockRate = totalProcessed > 0 
      ? (this.metrics.blockedRequests / totalProcessed * 100).toFixed(2)
      : 0;

    return {
      ...this.metrics,
      blockRate: blockRate + '%',
      isConnected: this.isConnected,
      limitsConfigured: Object.keys(this.limits).length,
    };
  }

  /**
   * Get health status
   * @returns {Object} - Health status
   */
  getHealthStatus() {
    return {
      status: this.isConnected ? 'healthy' : 'degraded',
      isConnected: this.isConnected,
      enabled: this.enabled,
      metrics: this.getMetrics(),
      limits: Object.keys(this.limits),
    };
  }

  /**
   * Update rate limit configuration
   * @param {string} limitType - Rate limit type
   * @param {Object} config - New configuration
   */
  updateLimitConfig(limitType, config) {
    if (this.limits[limitType]) {
      this.limits[limitType] = { ...this.limits[limitType], ...config };
      console.log(`✅ Updated rate limit config for ${limitType}`);
    } else {
      console.warn(`⚠️ Unknown rate limit type: ${limitType}`);
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.redis && this.isConnected) {
      await this.redis.quit();
      console.log('✅ Notification rate limiter closed');
    }
  }
}

// Create singleton instance
const notificationRateLimiter = new NotificationRateLimiter();

// Export middleware functions for easy use
module.exports = {
  // Main class
  NotificationRateLimiter,
  
  // Singleton instance
  rateLimiter: notificationRateLimiter,
  
  // Convenience middleware functions
  notificationSend: (options = {}) => notificationRateLimiter.createMiddleware('notification_send', options),
  bulkNotification: (options = {}) => notificationRateLimiter.createMiddleware('bulk_notification', options),
  systemAnnouncement: (options = {}) => notificationRateLimiter.createMiddleware('system_announcement', options),
  preferencesUpdate: (options = {}) => notificationRateLimiter.createMiddleware('preferences_update', options),
  tokenRegistration: (options = {}) => notificationRateLimiter.createMiddleware('token_registration', options),
  notificationRead: (options = {}) => notificationRateLimiter.createMiddleware('notification_read', options),
  
  // Utility functions
  getRateLimitStatus: (userId, limitType) => notificationRateLimiter.getRateLimitStatus(userId, limitType),
  resetRateLimit: (userId, limitType) => notificationRateLimiter.resetRateLimit(userId, limitType),
  getMetrics: () => notificationRateLimiter.getMetrics(),
  getHealthStatus: () => notificationRateLimiter.getHealthStatus(),
};