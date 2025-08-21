const Note = require('../models/Note');
const User = require('../models/User');

// @desc    Get user's notes (public API)
// @route   GET /api/v1/notes
// @access  Public (requires API key)
const getNotes = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category } = req.query;
    const userId = req.user._id;

    // Build query
    const query = { owner: userId };
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) {
      query.category = category;
    }

    // Execute query with pagination
    const notes = await Note.find(query)
      .select('title content category tags isPublic createdAt updatedAt lastEditedAt')
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Note.countDocuments(query);

    res.json({
      success: true,
      data: {
        notes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

// @desc    Get single note (public API)
// @route   GET /api/v1/notes/:id
// @access  Public (requires API key)
const getNote = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const note = await Note.findOne({
      _id: id,
      $or: [
        { owner: userId },
        { 'collaborators.user': userId },
        { isPublic: true },
      ],
    })
      .select('title content category tags isPublic createdAt updatedAt lastEditedAt version')
      .populate('owner', 'username firstName lastName')
      .populate('lastEditedBy', 'username firstName lastName')
      .lean();

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found',
        code: 'NOTE_NOT_FOUND',
      });
    }

    res.json({
      success: true,
      data: { note },
    });
  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

// @desc    Create note (public API)
// @route   POST /api/v1/notes
// @access  Public (requires API key)
const createNote = async (req, res) => {
  try {
    const { title, content, category, tags, isPublic = false } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required',
        code: 'VALIDATION_ERROR',
      });
    }

    // Create note
    const note = new Note({
      title,
      content,
      category,
      tags: tags || [],
      isPublic,
      owner: userId,
      lastEditedBy: userId,
    });

    await note.save();

    res.status(201).json({
      success: true,
      message: 'Note created successfully',
      data: {
        note: {
          id: note._id,
          title: note.title,
          content: note.content,
          category: note.category,
          tags: note.tags,
          isPublic: note.isPublic,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

// @desc    Update note (public API)
// @route   PUT /api/v1/notes/:id
// @access  Public (requires API key)
const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, category, tags, isPublic } = req.body;
    const userId = req.user._id;

    const note = await Note.findOne({
      _id: id,
      $or: [
        { owner: userId },
        { 'collaborators.user': userId, 'collaborators.permission': { $in: ['write', 'admin'] } },
      ],
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found or access denied',
        code: 'NOTE_NOT_FOUND',
      });
    }

    // Update fields
    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;
    if (category !== undefined) note.category = category;
    if (tags !== undefined) note.tags = tags;
    if (isPublic !== undefined) note.isPublic = isPublic;
    
    note.lastEditedBy = userId;
    note.lastEditedAt = new Date();

    await note.save();

    res.json({
      success: true,
      message: 'Note updated successfully',
      data: {
        note: {
          id: note._id,
          title: note.title,
          content: note.content,
          category: note.category,
          tags: note.tags,
          isPublic: note.isPublic,
          updatedAt: note.updatedAt,
          version: note.version,
        },
      },
    });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

// @desc    Delete note (public API)
// @route   DELETE /api/v1/notes/:id
// @access  Public (requires API key)
const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const note = await Note.findOne({
      _id: id,
      owner: userId, // Only owner can delete
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found or access denied',
        code: 'NOTE_NOT_FOUND',
      });
    }

    await note.deleteOne();

    res.json({
      success: true,
      message: 'Note deleted successfully',
    });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

// @desc    Get user analytics (public API)
// @route   GET /api/v1/analytics
// @access  Public (requires API key)
const getAnalytics = async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    const userId = req.user._id;

    // Parse timeframe
    const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get note statistics
    const [totalNotes, recentNotes, publicNotes] = await Promise.all([
      Note.countDocuments({ owner: userId }),
      Note.countDocuments({ 
        owner: userId, 
        createdAt: { $gte: startDate } 
      }),
      Note.countDocuments({ 
        owner: userId, 
        isPublic: true 
      }),
    ]);

    // Get category breakdown
    const categoryStats = await Note.aggregate([
      { $match: { owner: userId } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Get daily activity
    const dailyActivity = await Note.aggregate([
      {
        $match: {
          owner: userId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
          date: { $first: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    res.json({
      success: true,
      data: {
        timeframe,
        generated_at: new Date().toISOString(),
        user_id: userId,
        summary: {
          total_notes: totalNotes,
          recent_notes: recentNotes,
          public_notes: publicNotes,
          private_notes: totalNotes - publicNotes,
        },
        categories: categoryStats.map(cat => ({
          name: cat._id || 'Uncategorized',
          count: cat.count,
        })),
        daily_activity: dailyActivity.map(day => ({
          date: day.date,
          notes_created: day.count,
        })),
      },
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

// @desc    Get API status and user info
// @route   GET /api/v1/status
// @access  Public (requires API key)
const getStatus = async (req, res) => {
  try {
    const user = req.user;
    const apiKey = req.apiKey;

    res.json({
      success: true,
      data: {
        api_version: '1.0.0',
        status: 'operational',
        timestamp: new Date().toISOString(),
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        api_key: {
          id: apiKey._id,
          name: apiKey.name,
          prefix: apiKey.keyPrefix,
          permissions: apiKey.permissions,
          last_used: apiKey.lastUsedAt,
          rate_limit: apiKey.rateLimit,
        },
        rate_limit: {
          requests_per_hour: apiKey.rateLimit.requestsPerHour,
          requests_per_day: apiKey.rateLimit.requestsPerDay,
        },
        services: {
          database: 'operational',
          authentication: 'operational',
          notes: 'operational',
        },
      },
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

module.exports = {
  getNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  getAnalytics,
  getStatus,
};
