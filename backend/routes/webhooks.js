const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const integrationService = require('../services/integrationService');
const workflowEngine = require('../services/workflowEngine');
const AuditLog = require('../models/AuditLog');
const Integration = require('../models/Integration');

// GitHub webhook handler
router.post('/github', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];
    const payload = req.body;

    console.log(`Received GitHub ${event} event`);

    // Verify webhook signature
    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex')}`;

    if (signature !== expectedSignature) {
      console.log('Invalid GitHub webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process the webhook
    await integrationService.processGitHubWebhook(payload, signature);

    // Check if this should trigger any workflows
    await triggerWorkflowsFromGitHub(event, payload);

    res.status(200).json({ success: true, message: 'GitHub webhook processed' });
  } catch (error) {
    console.error('GitHub webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Slack webhook handler (for interactive components)
router.post('/slack', async (req, res) => {
  try {
    const signature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];
    const body = JSON.stringify(req.body);

    // Verify Slack signature
    const expectedSignature = `v0=${crypto
      .createHmac('sha256', process.env.SLACK_SIGNING_SECRET)
      .update(`v0:${timestamp}:${body}`)
      .digest('hex')}`;

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Handle different Slack event types
    const { type, event, challenge } = req.body;

    // URL verification challenge
    if (type === 'url_verification') {
      return res.json({ challenge });
    }

    // Handle Slack events
    if (type === 'event_callback' && event) {
      await handleSlackEvent(event);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Slack webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generic webhook handler for custom integrations
router.post('/custom/:integrationId', async (req, res) => {
  try {
    const { integrationId } = req.params;
    const payload = req.body;

    // Find the integration
    const integration = await Integration.findById(integrationId);
    if (!integration || integration.type !== 'webhook' || !integration.isActive) {
      return res.status(404).json({ error: 'Integration not found or inactive' });
    }

    // Log the webhook receipt
    await AuditLog.logAction({
      userId: integration.userId,
      action: 'integration.webhook_received',
      resource: 'integration',
      resourceId: integrationId,
      resourceName: integration.name,
      details: {
        description: `Custom webhook received`,
        payloadSize: JSON.stringify(payload).length,
        headers: req.headers
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        source: 'webhook'
      },
      severity: 'low'
    });

    // Update integration usage
    integration.usage.totalCalls += 1;
    integration.usage.successfulCalls += 1;
    integration.lastUsed = new Date();
    await integration.save();

    // Check if this should trigger any workflows
    await triggerWorkflowsFromWebhook(integration, payload);

    res.status(200).json({ 
      success: true, 
      message: 'Webhook received and processed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Custom webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Jira webhook handler
router.post('/jira', async (req, res) => {
  try {
    const payload = req.body;
    const event = req.headers['x-atlassian-webhook-identifier'];

    console.log(`Received Jira webhook: ${payload.webhookEvent}`);

    // Process Jira webhook
    await handleJiraWebhook(payload);

    res.status(200).json({ success: true, message: 'Jira webhook processed' });
  } catch (error) {
    console.error('Jira webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test webhook endpoint
router.post('/test', async (req, res) => {
  try {
    const { message, integrationId } = req.body;

    console.log('Test webhook received:', { message, integrationId });

    // If integration ID provided, send notification
    if (integrationId) {
      const integration = await Integration.findById(integrationId);
      if (integration && integration.type === 'slack') {
        await integrationService.sendSlackNotification(
          integrationId,
          `🧪 Test webhook received: ${message}`,
          { username: 'Webhook Test', icon: ':test_tube:' }
        );
      }
    }

    res.status(200).json({ 
      success: true, 
      message: 'Test webhook processed successfully',
      receivedAt: new Date().toISOString(),
      data: req.body
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to trigger workflows from GitHub events
async function triggerWorkflowsFromGitHub(event, payload) {
  try {
    // Find workflows that should be triggered by GitHub events
    const WorkflowTemplate = require('../models/WorkflowTemplate');
    
    const workflows = await WorkflowTemplate.find({
      'triggers.type': 'github',
      'triggers.config.events': event
    });

    for (const workflow of workflows) {
      const triggerData = {
        type: 'github',
        event,
        source: 'github_webhook',
        payload
      };

      const variables = {
        github_event: event,
        repository: payload.repository?.full_name,
        sender: payload.sender?.login,
        action: payload.action,
        timestamp: new Date().toISOString()
      };

      // Add event-specific variables
      if (payload.pull_request) {
        variables.pr_title = payload.pull_request.title;
        variables.pr_number = payload.pull_request.number;
        variables.pr_url = payload.pull_request.html_url;
      }

      if (payload.commits) {
        variables.commit_count = payload.commits.length;
        variables.latest_commit = payload.commits[payload.commits.length - 1]?.message;
      }

      // Execute workflow
      await workflowEngine.executeWorkflow(
        workflow._id,
        workflow.createdBy,
        triggerData,
        variables
      );
    }
  } catch (error) {
    console.error('Error triggering workflows from GitHub:', error);
  }
}

// Helper function to handle Slack events
async function handleSlackEvent(event) {
  try {
    console.log('Handling Slack event:', event.type);

    // Find workflows that should be triggered by Slack events
    const WorkflowTemplate = require('../models/WorkflowTemplate');
    
    const workflows = await WorkflowTemplate.find({
      'triggers.type': 'slack',
      'triggers.config.events': event.type
    });

    for (const workflow of workflows) {
      const triggerData = {
        type: 'slack',
        event: event.type,
        source: 'slack_webhook',
        payload: event
      };

      const variables = {
        slack_event: event.type,
        user: event.user,
        channel: event.channel,
        text: event.text,
        timestamp: new Date().toISOString()
      };

      // Execute workflow
      await workflowEngine.executeWorkflow(
        workflow._id,
        workflow.createdBy,
        triggerData,
        variables
      );
    }
  } catch (error) {
    console.error('Error handling Slack event:', error);
  }
}

// Helper function to handle Jira webhooks
async function handleJiraWebhook(payload) {
  try {
    const eventType = payload.webhookEvent;
    console.log('Handling Jira event:', eventType);

    // Send notification to Slack if configured
    const integrations = await Integration.find({
      type: 'slack',
      isActive: true
    });

    for (const integration of integrations) {
      let message = '';

      switch (eventType) {
        case 'jira:issue_created':
          message = `🆕 New Jira issue created: ${payload.issue.fields.summary}\n` +
                   `Key: ${payload.issue.key}\n` +
                   `Reporter: ${payload.issue.fields.reporter.displayName}`;
          break;

        case 'jira:issue_updated':
          message = `📝 Jira issue updated: ${payload.issue.fields.summary}\n` +
                   `Key: ${payload.issue.key}\n` +
                   `Status: ${payload.issue.fields.status.name}`;
          break;

        case 'jira:issue_deleted':
          message = `🗑️ Jira issue deleted: ${payload.issue.key}`;
          break;
      }

      if (message) {
        await integrationService.sendSlackNotification(
          integration._id,
          message,
          { username: 'Jira Bot', icon: ':jira:' }
        );
      }
    }

    // Find and trigger workflows
    const WorkflowTemplate = require('../models/WorkflowTemplate');
    
    const workflows = await WorkflowTemplate.find({
      'triggers.type': 'jira',
      'triggers.config.events': eventType
    });

    for (const workflow of workflows) {
      const triggerData = {
        type: 'jira',
        event: eventType,
        source: 'jira_webhook',
        payload
      };

      const variables = {
        jira_event: eventType,
        issue_key: payload.issue?.key,
        issue_summary: payload.issue?.fields?.summary,
        issue_status: payload.issue?.fields?.status?.name,
        reporter: payload.issue?.fields?.reporter?.displayName,
        timestamp: new Date().toISOString()
      };

      // Execute workflow
      await workflowEngine.executeWorkflow(
        workflow._id,
        workflow.createdBy,
        triggerData,
        variables
      );
    }
  } catch (error) {
    console.error('Error handling Jira webhook:', error);
  }
}

// Helper function to trigger workflows from custom webhooks
async function triggerWorkflowsFromWebhook(integration, payload) {
  try {
    // Find workflows that should be triggered by this webhook
    const WorkflowTemplate = require('../models/WorkflowTemplate');
    
    const workflows = await WorkflowTemplate.find({
      'triggers.type': 'webhook',
      'triggers.config.integrationId': integration._id.toString()
    });

    for (const workflow of workflows) {
      const triggerData = {
        type: 'webhook',
        source: 'custom_webhook',
        integrationId: integration._id,
        payload
      };

      const variables = {
        webhook_data: payload,
        integration_name: integration.name,
        timestamp: new Date().toISOString(),
        ...payload // Spread payload data as variables
      };

      // Execute workflow
      await workflowEngine.executeWorkflow(
        workflow._id,
        workflow.createdBy,
        triggerData,
        variables
      );
    }
  } catch (error) {
    console.error('Error triggering workflows from webhook:', error);
  }
}

module.exports = router;
