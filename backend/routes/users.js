const express = require('express');
const { body, query } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const User = require('../models/User');
const Task = require('../models/Task');
const asyncHandler = require('../utils/asyncHandler');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Middleware to check admin/manager permissions
const requireAdminOrManager = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({
      success: false,
      message: 'Admin or Manager access required',
    });
  }
  next();
};

// Middleware to check admin permissions only
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }
  next();
};

// Validation for user queries
const getUsersValidation = [
  query('role')
    .optional()
    .isIn(['admin', 'manager', 'user'])
    .withMessage('Invalid role'),
  query('department')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Department must be between 1 and 50 characters'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
];

// Validation for role updates
const updateRoleValidation = [
  body('role')
    .isIn(['admin', 'manager', 'user'])
    .withMessage('Role must be admin, manager, or user'),
  body('managedUsers')
    .optional()
    .isArray()
    .withMessage('managedUsers must be an array'),
  body('managedUsers.*')
    .optional()
    .isMongoId()
    .withMessage('Each managed user ID must be a valid MongoDB ObjectId'),
];

// @desc    Get all users (Admin/Manager only)
// @route   GET /api/users
// @access  Private (Admin/Manager)
const getUsers = asyncHandler(async (req, res) => {
  const {
    role,
    department,
    limit = 50,
    offset = 0,
    search,
    active = true,
  } = req.query;

  // Build filter object
  const filter = { isActive: active === 'true' };

  if (role) filter.role = role;
  if (department) filter.department = new RegExp(department, 'i');

  // Add search functionality
  if (search) {
    filter.$or = [
      { firstName: new RegExp(search, 'i') },
      { lastName: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { username: new RegExp(search, 'i') },
    ];
  }

  // Managers can only see their managed users and themselves
  if (req.user.role === 'manager') {
    filter.$or = [
      { _id: req.user._id },
      { _id: { $in: req.user.managedUsers } },
      { role: 'user' }, // Managers can see all regular users
    ];
  }

  const users = await User.find(filter)
    .select('-password -loginAttempts -lockUntil -emailVerificationToken -emailVerificationExpires')
    .populate('managedUsers', 'firstName lastName email role')
    .sort({ createdAt: -1 })
    .skip(parseInt(offset))
    .limit(parseInt(limit));

  const total = await User.countDocuments(filter);

  res.json({
    success: true,
    data: users,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      total,
      hasMore: parseInt(offset) + parseInt(limit) < total,
    },
  });
});

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private (Admin/Manager)
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('-password -loginAttempts -lockUntil -emailVerificationToken -emailVerificationExpires')
    .populate('managedUsers', 'firstName lastName email role');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Check permissions - managers can only see their managed users
  if (req.user.role === 'manager') {
    const canView = req.user._id.toString() === user._id.toString()
                   || req.user.managedUsers.includes(user._id)
                   || user.role === 'user';

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
  }

  // Get user's task statistics
  const taskStats = await Task.getTaskStats(user._id);

  res.json({
    success: true,
    data: {
      ...user.toJSON(),
      taskStats,
    },
  });
});

// @desc    Update user role and permissions (Admin only)
// @route   PUT /api/users/:id/role
// @access  Private (Admin only)
const updateUserRole = asyncHandler(async (req, res) => {
  const { role, managedUsers = [] } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Prevent self-demotion from admin
  if (req.user._id.toString() === user._id.toString() && req.user.role === 'admin' && role !== 'admin') {
    return res.status(400).json({
      success: false,
      message: 'Cannot demote yourself from admin role',
    });
  }

  // Validate managed users exist
  if (managedUsers.length > 0) {
    const validUsers = await User.find({ _id: { $in: managedUsers } });
    if (validUsers.length !== managedUsers.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more managed users not found',
      });
    }
  }

  const oldRole = user.role;
  user.role = role;
  user.managedUsers = role === 'manager' ? managedUsers : [];

  await user.save();

  res.json({
    success: true,
    message: `User role updated from ${oldRole} to ${role}`,
    data: {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        managedUsers: user.managedUsers,
      },
    },
  });
});

