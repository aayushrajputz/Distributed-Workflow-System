const express = require('express');
const { authenticate } = require('../middleware/auth');

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
      uptime: "99.94%",
      lastFailure: "2024-01-14T15:30:00Z",
      avgResponseTime: Math.floor(Math.random() * 20) + 35, // 35-55ms
      totalRequests: 1247832 + Math.floor(Math.random() * 1000),
      errorRate: Math.random() * 0.05, // 0-5%
    };

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching system status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system status',
      error: error.message
    });
  }
});

module.exports = router;
