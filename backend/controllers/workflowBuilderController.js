const { validationResult } = require('express-validator');
const WorkflowTemplate = require('../models/WorkflowTemplate');
const WorkflowExecution = require('../models/WorkflowExecution');

// @desc    Get all workflow templates
// @route   GET /api/workflows/templates
// @access  Private
const getWorkflowTemplates = async (req, res) => {
  try {
    const {
      category, search, isPublic, page = 1, limit = 20,
    } = req.query;
    const userId = req.user._id;

    // Build query
    const query = {
      $or: [
        { createdBy: userId },
        { isPublic: true },
        { 'sharedWith.userId': userId },
      ],
    };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$text = { $search: search };
    }

    if (isPublic !== undefined) {
      query.isPublic = isPublic === 'true';
    }

    const templates = await WorkflowTemplate.find(query)
      .populate('createdBy', 'name email')
      .populate('sharedWith.userId', 'name email')
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await WorkflowTemplate.countDocuments(query);

    res.json({
      success: true,
      data: {
        templates,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error getting workflow templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get workflow templates',
      error: error.message,
    });
  }
};

// @desc    Get workflow template by ID
// @route   GET /api/workflows/templates/:id
// @access  Private
const getWorkflowTemplate = async (req, res) => {
  try {
    const template = await WorkflowTemplate.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('sharedWith.userId', 'name email');

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Workflow template not found',
      });
    }

    // Check access permissions
    const userId = req.user._id.toString();
    const hasAccess = template.createdBy._id.toString() === userId
                     || template.isPublic
                     || template.sharedWith.some((share) => share.userId._id.toString() === userId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this workflow template',
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error getting workflow template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get workflow template',
      error: error.message,
    });
  }
};

// @desc    Create workflow template
// @route   POST /api/workflows/templates
// @access  Private
const createWorkflowTemplate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const templateData = {
      ...req.body,
      createdBy: req.user._id,
    };

    const template = new WorkflowTemplate(templateData);

    // Validate workflow structure
    const validation = template.validateWorkflow();
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Workflow validation failed',
        errors: validation.errors,
      });
    }

    await template.save();

    await template.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      data: template,
      message: 'Workflow template created successfully',
    });
  } catch (error) {
    console.error('Error creating workflow template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create workflow template',
      error: error.message,
    });
  }
};

// @desc    Update workflow template
// @route   PUT /api/workflows/templates/:id
// @access  Private
const updateWorkflowTemplate = async (req, res) => {
  try {
    const template = await WorkflowTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Workflow template not found',
      });
    }

    // Check permissions
    const userId = req.user._id.toString();
    const canEdit = template.createdBy.toString() === userId
                   || template.sharedWith.some((share) => share.userId.toString() === userId && share.permission === 'edit');

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied to edit this workflow template',
      });
    }

    // Update template
    Object.assign(template, req.body);

    // Validate updated workflow
    const validation = template.validateWorkflow();
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Workflow validation failed',
        errors: validation.errors,
      });
    }

    await template.save();
    await template.populate('createdBy', 'name email');

    res.json({
      success: true,
      data: template,
      message: 'Workflow template updated successfully',
    });
  } catch (error) {
    console.error('Error updating workflow template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update workflow template',
      error: error.message,
    });
  }
};

// @desc    Delete workflow template
// @route   DELETE /api/workflows/templates/:id
// @access  Private
const deleteWorkflowTemplate = async (req, res) => {
  try {
    const template = await WorkflowTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Workflow template not found',
      });
    }

    // Check permissions (only creator can delete)
    if (template.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied to delete this workflow template',
      });
    }

    // Check if template is being used
    const activeExecutions = await WorkflowExecution.countDocuments({
      workflowTemplateId: template._id,
      status: { $in: ['pending', 'running', 'paused'] },
    });

    if (activeExecutions > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete template with ${activeExecutions} active executions`,
      });
    }

    await template.deleteOne();

    res.json({
      success: true,
      message: 'Workflow template deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting workflow template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete workflow template',
      error: error.message,
    });
  }
};

// @desc    Duplicate workflow template
// @route   POST /api/workflows/templates/:id/duplicate
// @access  Private
const duplicateWorkflowTemplate = async (req, res) => {
  try {
    const originalTemplate = await WorkflowTemplate.findById(req.params.id);

    if (!originalTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Workflow template not found',
      });
    }

    // Check access permissions
    const userId = req.user._id.toString();
    const hasAccess = originalTemplate.createdBy.toString() === userId
                     || originalTemplate.isPublic
                     || originalTemplate.sharedWith.some((share) => share.userId.toString() === userId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this workflow template',
      });
    }

    // Create duplicate
    const duplicateData = originalTemplate.toObject();
    delete duplicateData._id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;
    delete duplicateData.stats;
    delete duplicateData.sharedWith;

    duplicateData.name = `${duplicateData.name} (Copy)`;
    duplicateData.createdBy = req.user._id;
    duplicateData.isPublic = false;

    const duplicate = new WorkflowTemplate(duplicateData);
    await duplicate.save();
    await duplicate.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      data: duplicate,
      message: 'Workflow template duplicated successfully',
    });
  } catch (error) {
    console.error('Error duplicating workflow template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to duplicate workflow template',
      error: error.message,
    });
  }
};

module.exports = {
  getWorkflowTemplates,
  getWorkflowTemplate,
  createWorkflowTemplate,
  updateWorkflowTemplate,
  deleteWorkflowTemplate,
  duplicateWorkflowTemplate,
};
