const express = require('express');
const { authenticateApiKey, requirePermission } = require('../middleware/apiKeyAuth');
const rateLimit = require('express-rate-limit');
const {
  getIntegrations,
  setupSlackIntegration,
  setupGitHubIntegration,
  setupJiraIntegration,
  sendSlackNotification,
} = require('../controllers/integrationController');
const integrationSetupService = require('../services/integrationSetupService');
const Integration = require('../models/Integration');
const integrationService = require('../services/integrationService');

const router = express.Router();

// Enforce API key auth for integration management endpoints
router.use(authenticateApiKey);

// Apply a fixed rate limit of 1000 requests/hour
const integrationsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(integrationsLimiter);

// Whitelist domains for management endpoints
router.use((req, res, next) => {
  const origin = req.get('origin') || '';
  const host = req.hostname || '';
  const isWhitelisted = (h) => h && (h === 'localhost' || h.endsWith('.company.com'));
  if (origin) {
    try {
      const u = new URL(origin);
      if (!isWhitelisted(u.hostname)) return res.status(403).json({ success: false, error: 'Origin not allowed' });
    } catch (_) {}
  } else if (!isWhitelisted(host)) {
    return res.status(403).json({ success: false, error: 'Host not allowed' });
  }
  next();
});

// List integrations
router.get('/', requirePermission('read'), getIntegrations);

// Setup all integrations at once
router.post('/setup-all', requirePermission('write'), async (req, res) => {
  try {
    const results = await integrationSetupService.setupAllIntegrations(req.user._id, req.body);
    
    res.json({
      success: true,
      data: results,
      message: `${results.summary.connected}/${results.summary.total} integrations configured successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to setup integrations',
      error: error.message
    });
  }
});

// Get integration status
router.get('/status', requirePermission('read'), async (req, res) => {
  try {
    const status = await integrationSetupService.getIntegrationStatus(req.user._id);
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get integration status',
      error: error.message
    });
  }
});

// Setup/Update integrations
router.post('/slack', requirePermission('write'), setupSlackIntegration);
router.post('/github', requirePermission('write'), setupGitHubIntegration);
router.post('/jira', requirePermission('write'), setupJiraIntegration);

// Send Slack message helper
router.post('/slack/notify', requirePermission('write'), sendSlackNotification);

// Return JSON status logs (connected/disconnected) for each integration
router.get('/status', requirePermission('read'), async (req, res) => {
  try {
    const integrations = await Integration.find({ userId: req.user._id, isActive: true });

    const results = [];
    for (const integ of integrations) {
      let status = { success: false, message: 'Unknown' };
      try {
        switch (integ.type) {
          case 'slack':
            status = await integrationService.testSlackConnection(integ);
            break;
          case 'github':
            status = await integrationService.testGitHubConnection(integ);
            break;
          case 'jira':
            status = await integrationService.testJiraConnection(integ);
            break;
          case 'webhook':
            status = await integrationService.testWebhookConnection(integ);
            break;
          default:
            status = { success: false, error: 'Unsupported integration' };
        }
      } catch (e) {
        status = { success: false, error: e.message };
      }

      results.push({
        id: integ._id,
        type: integ.type,
        name: integ.name,
        connected: !!status.success,
        status,
        lastSyncAt: integ.lastSyncAt,
        updatedAt: integ.updatedAt,
      });
    }

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

