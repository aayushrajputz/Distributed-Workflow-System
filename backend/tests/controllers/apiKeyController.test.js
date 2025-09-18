const mongoose = require('mongoose');
const { 
  createMockReq, 
  createMockRes, 
  createMockNext 
} = require('../utils/testHelpers');
const apiKeyController = require('../../controllers/apiKeyController');
const ApiKey = require('../../models/ApiKey');
const { 
  createApiKey, 
  activeApiKey, 
  adminApiKey 
} = require('../fixtures/apiKeys');
const { regularUser } = require('../fixtures/users');

// Mock express-validator
jest.mock('express-validator', () => ({
  validationResult: jest.fn().mockReturnValue({ isEmpty: () => true }),
}));

describe('API Key Controller', () => {
  let req, res, next;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI);
  });

  beforeEach(() => {
    req = createMockReq();
    res = createMockRes();
    next = createMockNext();
  });

  afterEach(async () => {
    await ApiKey.deleteMany({});
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe('getApiKeys', () => {
    beforeEach(async () => {
      await ApiKey.create([
        activeApiKey,
        createApiKey(regularUser._id, ['read'], { isActive: false }),
      ]);
    });

    it('should return user API keys with usage stats', async () => {
      req.user = regularUser;

      await apiKeyController.getApiKeys(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.apiKeys).toBeInstanceOf(Array);
      expect(response.data.apiKeys[0]).toHaveProperty('usage');
    });

    it('should filter by isActive status', async () => {
      req.user = regularUser;
      req.query = { isActive: 'true' };

      await apiKeyController.getApiKeys(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.data.apiKeys).toHaveLength(1);
      expect(response.data.apiKeys[0].isActive).toBe(true);
    });
  });

  describe('createApiKey', () => {
    it('should create API key and return one-time key', async () => {
      req.user = regularUser;
      req.body = {
        name: 'Test API Key',
        permissions: ['read'],
      };

      // Mock generateApiKey to return predictable value
      const mockApiKey = 'sk_test_mock123';
      jest.spyOn(ApiKey, 'generateApiKey').mockReturnValue(mockApiKey);

      await apiKeyController.createApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.apiKey).toBeDefined();
      expect(response.data.apiKey.name).toBe('Test API Key');
      expect(response.data.key).toBe(mockApiKey);

      // Verify key is never returned again
      const storedKey = await ApiKey.findById(response.data.apiKey._id);
      expect(storedKey.toJSON()).not.toHaveProperty('key');
    });

    it('should enforce API key limit per user', async () => {
      // Create maximum allowed keys
      const maxKeys = Array(10).fill(null).map(() => 
        createApiKey(regularUser._id, ['read'])
      );
      await ApiKey.create(maxKeys);

      req.user = regularUser;
      req.body = {
        name: 'Exceeding Limit Key',
        permissions: ['read'],
      };

      await apiKeyController.createApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'API_KEY_LIMIT_EXCEEDED',
        })
      );
    });
  });

  describe('getApiKey', () => {
    let existingKey;

    beforeEach(async () => {
      existingKey = await ApiKey.create(activeApiKey);
    });

    it('should return API key with detailed stats', async () => {
      req.user = regularUser;
      req.params = { keyId: existingKey._id.toString() };

      await apiKeyController.getApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.data.apiKey._id.toString()).toBe(existingKey._id.toString());
      expect(response.data.apiKey).toHaveProperty('usage');
    });

    it('should prevent unauthorized access', async () => {
      req.user = { ...regularUser, _id: new mongoose.Types.ObjectId() };
      req.params = { keyId: existingKey._id.toString() };

      await apiKeyController.getApiKey(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
    });
  });

  describe('updateApiKey', () => {
    let existingKey;

    beforeEach(async () => {
      existingKey = await ApiKey.create(activeApiKey);
    });

    it('should update API key settings', async () => {
      req.user = regularUser;
      req.params = { keyId: existingKey._id.toString() };
      req.body = {
        name: 'Updated Key Name',
        permissions: ['read', 'write'],
        rateLimit: { requestsPerHour: 500 },
      };

      await apiKeyController.updateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.data.apiKey.name).toBe('Updated Key Name');
      expect(response.data.apiKey.permissions).toContain('write');
      expect(response.data.apiKey.rateLimit.requestsPerHour).toBe(500);
    });
  });

  describe('regenerateApiKey', () => {
    let existingKey;

    beforeEach(async () => {
      existingKey = await ApiKey.create(activeApiKey);
    });

    it('should regenerate API key and return new one-time key', async () => {
      req.user = regularUser;
      req.params = { keyId: existingKey._id.toString() };

      const mockNewKey = 'sk_test_regenerated123';
      jest.spyOn(ApiKey, 'generateApiKey').mockReturnValue(mockNewKey);

      await apiKeyController.regenerateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.data.key).toBe(mockNewKey);
      expect(response.data.apiKey.keyHash).not.toBe(existingKey.keyHash);
    });
  });

  describe('deleteApiKey', () => {
    let existingKey;

    beforeEach(async () => {
      existingKey = await ApiKey.create(activeApiKey);
    });

    it('should soft delete API key', async () => {
      req.user = regularUser;
      req.params = { keyId: existingKey._id.toString() };

      await apiKeyController.deleteApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      
      const deletedKey = await ApiKey.findById(existingKey._id);
      expect(deletedKey.isActive).toBe(false);
    });
  });
});