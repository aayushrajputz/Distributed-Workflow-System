const { ObjectId } = require('mongoose').Types;
const Task = require('../models/Task');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { queues } = require('../services/backgroundWorker');
const asyncHandler = require('../utils/asyncHandler');
const workflowEngine = require('../services/workflowEngine');
const notificationService = require('../services/notificationService');
const Integration = require('../models/Integration');
const integrationService = require('../services/integrationService');
const validator = require('validator');
const {
  VALIDATION_CONSTANTS,
  sanitizeRegexInput,
  validatePaginationParams,
  validateStringLength,
  validateCharacters,
  validateSortParameter,
  escapeRegex,
  parsePositiveInt,
  parseSort,
  isValidObjectId,
  sanitizeString,
  sanitizeTags,
  stripTags
} = require('../middleware/validation');

// @desc    Get all tasks for authenticated user
// @route   GET /api/tasks
// @access  Private
const getTasks = asyncHandler(async (req, res) => {
  const {
    status, priority, project, page = 1, limit = 10, sort = '-createdAt', assignedTo,
  } = req.query;

  // Build match stage based on user role
  let matchStage = { isActive: true };

  // Role-based filtering
  if (req.user.canViewAllTasks()) {
    // Admins and managers can see all tasks or filter by assignedTo
    if (assignedTo) {
      if (!validator.isMongoId(assignedTo)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid assignedTo value',
        });
      }
      matchStage.assignedTo = assignedTo;
    }
  } else {
    // Regular users can only see their own tasks
    matchStage.assignedTo = req.user._id;
  }

  // Apply validated filters
  if (status) {
    const validStatuses = ['pending', 'in_progress', 'completed', 'blocked', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value',
      });
    }
    matchStage.status = status;
  }

  if (priority) {
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid priority value',
      });
    }
    matchStage.priority = priority;
  }

  if (project) {
    // Safely escape the project search pattern to prevent ReDoS
    const sanitizedProject = sanitizeRegexInput(project);
    matchStage.project = { $regex: sanitizedProject, $options: 'i' };
  }

  // Validate and sanitize pagination parameters
  const { page: validatedPage, limit: validatedLimit } = validatePaginationParams(page, limit);
  const skip = (validatedPage - 1) * validatedLimit;

  // Validate and sanitize sort parameter
  const validatedSort = validateSortParameter(sort);
  const sortObj = {};
  const sortFields = validatedSort.split(' ');
  sortFields.forEach(field => {
    const direction = field.startsWith('-') ? -1 : 1;
    const fieldName = field.replace(/^-/, '');
    sortObj[fieldName] = direction;
  });

  // Build aggregation pipeline
  const pipeline = [
    { $match: matchStage },
    {
      $facet: {
        metadata: [
          { $count: 'total' }
        ],
        tasks: [
          { $sort: sortObj },
          { $skip: skip },
          { $limit: validatedLimit },
          // Join with assignedBy user data
          {
            $lookup: {
              from: 'users',
              let: { assignedById: '$assignedBy' },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$assignedById'] } } },
                { $project: { firstName: 1, lastName: 1, email: 1 } }
              ],
              as: 'assignedBy'
            }
          },
          { $unwind: '$assignedBy' },
          // Join with assignedTo user data
          {
            $lookup: {
              from: 'users',
              let: { assignedToId: '$assignedTo' },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$assignedToId'] } } },
                { $project: { firstName: 1, lastName: 1, email: 1 } }
              ],
              as: 'assignedTo'
            }
          },
          { $unwind: '$assignedTo' }
        ]
      }
    }
  ];

  // Execute aggregation
  const [result] = await Task.aggregate(pipeline);

  const total = result.metadata[0]?.total || 0;

  res.json({
    success: true,
    data: result.tasks,
    pagination: {
      page: parseInt(validatedPage),
      limit: parseInt(validatedLimit),
      total,
      pages: Math.ceil(total / validatedLimit),
    },
  });
});

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
const getTask = asyncHandler(async (req, res) => {
  // Build aggregation pipeline for single task
  const pipeline = [
    {
      $match: {
        _id: ObjectId(req.params.id),
        isActive: true
      }
    },
    // Join with assignedBy user data
    {
      $lookup: {
        from: 'users',
        let: { assignedById: '$assignedBy' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$assignedById'] } } },
          { $project: { firstName: 1, lastName: 1, email: 1 } }
        ],
        as: 'assignedBy'
      }
    },
    { $unwind: '$assignedBy' },
    // Join with assignedTo user data
    {
      $lookup: {
        from: 'users',
        let: { assignedToId: '$assignedTo' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$assignedToId'] } } },
          { $project: { firstName: 1, lastName: 1, email: 1 } }
        ],
        as: 'assignedTo'
      }
    },
    { $unwind: '$assignedTo' },
    // Join with comment users data
    {
      $lookup: {
        from: 'users',
        let: { commentUserIds: '$comments.user' },
        pipeline: [
          { $match: { $expr: { $in: ['$_id', '$$commentUserIds'] } } },
          { $project: { firstName: 1, lastName: 1, email: 1 } }
        ],
        as: 'commentUsers'
      }
    },
    // Map comments array to include user details
    {
      $addFields: {
        comments: {
          $map: {
            input: '$comments',
            as: 'comment',
            in: {
              _id: '$$comment._id',
              text: '$$comment.text',
              createdAt: '$$comment.createdAt',
              user: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$commentUsers',
                      as: 'user',
                      cond: { $eq: ['$$user._id', '$$comment.user'] }
                    }
                  },
                  0
                ]
              }
            }
          }
        }
      }
    },
    // Remove temporary commentUsers array
    {
      $project: {
        commentUsers: 0
      }
    }
  ];

  const [task] = await Task.aggregate(pipeline);

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found',
    });
  }

  // Check if user has access to this task
  if (task.assignedTo._id.toString() !== req.user._id.toString()
      && task.assignedBy._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this task',
    });
  }

  res.json({
    success: true,
    data: task,
  });
});

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private
const createTask = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    priority = 'medium',
    assignedTo,
    project,
    tags = [],
    dueDate,
    scheduledDate,
    estimatedHours,
  } = req.body;

  // Declare date variables in outer scope
  let due, scheduled;

  // Validate and sanitize required fields
  try {
    if (!title || !description || !project || !dueDate || !scheduledDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, description, project, due date, and scheduled date',
      });
    }

    // Validate title
    validateStringLength(title, 'Title', VALIDATION_CONSTANTS.TASK.TITLE);
    validateCharacters(title, 'Title', VALIDATION_CONSTANTS.TASK.TITLE.PATTERN);

    // Validate description
    validateStringLength(description, 'Description', VALIDATION_CONSTANTS.TASK.DESCRIPTION);
    validateCharacters(description, 'Description', VALIDATION_CONSTANTS.TASK.DESCRIPTION.PATTERN);

    // Validate project
    validateStringLength(project, 'Project', VALIDATION_CONSTANTS.TASK.PROJECT);
    validateCharacters(project, 'Project', VALIDATION_CONSTANTS.TASK.PROJECT.PATTERN);

    // Validate dates
    if (!validator.isISO8601(dueDate) || !validator.isISO8601(scheduledDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please use ISO 8601 format.',
      });
    }

    // Assign to outer scope variables after validation
    due = new Date(dueDate);
    scheduled = new Date(scheduledDate);
    const now = new Date();

    if (due < now) {
      return res.status(400).json({
        success: false,
        message: 'Due date cannot be in the past',
      });
    }

    if (scheduled > due) {
      return res.status(400).json({
        success: false,
        message: 'Scheduled date cannot be after due date',
      });
    }

    // Validate tags if provided
    if (tags && tags.length > 0) {
      if (!Array.isArray(tags)) {
        return res.status(400).json({
          success: false,
          message: 'Tags must be an array',
        });
      }

      if (tags.length > 10) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 10 tags allowed',
        });
      }

      // Sanitize each tag
      tags.forEach((tag, index) => {
        if (typeof tag !== 'string' || tag.length === 0 || tag.length > 20) {
          throw new Error(`Invalid tag at position ${index}: must be a string between 1-20 characters`);
        }
        tags[index] = validator.escape(tag.trim());
      });
    }

    // Validate estimated hours if provided
    if (estimatedHours !== undefined) {
      const hours = parseFloat(estimatedHours);
      if (isNaN(hours) || hours <= 0 || hours > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Estimated hours must be a positive number less than 1000',
        });
      }
    }
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  // If no assignedTo provided, assign to current user
  const taskAssignedTo = assignedTo || req.user._id;

  // Validate assigned user exists
  const assignedUser = await User.findById(taskAssignedTo);
  if (!assignedUser) {
    return res.status(400).json({
      success: false,
      message: 'Assigned user not found',
    });
  }

  // Check permissions for task assignment
  if (taskAssignedTo.toString() !== req.user._id.toString() && !req.user.canAssignTasks()) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to assign tasks to other users',
    });
  }

  // Create task
  const task = await Task.create({
    title,
    description,
    priority,
    assignedTo: taskAssignedTo,
    assignedBy: req.user._id,
    project,
    tags,
    dueDate: due,
    scheduledDate: scheduled,
    estimatedHours,
  });

  // Populate the created task
  await task.populate('assignedBy', 'firstName lastName email');
  await task.populate('assignedTo', 'firstName lastName email');

  // Trigger workflow engine for task assignment
  await workflowEngine.executeEventRules('task_created', task);

  // Send real notification to assignee
  try {
    await notificationService.sendNotification({
      recipient: taskAssignedTo,
      sender: req.user._id,
      type: 'task_assigned',
      title: `New Task Assigned: ${title}`,
      message: `You have been assigned a new task "${title}" by ${req.user.firstName} ${req.user.lastName}. Due: ${new Date(due).toLocaleDateString()}.`,
      priority,
      data: {
        taskId: task._id,
        projectName: project,
        priority,
        dueDate: due,
      },
      channels: {
        inApp: { sent: false, read: false },
        email: { sent: false },
        websocket: { sent: false },
      },
    });
  } catch (err) {
    console.error('Failed to send task assignment notification:', err.message);
  }

  // Queue Slack notification if integration exists
  const slackIntegration = await Integration.findOne({ userId: req.user._id, type: 'slack', isActive: true });
  if (slackIntegration) {
    const msg = `🆕 Task created: ${title} (Project: ${project}, Priority: ${priority})\nAssigned to: ${assignedUser.firstName} ${assignedUser.lastName}`;
    await queues['slack-notifications'].add('task-created', {
      webhookUrl: slackIntegration.webhookUrl,
      message: {
        text: msg,
        username: 'Tasks Bot',
        icon_emoji: ':memo:'
      }
    }, {
      priority: priority === 'critical' ? 1 : 2,
      attempts: 3
    });
  }

  // Queue Jira issue creation if integration exists
  const jiraIntegration = await Integration.findOne({ userId: req.user._id, type: 'jira', isActive: true });
  if (jiraIntegration) {
    await queues['jira-operations'].add('create-issue', {
      operation: 'create',
      data: {
        url: jiraIntegration.apiUrl,
        payload: {
          summary: title,
          description,
          issueType: 'Task',
          priority: priority === 'critical' ? 'Highest' : (priority.charAt(0).toUpperCase() + priority.slice(1))
        }
      },
      auth: jiraIntegration.auth,
      taskId: task._id
    }, {
      priority: priority === 'critical' ? 1 : 2,
      attempts: 5
    });
  }

  res.status(201).json({
    success: true,
    message: 'Task created successfully',
    data: task,
  });
});

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = asyncHandler(async (req, res) => {
  let task = await Task.findById(req.params.id);

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found',
    });
  }

  // Check if user has permission to update this task
  if (task.assignedTo.toString() !== req.user._id.toString()
      && task.assignedBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this task',
    });
  }

  // Validate dates if provided
  if (req.body.dueDate) {
    const due = new Date(req.body.dueDate);
    if (due < new Date() && task.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Due date cannot be in the past for incomplete tasks',
      });
    }
  }

  // Capture the previous task state for workflow engine change detection
  const oldTask = {
    _id: task._id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignedTo: task.assignedTo,
    assignedBy: task.assignedBy,
    project: task.project,
    tags: task.tags,
    dueDate: task.dueDate,
    scheduledDate: task.scheduledDate,
    estimatedHours: task.estimatedHours,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };

  // Track changes for notifications
  const previousAssignedTo = task.assignedTo?.toString();

  // Update task and get populated result in one shot
  const [updatedTask] = await Task.aggregate([
    { $match: { _id: ObjectId(req.params.id) } },
    { 
      $set: {
        ...req.body,
        updatedAt: new Date()
      }
    },
    {
      $lookup: {
        from: 'users',
        let: { assignedById: '$assignedBy' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$assignedById'] } } },
          { $project: { firstName: 1, lastName: 1, email: 1 } }
        ],
        as: 'assignedBy'
      }
    },
    { $unwind: '$assignedBy' },
    {
      $lookup: {
        from: 'users',
        let: { assignedToId: '$assignedTo' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$assignedToId'] } } },
          { $project: { firstName: 1, lastName: 1, email: 1 } }
        ],
        as: 'assignedTo'
      }
    },
    { $unwind: '$assignedTo' }
  ]);

  task = updatedTask;

  // Trigger workflow engine for task updates with proper change detection
  try {
    await workflowEngine.executeEventRules('task_updated', task, oldTask);
  } catch (workflowError) {
    console.error('Workflow engine error during task update:', workflowError.message);
    // Continue with the update even if workflow engine fails
  }

  // Send notifications for reassignment/updates
  try {
    // Reassignment
    if (previousAssignedTo && task.assignedTo && previousAssignedTo !== task.assignedTo._id.toString()) {
      await notificationService.sendNotification({
        recipient: task.assignedTo._id,
        sender: req.user._id,
        type: 'task_assigned',
        title: `Task Assigned: ${task.title}`,
        message: `You have been assigned the task "${task.title}" by ${req.user.firstName} ${req.user.lastName}.`,
        priority: task.priority,
        data: { taskId: task._id, projectName: task.project, priority: task.priority, dueDate: task.dueDate },
        channels: { inApp: { sent: false, read: false }, email: { sent: false }, websocket: { sent: false } },
      });
    }

    // Generic task update notice to assignee (excluding the updater if same)
    if (task.assignedTo && task.assignedTo._id.toString() !== req.user._id.toString()) {
      await notificationService.sendNotification({
        recipient: task.assignedTo._id,
        sender: req.user._id,
        type: 'task_updated',
        title: `Task Updated: ${task.title}`,
        message: `${req.user.firstName} ${req.user.lastName} updated the task "${task.title}".`,
        priority: task.priority,
        data: { taskId: task._id, projectName: task.project, priority: task.priority, dueDate: task.dueDate },
        channels: { inApp: { sent: false, read: false }, email: { sent: false }, websocket: { sent: false } },
      });
    }

    // Overdue reminder when due date is in the past and not completed
    if (task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed') {
      // Notify assignee
      if (task.assignedTo) {
        await notificationService.sendNotification({
          recipient: task.assignedTo._id,
          sender: req.user._id,
          type: 'task_overdue',
          title: `Task Overdue: ${task.title}`,
          message: `The task "${task.title}" is overdue. Please review and update its status.`,
          priority: task.priority,
          data: { taskId: task._id, projectName: task.project, priority: task.priority, dueDate: task.dueDate },
          channels: { inApp: { sent: false, read: false }, email: { sent: false }, websocket: { sent: false } },
        });
      }
      // Notify creator if different
      if (task.assignedBy && task.assignedBy._id.toString() !== (task.assignedTo?._id?.toString() || '')) {
        await notificationService.sendNotification({
          recipient: task.assignedBy._id,
          sender: req.user._id,
          type: 'task_overdue',
          title: `Task Overdue: ${task.title}`,
          message: `The task "${task.title}" assigned to ${task.assignedTo?.firstName || 'user'} is overdue.`,
          priority: task.priority,
          data: { taskId: task._id, projectName: task.project, priority: task.priority, dueDate: task.dueDate },
          channels: { inApp: { sent: false, read: false }, email: { sent: false }, websocket: { sent: false } },
        });
      }
    }
  } catch (err) {
    console.error('Failed to send update/reassignment notification:', err.message);
  }

  res.json({
    success: true,
    message: 'Task updated successfully',
    data: task,
  });
});

