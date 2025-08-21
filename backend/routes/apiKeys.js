const express = require('express');
const { body, param } = require('express-validator');
const {
  getApiKeys,
  createApiKey,
  getApiKey,
  updateApiKey,
  regenerateApiKey,
  deleteApiKey,
} = require('../controllers/apiKeyController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation rules
const createApiKeyValidation = [
  body('name')
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('API key name is required and cannot exceed 100 characters'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
    .custom((permissions) => {
      const validPermissions = ['read', 'write', 'admin'];
      const invalid = permissions.filter(p => !validPermissions.includes(p));
      if (invalid.length > 0) {
        throw new Error(`Invalid permissions: ${invalid.join(', ')}`);
      }
      return true;
    }),
  body('environment')
    .optional()
    .isIn(['development', 'staging', 'production'])
    .withMessage('Environment must be development, staging, or production'),
];

const updateApiKeyValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid API key ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('API key name cannot exceed 100 characters'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
    .custom((permissions) => {
      const validPermissions = ['read', 'write', 'admin'];
      const invalid = permissions.filter(p => !validPermissions.includes(p));
      if (invalid.length > 0) {
        throw new Error(`Invalid permissions: ${invalid.join(', ')}`);
      }
      return true;
    }),
  body('rateLimit.requestsPerHour')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Requests per hour must be between 1 and 10000'),
  body('rateLimit.requestsPerDay')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('Requests per day must be between 1 and 100000'),
];

const apiKeyIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid API key ID'),
];

// Routes
router.get('/', getApiKeys);
router.post('/', createApiKeyValidation, createApiKey);
router.get('/:id', apiKeyIdValidation, getApiKey);
router.put('/:id', updateApiKeyValidation, updateApiKey);
router.post('/:id/regenerate', apiKeyIdValidation, regenerateApiKey);
router.delete('/:id', apiKeyIdValidation, deleteApiKey);

module.exports = router;
