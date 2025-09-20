import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import UsageLog from '../models/UsageLog';

// Request logging middleware for analytics
export const requestLogger = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override res.end to capture response data
  res.end = ((chunk?: any, encoding?: any, cb?: any) => {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Log the request asynchronously (don't block response)
    setImmediate(async () => {
      try {
        await logRequest(req, res, responseTime);
      } catch (error) {
        console.error('Error logging request:', error);
      }
    });
    
    // Call original end function
    return originalEnd.call(res, chunk, encoding, cb);
  }) as any;
  
  next();
};

// Log request to database
async function logRequest(req: AuthenticatedRequest, res: Response, responseTimeMs: number) {
  try {
    // Skip logging for certain endpoints to avoid noise
    const skipPaths = ['/health', '/favicon.ico', '/robots.txt'];
    if (skipPaths.some(path => req.path.includes(path))) {
      return;
    }
    
    // Skip logging for static files
    if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      return;
    }
    
    // Get IP address (handle proxy)
    const ipAddress = req.ip || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress || 
                     (req.connection as any)?.socket?.remoteAddress || 
                     'unknown';
    
    // Get user agent
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Get request size (approximate)
    const requestSize = JSON.stringify(req.body || {}).length + 
                       JSON.stringify(req.query || {}).length + 
                       JSON.stringify(req.headers || {}).length;
    
    // Get response size (approximate)
    const responseSize = res.get('content-length') ? 
                        parseInt(res.get('content-length') || '0') : 
                        0;
    
    // Create usage log entry
    const logData: any = {
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTimeMs,
      ipAddress,
      userAgent,
      requestSize,
      responseSize
    };
    
    // Add API key info if present
    if (req.apiKey) {
      logData.apiKeyId = req.apiKey._id;
    }
    
    // Add user info if present
    if (req.user) {
      logData.userId = req.user._id;
    }
    
    // Add error message for failed requests
    if (res.statusCode >= 400) {
      logData.errorMessage = `${res.statusCode} ${res.statusMessage}`;
    }
    
    // Save to database
    await UsageLog.create(logData);
    
  } catch (error) {
    // Don't throw errors from logging - just log them
    console.error('Failed to log request:', error);
  }
}

// Middleware to add request ID for tracing
export const addRequestId = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || generateRequestId();
  req.headers['x-request-id'] = requestId as string;
  res.setHeader('x-request-id', requestId);
  next();
};

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Middleware to log slow requests
export const slowRequestLogger = (threshold: number = 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    const originalEnd = res.end;
    res.end = ((chunk?: any, encoding?: any, cb?: any) => {
      const duration = Date.now() - startTime;
      
      if (duration > threshold) {
        console.warn(`🐌 Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
      }
      
      return originalEnd.call(res, chunk, encoding, cb);
    }) as any;
    
    next();
  };
};

// Middleware to log API key usage
export const apiKeyUsageLogger = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.apiKey) {
    console.log(`🔑 API Key used: ${req.apiKey.name} (${req.apiKey.keyPrefix}...) for ${req.method} ${req.path}`);
  }
  next();
};
