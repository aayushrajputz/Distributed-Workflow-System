import express, { Request, Response, NextFunction } from 'express';
import { body, query } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { handleValidationErrors, catchAsync } from '../middleware/errorHandler';
import { rateLimiters } from '../middleware/rateLimit';
import Task from '../models/Task';
import User from '../models/User';
import { AuthenticatedRequest } from '../types';
import { socketService } from '../services/socketService';

const router = express.Router();

// Validation rules
const createTaskValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Description must be between 1 and 2000 characters'),
  body('project')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Project name must be between 1 and 100 characters'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be low, medium, high, or critical'),
  body('assignedTo')
    .optional()
    .isMongoId()
    .withMessage('Invalid assignedTo user ID'),
  body('dueDate')
    .isISO8601()
    .withMessage('Due date must be a valid ISO 8601 date'),
  body('scheduledDate')
    .isISO8601()
    .withMessage('Scheduled date must be a valid ISO 8601 date'),
  body('estimatedHours')
    .optional()
    .isFloat({ min: 0, max: 1000 })
    .withMessage('Estimated hours must be between 0 and 1000'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
];

const updateTaskValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Description must be between 1 and 2000 characters'),
  body('status')
    .optional()
    .isIn(['pending', 'in_progress', 'completed', 'blocked', 'cancelled'])
    .withMessage('Invalid status'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be low, medium, high, or critical'),
  body('progress')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Progress must be between 0 and 100'),
  body('actualHours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Actual hours must be non-negative'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid ISO 8601 date'),
  body('scheduledDate')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid ISO 8601 date'),
  body('estimatedHours')
    .optional()
    .isFloat({ min: 0, max: 1000 })
    .withMessage('Estimated hours must be between 0 and 1000'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['pending', 'in_progress', 'completed', 'blocked', 'cancelled'])
    .withMessage('Invalid status filter'),
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid priority filter'),
  query('sort')
    .optional()
    .isIn(['createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'dueDate', '-dueDate', 'priority', '-priority'])
    .withMessage('Invalid sort field')
];

// Get all tasks with filtering and pagination
router.get('/',
  requireAuth,
  queryValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = { 
      isActive: true,
      $or: [
        { assignedTo: userId },
        { assignedBy: userId }
      ]
    };

    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.project) filter.project = new RegExp(req.query.project as string, 'i');

    // Build sort
    let sort: any = { createdAt: -1 };
    if (req.query.sort) {
      const sortField = req.query.sort as string;
      if (sortField.startsWith('-')) {
        sort = { [sortField.substring(1)]: -1 };
      } else {
        sort = { [sortField]: 1 };
      }
    }

    // Execute query
    const tasks = await Task.find(filter)
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .populate('comments.user', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Task.countDocuments(filter);

    return res.json({
      success: true,
      data: tasks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  })
);

// Get single task
router.get('/:id',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user!._id;

    const task = await Task.findOne({
      _id: id,
      isActive: true,
      $or: [
        { assignedTo: userId },
        { assignedBy: userId }
      ]
    })
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .populate('comments.user', 'firstName lastName email');

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    return res.json({
      success: true,
      data: task
    });
  })
);

// Create new task
router.post('/',
  requireAuth,
  createTaskValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;
    const taskData = {
      ...req.body,
      assignedBy: userId,
      assignedTo: req.body.assignedTo || userId
    };

    // Validate assignedTo user exists
    if (taskData.assignedTo !== userId) {
      const assignedUser = await User.findById(taskData.assignedTo);
      if (!assignedUser) {
        return res.status(400).json({
          success: false,
          error: 'Assigned user not found'
        });
      }
    }

    const task = await Task.create(taskData);
    
    // Populate the created task
    await task.populate('assignedTo', 'firstName lastName email');
    await task.populate('assignedBy', 'firstName lastName email');

    // Emit real-time event
    socketService.emitTaskCreated({
      ...task.toJSON(),
      project: task.project,
      createdBy: req.user!.email
    });

    return res.status(201).json({
      success: true,
      data: task,
      message: 'Task created successfully'
    });
  })
);