// @desc    Update task status
// @route   PATCH /api/tasks/:id/status
// @access  Private
const updateTaskStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!status || !['pending', 'in_progress', 'completed', 'blocked', 'cancelled'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid status',
    });
  }

  const task = await Task.findById(req.params.id);

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found',
    });
  }

  // Check if user has permission to update this task
  if (task.assignedTo.toString() !== req.user._id.toString()
      && task.assignedBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this task',
    });
  }

  // Capture the previous task state for workflow engine change detection
  const oldTask = {
    _id: task._id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignedTo: task.assignedTo,
    assignedBy: task.assignedBy,
    project: task.project,
    tags: task.tags,
    dueDate: task.dueDate,
    scheduledDate: task.scheduledDate,
    estimatedHours: task.estimatedHours,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };

  task.status = status;
  if (status === 'completed') {
    task.completedAt = new Date();
  }
  await task.save();

  await task.populate('assignedBy', 'firstName lastName email');
  await task.populate('assignedTo', 'firstName lastName email');

  // Trigger workflow engine for task status updates with proper change detection
  try {
    await workflowEngine.executeEventRules('task_updated', task, oldTask);
  } catch (workflowError) {
    console.error('Workflow engine error during task status update:', workflowError.message);
    // Continue with the update even if workflow engine fails
  }

  // Queue notifications when task is completed
  if (status === 'completed') {
    // Queue Slack notification if integration exists
    const slackIntegration = await Integration.findOne({ userId: req.user._id, type: 'slack', isActive: true });
    if (slackIntegration) {
      const msg = `✅ Task completed: ${task.title} (Project: ${task.project}) by ${req.user.firstName} ${req.user.lastName}`;
      await queues['slack-notifications'].add('task-completed', {
        webhookUrl: slackIntegration.webhookUrl,
        message: {
          text: msg,
          username: 'Tasks Bot',
          icon_emoji: ':white_check_mark:'
        }
      }, {
        priority: task.priority === 'critical' ? 1 : 2,
        attempts: 3
      });
    }

    // Queue Jira comment if integration exists
    if (task.external?.jira?.issueKey) {
      const jiraIntegration = await Integration.findOne({ userId: req.user._id, type: 'jira', isActive: true });
      if (jiraIntegration) {
        await queues['jira-operations'].add('add-comment', {
          operation: 'comment',
          data: {
            url: jiraIntegration.apiUrl,
            issueKey: task.external.jira.issueKey,
            payload: {
              body: `Task marked as completed in Workflow Manager at ${new Date().toISOString()}`
            }
          },
          auth: jiraIntegration.auth
        }, {
          priority: task.priority === 'critical' ? 1 : 2,
          attempts: 5
        });
      }
    }

    // Queue task completion notification
    await queues['notification-batches'].add('task-status-change', {
      notifications: [{
        recipient: task.assignedBy,
        sender: req.user._id,
        type: 'task_completed',
        title: `Task Completed: ${task.title}`,
        message: `${req.user.firstName} ${req.user.lastName} marked the task "${task.title}" as completed.`,
        priority: task.priority,
        data: {
          taskId: task._id,
          projectName: task.project,
          priority: task.priority,
          dueDate: task.dueDate
        }
      }]
    }, {
      priority: task.priority === 'critical' ? 1 : 2,
      attempts: 3,
      delay: task.priority === 'critical' ? 0 : 5000 // 5s delay for non-critical tasks
    });
  }

  res.json({
    success: true,
    message: 'Task status updated successfully',
    data: task,
  });
});

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found',
    });
  }

  // Check if user has permission to delete this task
  if (task.assignedBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Only the task creator can delete this task',
    });
  }

  // Soft delete - mark as inactive instead of removing
  task.isActive = false;
  await task.save();

  // Queue deletion notifications using aggregation for efficiency
  const [populatedTask] = await Task.aggregate([
    {
      $match: { _id: task._id }
    },
    {
      $lookup: {
        from: 'users',
        let: { assignedById: '$assignedBy', assignedToId: '$assignedTo' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ['$_id', '$$assignedById'] },
                  { $eq: ['$_id', '$$assignedToId'] }
                ]
              }
            }
          },
          { $project: { _id: 1, firstName: 1, lastName: 1, email: 1 } }
        ],
        as: 'users'
      }
    }
  ]);

  if (populatedTask) {
    const recipients = populatedTask.users.map(user => ({
      recipient: user._id,
      sender: req.user._id,
      type: 'task_deleted',
      title: `Task Deleted: ${populatedTask.title}`,
      message: `The task "${populatedTask.title}" has been deleted by ${req.user.firstName} ${req.user.lastName}.`,
      priority: populatedTask.priority,
      data: {
        taskId: populatedTask._id,
        projectName: populatedTask.project,
        priority: populatedTask.priority,
        dueDate: populatedTask.dueDate
      }
    }));

    // Queue batch notifications for deletion
    if (recipients.length > 0) {
      await queues['notification-batches'].add('task-deletion', {
        notifications: recipients
      }, {
        priority: populatedTask.priority === 'critical' ? 1 : 2,
        attempts: 3,
        delay: populatedTask.priority === 'critical' ? 0 : 5000 // 5s delay for non-critical tasks
      });
    }
  }

  res.json({
    success: true,
    message: 'Task deleted successfully',
  });
});

