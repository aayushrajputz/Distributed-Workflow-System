const WorkflowEngine = require('../services/workflowEngine');
const Task = require('../models/Task');
const User = require('../models/User');
const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');

// Mock dependencies
jest.mock('../models/Task');
jest.mock('../models/User');
jest.mock('../models/Notification');
jest.mock('../services/notificationService');

describe('WorkflowEngine', () => {
  let workflowEngine;

  beforeEach(() => {
    // Create a fresh instance for each test
    workflowEngine = new (require('../services/workflowEngine').constructor)();
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Stop the engine to clean up intervals
    workflowEngine.stop();
    
    // Restore console methods
    console.log.mockRestore();
    console.error.mockRestore();
  });

  describe('Initialization', () => {
    test('should initialize with default rules', () => {
      expect(workflowEngine.rules.size).toBe(5);
      expect(workflowEngine.rules.has('task_overdue_check')).toBe(true);
      expect(workflowEngine.rules.has('task_assigned')).toBe(true);
      expect(workflowEngine.rules.has('task_completed')).toBe(true);
      expect(workflowEngine.rules.has('task_escalation')).toBe(true);
      expect(workflowEngine.rules.has('daily_digest')).toBe(true);
    });

    test('should have correct rule configurations', () => {
      const overdueRule = workflowEngine.rules.get('task_overdue_check');
      expect(overdueRule.trigger).toBe('schedule');
      expect(overdueRule.interval).toBe(5 * 60 * 1000);

      const assignedRule = workflowEngine.rules.get('task_assigned');
      expect(assignedRule.trigger).toBe('event');

      const completedRule = workflowEngine.rules.get('task_completed');
      expect(completedRule.trigger).toBe('event');
    });
  });

  describe('Rule Management', () => {
    test('should add new rules', () => {
      const testRule = {
        trigger: 'event',
        condition: async () => true,
        action: async () => {},
      };

      workflowEngine.addRule('test_rule', testRule);
      expect(workflowEngine.rules.has('test_rule')).toBe(true);
      expect(workflowEngine.rules.get('test_rule')).toBe(testRule);
    });

    test('should schedule rules with intervals', () => {
      const testRule = {
        trigger: 'schedule',
        interval: 1000,
        condition: async () => true,
        action: jest.fn(),
      };

      jest.spyOn(global, 'setInterval').mockReturnValue('mockIntervalId');
      
      workflowEngine.addRule('scheduled_test', testRule);
      
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
      expect(workflowEngine.scheduledJobs.has('scheduled_test')).toBe(true);
      
      setInterval.mockRestore();
    });
  });

  describe('Event Rule Execution', () => {
    test('should execute event rules when conditions are met', async () => {
      const mockAction = jest.fn();
      const testRule = {
        trigger: 'event',
        condition: async (data) => data.status === 'test',
        action: mockAction,
      };

      workflowEngine.addRule('test_event', testRule);

      await workflowEngine.executeEventRules('test_event', { status: 'test' });

      expect(mockAction).toHaveBeenCalledWith({ status: 'test' }, null);
    });

    test('should not execute event rules when conditions are not met', async () => {
      const mockAction = jest.fn();
      const testRule = {
        trigger: 'event',
        condition: async (data) => data.status === 'test',
        action: mockAction,
      };

      workflowEngine.addRule('test_event', testRule);

      await workflowEngine.executeEventRules('test_event', { status: 'other' });

      expect(mockAction).not.toHaveBeenCalled();
    });

    test('should handle errors in event rule execution', async () => {
      const mockAction = jest.fn().mockRejectedValue(new Error('Test error'));
      const testRule = {
        trigger: 'event',
        condition: async () => true,
        action: mockAction,
      };

      workflowEngine.addRule('error_test', testRule);

      // Should not throw
      await expect(workflowEngine.executeEventRules('test_event', {})).resolves.not.toThrow();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error executing event rule error_test'),
        expect.any(Error)
      );
    });
  });

  describe('Task Assignment Rule', () => {
    test('should handle task assignment correctly', async () => {
      const mockTask = {
        _id: 'task123',
        title: 'Test Task',
        assignedTo: 'user123',
        assignedBy: 'user456',
        status: 'pending',
        project: 'Test Project',
        priority: 'medium',
        dueDate: new Date('2024-12-31'),
      };

      const mockAssignedUser = {
        _id: 'user123',
        fullName: 'John Doe',
      };

      const mockAssignedBy = {
        _id: 'user456',
        fullName: 'Jane Smith',
      };

      User.findById
        .mockResolvedValueOnce(mockAssignedUser)
        .mockResolvedValueOnce(mockAssignedBy);

      notificationService.sendNotification.mockResolvedValue();

      const assignedRule = workflowEngine.rules.get('task_assigned');
      
      // Test condition
      const conditionResult = await assignedRule.condition(mockTask);
      expect(conditionResult).toBe(true);

      // Test action
      await assignedRule.action(mockTask);

      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(User.findById).toHaveBeenCalledWith('user456');
      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        recipient: 'user123',
        sender: 'user456',
        type: 'task_assigned',
        title: 'New Task Assigned: Test Task',
        message: expect.stringContaining('You have been assigned a new task "Test Task" by Jane Smith'),
        data: {
          taskId: 'task123',
          projectName: 'Test Project',
          priority: 'medium',
          dueDate: mockTask.dueDate,
        },
        priority: 'medium',
      });
    });

    test('should not trigger for tasks without assignedTo', async () => {
      const mockTask = {
        assignedTo: null,
        status: 'pending',
      };

      const assignedRule = workflowEngine.rules.get('task_assigned');
      const conditionResult = await assignedRule.condition(mockTask);
      expect(conditionResult).toBe(false);
    });

    test('should not trigger for non-pending tasks', async () => {
      const mockTask = {
        assignedTo: 'user123',
        status: 'completed',
      };

      const assignedRule = workflowEngine.rules.get('task_assigned');
      const conditionResult = await assignedRule.condition(mockTask);
      expect(conditionResult).toBe(false);
    });
  });

  describe('Task Completion Rule', () => {
    test('should handle task completion correctly', async () => {
      const mockTask = {
        _id: 'task123',
        title: 'Test Task',
        assignedTo: 'user123',
        assignedBy: 'user456',
        status: 'completed',
        project: 'Test Project',
        priority: 'medium',
      };

      const mockOldTask = {
        status: 'in_progress',
      };

      const mockAssignedUser = {
        _id: 'user123',
        fullName: 'John Doe',
      };

      const mockAssignedBy = {
        _id: 'user456',
        fullName: 'Jane Smith',
      };

      const mockManagers = [
        { _id: 'manager1', fullName: 'Manager One' },
        { _id: 'manager2', fullName: 'Manager Two' },
      ];

      User.findById
        .mockResolvedValueOnce(mockAssignedUser)
        .mockResolvedValueOnce(mockAssignedBy);

      User.find.mockResolvedValue(mockManagers);
      Task.find.mockResolvedValue([mockTask]); // For workflow completion check

      notificationService.sendNotification.mockResolvedValue();

      const completedRule = workflowEngine.rules.get('task_completed');
      
      // Test condition
      const conditionResult = await completedRule.condition(mockTask, mockOldTask);
      expect(conditionResult).toBe(true);

      // Test action
      await completedRule.action(mockTask);

      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        recipient: 'user456',
        sender: 'user123',
        type: 'task_completed',
        title: 'Task Completed: Test Task',
        message: 'John Doe has completed the task "Test Task".',
        data: {
          taskId: 'task123',
          projectName: 'Test Project',
          priority: 'medium',
          completedAt: expect.any(Date),
        },
        priority: 'medium',
      });

      // Should notify managers
      expect(notificationService.sendNotification).toHaveBeenCalledTimes(3); // assignedBy + 2 managers
    });

    test('should not trigger if task was already completed', async () => {
      const mockTask = { status: 'completed' };
      const mockOldTask = { status: 'completed' };

      const completedRule = workflowEngine.rules.get('task_completed');
      const conditionResult = await completedRule.condition(mockTask, mockOldTask);
      expect(conditionResult).toBe(false);
    });
  });

  describe('Overdue Tasks Check', () => {
    test('should check and notify about overdue tasks', async () => {
      const mockOverdueTasks = [
        {
          _id: 'task1',
          title: 'Overdue Task 1',
          assignedTo: { _id: 'user1', fullName: 'User One' },
          assignedBy: { _id: 'user2', fullName: 'User Two' },
          dueDate: new Date('2023-01-01'),
          priority: 'high',
          project: 'Test Project',
        },
      ];

      Task.find.mockResolvedValue(mockOverdueTasks);
      Notification.findOne.mockResolvedValue(null); // No recent notifications
      Notification.create.mockResolvedValue({});
      User.find.mockResolvedValue([{ _id: 'manager1' }]);
      notificationService.sendNotification.mockResolvedValue();

      await workflowEngine.checkOverdueTasks();

      expect(Task.find).toHaveBeenCalledWith({
        dueDate: { $lt: expect.any(Date) },
        status: { $nin: ['completed', 'cancelled'] },
        isActive: true,
      });

      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        recipient: 'user1',
        type: 'task_overdue',
        title: 'Task Overdue: Overdue Task 1',
        message: expect.stringContaining('Your task "Overdue Task 1" was due on'),
        data: {
          taskId: 'task1',
          projectName: 'Test Project',
          priority: 'high',
          dueDate: expect.any(Date),
        },
        priority: 'high',
      });
    });

    test('should skip tasks with recent overdue notifications', async () => {
      const mockOverdueTasks = [
        {
          _id: 'task1',
          title: 'Overdue Task 1',
          assignedTo: { _id: 'user1' },
          dueDate: new Date('2023-01-01'),
          priority: 'medium',
        },
      ];

      Task.find.mockResolvedValue(mockOverdueTasks);
      Notification.findOne.mockResolvedValue({ _id: 'recent_notification' }); // Recent notification exists

      await workflowEngine.checkOverdueTasks();

      expect(notificationService.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('Task Escalation', () => {
    test('should escalate critical overdue tasks', async () => {
      const mockCriticalTasks = [
        {
          _id: 'task1',
          title: 'Critical Task',
          assignedTo: { _id: 'user1', fullName: 'User One' },
          dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          priority: 'critical',
          project: 'Critical Project',
        },
      ];

      const mockManagers = [
        { _id: 'manager1' },
        { _id: 'admin1' },
      ];

      Task.find.mockResolvedValue(mockCriticalTasks);
      Notification.findOne.mockResolvedValue(null); // No recent escalation
      User.find.mockResolvedValue(mockManagers);
      notificationService.sendNotification.mockResolvedValue();

      await workflowEngine.checkTaskEscalation();

      expect(Task.find).toHaveBeenCalledWith({
        dueDate: { $lt: expect.any(Date) },
        priority: { $in: ['high', 'critical'] },
        status: { $nin: ['completed', 'cancelled'] },
        isActive: true,
      });

      // Should notify managers and the assigned user
      expect(notificationService.sendNotification).toHaveBeenCalledTimes(3); // 2 managers + 1 assigned user

      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        recipient: 'manager1',
        type: 'task_escalated',
        title: 'ESCALATION: Critical Task',
        message: expect.stringContaining('Critical task "Critical Task" assigned to User One is 2 days overdue'),
        data: {
          taskId: 'task1',
          projectName: 'Critical Project',
          priority: 'critical',
          dueDate: expect.any(Date),
          daysOverdue: 2,
        },
        priority: 'urgent',
      });
    });

    test('should skip recently escalated tasks', async () => {
      const mockCriticalTasks = [
        {
          _id: 'task1',
          title: 'Critical Task',
          dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          priority: 'critical',
        },
      ];

      Task.find.mockResolvedValue(mockCriticalTasks);
      Notification.findOne.mockResolvedValue({ _id: 'recent_escalation' }); // Recent escalation exists

      await workflowEngine.checkTaskEscalation();

      expect(notificationService.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('Daily Digest', () => {
    test('should send daily digest to users with preference enabled', async () => {
      const mockUsers = [
        {
          _id: 'user1',
          notificationPreferences: { email: { dailyDigest: true } },
          isActive: true,
        },
        {
          _id: 'user2',
          notificationPreferences: { email: { dailyDigest: true } },
          isActive: true,
        },
      ];

      const mockTasks = [
        {
          _id: 'task1',
          title: 'Task 1',
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday (overdue)
          status: 'pending',
        },
        {
          _id: 'task2',
          title: 'Task 2',
          dueDate: new Date(), // Today
          status: 'in_progress',
        },
      ];

      User.find.mockResolvedValue(mockUsers);
      Task.find.mockResolvedValue(mockTasks);
      notificationService.sendNotification.mockResolvedValue();

      await workflowEngine.sendDailyDigests();

      expect(User.find).toHaveBeenCalledWith({
        'notificationPreferences.email.dailyDigest': true,
        isActive: true,
      });

      expect(notificationService.sendNotification).toHaveBeenCalledTimes(2); // One for each user

      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        recipient: 'user1',
        type: 'daily_digest',
        title: 'Daily Task Digest',
        message: 'You have 2 active tasks. 1 overdue, 1 due today.',
        data: {
          totalTasks: 2,
          overdueTasks: 1,
          dueTodayTasks: 1,
          tasks: mockTasks,
        },
        priority: 'low',
      });
    });

    test('should not send digest to users with no active tasks', async () => {
      const mockUsers = [
        {
          _id: 'user1',
          notificationPreferences: { email: { dailyDigest: true } },
          isActive: true,
        },
      ];

      User.find.mockResolvedValue(mockUsers);
      Task.find.mockResolvedValue([]); // No tasks
      notificationService.sendNotification.mockResolvedValue();

      await workflowEngine.sendDailyDigests();

      expect(notificationService.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('Workflow Completion Check', () => {
    test('should notify stakeholders when all project tasks are completed', async () => {
      const mockCompletedTask = {
        _id: 'task1',
        project: 'Test Project',
        assignedBy: 'user1',
      };

      const mockProjectTasks = [
        { _id: 'task1', status: 'completed' },
        { _id: 'task2', status: 'completed' },
        { _id: 'task3', status: 'completed' },
      ];

      const mockStakeholders = [
        { _id: 'admin1' },
        { _id: 'manager1' },
        { _id: 'user1' },
      ];

      Task.find.mockResolvedValue(mockProjectTasks);
      User.find.mockResolvedValue(mockStakeholders);
      notificationService.sendNotification.mockResolvedValue();

      await workflowEngine.checkWorkflowCompletion(mockCompletedTask);

      expect(notificationService.sendNotification).toHaveBeenCalledTimes(3);

      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        recipient: 'admin1',
        type: 'workflow_completed',
        title: 'Project Completed: Test Project',
        message: 'All 3 tasks in project "Test Project" have been completed.',
        data: {
          projectName: 'Test Project',
          totalTasks: 3,
          completedAt: expect.any(Date),
        },
        priority: 'medium',
      });
    });

    test('should not notify if not all tasks are completed', async () => {
      const mockCompletedTask = {
        project: 'Test Project',
      };

      const mockProjectTasks = [
        { _id: 'task1', status: 'completed' },
        { _id: 'task2', status: 'pending' }, // Not completed
      ];

      Task.find.mockResolvedValue(mockProjectTasks);

      await workflowEngine.checkWorkflowCompletion(mockCompletedTask);

      expect(notificationService.sendNotification).not.toHaveBeenCalled();
    });

    test('should not notify for single task projects', async () => {
      const mockCompletedTask = {
        project: 'Test Project',
      };

      const mockProjectTasks = [
        { _id: 'task1', status: 'completed' },
      ];

      Task.find.mockResolvedValue(mockProjectTasks);

      await workflowEngine.checkWorkflowCompletion(mockCompletedTask);

      expect(notificationService.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('Engine Lifecycle', () => {
    test('should start and schedule all rules', () => {
      jest.spyOn(workflowEngine, 'scheduleRule').mockImplementation(() => {});

      workflowEngine.start();

      expect(console.log).toHaveBeenCalledWith('🚀 Workflow Engine started');
      expect(workflowEngine.scheduleRule).toHaveBeenCalledTimes(3); // 3 scheduled rules
    });

    test('should stop and clear all scheduled jobs', () => {
      // Set up some mock intervals
      workflowEngine.scheduledJobs.set('test1', 'interval1');
      workflowEngine.scheduledJobs.set('test2', 'interval2');

      jest.spyOn(global, 'clearInterval').mockImplementation(() => {});

      workflowEngine.stop();

      expect(console.log).toHaveBeenCalledWith('⏹️ Workflow Engine stopped');
      expect(clearInterval).toHaveBeenCalledWith('interval1');
      expect(clearInterval).toHaveBeenCalledWith('interval2');
      expect(workflowEngine.scheduledJobs.size).toBe(0);

      clearInterval.mockRestore();
    });
  });

  describe('Error Handling', () => {
    test('should handle errors in scheduled rule execution', async () => {
      const errorRule = {
        trigger: 'schedule',
        interval: 100,
        condition: async () => true,
        action: async () => {
          throw new Error('Scheduled rule error');
        },
      };

      workflowEngine.addRule('error_rule', errorRule);

      // Wait for the rule to execute
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error executing workflow rule error_rule'),
        expect.any(Error)
      );
    });

    test('should handle errors in rule conditions', async () => {
      const errorRule = {
        trigger: 'event',
        condition: async () => {
          throw new Error('Condition error');
        },
        action: jest.fn(),
      };

      workflowEngine.addRule('condition_error', errorRule);

      await workflowEngine.executeEventRules('test', {});

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error executing event rule condition_error'),
        expect.any(Error)
      );
      expect(errorRule.action).not.toHaveBeenCalled();
    });
  });

  describe('Task Reminder Scheduling', () => {
    test('should schedule reminders for future due dates', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      const mockTask = {
        _id: 'task123',
        title: 'Future Task',
        assignedTo: 'user123',
        dueDate: futureDate,
        project: 'Test Project',
        priority: 'medium',
      };

      jest.spyOn(global, 'setTimeout').mockImplementation(() => {});

      await workflowEngine.scheduleTaskReminders(mockTask);

      // Should schedule 3 reminders (3 days, 1 day, 4 hours before due date)
      expect(setTimeout).toHaveBeenCalledTimes(3);

      setTimeout.mockRestore();
    });

    test('should not schedule reminders for past due dates', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const mockTask = {
        _id: 'task123',
        title: 'Past Task',
        assignedTo: 'user123',
        dueDate: pastDate,
        project: 'Test Project',
        priority: 'medium',
      };

      jest.spyOn(global, 'setTimeout').mockImplementation(() => {});

      await workflowEngine.scheduleTaskReminders(mockTask);

      expect(setTimeout).not.toHaveBeenCalled();

      setTimeout.mockRestore();
    });
  });
});