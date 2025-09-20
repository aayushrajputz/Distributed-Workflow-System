import express from 'express';
import { body, query } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { handleValidationErrors, catchAsync } from '../middleware/errorHandler';
import Workflow from '../models/Workflow';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

// Validation rules
const createWorkflowValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('nodes')
    .optional()
    .isArray()
    .withMessage('Nodes must be an array'),
  body('edges')
    .optional()
    .isArray()
    .withMessage('Edges must be an array'),
  body('variables')
    .optional()
    .isObject()
    .withMessage('Variables must be an object'),
  body('isTemplate')
    .optional()
    .isBoolean()
    .withMessage('isTemplate must be a boolean')
];

const updateWorkflowValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('status')
    .optional()
    .isIn(['draft', 'active', 'paused', 'completed', 'failed'])
    .withMessage('Invalid status'),
  body('nodes')
    .optional()
    .isArray()
    .withMessage('Nodes must be an array'),
  body('edges')
    .optional()
    .isArray()
    .withMessage('Edges must be an array'),
  body('variables')
    .optional()
    .isObject()
    .withMessage('Variables must be an object')
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
    .isIn(['draft', 'active', 'paused', 'completed', 'failed'])
    .withMessage('Invalid status filter'),
  query('isTemplate')
    .optional()
    .isBoolean()
    .withMessage('isTemplate must be a boolean')
];

// Get all workflows with filtering and pagination
router.get('/',
  requireAuth,
  queryValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = { owner: userId };
    
    if (req.query.status) filter.status = req.query.status;
    if (req.query.isTemplate !== undefined) filter.isTemplate = req.query.isTemplate === 'true';

    // Execute query
    const workflows = await Workflow.find(filter)
      .populate('owner', 'firstName lastName email')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Workflow.countDocuments(filter);

    res.json({
      success: true,
      data: workflows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  })
);

// Get single workflow
router.get('/:id',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const userId = req.user!._id;

    const workflow = await Workflow.findOne({ _id: id, owner: userId })
      .populate('owner', 'firstName lastName email');

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    res.json({
      success: true,
      data: workflow
    });
  })
);

// Create new workflow
router.post('/',
  requireAuth,
  createWorkflowValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;
    const workflowData = {
      ...req.body,
      owner: userId
    };

    const workflow = await Workflow.create(workflowData);
    
    // Populate the created workflow
    await workflow.populate('owner', 'firstName lastName email');

    res.status(201).json({
      success: true,
      data: workflow,
      message: 'Workflow created successfully'
    });
  })
);

// Update workflow
router.put('/:id',
  requireAuth,
  updateWorkflowValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const userId = req.user!._id;
    const updates = req.body;

    const workflow = await Workflow.findOneAndUpdate(
      { _id: id, owner: userId },
      updates,
      { new: true, runValidators: true }
    ).populate('owner', 'firstName lastName email');

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    res.json({
      success: true,
      data: workflow,
      message: 'Workflow updated successfully'
    });
  })
);

// Delete workflow
router.delete('/:id',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const userId = req.user!._id;

    const workflow = await Workflow.findOneAndDelete({ _id: id, owner: userId });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    res.json({
      success: true,
      message: 'Workflow deleted successfully'
    });
  })
);

// Get workflow tasks (placeholder - would integrate with tasks)
router.get('/:id/tasks',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const userId = req.user!._id;

    // Verify workflow exists and belongs to user
    const workflow = await Workflow.findOne({ _id: id, owner: userId });
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    // In a real implementation, this would query tasks related to the workflow
    // For now, return empty array
    res.json({
      success: true,
      data: []
    });
  })
);

// Execute workflow (placeholder)
router.post('/:id/execute',
  requireAuth,
  [
    body('variables')
      .optional()
      .isObject()
      .withMessage('Variables must be an object')
  ],
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const { variables = {} } = req.body;
    const userId = req.user!._id;

    const workflow = await Workflow.findOne({ _id: id, owner: userId });
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    // Generate execution ID
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add execution record
    await workflow.addExecution({ executionId, variables });

    // In a real implementation, this would start the workflow execution
    // For now, just return the execution ID
    res.json({
      success: true,
      data: {
        executionId,
        workflowId: workflow._id,
        status: 'running',
        startedAt: new Date().toISOString(),
        variables
      },
      message: 'Workflow execution started'
    });
  })
);

// Get workflow statistics
router.get('/stats',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;
    
    const stats = await (Workflow as any).getStats({ owner: userId });

    res.json({
      success: true,
      data: stats
    });
  })
);

export default router;