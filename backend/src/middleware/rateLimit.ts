import rateLimit from 'express-rate-limit';
// import slowDown from 'express-slow-down';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { CacheService } from '../config/redis';

const cache = CacheService.getInstance();

// General rate limiting
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use forwarded IP if behind proxy
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
});

// Stricter rate limiting for auth endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Slow down repeated requests - temporarily disabled
// export const speedLimiter = slowDown({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   delayAfter: 50, // Allow 50 requests per windowMs without delay
//   delayMs: 500, // Add 500ms delay per request after delayAfter
//   maxDelayMs: 20000, // Maximum delay of 20 seconds
// });
export const speedLimiter = (req: Request, res: Response, next: NextFunction) => next(); // Placeholder

// API Key specific rate limiting
export const apiKeyRateLimit = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const apiKeyHeader = req.headers['x-api-key'] as string;
    
    if (!apiKeyHeader) {
      return next(); // Let the auth middleware handle missing API key
    }

    // Create rate limit keys
    const hourKey = `api_key_rate_limit:hour:${apiKeyHeader}`;
    const dayKey = `api_key_rate_limit:day:${apiKeyHeader}`;
    
    // Get current counts
    const hourCount = await cache.increment(hourKey, 3600); // 1 hour TTL
    const dayCount = await cache.increment(dayKey, 86400); // 24 hour TTL
    
    // Default limits (will be overridden by actual API key limits)
    let hourLimit = 1000;
    let dayLimit = 10000;
    
    // If we have the API key object, use its specific limits
    if (req.apiKey) {
      hourLimit = req.apiKey.rateLimit.requestsPerHour;
      dayLimit = req.apiKey.rateLimit.requestsPerDay;
    }
    
    // Check hourly limit
    if (hourCount > hourLimit) {
      return res.status(429).json({
        success: false,
        error: 'API key hourly rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        limits: {
          hourly: hourLimit,
          daily: dayLimit
        },
        usage: {
          hourly: hourCount,
          daily: dayCount
        },
        retryAfter: 3600 // 1 hour in seconds
      });
    }
    
    // Check daily limit
    if (dayCount > dayLimit) {
      return res.status(429).json({
        success: false,
        error: 'API key daily rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        limits: {
          hourly: hourLimit,
          daily: dayLimit
        },
        usage: {
          hourly: hourCount,
          daily: dayCount
        },
        retryAfter: 86400 // 24 hours in seconds
      });
    }
    
    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit-Hour': hourLimit.toString(),
      'X-RateLimit-Remaining-Hour': Math.max(0, hourLimit - hourCount).toString(),
      'X-RateLimit-Limit-Day': dayLimit.toString(),
      'X-RateLimit-Remaining-Day': Math.max(0, dayLimit - dayCount).toString(),
      'X-RateLimit-Reset-Hour': new Date(Date.now() + 3600000).toISOString(),
      'X-RateLimit-Reset-Day': new Date(Date.now() + 86400000).toISOString()
    });
    
    next();
  } catch (error) {
    console.error('API key rate limit error:', error);
    // Don't block requests if rate limiting fails
    next();
  }
};

// User-specific rate limiting (for authenticated endpoints)
export const userRateLimit = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(); // Let auth middleware handle missing user
    }

    const userId = req.user._id.toString();
    const hourKey = `user_rate_limit:hour:${userId}`;
    const dayKey = `user_rate_limit:day:${userId}`;
    
    // Get current counts
    const hourCount = await cache.increment(hourKey, 3600); // 1 hour TTL
    const dayCount = await cache.increment(dayKey, 86400); // 24 hour TTL
    
    // User limits (more generous than IP-based limits)
    const hourLimit = 2000;
    const dayLimit = 20000;
    
    // Check limits
    if (hourCount > hourLimit) {
      return res.status(429).json({
        success: false,
        error: 'User hourly rate limit exceeded',
        retryAfter: 3600
      });
    }
    
    if (dayCount > dayLimit) {
      return res.status(429).json({
        success: false,
        error: 'User daily rate limit exceeded',
        retryAfter: 86400
      });
    }
    
    // Add headers
    res.set({
      'X-RateLimit-User-Limit-Hour': hourLimit.toString(),
      'X-RateLimit-User-Remaining-Hour': Math.max(0, hourLimit - hourCount).toString(),
      'X-RateLimit-User-Limit-Day': dayLimit.toString(),
      'X-RateLimit-User-Remaining-Day': Math.max(0, dayLimit - dayCount).toString()
    });
    
    next();
  } catch (error) {
    console.error('User rate limit error:', error);
    // Don't block requests if rate limiting fails
    next();
  }
};

// Endpoint-specific rate limiting
export const createEndpointRateLimit = (maxRequests: number, windowMs: number, message?: string) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    message: {
      error: message || `Too many requests to this endpoint, please try again later.`,
      retryAfter: Math.ceil(windowMs / 1000) + ' seconds'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Burst protection for expensive operations
export const burstProtection = createEndpointRateLimit(10, 60 * 1000, 'Too many requests, please slow down');

// File upload rate limiting
export const uploadRateLimit = createEndpointRateLimit(5, 60 * 1000, 'Too many file uploads, please wait');

// Export commonly used rate limiters
export const rateLimiters = {
  general: generalRateLimit,
  auth: authRateLimit,
  speed: speedLimiter,
  apiKey: apiKeyRateLimit,
  user: userRateLimit,
  burst: burstProtection,
  upload: uploadRateLimit
};
