const { verifyToken } = require('../config/jwt');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({
        message: 'Access denied. No authorization header provided.',
        code: 'NO_AUTH_HEADER',
      });
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Invalid authorization format. Use Bearer token.',
        code: 'INVALID_AUTH_FORMAT',
      });
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN',
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    
    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        message: 'Invalid token. Missing user information.',
        code: 'INVALID_TOKEN_PAYLOAD',
      });
    }

    // Find user
    const user = await User.findById(decoded.userId).select('-password -loginAttempts -lockUntil');

    if (!user) {
      return res.status(401).json({
        message: 'Invalid token. User not found.',
        code: 'USER_NOT_FOUND',
      });
    }

    // Check if user account is still active
    if (!user.isActive) {
      return res.status(401).json({
        message: 'Account is deactivated.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    // Check if email is verified (optional, depending on your requirements)
    if (!user.isEmailVerified && process.env.NODE_ENV === 'production') {
      return res.status(401).json({
        message: 'Email verification required.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // Add user to request object
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token has expired.',
        code: 'TOKEN_EXPIRED',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid token format.',
        code: 'INVALID_TOKEN',
      });
    }

    // Log unexpected errors
    console.error('Authentication error:', error);

    res.status(401).json({
      message: 'Authentication failed.',
      code: 'AUTH_FAILED',
    });
  }
};

// Optional authentication middleware
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    
    if (decoded && decoded.userId) {
      const user = await User.findById(decoded.userId).select('-password -loginAttempts -lockUntil');
      if (user && user.isActive) {
        req.user = user;
        req.token = token;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

// Role-based authorization middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required.',
        code: 'AUTH_REQUIRED',
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: 'Insufficient permissions.',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    next();
  };
};

// Permission-based authorization middleware
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required.',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!req.user.hasPermission(permission)) {
      return res.status(403).json({
        message: 'Insufficient permissions.',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    next();
  };
};

module.exports = { 
  authenticate, 
  optionalAuth, 
  requireRole, 
  requirePermission 
};
