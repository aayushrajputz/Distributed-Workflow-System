const UsageLog = require('../models/UsageLog');

// Middleware to log API usage
const logApiUsage = (req, res, next) => {
  const startTime = Date.now();
  
  // Store original res.json to capture response
  const originalJson = res.json;
  const originalSend = res.send;
  let responseSize = 0;
  let responseSent = false;

  // Override res.json to capture response size
  res.json = function(data) {
    if (!responseSent) {
      responseSize = JSON.stringify(data).length;
      responseSent = true;
    }
    return originalJson.call(this, data);
  };

  // Override res.send to capture response size
  res.send = function(data) {
    if (!responseSent) {
      responseSize = typeof data === 'string' ? data.length : JSON.stringify(data).length;
      responseSent = true;
    }
    return originalSend.call(this, data);
  };

  // Log usage after response is sent
  res.on('finish', async () => {
    try {
      const responseTime = Date.now() - startTime;
      const requestSize = parseInt(req.get('content-length')) || 0;
      
      // Only log if we have API key info
      if (req.apiKey && req.user) {
        // Extract relevant headers (excluding sensitive ones)
        const safeHeaders = {};
        const headersToLog = ['user-agent', 'accept', 'content-type', 'origin', 'referer'];
        headersToLog.forEach(header => {
          if (req.headers[header]) {
            safeHeaders[header] = req.headers[header];
          }
        });

        // Extract query parameters (excluding sensitive ones)
        const safeQuery = { ...req.query };
        delete safeQuery.password;
        delete safeQuery.token;
        delete safeQuery.secret;

        const logData = {
          userId: req.user._id,
          apiKeyId: req.apiKey._id,
          endpoint: req.originalUrl || req.url,
          method: req.method,
          statusCode: res.statusCode,
          responseTimeMs: responseTime,
          requestSize,
          responseSize,
          ipAddress: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
          userAgent: req.get('User-Agent') || '',
          requestHeaders: safeHeaders,
          queryParams: safeQuery,
          errorMessage: res.statusCode >= 400 ? res.statusMessage : null,
          metadata: {
            version: req.get('API-Version') || '1.0',
            region: req.get('CF-IPCountry') || 'unknown',
            feature: req.route?.path || 'unknown',
          },
        };

        await UsageLog.logUsage(logData);
      }
    } catch (error) {
      console.error('Failed to log API usage:', error);
      // Don't throw error to avoid affecting the response
    }
  });

  next();
};

// Middleware to add usage analytics to response headers
const addUsageHeaders = async (req, res, next) => {
  try {
    if (req.apiKey) {
      // Get current usage stats
      const stats = await req.apiKey.getUsageStats(1); // Last 24 hours
      
      res.set({
        'X-API-Usage-Today': stats.totalRequests || 0,
        'X-API-Success-Rate': stats.successRate || 0,
        'X-API-Avg-Response-Time': Math.round(stats.avgResponseTime) || 0,
      });
    }
  } catch (error) {
    console.error('Failed to add usage headers:', error);
    // Continue without headers
  }
  
  next();
};

module.exports = { 
  logApiUsage,
  addUsageHeaders,
};
