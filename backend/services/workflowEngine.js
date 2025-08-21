const Task = require('../models/Task');
const User = require('../models/User');
const Notification = require('../models/Notification');
const notificationService = require('./notificationService');
const emailService = require('./emailService');

class WorkflowEngine {
  constructor() {
    this.rules = new Map();
    this.scheduledJobs = new Map();
    this.initializeDefaultRules();
  }

  // Initialize default workflow rules
  initializeDefaultRules() {
    // Rule 1: Task overdue notification
    this.addRule('task_overdue_check', {
      trigger: 'schedule', // Runs on schedule
      interval: 5 * 60 * 1000, // Every 5 minutes
      condition: async () => true, // Always run
      action: async () => {
        await this.checkOverdueTasks();
      }
    });

    // Rule 2: Task assignment notification
    this.addRule('task_assigned', {
      trigger: 'event', // Runs on task creation/assignment
      condition: async (task) => task.assignedTo && task.status === 'pending',
      action: async (task) => {
        await this.handleTaskAssignment(task);
      }
    });

    // Rule 3: Task completion workflow
    this.addRule('task_completed', {
      trigger: 'event',
      condition: async (task, oldTask) => {
        return task.status === 'completed' && oldTask.status !== 'completed';
      },
      action: async (task) => {
        await this.handleTaskCompletion(task);
      }
    });

    // Rule 4: Task escalation for high priority overdue tasks
    this.addRule('task_escalation', {
      trigger: 'schedule',
      interval: 15 * 60 * 1000, // Every 15 minutes
      condition: async () => true,
      action: async () => {
        await this.checkTaskEscalation();
      }
    });

    // Rule 5: Daily digest notifications
    this.addRule('daily_digest', {
      trigger: 'schedule',
      interval: 24 * 60 * 60 * 1000, // Daily
      condition: async () => {
        const now = new Date();
        return now.getHours() === 9 && now.getMinutes() < 5; // 9 AM daily
      },
      action: async () => {
        await this.sendDailyDigests();
      }
    });
  }

  // Add a new workflow rule
  addRule(name, rule) {
    this.rules.set(name, rule);
    
    // If it's a scheduled rule, set up the interval
    if (rule.trigger === 'schedule' && rule.interval) {
      this.scheduleRule(name, rule);
    }
  }

  // Schedule a rule to run at intervals
  scheduleRule(name, rule) {
    if (this.scheduledJobs.has(name)) {
      clearInterval(this.scheduledJobs.get(name));
    }

    const intervalId = setInterval(async () => {
      try {
        if (await rule.condition()) {
          console.log(`🔄 Executing workflow rule: ${name}`);
          await rule.action();
        }
      } catch (error) {
        console.error(`❌ Error executing workflow rule ${name}:`, error);
      }
    }, rule.interval);

    this.scheduledJobs.set(name, intervalId);
  }

  // Execute event-triggered rules
  async executeEventRules(eventType, data, oldData = null) {
    for (const [name, rule] of this.rules) {
      if (rule.trigger === 'event') {
        try {
          if (await rule.condition(data, oldData)) {
            console.log(`🚀 Executing event rule: ${name} for ${eventType}`);
            await rule.action(data, oldData);
          }
        } catch (error) {
          console.error(`❌ Error executing event rule ${name}:`, error);
        }
      }
    }
  }

  // Check for overdue tasks
  async checkOverdueTasks() {
    const overdueTasks = await Task.find({
      dueDate: { $lt: new Date() },
      status: { $nin: ['completed', 'cancelled'] },
      isActive: true
    }).populate('assignedTo assignedBy');

    for (const task of overdueTasks) {
      // Skip if already marked as overdue recently
      const recentOverdueNotification = await Notification.findOne({
        'data.taskId': task._id,
        type: 'task_overdue',
        createdAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) } // Within last hour
      });

      if (recentOverdueNotification) continue;

      // Create overdue notification
      await this.createTaskOverdueNotification(task);

      // Notify assigned user
      if (task.assignedTo) {
        await notificationService.sendNotification({
          recipient: task.assignedTo._id,
          type: 'task_overdue',
          title: `Task Overdue: ${task.title}`,
          message: `Your task "${task.title}" was due on ${task.dueDate.toLocaleDateString()} and is now overdue.`,
          data: {
            taskId: task._id,
            projectName: task.project,
            priority: task.priority,
            dueDate: task.dueDate
          },
          priority: task.priority === 'critical' ? 'urgent' : 'high'
        });
      }