// @desc    Get team members for manager
// @route   GET /api/users/team
// @access  Private (Manager/Admin)
const getTeamMembers = asyncHandler(async (req, res) => {
  let teamMembers = [];

  if (req.user.role === 'admin') {
    // Admins can see all users
    teamMembers = await User.find({ isActive: true })
      .select('firstName lastName email role department jobTitle avatar')
      .sort({ firstName: 1 });
  } else if (req.user.role === 'manager') {
    // Managers can see their managed users
    teamMembers = await User.find({
      _id: { $in: req.user.managedUsers },
      isActive: true,
    })
      .select('firstName lastName email role department jobTitle avatar')
      .sort({ firstName: 1 });
  } else {
    // Regular users can see basic info of all users (for task assignment)
    teamMembers = await User.find({ isActive: true })
      .select('firstName lastName email role')
      .sort({ firstName: 1 });
  }

  res.json({
    success: true,
    data: teamMembers,
  });
});

// @desc    Get user dashboard stats (for managers/admins)
// @route   GET /api/users/:id/stats
// @access  Private (Admin/Manager)
const getUserStats = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  // Check permissions
  if (req.user.role === 'manager') {
    const canView = req.user._id.toString() === userId
                   || req.user.managedUsers.includes(userId);

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Get comprehensive task statistics
  const [taskStats, overdueTasks, upcomingTasks, recentTasks] = await Promise.all([
    Task.getTaskStats(userId),
    Task.getOverdueTasks(userId),
    Task.getUpcomingTasks(userId, 7),
    Task.find({ assignedTo: userId, isActive: true })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('title status priority project updatedAt'),
  ]);

  // Calculate productivity metrics
  const completedThisMonth = await Task.countDocuments({
    assignedTo: userId,
    status: 'completed',
    completedAt: {
      $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    },
  });

  const avgCompletionTime = await Task.aggregate([
    {
      $match: {
        assignedTo: userId,
        status: 'completed',
        completedAt: { $exists: true },
      },
    },
    {
      $project: {
        completionTime: {
          $subtract: ['$completedAt', '$createdAt'],
        },
      },
    },
    {
      $group: {
        _id: null,
        avgTime: { $avg: '$completionTime' },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        department: user.department,
      },
      taskStats,
      overdueTasks: overdueTasks.length,
      upcomingTasks: upcomingTasks.length,
      completedThisMonth,
      avgCompletionTime: avgCompletionTime.length > 0
        ? Math.round(avgCompletionTime[0].avgTime / (1000 * 60 * 60 * 24)) // Convert to days
        : 0,
      recentTasks,
    },
  });
});

// @desc    Deactivate user (Admin only)
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
const deactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Prevent self-deactivation
  if (req.user._id.toString() === user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'Cannot deactivate yourself',
    });
  }

  user.isActive = false;
  await user.save();

  // Reassign their active tasks to admin or manager
  await Task.updateMany(
    { assignedTo: user._id, status: { $nin: ['completed', 'cancelled'] } },
    { assignedTo: req.user._id },
  );

  res.json({
    success: true,
    message: 'User deactivated successfully and tasks reassigned',
  });
});

// @desc    Get user's email addresses
// @route   GET /api/users/emails
// @access  Private
const getUserEmails = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('email emailAddresses isEmailVerified createdAt');
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Format emails for frontend
  const emails = [
    {
      id: 'primary',
      email: user.email,
      isPrimary: true,
      isVerified: user.isEmailVerified || true,
      addedDate: user.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]
    },
    ...(user.emailAddresses || []).map((email, index) => ({
      id: email._id || index.toString(),
      email: email.email,
      isPrimary: false,
      isVerified: email.verified || false,
      addedDate: email.addedAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]
    }))
  ];

  res.json({
    success: true,
    data: { emails }
  });
});

// @desc    Add new email address
// @route   POST /api/users/emails
// @access  Private
const addUserEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email address'
    });
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Check if email already exists
  if (user.email === email || (user.emailAddresses || []).some(e => e.email === email)) {
    return res.status(400).json({
      success: false,
      message: 'Email address already exists'
    });
  }

  // Add email to user's email addresses
  if (!user.emailAddresses) user.emailAddresses = [];
  
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  user.emailAddresses.push({
    email,
    verified: false,
    verificationToken,
    addedAt: new Date()
  });

  await user.save();

  // TODO: Send verification email
  // await sendVerificationEmail(email, verificationToken);

  res.json({
    success: true,
    message: 'Email address added. Verification email sent.',
    data: { email }
  });
});

// @desc    Get email preferences
// @route   GET /api/users/email-preferences
// @access  Private
const getEmailPreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('emailPreferences');
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const defaultPreferences = {
    frequency: "immediate",
    format: "html",
    language: "en",
    timezone: "America/Los_Angeles",
    unsubscribeAll: false,
    categories: {
      security: true,
      workflows: true,
      tasks: false,
      reports: true,
      marketing: false,
      updates: true,
    }
  };

  res.json({
    success: true,
    data: { 
      preferences: user.emailPreferences || defaultPreferences
    }
  });
});

