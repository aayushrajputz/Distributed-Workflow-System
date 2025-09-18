// Mock BullMQ queues
module.exports = {
  queues: {
    'slack-notifications': {
      add: jest.fn().mockResolvedValue({ id: 'mock-slack-job-id' }),
    },
    'jira-operations': {
      add: jest.fn().mockResolvedValue({ id: 'mock-jira-job-id' }),
    },
    'notification-batches': {
      add: jest.fn().mockResolvedValue({ id: 'mock-batch-job-id' }),
    },
  },
  // Mock task queue separately for task operations
  taskQueue: {
    add: jest.fn().mockResolvedValue({ id: 'mock-task-job-id' }),
  },
  // Mock helper functions
  createQueue: jest.fn().mockImplementation((name) => ({
    add: jest.fn().mockResolvedValue({ id: `mock-${name}-job-id` }),
  })),
};