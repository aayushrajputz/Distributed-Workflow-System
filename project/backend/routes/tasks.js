const express = require('express');
const { body } = require('express-validator');
const {
  getTasks,
  getTask,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTaskStats,
  addComment,
  getRecentTasks
} = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// Task creation validation
const createTaskValidation = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be low, medium, high, or critical'),
  body('project')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Project name must be between 2 and 100 characters'),
  body('dueDate')
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  body('scheduledDate')
    .isISO8601()
    .withMessage('Scheduled date must be a valid date'),
  body('estimatedHours')
    .optional()
    .isFloat({ min: 0, max: 1000 })
    .withMessage('Estimated hours must be between 0 and 1000'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Each tag must be less than 50 characters')
];

// Task update validation
const updateTaskValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  body('status')
    .optional()
    .isIn(['pending', 'in_progress', 'completed', 'blocked', 'cancelled'])
    .withMessage('Status must be pending, in_progress, completed, blocked, or cancelled'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be low, medium, high, or critical'),
  body('progress')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Progress must be between 0 and 100'),
  body('actualHours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Actual hours must be a positive number'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  body('scheduledDate')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid date')
];

// Status update validation
const statusUpdateValidation = [
  body('status')
    .isIn(['pending', 'in_progress', 'completed', 'blocked', 'cancelled'])
    .withMessage('Status must be pending, in_progress, completed, blocked, or cancelled')
];

// Comment validation
const commentValidation = [
  body('text')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Comment must be between 1 and 500 characters')
];

// Apply authentication middleware to all routes
router.use(authenticate);

// Routes
router.get('/stats', getTaskStats);
router.get('/recent', getRecentTasks);
router.get('/', getTasks);
router.post('/', createTaskValidation, handleValidationErrors, createTask);
router.get('/:id', getTask);
router.put('/:id', updateTaskValidation, handleValidationErrors, updateTask);
router.patch('/:id/status', statusUpdateValidation, handleValidationErrors, updateTaskStatus);
router.delete('/:id', deleteTask);
router.post('/:id/comments', commentValidation, handleValidationErrors, addComment);

module.exports = router;
