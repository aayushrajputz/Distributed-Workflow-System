const WorkflowExecutor = require('../services/workflowExecutor');
const WorkflowExecution = require('../models/WorkflowExecution');
const WorkflowTemplate = require('../models/WorkflowTemplate');
const Task = require('../models/Task');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const workflowEngine = require('../services/workflowEngine');

// Mock dependencies
jest.mock('../models/WorkflowExecution');
jest.mock('../models/WorkflowTemplate');
jest.mock('../models/Task');
jest.mock('../models/User');
jest.mock('../services/notificationService');
jest.mock('../services/workflowEngine');
jest.mock('node-fetch');

describe('WorkflowExecutor', () => {
  let workflowExecutor;

  beforeEach(() => {
    // Create a fresh instance for each test
    workflowExecutor = new (require('../services/workflowExecutor').constructor)();
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up
    workflowExecutor.runningExecutions.clear();
    
    // Restore console methods
    console.log.mockRestore();
    console.error.mockRestore();
  });

  describe('Execution Management', () => {
    test('should start workflow execution successfully', async () => {
      const mockExecution = {
        _id: 'exec123',
        status: 'pending',
        canExecute: () => true,
        save: jest.fn().mockResolvedValue(),
        addLog: jest.fn().mockResolvedValue(),
        workflowTemplateId: {
          nodes: [
            { id: 'start', type: 'start' },
            { id: 'end', type: 'end' },
          ],
          connections: [{ source: 'start', target: 'end' }],
        },
        triggeredBy: { _id: 'user123' },
      };

      WorkflowExecution.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockExecution),
      });

      jest.spyOn(workflowExecutor, 'processWorkflow').mockResolvedValue();

      const result = await workflowExecutor.startExecution('exec123');

      expect(result.status).toBe('started');
      expect(result.executionId).toBe('exec123');
      expect(mockExecution.status).toBe('running');
      expect(mockExecution.startTime).toBeDefined();
      expect(workflowExecutor.runningExecutions.has('exec123')).toBe(true);
    });

    test('should reject execution if not found', async () => {
      WorkflowExecution.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await expect(workflowExecutor.startExecution('nonexistent'))
        .rejects.toThrow('Workflow execution nonexistent not found');
    });

    test('should reject execution if cannot execute', async () => {
      const mockExecution = {
        _id: 'exec123',
        status: 'completed',
        canExecute: () => false,
      };

      WorkflowExecution.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockExecution),
      });

      await expect(workflowExecutor.startExecution('exec123'))
        .rejects.toThrow('Workflow execution exec123 cannot be executed (status: completed)');
    });

    test('should queue execution when at concurrent limit', async () => {
      // Fill up the concurrent execution limit
      for (let i = 0; i < workflowExecutor.maxConcurrentExecutions; i++) {
        workflowExecutor.runningExecutions.set(`exec${i}`, {});
      }

      const mockExecution = {
        _id: 'exec123',
        status: 'pending',
        canExecute: () => true,
        addLog: jest.fn().mockResolvedValue(),
      };

      WorkflowExecution.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockExecution),
      });

      const result = await workflowExecutor.startExecution('exec123');

      expect(result.status).toBe('queued');
      expect(result.message).toBe('Execution queued due to system load');
    });
  });

  describe('Node Processing', () => {
    let mockExecution, mockTemplate;

    beforeEach(() => {
      mockTemplate = {
        nodes: [
          { id: 'start', type: 'start', config: {} },
          { id: 'task1', type: 'task', config: { title: 'Test Task' } },
          { id: 'end', type: 'end', config: {} },
        ],
        connections: [
          { source: 'start', target: 'task1' },
          { source: 'task1', target: 'end' },
        ],
      };

      mockExecution = {
        _id: 'exec123',
        workflowTemplateId: mockTemplate,
        steps: [
          { nodeId: 'start', status: 'pending' },
          { nodeId: 'task1', status: 'pending' },
          { nodeId: 'end', status: 'pending' },
        ],
        variables: { testVar: 'testValue' },
        context: { userId: 'user123' },
        triggeredBy: 'user123',
        save: jest.fn().mockResolvedValue(),
        addLog: jest.fn().mockResolvedValue(),
        updateProgress: jest.fn().mockResolvedValue(),
      };
    });

    test('should process start node successfully', async () => {
      const startNode = { id: 'start', type: 'start', config: {} };
      const result = await workflowExecutor.processStartNode(mockExecution, startNode);

      expect(result.message).toBe('Workflow started');
      expect(result.variables).toEqual(mockExecution.variables);
      expect(result.context).toEqual(mockExecution.context);
    });

    test('should process task node successfully', async () => {
      const taskNode = {
        id: 'task1',
        type: 'task',
        config: {
          title: 'Test Task {{testVar}}',
          description: 'Task description',
          priority: 'medium',
          project: 'Test Project',
        },
      };

      const mockTask = {
        _id: 'task123',
        title: 'Test Task testValue',
        populate: jest.fn().mockResolvedThis(),
      };

      Task.create.mockResolvedValue(mockTask);
      workflowEngine.executeEventRules.mockResolvedValue();

      const result = await workflowExecutor.processTaskNode(mockExecution, taskNode);

      expect(Task.create).toHaveBeenCalledWith({
        title: 'Test Task testValue',
        description: 'Task description',
        priority: 'medium',
        project: 'Test Project',
        assignedTo: 'user123',
        assignedBy: 'user123',
        dueDate: expect.any(Date),
        scheduledDate: expect.any(Date),
        tags: [],
      });

      expect(result.taskId).toBe('task123');
      expect(result.message).toBe('Task created successfully');
    });

    test('should process email node successfully', async () => {
      const emailNode = {
        id: 'email1',
        type: 'email',
        config: {
          recipient: 'user123',
          subject: 'Test Email {{testVar}}',
          body: 'Email body with {{testVar}}',
          priority: 'medium',
        },
      };

      notificationService.sendNotification.mockResolvedValue();

      const result = await workflowExecutor.processEmailNode(mockExecution, emailNode);

      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        recipient: 'user123',
        sender: 'user123',
        type: 'workflow_notification',
        title: 'Test Email testValue',
        message: 'Email body with testValue',
        priority: 'medium',
        data: {
          workflowExecutionId: 'exec123',
          workflowName: undefined,
        },
        channels: {
          inApp: { sent: false, read: false },
          email: { sent: false },
          websocket: { sent: false },
        },
      });

      expect(result.message).toBe('Email notification sent successfully');
    });

    test('should process delay node successfully', async () => {
      const delayNode = {
        id: 'delay1',
        type: 'delay',
        config: { duration: 100 },
      };

      const startTime = Date.now();
      const result = await workflowExecutor.processDelayNode(mockExecution, delayNode);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
      expect(result.delayDuration).toBe(100);
      expect(result.message).toBe('Delayed execution for 100ms');
    });

    test('should process condition node successfully', async () => {
      const conditionNode = {
        id: 'condition1',
        type: 'condition',
        config: { condition: '{{testVar}} == testValue' },
      };

      const result = await workflowExecutor.processConditionNode(mockExecution, conditionNode);

      expect(result.condition).toBe('testValue == testValue');
      expect(result.result).toBe(true);
      expect(result.message).toBe('Condition evaluated to: true');
    });

    test('should process approval node successfully', async () => {
      const approvalNode = {
        id: 'approval1',
        type: 'approval',
        config: {
          approver: 'manager123',
          message: 'Please approve this workflow step',
          priority: 'high',
        },
      };

      notificationService.sendNotification.mockResolvedValue();

      const result = await workflowExecutor.processApprovalNode(mockExecution, approvalNode);

      expect(result.status).toBe('waiting_approval');
      expect(result.approver).toBe('manager123');
      expect(result.message).toBe('Approval request sent');

      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        recipient: 'manager123',
        sender: 'user123',
        type: 'workflow_approval',
        title: 'Approval Required: undefined',
        message: 'Please approve this workflow step',
        priority: 'high',
        data: {
          workflowExecutionId: 'exec123',
          nodeId: 'approval1',
          workflowName: undefined,
        },
        channels: {
          inApp: { sent: false, read: false },
          email: { sent: false },
          websocket: { sent: false },
        },
      });
    });

    test('should process API call node successfully', async () => {
      const apiNode = {
        id: 'api1',
        type: 'api_call',
        config: {
          url: 'https://api.example.com/test',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { data: '{{testVar}}' },
        },
      };

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({ success: true }),
      };

      const fetch = require('node-fetch');
      fetch.mockResolvedValue(mockResponse);

      const result = await workflowExecutor.processApiCallNode(mockExecution, apiNode);

      expect(fetch).toHaveBeenCalledWith('https://api.example.com/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: { data: 'testValue' },
      });

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ success: true });
      expect(result.message).toBe('API call completed successfully');
    });

    test('should process end node successfully', async () => {
      const endNode = { id: 'end', type: 'end', config: {} };

      notificationService.sendNotification.mockResolvedValue();

      const result = await workflowExecutor.processEndNode(mockExecution, endNode);

      expect(mockExecution.status).toBe('completed');
      expect(mockExecution.endTime).toBeDefined();
      expect(mockExecution.duration).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.message).toBe('Workflow execution completed successfully');

      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        recipient: 'user123',
        sender: 'user123',
        type: 'workflow_completed',
        title: 'Workflow Completed: undefined',
        message: 'Your workflow "undefined" has completed successfully.',
        priority: 'medium',
        data: {
          workflowExecutionId: 'exec123',
          workflowName: undefined,
          duration: expect.any(Number),
        },
        channels: {
          inApp: { sent: false, read: false },
          email: { sent: false },
          websocket: { sent: false },
        },
      });
    });
  });

  describe('Variable Replacement', () => {
    test('should replace variables in text', () => {
      const text = 'Hello {{name}}, your {{item}} is ready!';
      const variables = { name: 'John', item: 'order' };
      const context = { userId: 'user123' };

      const result = workflowExecutor.replaceVariables(text, variables, context);

      expect(result).toBe('Hello John, your order is ready!');
    });

    test('should replace context variables', () => {
      const text = 'User ID: {{context.userId}}, Status: {{status}}';
      const variables = { status: 'active' };
      const context = { userId: 'user123' };

      const result = workflowExecutor.replaceVariables(text, variables, context);

      expect(result).toBe('User ID: user123, Status: active');
    });

    test('should leave unreplaced variables as is', () => {
      const text = 'Hello {{name}}, your {{unknown}} is ready!';
      const variables = { name: 'John' };
      const context = {};

      const result = workflowExecutor.replaceVariables(text, variables, context);

      expect(result).toBe('Hello John, your {{unknown}} is ready!');
    });

    test('should handle non-string input', () => {
      const result = workflowExecutor.replaceVariables(123, {}, {});
      expect(result).toBe(123);
    });
  });

  describe('Condition Evaluation', () => {
    test('should evaluate equality conditions', () => {
      const variables = { status: 'active', count: '5' };
      const context = {};

      expect(workflowExecutor.evaluateCondition('active == active', variables, context)).toBe(true);
      expect(workflowExecutor.evaluateCondition('active == inactive', variables, context)).toBe(false);
    });

    test('should evaluate inequality conditions', () => {
      const variables = { status: 'active' };
      const context = {};

      expect(workflowExecutor.evaluateCondition('active != inactive', variables, context)).toBe(true);
      expect(workflowExecutor.evaluateCondition('active != active', variables, context)).toBe(false);
    });

    test('should evaluate numeric comparisons', () => {
      const variables = { count: '10' };
      const context = {};

      expect(workflowExecutor.evaluateCondition('10 > 5', variables, context)).toBe(true);
      expect(workflowExecutor.evaluateCondition('10 < 5', variables, context)).toBe(false);
    });

    test('should handle invalid conditions gracefully', () => {
      const result = workflowExecutor.evaluateCondition('invalid condition', {}, {});
      expect(result).toBe(true); // Default to true for unrecognized format
    });

    test('should handle condition evaluation errors', () => {
      jest.spyOn(workflowExecutor, 'replaceVariables').mockImplementation(() => {
        throw new Error('Variable replacement error');
      });

      const result = workflowExecutor.evaluateCondition('test condition', {}, {});
      expect(result).toBe(false);

      workflowExecutor.replaceVariables.mockRestore();
    });
  });

  describe('Error Handling', () => {
    test('should handle execution errors', async () => {
      const mockExecution = {
        _id: 'exec123',
        status: 'running',
        startTime: new Date(),
        errors: [],
        save: jest.fn().mockResolvedValue(),
        addLog: jest.fn().mockResolvedValue(),
        triggeredBy: 'user123',
      };

      WorkflowExecution.findById.mockResolvedValue(mockExecution);
      notificationService.sendNotification.mockResolvedValue();

      const error = new Error('Test execution error');
      await workflowExecutor.handleExecutionError('exec123', error);

      expect(mockExecution.status).toBe('failed');
      expect(mockExecution.endTime).toBeDefined();
      expect(mockExecution.errors).toHaveLength(1);
      expect(mockExecution.errors[0].error.message).toBe('Test execution error');

      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        recipient: 'user123',
        sender: 'user123',
        type: 'workflow_failed',
        title: 'Workflow Failed: undefined',
        message: 'Your workflow "undefined" has failed: Test execution error',
        priority: 'high',
        data: {
          workflowExecutionId: 'exec123',
          workflowName: undefined,
          error: 'Test execution error',
        },
        channels: {
          inApp: { sent: false, read: false },
          email: { sent: false },
          websocket: { sent: false },
        },
      });
    });

    test('should handle node errors with retry logic', async () => {
      const mockExecution = {
        _id: 'exec123',
        steps: [
          {
            nodeId: 'node1',
            status: 'running',
            startTime: new Date(),
            retryCount: 0,
          },
        ],
        save: jest.fn().mockResolvedValue(),
        addLog: jest.fn().mockResolvedValue(),
      };

      jest.spyOn(workflowExecutor, 'processNode').mockResolvedValue();
      jest.spyOn(global, 'setTimeout').mockImplementation((callback) => callback());

      const error = new Error('Node processing error');
      await workflowExecutor.handleNodeError(mockExecution, 'node1', error);

      const step = mockExecution.steps[0];
      expect(step.status).toBe('failed');
      expect(step.error.message).toBe('Node processing error');
      expect(step.retryCount).toBe(1);

      // Should schedule retry
      expect(setTimeout).toHaveBeenCalled();

      setTimeout.mockRestore();
    });

    test('should stop retrying after max attempts', async () => {
      const mockExecution = {
        _id: 'exec123',
        steps: [
          {
            nodeId: 'node1',
            status: 'running',
            startTime: new Date(),
            retryCount: 5, // Already at max retries
          },
        ],
        save: jest.fn().mockResolvedValue(),
        addLog: jest.fn().mockResolvedValue(),
      };

      const error = new Error('Node processing error');

      await expect(workflowExecutor.handleNodeError(mockExecution, 'node1', error))
        .rejects.toThrow('Node processing error');

      const step = mockExecution.steps[0];
      expect(step.status).toBe('failed');
      expect(step.retryCount).toBe(5); // Should not increment further
    });
  });

  describe('Execution Control', () => {
    test('should pause execution', async () => {
      const mockExecution = {
        _id: 'exec123',
        status: 'running',
        save: jest.fn().mockResolvedValue(),
        addLog: jest.fn().mockResolvedValue(),
      };

      WorkflowExecution.findById.mockResolvedValue(mockExecution);
      workflowExecutor.runningExecutions.set('exec123', mockExecution);

      const result = await workflowExecutor.pauseExecution('exec123');

      expect(result.status).toBe('paused');
      expect(mockExecution.status).toBe('paused');
      expect(workflowExecutor.runningExecutions.has('exec123')).toBe(false);
    });

    test('should resume execution', async () => {
      const mockExecution = {
        _id: 'exec123',
        status: 'paused',
        currentStep: 'node1',
        save: jest.fn().mockResolvedValue(),
        addLog: jest.fn().mockResolvedValue(),
      };

      WorkflowExecution.findById.mockResolvedValue(mockExecution);
      jest.spyOn(workflowExecutor, 'processNode').mockResolvedValue();

      const result = await workflowExecutor.resumeExecution('exec123');

      expect(result.status).toBe('resumed');
      expect(mockExecution.status).toBe('running');
      expect(workflowExecutor.processNode).toHaveBeenCalledWith(mockExecution, 'node1');
    });

    test('should cancel execution', async () => {
      const mockExecution = {
        _id: 'exec123',
        status: 'running',
        startTime: new Date(),
        isCompleted: () => false,
        save: jest.fn().mockResolvedValue(),
        addLog: jest.fn().mockResolvedValue(),
      };

      WorkflowExecution.findById.mockResolvedValue(mockExecution);
      workflowExecutor.runningExecutions.set('exec123', mockExecution);

      const result = await workflowExecutor.cancelExecution('exec123');

      expect(result.status).toBe('cancelled');
      expect(mockExecution.status).toBe('cancelled');
      expect(mockExecution.endTime).toBeDefined();
      expect(workflowExecutor.runningExecutions.has('exec123')).toBe(false);
    });

    test('should get execution status', async () => {
      const mockExecution = {
        _id: 'exec123',
        executionId: 'exec_123',
        status: 'running',
        progress: { percentage: 50 },
        currentStep: 'node1',
        startTime: new Date(),
        endTime: null,
        duration: null,
        errors: [],
        workflowTemplateId: { name: 'Test Template' },
        triggeredBy: { firstName: 'John', lastName: 'Doe' },
      };

      WorkflowExecution.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockExecution),
      });

      const result = await workflowExecutor.getExecutionStatus('exec123');

      expect(result.executionId).toBe('exec_123');
      expect(result.status).toBe('running');
      expect(result.progress).toEqual({ percentage: 50 });
      expect(result.currentStep).toBe('node1');
      expect(result.template).toEqual({ name: 'Test Template' });
    });
  });

  describe('Next Node Processing', () => {
    test('should process next nodes based on connections', async () => {
      const mockExecution = {
        _id: 'exec123',
        workflowTemplateId: {
          connections: [
            { source: 'node1', target: 'node2' },
            { source: 'node1', target: 'node3', condition: 'result == success' },
          ],
        },
        variables: {},
        context: {},
      };

      jest.spyOn(workflowExecutor, 'processNode').mockResolvedValue();
      jest.spyOn(workflowExecutor, 'evaluateCondition')
        .mockReturnValueOnce(true) // First connection has no condition, so not called
        .mockReturnValueOnce(true); // Second connection condition

      await workflowExecutor.processNextNodes(mockExecution, 'node1', { result: 'success' });

      expect(workflowExecutor.processNode).toHaveBeenCalledWith(mockExecution, 'node2');
      expect(workflowExecutor.processNode).toHaveBeenCalledWith(mockExecution, 'node3');
    });

    test('should skip nodes when conditions are not met', async () => {
      const mockExecution = {
        _id: 'exec123',
        workflowTemplateId: {
          connections: [
            { source: 'node1', target: 'node2', condition: 'result == success' },
          ],
        },
        variables: {},
        context: {},
      };

      jest.spyOn(workflowExecutor, 'processNode').mockResolvedValue();
      jest.spyOn(workflowExecutor, 'evaluateCondition').mockReturnValue(false);

      await workflowExecutor.processNextNodes(mockExecution, 'node1', { result: 'failure' });

      expect(workflowExecutor.processNode).not.toHaveBeenCalled();
    });
  });
});