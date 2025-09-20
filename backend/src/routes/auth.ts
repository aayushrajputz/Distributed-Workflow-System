import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import { requireAuth, generateToken } from '../middleware/auth';
import { handleValidationErrors, catchAsync } from '../middleware/errorHandler';
import { rateLimiters } from '../middleware/rateLimit';
import User from '../models/User';
import { AuthenticatedRequest } from '../types';
import crypto from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService';

const router = express.Router();

// Validation rules
const registerValidation = [
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Register new user
router.post('/register', 
  rateLimiters.auth,
  registerValidation,
  handleValidationErrors,
  catchAsync(async (req: Request, res: Response) => {
    const { firstName, lastName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      emailVerificationToken,
      emailVerificationExpires
    });

    // Send verification email
    try {
      await sendVerificationEmail(user.email, emailVerificationToken);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // Don't fail registration if email fails
    }

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          role: user.role
        }
      },
      message: 'User registered successfully. Please check your email to verify your account.'
    });
    return;
  })
);

// Login user
router.post('/login',
  rateLimiters.auth,
  loginValidation,
  handleValidationErrors,
  catchAsync(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email, isActive: true }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    res.json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          role: user.role,
          lastLoginAt: user.lastLoginAt
        }
      },
      message: 'Login successful'
    });
    return;
  })
);

// Get current user profile
router.get('/me',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.user!._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          role: user.role,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });
    return;
  })
);

// Update user profile
router.put('/profile',
  requireAuth,
  [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be between 1 and 50 characters'),
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be between 1 and 50 characters'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email')
  ],
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { firstName, lastName, email } = req.body;
    const userId = req.user!._id;

    // If email is being changed, check if it's already taken
    if (email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: userId }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Email is already taken'
        });
      }
    }

    // Update user
    const updateData: any = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) {
      updateData.email = email;
      updateData.isEmailVerified = false; // Reset verification if email changes
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user },
      message: 'Profile updated successfully'
    });
    return;
  })
);

// Verify email
router.get('/verify-email/:token',
  catchAsync(async (req: Request, res: Response) => {
    const { token } = req.params;

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
      isActive: true
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token'
      });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
    return;
  })
);

// Resend verification email
router.post('/resend-verification',
  requireAuth,
  rateLimiters.auth,
  catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        error: 'Email is already verified'
      });
    }

    // Generate new verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Update user
    await User.findByIdAndUpdate(user._id, {
      emailVerificationToken,
      emailVerificationExpires
    });

    // Send verification email
    try {
      await sendVerificationEmail(user.email, emailVerificationToken);

      res.json({
        success: true,
        message: 'Verification email sent successfully'
      });
      return;
    } catch (error) {
      console.error('Failed to send verification email:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send verification email'
      });
      return;
    }
  })
);

// Request password reset
router.post('/forgot-password',
  rateLimiters.auth,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email')
  ],
  handleValidationErrors,
  catchAsync(async (req: Request, res: Response) => {
    const { email } = req.body;

    const user = await User.findOne({ email, isActive: true });

    if (!user) {
      // Don't reveal if email exists or not
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save reset token
    user.resetPasswordToken = resetPasswordToken;
    user.resetPasswordExpires = resetPasswordExpires;
    await user.save();

    // Send reset email
    try {
      await sendPasswordResetEmail(user.email, resetToken);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      return res.status(500).json({
        success: false,
        error: 'Failed to send password reset email'
      });
    }

    res.json({
      success: true,
      message: 'Password reset link sent to your email'
    });
    return;
  })
);

// Reset password
router.post('/reset-password/:token',
  rateLimiters.auth,
  [
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
  ],
  handleValidationErrors,
  catchAsync(async (req: Request, res: Response) => {
    const { token } = req.params;
    const { password } = req.body;

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
      isActive: true
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Generate new JWT token
    const jwtToken = generateToken(user._id);

    res.json({
      success: true,
      data: {
        token: jwtToken,
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          role: user.role
        }
      },
      message: 'Password reset successful'
    });
    return;
  })
);

export default router;
