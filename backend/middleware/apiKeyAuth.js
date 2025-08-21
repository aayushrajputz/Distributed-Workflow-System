const ApiKey = require('../models/ApiKey');
const User = require('../models/User');

// API Key Authentication middleware
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.header('X-API-Key') || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required. Please include X-API-Key header.',
        code: 'NO_API_KEY',
        documentation: 'https://docs.yourapi.com/authentication'
      });
    }

    // Validate API key format
    if (!apiKey.startsWith('sk_')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key format. API keys must start with "sk_".',
        code: 'INVALID_API_KEY_FORMAT'
      });
    }

    // Hash the provided API key
    const keyHash = ApiKey.hashApiKey(apiKey);

    // Find API key in database
    const apiKeyDoc = await ApiKey.findOne({ 
      keyHash, 
      isActive: true 
    }).populate('userId', 'username email firstName lastName isActive');
    
    if (!apiKeyDoc) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key.',
        code: 'INVALID_API_KEY'
      });
    }

    // Check if user account is active
    if (!apiKeyDoc.userId || !apiKeyDoc.userId.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated.',
        code: 'USER_DEACTIVATED'
      });
    }

    // Update last used timestamp (async, don't wait)
    apiKeyDoc.updateLastUsed().catch(err => 
      console.error('Failed to update API key last used:', err)
    );

    // Attach API key and user info to request
    req.apiKey = apiKeyDoc;
    req.user = apiKeyDoc.userId;
    
    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication service error.',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

// Check API key permissions
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!req.apiKey.permissions.includes(permission) && !req.apiKey.permissions.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required: ${permission}`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

module.exports = { 
  authenticateApiKey,
  requirePermission,
};
