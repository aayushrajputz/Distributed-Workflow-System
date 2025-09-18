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

// @desc    Execute workflow template
// @route   POST /api/workflows/templates/:id/execute
// @access  Private
const executeWorkflowTemplate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const template = await WorkflowTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Workflow template not found',
      });
    }

    // Check access permissions
    const userId = req.user._id.toString();
    const hasAccess = template.createdBy.toString() === userId
                     || template.isPublic
                     || template.sharedWith.some((share) => share.userId.toString() === userId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to execute this workflow template',
      });
    }

    // Validate workflow structure before execution
    const validation = template.validateWorkflow();
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Workflow validation failed',
        errors: validation.errors,
      });
    }

    const { variables = {}, context = {}, name } = req.body;

    // Create workflow execution record
    const executionData = {
      workflowTemplateId: template._id,
      templateVersion: template.version || '1.0.0',
      executionId: WorkflowExecution.generateExecutionId(),
      name: name || `${template.name} - ${new Date().toISOString()}`,
      description: `Execution of ${template.name}`,
      triggeredBy: req.user._id,
      triggerType: 'manual',
      variables,
      context: {
        ...context,
        userId: req.user._id,
        userEmail: req.user.email,
        userName: `${req.user.firstName} ${req.user.lastName}`,
        executionTime: new Date().toISOString(),
      },
      status: 'pending',
      steps: template.nodes.map(node => ({
        nodeId: node.id,
        nodeType: node.type,
        status: 'pending',
        input: null,
        output: null,
        retryCount: 0,
        logs: [],
      })),
      progress: {
        totalSteps: template.nodes.length,
        completedSteps: 0,
        failedSteps: 0,
        percentage: 0,
      },
      logs: [{
        level: 'info',
        message: 'Workflow execution created',
        data: { templateId: template._id, templateName: template.name },
      }],
    };

    const execution = new WorkflowExecution(executionData);
    await execution.save();

    // Update template stats
    template.stats = template.stats || {};
    template.stats.executionCount = (template.stats.executionCount || 0) + 1;
    template.stats.lastExecuted = new Date();
    await template.save();

    // Start workflow execution (this would typically be handled by a workflow executor service)
    try {
      // Import and use workflow executor if available
      const workflowExecutor = require('../services/workflowExecutor');
      await workflowExecutor.startExecution(execution._id);
    } catch (executorError) {
      console.warn('Workflow executor not available, execution queued:', executorError.message);
      // Add log entry about queued execution
      await execution.addLog('info', 'Execution queued - workflow executor will process when available');
    }

    // Populate the execution with template and user data
    await execution.populate([
      { path: 'workflowTemplateId', select: 'name description category' },
      { path: 'triggeredBy', select: 'firstName lastName email' }
    ]);

    res.status(201).json({
      success: true,
      data: execution,
      message: 'Workflow execution started successfully',
    });
  } catch (error) {
    console.error('Error executing workflow template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute workflow template',
      error: error.message,
    });
  }
};

// @desc    Get workflow executions
// @route   GET /api/workflows/executions
// @access  Private
const getWorkflowExecutions = async (req, res) => {
  try {
    const {
      templateId,
      status,
      triggeredBy,
      page = 1,
      limit = 20,
      sort = '-createdAt',
    } = req.query;

    const userId = req.user._id;

    // Build query - users can see executions they triggered or templates they have access to
    const query = {
      $or: [
        { triggeredBy: userId },
      ],
    };

    // Add template access check if user is not the trigger
    const accessibleTemplates = await WorkflowTemplate.find({
      $or: [
        { createdBy: userId },
        { isPublic: true },
        { 'sharedWith.userId': userId },
      ],
    }).select('_id');

    const templateIds = accessibleTemplates.map(t => t._id);
    query.$or.push({ workflowTemplateId: { $in: templateIds } });

    // Apply filters
    if (templateId) {
      query.workflowTemplateId = templateId;
    }

    if (status) {
      const validStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled', 'paused'];
      if (validStatuses.includes(status)) {
        query.status = status;
      }
    }

    if (triggeredBy) {
      query.triggeredBy = triggeredBy;
    }

    // Parse sort parameter
    const sortObj = {};
    const sortFields = sort.split(' ');
    sortFields.forEach(field => {
      const direction = field.startsWith('-') ? -1 : 1;
      const fieldName = field.replace(/^-/, '');
      sortObj[fieldName] = direction;
    });

    const executions = await WorkflowExecution.find(query)
      .populate('workflowTemplateId', 'name description category')
      .populate('triggeredBy', 'firstName lastName email')
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('-steps.logs -logs -variables -context') // Exclude large fields for list view
      .lean();

    const total = await WorkflowExecution.countDocuments(query);

    // Add execution summary for each execution
    const executionsWithSummary = executions.map(execution => ({
      ...execution,
      summary: {
        duration: execution.duration || (execution.startTime && execution.endTime ? 
          execution.endTime - execution.startTime : null),
        hasErrors: execution.errors && execution.errors.length > 0,
        errorCount: execution.errors ? execution.errors.length : 0,
        lastActivity: execution.updatedAt,
      },
    }));

    res.json({
      success: true,
      data: {
        executions: executionsWithSummary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
        filters: {
          templateId,
          status,
          triggeredBy,
        },
      },
    });
  } catch (error) {
    console.error('Error getting workflow executions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get workflow executions',
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
  executeWorkflowTemplate,
  getWorkflowExecutions,
};
