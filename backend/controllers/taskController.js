const Task = require('../models/Task');
const User = require('../models/User');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const workflowEngine = require('../services/workflowEngine');
const notificationService = require('../services/notificationService');
const Integration = require('../models/Integration');
const integrationService = require('../services/integrationService');

// @desc    Get all tasks for authenticated user
// @route   GET /api/tasks
// @access  Private
const getTasks = asyncHandler(async (req, res) => {
  const {
    status, priority, project, page = 1, limit = 10, sort = '-createdAt', assignedTo,
  } = req.query;

  // Build filter object based on user role
  const filter = { isActive: true };

  // Role-based filtering
  if (req.user.canViewAllTasks()) {
    // Admins and managers can see all tasks or filter by assignedTo
    if (assignedTo) {
      filter.assignedTo = assignedTo;
    }
  } else {
    // Regular users can only see their own tasks
    filter.assignedTo = req.user._id;
  }

  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (project) filter.project = new RegExp(project, 'i');

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Get tasks with pagination
  const tasks = await Task.find(filter)
    .populate('assignedBy', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count for pagination
  const total = await Task.countDocuments(filter);

  res.json({
    success: true,
    data: tasks,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
const getTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id)
    .populate('assignedBy', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email')
    .populate('comments.user', 'firstName lastName email');

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

  // Validate required fields
  if (!title || !description || !project || !dueDate || !scheduledDate) {
    return res.status(400).json({
      success: false,
      message: 'Please provide title, description, project, due date, and scheduled date',
    });
  }

  // Validate dates
  const due = new Date(dueDate);
  const scheduled = new Date(scheduledDate);
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

  // Slack: send real-time notification if Slack integration exists
  try {
    const slackIntegration = await Integration.findOne({ userId: req.user._id, type: 'slack', isActive: true });
    if (slackIntegration) {
      const msg = `🆕 Task created: ${title} (Project: ${project}, Priority: ${priority})\nAssigned to: ${assignedUser.firstName} ${assignedUser.lastName}`;
      await integrationService.sendSlackNotification(slackIntegration._id, msg, { username: 'Tasks Bot', icon: ':memo:' });
    }
  } catch (err) {
    // best-effort; do not block task creation
    console.error('Slack notify on create failed:', err.message);
  }

  // Jira: create a linked issue if Jira integration exists
  try {
    const jiraIntegration = await Integration.findOne({ userId: req.user._id, type: 'jira', isActive: true });
    if (jiraIntegration) {
      const issue = await integrationService.createJiraIssue(jiraIntegration._id, {
        summary: title,
        description,
        issueType: 'Task',
        priority: priority === 'critical' ? 'Highest' : (priority.charAt(0).toUpperCase() + priority.slice(1)),
      });
      if (issue?.issueKey) {
        task.external = task.external || {};
        task.external.jira = { issueKey: issue.issueKey, issueUrl: issue.url };
        await task.save();
      }
    }
  } catch (err) {
    console.error('Jira sync on create failed:', err.message);
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

  // Track changes for notifications
  const previousAssignedTo = task.assignedTo?.toString();

  // Update task
  task = await Task.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    },
  ).populate('assignedBy', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email');

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

  task.status = status;
  await task.save();

  await task.populate('assignedBy', 'firstName lastName email');
  await task.populate('assignedTo', 'firstName lastName email');

  // When completed, send Slack notification and optionally create Jira issue link
  try {
    if (status === 'completed') {
      const slackIntegration = await Integration.findOne({ userId: req.user._id, type: 'slack', isActive: true });
      if (slackIntegration) {
        const msg = `✅ Task completed: ${task.title} (Project: ${task.project}) by ${req.user.firstName} ${req.user.lastName}`;
        await integrationService.sendSlackNotification(slackIntegration._id, msg, { username: 'Tasks Bot', icon: ':white_check_mark:' });
      }

      // Jira: add completion comment to linked issue if available
      if (task.external?.jira?.issueKey && integrationService.addJiraComment) {
        try {
          const jiraIntegration = await Integration.findOne({ userId: req.user._id, type: 'jira', isActive: true });
          if (jiraIntegration) {
            await integrationService.addJiraComment(jiraIntegration._id, task.external.jira.issueKey, `Task marked as completed in Workflow Manager at ${new Date().toISOString()}`);
          }
        } catch (e) {
          console.error('Jira comment on complete failed:', e.message);
        }
      }
    }
  } catch (err) {
    console.error('Slack notify on status failed:', err.message);
  }

  // Send real notification on status changes of interest
  try {
    if (status === 'completed') {
      await notificationService.sendNotification({
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
          dueDate: task.dueDate,
        },
        channels: {
          inApp: { sent: false, read: false },
          email: { sent: false },
          websocket: { sent: false },
        },
      });
    }
  } catch (err) {
    console.error('Failed to send task status notification:', err.message);
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

  // Notify assignee and creator about deletion
  try {
    const populatedTask = await Task.findById(task._id)
      .populate('assignedBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email');

    const recipients = [];
    if (populatedTask.assignedTo) recipients.push(populatedTask.assignedTo._id);
    if (populatedTask.assignedBy && populatedTask.assignedBy._id.toString() !== (populatedTask.assignedTo?._id?.toString() || '')) {
      recipients.push(populatedTask.assignedBy._id);
    }

    await Promise.all(recipients.map((rid) => notificationService.sendNotification({
      recipient: rid,
      sender: req.user._id,
      type: 'task_deleted',
      title: `Task Deleted: ${populatedTask.title}`,
      message: `The task "${populatedTask.title}" has been deleted by ${req.user.firstName} ${req.user.lastName}.`,
      priority: populatedTask.priority,
      data: { taskId: populatedTask._id, projectName: populatedTask.project, priority: populatedTask.priority, dueDate: populatedTask.dueDate },
      channels: { inApp: { sent: false, read: false }, email: { sent: false }, websocket: { sent: false } },
    })));
  } catch (err) {
    console.error('Failed to send task deletion notifications:', err.message);
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
  const userId = req.user._id;

  // Get basic task statistics
  const stats = await Task.getTaskStats(userId);

  // Get overdue tasks
  const overdueTasks = await Task.getOverdueTasks(userId);

  // Get upcoming tasks (next 7 days)
  const upcomingTasks = await Task.getUpcomingTasks(userId, 7);

  // Get tasks by priority
  const priorityStats = await Task.aggregate([
    { $match: { assignedTo: userId, isActive: true } },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 },
      },
    },
  ]);

  // Get tasks by project
  const projectStats = await Task.aggregate([
    { $match: { assignedTo: userId, isActive: true } },
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
    { $limit: 10 },
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
        name: project._id,
        totalTasks: project.count,
        completedTasks: project.completed,
        progress: Math.round((project.completed / project.count) * 100),
      })),
    },
  });
});

// @desc    Add comment to task
// @route   POST /api/tasks/:id/comments
// @access  Private
const addComment = asyncHandler(async (req, res) => {
  const { text } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Comment text is required',
    });
  }

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
    text: text.trim(),
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
});

// @desc    Get recent tasks for activity feed
// @route   GET /api/tasks/recent
// @access  Private
const getRecentTasks = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  const recentTasks = await Task.find({
    assignedTo: req.user._id,
    isActive: true,
  })
    .populate('assignedBy', 'firstName lastName email')
    .sort({ updatedAt: -1 })
    .limit(parseInt(limit))
    .select('title status priority project updatedAt');

  res.json({
    success: true,
    data: recentTasks,
  });
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
