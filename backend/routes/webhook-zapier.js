const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateApiKey, requirePermission } = require('../middleware/apiKeyAuth');
const AuditLog = require('../models/AuditLog');
const workflowEngine = require('../services/workflowEngine');

const router = express.Router();

// Allow only whitelisted domains
const isWhitelisted = (host) => {
  if (!host) return false;
  const patterns = ['localhost', '.company.com'];
  return patterns.some((p) => host === p || host.endsWith(p));
};

router.use((req, res, next) => {
  const origin = req.get('origin') || '';
  const host = req.hostname || '';
  if (origin) {
    try {
      const u = new URL(origin);
      if (!isWhitelisted(u.hostname)) {
        return res.status(403).json({ success: false, error: 'Origin not allowed' });
      }
    } catch (_) {
      // ignore parse errors
    }
  } else if (!isWhitelisted(host)) {
    return res.status(403).json({ success: false, error: 'Host not allowed' });
  }
  next();
});

// API key auth and fixed rate limit 1000/hr
router.use(authenticateApiKey);
router.use(rateLimit({ windowMs: 60 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false }));

// Incoming Zapier trigger receiver: Zapier posts data to trigger workflows
router.post('/', requirePermission('write'), async (req, res) => {
  try {
    const payload = req.body || {};

    await AuditLog.logAction({
      userId: req.user._id,
      action: 'zapier.webhook_received',
      resource: 'zapier',
      details: { size: JSON.stringify(payload).length },
    });

    // Trigger any workflows mapped to zapier events
    const variables = { ...payload, source: 'zapier', receivedAt: new Date().toISOString() };
    await workflowEngine.executeEventRules('zapier_event', variables);

    res.json({ success: true, message: 'Zapier webhook processed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Outgoing Zapier polling: Zapier can GET to fetch latest workflow events
router.get('/', requirePermission('read'), async (req, res) => {
  try {
    // A lightweight stub returning recent events from workflow engine memory buffer
    const events = workflowEngine.getRecentEvents ? workflowEngine.getRecentEvents(25) : [];
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

