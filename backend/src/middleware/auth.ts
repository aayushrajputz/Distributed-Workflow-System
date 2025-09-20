import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../types';
import User from '../models/User';
import ApiKey from '../models/ApiKey';

// JWT Authentication middleware
export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not configured');
      res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

      // Find user and check if still active
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          error: 'Invalid token. User not found or inactive.'
        });
        return;
      }

      // Check if email is verified for sensitive operations
      if (!user.isEmailVerified && req.path !== '/verify-email' && req.path !== '/resend-verification') {
        res.status(403).json({
          success: false,
          error: 'Email verification required.',
          requiresEmailVerification: true,
          email: user.email
        });
        return;
      }

      req.user = user;
      next();
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        res.status(401).json({
          success: false,
          error: 'Token expired. Please log in again.'
        });
        return;
      } else if (jwtError.name === 'JsonWebTokenError') {
        res.status(401).json({
          success: false,
          error: 'Invalid token format.'
        });
        return;
      } else {
        throw jwtError;
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
    return;
  }
};

// API Key Authentication middleware
export const requireApiKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const apiKeyHeader = req.headers['x-api-key'] as string;

    if (!apiKeyHeader) {
      res.status(401).json({
        success: false,
        error: 'API key required',
        code: 'MISSING_API_KEY'
      });
      return;
    }

    // Validate API key format
    if (!apiKeyHeader.startsWith('sk_') || apiKeyHeader.length < 50) {
      res.status(401).json({
        success: false,
        error: 'Invalid API key format',
        code: 'INVALID_API_KEY_FORMAT'
      });
      return;
    }

    // Find API key in database
    const apiKey = await (ApiKey as any).findByKey(apiKeyHeader);

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
      return;
    }

    if (!apiKey.isActive) {
      res.status(403).json({
        success: false,
        error: 'API key is disabled',
        code: 'API_KEY_DISABLED'
      });
      return;
    }

    // Update last used timestamp (async, don't wait)
    apiKey.updateLastUsed().catch(console.error);

    req.apiKey = apiKey;
    next();
  } catch (error) {
    console.error('API key middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'API key validation error'
    });
    return;
  }
};

// Optional authentication (for endpoints that work with or without auth)
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      if (process.env.JWT_SECRET) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
          const user = await User.findById(decoded.userId);

          if (user && user.isActive) {
            req.user = user;
          }
        } catch (error) {
          // Ignore JWT errors for optional auth
        }
      }
    }

    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
};

// Admin role check
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
    return;
  }

  next();
};

// Permission check for API keys
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      res.status(401).json({
        success: false,
        error: 'API key required'
      });
      return;
    }

    if (!req.apiKey.permissions.includes(permission) && !req.apiKey.permissions.includes('admin')) {
      res.status(403).json({
        success: false,
        error: `Permission '${permission}' required`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
      return;
    }

    next();
  };
};

// Generate JWT token
export const generateToken = (userId: string): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  } as any);
};

// Verify JWT token (utility function)
export const verifyToken = (token: string): any => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.verify(token, process.env.JWT_SECRET);
};
