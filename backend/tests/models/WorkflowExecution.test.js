const mongoose = require('mongoose');
const WorkflowExecution = require('../../models/WorkflowExecution');
const { 
  createWorkflowExecution,
  simpleWorkflowTemplate,
  workflowExecution,
  completedWorkflowExecution 
} = require('../fixtures/workflows');
const { regularUser } = require('../fixtures/users');

describe('WorkflowExecution Model', () => {
  // Connect to the in-memory database before tests
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI);
  });

  // Clear all data after each test
  afterEach(async () => {
    await WorkflowExecution.deleteMany({});
  });

  // Disconnect after all tests
  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe('Schema Validation', () => {
    it('should create a valid workflow execution with all required fields', async () => {
      const execution = new WorkflowExecution(workflowExecution);
      const validationError = execution.validateSync();
      expect(validationError).toBeUndefined();
    });

    it('should require workflowTemplateId', async () => {
      const executionData = createWorkflowExecution(null, regularUser._id);
      delete executionData.workflowTemplateId;
      
      const execution = new WorkflowExecution(executionData);
      const validationError = execution.validateSync();
      expect(validationError.errors.workflowTemplateId).toBeDefined();
    });

    it('should validate status enum values', async () => {
      const executionData = createWorkflowExecution(
        simpleWorkflowTemplate._id,
        regularUser._id,
        { status: 'invalid' }
      );
      
      const execution = new WorkflowExecution(executionData);
      const validationError = execution.validateSync();
      expect(validationError.errors.status).toBeDefined();
    });

    it('should validate step status values', async () => {
      const executionData = createWorkflowExecution(
        simpleWorkflowTemplate._id,
        regularUser._id,
        {
          steps: [{
            nodeId: 'start',
            status: 'invalid',
            startedAt: new Date()
          }]
        }
      );
      
      const execution = new WorkflowExecution(executionData);
      const validationError = execution.validateSync();
      expect(validationError.errors['steps.0.status']).toBeDefined();
    });
  });

  describe('Instance Methods', () => {
    let execution;

    beforeEach(async () => {
      execution = new WorkflowExecution(workflowExecution);
      await execution.save();
    });

    it('should update progress correctly', async () => {
      await execution.updateProgress();
      expect(execution.progress).toBe(33); // 1 of 3 steps completed
      
      // Complete another step
      execution.steps.push({
        nodeId: 'task',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date()
      });
      
      await execution.updateProgress();
      expect(execution.progress).toBe(66); // 2 of 3 steps completed
    });

    it('should add log entries with timestamps', async () => {
      await execution.addLog('info', 'Test message', 'task', { key: 'value' });
      
      expect(execution.logs[execution.logs.length - 1]).toMatchObject({
        level: 'info',
        message: 'Test message',
        nodeId: 'task',
        data: { key: 'value' },
        timestamp: expect.any(Date)
      });
    });

    it('should validate log levels', async () => {
      await expect(execution.addLog('invalid', 'Test')).rejects.toThrow();
    });

    it('should update step status and calculate duration', async () => {
      const startTime = new Date('2025-09-18T10:00:00Z');
      const endTime = new Date('2025-09-18T10:01:00Z');
      
      await execution.updateStepStatus('task', 'completed', { result: 'success' }, null, startTime, endTime);
      
      const step = execution.steps.find(s => s.nodeId === 'task');
      expect(step).toMatchObject({
        status: 'completed',
        output: { result: 'success' },
        error: null,
        duration: 60000 // 1 minute in milliseconds
      });
    });
  });

  describe('State and Status Management', () => {
    it('should determine if execution can proceed', async () => {
      const pendingExecution = new WorkflowExecution(createWorkflowExecution(
        simpleWorkflowTemplate._id,
        regularUser._id,
        { status: 'pending' }
      ));
      expect(pendingExecution.canExecute()).toBe(true);

      const completedExecution = new WorkflowExecution(completedWorkflowExecution);
      expect(completedExecution.canExecute()).toBe(false);
    });

    it('should identify completed state correctly', async () => {
      const runningExecution = new WorkflowExecution(workflowExecution);
      expect(runningExecution.isCompleted()).toBe(false);

      const completedExecution = new WorkflowExecution(completedWorkflowExecution);
      expect(completedExecution.isCompleted()).toBe(true);
    });
  });

  describe('Static Methods', () => {
    it('should generate unique execution IDs', () => {
      const id1 = WorkflowExecution.generateExecutionId();
      const id2 = WorkflowExecution.generateExecutionId();
      
      expect(id1).not.toEqual(id2);
      expect(id1).toMatch(/^exec_[a-zA-Z0-9]{24,}$/);
    });
  });

  describe('Progress Tracking', () => {
    it('should handle zero steps', async () => {
      const execution = new WorkflowExecution(createWorkflowExecution(
        simpleWorkflowTemplate._id,
        regularUser._id,
        { steps: [] }
      ));
      
      await execution.updateProgress();
      expect(execution.progress).toBe(0);
    });

    it('should handle all failed steps', async () => {
      const execution = new WorkflowExecution(createWorkflowExecution(
        simpleWorkflowTemplate._id,
        regularUser._id,
        {
          steps: [
            {
              nodeId: 'start',
              status: 'failed',
              startedAt: new Date(),
              error: { message: 'Test error' }
            }
          ]
        }
      ));
      
      await execution.updateProgress();
      expect(execution.progress).toBe(0);
      expect(execution.failedSteps).toBe(1);
    });
  });
});