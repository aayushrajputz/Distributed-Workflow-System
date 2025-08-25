const logger = require('./logger');

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const start = process.hrtime.bigint();
  
  // Add response time header
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        url: req.originalUrl,
        method: req.method,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });
    }
    
    // Add response time header only if headers haven't been sent yet
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
    }
  });
  
  next();
};

// Database query optimization
const optimizeQuery = (query, options = {}) => {
  const {
    limit = 50,
    maxLimit = 100,
    defaultSort = { createdAt: -1 },
    allowedFields = [],
  } = options;
  
  // Apply pagination
  const page = Math.max(1, parseInt(query.page) || 1);
  const pageSize = Math.min(maxLimit, Math.max(1, parseInt(query.limit) || limit));
  const skip = (page - 1) * pageSize;
  
  // Apply sorting
  const sort = query.sort ? JSON.parse(query.sort) : defaultSort;
  
  // Apply field selection
  const select = query.fields ? query.fields.split(',').join(' ') : '';
  
  // Apply filtering
  const filter = { ...query };
  delete filter.page;
  delete filter.limit;
  delete filter.sort;
  delete filter.fields;
  
  return {
    filter,
    options: {
      skip,
      limit: pageSize,
      sort,
      select,
    },
    pagination: {
      page,
      pageSize,
      skip,
    },
  };
};

// Memory usage monitoring
const getMemoryUsage = () => {
  const usage = process.memoryUsage();
  return {
    rss: `${Math.round(usage.rss / 1024 / 1024 * 100) / 100} MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100} MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100} MB`,
    external: `${Math.round(usage.external / 1024 / 1024 * 100) / 100} MB`,
  };
};

// Cache management
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttl = new Map();
  }
  
  set(key, value, ttlMs = 300000) { // 5 minutes default
    this.cache.set(key, value);
    this.ttl.set(key, Date.now() + ttlMs);
  }
  
  get(key) {
    if (!this.cache.has(key)) return null;
    
    const expiry = this.ttl.get(key);
    if (Date.now() > expiry) {
      this.delete(key);
      return null;
    }
    
    return this.cache.get(key);
  }
  
  delete(key) {
    this.cache.delete(key);
    this.ttl.delete(key);
  }
  
  clear() {
    this.cache.clear();
    this.ttl.clear();
  }
  
  // Clean up expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, expiry] of this.ttl.entries()) {
      if (now > expiry) {
        this.delete(key);
      }
    }
  }
}

// Batch processing utility
const batchProcess = async (items, processor, batchSize = 10) => {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
    
    // Add small delay to prevent overwhelming the system
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  return results;
};

// Connection pooling optimization
const optimizeConnections = (mongoose) => {
  // Set connection pool size
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected with optimized settings');
  });
  
  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err);
  });
  
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
};

module.exports = {
  performanceMonitor,
  optimizeQuery,
  getMemoryUsage,
  CacheManager,
  batchProcess,
  optimizeConnections,
};
