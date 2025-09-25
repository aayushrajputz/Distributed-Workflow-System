import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { setupSocketIO } from './sockets/index';
import { socketService } from './services/socketService';
import { errorHandler, notFound } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiKeyRateLimit } from './middleware/rateLimit';

// Import routes
import authRoutes from './routes/auth';
import apiKeyRoutes from './routes/apiKeys';
import taskRoutes from './routes/tasks';
import workflowRoutes from './routes/workflows';
import workflowTemplateRoutes from './routes/workflowTemplates';
import notificationRoutes from './routes/notifications';
import analyticsRoutes from './routes/analytics';
import integrationRoutes from './routes/integrations';
import webhookRoutes from './routes/webhooks';
import metricsRoutes from './routes/metrics';
import systemRoutes from './routes/system';

// Load environment variables
dotenv.config();

const app = express();
// Only create HTTP and Socket.IO servers when not running tests to avoid open handles in Jest
let server: ReturnType<typeof createServer> | null = null;
let io: SocketIOServer | null = null;
if (process.env.NODE_ENV !== 'test') {
  server = createServer(app);
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });
}

const PORT = process.env.PORT || 5000;

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    process.env.CLIENT_URL || "http://localhost:3000"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Compression
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Request logging for analytics
app.use(requestLogger);

// General rate limiting
if (process.env.NODE_ENV !== 'loadtest') {
  const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/', generalLimiter);
}

// API Key rate limiting for public endpoints
app.use('/api/v1/', apiKeyRateLimit);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/workflow-templates', workflowTemplateRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/system', systemRoutes);

// Public API routes (API key protected)
app.use('/api/v1', metricsRoutes);

// 404 handler
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

// Initialize services
async function startServer() {
  try {
    // Connect to databases (optional for development)
    if (process.env.NODE_ENV !== 'loadtest') {
      try {
        await connectDatabase();
      } catch (error) {
        console.warn('⚠️ MongoDB connection failed, continuing without database:', error instanceof Error ? error.message : String(error));
      }

      try {
        await connectRedis();
      } catch (error) {
        console.warn('⚠️ Redis connection failed, continuing without Redis:', error instanceof Error ? error.message : String(error));
      }
    }

    // Setup Socket.IO
    if (io) {
      socketService.setIO(io);
      setupSocketIO(io);
    }

    // Start server (skip during tests when server is null)
    server?.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`💾 MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured'}`);
      console.log(`🔴 Redis: ${process.env.REDIS_URL ? 'Connected' : 'Not configured'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
if (process.env.NODE_ENV !== 'test') {
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server?.close(() => {
      console.log('✅ Process terminated');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server?.close(() => {
      console.log('✅ Process terminated');
      process.exit(0);
    });
  });
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer();
}

export { app, server, io };