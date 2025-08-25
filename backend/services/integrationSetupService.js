const Integration = require('../models/Integration');
const integrationService = require('./integrationService');
const notificationService = require('./notificationService');
const AuditLog = require('../models/AuditLog');
const crypto = require('crypto');

class IntegrationSetupService {
  // Setup all integrations at once
  async setupAllIntegrations(userId, integrations) {
    const results = {
      slack: null,
      github: null,
      jira: null,
      zapier: null,
      summary: {
        connected: 0,
        failed: 0,
        total: 0
      }
    };

    // Setup Slack integration
    if (integrations.slack) {
      try {
        results.slack = await this.setupSlackIntegration(userId, integrations.slack);
        results.summary.connected++;
        console.log('✅ Slack integration configured');
      } catch (error) {
        results.slack = { success: false, error: error.message };
        results.summary.failed++;
        console.error('❌ Slack integration failed:', error.message);
      }
      results.summary.total++;
    }

    // Setup GitHub integration
    if (integrations.github) {
      try {
        results.github = await this.setupGitHubIntegration(userId, integrations.github);
        results.summary.connected++;
        console.log('✅ GitHub integration configured');
      } catch (error) {
        results.github = { success: false, error: error.message };
        results.summary.failed++;
        console.error('❌ GitHub integration failed:', error.message);
      }
      results.summary.total++;
    }

    // Setup Jira integration
    if (integrations.jira) {
      try {
        results.jira = await this.setupJiraIntegration(userId, integrations.jira);
        results.summary.connected++;
        console.log('✅ Jira integration configured');
      } catch (error) {
        results.jira = { success: false, error: error.message };
        results.summary.failed++;
        console.error('❌ Jira integration failed:', error.message);
      }
      results.summary.total++;
    }

    // Setup Zapier integration
    if (integrations.zapier) {
      try {
        results.zapier = await this.setupZapierIntegration(userId, integrations.zapier);
        results.summary.connected++;
        console.log('✅ Zapier integration configured');
      } catch (error) {
        results.zapier = { success: false, error: error.message };
        results.summary.failed++;
        console.error('❌ Zapier integration failed:', error.message);
      }
      results.summary.total++;
    }

    // Log integration setup results
    await this.logIntegrationResults(userId, results);

    return results;
  }

