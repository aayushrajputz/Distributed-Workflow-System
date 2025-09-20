import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'express-validator';

// Custom error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle different types of errors
const handleCastErrorDB = (err: any) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, 'INVALID_ID');
};

const handleDuplicateFieldsDB = (err: any) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `${field} '${value}' already exists`;
  return new AppError(message, 400, 'DUPLICATE_FIELD');
};

const handleValidationErrorDB = (err: any) => {
  const errors = Object.values(err.errors).map((el: any) => el.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new AppError(message, 400, 'VALIDATION_ERROR');
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401, 'INVALID_TOKEN');

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401, 'EXPIRED_TOKEN');

const handleValidationError = (errors: any[]) => {
  const messages = errors.map((error: any) => {
    const field = error.path || error.param || 'field';
    const message = error.msg || 'Invalid value';
    return `${field}: ${message}`;
  });
  return new AppError(`Validation failed: ${messages.join(', ')}`, 400, 'VALIDATION_ERROR');
};

// Send error response in development
const sendErrorDev = (err: AppError, res: Response) => {
  res.status(err.statusCode).json({
    success: false,
    error: err.message,
    code: err.code,
    stack: err.stack,
    details: err
  });
};

// Send error response in production
const sendErrorProd = (err: AppError, res: Response) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code
    });
  } else {
    // Programming or other unknown error: don't leak error details
    console.error('ERROR 💥', err);
    
    res.status(500).json({
      success: false,
      error: 'Something went wrong!',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Main error handling middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (err.name === 'CastError') error = handleCastErrorDB(error);
    if (err.code === 11000) error = handleDuplicateFieldsDB(error);
    if (err.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (err.errors && Array.isArray(err.errors)) error = handleValidationError(err.errors);

    sendErrorProd(error, res);
  }
};

// 404 handler
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND');
  next(error);
};

// Async error wrapper
export const catchAsync = <T extends (...args: any[]) => any>(fn: T) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      Promise.resolve(fn(req as any, res as any, next)).catch(next);
    } catch (err) {
      next(err);
    }
  };
};

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const error = handleValidationError(errors.array());
    return next(error);
  }
  
  next();
};