// @desc    Update email preferences
// @route   PUT /api/users/email-preferences
// @access  Private
const updateEmailPreferences = asyncHandler(async (req, res) => {
  const { preferences } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  user.emailPreferences = preferences;
  await user.save();

  res.json({
    success: true,
    message: 'Email preferences updated successfully',
    data: { preferences: user.emailPreferences }
  });
});

// @desc    Remove email address
// @route   DELETE /api/users/emails/:emailId
// @access  Private
const removeUserEmail = asyncHandler(async (req, res) => {
  const { emailId } = req.params;

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  if (emailId === 'primary') {
    return res.status(400).json({
      success: false,
      message: 'Cannot remove primary email address'
    });
  }

  // Remove email from array
  user.emailAddresses = (user.emailAddresses || []).filter(email => 
    email._id?.toString() !== emailId
  );

  await user.save();

  res.json({
    success: true,
    message: 'Email address removed successfully'
  });
});

// @desc    Set primary email address
// @route   PUT /api/users/emails/:emailId/primary
// @access  Private
const setPrimaryEmail = asyncHandler(async (req, res) => {
  const { emailId } = req.params;

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  if (emailId === 'primary') {
    return res.status(400).json({
      success: false,
      message: 'This is already your primary email address'
    });
  }

  // Find the email address
  const emailAddress = user.emailAddresses.find(email => 
    email._id?.toString() === emailId
  );

  if (!emailAddress) {
    return res.status(404).json({
      success: false,
      message: 'Email address not found'
    });
  }

  if (!emailAddress.verified) {
    return res.status(400).json({
      success: false,
      message: 'Email address must be verified before setting as primary'
    });
  }

  // Update primary email
  const oldPrimaryEmail = user.email;
  user.email = emailAddress.email;
  user.isEmailVerified = true;

  // Remove the email from additional addresses
  user.emailAddresses = user.emailAddresses.filter(email => 
    email._id?.toString() !== emailId
  );

  // Add the old primary email to additional addresses if it's different
  if (oldPrimaryEmail !== emailAddress.email) {
    user.emailAddresses.push({
      email: oldPrimaryEmail,
      verified: true,
      addedAt: new Date()
    });
  }

  await user.save();

  res.json({
    success: true,
    message: 'Primary email address updated successfully'
  });
});

// @desc    Send verification email
// @route   POST /api/users/emails/:emailId/verify
// @access  Private
const sendVerificationEmail = asyncHandler(async (req, res) => {
  const { emailId } = req.params;

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  if (emailId === 'primary') {
    // Handle primary email verification
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Primary email is already verified'
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await user.save();

    // TODO: Send verification email
    // await sendVerificationEmail(user.email, verificationToken);

    res.json({
      success: true,
      message: 'Verification email sent to primary email address'
    });
  } else {
    // Handle additional email verification
    const emailAddress = user.emailAddresses.find(email => 
      email._id?.toString() === emailId
    );

    if (!emailAddress) {
      return res.status(404).json({
        success: false,
        message: 'Email address not found'
      });
    }

    if (emailAddress.verified) {
      return res.status(400).json({
        success: false,
        message: 'Email address is already verified'
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    emailAddress.verificationToken = verificationToken;
    emailAddress.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await user.save();

    // TODO: Send verification email
    // await sendVerificationEmail(emailAddress.email, verificationToken);

    res.json({
      success: true,
      message: 'Verification email sent'
    });
  }
});

// Routes
router.get('/', getUsersValidation, handleValidationErrors, requireAdminOrManager, getUsers);
router.get('/team', requireAdminOrManager, getTeamMembers);
router.get('/emails', getUserEmails);
router.post('/emails', addUserEmail);
router.put('/emails/:emailId/primary', setPrimaryEmail);
router.post('/emails/:emailId/verify', sendVerificationEmail);
router.get('/email-preferences', getEmailPreferences);
router.put('/email-preferences', updateEmailPreferences);
router.delete('/emails/:emailId', removeUserEmail);
router.get('/:id', requireAdminOrManager, getUserById);
router.get('/:id/stats', requireAdminOrManager, getUserStats);
router.put('/:id/role', updateRoleValidation, handleValidationErrors, requireAdmin, updateUserRole);
router.delete('/:id', requireAdmin, deactivateUser);

module.exports = router;
