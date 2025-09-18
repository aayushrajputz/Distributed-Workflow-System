const mongoose = require('mongoose');
const crypto = require('crypto');
const { adminUser, regularUser } = require('./users');

// Helper to generate consistent API key hashes for testing
const generateTestApiKey = (prefix = 'sk_test') => {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  return `${prefix}_${randomBytes}`;
};

/**
 * API Key factory function
 */
const createApiKey = (userId, permissions = ['read'], overrides = {}) => {
  const apiKey = generateTestApiKey();
  return {
    _id: new mongoose.Types.ObjectId(),
    name: 'Test API Key',
    keyPrefix: apiKey.substring(0, 8),
    keyHash: crypto
      .createHmac('sha256', process.env.API_KEY_SECRET || 'test-secret')
      .update(apiKey)
      .digest('hex'),
    userId: userId || regularUser._id,
    permissions,
    isActive: true,
    environment: 'test',
    lastUsedAt: null,
    metadata: {},
    rateLimit: {
      requestsPerHour: 1000,
      requestsPerDay: 10000,
    },
    createdAt: new Date('2025-09-18T10:00:00Z'),
    ...overrides,
  };
};

/**
 * Predefined API key fixtures
 */
const activeApiKey = createApiKey(regularUser._id, ['read'], {
  name: 'Active API Key',
});

const adminApiKey = createApiKey(adminUser._id, ['admin'], {
  name: 'Admin API Key',
});

const expiredApiKey = createApiKey(regularUser._id, ['read'], {
  name: 'Expired API Key',
  expiresAt: new Date('2025-09-17T00:00:00Z'),
});

const inactiveApiKey = createApiKey(regularUser._id, ['read'], {
  name: 'Inactive API Key',
  isActive: false,
});

const rateLimitedApiKey = createApiKey(regularUser._id, ['read'], {
  name: 'Rate Limited API Key',
  rateLimit: {
    requestsPerHour: 10,
    requestsPerDay: 100,
  },
});

const recentlyUsedApiKey = createApiKey(regularUser._id, ['read', 'write'], {
  name: 'Recently Used API Key',
  lastUsedAt: new Date('2025-09-18T09:00:00Z'),
});

module.exports = {
  createApiKey,
  generateTestApiKey,
  activeApiKey,
  adminApiKey,
  expiredApiKey,
  inactiveApiKey,
  rateLimitedApiKey,
  recentlyUsedApiKey,
};