const crypto = require('crypto');
const User = require('../models/User');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../config/jwt');
const asyncHandler = require('../utils/asyncHandler');
const emailService = require('../services/emailService');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const {
    username, email, password, firstName, lastName,
  } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    return res.status(400).json({
      message: existingUser.email === email
        ? 'User with this email already exists'
        : 'Username already taken',
    });
  }

  // Check if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Generate email verification token
  const emailVerificationToken = crypto.randomBytes(32).toString('hex');
  const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Create user with email verification fields
  const user = await User.create({
    username,
    email,
    password,
    firstName,
    lastName,
    emailVerificationToken,
    emailVerificationExpires,
    isEmailVerified: isDevelopment, // Auto-verify in development mode
  });

  // Send verification email (skip in development mode)
  if (!isDevelopment) {
    try {
      await emailService.sendVerificationEmail(email, firstName, emailVerificationToken);
      console.log('Verification email sent successfully to:', email);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // Don't fail registration if email fails, but log it
    }
  } else {
    console.log('🔧 Development mode: Email verification skipped for:', email);
  }

  // Generate token for development mode (auto-login)
  const responseData = {
    message: isDevelopment
      ? 'User registered successfully and automatically verified for development.'
      : 'User registered successfully. Please check your email to verify your account.',
    requiresEmailVerification: !isDevelopment,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      isEmailVerified: user.isEmailVerified,
    },
  };

  // Add token for development mode to enable auto-login
  if (isDevelopment) {
    const token = generateToken({ userId: user._id });
    responseData.token = token;
  }

  res.status(201).json(responseData);
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Debug logging for development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔐 Login attempt:', {
      email: email,
      passwordLength: password?.length,
      timestamp: new Date().toISOString(),
    });
  }

  // Find user by email (include password and lockout fields)
  const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');

  if (!user) {
    if (process.env.NODE_ENV === 'development') {
      console.log('❌ User not found for email:', email);
    }
    return res.status(401).json({
      message: 'Invalid email or password',
    });
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('✅ User found:', {
      email: user.email,
      verified: user.isEmailVerified,
      locked: user.isLocked,
      attempts: user.loginAttempts,
    });
  }

  // Check if account is locked
  if (user.isLocked) {
    return res.status(423).json({
      message: 'Account temporarily locked due to too many failed login attempts. Please try again later.',
    });
  }

  // Check if account is active
  if (!user.isActive) {
    return res.status(401).json({
      message: 'Account is deactivated',
    });
  }

  // Check if email is verified
  if (!user.isEmailVerified) {
    return res.status(401).json({
      message: 'Please verify your email address before logging in. Check your email for the verification link.',
      requiresEmailVerification: true,
      email: user.email,
    });
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    if (process.env.NODE_ENV === 'development') {
      console.log('❌ Password validation failed for:', email);
    }
    // Increment login attempts
    await user.incLoginAttempts();

    return res.status(401).json({
      message: 'Invalid email or password',
    });
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Password validation successful for:', email);
  }

  // Reset login attempts on successful login
  if (user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate tokens
  const token = generateToken({ userId: user._id });
  const refresh = generateRefreshToken({ userId: user._id });

  // Set HTTP-only refresh cookie if cookies are available
  res.cookie?.('refresh_token', refresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.json({
    message: 'Login successful',
    token,
    refresh_token: refresh,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
    },
  });
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public (with valid refresh token)
const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refresh_token || req.body?.refresh_token;
  if (!token) {
    return res.status(401).json({ message: 'Missing refresh token' });
  }
  const payload = verifyRefreshToken(token);
  const user = await User.findById(payload.userId);
  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'User not found' });
  }
  const access = generateToken({ userId: user._id });
  const refreshNew = generateRefreshToken({ userId: user._id });
  res.cookie?.('refresh_token', refreshNew, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.json({ success: true, token: access, refresh_token: refreshNew });
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      fullName: req.user.fullName,
      avatar: req.user.avatar,
      phone: req.user.phone,
      jobTitle: req.user.jobTitle,
      department: req.user.department,
      bio: req.user.bio,
      location: req.user.location,
      timezone: req.user.timezone,
      company: req.user.company,
      website: req.user.website,
      linkedIn: req.user.linkedIn,
      github: req.user.github,
      isEmailVerified: req.user.isEmailVerified,
      lastLogin: req.user.lastLogin,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    },
  });
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    phone,
    jobTitle,
    department,
    bio,
    location,
    timezone,
    company,
    website,
    linkedIn,
    github,
    avatar,
  } = req.body;

  // Find user and update
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      message: 'User not found',
    });
  }

  // Update only provided fields
  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (phone !== undefined) user.phone = phone;
  if (jobTitle !== undefined) user.jobTitle = jobTitle;
  if (department !== undefined) user.department = department;
  if (bio !== undefined) user.bio = bio;
  if (location !== undefined) user.location = location;
  if (timezone !== undefined) user.timezone = timezone;
  if (company !== undefined) user.company = company;
  if (website !== undefined) user.website = website;
  if (linkedIn !== undefined) user.linkedIn = linkedIn;
  if (github !== undefined) user.github = github;
  if (avatar !== undefined) user.avatar = avatar;

  await user.save();

  res.json({
    message: 'Profile updated successfully',
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      avatar: user.avatar,
      phone: user.phone,
      jobTitle: user.jobTitle,
      department: user.department,
      bio: user.bio,
      location: user.location,
      timezone: user.timezone,
      company: user.company,
      website: user.website,
      linkedIn: user.linkedIn,
      github: user.github,
      isEmailVerified: user.isEmailVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
});

// @desc    Verify email address
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  // Find user with valid verification token
  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({
      message: 'Invalid or expired verification token',
    });
  }

  // Update user verification status
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  // Send welcome email
  try {
    await emailService.sendWelcomeEmail(user.email, user.firstName);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't fail verification if welcome email fails
  }

  // Generate token for automatic login
  const authToken = generateToken({ userId: user._id });

  res.json({
    message: 'Email verified successfully! You are now logged in.',
    token: authToken,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      isEmailVerified: user.isEmailVerified,
    },
  });
});

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
const resendVerificationEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      message: 'Email is required',
    });
  }

  // Find user by email
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({
      message: 'No account found with this email address',
    });
  }

  if (user.isEmailVerified) {
    return res.status(400).json({
      message: 'Email is already verified',
    });
  }

  // Generate new verification token
  const emailVerificationToken = emailService.generateVerificationToken();
  const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Update user with new token
  user.emailVerificationToken = emailVerificationToken;
  user.emailVerificationExpires = emailVerificationExpires;
  await user.save();

  // Send verification email
  try {
    await emailService.sendVerificationEmail(email, user.firstName, emailVerificationToken);
    res.json({
      message: 'Verification email sent successfully. Please check your email.',
    });
  } catch (error) {
    console.error('Failed to send verification email:', error);
    res.status(500).json({
      message: 'Failed to send verification email. Please try again later.',
    });
  }
});

// @desc    Change user password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Find user
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      message: 'User not found',
    });
  }

  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);

  if (!isCurrentPasswordValid) {
    return res.status(400).json({
      message: 'Current password is incorrect',
    });
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.json({
    message: 'Password changed successfully',
  });
});

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  verifyEmail,
  resendVerificationEmail,
  refresh,
};
