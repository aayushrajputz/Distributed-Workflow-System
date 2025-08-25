const express = require('express');
const { query, param } = require('express-validator');
const {
  getUsageStats,
  getEndpointStats,
  getDailyStats,
  getRecentLogs,
  getDashboardData,
  getApiKeyAnalytics,
} = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation rules
const daysValidation = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365'),
];

const limitValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000'),
];

const apiKeyIdValidation = [
  param('keyId')
    .isMongoId()
    .withMessage('Invalid API key ID'),
];

// Routes
router.get('/usage', daysValidation, getUsageStats);
router.get('/endpoints', daysValidation, getEndpointStats);
router.get('/daily', daysValidation, getDailyStats);
router.get('/logs', limitValidation, getRecentLogs);
router.get('/dashboard', daysValidation, getDashboardData);
router.get('/keys/:keyId', apiKeyIdValidation, daysValidation, getApiKeyAnalytics);

module.exports = router;
