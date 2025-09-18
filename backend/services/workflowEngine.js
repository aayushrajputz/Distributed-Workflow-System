const Task = require('../models/Task');
const User = require('../models/User');
const Notification = require('../models/Notification');
const notificationService = require('./notificationService');
const emailService = require('./emailService');

class WorkflowEngine {
  constructor() {
    this.rules = new Map();
    this.scheduledJobs = new Map();
    this.isStarted = false;
    this.metrics = {
      rulesExecuted: 0,
      rulesSucceeded: 0,
      rulesFailed: 0,
      averageExecutionTime: 0,
      lastExecutionTime: null,
    };
    this.config = {
      overdueCheckInterval: parseInt(process.env.WORKFLOW_OVERDUE_INTERVAL) || 5 * 60 * 1000,
      escalationCheckInterval: parseInt(process.env.WORKFLOW_ESCALATION_INTERVAL) || 15 * 60 * 1000,
      dailyDigestInterval: parseInt(process.env.WORKFLOW_DIGEST_INTERVAL) || 24 * 60 * 60 * 1000,
      maxRetries: parseInt(process.env.WORKFLOW_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.WORKFLOW_RETRY_DELAY) || 5000,
    };
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
      },
    });

    // Rule 2: Task assignment notification
    this.addRule('task_assigned', {
      trigger: 'event', // Runs on task creation/assignment
      condition: async (task) => task.assignedTo && task.status === 'pending',
      action: async (task) => {
        await this.handleTaskAssignment(task);
      },
    });

    // Rule 3: Task completion workflow
    this.addRule('task_completed', {
      trigger: 'event',
      condition: async (task, oldTask) => task.status === 'completed' && oldTask.status !== 'completed',
      action: async (task) => {
        await this.handleTaskCompletion(task);
      },
    });

    // Rule 4: Task escalation for high priority overdue tasks
    this.addRule('task_escalation', {
      trigger: 'schedule',
      interval: 15 * 60 * 1000, // Every 15 minutes
      condition: async () => true,
      action: async () => {
        await this.checkTaskEscalation();
      },
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
      },
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
      isActive: true,
    }).populate('assignedTo assignedBy');

    for (const task of overdueTasks) {
      // Skip if already marked as overdue recently
      const recentOverdueNotification = await Notification.findOne({
        'data.taskId': task._id,
        type: 'task_overdue',
        createdAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) }, // Within last hour
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
            dueDate: task.dueDate,
          },
          priority: task.priority === 'critical' ? 'urgent' : 'high',
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
        dueDate: task.dueDate,
      },
      priority: task.priority === 'critical' ? 'urgent' : 'medium',
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
          completedAt: new Date(),
        },
        priority: 'medium',
      });
    }

    // Notify managers and admins
    const managers = await User.find({
      $or: [
        { role: 'admin' },
        { role: 'manager', managedUsers: task.assignedTo },
      ],
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
            completedAt: new Date(),
          },
          priority: 'low',
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
      isActive: true,
    }).populate('assignedTo assignedBy');

    for (const task of criticalOverdueTasks) {
      // Check if already escalated recently
      const recentEscalation = await Notification.findOne({
        'data.taskId': task._id,
        type: 'task_escalated',
        createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
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
        { role: 'manager', managedUsers: task.assignedTo },
      ],
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
          daysOverdue,
        },
        priority: 'urgent',
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
        daysOverdue,
      },
      priority: 'urgent',
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
      { hours: 4, label: '4 hours' },
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
                dueDate: task.dueDate,
              },
              priority: 'medium',
              scheduledFor: reminderTime,
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
      isActive: true,
    });

    for (const user of users) {
      const userTasks = await Task.find({
        assignedTo: user._id,
        status: { $nin: ['completed', 'cancelled'] },
        isActive: true,
      }).sort({ dueDate: 1 });

      if (userTasks.length > 0) {
        const overdueTasks = userTasks.filter((task) => task.dueDate < new Date());
        const dueTodayTasks = userTasks.filter((task) => {
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
            tasks: userTasks.slice(0, 10), // Include first 10 tasks
          },
          priority: 'low',
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
        dueDate: task.dueDate,
      },
      priority: task.priority === 'critical' ? 'urgent' : 'high',
    });
  }

  // Notify managers of overdue task
  async notifyManagersOfOverdueTask(task) {
    const managers = await User.find({
      $or: [
        { role: 'admin' },
        { role: 'manager', managedUsers: task.assignedTo },
      ],
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
          assignedTo: task.assignedTo._id,
        },
        priority: 'high',
      });
    }
  }

  // Check workflow completion
  async checkWorkflowCompletion(completedTask) {
    // Find related tasks in the same project
    const projectTasks = await Task.find({
      project: completedTask.project,
      isActive: true,
    });

    const completedTasks = projectTasks.filter((task) => task.status === 'completed');
    const totalTasks = projectTasks.length;

    // If all tasks in project are completed, notify stakeholders
    if (completedTasks.length === totalTasks && totalTasks > 1) {
      const stakeholders = await User.find({
        $or: [
          { role: 'admin' },
          { role: 'manager' },
          { _id: completedTask.assignedBy },
        ],
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
            completedAt: new Date(),
          },
          priority: 'medium',
        });
      }
    }
  }

  // Enhanced rule execution with metrics and error handling
  async executeRuleWithMetrics(name, rule, ...args) {
    const startTime = Date.now();
    this.metrics.rulesExecuted++;

    try {
      const result = await rule.action(...args);
      
      const executionTime = Date.now() - startTime;
      this.updateExecutionMetrics(executionTime, true);
      
      console.log(`✅ Rule '${name}' executed successfully in ${executionTime}ms`);
      
      // Update Prometheus metrics if available
      try {
        const prometheusService = require('./prometheusService');
        if (prometheusService && prometheusService.getPrometheusService) {
          prometheusService.getPrometheusService().recordWorkflowRuleExecution(name, executionTime, 'success');
        }
      } catch (prometheusError) {
        // Prometheus service not available, continue silently
      }
      
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateExecutionMetrics(executionTime, false);
      
      console.error(`❌ Rule '${name}' failed after ${executionTime}ms:`, error);
      
      // Update Prometheus metrics if available
      try {
        const prometheusService = require('./prometheusService');
        if (prometheusService && prometheusService.getPrometheusService) {
          prometheusService.getPrometheusService().recordWorkflowRuleExecution(name, executionTime, 'error');
        }
      } catch (prometheusError) {
        // Prometheus service not available, continue silently
      }
      
      // Implement retry logic for critical rules
      if (this.isCriticalRule(name) && this.shouldRetry(name, error)) {
        console.log(`🔄 Retrying critical rule '${name}' after ${this.config.retryDelay}ms`);
        setTimeout(() => {
          this.executeRuleWithMetrics(name, rule, ...args);
        }, this.config.retryDelay);
      }
      
      throw error;
    }
  }

  // Update execution metrics
  updateExecutionMetrics(executionTime, success) {
    if (success) {
      this.metrics.rulesSucceeded++;
    } else {
      this.metrics.rulesFailed++;
    }
    
    // Update average execution time
    const totalExecutions = this.metrics.rulesSucceeded + this.metrics.rulesFailed;
    this.metrics.averageExecutionTime = 
      ((this.metrics.averageExecutionTime * (totalExecutions - 1)) + executionTime) / totalExecutions;
    
    this.metrics.lastExecutionTime = new Date();
  }

  // Check if a rule is critical and should be retried
  isCriticalRule(ruleName) {
    const criticalRules = ['task_overdue_check', 'task_escalation', 'task_assigned'];
    return criticalRules.includes(ruleName);
  }

  // Determine if a rule should be retried based on error type
  shouldRetry(ruleName, error) {
    // Don't retry validation errors or user-related errors
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return false;
    }
    
    // Retry network errors, database connection issues, etc.
    const retryableErrors = ['MongoNetworkError', 'MongoTimeoutError', 'ECONNRESET', 'ETIMEDOUT'];
    return retryableErrors.some(errorType => 
      error.name === errorType || error.code === errorType || error.message.includes(errorType)
    );
  }

  // Enhanced schedule rule with better error handling
  scheduleRule(name, rule) {
    if (this.scheduledJobs.has(name)) {
      clearInterval(this.scheduledJobs.get(name));
    }

    const intervalId = setInterval(async () => {
      try {
        if (await rule.condition()) {
          console.log(`🔄 Executing scheduled workflow rule: ${name}`);
          await this.executeRuleWithMetrics(name, rule);
        }
      } catch (error) {
        console.error(`❌ Error executing scheduled workflow rule ${name}:`, error);
        
        // Log detailed error information
        this.logRuleError(name, error, 'scheduled');
      }
    }, rule.interval);

    this.scheduledJobs.set(name, intervalId);
    console.log(`📅 Scheduled rule '${name}' with interval ${rule.interval}ms`);
  }

  // Enhanced event rule execution with better error handling
  async executeEventRules(eventType, data, oldData = null) {
    const eventStartTime = Date.now();
    const executedRules = [];
    const failedRules = [];

    for (const [name, rule] of this.rules) {
      if (rule.trigger === 'event') {
        try {
          if (await rule.condition(data, oldData)) {
            console.log(`🚀 Executing event rule: ${name} for ${eventType}`);
            await this.executeRuleWithMetrics(name, rule, data, oldData);
            executedRules.push(name);
          }
        } catch (error) {
          console.error(`❌ Error executing event rule ${name}:`, error);
          failedRules.push({ name, error: error.message });
          
          // Log detailed error information
          this.logRuleError(name, error, 'event', { eventType, data: this.sanitizeDataForLogging(data) });
        }
      }
    }

    const totalTime = Date.now() - eventStartTime;
    console.log(`📊 Event '${eventType}' processing completed in ${totalTime}ms. Executed: ${executedRules.length}, Failed: ${failedRules.length}`);

    return {
      eventType,
      executedRules,
      failedRules,
      totalExecutionTime: totalTime,
    };
  }

  // Log rule errors with context
  logRuleError(ruleName, error, triggerType, context = {}) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      ruleName,
      triggerType,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
      },
      context,
      metrics: this.getMetrics(),
    };

    console.error('🚨 Workflow Engine Error:', JSON.stringify(errorLog, null, 2));
    
    // In production, you might want to send this to a logging service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to external logging service
      // await this.sendToLoggingService(errorLog);
    }
  }

  // Sanitize data for logging (remove sensitive information)
  sanitizeDataForLogging(data) {
    if (!data || typeof data !== 'object') return data;
    
    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  // Get current metrics
  getMetrics() {
    return {
      ...this.metrics,
      isStarted: this.isStarted,
      activeRules: this.rules.size,
      scheduledJobs: this.scheduledJobs.size,
      uptime: this.isStarted ? Date.now() - this.startTime : 0,
    };
  }

  // Validate engine state
  validateEngineState() {
    const issues = [];
    
    if (!this.isStarted) {
      issues.push('Engine is not started');
    }
    
    if (this.rules.size === 0) {
      issues.push('No rules configured');
    }
    
    const scheduledRulesCount = Array.from(this.rules.values()).filter(rule => rule.trigger === 'schedule').length;
    if (scheduledRulesCount !== this.scheduledJobs.size) {
      issues.push(`Scheduled rules mismatch: ${scheduledRulesCount} rules vs ${this.scheduledJobs.size} jobs`);
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      metrics: this.getMetrics(),
    };
  }

  // Graceful restart with state preservation
  async restart() {
    console.log('🔄 Restarting Workflow Engine...');
    
    const currentMetrics = { ...this.metrics };
    
    this.stop();
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Preserve metrics across restart
    this.metrics = currentMetrics;
    
    this.start();
    
    console.log('✅ Workflow Engine restarted successfully');
  }

  // Health check endpoint data
  getHealthStatus() {
    const validation = this.validateEngineState();
    const metrics = this.getMetrics();
    
    return {
      status: validation.isValid ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: metrics.uptime,
      metrics: {
        rulesExecuted: metrics.rulesExecuted,
        successRate: metrics.rulesExecuted > 0 ? 
          ((metrics.rulesSucceeded / metrics.rulesExecuted) * 100).toFixed(2) + '%' : '0%',
        averageExecutionTime: Math.round(metrics.averageExecutionTime) + 'ms',
        lastExecutionTime: metrics.lastExecutionTime,
      },
      configuration: {
        totalRules: metrics.activeRules,
        scheduledJobs: metrics.scheduledJobs,
        intervals: {
          overdueCheck: this.config.overdueCheckInterval,
          escalationCheck: this.config.escalationCheckInterval,
          dailyDigest: this.config.dailyDigestInterval,
        },
      },
      issues: validation.issues,
    };
  }

  // Start the workflow engine with enhanced initialization
  start() {
    if (this.isStarted) {
      console.warn('⚠️ Workflow Engine is already started');
      return;
    }

    console.log('🚀 Starting Workflow Engine...');
    this.startTime = Date.now();
    this.isStarted = true;

    // Validate configuration
    const validation = this.validateEngineState();
    if (!validation.isValid) {
      console.warn('⚠️ Engine validation issues:', validation.issues);
    }

    // Start all scheduled rules with enhanced error handling
    let scheduledCount = 0;
    for (const [name, rule] of this.rules) {
      if (rule.trigger === 'schedule' && rule.interval) {
        try {
          this.scheduleRule(name, rule);
          scheduledCount++;
        } catch (error) {
          console.error(`❌ Failed to schedule rule '${name}':`, error);
        }
      }
    }

    console.log(`✅ Workflow Engine started successfully with ${scheduledCount} scheduled rules`);
    
    // Set up periodic health checks in development
    if (process.env.NODE_ENV === 'development') {
      this.healthCheckInterval = setInterval(() => {
        const health = this.getHealthStatus();
        if (health.status === 'unhealthy') {
          console.warn('⚠️ Workflow Engine health check failed:', health.issues);
        }
      }, 5 * 60 * 1000); // Every 5 minutes
    }
  }

  // Stop the workflow engine with enhanced cleanup
  stop() {
    if (!this.isStarted) {
      console.warn('⚠️ Workflow Engine is already stopped');
      return;
    }

    console.log('⏹️ Stopping Workflow Engine...');

    // Clear all scheduled jobs
    let clearedCount = 0;
    for (const [name, intervalId] of this.scheduledJobs) {
      try {
        clearInterval(intervalId);
        clearedCount++;
      } catch (error) {
        console.error(`❌ Error clearing interval for rule '${name}':`, error);
      }
    }
    this.scheduledJobs.clear();

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.isStarted = false;
    
    console.log(`✅ Workflow Engine stopped successfully. Cleared ${clearedCount} scheduled jobs.`);
  }
}

// Export singleton instance
const workflowEngine = new WorkflowEngine();
module.exports = workflowEngine;
