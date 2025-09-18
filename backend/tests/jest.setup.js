// Extend Jest matchers if needed
require('jest-extended');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-unit-tests';
process.env.API_KEY_SECRET = 'test-api-key-secret-for-unit-tests';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Silence console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Set default test timeout
jest.setTimeout(10000);

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