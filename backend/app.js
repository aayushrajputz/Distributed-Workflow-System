const express = require('express');
const cors = require('cors');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

// Import configurations and utilities
const { errorHandler } = require('./middleware/errorHandler');
const { 
  corsConfig, 
  requestSizeLimit, 
  sanitizeInput, 
  securityMiddleware, 
  securityHeaders, 
  securityLogger, 
  csrfProtection,
  issueCsrfToken,
} = require('./middleware/security');
const { 
  generalRateLimiter, 
  authRateLimiter, 
  apiKeyRateLimiter, 
  sensitiveRateLimiter 
} = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const noteRoutes = require('./routes/notes');
const shareRoutes = require('./routes/share');
const apiKeyRoutes = require('./routes/apiKeys');
const integrationRoutes = require('./routes/integrations');
const analyticsRoutes = require('./routes/analytics');
const publicApiRoutes = require('./routes/publicApi');
const systemRoutes = require('./routes/system');
const taskRoutes = require('./routes/tasks');
const notificationRoutes = require('./routes/notifications');
const userRoutes = require('./routes/users');
const metricsRoutes = require('./routes/metrics');
const zapierWebhookRoutes = require('./routes/webhook-zapier');
const githubWebhookRoutes = require('./routes/webhook-github');
const webhooksRoutes = require('./routes/webhooks');

// Initialize Express app
const app = express();

// Configure trust proxy for proper IP resolution
app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

// Apply security measures for input sanitization
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());
app.use(sanitizeInput);

// Security logging middleware (should be first to log all requests)
app.use(securityLogger);

// Cookie parsing middleware
app.use(cookieParser(process.env.COOKIE_SECRET || undefined));

// CORS configuration
app.use(cors(corsConfig));

// Apply comprehensive security middleware stack
app.use(securityMiddleware);
app.use(securityHeaders);

// Apply rate limiters
app.use(generalRateLimiter); // Apply general rate limiter to all routes

// Body parsing middleware with size limits
app.use(express.json(requestSizeLimit));
app.use(express.urlencoded(requestSizeLimit));

// CSRF token issuance and protection
app.use(issueCsrfToken);
app.use(csrfProtection);

// CSRF token endpoint for clients that cannot read cookies
app.get('/csrf-token', (req, res) => {
  const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || '_csrf';
  res.json({ token: req.cookies[CSRF_COOKIE_NAME] });
});

// Compression middleware
app.use(compression());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// API routes with specific rate limiters
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/notes', shareRoutes);
app.use('/api/keys', sensitiveRateLimiter, apiKeyRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/system', sensitiveRateLimiter, systemRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', sensitiveRateLimiter, userRoutes);
app.use('/api/integrations', sensitiveRateLimiter, integrationRoutes);
app.use('/api/v1', apiKeyRateLimiter, publicApiRoutes); // Public API endpoints with API key rate limiting
app.use('/api/v1/metrics', metricsRoutes); // Prometheus metrics endpoints
app.use('/webhook/zapier', zapierWebhookRoutes);
app.use('/webhook/github', githubWebhookRoutes);
app.use('/webhook', webhooksRoutes);

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Workflow Management System API',
    version: '1.0.0',
    description: 'Complete API for notes collaboration with API key management',
    baseUrl: `${req.protocol}://${req.get('host')}`,
    authentication: {
      dashboard: 'JWT Bearer token in Authorization header',
      publicApi: 'API key in X-API-Key header',
    },
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register a new user',
        'POST /api/auth/login': 'Login user',
        'GET /api/auth/me': 'Get current user profile',
      },
      notes: {
        'GET /api/notes': 'Get user notes',
        'POST /api/notes': 'Create new note',
        'GET /api/notes/:id': 'Get specific note',
        'PUT /api/notes/:id': 'Update note',
        'DELETE /api/notes/:id': 'Delete note',
      },
      apiKeys: {
        'GET /api/keys': 'Get all API keys',
        'POST /api/keys': 'Create new API key',
        'GET /api/keys/:id': 'Get API key details',
        'PUT /api/keys/:id': 'Update API key',
        'POST /api/keys/:id/regenerate': 'Regenerate API key',
        'DELETE /api/keys/:id': 'Delete API key',
      },
      analytics: {
        'GET /api/analytics/usage': 'Get usage statistics',
        'GET /api/analytics/endpoints': 'Get endpoint statistics',
        'GET /api/analytics/daily': 'Get daily usage',
        'GET /api/analytics/logs': 'Get recent logs',
        'GET /api/analytics/dashboard': 'Get dashboard data',
      },
      publicApi: {
        'GET /api/v1/notes': 'Get notes (public API)',
        'POST /api/v1/notes': 'Create note (public API)',
        'GET /api/v1/notes/:id': 'Get note (public API)',
        'PUT /api/v1/notes/:id': 'Update note (public API)',
        'DELETE /api/v1/notes/:id': 'Delete note (public API)',
        'GET /api/v1/analytics': 'Get analytics (public API)',
        'GET /api/v1/status': 'Get API status',
      },
      metrics: {
        'GET /api/v1/metrics': 'Get Prometheus metrics (text format)',
        'GET /api/v1/metrics/system': 'Get system metrics (JSON)',
        'GET /api/v1/metrics/nodes': 'Get distributed nodes metrics',
        'GET /api/v1/metrics/api': 'Get API metrics',
        'GET /api/v1/metrics/tasks': 'Get task metrics',
        'GET /api/v1/metrics/dashboard': 'Get comprehensive dashboard metrics',
      },
    },
    rateLimit: {
      general: '100 requests per 15 minutes per IP',
      apiKey: 'Configurable per API key (default: 100/hour)',
    },
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Workflow Management System with API Platform',
    version: '1.0.0',
    features: [
      'Real-time Notes Collaboration',
      'API Key Management',
      'Public API Access',
      'Usage Analytics',
      'Rate Limiting',
    ],
    documentation: '/api/docs',
    health: '/health',
    endpoints: {
      auth: '/api/auth',
      notes: '/api/notes',
      apiKeys: '/api/keys',
      analytics: '/api/analytics',
      publicApi: '/api/v1',
    },
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

module.exports = app;