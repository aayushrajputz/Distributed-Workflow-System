import express from 'express';
import { requireApiKey, requirePermission } from '../middleware/auth';
import { catchAsync } from '../middleware/errorHandler';
import { AuthenticatedRequest, SystemMetrics, ApiMetrics, TaskMetrics, DistributedNode } from '../types';
import Task from '../models/Task';
import UsageLog from '../models/UsageLog';
import ApiKey from '../models/ApiKey';
import { register, collectDefaultMetrics, Gauge, Counter, Histogram } from 'prom-client';

const router = express.Router();

// Initialize Prometheus metrics
collectDefaultMetrics();

// Custom metrics
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route']
});

const activeApiKeys = new Gauge({
  name: 'active_api_keys_total',
  help: 'Total number of active API keys'
});

const tasksTotal = new Gauge({
  name: 'tasks_total',
  help: 'Total number of tasks',
  labelNames: ['status']
});

// API key validation endpoint (used by frontend ApiKeyManager)
router.get('/status',
  requireApiKey,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const apiKey = req.apiKey!;
    
    res.json({
      success: true,
      data: {
        api_key: {
          name: apiKey.name,
          prefix: apiKey.keyPrefix,
          permissions: apiKey.permissions,
          environment: apiKey.metadata.environment
        },
        server: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      },
      message: 'API key is valid'
    });
  })
);

// Prometheus metrics endpoint
router.get('/metrics',
  requireApiKey,
  requirePermission('read'),
  catchAsync(async (req: AuthenticatedRequest, res) => {
    // Update custom metrics before serving
    await updateCustomMetrics();
    
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  })
);

// System metrics endpoint
router.get('/metrics/system',
  requireApiKey,
  requirePermission('read'),
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const metrics = await getSystemMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  })
);

// API metrics endpoint
router.get('/metrics/api',
  requireApiKey,
  requirePermission('read'),
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const metrics = await getApiMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  })
);

// Task metrics endpoint
router.get('/metrics/tasks',
  requireApiKey,
  requirePermission('read'),
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const metrics = await getTaskMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  })
);

// Distributed nodes endpoint
router.get('/metrics/nodes',
  requireApiKey,
  requirePermission('read'),
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const nodes = await getDistributedNodes();
    
    res.json({
      success: true,
      data: {
        nodes,
        total_nodes: nodes.length,
        healthy_nodes: nodes.filter(n => n.status === 'healthy').length
      }
    });
  })
);

// Comprehensive dashboard metrics
router.get('/metrics/dashboard',
  requireApiKey,
  requirePermission('read'),
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const [systemMetrics, apiMetrics, taskMetrics, nodes] = await Promise.all([
      getSystemMetrics(),
      getApiMetrics(),
      getTaskMetrics(),
      getDistributedNodes()
    ]);
    
    res.json({
      success: true,
      data: {
        system: systemMetrics,
        api: apiMetrics,
        tasks: taskMetrics,
        nodes: {
          nodes,
          total_nodes: nodes.length,
          healthy_nodes: nodes.filter(n => n.status === 'healthy').length
        }
      }
    });
  })
);

// Helper functions
async function getSystemMetrics(): Promise<SystemMetrics> {
  const process = await import('process');
  const os = await import('os');
  
  // Get system information
  const cpuUsage = process.cpuUsage();
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  // Calculate CPU usage percentage (simplified)
  const cpuPercent = Math.min(100, Math.max(0, 
    ((cpuUsage.user + cpuUsage.system) / 1000000 / uptime) * 100
  ));
  
  // Calculate memory usage percentage
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memPercent = ((totalMem - freeMem) / totalMem) * 100;
  
  // Get recent request metrics
  const recentRequests = await UsageLog.countDocuments({
    createdAt: { $gte: new Date(Date.now() - 60000) } // Last minute
  });
  
  const recentErrors = await UsageLog.countDocuments({
    createdAt: { $gte: new Date(Date.now() - 60000) },
    statusCode: { $gte: 400 }
  });
  
  const errorRate = recentRequests > 0 ? (recentErrors / recentRequests) * 100 : 0;
  
  return {
    cpu_usage: Math.round(cpuPercent * 100) / 100,
    memory_usage: Math.round(memPercent * 100) / 100,
    disk_usage: Math.round(Math.random() * 30 + 20), // Simulated
    network_io_bytes: Math.round(Math.random() * 1000000 + 500000), // Simulated
    uptime_seconds: Math.round(uptime),
    active_connections: Math.round(Math.random() * 50 + 10), // Simulated
    requests_per_second: Math.round(recentRequests / 60 * 100) / 100,
    error_rate: Math.round(errorRate * 100) / 100
  };
}