// @desc    Get task statistics for dashboard
// @route   GET /api/tasks/stats
// @access  Private
const getTaskStats = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;

    // Validate any query parameters
    const { 
      projectLimit = 10, 
      dayRange = 7 
    } = req.query;

    // Validate the day range for upcoming tasks (1-30 days)
    const validDayRange = Math.min(Math.max(parseInt(dayRange) || 7, 1), 30);

    // Get basic task statistics with proper validation
    const stats = await Task.getTaskStats(userId);

    // Get overdue tasks
    const overdueTasks = await Task.getOverdueTasks(userId);

    // Get upcoming tasks with validated range
    const upcomingTasks = await Task.getUpcomingTasks(userId, validDayRange);

    // Get tasks by priority with validation
    const priorityStats = await Task.aggregate([
      { 
        $match: { 
          assignedTo: userId, 
          isActive: true,
          priority: { $in: ['low', 'medium', 'high', 'critical'] }
        } 
      },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get tasks by project with validation and sanitization
    const { limit: validProjectLimit } = validatePaginationParams(1, projectLimit, 20);
    const projectStats = await Task.aggregate([
      { 
        $match: { 
          assignedTo: userId, 
          isActive: true,
          project: { $exists: true, $ne: null }
        } 
      },
      {
        $group: {
          _id: '$project',
          count: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
        },
      },
      { $sort: { count: -1 } },
      { $limit: validProjectLimit },
    ]);

    // Calculate completion rate
    const completionRate = stats.total > 0
      ? Math.round((stats.completed / stats.total) * 100) : 0;

    res.json({
      success: true,
      data: {
        taskStats: stats,
        completionRate,
        overdueTasks: overdueTasks.length,
        upcomingTasks: upcomingTasks.length,
        priorityDistribution: priorityStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {
          low: 0, medium: 0, high: 0, critical: 0,
        }),
        projectStats: projectStats.map((project) => ({
          name: validator.escape(project._id), // Sanitize project names for XSS
          totalTasks: project.count,
          completedTasks: project.completed,
          progress: Math.round((project.completed / project.count) * 100),
        })),
        meta: {
          projectLimit: validProjectLimit,
          dayRange: validDayRange
        }
      },
    });
  } catch (error) {
    console.error('Task stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching task statistics',
      error: error.message
    });
  }
});

