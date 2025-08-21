const { verifyToken } = require('../config/jwt');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select('-password -loginAttempts -lockUntil');

    if (!user) {
      return res.status(401).json({
        message: 'Invalid token. User not found.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user account is still active
    if (!user.isActive) {
      return res.status(401).json({
        message: 'Account is deactivated.',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token has expired.',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid token format.',
        code: 'INVALID_TOKEN'
      });
    }

    res.status(401).json({
      message: 'Authentication failed.',
      code: 'AUTH_FAILED'
    });
  }
};

module.exports = { authenticate };
