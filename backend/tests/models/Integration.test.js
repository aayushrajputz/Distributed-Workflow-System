const mongoose = require('mongoose');
const Integration = require('../../models/Integration');
const AuditLog = require('../../models/AuditLog');
const { regularUser } = require('../fixtures/users');

// Helper function to create test integration data
const createIntegration = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  userId: regularUser._id,
  type: 'slack',
  name: 'Test Integration',
  config: {
    webhookUrl: 'https://hooks.slack.com/test',
  },
  isActive: true,
  settings: {
    notifications: { enabled: true },
    events: ['issue.created', 'pr.merged'],
  },
  usage: {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    lastSyncAt: null,
    lastErrorAt: null,
    avgDuration: 0,
  },
  createdAt: new Date('2025-09-18T10:00:00Z'),
  ...overrides,
});

describe('Integration Model', () => {
  // Connect to the in-memory database before tests
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI);
  });

  // Clear all data after each test
  afterEach(async () => {
    await Integration.deleteMany({});
    await AuditLog.deleteMany({});
  });

  // Disconnect after all tests
  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe('Schema Validation', () => {
    it('should create a valid integration with all required fields', async () => {
      const integration = new Integration(createIntegration());
      const validationError = integration.validateSync();
      expect(validationError).toBeUndefined();
    });

    it('should require userId field', async () => {
      const integrationData = createIntegration();
      delete integrationData.userId;
      
      const integration = new Integration(integrationData);
      const validationError = integration.validateSync();
      expect(validationError.errors.userId).toBeDefined();
    });

    it('should validate integration type enum', async () => {
      const integration = new Integration(createIntegration({
        type: 'invalid',
      }));
      const validationError = integration.validateSync();
      expect(validationError.errors.type).toBeDefined();
    });

    it('should validate config structure based on type', async () => {
      // Slack config
      const slackIntegration = new Integration(createIntegration({
        type: 'slack',
        config: {
          webhookUrl: 'invalid-url',
        },
      }));
      const slackError = slackIntegration.validateSync();
      expect(slackError).toBeDefined();

      // GitHub config
      const githubIntegration = new Integration(createIntegration({
        type: 'github',
        config: {
          accessToken: 'valid-token',
          repository: 'owner/repo',
        },
      }));
      const githubError = githubIntegration.validateSync();
      expect(githubError).toBeUndefined();
    });
  });

  describe('Instance Methods', () => {
    let integration;

    beforeEach(async () => {
      integration = new Integration(createIntegration());
      await integration.save();
    });

    it('should update stats for successful sync', async () => {
      await integration.updateStats(true, 1000);
      expect(integration.usage.totalSyncs).toBe(1);
      expect(integration.usage.successfulSyncs).toBe(1);
      expect(integration.usage.failedSyncs).toBe(0);
      expect(integration.usage.lastSyncAt).toBeDefined();
      expect(integration.usage.avgDuration).toBe(1000);
    });

    it('should update stats for failed sync', async () => {
      await integration.updateStats(false, 500);
      expect(integration.usage.totalSyncs).toBe(1);
      expect(integration.usage.successfulSyncs).toBe(0);
      expect(integration.usage.failedSyncs).toBe(1);
      expect(integration.usage.lastErrorAt).toBeDefined();
    });

    it('should calculate rolling average duration', async () => {
      await integration.updateStats(true, 1000);
      await integration.updateStats(true, 2000);
      expect(integration.usage.avgDuration).toBe(1500);
    });

    it('should calculate success rate correctly', () => {
      integration.usage.totalSyncs = 10;
      integration.usage.successfulSyncs = 8;
      expect(integration.getSuccessRate()).toBe(80);
    });

    it('should handle zero total syncs in success rate', () => {
      expect(integration.getSuccessRate()).toBe(100);
    });

    it('should check if integration can sync', () => {
      expect(integration.canSync()).toBe(true);

      integration.isActive = false;
      expect(integration.canSync()).toBe(false);
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test integrations
      await Integration.create([
        createIntegration(),
        createIntegration({
          type: 'github',
          isActive: true,
        }),
        createIntegration({
          type: 'slack',
          isActive: false,
        }),
      ]);
    });

    it('should get active integrations by type', async () => {
      const slackIntegrations = await Integration.getActiveIntegrations(regularUser._id, 'slack');
      expect(slackIntegrations).toHaveLength(1);
      expect(slackIntegrations[0].type).toBe('slack');
    });

    it('should get all active integrations for user', async () => {
      const activeIntegrations = await Integration.getActiveIntegrations(regularUser._id);
      expect(activeIntegrations).toHaveLength(2);
      activeIntegrations.forEach(integration => {
        expect(integration.isActive).toBe(true);
      });
    });

    it('should get integration stats by type', async () => {
      const stats = await Integration.getIntegrationStats(regularUser._id);
      expect(stats).toHaveProperty('totalIntegrations');
      expect(stats).toHaveProperty('activeIntegrations');
      expect(stats).toHaveProperty('byType');
      expect(stats.byType).toHaveProperty('slack');
      expect(stats.byType).toHaveProperty('github');
    });
  });

  describe('Virtual Properties', () => {
    it('should calculate success rate virtual', async () => {
      const integration = new Integration(createIntegration());
      integration.usage.totalSyncs = 20;
      integration.usage.successfulSyncs = 15;
      expect(integration.successRate).toBe(75);
    });
  });

  describe('Security Features', () => {
    it('should not expose sensitive config data in JSON', () => {
      const integration = new Integration(createIntegration({
        config: {
          webhookUrl: 'secret-url',
          accessToken: 'secret-token',
          apiKey: 'secret-key',
        },
      }));

      const json = integration.toJSON();
      expect(json.config.webhookUrl).toBeDefined();
      expect(json.config.accessToken).toBeUndefined();
      expect(json.config.apiKey).toBeUndefined();
    });

    it('should handle encrypted fields correctly', () => {
      const integration = new Integration(createIntegration({
        type: 'jira',
        config: {
          apiToken: 'encrypted:test-token',
        },
      }));

      expect(integration.validateSync()).toBeUndefined();
    });
  });
});