const mongoose = require('mongoose');
const ApiKey = require('../../models/ApiKey');
const UsageLog = require('../../models/UsageLog');
const { 
  createApiKey, 
  activeApiKey, 
  adminApiKey, 
  expiredApiKey, 
  rateLimitedApiKey 
} = require('../fixtures/apiKeys');
const { regularUser, adminUser } = require('../fixtures/users');

describe('ApiKey Model', () => {
  // Connect to the in-memory database before tests
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI);
  });

  // Clear all data after each test
  afterEach(async () => {
    await ApiKey.deleteMany({});
    await UsageLog.deleteMany({});
  });

  // Disconnect after all tests
  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe('Schema Validation', () => {
    it('should create a valid API key with all required fields', async () => {
      const apiKey = new ApiKey(activeApiKey);
      const validationError = apiKey.validateSync();
      expect(validationError).toBeUndefined();
    });

    it('should require name field', async () => {
      const apiKeyData = createApiKey(regularUser._id, ['read'], { name: undefined });
      const apiKey = new ApiKey(apiKeyData);
      const validationError = apiKey.validateSync();
      expect(validationError.errors.name).toBeDefined();
    });

    it('should require keyHash field', async () => {
      const apiKeyData = createApiKey(regularUser._id, ['read'], { keyHash: undefined });
      const apiKey = new ApiKey(apiKeyData);
      const validationError = apiKey.validateSync();
      expect(validationError.errors.keyHash).toBeDefined();
    });

    it('should validate permissions array', async () => {
      const apiKeyData = createApiKey(regularUser._id, ['invalid']);
      const apiKey = new ApiKey(apiKeyData);
      const validationError = apiKey.validateSync();
      expect(validationError.errors['permissions.0']).toBeDefined();
    });

    it('should enforce name length limit', async () => {
      const longName = 'a'.repeat(101);
      const apiKeyData = createApiKey(regularUser._id, ['read'], { name: longName });
      const apiKey = new ApiKey(apiKeyData);
      const validationError = apiKey.validateSync();
      expect(validationError.errors.name).toBeDefined();
    });
  });

  describe('Static Methods', () => {
    it('should generate unique API keys', () => {
      const key1 = ApiKey.generateApiKey();
      const key2 = ApiKey.generateApiKey();
      expect(key1).not.toEqual(key2);
      expect(key1).toMatch(/^sk_test_[a-zA-Z0-9]{24,}$/);
    });

    it('should hash API keys consistently', () => {
      const testKey = 'sk_test_abc123';
      const hash1 = ApiKey.hashApiKey(testKey);
      const hash2 = ApiKey.hashApiKey(testKey);
      expect(hash1).toEqual(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });
  });

  describe('Instance Methods', () => {
    let apiKey;

    beforeEach(async () => {
      apiKey = new ApiKey(activeApiKey);
      await apiKey.save();
    });

    it('should update lastUsedAt timestamp', async () => {
      const beforeUpdate = apiKey.lastUsedAt;
      await apiKey.updateLastUsed();
      expect(apiKey.lastUsedAt).not.toEqual(beforeUpdate);
    });

    it('should check if API key is valid', async () => {
      expect(apiKey.isValid()).toBe(true);

      const inactiveKey = new ApiKey(createApiKey(regularUser._id, ['read'], { isActive: false }));
      expect(inactiveKey.isValid()).toBe(false);

      const expiredKey = new ApiKey(expiredApiKey);
      expect(expiredKey.isValid()).toBe(false);
    });

    it('should get usage stats with date range', async () => {
      // Create some usage logs
      await UsageLog.create([
        {
          apiKeyId: apiKey._id,
          endpoint: '/api/test',
          method: 'GET',
          status: 200,
          timestamp: new Date('2025-09-18T10:00:00Z'),
        },
        {
          apiKeyId: apiKey._id,
          endpoint: '/api/test',
          method: 'POST',
          status: 400,
          timestamp: new Date('2025-09-18T11:00:00Z'),
        }
      ]);

      const stats = await apiKey.getUsageStats(1); // Last 24 hours
      expect(stats).toEqual({
        totalRequests: 2,
        successfulRequests: 1,
        failedRequests: 1,
        successRate: 50,
      });
    });
  });

  describe('Virtual Properties', () => {
    it('should generate display key with masked format', () => {
      const apiKey = new ApiKey(activeApiKey);
      expect(apiKey.displayKey).toMatch(/^sk_test_[a-zA-Z0-9]{4}\.{3,}$/);
    });
  });

  describe('Security Features', () => {
    it('should never expose keyHash in JSON', () => {
      const apiKey = new ApiKey(activeApiKey);
      const json = apiKey.toJSON();
      expect(json.keyHash).toBeUndefined();
    });

    it('should include virtual fields in JSON', () => {
      const apiKey = new ApiKey(activeApiKey);
      const json = apiKey.toJSON();
      expect(json.displayKey).toBeDefined();
    });
  });

  describe('Index Performance', () => {
    it('should enforce unique keyHash constraint', async () => {
      const apiKey1 = new ApiKey(activeApiKey);
      await apiKey1.save();

      const apiKey2 = new ApiKey({
        ...activeApiKey,
        _id: new mongoose.Types.ObjectId(),
      });

      await expect(apiKey2.save()).rejects.toThrow();
    });
  });
});