const Note = require('../models/Note');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Share note with user
// @route   POST /api/notes/:id/share
// @access  Private
const shareNote = asyncHandler(async (req, res) => {
  const { userEmail, permission } = req.body;
  const noteId = req.params.id;

  // Find the note
  const note = await Note.findById(noteId);
  if (!note || note.isDeleted) {
    return res.status(404).json({ message: 'Note not found' });
  }

  // Check if user is owner
  if (note.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Only owner can share notes' });
  }

  // Find user to share with
  const userToShare = await User.findOne({ email: userEmail });
  if (!userToShare) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Check if trying to share with self
  if (userToShare._id.toString() === req.user._id.toString()) {
    return res.status(400).json({ message: 'Cannot share note with yourself' });
  }

  // Add collaborator
  note.addCollaborator(userToShare._id, permission, req.user._id);
  await note.save();

  await note.populate('collaborators.user', 'username firstName lastName email');

  res.json({
    message: 'Note shared successfully',
    collaborator: {
      user: userToShare,
      permission,
      addedAt: new Date(),
    },
  });
});

// @desc    Update collaborator permission
// @route   PUT /api/notes/:id/share/:userId
// @access  Private
const updateCollaboratorPermission = asyncHandler(async (req, res) => {
  const { permission } = req.body;
  const { id: noteId, userId } = req.params;

  const note = await Note.findById(noteId);
  if (!note || note.isDeleted) {
    return res.status(404).json({ message: 'Note not found' });
  }

  // Check if user is owner
  if (note.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Only owner can update permissions' });
  }

  // Find collaborator
  const collaboratorIndex = note.collaborators.findIndex(
    (collab) => collab.user.toString() === userId,
  );

  if (collaboratorIndex === -1) {
    return res.status(404).json({ message: 'Collaborator not found' });
  }

  // Update permission
  note.collaborators[collaboratorIndex].permission = permission;
  note.collaborators[collaboratorIndex].addedAt = new Date();
  note.collaborators[collaboratorIndex].addedBy = req.user._id;

  await note.save();
  await note.populate('collaborators.user', 'username firstName lastName email');

  res.json({
    message: 'Permission updated successfully',
    collaborator: note.collaborators[collaboratorIndex],
  });
});

// @desc    Remove collaborator
// @route   DELETE /api/notes/:id/share/:userId
// @access  Private
const removeCollaborator = asyncHandler(async (req, res) => {
  const { id: noteId, userId } = req.params;

  const note = await Note.findById(noteId);
  if (!note || note.isDeleted) {
    return res.status(404).json({ message: 'Note not found' });
  }

  // Check if user is owner or the collaborator themselves
  const isOwner = note.owner.toString() === req.user._id.toString();
  const isSelf = userId === req.user._id.toString();

  if (!isOwner && !isSelf) {
    return res.status(403).json({
      message: 'Only owner or the collaborator can remove access',
    });
  }

  // Remove collaborator
  const initialLength = note.collaborators.length;
  note.removeCollaborator(userId);

  if (note.collaborators.length === initialLength) {
    return res.status(404).json({ message: 'Collaborator not found' });
  }

  await note.save();

  res.json({ message: 'Collaborator removed successfully' });
});

// @desc    Get note collaborators
// @route   GET /api/notes/:id/collaborators
// @access  Private
const getCollaborators = asyncHandler(async (req, res) => {
  const noteId = req.params.id;

  const note = await Note.findById(noteId)
    .populate('owner', 'username firstName lastName email')
    .populate('collaborators.user', 'username firstName lastName email')
    .populate('collaborators.addedBy', 'username firstName lastName');

  if (!note || note.isDeleted) {
    return res.status(404).json({ message: 'Note not found' });
  }

  // Check access
  if (!note.hasAccess(req.user._id)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  res.json({
    owner: note.owner,
    collaborators: note.collaborators,
    isPublic: note.isPublic,
  });
});

// @desc    Get shared notes (notes shared with current user)
// @route   GET /api/notes/shared
// @access  Private
const getSharedNotes = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const userId = req.user._id;

  const notes = await Note.find({
    'collaborators.user': userId,
    isDeleted: false,
  })
    .populate('owner', 'username firstName lastName')
    .populate('collaborators.user', 'username firstName lastName')
    .sort({ updatedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Note.countDocuments({
    'collaborators.user': userId,
    isDeleted: false,
  });

  // Add user's permission for each note
  const notesWithPermissions = notes.map((note) => {
    const collaborator = note.collaborators.find(
      (collab) => collab.user._id.toString() === userId.toString(),
    );

    return {
      ...note.toObject(),
      userPermission: collaborator ? collaborator.permission : null,
    };
  });

  res.json({
    notes: notesWithPermissions,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    total,
  });
});

module.exports = {
  shareNote,
  updateCollaboratorPermission,
  removeCollaborator,
  getCollaborators,
  getSharedNotes,
};
