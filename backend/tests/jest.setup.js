// Load test environment variables
require('dotenv').config({ path: '.env.test' });

// Extend Jest matchers if needed
require('jest-extended');

const nock = require('nock');
const { Server } = require('socket.io');
const { createServer } = require('http');
const Client = require('socket.io-client');
const { promisify } = require('util');

// Override any missing test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-unit-tests-that-is-at-least-32-characters-long';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/workflow_test';
process.env.API_KEY_SECRET = process.env.API_KEY_SECRET || 'test-api-key-secret-for-unit-tests';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.GITHUB_WEBHOOK_SECRET = 'test-github-webhook-secret';
process.env.ZAPIER_WHITELIST = 'localhost,.company.com';
process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test-webhook';
process.env.JIRA_DOMAIN = 'test-domain.atlassian.net';

// Silence console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Configure nock for HTTP mocking
nock.disableNetConnect();
nock.enableNetConnect('127.0.0.1');
nock.enableNetConnect('localhost');

// Socket testing utilities
global.createTestSocketServer = async (handler) => {
  const httpServer = createServer();
  const io = new Server(httpServer);
  handler(io);
  
  await new Promise(resolve => httpServer.listen(0, resolve));
  const port = httpServer.address().port;
  
  return {
    io,
    httpServer,
    port,
    url: `http://localhost:${port}`
  };
};

global.createTestSocketClient = async (url, token) => {
  const client = Client(url, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true
  });

  await new Promise((resolve, reject) => {
    client.on('connect', resolve);
    client.on('connect_error', reject);
  });

  return client;
};

global.waitForSocketEvent = (socket, event, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    socket.once(event, (...args) => {
      clearTimeout(timer);
      resolve(args);
    });
  });
};

// Set test timeout based on test suite
const timeout = process.env.TEST_SUITE === 'integration' ? 30000 : 10000;
jest.setTimeout(timeout);

// Add custom matchers
expect.extend({
  toBeValidObjectId(received) {
    const pass = /^[0-9a-fA-F]{24}$/.test(received);
    return {
      pass,
      message: () =>
        `expected ${received} to ${pass ? 'not ' : ''}be a valid ObjectId`,
    };
  },
});