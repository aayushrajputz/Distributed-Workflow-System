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

const http = require('http');
const socketIo = require('socket.io');

// Import the Express app
const app = require('./app');

// Import configurations and utilities
const connectDB = require('./config/database');
const noteSocketHandler = require('./sockets/noteSocket');
const TaskSocketHandler = require('./sockets/taskSocket');
const notificationService = require('./services/notificationService');
const workflowEngine = require('./services/workflowEngine');
const overdueScanner = require('./services/overdueScanner');
const digestService = require('./services/digestService');
const { getPrometheusService } = require('./services/prometheusService');

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io with security
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
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

// Initialize Socket.io handlers
noteSocketHandler(io);

// Initialize task socket handler and notification service
try {
  new TaskSocketHandler(io);
  console.log('✅ TaskSocketHandler initialized successfully');
  
  // Initialize notification service with proper error handling
  notificationService.initialize(io);
  console.log('✅ NotificationService initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize socket handlers or notification service:', error);
  // Graceful degradation - continue without real-time features
  console.warn('⚠️ Continuing without real-time notification features');
}

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