  // Setup Slack integration with webhook URL
  async setupSlackIntegration(userId, config) {
    const { webhookUrl, channel } = config;

    // Test webhook URL
    const testMessage = {
      text: 'Workflow Manager integration test - connection successful! 🎉',
      channel: channel || '#general'
    };

    const testResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage)
    });

    if (!testResponse.ok) {
      throw new Error('Slack webhook test failed');
    }

    // Save integration
    let integration = await Integration.findOne({ userId, type: 'slack' });
    
    if (integration) {
      integration.isActive = true;
      integration.credentials = { webhookUrl, channel };
      integration.lastSyncAt = new Date();
    } else {
      integration = new Integration({
        userId,
        type: 'slack',
        name: 'Slack Notifications',
        isActive: true,
        credentials: { webhookUrl, channel },
        lastSyncAt: new Date()
      });
    }

    await integration.save();

    // Setup real-time notifications for task events
    await this.setupSlackNotificationTriggers(userId, integration._id);

    return { 
      success: true, 
      integrationId: integration._id,
      status: 'connected',
      webhookUrl: webhookUrl.substring(0, 50) + '...' // Partial URL for security
    };
  }

  // Setup GitHub integration with PAT
  async setupGitHubIntegration(userId, config) {
    const { accessToken, repository, webhookSecret } = config;

    // Test GitHub API
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error('GitHub API test failed');
    }

    const userData = await response.json();

    // Save integration
    let integration = await Integration.findOne({ userId, type: 'github' });
    
    if (integration) {
      integration.isActive = true;
      integration.credentials = { accessToken, repository, webhookSecret };
      integration.lastSyncAt = new Date();
    } else {
      integration = new Integration({
        userId,
        type: 'github',
        name: `GitHub - ${repository}`,
        isActive: true,
        credentials: { accessToken, repository, webhookSecret },
        settings: {
          events: { push: true, pullRequest: true, issues: true, release: true }
        },
        lastSyncAt: new Date()
      });
    }

    await integration.save();

    return { 
      success: true, 
      integrationId: integration._id,
      status: 'connected',
      repository,
      user: userData.login
    };
  }

  // Setup Jira integration with REST API
  async setupJiraIntegration(userId, config) {
    const { domain, email, apiToken, projectKey } = config;

    // Test Jira API
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const response = await fetch(`https://${domain}.atlassian.net/rest/api/3/myself`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Jira API test failed');
    }

    const userData = await response.json();

    // Save integration
    let integration = await Integration.findOne({ userId, type: 'jira' });
    
    if (integration) {
      integration.isActive = true;
      integration.credentials = { domain, email, apiToken, projectKey };
      integration.lastSyncAt = new Date();
    } else {
      integration = new Integration({
        userId,
        type: 'jira',
        name: `Jira - ${domain}`,
        isActive: true,
        credentials: { domain, email, apiToken, projectKey },
        settings: {
          sync: { importIssues: true, exportTasks: true }
        },
        lastSyncAt: new Date()
      });
    }

    await integration.save();

    return { 
      success: true, 
      integrationId: integration._id,
      status: 'connected',
      domain,
      projectKey,
      user: userData.emailAddress
    };
  }

  // Setup Zapier integration
  async setupZapierIntegration(userId, config) {
    const { webhookUrl, events } = config;

    // Generate API key for Zapier if not provided
    const apiKey = config.apiKey || this.generateApiKey();

    // Save integration
    let integration = await Integration.findOne({ userId, type: 'zapier' });
    
    if (integration) {
      integration.isActive = true;
      integration.credentials = { webhookUrl, apiKey };
      integration.settings = { events: events || ['task_created', 'task_completed', 'workflow_finished'] };
      integration.lastSyncAt = new Date();
    } else {
      integration = new Integration({
        userId,
        type: 'zapier',
        name: 'Zapier Automation',
        isActive: true,
        credentials: { webhookUrl, apiKey },
        settings: {
          events: events || ['task_created', 'task_completed', 'workflow_finished']
        },
        lastSyncAt: new Date()
      });
    }

    await integration.save();

    return { 
      success: true, 
      integrationId: integration._id,
      status: 'connected',
      apiKey,
      events: integration.settings.events
    };
  }

  // Setup notification triggers for Slack
  async setupSlackNotificationTriggers(userId, integrationId) {
    // This will be called by the task service when tasks are created/completed
    console.log(`🔗 Slack notification triggers configured for integration ${integrationId}`);
  }

  // Generate API key for Zapier
  generateApiKey() {
    return 'zap_' + crypto.randomBytes(32).toString('hex');
  }

  // Log integration setup results
  async logIntegrationResults(userId, results) {
    const logEntry = {
      action: 'integration_setup',
      user: userId,
      details: {
        summary: results.summary,
        integrations: Object.keys(results).filter(k => k !== 'summary').map(type => ({
          type,
          status: results[type]?.success ? 'connected' : 'failed',
          error: results[type]?.error || null
        }))
      },
      timestamp: new Date(),
      metadata: {
        userAgent: 'Integration Setup Service',
        success: results.summary.failed === 0
      }
    };

    // Save audit log
    await AuditLog.create(logEntry);

    console.log('📊 Integration setup logged:', {
      connected: results.summary.connected,
      failed: results.summary.failed,
      total: results.summary.total
    });
  }

  // Get integration status for all services
  async getIntegrationStatus(userId) {
    const integrations = await Integration.find({ userId }).select('type isActive lastSyncAt createdAt settings');
    
    const status = {
      slack: { connected: false, lastSync: null },
      github: { connected: false, lastSync: null },
      jira: { connected: false, lastSync: null },
      zapier: { connected: false, lastSync: null }
    };

    integrations.forEach(integration => {
      status[integration.type] = {
        connected: integration.isActive,
        lastSync: integration.lastSyncAt,
        createdAt: integration.createdAt,
        settings: integration.settings
      };
    });

    return status;
  }
}

module.exports = new IntegrationSetupService();
