const mongoose = require('mongoose');
const { 
  createMockReq, 
  createMockRes, 
  createMockNext 
} = require('../utils/testHelpers');
const taskController = require('../../controllers/taskController');
const Task = require('../../models/Task');
const { 
  createTask, 
  pendingTask, 
  completedTask 
} = require('../fixtures/tasks');
const { 
  adminUser, 
  regularUser, 
  managerUser 
} = require('../fixtures/users');

// Mock external services
jest.mock('../../services/backgroundWorker');
jest.mock('../../services/notificationService');
jest.mock('../../services/integrationService');

describe('Task Controller', () => {
  let req, res, next;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI);
  });

  beforeEach(() => {
    req = createMockReq();
    res = createMockRes();
    next = createMockNext();
  });

  afterEach(async () => {
    await Task.deleteMany({});
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe('getTasks', () => {
    beforeEach(async () => {
      await Task.create([pendingTask, completedTask]);
    });

    it('should return tasks with pagination for regular user', async () => {
      req.user = regularUser;
      req.query = { page: 1, limit: 10 };

      await taskController.getTasks(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          tasks: expect.any(Array),
          total: expect.any(Number),
          page: 1,
          pages: expect.any(Number),
        }),
      });
    });

    it('should filter tasks by status', async () => {
      req.user = regularUser;
      req.query = { status: 'completed' };

      await taskController.getTasks(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.data.tasks).toHaveLength(1);
      expect(response.data.tasks[0].status).toBe('completed');
    });

    it('should allow admin to view all tasks', async () => {
      req.user = adminUser;
      await taskController.getTasks(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.data.tasks.length).toBeGreaterThan(0);
    });
  });

  describe('createTask', () => {
    const taskData = {
      title: 'New Test Task',
      description: 'Test description',
      priority: 'medium',
      dueDate: '2025-09-25T00:00:00Z',
      assignedTo: regularUser._id.toString(),
    };

    it('should create a task and queue notifications', async () => {
      req.user = managerUser;
      req.body = taskData;

      await taskController.createTask(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.task).toMatchObject({
        title: taskData.title,
        assignedTo: regularUser._id,
      });

      // Verify background jobs were queued
      const { taskQueue } = require('../../services/backgroundWorker');
      expect(taskQueue.add).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      req.user = managerUser;
      req.body = { title: 'Invalid Task' }; // Missing required fields

      await taskController.createTask(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        })
      );
    });
  });

  describe('updateTask', () => {
    let existingTask;

    beforeEach(async () => {
      existingTask = await Task.create(createTask(regularUser._id, managerUser._id));
    });

    it('should update task and send notifications', async () => {
      req.user = managerUser;
      req.params = { taskId: existingTask._id.toString() };
      req.body = { title: 'Updated Title' };

      await taskController.updateTask(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.data.task.title).toBe('Updated Title');

      const { notificationQueue } = require('../../services/backgroundWorker');
      expect(notificationQueue.add).toHaveBeenCalled();
    });

    it('should prevent unauthorized updates', async () => {
      const unauthorizedUser = { ...regularUser, _id: new mongoose.Types.ObjectId() };
      req.user = unauthorizedUser;
      req.params = { taskId: existingTask._id.toString() };
      req.body = { title: 'Unauthorized Update' };

      await taskController.updateTask(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
    });
  });

  describe('updateTaskStatus', () => {
    let existingTask;

    beforeEach(async () => {
      existingTask = await Task.create(createTask(regularUser._id, managerUser._id));
    });

    it('should update status and handle completion', async () => {
      req.user = regularUser;
      req.params = { taskId: existingTask._id.toString() };
      req.body = { status: 'completed' };

      await taskController.updateTaskStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.data.task.status).toBe('completed');
      expect(response.data.task.completedAt).toBeDefined();

      const { notificationQueue } = require('../../services/backgroundWorker');
      expect(notificationQueue.add).toHaveBeenCalled();
    });
  });

  describe('getTaskStats', () => {
    beforeEach(async () => {
      await Task.create([
        pendingTask,
        completedTask,
        createTask(regularUser._id, managerUser._id, { priority: 'high' }),
      ]);
    });

    it('should return task statistics for user', async () => {
      req.user = regularUser;

      await taskController.getTaskStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.data).toMatchObject({
        total: expect.any(Number),
        completed: expect.any(Number),
        pending: expect.any(Number),
        highPriority: expect.any(Number),
      });
    });
  });

  describe('addComment', () => {
    let existingTask;

    beforeEach(async () => {
      existingTask = await Task.create(createTask(regularUser._id, managerUser._id));
    });

    it('should add comment and notify users', async () => {
      req.user = regularUser;
      req.params = { taskId: existingTask._id.toString() };
      req.body = { text: 'Test comment' };

      await taskController.addComment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.data.task.comments).toHaveLength(1);
      expect(response.data.task.comments[0].text).toBe('Test comment');

      const { notificationQueue } = require('../../services/backgroundWorker');
      expect(notificationQueue.add).toHaveBeenCalled();
    });
  });
});