const axios = require('axios');
const crypto = require('crypto');
const Integration = require('../models/Integration');

// @desc    Get all integrations for user
// @route   GET /api/integrations
// @access  Private
const getIntegrations = async (req, res) => {
  try {
    const integrations = await Integration.find({ userId: req.user._id })
      .select('-credentials.accessToken -credentials.refreshToken -credentials.webhookSecret')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: integrations,
    });
  } catch (error) {
    console.error('Error getting integrations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get integrations',
      error: error.message,
    });
  }
};

// @desc    Create or update Slack integration
// @route   POST /api/integrations/slack
// @access  Private
const setupSlackIntegration = async (req, res) => {
  try {
    const { webhookUrl, channel, botToken } = req.body;
    const userId = req.user._id;

    // Test the Slack webhook
    if (webhookUrl) {
      try {
        await axios.post(webhookUrl, {
          text: 'Workflow Manager integration test - connection successful! 🎉',
          channel: channel || '#general',
        });
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Slack webhook URL or channel',
        });
      }
    }

    // Find existing Slack integration or create new one
    let integration = await Integration.findOne({
      userId,
      type: 'slack',
    });

    if (integration) {
      // Update existing integration
      integration.isActive = true;
      integration.credentials = {
        webhookUrl,
        channel,
        botToken,
      };
      integration.settings = {
        ...integration.settings,
        notifications: {
          taskCompleted: true,
          taskFailed: true,
          workflowStarted: true,
          workflowCompleted: true,
          workflowFailed: true,
        },
      };
      integration.lastSyncAt = new Date();
    } else {
      // Create new integration
      integration = new Integration({
        userId,
        type: 'slack',
        name: 'Slack Workspace',
        isActive: true,
        credentials: {
          webhookUrl,
          channel,
          botToken,
        },
        settings: {
          notifications: {
            taskCompleted: true,
            taskFailed: true,
            workflowStarted: true,
            workflowCompleted: true,
            workflowFailed: true,
          },
        },
        lastSyncAt: new Date(),
      });
    }

    await integration.save();

    // Remove sensitive data from response
    const responseData = integration.toObject();
    delete responseData.credentials.botToken;

    res.json({
      success: true,
      data: responseData,
      message: 'Slack integration configured successfully',
    });
  } catch (error) {
    console.error('Error setting up Slack integration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup Slack integration',
      error: error.message,
    });
  }
};

// @desc    Create or update GitHub integration
// @route   POST /api/integrations/github
// @access  Private
const setupGitHubIntegration = async (req, res) => {
  try {
    const { accessToken, repository, webhookSecret } = req.body;
    const userId = req.user._id;

    // Test GitHub API access
    if (accessToken) {
      try {
        const response = await axios.get('https://api.github.com/user', {
          headers: {
            Authorization: `token ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (!response.data.login) {
          throw new Error('Invalid GitHub token');
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid GitHub access token',
        });
      }
    }

    // Find existing GitHub integration or create new one
    let integration = await Integration.findOne({
      userId,
      type: 'github',
    });

    if (integration) {
      // Update existing integration
      integration.isActive = true;
      integration.credentials = {
        accessToken,
        repository,
        webhookSecret,
      };
      integration.settings = {
        ...integration.settings,
        events: {
          push: true,
          pullRequest: true,
          issues: true,
          release: true,
        },
      };
      integration.lastSyncAt = new Date();
    } else {
      // Create new integration
      integration = new Integration({
        userId,
        type: 'github',
        name: `GitHub - ${repository || 'Repository'}`,
        isActive: true,
        credentials: {
          accessToken,
          repository,
          webhookSecret,
        },
        settings: {
          events: {
            push: true,
            pullRequest: true,
            issues: true,
            release: true,
          },
        },
        lastSyncAt: new Date(),
      });
    }

    await integration.save();

    // Remove sensitive data from response
    const responseData = integration.toObject();
    delete responseData.credentials.accessToken;
    delete responseData.credentials.webhookSecret;

    res.json({
      success: true,
      data: responseData,
      message: 'GitHub integration configured successfully',
    });
  } catch (error) {
    console.error('Error setting up GitHub integration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup GitHub integration',
      error: error.message,
    });
  }
};

// @desc    Create or update Jira integration
// @route   POST /api/integrations/jira
// @access  Private
const setupJiraIntegration = async (req, res) => {
  try {
    const {
      domain, email, apiToken, projectKey,
    } = req.body;
    const userId = req.user._id;

    // Test Jira API access
    if (domain && email && apiToken) {
      try {
        const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
        const response = await axios.get(`https://${domain}.atlassian.net/rest/api/3/myself`, {
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
          },
        });

        if (!response.data.accountId) {
          throw new Error('Invalid Jira credentials');
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Jira credentials or domain',
        });
      }
    }

    // Find existing Jira integration or create new one
    let integration = await Integration.findOne({
      userId,
      type: 'jira',
    });

    if (integration) {
      // Update existing integration
      integration.isActive = true;
      integration.credentials = {
        domain,
        email,
        apiToken,
        projectKey,
      };
      integration.settings = {
        ...integration.settings,
        sync: {
          importIssues: true,
          exportTasks: true,
          bidirectionalSync: false,
        },
      };
      integration.lastSyncAt = new Date();
    } else {
      // Create new integration
      integration = new Integration({
        userId,
        type: 'jira',
        name: `Jira - ${domain}`,
        isActive: true,
        credentials: {
          domain,
          email,
          apiToken,
          projectKey,
        },
        settings: {
          sync: {
            importIssues: true,
            exportTasks: true,
            bidirectionalSync: false,
          },
        },
        lastSyncAt: new Date(),
      });
    }

    await integration.save();

    // Remove sensitive data from response
    const responseData = integration.toObject();
    delete responseData.credentials.apiToken;

    res.json({
      success: true,
      data: responseData,
      message: 'Jira integration configured successfully',
    });
  } catch (error) {
    console.error('Error setting up Jira integration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup Jira integration',
      error: error.message,
    });
  }
};

