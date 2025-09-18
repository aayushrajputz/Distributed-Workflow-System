const nock = require('nock');
const http = require('http');
const { Server } = require('socket.io');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { createServer } = require('http');
const Client = require('socket.io-client');
const { promisify } = require('util');

// Additional test environment variables for integration tests
process.env.GITHUB_WEBHOOK_SECRET = 'test-github-webhook-secret';
process.env.ZAPIER_WHITELIST = 'localhost,.company.com';
process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test-webhook';
process.env.JIRA_DOMAIN = 'test-domain.atlassian.net';

// Configure nock for HTTP mocking
nock.disableNetConnect();
nock.enableNetConnect('127.0.0.1');
nock.enableNetConnect('localhost');

// MongoDB setup
let mongod;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

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

global.waitForSocketEvent = (socket, event, timeout = 1000) => {
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

// HTTP request mocking helpers
global.mockSlackWebhook = () => {
  return nock('https://hooks.slack.com')
    .post('/test-webhook')
    .reply(200, 'ok');
};

global.mockJiraAPI = (domain = 'test-domain.atlassian.net') => {
  return nock(`https://${domain}`).persist();
};

global.mockGitHubAPI = () => {
  return nock('https://api.github.com').persist();
};

// Integration test data helpers
global.createTestIntegration = async (userId, type, config) => {
  const Integration = require('../../models/Integration');
  return Integration.create({
    userId,
    type,
    config,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });
};

global.createTestApiKey = async (userId, permissions = ['read', 'write']) => {
  const ApiKey = require('../../models/ApiKey');
  const { key, hash } = await ApiKey.generateApiKey();
  
  await ApiKey.create({
    userId,
    key: hash,
    name: 'Test API Key',
    permissions,
    isActive: true,
    lastUsed: new Date(),
    createdAt: new Date()
  });

  return key;
};

// Performance testing helpers
global.measureExecutionTime = async (fn) => {
  const start = process.hrtime();
  const result = await fn();
  const [seconds, nanoseconds] = process.hrtime(start);
  const duration = seconds * 1000 + nanoseconds / 1e6;

  return {
    result,
    duration
  };
};

// Add global test utilities
global.sleep = promisify(setTimeout);
global.getRandomPort = () => {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
};

// Cleanup utilities
afterEach(async () => {
  nock.cleanAll();
  await mongoose.connection.db.dropDatabase();
});