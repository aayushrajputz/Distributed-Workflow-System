const express = require('express');
const { body, query } = require('express-validator');
const {
  getNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  getAnalytics,
  getStatus,
} = require('../controllers/publicApiController');
const { authenticateApiKey, requirePermission } = require('../middleware/apiKeyAuth');
const { createApiKeyRateLimiter } = require('../middleware/rateLimiter');
const { logApiUsage, addUsageHeaders } = require('../middleware/usageLogger');

const router = express.Router();

// Apply API key authentication and rate limiting to all routes
router.use(authenticateApiKey);
router.use(createApiKeyRateLimiter());
router.use(logApiUsage);
router.use(addUsageHeaders);

// Validation rules
const createNoteValidation = [
  body('title')
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and cannot exceed 200 characters'),
  body('content')
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 50000 })
    .withMessage('Content is required and cannot exceed 50000 characters'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category cannot exceed 50 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Each tag cannot exceed 30 characters'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
];

const updateNoteValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('content')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50000 })
    .withMessage('Content cannot exceed 50000 characters'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category cannot exceed 50 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Each tag cannot exceed 30 characters'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query cannot exceed 100 characters'),
  query('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category cannot exceed 50 characters'),
];

const analyticsValidation = [
  query('timeframe')
    .optional()
    .isIn(['7d', '30d', '90d'])
    .withMessage('Timeframe must be 7d, 30d, or 90d'),
];

// Public API routes

// Notes endpoints
router.get('/notes', requirePermission('read'), queryValidation, getNotes);
router.get('/notes/:id', requirePermission('read'), getNote);
router.post('/notes', requirePermission('write'), createNoteValidation, createNote);
router.put('/notes/:id', requirePermission('write'), updateNoteValidation, updateNote);
router.delete('/notes/:id', requirePermission('write'), deleteNote);

// Analytics endpoint
router.get('/analytics', requirePermission('read'), analyticsValidation, getAnalytics);

// Status endpoint (available to all authenticated API keys)
router.get('/status', getStatus);

module.exports = router;
