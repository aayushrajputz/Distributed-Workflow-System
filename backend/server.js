require('dotenv').config();

// Import validation utilities
const { validateEnvironment, validateSecurityConfig } = require('./config/validation');

// Validate environment and security configuration
try {
  validateEnvironment();
  validateSecurityConfig();
} catch (error) {
  console.error('❌ Configuration validation failed:', error.message);
  process.exit(1);
}

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Import configurations and utilities
const connectDB = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const { createRateLimiters, securityHeaders, sanitizeInput, corsConfig, requestSizeLimit } = require('./middleware/security');
const noteSocketHandler = require('./sockets/noteSocket');
const TaskSocketHandler = require('./sockets/taskSocket');
const notificationService = require('./services/notificationService');
const workflowEngine = require('./services/workflowEngine');
const overdueScanner = require('./services/overdueScanner');
const digestService = require('./services/digestService');
const { getPrometheusService } = require('./services/prometheusService');

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
const server = http.createServer(app);

// Initialize Socket.io with security
const io = socketIo(server, {
  cors: {
    origin: 'distributed-workflow-system.vercel.app' || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: false,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Connect to MongoDB
connectDB();

// Initialize Prometheus metrics service
getPrometheusService();
console.log('📊 Prometheus metrics service initialized');

// Security middleware
// app.use(securityHeaders);

// CORS configuration
app.use(cors(corsConfig));

// Input sanitization
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Rate limiting
// const rateLimiters = createRateLimiters();
// app.use('/api/', rateLimiters.general);
// app.use('/api/auth', rateLimiters.auth);
// app.use('/api/v1', rateLimiters.apiKey);

// Body parsing middleware with size limits
app.use(express.json(requestSizeLimit));
app.use(express.urlencoded(requestSizeLimit));

// Input sanitization middleware
app.use(sanitizeInput);

// Performance monitoring
// const { performanceMonitor } = require('./utils/performance');
// app.use(performanceMonitor);

// Compression middleware
app.use(compression());

// Logging middleware
// const logger = require('./utils/logger');
// app.use(morgan('combined', { stream: logger.stream }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/notes', shareRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/v1', publicApiRoutes); // Public API endpoints
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

// Initialize Socket.io handlers
noteSocketHandler(io);

// Initialize task socket handler and notification service
new TaskSocketHandler(io);
notificationService.initialize(io);

// Start workflow engine
workflowEngine.start();

// Start periodic overdue scanner
overdueScanner.start();
digestService.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
🚀 Server running in ${process.env.NODE_ENV || 'development'} mode
📡 HTTP Server: http://localhost:${PORT}
🔌 Socket.io: Ready for real-time connections
📊 Health Check: http://localhost:${PORT}/health
  `);
});

module.exports = { app, server, io };
