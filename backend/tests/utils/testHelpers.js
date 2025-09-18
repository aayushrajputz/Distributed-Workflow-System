const crypto = require('crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const ApiKey = require('../../models/ApiKey');

/**
 * Request/Response Mocking
 */

const createMockReq = (overrides = {}) => {
  return {
    user: null,
    body: {},
    query: {},
    params: {},
    headers: {},
    ...overrides,
  };
};

const createMockRes = () => {
  const res = {
    statusCode: 200,
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    locals: {},
  };
  return res;
};

const createMockNext = () => {
  return jest.fn();
};

/**
 * Authentication Helpers
 */

const generateJWT = (userId, options = {}) => {
  const payload = {
    userId,
    ...options,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
};

const hashApiKey = (apiKey) => {
  return crypto
    .createHmac('sha256', process.env.API_KEY_SECRET)
    .update(apiKey)
    .digest('hex');
};

/**
 * Database Test Objects
 */

const createTestUser = (overrides = {}) => {
  return {
    _id: new mongoose.Types.ObjectId(),
    email: 'test@example.com',
    password: '$2a$10$testPasswordHash',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    isActive: true,
    isEmailVerified: true,
    ...overrides,
  };
};

const createTestTask = (overrides = {}) => {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return {
    _id: new mongoose.Types.ObjectId(),
    title: 'Test Task',
    description: 'Test task description',
    status: 'pending',
    priority: 'medium',
    dueDate: tomorrow,
    assignedTo: new mongoose.Types.ObjectId(),
    assignedBy: new mongoose.Types.ObjectId(),
    project: 'Test Project',
    estimatedHours: 8,
    progress: 0,
    ...overrides,
  };
};

const createTestApiKey = (overrides = {}) => {
  const apiKey = ApiKey.generateApiKey();
  return {
    _id: new mongoose.Types.ObjectId(),
    name: 'Test API Key',
    keyPrefix: apiKey.substring(0, 8),
    keyHash: hashApiKey(apiKey),
    permissions: ['read'],
    isActive: true,
    ...overrides,
  };
};

/**
 * Mock Factory Functions
 */

const mockWorkflowExecution = (overrides = {}) => {
  return {
    _id: new mongoose.Types.ObjectId(),
    workflowTemplateId: new mongoose.Types.ObjectId(),
    templateVersion: 1,
    status: 'pending',
    steps: [],
    variables: {},
    context: {},
    results: {},
    ...overrides,
  };
};

const mockIntegration = (overrides = {}) => {
  return {
    _id: new mongoose.Types.ObjectId(),
    type: 'slack',
    name: 'Test Integration',
    config: {
      webhookUrl: 'https://hooks.slack.com/test',
    },
    isActive: true,
    ...overrides,
  };
};

/**
 * Assertion Helpers
 */

const expectValidationError = (result, field) => {
  expect(result).toHaveProperty('errors');
  expect(result.errors).toHaveProperty(field);
};

const expectAuthError = (response, code = 'UNAUTHORIZED') => {
  expect(response.statusCode).toBe(401);
  expect(response._getJSONData()).toEqual({
    success: false,
    code,
    message: expect.any(String),
  });
};

const expectRateLimitError = (response) => {
  expect(response.statusCode).toBe(429);
  expect(response._getJSONData()).toEqual({
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: expect.any(String),
  });
};

const expectSuccessResponse = (response, data) => {
  expect(response.statusCode).toBe(200);
  expect(response._getJSONData()).toEqual({
    success: true,
    data,
  });
};

module.exports = {
  createMockReq,
  createMockRes,
  createMockNext,
  generateJWT,
  hashApiKey,
  createTestUser,
  createTestTask,
  createTestApiKey,
  mockWorkflowExecution,
  mockIntegration,
  expectValidationError,
  expectAuthError,
  expectRateLimitError,
  expectSuccessResponse,
};