const logger = require('../utils/logger');

// Error classification
const classifyError = (error) => {
  if (error.name === 'ValidationError') {
    return { type: 'VALIDATION_ERROR', status: 400 };
  }
  if (error.name === 'CastError') {
    return { type: 'INVALID_ID', status: 400 };
  }
  if (error.name === 'MongoError' && error.code === 11000) {
    return { type: 'DUPLICATE_KEY', status: 409 };
  }
  if (error.name === 'JsonWebTokenError') {
    return { type: 'INVALID_TOKEN', status: 401 };
  }
  if (error.name === 'TokenExpiredError') {
    return { type: 'TOKEN_EXPIRED', status: 401 };
  }
  if (error.name === 'MulterError') {
    return { type: 'FILE_UPLOAD_ERROR', status: 400 };
  }
  if (error.name === 'SyntaxError' && error.status === 400) {
    return { type: 'INVALID_JSON', status: 400 };
  }
  if (error.name === 'TypeError' && error.message.includes('Cannot read property')) {
    return { type: 'INVALID_REQUEST', status: 400 };
  }
  
  return { type: 'INTERNAL_ERROR', status: 500 };
};

// Error response formatter
const formatErrorResponse = (error, classification, isDevelopment) => {
  const baseResponse = {
    success: false,
    error: {
      type: classification.type,
      message: classification.type === 'INTERNAL_ERROR' && !isDevelopment 
        ? 'An internal server error occurred' 
        : error.message,
      timestamp: new Date().toISOString(),
    },
  };

  // Add additional details in development
  if (isDevelopment) {
    baseResponse.error.stack = error.stack;
    baseResponse.error.name = error.name;
    baseResponse.error.code = error.code;
  }

  // Add validation details for validation errors
  if (classification.type === 'VALIDATION_ERROR' && error.errors) {
    baseResponse.error.details = Object.keys(error.errors).map(key => ({
      field: key,
      message: error.errors[key].message,
      value: error.errors[key].value,
    }));
  }

  // Add duplicate key details
  if (classification.type === 'DUPLICATE_KEY') {
    const field = Object.keys(error.keyPattern)[0];
    baseResponse.error.details = {
      field,
      value: error.keyValue[field],
      message: `${field} already exists`,
    };
  }

  return baseResponse;
};

// Main error handler middleware
const errorHandler = (error, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const classification = classifyError(error);
  
  // Log error with context
  const logContext = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id,
    },
    classification,
    timestamp: new Date().toISOString(),
  };

  // Log based on error severity
  if (classification.status >= 500) {
    logger.error('Server Error:', logContext);
  } else if (classification.status >= 400) {
    logger.warn('Client Error:', logContext);
  } else {
    logger.info('Application Error:', logContext);
  }

  // Format error response
  const errorResponse = formatErrorResponse(error, classification, isDevelopment);

  // Set appropriate headers
  res.status(classification.status);
  
  // Add security headers for error responses
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  });

  // Send error response
  res.json(errorResponse);
};

// 404 handler
const notFoundHandler = (req, res) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.name = 'NotFoundError';
  error.status = 404;
  
  logger.warn('Route not found:', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(404).json({
    success: false,
    error: {
      type: 'NOT_FOUND',
      message: 'The requested resource was not found',
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
    },
  });
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = req.validationErrors();
  if (errors) {
    const error = new Error('Validation failed');
    error.name = 'ValidationError';
    error.errors = errors;
    error.status = 400;
    return next(error);
  }
  next();
};

// Rate limit error handler
const handleRateLimitError = (req, res) => {
  res.status(429).json({
    success: false,
    error: {
      type: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      retryAfter: res.getHeader('Retry-After'),
      timestamp: new Date().toISOString(),
    },
  });
};

// Database connection error handler
const handleDatabaseError = (error) => {
  logger.error('Database connection error:', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });

  // In production, you might want to gracefully shutdown
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
};

// Unhandled promise rejection handler
const handleUnhandledRejection = (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
    timestamp: new Date().toISOString(),
  });

  // In production, you might want to gracefully shutdown
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
};

// Uncaught exception handler
const handleUncaughtException = (error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });

  // In production, you might want to gracefully shutdown
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
};

// Setup global error handlers
const setupGlobalErrorHandlers = () => {
  process.on('unhandledRejection', handleUnhandledRejection);
  process.on('uncaughtException', handleUncaughtException);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleValidationErrors,
  handleRateLimitError,
  handleDatabaseError,
  setupGlobalErrorHandlers,
};