// @desc    Send Slack notification
// @route   POST /api/integrations/slack/notify
// @access  Private
const sendSlackNotification = async (req, res) => {
  try {
    const { message, channel } = req.body;
    const userId = req.user._id;

    const integration = await Integration.findOne({
      userId,
      type: 'slack',
      isActive: true,
    });

    if (!integration || !integration.credentials.webhookUrl) {
      return res.status(404).json({
        success: false,
        message: 'Slack integration not configured',
      });
    }

    const payload = {
      text: message,
      channel: channel || integration.credentials.channel || '#general',
      username: 'Workflow Manager',
      icon_emoji: ':robot_face:',
    };

    await axios.post(integration.credentials.webhookUrl, payload);

    res.json({
      success: true,
      message: 'Slack notification sent successfully',
    });
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send Slack notification',
      error: error.message,
    });
  }
};

// @desc    Handle GitHub webhook
// @route   POST /api/integrations/github/webhook
// @access  Public (but verified)
const handleGitHubWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);

    // Find integration by webhook secret (simplified - in production, use proper verification)
    const integration = await Integration.findOne({
      type: 'github',
      isActive: true,
    });

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'GitHub integration not found',
      });
    }

    // Verify webhook signature
    if (integration.credentials.webhookSecret) {
      const expectedSignature = `sha256=${crypto
        .createHmac('sha256', integration.credentials.webhookSecret)
        .update(payload)
        .digest('hex')}`;

      if (signature !== expectedSignature) {
        return res.status(401).json({
          success: false,
          message: 'Invalid webhook signature',
        });
      }
    }

    const event = req.headers['x-github-event'];
    const data = req.body;

    // Process different GitHub events
    switch (event) {
      case 'push':
        // Handle push events - could trigger workflows
        console.log(`GitHub push to ${data.repository.full_name}:`, data.head_commit.message);
        break;

      case 'pull_request':
        // Handle PR events
        console.log(`GitHub PR ${data.action} in ${data.repository.full_name}:`, data.pull_request.title);
        break;

      case 'issues':
        // Handle issue events
        console.log(`GitHub issue ${data.action} in ${data.repository.full_name}:`, data.issue.title);
        break;
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully',
    });
  } catch (error) {
    console.error('Error handling GitHub webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process webhook',
      error: error.message,
    });
  }
};

// @desc    Delete integration
// @route   DELETE /api/integrations/:id
// @access  Private
const deleteIntegration = async (req, res) => {
  try {
    const integration = await Integration.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Integration not found',
      });
    }

    await integration.deleteOne();

    res.json({
      success: true,
      message: 'Integration deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting integration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete integration',
      error: error.message,
    });
  }
};

module.exports = {
  getIntegrations,
  setupSlackIntegration,
  setupGitHubIntegration,
  setupJiraIntegration,
  sendSlackNotification,
  handleGitHubWebhook,
  deleteIntegration,
};
