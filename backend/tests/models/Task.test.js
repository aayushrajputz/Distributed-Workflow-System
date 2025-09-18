const mongoose = require('mongoose');
const Task = require('../../models/Task');
const { createTask, pendingTask, completedTask, overdueTask } = require('../fixtures/tasks');
const { regularUser, managerUser } = require('../fixtures/users');

describe('Task Model', () => {
  // Connect to the in-memory database before tests
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI);
  });

  // Clear all data after each test
  afterEach(async () => {
    await Task.deleteMany({});
  });

  // Disconnect after all tests
  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe('Schema Validation', () => {
    it('should create a valid task with all required fields', async () => {
      const taskData = createTask(regularUser._id, managerUser._id);
      const task = new Task(taskData);
      const validationError = task.validateSync();
      expect(validationError).toBeUndefined();
    });

    it('should require title field', async () => {
      const taskData = createTask(regularUser._id, managerUser._id, { title: undefined });
      const task = new Task(taskData);
      const validationError = task.validateSync();
      expect(validationError.errors.title).toBeDefined();
    });

    it('should enforce title length limit', async () => {
      const longTitle = 'a'.repeat(201);
      const taskData = createTask(regularUser._id, managerUser._id, { title: longTitle });
      const task = new Task(taskData);
      const validationError = task.validateSync();
      expect(validationError.errors.title).toBeDefined();
    });

    it('should validate status enum values', async () => {
      const taskData = createTask(regularUser._id, managerUser._id, { status: 'invalid' });
      const task = new Task(taskData);
      const validationError = task.validateSync();
      expect(validationError.errors.status).toBeDefined();
    });
  });

  describe('Virtual Properties', () => {
    it('should calculate progressPercentage from progress field', async () => {
      const task = new Task(createTask(regularUser._id, managerUser._id, { progress: 75 }));
      expect(task.progressPercentage).toBe(75);
    });

    it('should calculate progressPercentage from actual/estimated hours', async () => {
      const task = new Task(createTask(regularUser._id, managerUser._id, {
        estimatedHours: 10,
        actualHours: 5,
        progress: 0 // Should use hours instead
      }));
      expect(task.progressPercentage).toBe(50);
    });

    it('should calculate isOverdue correctly', async () => {
      const task = new Task(overdueTask);
      expect(task.isOverdue).toBe(true);
    });

    it('should calculate daysRemaining correctly', async () => {
      const today = new Date('2025-09-18T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => today);

      const task = new Task(createTask(regularUser._id, managerUser._id, {
        dueDate: new Date('2025-09-25T12:00:00Z')
      }));
      expect(task.daysRemaining).toBe(7);
    });
  });

  describe('Pre-save Middleware', () => {
    it('should set completedAt when status changes to completed', async () => {
      const task = new Task(createTask(regularUser._id, managerUser._id));
      await task.save();
      
      task.status = 'completed';
      await task.save();

      expect(task.completedAt).toBeDefined();
      expect(task.progress).toBe(100);
    });

    it('should clear completedAt when status changes from completed', async () => {
      const task = new Task(completedTask);
      await task.save();
      
      task.status = 'in-progress';
      await task.save();

      expect(task.completedAt).toBeUndefined();
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test data
      await Task.create([
        pendingTask,
        completedTask,
        overdueTask,
        createTask(regularUser._id, managerUser._id, {
          status: 'in-progress',
          priority: 'high'
        })
      ]);
    });

    it('should get task stats by user', async () => {
      const stats = await Task.getTaskStats(regularUser._id);
      expect(stats).toEqual({
        total: 4,
        completed: 1,
        pending: 1,
        inProgress: 1,
        overdue: 1,
        highPriority: 1
      });
    });

    it('should get overdue tasks', async () => {
      const overdueTasks = await Task.getOverdueTasks(regularUser._id);
      expect(overdueTasks).toHaveLength(1);
      expect(overdueTasks[0]._id).toEqual(overdueTask._id);
    });

    it('should get upcoming tasks within days', async () => {
      const today = new Date('2025-09-18T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => today);

      const upcomingTasks = await Task.getUpcomingTasks(regularUser._id, 7);
      expect(upcomingTasks.length).toBeGreaterThan(0);
      upcomingTasks.forEach(task => {
        expect(task.dueDate).toBeDefined();
        const daysUntilDue = Math.ceil((task.dueDate - today) / (1000 * 60 * 60 * 24));
        expect(daysUntilDue).toBeLessThanOrEqual(7);
      });
    });
  });
});