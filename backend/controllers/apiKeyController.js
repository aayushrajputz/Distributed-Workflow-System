const { validationResult } = require('express-validator');
const ApiKey = require('../models/ApiKey');

// @desc    Get all API keys for authenticated user
// @route   GET /api/keys
// @access  Private
const getApiKeys = async (req, res) => {
  try {
    const apiKeys = await ApiKey.find({
      userId: req.user._id,
      isActive: true,
    }).sort({ createdAt: -1 });

    // Get usage stats for each API key
    const apiKeysWithStats = await Promise.all(
      apiKeys.map(async (apiKey) => {
        const stats = await apiKey.getUsageStats();
        return {
          ...apiKey.toJSON(),
          stats,
        };
      }),
    );

    res.json({
      success: true,
      data: {
        apiKeys: apiKeysWithStats,
        total: apiKeys.length,
      },
    });
  } catch (error) {
    console.error('Get API keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Create a new API key
// @route   POST /api/keys
// @access  Private
const createApiKey = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { name, permissions = ['read'], environment = 'development' } = req.body;

    // Check if user already has maximum number of API keys (limit to 10)
    const existingKeys = await ApiKey.countDocuments({
      userId: req.user._id,
      isActive: true,
    });

    if (existingKeys >= 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum number of API keys reached (10)',
      });
    }

    // Generate new API key
    const { apiKey, prefix } = ApiKey.generateApiKey();
    const keyHash = ApiKey.hashApiKey(apiKey);

    // Create API key document
    const newApiKey = new ApiKey({
      userId: req.user._id,
      name,
      keyHash,
      keyPrefix: prefix,
      permissions,
      metadata: {
        environment,
        createdFrom: req.ip,
      },
    });

    await newApiKey.save();

    res.status(201).json({
      success: true,
      message: 'API key created successfully',
      data: {
        apiKey: newApiKey.toJSON(),
        key: apiKey, // Only returned once!
        warning: 'This is the only time you will see the full API key. Please store it securely.',
      },
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get API key details with usage stats
// @route   GET /api/keys/:id
// @access  Private
const getApiKey = async (req, res) => {
  try {
    const { id } = req.params;

    const apiKey = await ApiKey.findOne({
      _id: id,
      userId: req.user._id,
      isActive: true,
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key not found',
      });
    }

    // Get detailed usage stats and recent usage
    const [stats, recentUsage] = await Promise.all([
      apiKey.getUsageStats(),
      apiKey.getRecentUsage(20),
    ]);

    res.json({
      success: true,
      data: {
        apiKey: apiKey.toJSON(),
        stats,
        recentUsage,
      },
    });
  } catch (error) {
    console.error('Get API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Update API key
// @route   PUT /api/keys/:id
// @access  Private
const updateApiKey = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const { name, permissions, rateLimit } = req.body;

    const apiKey = await ApiKey.findOne({
      _id: id,
      userId: req.user._id,
      isActive: true,
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key not found',
      });
    }

    // Update fields
    if (name) apiKey.name = name;
    if (permissions) apiKey.permissions = permissions;
    if (rateLimit) {
      apiKey.rateLimit = {
        ...apiKey.rateLimit,
        ...rateLimit,
      };
    }

    await apiKey.save();

    res.json({
      success: true,
      message: 'API key updated successfully',
      data: {
        apiKey: apiKey.toJSON(),
      },
    });
  } catch (error) {
    console.error('Update API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Regenerate API key
// @route   POST /api/keys/:id/regenerate
// @access  Private
const regenerateApiKey = async (req, res) => {
  try {
    const { id } = req.params;

    const oldApiKey = await ApiKey.findOne({
      _id: id,
      userId: req.user._id,
      isActive: true,
    });

    if (!oldApiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key not found',
      });
    }

    // Generate new API key
    const { apiKey, prefix } = ApiKey.generateApiKey();
    const keyHash = ApiKey.hashApiKey(apiKey);

    // Update the existing API key with new values
    oldApiKey.keyHash = keyHash;
    oldApiKey.keyPrefix = prefix;
    oldApiKey.lastUsedAt = null; // Reset usage timestamp

    await oldApiKey.save();

    res.json({
      success: true,
      message: 'API key regenerated successfully',
      data: {
        apiKey: oldApiKey.toJSON(),
        key: apiKey, // Only returned once!
        warning: 'This is the only time you will see the full API key. Please store it securely.',
      },
    });
  } catch (error) {
    console.error('Regenerate API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Delete (deactivate) API key
// @route   DELETE /api/keys/:id
// @access  Private
const deleteApiKey = async (req, res) => {
  try {
    const { id } = req.params;

    const apiKey = await ApiKey.findOne({
      _id: id,
      userId: req.user._id,
      isActive: true,
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key not found',
      });
    }

    // Deactivate instead of deleting to preserve usage logs
    apiKey.isActive = false;
    await apiKey.save();

    res.json({
      success: true,
      message: 'API key deleted successfully',
    });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  getApiKeys,
  createApiKey,
  getApiKey,
  updateApiKey,
  regenerateApiKey,
  deleteApiKey,
};
