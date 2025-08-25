const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Rate limiting configurations
const createRateLimiters = () => {
  // General API rate limiter
  const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    message: {
      error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/health') || req.path.startsWith('/metrics'),
  });

  // Stricter rate limiter for authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: {
      error: 'Too many authentication attempts, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // API key rate limiter
  const apiKeyLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.API_KEY_RATE_LIMIT, 10) || 1000,
    message: {
      error: 'API key rate limit exceeded.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
  });

  // Strict rate limiter for sensitive operations
  const sensitiveLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 attempts per hour
    message: {
      error: 'Too many sensitive operations, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/health'),
  });

  return {
    general: generalLimiter,
    auth: authLimiter,
    apiKey: apiKeyLimiter,
    sensitive: sensitiveLimiter,
  };
};

// Security headers configuration
const securityHeaders = helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Sanitize MongoDB query operators
  if (req.body) {
    const sanitized = JSON.parse(JSON.stringify(req.body));
    req.body = sanitized;
  }

  if (req.query) {
    const sanitized = JSON.parse(JSON.stringify(req.query));
    req.query = sanitized;
  }

  // Sanitize headers
  if (req.headers) {
    // Remove potentially dangerous headers
    delete req.headers['x-forwarded-for'];
    delete req.headers['x-real-ip'];
  }

  next();
};

// CSRF protection middleware
const csrfProtection = (req, res, next) => {
  // Skip CSRF for API endpoints that use API keys
  if (req.path.startsWith('/api/v1/') || req.headers['x-api-key']) {
    return next();
  }

  // For browser requests, check CSRF token
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
    return res.status(403).json({
      error: 'CSRF token validation failed',
      code: 'CSRF_ERROR',
    });
  }

  next();
};

// Request size limiting
const requestSizeLimit = {
  limit: '10mb',
  extended: true,
  parameterLimit: 1000,
  arrayLimit: 100,
};

// CORS configuration
const corsConfig = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.CLIENT_URL,
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean);

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-CSRF-Token',
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400, // 24 hours
};

// Security middleware stack
const securityMiddleware = [
  securityHeaders,
  mongoSanitize(),
  xss(),
  hpp(),
  sanitizeInput,
];

// Logging middleware for security events
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log suspicious requests
  const suspiciousPatterns = [
    /\.\.\//, // Directory traversal
    /<script/i, // XSS attempts
    /javascript:/i, // JavaScript injection
    /on\w+\s*=/i, // Event handler injection
  ];

  const userAgent = req.headers['user-agent'] || '';
  const url = req.url;
  const method = req.method;

  // Check for suspicious patterns
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(url) || pattern.test(userAgent)
  );

  if (isSuspicious) {
    console.warn('🚨 Suspicious request detected:', {
      ip: req.ip,
      userAgent,
      url,
      method,
      timestamp: new Date().toISOString(),
    });
  }

  // Log response time for performance monitoring
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (duration > 5000) { // Log slow requests
      console.warn('🐌 Slow request detected:', {
        ip: req.ip,
        url,
        method,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
      });
    }
  });

  next();
};

module.exports = {
  createRateLimiters,
  securityHeaders,
  sanitizeInput,
  csrfProtection,
  corsConfig,
  requestSizeLimit,
  securityMiddleware,
  securityLogger,
};