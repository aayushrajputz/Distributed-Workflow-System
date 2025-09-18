const Redis = require('redis');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getPrometheusService } = require('./prometheusService');

class NotificationCacheService {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.cacheEnabled = process.env.REDIS_URL || process.env.REDIS_HOST;
    
    // Cache TTL settings (in seconds)
    this.ttl = {
      userPreferences: parseInt(process.env.CACHE_USER_PREFERENCES_TTL) || 3600, // 1 hour
      unreadCounts: parseInt(process.env.CACHE_UNREAD_COUNTS_TTL) || 300, // 5 minutes
      templates: parseInt(process.env.CACHE_TEMPLATES_TTL) || 7200, // 2 hours
      deliveryStatus: parseInt(process.env.CACHE_DELIVERY_STATUS_TTL) || 1800, // 30 minutes
    };

    // Cache key prefixes
    this.keyPrefixes = {
      userPreferences: 'notif:prefs:',
      unreadCounts: 'notif:unread:',
      templates: 'notif:template:',
      deliveryStatus: 'notif:delivery:',
      userTokens: 'notif:tokens:',
    };

    // Metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };

    this.initialize();
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    if (!this.cacheEnabled) {
      console.warn('⚠️ Redis not configured. Notification caching disabled.');
      return;
    }

