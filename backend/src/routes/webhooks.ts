import express from 'express';
import { body } from 'express-validator';
import { handleValidationErrors, catchAsync } from '../middleware/errorHandler';
import { rateLimiters } from '../middleware/rateLimit';
import crypto from 'crypto';

const router = express.Router();

// Test webhook endpoint
router.post('/test',
  rateLimiters.burst,
  [
    body('message')
      .optional()
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Message must be between 1 and 1000 characters'),
    body('timestamp')
      .optional()
      .isISO8601()
      .withMessage('Timestamp must be a valid ISO 8601 date')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const { message, timestamp, ...otherData } = req.body;

    console.log('📥 Test webhook received:', {
      message: message || 'Test webhook',
      timestamp: timestamp || new Date().toISOString(),
      data: otherData,
      headers: req.headers,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        received: true,
        message: message || 'Test webhook received',
        timestamp: new Date().toISOString(),
        echo: req.body
      },
      message: 'Webhook received successfully'
    });
  })
);

// GitHub webhook endpoint
router.post('/github',
  rateLimiters.burst,
  catchAsync(async (req, res) => {
    const signature = req.headers['x-hub-signature-256'] as string;
    const event = req.headers['x-github-event'] as string;
    const delivery = req.headers['x-github-delivery'] as string;

    // Verify GitHub webhook signature if secret is configured
    if (process.env.GITHUB_WEBHOOK_SECRET) {
      if (!signature) {
        return res.status(401).json({
          success: false,
          error: 'Missing signature'
        });
      }

      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return res.status(401).json({
          success: false,
          error: 'Invalid signature'
        });
      }
    }

    console.log('📥 GitHub webhook received:', {
      event,
      delivery,
      action: req.body.action,
      repository: req.body.repository?.full_name,
      sender: req.body.sender?.login
    });

    // Handle different GitHub events
    let responseMessage = 'GitHub webhook received';
    
    switch (event) {
      case 'push':
        responseMessage = `Push event received for ${req.body.repository?.full_name}`;
        // Handle push event - could trigger workflow execution
        break;
      case 'pull_request':
        responseMessage = `Pull request ${req.body.action} for ${req.body.repository?.full_name}`;
        // Handle PR events
        break;
      case 'issues':
        responseMessage = `Issue ${req.body.action} for ${req.body.repository?.full_name}`;
        // Handle issue events
        break;
      case 'workflow_run':
        responseMessage = `Workflow run ${req.body.action} for ${req.body.repository?.full_name}`;
        // Handle workflow run events
        break;
      default:
        responseMessage = `${event} event received for ${req.body.repository?.full_name}`;
    }

    res.json({
      success: true,
      data: {
        event,
        delivery,
        processed: true,
        timestamp: new Date().toISOString()
      },
      message: responseMessage
    });
  })
);

// Slack webhook endpoint
router.post('/slack',
  rateLimiters.burst,
  catchAsync(async (req, res) => {
    const { token, team_id, team_domain, channel_id, channel_name, user_id, user_name, command, text, response_url } = req.body;

    // Verify Slack token if configured
    if (process.env.SLACK_VERIFICATION_TOKEN && token !== process.env.SLACK_VERIFICATION_TOKEN) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    console.log('📥 Slack webhook received:', {
      team_domain,
      channel_name,
      user_name,
      command,
      text
    });

    // Handle Slack slash commands
    let responseText = 'Command received';
    
    if (command) {
      switch (command) {
        case '/workflow':
          responseText = `Hello ${user_name}! Workflow command received: ${text}`;
          break;
        case '/status':
          responseText = 'System status: All services operational';
          break;
        default:
          responseText = `Unknown command: ${command}`;
      }
    }

    // Respond to Slack
    res.json({
      response_type: 'in_channel',
      text: responseText,
      attachments: [
        {
          color: 'good',
          fields: [
            {
              title: 'Processed',
              value: new Date().toLocaleString(),
              short: true
            }
          ]
        }
      ]
    });
  })
);

// Generic webhook endpoint
router.post('/generic',
  rateLimiters.burst,
  catchAsync(async (req, res) => {
    const contentType = req.headers['content-type'];
    const userAgent = req.headers['user-agent'];
    
    console.log('📥 Generic webhook received:', {
      contentType,
      userAgent,
      bodySize: JSON.stringify(req.body).length,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    // Process the webhook data
    const webhookData = {
      headers: req.headers,
      body: req.body,
      query: req.query,
      timestamp: new Date().toISOString(),
      processed: true
    };

    res.json({
      success: true,
      data: webhookData,
      message: 'Generic webhook processed successfully'
    });
  })
);

// Webhook status endpoint
router.get('/status',
  catchAsync(async (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'operational',
        endpoints: [
          '/api/webhooks/test',
          '/api/webhooks/github',
          '/api/webhooks/slack',
          '/api/webhooks/generic'
        ],
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      },
      message: 'Webhook service is operational'
    });
  })
);

export default router;