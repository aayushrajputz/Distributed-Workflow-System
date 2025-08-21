const rateLimit = require('express-rate-limit');

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map();

// Custom rate limiter for API keys
const createApiKeyRateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 60 * 1000, // 1 hour
    defaultMax = 100, // default requests per window
    message = 'Rate limit exceeded. Please try again later.',
    standardHeaders = true,
    legacyHeaders = false,
  } = options;

  return async (req, res, next) => {
    try {
      if (!req.apiKey) {
        return next(); // Skip if no API key (should be caught by auth middleware)
      }

      const apiKeyId = req.apiKey._id.toString();
      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const key = `${apiKeyId}:${windowStart}`;

      // Get rate limit for this API key
      const maxRequests = req.apiKey.rateLimit?.requestsPerHour || defaultMax;

      // Get current count
      let requestCount = rateLimitStore.get(key) || 0;
      requestCount++;

      // Store updated count
      rateLimitStore.set(key, requestCount);

      // Clean up old entries (simple cleanup)
      if (Math.random() < 0.01) { // 1% chance to cleanup
        const cutoff = now - windowMs * 2; // Keep 2 windows worth
        for (const [storeKey] of rateLimitStore) {
          const [, timestamp] = storeKey.split(':');
          if (parseInt(timestamp) < cutoff) {
            rateLimitStore.delete(storeKey);
          }
        }
      }

      // Set rate limit headers
      const remaining = Math.max(0, maxRequests - requestCount);
      const resetTime = new Date(windowStart + windowMs);

      if (standardHeaders) {
        res.set({
          'RateLimit-Limit': maxRequests,
          'RateLimit-Remaining': remaining,
          'RateLimit-Reset': Math.ceil(resetTime.getTime() / 1000),
          'RateLimit-Policy': `${maxRequests};w=${windowMs / 1000}`,
        });
      }

      if (legacyHeaders) {
        res.set({
          'X-RateLimit-Limit': maxRequests,
          'X-RateLimit-Remaining': remaining,
          'X-RateLimit-Reset': resetTime.toISOString(),
        });
      }

      // Check if rate limit exceeded
      if (requestCount > maxRequests) {
        return res.status(429).json({
          success: false,
          message,
          code: 'RATE_LIMIT_EXCEEDED',
          details: {
            limit: maxRequests,
            window: `${windowMs / 1000}s`,
            resetAt: resetTime.toISOString(),
            retryAfter: Math.ceil((resetTime.getTime() - now) / 1000),
          },
        });
      }

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Don't block request on rate limiting errors
      next();
    }
  };
};

// Standard rate limiter for auth endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    code: 'GENERAL_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  createApiKeyRateLimiter,
  authRateLimiter,
  generalRateLimiter,
};