      // Notify manager/admin if high priority
      if (task.priority === 'high' || task.priority === 'critical') {
        await this.notifyManagersOfOverdueTask(task);
      }
    }
  }

  // Handle task assignment
  async handleTaskAssignment(task) {
    const assignedUser = await User.findById(task.assignedTo);
    const assignedBy = await User.findById(task.assignedBy);

    if (!assignedUser) return;

    // Create assignment notification
    await notificationService.sendNotification({
      recipient: task.assignedTo,
      sender: task.assignedBy,
      type: 'task_assigned',
      title: `New Task Assigned: ${task.title}`,
      message: `You have been assigned a new task "${task.title}" by ${assignedBy ? assignedBy.fullName : 'System'}. Due date: ${task.dueDate.toLocaleDateString()}`,
      data: {
        taskId: task._id,
        projectName: task.project,
        priority: task.priority,
        dueDate: task.dueDate
      },
      priority: task.priority === 'critical' ? 'urgent' : 'medium'
    });

    // Schedule reminder notifications
    await this.scheduleTaskReminders(task);
  }

  // Handle task completion
  async handleTaskCompletion(task) {
    const assignedUser = await User.findById(task.assignedTo);
    const assignedBy = await User.findById(task.assignedBy);

    // Notify the person who assigned the task
    if (assignedBy && assignedBy._id.toString() !== assignedUser._id.toString()) {
      await notificationService.sendNotification({
        recipient: task.assignedBy,
        sender: task.assignedTo,
        type: 'task_completed',
        title: `Task Completed: ${task.title}`,
        message: `${assignedUser.fullName} has completed the task "${task.title}".`,
        data: {
          taskId: task._id,
          projectName: task.project,
          priority: task.priority,
          completedAt: new Date()
        },
        priority: 'medium'
      });
    }

    // Notify managers and admins
    const managers = await User.find({
      $or: [
        { role: 'admin' },
        { role: 'manager', managedUsers: task.assignedTo }
      ]
    });

    for (const manager of managers) {
      if (manager._id.toString() !== assignedUser._id.toString()) {
        await notificationService.sendNotification({
          recipient: manager._id,
          type: 'task_completed',
          title: `Task Completed: ${task.title}`,
          message: `${assignedUser.fullName} completed "${task.title}" in project ${task.project}.`,
          data: {
            taskId: task._id,
            projectName: task.project,
            priority: task.priority,
            completedAt: new Date()
          },
          priority: 'low'
        });
      }
    }

    // Check if this completes a workflow milestone
    await this.checkWorkflowCompletion(task);
  }

  // Check for task escalation
  async checkTaskEscalation() {
    const criticalOverdueTasks = await Task.find({
      dueDate: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Overdue by 1+ days
      priority: { $in: ['high', 'critical'] },
      status: { $nin: ['completed', 'cancelled'] },
      isActive: true
    }).populate('assignedTo assignedBy');

    for (const task of criticalOverdueTasks) {
      // Check if already escalated recently
      const recentEscalation = await Notification.findOne({
        'data.taskId': task._id,
        type: 'task_escalated',
        createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      if (recentEscalation) continue;

      await this.escalateTask(task);
    }
  }

  // Escalate a task
  async escalateTask(task) {
    // Find managers and admins to escalate to
    const escalationTargets = await User.find({
      $or: [
        { role: 'admin' },
        { role: 'manager', managedUsers: task.assignedTo }
      ]
    });

    const daysOverdue = Math.ceil((new Date() - task.dueDate) / (1000 * 60 * 60 * 24));

    for (const target of escalationTargets) {
      await notificationService.sendNotification({
        recipient: target._id,
        type: 'task_escalated',
        title: `ESCALATION: ${task.title}`,
        message: `Critical task "${task.title}" assigned to ${task.assignedTo.fullName} is ${daysOverdue} days overdue and requires immediate attention.`,
        data: {
          taskId: task._id,
          projectName: task.project,
          priority: task.priority,
          dueDate: task.dueDate,
          daysOverdue
        },
        priority: 'urgent'
      });
    }

    // Also notify the assigned user about escalation
    await notificationService.sendNotification({
      recipient: task.assignedTo,
      type: 'task_escalated',
      title: `URGENT: Task Escalated - ${task.title}`,
      message: `Your overdue task "${task.title}" has been escalated to management. Please complete it immediately.`,
      data: {
        taskId: task._id,
        projectName: task.project,
        priority: task.priority,
        dueDate: task.dueDate,
        daysOverdue
      },
      priority: 'urgent'
    });
  }

  // Schedule task reminders
  async scheduleTaskReminders(task) {
    const dueDate = new Date(task.dueDate);
    const now = new Date();

    // Schedule reminders at different intervals before due date
    const reminderIntervals = [
      { days: 3, label: '3 days' },
      { days: 1, label: '1 day' },
      { hours: 4, label: '4 hours' }
    ];

    for (const interval of reminderIntervals) {
      let reminderTime;
      if (interval.days) {
        reminderTime = new Date(dueDate.getTime() - interval.days * 24 * 60 * 60 * 1000);
      } else if (interval.hours) {
        reminderTime = new Date(dueDate.getTime() - interval.hours * 60 * 60 * 1000);
      }

      // Only schedule if reminder time is in the future
      if (reminderTime > now) {
        setTimeout(async () => {
          // Check if task is still pending
          const currentTask = await Task.findById(task._id);
          if (currentTask && currentTask.status !== 'completed' && currentTask.status !== 'cancelled') {
            await notificationService.sendNotification({
              recipient: task.assignedTo,
              type: 'task_reminder',
              title: `Reminder: ${task.title}`,
              message: `Your task "${task.title}" is due in ${interval.label}.`,
              data: {
                taskId: task._id,
                projectName: task.project,
                priority: task.priority,
                dueDate: task.dueDate
              },
              priority: 'medium',
              scheduledFor: reminderTime
            });
          }
        }, reminderTime.getTime() - now.getTime());
      }
    }
  }

  // Send daily digest notifications
  async sendDailyDigests() {
    const users = await User.find({
      'notificationPreferences.email.dailyDigest': true,
      isActive: true
    });

    for (const user of users) {
      const userTasks = await Task.find({
        assignedTo: user._id,
        status: { $nin: ['completed', 'cancelled'] },
        isActive: true
      }).sort({ dueDate: 1 });

      if (userTasks.length > 0) {
        const overdueTasks = userTasks.filter(task => task.dueDate < new Date());
        const dueTodayTasks = userTasks.filter(task => {
          const today = new Date();
          const taskDue = new Date(task.dueDate);
          return taskDue.toDateString() === today.toDateString();
        });

        await notificationService.sendNotification({
          recipient: user._id,
          type: 'daily_digest',
          title: 'Daily Task Digest',
          message: `You have ${userTasks.length} active tasks. ${overdueTasks.length} overdue, ${dueTodayTasks.length} due today.`,
          data: {
            totalTasks: userTasks.length,
            overdueTasks: overdueTasks.length,
            dueTodayTasks: dueTodayTasks.length,
            tasks: userTasks.slice(0, 10) // Include first 10 tasks
          },
          priority: 'low'
        });
      }
    }
  }

  // Create task overdue notification
  async createTaskOverdueNotification(task) {
    return Notification.create({
      recipient: task.assignedTo,
      type: 'task_overdue',
      title: `Task Overdue: ${task.title}`,
      message: `Your task "${task.title}" was due on ${task.dueDate.toLocaleDateString()} and is now overdue.`,
      data: {
        taskId: task._id,
        projectName: task.project,
        priority: task.priority,
        dueDate: task.dueDate
      },
      priority: task.priority === 'critical' ? 'urgent' : 'high'
    });
  }

  // Notify managers of overdue task
  async notifyManagersOfOverdueTask(task) {
    const managers = await User.find({
      $or: [
        { role: 'admin' },
        { role: 'manager', managedUsers: task.assignedTo }
      ]
    });

    for (const manager of managers) {
      await notificationService.sendNotification({
        recipient: manager._id,
        type: 'task_overdue',
        title: `Team Member Task Overdue: ${task.title}`,
        message: `${task.assignedTo.fullName}'s task "${task.title}" is overdue and requires attention.`,
        data: {
          taskId: task._id,
          projectName: task.project,
          priority: task.priority,
          dueDate: task.dueDate,
          assignedTo: task.assignedTo._id
        },
        priority: 'high'
      });
    }
  }

  // Check workflow completion
  async checkWorkflowCompletion(completedTask) {
    // Find related tasks in the same project
    const projectTasks = await Task.find({
      project: completedTask.project,
      isActive: true
    });

    const completedTasks = projectTasks.filter(task => task.status === 'completed');
    const totalTasks = projectTasks.length;

    // If all tasks in project are completed, notify stakeholders
    if (completedTasks.length === totalTasks && totalTasks > 1) {
      const stakeholders = await User.find({
        $or: [
          { role: 'admin' },
          { role: 'manager' },
          { _id: completedTask.assignedBy }
        ]
      });

      for (const stakeholder of stakeholders) {
        await notificationService.sendNotification({
          recipient: stakeholder._id,
          type: 'workflow_completed',
          title: `Project Completed: ${completedTask.project}`,
          message: `All ${totalTasks} tasks in project "${completedTask.project}" have been completed.`,
          data: {
            projectName: completedTask.project,
            totalTasks,
            completedAt: new Date()
          },
          priority: 'medium'
        });
      }
    }
  }

  // Start the workflow engine
  start() {
    console.log('🚀 Workflow Engine started');
    
    // Start all scheduled rules
    for (const [name, rule] of this.rules) {
      if (rule.trigger === 'schedule' && rule.interval) {
        this.scheduleRule(name, rule);
      }
    }
  }

  // Stop the workflow engine
  stop() {
    console.log('⏹️ Workflow Engine stopped');
    
    // Clear all scheduled jobs
    for (const [name, intervalId] of this.scheduledJobs) {
      clearInterval(intervalId);
    }
    this.scheduledJobs.clear();
  }
}

// Export singleton instance
const workflowEngine = new WorkflowEngine();
module.exports = workflowEngine;
