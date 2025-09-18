const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  content: {
    type: String,
    default: '',
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [30, 'Tag cannot exceed 30 characters'],
  }],
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  collaborators: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    permission: {
      type: String,
      enum: ['read', 'write'],
      default: 'read',
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  }],
  isPublic: {
    type: Boolean,
    default: false,
  },
  version: {
    type: Number,
    default: 1,
  },
  lastEditedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  lastEditedAt: {
    type: Date,
    default: Date.now,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Indexes for better performance
noteSchema.index({ owner: 1, createdAt: -1 });
noteSchema.index({ 'collaborators.user': 1 });
noteSchema.index({ tags: 1 });
noteSchema.index({ title: 'text', content: 'text' });

// Virtual for checking if note is shared
noteSchema.virtual('isShared').get(function () {
  return this.collaborators.length > 0;
});

// Method to check if user has access to note
noteSchema.methods.hasAccess = function (userId, requiredPermission = 'read') {
  // Convert to string for comparison
  const userIdStr = userId.toString();

  // Owner has full access
  if (this.owner.toString() === userIdStr) {
    return true;
  }

  // Check if user is a collaborator
  const collaborator = this.collaborators.find(
    (collab) => collab.user.toString() === userIdStr,
  );

  if (!collaborator) {
    return this.isPublic && requiredPermission === 'read';
  }

  // Check permission level
  if (requiredPermission === 'write') {
    return collaborator.permission === 'write';
  }

  return true; // Has read access
};

// Method to get user's permission level
noteSchema.methods.getUserPermission = function (userId) {
  const userIdStr = userId.toString();

  // Owner has full access
  if (this.owner.toString() === userIdStr) {
    return 'owner';
  }

  // Check collaborator permission
  const collaborator = this.collaborators.find(
    (collab) => collab.user.toString() === userIdStr,
  );

  if (collaborator) {
    return collaborator.permission;
  }

  // Check if public
  if (this.isPublic) {
    return 'read';
  }

  return null; // No access
};

// Method to add collaborator
noteSchema.methods.addCollaborator = function (userId, permission, addedBy) {
  // Check if user is already a collaborator
  const existingIndex = this.collaborators.findIndex(
    (collab) => collab.user.toString() === userId.toString(),
  );

  if (existingIndex !== -1) {
    // Update existing collaborator
    this.collaborators[existingIndex].permission = permission;
    this.collaborators[existingIndex].addedAt = new Date();
    this.collaborators[existingIndex].addedBy = addedBy;
  } else {
    // Add new collaborator
    this.collaborators.push({
      user: userId,
      permission,
      addedBy,
    });
  }
};

// Method to remove collaborator
noteSchema.methods.removeCollaborator = function (userId) {
  this.collaborators = this.collaborators.filter(
    (collab) => collab.user.toString() !== userId.toString(),
  );
};

// Pre-save middleware to update version and lastEditedAt
noteSchema.pre('save', function (next) {
  if (!this.isNew && (this.isModified('content') || this.isModified('title'))) {
    this.version += 1;
    this.lastEditedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Note', noteSchema);
