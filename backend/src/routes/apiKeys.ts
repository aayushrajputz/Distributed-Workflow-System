import express, { Response } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { handleValidationErrors, catchAsync } from '../middleware/errorHandler';
import { rateLimiters } from '../middleware/rateLimit';
import ApiKey from '../models/ApiKey';
import UsageLog from '../models/UsageLog';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

// Validation rules
const createApiKeyValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
    .custom((permissions) => {
      const validPermissions = ['read', 'write', 'admin'];
      return permissions.every((p: string) => validPermissions.includes(p));
    })
    .withMessage('Invalid permissions. Valid options: read, write, admin'),
  body('environment')
    .optional()
    .isIn(['development', 'staging', 'production'])
    .withMessage('Environment must be development, staging, or production')
];

const updateApiKeyValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
    .custom((permissions) => {
      const validPermissions = ['read', 'write', 'admin'];
      return permissions.every((p: string) => validPermissions.includes(p));
    })
    .withMessage('Invalid permissions. Valid options: read, write, admin'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('rateLimit.requestsPerHour')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Requests per hour must be between 1 and 10000'),
  body('rateLimit.requestsPerDay')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('Requests per day must be between 1 and 100000')
];

// Get all API keys for the authenticated user
router.get('/',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Get API keys with stats
    const apiKeys = await ApiKey.find({ userId, isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ApiKey.countDocuments({ userId, isActive: true });

    // Get usage stats for each API key
    const apiKeysWithStats = await Promise.all(
      apiKeys.map(async (apiKey) => {
        const stats = await (UsageLog as any).getApiKeyStats(apiKey._id.toString());
        return {
          ...apiKey.toJSON(),
          stats
        };
      })
    );

    return res.json({
      success: true,
      data: {
        apiKeys: apiKeysWithStats,
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  })
);

// Get single API key with detailed stats
router.get('/:id',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!._id;

    const apiKey = await ApiKey.findOne({ _id: id, userId, isActive: true });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    // Get detailed stats
    const stats = await (UsageLog as any).getApiKeyStats(apiKey._id.toString());

    // Get recent usage logs
    const recentUsage = await UsageLog.find({ apiKeyId: apiKey._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('endpoint method statusCode responseTimeMs ipAddress createdAt');

    return res.json({
      success: true,
      data: {
        apiKey: {
          ...apiKey.toJSON(),
          stats
        },
        recentUsage
      }
    });
  })
);

// Create new API key
router.post('/',
  requireAuth,
  rateLimiters.burst,
  createApiKeyValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { name, permissions = ['read'], environment = 'development' } = req.body;
    const userId = req.user!._id;

    // Check if user already has too many API keys
    const existingCount = await ApiKey.countDocuments({ userId, isActive: true });
    if (existingCount >= 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum number of API keys (10) reached'
      });
    }

    // Generate API key
    const { key, hash, prefix } = (ApiKey as any).generateApiKey();

    // Create API key record
    const apiKey = await ApiKey.create({
      userId,
      name,
      keyHash: hash,
      keyPrefix: prefix,
      permissions,
      metadata: {
        environment,
        createdFrom: 'dashboard',
        userAgent: req.headers['user-agent']
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        apiKey: apiKey.toJSON(),
        key // Only returned once during creation
      },
      message: 'API key created successfully'
    });
  })
);

// Update API key
router.put('/:id',
  requireAuth,
  updateApiKeyValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!._id;
    const updates = req.body;

    const apiKey = await ApiKey.findOneAndUpdate(
      { _id: id, userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    return res.json({
      success: true,
      data: { apiKey },
      message: 'API key updated successfully'
    });
  })
);

// Regenerate API key
router.post('/:id/regenerate',
  requireAuth,
  rateLimiters.burst,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!._id;

    const apiKey = await ApiKey.findOne({ _id: id, userId });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    // Generate new key
    const { key, hash, prefix } = (ApiKey as any).generateApiKey();

    // Update API key
    apiKey.keyHash = hash;
    apiKey.keyPrefix = prefix;
    apiKey.lastUsedAt = undefined; // Reset usage timestamp
    await apiKey.save();

    return res.json({
      success: true,
      data: {
        apiKey: apiKey.toJSON(),
        key // Only returned once during regeneration
      },
      message: 'API key regenerated successfully'
    });
  })
);

// Delete API key (soft delete)
router.delete('/:id',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!._id;

    const apiKey = await ApiKey.findOneAndUpdate(
      { _id: id, userId },
      { isActive: false },
      { new: true }
    );

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    return res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  })
);

export default router;