// Update task
router.put('/:id',
  requireAuth,
  updateTaskValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user!._id;
    const updates = req.body;

    const task = await Task.findOne({
      _id: id,
      isActive: true,
      $or: [
        { assignedTo: userId },
        { assignedBy: userId }
      ]
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    const oldStatus = task.status;
    const oldTask = task.toJSON();

    // Update task
    Object.assign(task, updates);
    await task.save();

    // Populate updated task
    await task.populate('assignedTo', 'firstName lastName email');
    await task.populate('assignedBy', 'firstName lastName email');

    // Emit real-time events
    socketService.emitTaskUpdated(task._id.toString(), req.user!.email, updates, task.toJSON());

    // Emit status change if status was updated
    if (updates.status && updates.status !== oldStatus) {
      socketService.emitTaskStatusChanged(task._id.toString(), oldStatus, updates.status, req.user!.email, task.toJSON());
    }

    return res.json({
      success: true,
      data: task,
      message: 'Task updated successfully'
    });
  })
);

// Update task status only
router.patch('/:id/status',
  requireAuth,
  [
    body('status')
      .isIn(['pending', 'in_progress', 'completed', 'blocked', 'cancelled'])
      .withMessage('Invalid status')
  ],
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user!._id;

    const task = await Task.findOne({
      _id: id,
      isActive: true,
      $or: [
        { assignedTo: userId },
        { assignedBy: userId }
      ]
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    const oldStatus = task.status;
    task.status = status;
    await task.save();

    // Populate updated task
    await task.populate('assignedTo', 'firstName lastName email');
    await task.populate('assignedBy', 'firstName lastName email');

    // Emit real-time events
    socketService.emitTaskStatusChanged(task._id.toString(), oldStatus, status, req.user!.email, task.toJSON());

    return res.json({
      success: true,
      data: task,
      message: 'Task status updated successfully'
    });
  })
);

// Delete task (soft delete)
router.delete('/:id',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user!._id;

    const task = await Task.findOneAndUpdate(
      {
        _id: id,
        $or: [
          { assignedTo: userId },
          { assignedBy: userId }
        ]
      },
      { isActive: false },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    // Emit real-time event
    socketService.emitTaskDeleted({
      taskId: id,
      deletedBy: req.user!.email,
      project: (task as any).project,
      task: task.toJSON()
    });

    return res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  })
);

// Add comment to task
router.post('/:id/comments',
  requireAuth,
  [
    body('text')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Comment must be between 1 and 1000 characters')
  ],
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user!._id;

    const task = await Task.findOne({
      _id: id,
      isActive: true,
      $or: [
        { assignedTo: userId },
        { assignedBy: userId }
      ]
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    const newComment = {
      user: userId,
      text,
      createdAt: new Date()
    };

    (task.comments as any).push(newComment);
    await task.save();

    // Emit real-time event
    socketService.emitTaskCommentAdded({
      taskId: id,
      comment: {
        ...newComment,
        createdBy: req.user!.email
      }
    });

    return res.status(201).json({
      success: true,
      data: newComment,
      message: 'Comment added successfully'
    });
  })
);

// Get task statistics
router.get('/stats',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;
    
    const filter = {
      isActive: true,
      $or: [
        { assignedTo: userId },
        { assignedBy: userId }
      ]
    };

    const stats = await (Task as any).getStats(filter);
    const projectStats = await (Task as any).getProjectStats();

    // Calculate completion rate
    const completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

    // Get upcoming tasks (due in next 7 days)
    const upcomingDate = new Date();
    upcomingDate.setDate(upcomingDate.getDate() + 7);
    
    const upcomingTasks = await Task.countDocuments({
      ...filter,
      dueDate: { $lte: upcomingDate, $gte: new Date() },
      status: { $nin: ['completed', 'cancelled'] }
    });

    return res.json({
      success: true,
      data: {
        taskStats: {
          total: stats.total,
          pending: stats.pending,
          in_progress: stats.in_progress,
          completed: stats.completed,
          blocked: stats.blocked,
          cancelled: stats.cancelled
        },
        completionRate: Math.round(completionRate * 100) / 100,
        overdueTasks: stats.overdue,
        upcomingTasks,
        priorityDistribution: {
          low: stats.low,
          medium: stats.medium,
          high: stats.high,
          critical: stats.critical
        },
        projectStats: projectStats.slice(0, 10) // Top 10 projects
      }
    });
  })
);

// Get recent tasks
router.get('/recent',
  requireAuth,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;
    const limit = parseInt(req.query.limit as string) || 10;

    const tasks = await Task.find({
      isActive: true,
      $or: [
        { assignedTo: userId },
        { assignedBy: userId }
      ]
    })
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .sort({ updatedAt: -1 })
      .limit(limit);

    return res.json({
      success: true,
      data: tasks
    });
  })
);

export default router;
