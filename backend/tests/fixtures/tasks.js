const mongoose = require('mongoose');
const { regularUser, managerUser } = require('./users');

/**
 * Task factory function
 */
const createTask = (assignedTo, assignedBy, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  title: 'Test Task',
  description: 'Test task description',
  status: 'pending',
  priority: 'medium',
  dueDate: new Date('2025-09-25T00:00:00Z'),
  scheduledDate: new Date('2025-09-20T00:00:00Z'),
  assignedTo: assignedTo?._id || assignedTo || regularUser._id,
  assignedBy: assignedBy?._id || assignedBy || managerUser._id,
  project: 'Test Project',
  estimatedHours: 8,
  actualHours: 0,
  progress: 0,
  tags: ['test'],
  comments: [],
  attachments: [],
  isActive: true,
  createdAt: new Date('2025-09-18T10:00:00Z'),
  ...overrides,
});

/**
 * Predefined task fixtures
 */
const pendingTask = createTask(regularUser._id, managerUser._id, {
  title: 'Pending Task',
  status: 'pending',
  dueDate: new Date('2025-09-25T00:00:00Z'),
});

const inProgressTask = createTask(regularUser._id, managerUser._id, {
  title: 'In Progress Task',
  status: 'in-progress',
  progress: 50,
  actualHours: 4,
});

const completedTask = createTask(regularUser._id, managerUser._id, {
  title: 'Completed Task',
  status: 'completed',
  progress: 100,
  actualHours: 8,
  completedAt: new Date('2025-09-18T15:00:00Z'),
});

const overdueTask = createTask(regularUser._id, managerUser._id, {
  title: 'Overdue Task',
  status: 'pending',
  dueDate: new Date('2025-09-17T00:00:00Z'),
});

const highPriorityTask = createTask(regularUser._id, managerUser._id, {
  title: 'High Priority Task',
  priority: 'high',
  dueDate: new Date('2025-09-19T00:00:00Z'),
});

const taskWithComments = createTask(regularUser._id, managerUser._id, {
  title: 'Task with Comments',
  comments: [
    {
      _id: new mongoose.Types.ObjectId(),
      text: 'Test comment 1',
      userId: regularUser._id,
      createdAt: new Date('2025-09-18T10:30:00Z'),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      text: 'Test comment 2',
      userId: managerUser._id,
      createdAt: new Date('2025-09-18T11:00:00Z'),
    },
  ],
});

module.exports = {
  createTask,
  pendingTask,
  inProgressTask,
  completedTask,
  overdueTask,
  highPriorityTask,
  taskWithComments,
};