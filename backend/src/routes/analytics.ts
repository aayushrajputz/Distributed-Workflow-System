import express from 'express';
import { query } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { handleValidationErrors, catchAsync } from '../middleware/errorHandler';
import UsageLog from '../models/UsageLog';
import ApiKey from '../models/ApiKey';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

// Validation rules
const daysValidation = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365')
];

const limitValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000')
];

// Get usage statistics
router.get('/usage',
  requireAuth,
  daysValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;
    const days = parseInt(req.query.days as string) || 30;

    // Get user's API keys
    const userApiKeys = await ApiKey.find({ userId, isActive: true }).select('_id');
    const apiKeyIds = userApiKeys.map(key => key._id.toString());

    // Get usage stats for user's API keys
    const stats = await (UsageLog as any).getUsageStats(
      { apiKeyId: { $in: apiKeyIds } },
      days
    );

    res.json({
      success: true,
      data: {
        stats,
        period: `${days} days`
      }
    });
  })
);

// Get endpoint statistics
router.get('/endpoints',
  requireAuth,
  daysValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;
    const days = parseInt(req.query.days as string) || 30;

    // Get user's API keys
    const userApiKeys = await ApiKey.find({ userId, isActive: true }).select('_id');
    const apiKeyIds = userApiKeys.map(key => key._id.toString());

    // Get endpoint stats for user's API keys
    const endpoints = await (UsageLog as any).getEndpointStats(
      { apiKeyId: { $in: apiKeyIds } },
      days
    );

    res.json({
      success: true,
      data: {
        endpoints,
        period: `${days} days`
      }
    });
  })
);

// Get daily statistics
router.get('/daily',
  requireAuth,
  daysValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;
    const days = parseInt(req.query.days as string) || 30;

    // Get user's API keys
    const userApiKeys = await ApiKey.find({ userId, isActive: true }).select('_id');
    const apiKeyIds = userApiKeys.map(key => key._id.toString());

    // Get daily stats for user's API keys
    const daily = await (UsageLog as any).getDailyStats(
      { apiKeyId: { $in: apiKeyIds } },
      days
    );

    res.json({
      success: true,
      data: {
        daily,
        period: `${days} days`
      }
    });
  })
);

// Get recent usage logs
router.get('/logs',
  requireAuth,
  limitValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;
    const limit = parseInt(req.query.limit as string) || 50;

    // Get user's API keys
    const userApiKeys = await ApiKey.find({ userId, isActive: true }).select('_id');
    const apiKeyIds = userApiKeys.map(key => key._id.toString());

    // Get recent logs for user's API keys
    const logs = await UsageLog.find({ apiKeyId: { $in: apiKeyIds } })
      .populate('apiKeyId', 'name keyPrefix')
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('endpoint method statusCode responseTimeMs ipAddress createdAt apiKeyId');

    const total = await UsageLog.countDocuments({ apiKeyId: { $in: apiKeyIds } });

    res.json({
      success: true,
      data: {
        logs,
        total
      }
    });
  })
);

// Get comprehensive dashboard data
router.get('/dashboard',
  requireAuth,
  daysValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;
    const days = parseInt(req.query.days as string) || 30;

    // Get user's API keys
    const userApiKeys = await ApiKey.find({ userId, isActive: true }).select('_id name keyPrefix');
    const apiKeyIds = userApiKeys.map(key => key._id.toString());

    if (apiKeyIds.length === 0) {
      // Return empty data if user has no API keys
      return res.json({
        success: true,
        data: {
          overview: {
            totalRequests: 0,
            uniqueEndpoints: 0,
            successfulRequests: 0,
            failedRequests: 0,
            avgResponseTime: 0,
            successRate: '0.00',
            lastRequestAt: null
          },
          endpoints: [],
          daily: [],
          recentLogs: [],
          insights: {
            mostUsedEndpoint: null,
            peakUsageDay: null,
            avgDailyRequests: '0',
            errorTrend: 0,
            apiKeysCount: 0
          }
        }
      });
    }

    // Get all data in parallel
    const [overview, endpoints, daily, recentLogs] = await Promise.all([
      (UsageLog as any).getUsageStats({ apiKeyId: { $in: apiKeyIds } }, days),
      (UsageLog as any).getEndpointStats({ apiKeyId: { $in: apiKeyIds } }, days),
      (UsageLog as any).getDailyStats({ apiKeyId: { $in: apiKeyIds } }, days),
      UsageLog.find({ apiKeyId: { $in: apiKeyIds } })
        .populate('apiKeyId', 'name keyPrefix')
        .sort({ createdAt: -1 })
        .limit(20)
        .select('endpoint method statusCode responseTimeMs ipAddress createdAt apiKeyId')
    ]);

    // Get last request timestamp
    const lastRequest = await UsageLog.findOne({ apiKeyId: { $in: apiKeyIds } })
      .sort({ createdAt: -1 })
      .select('createdAt');

    // Calculate insights
    const insights = {
      mostUsedEndpoint: endpoints.length > 0 ? endpoints[0] : null,
      peakUsageDay: daily.length > 0 ? daily.reduce((max: any, day: any) =>
        day.requestCount > max.requestCount ? day : max
      ) : null,
      avgDailyRequests: daily.length > 0 ?
        (daily.reduce((sum: number, day: any) => sum + day.requestCount, 0) / daily.length).toFixed(1) : '0',
      errorTrend: daily.length >= 2 ?
        daily[daily.length - 1].failedRequests - daily[daily.length - 2].failedRequests : 0,
      apiKeysCount: userApiKeys.length
    };

    // Enhanced overview with additional fields
    const enhancedOverview = {
      ...overview,
      lastRequestAt: lastRequest?.createdAt || null
    };

    res.json({
      success: true,
      data: {
        overview: enhancedOverview,
        endpoints: endpoints.slice(0, 10), // Top 10 endpoints
        daily,
        recentLogs,
        insights
      }
    });
  })
);

export default router;