async function getApiMetrics(): Promise<ApiMetrics> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  
  // Get total requests
  const totalRequests = await UsageLog.countDocuments();
  
  // Get requests in last minute for RPS calculation
  const recentRequests = await UsageLog.countDocuments({
    createdAt: { $gte: oneMinuteAgo }
  });
  
  // Get error rate
  const recentErrors = await UsageLog.countDocuments({
    createdAt: { $gte: oneHourAgo },
    statusCode: { $gte: 400 }
  });
  
  const hourlyRequests = await UsageLog.countDocuments({
    createdAt: { $gte: oneHourAgo }
  });
  
  const errorRate = hourlyRequests > 0 ? (recentErrors / hourlyRequests) * 100 : 0;
  
  // Get average response time
  const avgResponseTime = await UsageLog.aggregate([
    { $match: { createdAt: { $gte: oneHourAgo } } },
    { $group: { _id: null, avgTime: { $avg: '$responseTimeMs' } } }
  ]);
  
  // Get active API keys count
  const activeKeysCount = await ApiKey.countDocuments({ isActive: true });
  
  return {
    total_requests: totalRequests,
    requests_per_second: Math.round(recentRequests / 60 * 100) / 100,
    error_rate: Math.round(errorRate * 100) / 100,
    avg_response_time: Math.round((avgResponseTime[0]?.avgTime || 0) * 100) / 100,
    active_api_keys: activeKeysCount
  };
}

async function getTaskMetrics(): Promise<TaskMetrics> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  // Get task counts by status
  const taskStats = await Task.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const statusCounts: Record<string, number> = {};
  taskStats.forEach(stat => {
    statusCounts[stat._id] = stat.count;
  });

  const totalTasks = Object.values(statusCounts).reduce((sum: number, count: number) => sum + count, 0);
  
  // Get tasks created in last hour
  const recentTasks = await Task.countDocuments({
    createdAt: { $gte: oneHourAgo },
    isActive: true
  });
  
  // Get average execution time for completed tasks
  const avgExecTime = await Task.aggregate([
    {
      $match: {
        status: 'completed',
        completedAt: { $exists: true },
        createdAt: { $exists: true }
      }
    },
    {
      $project: {
        executionTime: {
          $divide: [
            { $subtract: ['$completedAt', '$createdAt'] },
            1000 * 60 * 60 // Convert to hours
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        avgTime: { $avg: '$executionTime' }
      }
    }
  ]);
  
  return {
    total_tasks: totalTasks,
    running_tasks: statusCounts.in_progress || 0,
    completed_tasks: statusCounts.completed || 0,
    failed_tasks: statusCounts.cancelled || 0,
    avg_execution_time: Math.round((avgExecTime[0]?.avgTime || 0) * 100) / 100,
    tasks_per_hour: recentTasks
  };
}

async function getDistributedNodes(): Promise<DistributedNode[]> {
  // Simulate distributed nodes data
  // In a real implementation, this would query actual node health data
  const regions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];
  const services = ['api', 'worker', 'scheduler', 'metrics'];
  
  return regions.map((region, index) => {
    const isHealthy = Math.random() > 0.1; // 90% healthy
    const cpuUsage = Math.round(Math.random() * 80 + 10);
    const memoryUsage = Math.round(Math.random() * 70 + 20);
    
    return {
      id: `node-${index + 1}`,
      name: `Node ${index + 1}`,
      region,
      status: isHealthy ? 'healthy' : (Math.random() > 0.5 ? 'warning' : 'critical'),
      cpu_usage: cpuUsage,
      memory_usage: memoryUsage,
      last_heartbeat: new Date(Date.now() - Math.random() * 30000).toISOString(),
      services: services.slice(0, Math.floor(Math.random() * services.length) + 1)
    };
  });
}

async function updateCustomMetrics(): Promise<void> {
  try {
    // Update active API keys metric
    const activeKeysCount = await ApiKey.countDocuments({ isActive: true });
    activeApiKeys.set(activeKeysCount);
    
    // Update task metrics
    const taskStats = await Task.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Reset task metrics
    tasksTotal.reset();
    
    // Set task counts by status
    taskStats.forEach(stat => {
      tasksTotal.set({ status: stat._id }, stat.count);
    });
    
  } catch (error) {
    console.error('Error updating custom metrics:', error);
  }
}

export default router;