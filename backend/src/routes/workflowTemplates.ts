import express from 'express';
import { body, query } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { handleValidationErrors, catchAsync } from '../middleware/errorHandler';
import Workflow from '../models/Workflow';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

// Validation rules
const createTemplateValidation = [
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
    .withMessage('Variables must be an object')
];

// Get all workflow templates
router.get('/',
  requireAuth,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Get templates owned by user or public templates
    const templates = await Workflow.find({ 
      isTemplate: true,
      owner: userId 
    })
      .populate('owner', 'firstName lastName email')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Workflow.countDocuments({ 
      isTemplate: true,
      owner: userId 
    });

    res.json({
      success: true,
      data: templates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  })
);

// Get single workflow template
router.get('/:id',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const userId = req.user!._id;

    const template = await Workflow.findOne({ 
      _id: id, 
      isTemplate: true,
      owner: userId 
    }).populate('owner', 'firstName lastName email');

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Workflow template not found'
      });
    }

    res.json({
      success: true,
      data: template
    });
  })
);

// Create new workflow template
router.post('/',
  requireAuth,
  createTemplateValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!._id;
    const templateData = {
      ...req.body,
      owner: userId,
      isTemplate: true,
      status: 'draft'
    };

    const template = await Workflow.create(templateData);
    
    // Populate the created template
    await template.populate('owner', 'firstName lastName email');

    res.status(201).json({
      success: true,
      data: template,
      message: 'Workflow template created successfully'
    });
  })
);

// Update workflow template
router.put('/:id',
  requireAuth,
  createTemplateValidation,
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const userId = req.user!._id;
    const updates = req.body;

    const template = await Workflow.findOneAndUpdate(
      { _id: id, isTemplate: true, owner: userId },
      updates,
      { new: true, runValidators: true }
    ).populate('owner', 'firstName lastName email');

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Workflow template not found'
      });
    }

    res.json({
      success: true,
      data: template,
      message: 'Workflow template updated successfully'
    });
  })
);

// Delete workflow template
router.delete('/:id',
  requireAuth,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const userId = req.user!._id;

    const template = await Workflow.findOneAndDelete({ 
      _id: id, 
      isTemplate: true, 
      owner: userId 
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Workflow template not found'
      });
    }

    res.json({
      success: true,
      message: 'Workflow template deleted successfully'
    });
  })
);

// Execute workflow template (create workflow instance from template)
router.post('/:id/execute',
  requireAuth,
  [
    body('variables')
      .optional()
      .isObject()
      .withMessage('Variables must be an object'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Name must be between 1 and 200 characters')
  ],
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const { variables = {}, name, context } = req.body;
    const userId = req.user!._id;

    // Get the template
    const template = await Workflow.findOne({ 
      _id: id, 
      isTemplate: true, 
      owner: userId 
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Workflow template not found'
      });
    }

    // Create workflow instance from template
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const workflowName = name || `${template.name} - ${new Date().toLocaleDateString()}`;

    const workflowInstance = await Workflow.create({
      name: workflowName,
      description: template.description,
      owner: userId,
      nodes: template.nodes,
      edges: template.edges,
      variables: { ...template.variables, ...variables },
      isTemplate: false,
      templateId: template._id,
      status: 'active',
      executionHistory: [{
        executionId,
        startedAt: new Date(),
        status: 'running',
        variables: { ...template.variables, ...variables }
      }]
    });

    // Populate the created workflow
    await workflowInstance.populate('owner', 'firstName lastName email');

    res.json({
      success: true,
      data: {
        executionId,
        workflowId: workflowInstance._id,
        workflow: workflowInstance,
        status: 'running',
        startedAt: new Date().toISOString(),
        variables: { ...template.variables, ...variables }
      },
      message: 'Workflow template execution started'
    });
  })
);

// Clone template (create a copy)
router.post('/:id/clone',
  requireAuth,
  [
    body('name')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Name must be between 1 and 200 characters')
  ],
  handleValidationErrors,
  catchAsync(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user!._id;

    // Get the template
    const template = await Workflow.findOne({ 
      _id: id, 
      isTemplate: true, 
      owner: userId 
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Workflow template not found'
      });
    }

    // Create a copy
    const clonedTemplate = await Workflow.create({
      name,
      description: template.description,
      owner: userId,
      nodes: template.nodes,
      edges: template.edges,
      variables: template.variables,
      isTemplate: true,
      status: 'draft'
    });

    // Populate the cloned template
    await clonedTemplate.populate('owner', 'firstName lastName email');

    res.status(201).json({
      success: true,
      data: clonedTemplate,
      message: 'Workflow template cloned successfully'
    });
  })
);

export default router;