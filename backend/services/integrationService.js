const axios = require('axios');
const crypto = require('node:crypto');
const Integration = require('../models/Integration');
const AuditLog = require('../models/AuditLog');
const { requestWithTimeout } = require('../utils/requestUtils');
const logger = require('../utils/logger');

// Service timeouts
const TIMEOUTS = {
  slack: 5000,    // 5 seconds
  jira: 15000,    // 15 seconds
  github: 8000,   // 8 seconds
  webhook: 12000  // 12 seconds
};

class IntegrationService {
  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY;
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    if (this.encryptionKey.length < 64) {
      throw new Error('ENCRYPTION_KEY must be at least 64 characters for AES-256');
    }
  }

  // Encrypt sensitive data
  encrypt(text) {
    if (!text) return text;
    try {
      const iv = crypto.randomBytes(16);
      const key = Buffer.from(this.encryptionKey, 'hex');
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  // Decrypt sensitive data
  decrypt(text) {
    if (!text) return text;
    try {
      const textParts = text.split(':');
      if (textParts.length !== 2) {
        throw new Error('Invalid encrypted text format');
      }
      const iv = Buffer.from(textParts[0], 'hex');
      const encryptedText = textParts[1];
      const key = Buffer.from(this.encryptionKey, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  // Send Slack notification
  async sendSlackNotification(integrationId, message, options = {}) {
    try {
      const integration = await Integration.findById(integrationId);
      if (!integration || integration.type !== 'slack' || !integration.isActive) {
        throw new Error('Slack integration not found or inactive');
      }

      const { config } = integration;
      let result;

      // Use webhook URL if available
      if (config.webhookUrl) {
        const payload = {
          text: message,
          channel: options.channel || config.channelId,
          username: options.username || 'Workflow Builder',
          icon_emoji: options.icon || ':robot_face:',
          attachments: options.attachments || [],
        };

        const response = await requestWithTimeout({
          url: config.webhookUrl,
          method: 'POST',
          data: payload,
        }, TIMEOUTS.slack, 'slack');
        
        result = { success: true, messageId: response.data };
      }
      // Use bot token if available
      else if (config.botToken) {
        const decryptedToken = this.decrypt(config.botToken);

        const payload = {
          channel: options.channel || config.channelId,
          text: message,
          username: options.username || 'Workflow Builder',
          icon_emoji: options.icon || ':robot_face:',
          attachments: options.attachments || [],
        };

        const response = await requestWithTimeout({
          url: 'https://slack.com/api/chat.postMessage',
          method: 'POST',
          data: payload,
          headers: {
            Authorization: `Bearer ${decryptedToken}`,
            'Content-Type': 'application/json',
          },
        }, TIMEOUTS.slack, 'slack');

        if (response.data.ok) {
          result = { success: true, messageId: response.data.ts };
        } else {
          throw new Error(response.data.error);
        }
      } else {
        throw new Error('No Slack webhook URL or bot token configured');
      }

      // Update integration usage stats
      integration.usage.totalCalls += 1;
      integration.usage.successfulCalls += 1;
      integration.lastUsed = new Date();
      await integration.save();

      // Log the action
      await AuditLog.logAction({
        action: 'integration.notification_sent',
        resource: 'integration',
        resourceId: integrationId,
        resourceName: integration.name,
        details: {
          description: `Slack notification sent: ${message.substring(0, 100)}...`,
          channel: options.channel || config.channelId,
          messageLength: message.length,
        },
        severity: 'low',
      });

      return result;
    } catch (error) {
      console.error('Slack notification error:', error);

      // Update failure stats
      const integration = await Integration.findById(integrationId);
      if (integration) {
        integration.usage.totalCalls += 1;
        integration.usage.failedCalls += 1;
        integration.usage.lastError = error.message;
        integration.usage.lastErrorAt = new Date();
        await integration.save();
      }

      throw error;
    }
  }

  // Process GitHub webhook
  async processGitHubWebhook(payload, signature) {
    try {
      // Find GitHub integrations
      const integrations = await Integration.find({
        type: 'github',
        isActive: true,
      });

      for (const integration of integrations) {
        // Verify webhook signature
        if (integration.config.webhookSecret) {
          const expectedSignature = `sha256=${crypto
            .createHmac('sha256', this.decrypt(integration.config.webhookSecret))
            .update(JSON.stringify(payload))
            .digest('hex')}`;

          if (signature !== expectedSignature) {
            continue; // Skip this integration
          }
        }

        // Process the webhook based on event type
        await this.handleGitHubEvent(integration, payload);
      }

      return { success: true };
    } catch (error) {
      console.error('GitHub webhook processing error:', error);
      throw error;
    }
  }

  // Handle specific GitHub events
  async handleGitHubEvent(integration, payload) {
    const eventType = payload.action || 'push';
    const repository = payload.repository?.full_name || 'Unknown';

    let message = '';
    let shouldNotify = false;

    switch (eventType) {
      case 'opened':
        if (payload.pull_request) {
          message = `🔄 New Pull Request opened in ${repository}\n`
                   + `Title: ${payload.pull_request.title}\n`
                   + `Author: ${payload.pull_request.user.login}\n`
                   + `URL: ${payload.pull_request.html_url}`;
          shouldNotify = integration.config.events?.includes('pull_request');
        }
        break;

      case 'closed':
        if (payload.pull_request?.merged) {
          message = `✅ Pull Request merged in ${repository}\n`
                   + `Title: ${payload.pull_request.title}\n`
                   + `Merged by: ${payload.pull_request.merged_by?.login}`;
          shouldNotify = integration.config.events?.includes('pull_request');
        }
        break;

      case 'push':
        const commits = payload.commits || [];
        if (commits.length > 0) {
          message = `📝 ${commits.length} new commit(s) pushed to ${repository}\n`
                   + `Branch: ${payload.ref?.replace('refs/heads/', '')}\n`
                   + `Latest: ${commits[commits.length - 1].message}`;
          shouldNotify = integration.config.events?.includes('push');
        }
        break;

      case 'opened':
        if (payload.issue) {
          message = `🐛 New Issue opened in ${repository}\n`
                   + `Title: ${payload.issue.title}\n`
                   + `Author: ${payload.issue.user.login}\n`
                   + `URL: ${payload.issue.html_url}`;
          shouldNotify = integration.config.events?.includes('issues');
        }
        break;
    }

    // Send notification if configured
    if (shouldNotify && message) {
      // Find associated Slack integration for the same user
      const slackIntegration = await Integration.findOne({
        userId: integration.userId,
        type: 'slack',
        isActive: true,
      });

      if (slackIntegration) {
        await this.sendSlackNotification(slackIntegration._id, message, {
          channel: slackIntegration.config.channelId,
          icon: ':github:',
          username: 'GitHub Bot',
        });
      }
    }

    // Log the GitHub event
    await AuditLog.logAction({
      userId: integration.userId,
      action: 'integration.github_event',
      resource: 'integration',
      resourceId: integration._id,
      resourceName: integration.name,
      details: {
        description: `GitHub ${eventType} event processed`,
        repository,
        eventType,
        notificationSent: shouldNotify,
      },
      severity: 'low',
    });

    // Update integration usage
    integration.usage.totalCalls += 1;
    integration.usage.successfulCalls += 1;
    integration.lastUsed = new Date();
    await integration.save();
  }

  // Create Jira issue
  async createJiraIssue(integrationId, issueData) {
    try {
      const integration = await Integration.findById(integrationId);
      if (!integration || integration.type !== 'jira' || !integration.isActive) {
        throw new Error('Jira integration not found or inactive');
      }

      const { config } = integration;
      const auth = Buffer.from(
        `${config.email}:${this.decrypt(config.apiToken)}`,
      ).toString('base64');

      const jiraIssue = {
        fields: {
          project: { key: config.projectKey },
          summary: issueData.summary,
          description: issueData.description,
          issuetype: { name: issueData.issueType || 'Task' },
          priority: { name: issueData.priority || 'Medium' },
        },
      };

      const response = await requestWithTimeout({
        url: `https://${config.domain}/rest/api/3/issue`,
        method: 'POST',
        data: jiraIssue,
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }, TIMEOUTS.jira, 'jira');

      // Update integration usage
      integration.usage.totalCalls += 1;
      integration.usage.successfulCalls += 1;
      integration.lastUsed = new Date();
      await integration.save();

      // Log the action
      await AuditLog.logAction({
        userId: integration.userId,
        action: 'integration.jira_issue_created',
        resource: 'integration',
        resourceId: integrationId,
        resourceName: integration.name,
        details: {
          description: `Jira issue created: ${issueData.summary}`,
          issueKey: response.data.key,
          issueId: response.data.id,
        },
        severity: 'medium',
      });

      return {
        success: true,
        issueKey: response.data.key,
        issueId: response.data.id,
        url: `https://${config.domain}/browse/${response.data.key}`,
      };
    } catch (error) {
      console.error('Jira issue creation error:', error);

      // Update failure stats
      const integration = await Integration.findById(integrationId);
      if (integration) {
        integration.usage.totalCalls += 1;
        integration.usage.failedCalls += 1;
        integration.usage.lastError = error.message;
        integration.usage.lastErrorAt = new Date();
        await integration.save();
      }

      throw error;
    }
  }

  // Send custom webhook
  async sendWebhook(integrationId, data, options = {}) {
    try {
      const integration = await Integration.findById(integrationId);
      if (!integration || integration.type !== 'webhook' || !integration.isActive) {
        throw new Error('Webhook integration not found or inactive');
      }

      const { config } = integration;
      const requestConfig = {
        method: config.method || 'POST',
        url: config.url,
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        data,
      };

      // Add authentication if configured
      if (config.authentication !== 'none') {
        const { authConfig } = config;

        switch (config.authentication) {
          case 'basic':
            const basicAuth = Buffer.from(
              `${authConfig.username}:${this.decrypt(authConfig.password)}`,
            ).toString('base64');
            requestConfig.headers.Authorization = `Basic ${basicAuth}`;
            break;

          case 'bearer':
            requestConfig.headers.Authorization = `Bearer ${this.decrypt(authConfig.token)}`;
            break;

          case 'api_key':
            requestConfig.headers[authConfig.headerName] = this.decrypt(authConfig.apiKey);
            break;
        }
      }

      const response = await axios(requestConfig);

      // Update integration usage
      integration.usage.totalCalls += 1;
      integration.usage.successfulCalls += 1;
      integration.lastUsed = new Date();
      await integration.save();

      // Log the action
      await AuditLog.logAction({
        userId: integration.userId,
        action: 'integration.webhook_sent',
        resource: 'integration',
        resourceId: integrationId,
        resourceName: integration.name,
        details: {
          description: `Webhook sent to ${config.url}`,
          method: config.method,
          statusCode: response.status,
          dataSize: JSON.stringify(data).length,
        },
        severity: 'low',
      });

      return {
        success: true,
        status: response.status,
        data: response.data,
      };
    } catch (error) {
      console.error('Webhook sending error:', error);

      // Update failure stats
      const integration = await Integration.findById(integrationId);
      if (integration) {
        integration.usage.totalCalls += 1;
        integration.usage.failedCalls += 1;
        integration.usage.lastError = error.message;
        integration.usage.lastErrorAt = new Date();
        await integration.save();
      }

      throw error;
    }
  }

  // Test integration connection
  async testIntegration(integrationId) {
    try {
      const integration = await Integration.findById(integrationId);
      if (!integration) {
        throw new Error('Integration not found');
      }

      let result;

      switch (integration.type) {
        case 'slack':
          result = await this.testSlackConnection(integration);
          break;
        case 'github':
          result = await this.testGitHubConnection(integration);
          break;
        case 'jira':
          result = await this.testJiraConnection(integration);
          break;
        case 'webhook':
          result = await this.testWebhookConnection(integration);
          break;
        default:
          throw new Error('Unknown integration type');
      }

      // Update integration stats
      integration.usage.totalCalls += 1;
      if (result.success) {
        integration.usage.successfulCalls += 1;
        integration.lastUsed = new Date();
      } else {
        integration.usage.failedCalls += 1;
        integration.usage.lastError = result.error;
        integration.usage.lastErrorAt = new Date();
      }
      await integration.save();

      return result;
    } catch (error) {
      console.error('Integration test error:', error);
      throw error;
    }
  }

  // Test Slack connection
  async testSlackConnection(integration) {
    try {
      if (integration.config.webhookUrl) {
        await requestWithTimeout({
          url: integration.config.webhookUrl,
          method: 'POST',
          data: {
            text: '✅ Slack integration test successful!',
            username: 'Workflow Builder Test',
            icon_emoji: ':white_check_mark:',
          }
        }, TIMEOUTS.slack, 'slack');
        
        return { success: true, message: 'Slack webhook test successful' };
      } 
      
      if (integration.config.botToken) {
        const response = await requestWithTimeout({
          url: 'https://slack.com/api/auth.test',
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.decrypt(integration.config.botToken)}`,
            'Content-Type': 'application/json'
          }
        }, TIMEOUTS.slack, 'slack');

        if (response.data.ok) {
          return { success: true, message: 'Slack bot token test successful' };
        }
        return { success: false, error: response.data.error };
      }

      return { success: false, error: 'No Slack configuration found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Test GitHub connection
  async testGitHubConnection(integration) {
    try {
      const response = await requestWithTimeout({
        url: 'https://api.github.com/user',
        method: 'GET',
        headers: {
          Authorization: `token ${this.decrypt(integration.config.accessToken)}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }, TIMEOUTS.github, 'github');

      if (response.status === 200) {
        return {
          success: true,
          message: `GitHub connection successful for user: ${response.data.login}`,
        };
      }

      return { success: false, error: 'GitHub API test failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Test Jira connection
  async testJiraConnection(integration) {
    try {
      const auth = Buffer.from(
        `${integration.config.email}:${this.decrypt(integration.config.apiToken)}`,
      ).toString('base64');

      const response = await requestWithTimeout({
        url: `https://${integration.config.domain}/rest/api/3/myself`,
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }, TIMEOUTS.jira, 'jira');

      if (response.status === 200) {
        return {
          success: true,
          message: `Jira connection successful for user: ${response.data.displayName}`,
        };
      }

      return { success: false, error: 'Jira API test failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Test webhook connection
  async testWebhookConnection(integration) {
    try {
      const testData = {
        test: true,
        message: 'Webhook integration test',
        timestamp: new Date().toISOString(),
      };

      const result = await this.sendWebhook(integration._id, testData);

      if (result.success) {
        return {
          success: true,
          message: `Webhook test successful (Status: ${result.status})`,
        };
      }

      return { success: false, error: 'Webhook test failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Add comment to Jira issue
  async addJiraComment(integrationId, issueKey, comment) {
    const integration = await Integration.findById(integrationId);
    if (!integration || integration.type !== 'jira' || !integration.isActive) {
      throw new Error('Jira integration not found or inactive');
    }

    const auth = Buffer.from(
      `${integration.config.email}:${this.decrypt(integration.config.apiToken)}`,
    ).toString('base64');

    const response = await requestWithTimeout({
      url: `https://${integration.config.domain}/rest/api/3/issue/${issueKey}/comment`,
      method: 'POST',
      data: { body: comment },
      headers: { 
        Authorization: `Basic ${auth}`, 
        'Content-Type': 'application/json' 
      }
    }, TIMEOUTS.jira, 'jira');
    
    return { success: response.status === 201 };
  }
}

module.exports = new IntegrationService();
