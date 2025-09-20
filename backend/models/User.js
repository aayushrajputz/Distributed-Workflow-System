const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email',
    ],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false, // Don't include password in queries by default
    validate: {
      validator: function (password) {
        // Strong password validation: at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password);
      },
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    },
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters'],
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters'],
  },
  avatar: {
    type: String,
    default: null,
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters'],
  },
  jobTitle: {
    type: String,
    trim: true,
    maxlength: [100, 'Job title cannot exceed 100 characters'],
  },
  department: {
    type: String,
    trim: true,
    maxlength: [50, 'Department cannot exceed 50 characters'],
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
  },
  location: {
    type: String,
    trim: true,
    maxlength: [100, 'Location cannot exceed 100 characters'],
  },
  timezone: {
    type: String,
    trim: true,
    maxlength: [50, 'Timezone cannot exceed 50 characters'],
    default: 'America/Los_Angeles',
  },
  company: {
    type: String,
    trim: true,
    maxlength: [100, 'Company cannot exceed 100 characters'],
  },
  website: {
    type: String,
    trim: true,
    validate: {
      validator: function (url) {
        if (!url) return true; // Allow empty values
        return /^https?:\/\/.+/.test(url);
      },
      message: 'Website must be a valid URL starting with http:// or https://',
    },
  },
  linkedIn: {
    type: String,
    trim: true,
    validate: {
      validator: function (url) {
        if (!url) return true; // Allow empty values
        return /^https?:\/\/(www\.)?linkedin\.com\/.+/.test(url);
      },
      message: 'LinkedIn must be a valid LinkedIn URL',
    },
  },
  github: {
    type: String,
    trim: true,
    validate: {
      validator: function (url) {
        if (!url) return true; // Allow empty values
        return /^https?:\/\/(www\.)?github\.com\/.+/.test(url);
      },
      message: 'GitHub must be a valid GitHub URL',
    },
  },
  // Email verification fields
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: {
    type: String,
    select: false, // Don't include in queries by default
  },
  emailVerificationExpires: {
    type: Date,
    select: false, // Don't include in queries by default
  },

  // Additional email addresses
  emailAddresses: [{
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email',
      ],
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      select: false,
    },
    verificationExpires: {
      type: Date,
      select: false,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  }],

  // Email preferences
  emailPreferences: {
    frequency: {
      type: String,
      enum: ['immediate', 'hourly', 'daily', 'weekly', 'never'],
      default: 'immediate',
    },
    format: {
      type: String,
      enum: ['html', 'text'],
      default: 'html',
    },
    language: {
      type: String,
      enum: ['en', 'es', 'fr', 'de'],
      default: 'en',
    },
    timezone: {
      type: String,
      default: 'America/Los_Angeles',
    },
    unsubscribeAll: {
      type: Boolean,
      default: false,
    },
    categories: {
      security: {
        type: Boolean,
        default: true,
      },
      workflows: {
        type: Boolean,
        default: true,
      },
      tasks: {
        type: Boolean,
        default: false,
      },
      reports: {
        type: Boolean,
        default: true,
      },
      marketing: {
        type: Boolean,
        default: false,
      },
      updates: {
        type: Boolean,
        default: true,
      },
    },
  },

  // Real notification preferences
  notificationPreferences: {
    email: {
      task_assigned: { type: Boolean, default: true },
      task_completed: { type: Boolean, default: true },
      task_overdue: { type: Boolean, default: true },
      task_escalated: { type: Boolean, default: true },
      task_updated: { type: Boolean, default: false },
      task_comment: { type: Boolean, default: true },
      workflow_completed: { type: Boolean, default: true },
      daily_digest: { type: Boolean, default: true },
      system_alert: { type: Boolean, default: true },
    },
    inApp: {
      task_assigned: { type: Boolean, default: true },
      task_completed: { type: Boolean, default: true },
      task_overdue: { type: Boolean, default: true },
      task_escalated: { type: Boolean, default: true },
      task_updated: { type: Boolean, default: true },
      task_comment: { type: Boolean, default: true },
      workflow_completed: { type: Boolean, default: true },
      daily_digest: { type: Boolean, default: false },
      system_alert: { type: Boolean, default: true },
    },
    slack: {
      enabled: { type: Boolean, default: false },
      webhookUrl: { type: String, default: '' },
      channel: { type: String, default: '#general' },
      task_assigned: { type: Boolean, default: true },
      task_completed: { type: Boolean, default: true },
      task_overdue: { type: Boolean, default: true },
      task_escalated: { type: Boolean, default: true },
    },
    push: {
      enabled: { type: Boolean, default: false },
      devices: [{
        token: { type: String },
        platform: { type: String, enum: ['web', 'ios', 'android'], default: 'web' },
        deviceId: { type: String },
        appVersion: { type: String },
        addedAt: { type: Date, default: Date.now },
        lastUsed: { type: Date },
      }],
      task_assigned: { type: Boolean, default: true },
      task_completed: { type: Boolean, default: true },
      task_overdue: { type: Boolean, default: true },
    },
  },

  // Digest settings
  digestSettings: {
    frequency: { type: String, enum: ['off', 'daily', 'weekly'], default: 'daily' },
    sendHourLocal: { type: Number, min: 0, max: 23, default: 8 },
  },

  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockUntil: {
    type: Date,
  },
  // Role-based access control
  role: {
    type: String,
    enum: ['admin', 'manager', 'user'],
    default: 'user',
    required: true,
  },
  permissions: [{
    type: String,
    enum: [
      'create_tasks',
      'assign_tasks',
      'view_all_tasks',
      'edit_all_tasks',
      'delete_tasks',
      'manage_users',
      'view_analytics',
      'manage_workflows',
      'escalate_tasks',
    ],
  }],
  // Manager/Admin specific fields
  managedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Get full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Role-based permission methods
userSchema.methods.hasPermission = function (permission) {
  return this.permissions.includes(permission);
};

userSchema.methods.canAssignTasks = function () {
  return this.role === 'admin' || this.role === 'manager' || this.hasPermission('assign_tasks');
};

userSchema.methods.canViewAllTasks = function () {
  return this.role === 'admin' || this.role === 'manager' || this.hasPermission('view_all_tasks');
};

userSchema.methods.canManageUsers = function () {
  return this.role === 'admin' || this.hasPermission('manage_users');
};

userSchema.methods.canEscalateTasks = function () {
  return this.role === 'admin' || this.role === 'manager' || this.hasPermission('escalate_tasks');
};

// Set default permissions based on role
userSchema.pre('save', function (next) {
  if (this.isModified('role') || this.isNew) {
    switch (this.role) {
      case 'admin':
        this.permissions = [
          'create_tasks', 'assign_tasks', 'view_all_tasks', 'edit_all_tasks',
          'delete_tasks', 'manage_users', 'view_analytics', 'manage_workflows', 'escalate_tasks',
        ];
        break;
      case 'manager':
        this.permissions = [
          'create_tasks', 'assign_tasks', 'view_all_tasks', 'edit_all_tasks',
          'view_analytics', 'escalate_tasks',
        ];
        break;
      case 'user':
        this.permissions = ['create_tasks'];
        break;
      default:
        this.permissions = ['create_tasks'];
        break;
    }
  }
  next();
});

// Account lockout constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Increment login attempts
userSchema.methods.incLoginAttempts = function () {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after max attempts
  if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + LOCK_TIME };
  }

  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
  });
};

// Transform output - remove sensitive fields
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.loginAttempts;
  delete user.lockUntil;
  return user;
};

// Index for performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

module.exports = mongoose.model('User', userSchema);