// @desc    Add comment to task
// @route   POST /api/tasks/:id/comments
// @access  Private
const addComment = asyncHandler(async (req, res) => {
  const { text } = req.body;

  try {
    // Validate and sanitize comment text
    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required',
      });
    }

    // Validate length and characters
    const sanitizedText = validateStringLength(text.trim(), 'Comment', VALIDATION_CONSTANTS.TASK.COMMENT);
    validateCharacters(sanitizedText, 'Comment', VALIDATION_CONSTANTS.TASK.COMMENT.PATTERN);

    // Additional XSS protection
    req.body.text = validator.escape(sanitizedText);

    const task = await Task.findById(req.params.id);

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found',
    });
  }

  // Check if user has access to this task
  if (task.assignedTo.toString() !== req.user._id.toString()
      && task.assignedBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to comment on this task',
    });
  }

  task.comments.push({
    user: req.user._id,
    text: req.body.text, // Using our validated and sanitized text
  });

  await task.save();

  // Populate the comments
  await task.populate('comments.user', 'firstName lastName email');

  // Notify the other party about the comment
  try {
    const commenterId = req.user._id.toString();
    const recipients = [];
    if (task.assignedTo && task.assignedTo.toString() !== commenterId) recipients.push(task.assignedTo);
    if (task.assignedBy && task.assignedBy.toString() !== commenterId) recipients.push(task.assignedBy);

    await Promise.all(recipients.map((rid) => notificationService.sendNotification({
      recipient: rid,
      sender: req.user._id,
      type: 'task_comment',
      title: `New Comment on: ${task.title}`,
      message: `${req.user.firstName} ${req.user.lastName} commented on "${task.title}": "${text.trim().slice(0, 140)}${text.trim().length > 140 ? '…' : ''}"`,
      priority: task.priority,
      data: { taskId: task._id, projectName: task.project, priority: task.priority, dueDate: task.dueDate },
      channels: { inApp: { sent: false, read: false }, email: { sent: false }, websocket: { sent: false } },
    })));
  } catch (err) {
    console.error('Failed to send task comment notifications:', err.message);
  }

  res.status(201).json({
    success: true,
    message: 'Comment added successfully',
    data: task.comments[task.comments.length - 1],
  });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({
      success: false,
      message: 'Error adding comment',
      error: err.message,
    });
  }
});

// @desc    Get recent tasks for activity feed
// @route   GET /api/tasks/recent
// @access  Private
const getRecentTasks = asyncHandler(async (req, res) => {
  try {
    // Validate and sanitize the limit parameter with a maximum of 50
    const { limit: validatedLimit } = validatePaginationParams(1, req.query.limit || 10, 50);

    const recentTasks = await Task.find({
      assignedTo: req.user._id,
      isActive: true,
    })
      .populate('assignedBy', 'firstName lastName email')
      .sort({ updatedAt: -1 })
      .limit(validatedLimit)
      .select('title status priority project updatedAt');

    res.json({
      success: true,
      data: recentTasks,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = {
  getTasks,
  getTask,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTaskStats,
  addComment,
  getRecentTasks,
};
