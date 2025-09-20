import express from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { catchAsync } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types';
import Task from '../models/Task';
import Workflow from '../models/Workflow';
import User from '../models/User';
import ApiKey from '../models/ApiKey';

const router = express.Router();

// Get system status (legacy endpoint for compatibility)
router.get('/status',
  optionalAuth,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    // Get basic system metrics
    const now = new Date();
    const startTime = process.hrtime();
    
    // Calculate uptime
    const uptimeSeconds = process.uptime();
    const uptimeHours = Math.floor(uptimeSeconds / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptime = `${uptimeHours}h ${uptimeMinutes}m`;

    // Get some basic counts (if user is authenticated)
    let systemData: any = {
      status: 'healthy',
      uptime,
      timestamp: now.toISOString(),
      version: '1.0.0'
    };

    if (req.user) {
      try {
        // Get user-specific or system-wide stats
        const [totalTasks, activeTasks, totalWorkflows, activeWorkflows] = await Promise.all([
          Task.countDocuments({ isActive: true }),
          Task.countDocuments({ isActive: true, status: { $in: ['pending', 'in_progress'] } }),
          Workflow.countDocuments({}),
          Workflow.countDocuments({ status: 'active' })
        ]);

        systemData = {
          ...systemData,
          totalNodes: 10, // Simulated
          activeNodes: 8, // Simulated
          failedNodes: 1, // Simulated
          maintenanceNodes: 1, // Simulated
          totalTasks,
          activeTasks,
          totalWorkflows,
          activeWorkflows,
          avgResponseTime: Math.floor(Math.random() * 20) + 35, // Simulated
          totalRequests: Math.floor(Math.random() * 1000) + 50000, // Simulated
          errorRate: Math.random() * 0.05, // Simulated
          lastFailure: new Date(Date.now() - Math.random() * 86400000).toISOString() // Random within last day
        };
      } catch (error) {
        console.error('Error fetching system stats:', error);
      }
    }

    // Calculate response time
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const responseTimeMs = seconds * 1000 + nanoseconds / 1000000;

    res.json({
      success: true,
      data: {
        ...systemData,
        responseTime: Math.round(responseTimeMs * 100) / 100
      }
    });
  })
);

// Get system health check
router.get('/health',
  catchAsync(async (req, res) => {
    const health: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: 'unknown'
    };

    // Check database connectivity
    try {
      await User.findOne().limit(1);
      health.database = 'connected';
    } catch (error) {
      health.database = 'disconnected';
      health.status = 'unhealthy';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  })
);

// Get system information (authenticated)
router.get('/info',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;

    // Get comprehensive system information
    const [
      userCount,
      taskCount,
      workflowCount,
      apiKeyCount,
      userTasks,
      userWorkflows,
      userApiKeys
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Task.countDocuments({ isActive: true }),
      Workflow.countDocuments({}),
      ApiKey.countDocuments({ isActive: true }),
      Task.countDocuments({ 
        isActive: true, 
        $or: [{ assignedTo: userId }, { assignedBy: userId }] 
      }),
      Workflow.countDocuments({ owner: userId }),
      ApiKey.countDocuments({ userId, isActive: true })
    ]);

    const systemInfo = {
      system: {
        status: 'operational',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      statistics: {
        global: {
          users: userCount,
          tasks: taskCount,
          workflows: workflowCount,
          apiKeys: apiKeyCount
        },
        user: {
          tasks: userTasks,
          workflows: userWorkflows,
          apiKeys: userApiKeys
        }
      },
      features: {
        authentication: true,
        apiKeys: true,
        realTime: true,
        notifications: true,
        analytics: true,
        integrations: true,
        webhooks: true,
        workflows: true,
        tasks: true
      },
      limits: {
        maxApiKeys: 10,
        maxIntegrations: 5,
        requestRateLimit: '100/15min',
        apiKeyRateLimit: '1000/hour'
      }
    };

    res.json({
      success: true,
      data: systemInfo
    });
  })
);

// Get system metrics summary
router.get('/metrics',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;

    // Get task metrics
    const taskStats = await Task.aggregate([
      {
        $match: {
          isActive: true,
          $or: [{ assignedTo: userId }, { assignedBy: userId }]
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get workflow metrics
    const workflowStats = await Workflow.aggregate([
      { $match: { owner: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Format the data
    const taskMetrics = taskStats.reduce((acc: any, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    const workflowMetrics = workflowStats.reduce((acc: any, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        tasks: {
          total: Object.values(taskMetrics).reduce((sum: any, count: any) => sum + count, 0),
          byStatus: taskMetrics
        },
        workflows: {
          total: Object.values(workflowMetrics).reduce((sum: any, count: any) => sum + count, 0),
          byStatus: workflowMetrics
        },
        timestamp: new Date().toISOString()
      }
    });
  })
);

export default router;