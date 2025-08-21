const Note = require('../models/Note');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get all notes for authenticated user
// @route   GET /api/notes
// @access  Private
const getNotes = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, tags } = req.query;
  const userId = req.user._id;

  // Build query
  const query = {
    $and: [
      { isDeleted: false },
      {
        $or: [
          { owner: userId },
          { 'collaborators.user': userId },
          { isPublic: true }
        ]
      }
    ]
  };

  // Add search filter
  if (search) {
    query.$and.push({
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ]
    });
  }

  // Add tags filter
  if (tags) {
    const tagArray = tags.split(',').map(tag => tag.trim());
    query.$and.push({ tags: { $in: tagArray } });
  }

  const notes = await Note.find(query)
    .populate('owner', 'username firstName lastName')
    .populate('collaborators.user', 'username firstName lastName')
    .populate('lastEditedBy', 'username firstName lastName')
    .sort({ updatedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Note.countDocuments(query);

  // Add user permission for each note
  const notesWithPermissions = notes.map(note => {
    const noteObj = note.toObject();
    noteObj.userPermission = note.getUserPermission(userId);
    return noteObj;
  });

  res.json({
    notes: notesWithPermissions,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    total,
  });
});

// @desc    Get single note
// @route   GET /api/notes/:id
// @access  Private
const getNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id)
    .populate('owner', 'username firstName lastName')
    .populate('collaborators.user', 'username firstName lastName')
    .populate('lastEditedBy', 'username firstName lastName');

  if (!note || note.isDeleted) {
    return res.status(404).json({ message: 'Note not found' });
  }

  // Check access
  if (!note.hasAccess(req.user._id)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  // Add user permission to response
  const noteObj = note.toObject();
  noteObj.userPermission = note.getUserPermission(req.user._id);

  res.json({ note: noteObj });
});

// @desc    Create new note
// @route   POST /api/notes
// @access  Private
const createNote = asyncHandler(async (req, res) => {
  const { title, content, tags, isPublic } = req.body;

  const note = await Note.create({
    title,
    content: content || '',
    tags: tags || [],
    owner: req.user._id,
    isPublic: isPublic || false,
    lastEditedBy: req.user._id,
  });

  await note.populate('owner', 'username firstName lastName');

  res.status(201).json({
    message: 'Note created successfully',
    note,
  });
});

// @desc    Update note
// @route   PUT /api/notes/:id
// @access  Private
const updateNote = asyncHandler(async (req, res) => {
  const { title, content, tags, isPublic } = req.body;

  const note = await Note.findById(req.params.id);

  if (!note || note.isDeleted) {
    return res.status(404).json({ message: 'Note not found' });
  }

  // Check write access
  if (!note.hasAccess(req.user._id, 'write')) {
    return res.status(403).json({ message: 'Write access denied' });
  }

  // Update fields
  if (title !== undefined) note.title = title;
  if (content !== undefined) note.content = content;
  if (tags !== undefined) note.tags = tags;
  if (isPublic !== undefined) note.isPublic = isPublic;
  
  note.lastEditedBy = req.user._id;

  await note.save();
  await note.populate('owner', 'username firstName lastName');
  await note.populate('collaborators.user', 'username firstName lastName');
  await note.populate('lastEditedBy', 'username firstName lastName');

  res.json({
    message: 'Note updated successfully',
    note,
  });
});

// @desc    Delete note
// @route   DELETE /api/notes/:id
// @access  Private
const deleteNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id);

  if (!note || note.isDeleted) {
    return res.status(404).json({ message: 'Note not found' });
  }

  // Only owner can delete
  if (note.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Only owner can delete note' });
  }

  note.isDeleted = true;
  note.deletedAt = new Date();
  await note.save();

  res.json({ message: 'Note deleted successfully' });
});

module.exports = {
  getNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
};
