import express from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { handleValidationErrors, catchAsync } from '../middleware/errorHandler';
import { rateLimiters } from '../middleware/rateLimit';
import Integration from '../models/Integration';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

// Validation rules
const createIntegrationValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('type')
    .isIn(['slack', 'github', 'webhook', 'email'])
    .withMessage('Type must be slack, github, webhook, or email'),
  body('config')
    .isObject()
    .withMessage('Config must be an object'),
  body('config.webhookUrl')
    .optional()
    .isURL()
    .withMessage('Webhook URL must be a valid URL'),
  body('config.apiKey')
    .optional()
    .isString()
    .withMessage('API key must be a string'),
  body('config.token')
    .optional()
    .isString()
    .withMessage('Token must be a string')
];

const updateIntegrationValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('config')
    .optional()
    .isObject()
    .withMessage('Config must be an object'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

// Get all integrations for the authenticated user
router.get('/',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;
    const type = req.query.type as string;

    const integrations = await (Integration as any).getUserIntegrations(userId, type);

    res.json({
      success: true,
      data: integrations
    });
  })
);

// Get single integration
router.get('/:id',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const userId = req.user!._id;

    const integration = await Integration.findOne({ _id: id, userId, isActive: true });
    
    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    res.json({
      success: true,
      data: integration
    });
  })
);

// Create new integration
router.post('/',
  requireAuth,
  rateLimiters.burst,
  createIntegrationValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;
    const integrationData = {
      ...req.body,
      userId
    };

    // Check if user already has too many integrations of this type
    const existingCount = await Integration.countDocuments({ 
      userId, 
      type: req.body.type, 
      isActive: true 
    });
    
    if (existingCount >= 5) {
      return res.status(400).json({
        success: false,
        error: `Maximum number of ${req.body.type} integrations (5) reached`
      });
    }

    const integration = await Integration.create(integrationData);

    res.status(201).json({
      success: true,
      data: integration,
      message: 'Integration created successfully'
    });
  })
);

// Update integration
router.put('/:id',
  requireAuth,
  updateIntegrationValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const userId = req.user!._id;
    const updates = req.body;

    const integration = await Integration.findOneAndUpdate(
      { _id: id, userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    res.json({
      success: true,
      data: integration,
      message: 'Integration updated successfully'
    });
  })
);

// Delete integration
router.delete('/:id',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const userId = req.user!._id;

    const integration = await Integration.findOneAndUpdate(
      { _id: id, userId },
      { isActive: false },
      { new: true }
    );

    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    res.json({
      success: true,
      message: 'Integration deleted successfully'
    });
  })
);

// Test integration
router.post('/:id/test',
  requireAuth,
  rateLimiters.burst,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const userId = req.user!._id;

    const integration = await Integration.findOne({ _id: id, userId, isActive: true });
    
    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    try {
      const result = await integration.test();
      
      // Update last used timestamp
      await integration.updateLastUsed();

      res.json({
        success: true,
        data: result,
        message: 'Integration test completed'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Integration test failed'
      });
    }
  })
);

// Send notification via integration
router.post('/:id/notify',
  requireAuth,
  rateLimiters.burst,
  [
    body('message')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Message must be between 1 and 1000 characters'),
    body('title')
      .optional()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters')
  ],
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const { message, title } = req.body;
    const userId = req.user!._id;

    const integration = await Integration.findOne({ _id: id, userId, isActive: true });
    
    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    try {
      let result;
      
      switch (integration.type) {
        case 'slack':
          result = await sendSlackNotification(integration, message, title);
          break;
        case 'webhook':
          result = await sendWebhookNotification(integration, message, title);
          break;
        case 'email':
          result = await sendEmailNotification(integration, message, title);
          break;
        default:
          throw new Error(`Notification not supported for ${integration.type}`);
      }
      
      // Update last used timestamp
      await integration.updateLastUsed();

      res.json({
        success: true,
        data: result,
        message: 'Notification sent successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to send notification'
      });
    }
  })
);

// Helper functions for sending notifications
async function sendSlackNotification(integration: any, message: string, title?: string) {
  // Use native fetch (Node.js 18+)
  
  const payload = {
    text: title ? `*${title}*\n${message}` : message,
    username: 'Workflow Bot',
    icon_emoji: ':robot_face:'
  };

  if (integration.config.webhookUrl) {
    const response = await fetch(integration.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.status} ${response.statusText}`);
    }

    return { success: true, message: 'Slack notification sent' };
  } else if (integration.config.token) {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: integration.config.settings?.channel || '#general',
        text: payload.text
      })
    });

    const data = await response.json() as any;

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return { success: true, message: 'Slack notification sent via API' };
  } else {
    throw new Error('Slack webhook URL or token not configured');
  }
}

async function sendWebhookNotification(integration: any, message: string, title?: string) {
  // Use native fetch (Node.js 18+)
  
  if (!integration.config.webhookUrl) {
    throw new Error('Webhook URL not configured');
  }

  const payload = {
    type: 'notification',
    title,
    message,
    timestamp: new Date().toISOString(),
    source: 'workflow-management-system'
  };

  const response = await fetch(integration.config.webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Workflow-Management-System/1.0'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Webhook notification failed: ${response.status} ${response.statusText}`);
  }

  return { success: true, message: 'Webhook notification sent' };
}

async function sendEmailNotification(integration: any, message: string, title?: string) {
  // This would integrate with your email service
  // For now, just return success
  return { success: true, message: 'Email notification sent (placeholder)' };
}

export default router;