    try {
      const redisConfig = {
        url: process.env.REDIS_URL,
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB) || 0,
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
        console.log('🔗 Connecting to Redis...');
      });

      this.redis.on('ready', () => {
        console.log('✅ Redis connection established for notification cache');
        this.isConnected = true;
      });

      this.redis.on('error', (error) => {
        console.error('❌ Redis connection error:', error.message);
        this.isConnected = false;
        this.metrics.errors++;
      });

      this.redis.on('end', () => {
        console.log('🔌 Redis connection closed');
        this.isConnected = false;
      });

      // Connect to Redis
      await this.redis.connect();

    } catch (error) {
      console.error('❌ Failed to initialize Redis for notification cache:', error.message);
      this.isConnected = false;
    }
  }

  /**
   * Check if cache is available
   * @returns {boolean} - Cache availability
   */
  isAvailable() {
    return this.cacheEnabled && this.isConnected && this.redis;
  }

  /**
   * Get user notification preferences from cache
   * @param {string} userId - User ID
   * @returns {Object|null} - User preferences or null
   */
  async getUserPreferences(userId) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const key = this.keyPrefixes.userPreferences + userId;
      const cached = await this.redis.get(key);
      
      if (cached) {
        this.metrics.hits++;
        this.recordCacheMetric('user_preferences', 'hit');
        return JSON.parse(cached);
      }

      this.metrics.misses++;
      this.recordCacheMetric('user_preferences', 'miss');
      return null;

    } catch (error) {
      console.error('❌ Error getting user preferences from cache:', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Cache user notification preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - User preferences
   * @returns {boolean} - Success
   */
  async setUserPreferences(userId, preferences) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const key = this.keyPrefixes.userPreferences + userId;
      await this.redis.setEx(key, this.ttl.userPreferences, JSON.stringify(preferences));
      
      this.metrics.sets++;
      this.recordCacheMetric('user_preferences', 'set');
      return true;

    } catch (error) {
      console.error('❌ Error caching user preferences:', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Get user unread notification count from cache
   * @param {string} userId - User ID
   * @returns {number|null} - Unread count or null
   */
  async getUnreadCount(userId) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const key = this.keyPrefixes.unreadCounts + userId;
      const cached = await this.redis.get(key);
      
      if (cached !== null) {
        this.metrics.hits++;
        this.recordCacheMetric('unread_counts', 'hit');
        return parseInt(cached);
      }

      this.metrics.misses++;
      this.recordCacheMetric('unread_counts', 'miss');
      return null;

    } catch (error) {
      console.error('❌ Error getting unread count from cache:', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Cache user unread notification count
   * @param {string} userId - User ID
   * @param {number} count - Unread count
   * @returns {boolean} - Success
   */
  async setUnreadCount(userId, count) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const key = this.keyPrefixes.unreadCounts + userId;
      await this.redis.setEx(key, this.ttl.unreadCounts, count.toString());
      
      this.metrics.sets++;
      this.recordCacheMetric('unread_counts', 'set');
      return true;

    } catch (error) {
      console.error('❌ Error caching unread count:', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Increment unread count in cache
   * @param {string} userId - User ID
   * @param {number} increment - Increment amount (default: 1)
   * @returns {number|null} - New count or null
   */
  async incrementUnreadCount(userId, increment = 1) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const key = this.keyPrefixes.unreadCounts + userId;
      const newCount = await this.redis.incrBy(key, increment);
      
      // Set TTL if this is a new key
      await this.redis.expire(key, this.ttl.unreadCounts);
      
      this.recordCacheMetric('unread_counts', 'increment');
      return newCount;

    } catch (error) {
      console.error('❌ Error incrementing unread count:', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Decrement unread count in cache
   * @param {string} userId - User ID
   * @param {number} decrement - Decrement amount (default: 1)
   * @returns {number|null} - New count or null
   */
  async decrementUnreadCount(userId, decrement = 1) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const key = this.keyPrefixes.unreadCounts + userId;
      const newCount = Math.max(0, await this.redis.decrBy(key, decrement));
      
      // Update with the corrected count (can't be negative)
      await this.redis.setEx(key, this.ttl.unreadCounts, newCount.toString());
      
      this.recordCacheMetric('unread_counts', 'decrement');
      return newCount;

    } catch (error) {
      console.error('❌ Error decrementing unread count:', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Get notification template from cache
   * @param {string} templateKey - Template key
   * @returns {Object|null} - Template or null
   */
  async getTemplate(templateKey) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const key = this.keyPrefixes.templates + templateKey;
      const cached = await this.redis.get(key);
      
      if (cached) {
        this.metrics.hits++;
        this.recordCacheMetric('templates', 'hit');
        return JSON.parse(cached);
      }

      this.metrics.misses++;
      this.recordCacheMetric('templates', 'miss');
      return null;

    } catch (error) {
      console.error('❌ Error getting template from cache:', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Cache notification template
   * @param {string} templateKey - Template key
   * @param {Object} template - Template data
   * @returns {boolean} - Success
   */
  async setTemplate(templateKey, template) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const key = this.keyPrefixes.templates + templateKey;
      await this.redis.setEx(key, this.ttl.templates, JSON.stringify(template));
      
      this.metrics.sets++;
      this.recordCacheMetric('templates', 'set');
      return true;

    } catch (error) {
      console.error('❌ Error caching template:', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Get delivery status from cache
   * @param {string} notificationId - Notification ID
   * @returns {Object|null} - Delivery status or null
   */
  async getDeliveryStatus(notificationId) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const key = this.keyPrefixes.deliveryStatus + notificationId;
      const cached = await this.redis.get(key);
      
      if (cached) {
        this.metrics.hits++;
        this.recordCacheMetric('delivery_status', 'hit');
        return JSON.parse(cached);
      }

      this.metrics.misses++;
      this.recordCacheMetric('delivery_status', 'miss');
      return null;

    } catch (error) {
      console.error('❌ Error getting delivery status from cache:', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Cache delivery status
   * @param {string} notificationId - Notification ID
   * @param {Object} status - Delivery status
   * @returns {boolean} - Success
   */
  async setDeliveryStatus(notificationId, status) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const key = this.keyPrefixes.deliveryStatus + notificationId;
      await this.redis.setEx(key, this.ttl.deliveryStatus, JSON.stringify(status));
      
      this.metrics.sets++;
      this.recordCacheMetric('delivery_status', 'set');
      return true;

    } catch (error) {
      console.error('❌ Error caching delivery status:', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Get user push tokens from cache
   * @param {string} userId - User ID
   * @returns {Array|null} - Push tokens or null
   */
  async getUserTokens(userId) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const key = this.keyPrefixes.userTokens + userId;
      const cached = await this.redis.get(key);
      
      if (cached) {
        this.metrics.hits++;
        this.recordCacheMetric('user_tokens', 'hit');
        return JSON.parse(cached);
      }

      this.metrics.misses++;
      this.recordCacheMetric('user_tokens', 'miss');
      return null;

    } catch (error) {
      console.error('❌ Error getting user tokens from cache:', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Cache user push tokens
   * @param {string} userId - User ID
   * @param {Array} tokens - Push tokens
   * @returns {boolean} - Success
   */
  async setUserTokens(userId, tokens) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const key = this.keyPrefixes.userTokens + userId;
      await this.redis.setEx(key, this.ttl.userPreferences, JSON.stringify(tokens));
      
      this.metrics.sets++;
      this.recordCacheMetric('user_tokens', 'set');
      return true;

    } catch (error) {
      console.error('❌ Error caching user tokens:', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Invalidate user-related caches
   * @param {string} userId - User ID
   * @returns {boolean} - Success
   */
  async invalidateUserCache(userId) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const keys = [
        this.keyPrefixes.userPreferences + userId,
        this.keyPrefixes.unreadCounts + userId,
        this.keyPrefixes.userTokens + userId,
      ];

      await this.redis.del(keys);
      
      this.metrics.deletes += keys.length;
      this.recordCacheMetric('user_cache', 'invalidate');
      return true;

    } catch (error) {
      console.error('❌ Error invalidating user cache:', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Invalidate template cache
   * @param {string} templateKey - Template key (optional, invalidates all if not provided)
   * @returns {boolean} - Success
   */
  async invalidateTemplateCache(templateKey = null) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      if (templateKey) {
        const key = this.keyPrefixes.templates + templateKey;
        await this.redis.del(key);
        this.metrics.deletes++;
      } else {
        // Invalidate all templates
        const pattern = this.keyPrefixes.templates + '*';
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(keys);
          this.metrics.deletes += keys.length;
        }
      }

      this.recordCacheMetric('templates', 'invalidate');
      return true;

    } catch (error) {
      console.error('❌ Error invalidating template cache:', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUpCache() {
    if (!this.isAvailable()) {
      return;
    }

    try {
      console.log('🔥 Warming up notification cache...');

      // Warm up user preferences for active users
      const activeUsers = await User.find({
        isActive: true,
        lastLoginAt: { $gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      }).select('_id notificationPreferences pushTokens').limit(1000);

      let warmedCount = 0;
      for (const user of activeUsers) {
        // Cache user preferences
        await this.setUserPreferences(user._id.toString(), user.notificationPreferences);
        
        // Cache push tokens
        if (user.pushTokens && user.pushTokens.length > 0) {
          const tokens = user.pushTokens.map(t => t.token);
          await this.setUserTokens(user._id.toString(), tokens);
        }

        // Cache unread counts
        const unreadCount = await Notification.countDocuments({
          recipient: user._id,
          'channels.inApp.read': false
        });
        await this.setUnreadCount(user._id.toString(), unreadCount);

        warmedCount++;
      }

      console.log(`✅ Cache warmed up for ${warmedCount} users`);

    } catch (error) {
      console.error('❌ Error warming up cache:', error);
    }
  }

  /**
   * Record cache metrics to Prometheus
   * @param {string} cacheType - Type of cache operation
   * @param {string} operation - Operation type (hit, miss, set, etc.)
   */
  recordCacheMetric(cacheType, operation) {
    try {
      const prometheusService = getPrometheusService();
      if (prometheusService) {
        prometheusService.recordCacheOperation(cacheType, operation);
      }
    } catch (error) {
      console.error('❌ Failed to record cache metrics:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getStats() {
    const totalOperations = this.metrics.hits + this.metrics.misses;
    const hitRate = totalOperations > 0 ? ((this.metrics.hits / totalOperations) * 100).toFixed(2) : '0';

    return {
      ...this.metrics,
      isConnected: this.isConnected,
      isAvailable: this.isAvailable(),
      hitRate: hitRate + '%',
      totalOperations,
      ttlSettings: this.ttl,
    };
  }

  /**
   * Health check
   * @returns {Object} - Health status
   */
  getHealthStatus() {
    return {
      status: this.isAvailable() ? 'healthy' : 'unavailable',
      isConnected: this.isConnected,
      cacheEnabled: this.cacheEnabled,
      stats: this.getStats(),
    };
  }

  /**
   * Clear all notification caches
   * @returns {boolean} - Success
   */
  async clearAllCaches() {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const patterns = Object.values(this.keyPrefixes).map(prefix => prefix + '*');
      
      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(keys);
          this.metrics.deletes += keys.length;
        }
      }

      console.log('✅ All notification caches cleared');
      return true;

    } catch (error) {
      console.error('❌ Error clearing caches:', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.redis && this.isConnected) {
      await this.redis.quit();
      console.log('✅ Notification cache service closed');
    }
  }
}

// Create singleton instance
const notificationCacheService = new NotificationCacheService();

module.exports = notificationCacheService;