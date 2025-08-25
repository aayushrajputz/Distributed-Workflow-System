const express = require('express');
const { authenticate } = require('../middleware/auth');
const mongoose = require('mongoose');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Get system status
router.get('/status', async (req, res) => {
  try {
    // In a real system, this would fetch actual metrics from monitoring services
    // For now, we'll return realistic mock data with some variation
    const status = {
      totalNodes: 10,
      activeNodes: 8 + Math.floor(Math.random() * 2), // 8-9
      failedNodes: Math.floor(Math.random() * 2), // 0-1
      maintenanceNodes: 1,
      uptime: '99.94%',
      lastFailure: '2024-01-14T15:30:00Z',
      avgResponseTime: Math.floor(Math.random() * 20) + 35, // 35-55ms
      totalRequests: 1247832 + Math.floor(Math.random() * 1000),
      errorRate: Math.random() * 0.05, // 0-5%
    };

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching system status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system status',
      error: error.message,
    });
  }
});

// Integration connection status (JSON logs)
const Integration = require('../models/Integration');
const integrationService = require('../services/integrationService');
router.get('/integrations/status', async (req, res) => {
  try {
    const integrations = await Integration.find({ isActive: true }).limit(50);
    const out = [];
    for (const integ of integrations) {
      let status = { success: false };
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
      out.push({ id: integ._id, type: integ.type, name: integ.name, connected: !!status.success, status });
    }
    res.json({ success: true, data: out });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

// Database health
router.get('/db', async (req, res) => {
  try {
    const conn = mongoose.connection;
    const state = conn.readyState; // 0=disconnected,1=connected,2=connecting,3=disconnecting
    let pingOk = false;
    try {
      const ping = await conn.db.command({ ping: 1 });
      pingOk = ping?.ok === 1;
    } catch {}
    res.json({ success: true, data: { state, ping: pingOk, host: conn.host, name: conn.name } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
