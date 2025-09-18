const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

let mongoServer;

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-unit-tests';
process.env.API_KEY_SECRET = 'test-api-key-secret-for-unit-tests';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Global test setup
module.exports = async () => {
  // Start MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Connect Mongoose to the memory server
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Configure Mongoose for testing
  mongoose.set('strictQuery', true);

  // Global mocks setup
  jest.mock('../services/backgroundWorker', () => ({
    taskQueue: {
      add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    },
    notificationQueue: {
      add: jest.fn().mockResolvedValue({ id: 'mock-notification-id' }),
    },
  }));

  jest.mock('../services/notificationService', () => ({
    sendNotification: jest.fn().mockResolvedValue({ success: true }),
    batchNotifications: jest.fn().mockResolvedValue({ success: true }),
  }));

  jest.mock('../services/integrationService', () => ({
    sendSlackNotification: jest.fn().mockResolvedValue({ success: true }),
    createJiraIssue: jest.fn().mockResolvedValue({ success: true }),
    addJiraComment: jest.fn().mockResolvedValue({ success: true }),
  }));

  // Add global test helpers
  global.generateTestToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
  };

  // Add global test cleanup
  global.clearDatabase = async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany();
    }
  };

  // Add global date mock
  const mockDate = new Date('2025-09-18T12:00:00Z');
  global.originalDate = Date;
  global.Date = class extends Date {
    constructor(...args) {
      if (args.length === 0) {
        return mockDate;
      }
      return new global.originalDate(...args);
    }
    static now() {
      return mockDate.getTime();
    }
  };
};

// Cleanup after all tests
module.exports.teardown = async () => {
  await mongoose.disconnect();
  await mongoServer.stop();

  // Restore original Date
  global.Date = global.originalDate;
};