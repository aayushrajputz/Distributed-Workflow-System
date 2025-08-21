const express = require('express');
const {
  getPrometheusMetrics,
  getSystemMetrics,
  getDistributedNodes,
  getApiMetrics,
  getTaskMetrics,
  getDashboardMetrics
} = require('../controllers/metricsController');
const { authenticateApiKey, requirePermission } = require('../middleware/apiKeyAuth');
const { createApiKeyRateLimiter } = require('../middleware/rateLimiter');
const { logApiUsage, addUsageHeaders } = require('../middleware/usageLogger');

const router = express.Router();

// Apply API key authentication and rate limiting to all routes
router.use(authenticateApiKey);
router.use(createApiKeyRateLimiter());
router.use(logApiUsage);
router.use(addUsageHeaders);

// Metrics endpoints

// Prometheus metrics endpoint (text format)
router.get('/', requirePermission('read'), getPrometheusMetrics);

// System metrics (JSON format)
router.get('/system', requirePermission('read'), getSystemMetrics);

// Distributed nodes metrics
router.get('/nodes', requirePermission('read'), getDistributedNodes);

// API metrics
router.get('/api', requirePermission('read'), getApiMetrics);

// Task metrics
router.get('/tasks', requirePermission('read'), getTaskMetrics);

// Comprehensive dashboard metrics
router.get('/dashboard', requirePermission('read'), getDashboardMetrics);

module.exports = router;
