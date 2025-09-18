const mongoose = require('mongoose');
const { adminUser, regularUser } = require('./users');

/**
 * Workflow Template factory function
 */
const createWorkflowTemplate = (createdBy, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  name: 'Test Workflow',
  description: 'Test workflow description',
  createdBy: createdBy?._id || createdBy || adminUser._id,
  isPublic: false,
  category: 'general',
  nodes: [],
  edges: [],
  variables: [],
  version: 1,
  isActive: true,
  sharedWith: [],
  createdAt: new Date('2025-09-18T10:00:00Z'),
  ...overrides,
});

/**
 * Workflow Execution factory function
 */
const createWorkflowExecution = (templateId, triggeredBy, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  workflowTemplateId: templateId || new mongoose.Types.ObjectId(),
  templateVersion: 1,
  executionId: `exec_${new mongoose.Types.ObjectId()}`,
  triggeredBy: triggeredBy?._id || triggeredBy || regularUser._id,
  status: 'pending',
  triggerType: 'manual',
  steps: [],
  variables: {},
  context: {},
  results: {},
  logs: [],
  errors: [],
  notifications: [],
  artifacts: [],
  startedAt: new Date('2025-09-18T10:00:00Z'),
  ...overrides,
});

/**
 * Predefined workflow fixtures
 */
const simpleWorkflowTemplate = createWorkflowTemplate(adminUser._id, {
  name: 'Simple Workflow',
  nodes: [
    {
      id: 'start',
      type: 'start',
      position: { x: 0, y: 0 },
    },
    {
      id: 'task',
      type: 'task',
      position: { x: 200, y: 0 },
      data: {
        title: 'Test Task',
        description: 'Test task description',
      },
    },
    {
      id: 'end',
      type: 'end',
      position: { x: 400, y: 0 },
    },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'task' },
    { id: 'e2', source: 'task', target: 'end' },
  ],
});

const complexWorkflowTemplate = createWorkflowTemplate(adminUser._id, {
  name: 'Complex Workflow',
  nodes: [
    {
      id: 'start',
      type: 'start',
      position: { x: 0, y: 0 },
    },
    {
      id: 'condition',
      type: 'condition',
      position: { x: 200, y: 0 },
      data: {
        condition: '{{priority === "high"}}',
      },
    },
    {
      id: 'approval',
      type: 'approval',
      position: { x: 400, y: -100 },
      data: {
        approvers: [adminUser._id],
      },
    },
    {
      id: 'task',
      type: 'task',
      position: { x: 400, y: 100 },
      data: {
        title: 'Regular Task',
      },
    },
    {
      id: 'end',
      type: 'end',
      position: { x: 600, y: 0 },
    },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'condition' },
    { id: 'e2', source: 'condition', target: 'approval', label: 'yes' },
    { id: 'e3', source: 'condition', target: 'task', label: 'no' },
    { id: 'e4', source: 'approval', target: 'end' },
    { id: 'e5', source: 'task', target: 'end' },
  ],
});

const workflowExecution = createWorkflowExecution(simpleWorkflowTemplate._id, regularUser._id, {
  status: 'running',
  steps: [
    {
      nodeId: 'start',
      status: 'completed',
      startedAt: new Date('2025-09-18T10:00:00Z'),
      completedAt: new Date('2025-09-18T10:00:01Z'),
    },
    {
      nodeId: 'task',
      status: 'running',
      startedAt: new Date('2025-09-18T10:00:02Z'),
    },
  ],
  logs: [
    {
      level: 'info',
      message: 'Workflow started',
      timestamp: new Date('2025-09-18T10:00:00Z'),
    },
  ],
});

const completedWorkflowExecution = createWorkflowExecution(simpleWorkflowTemplate._id, regularUser._id, {
  status: 'completed',
  steps: [
    {
      nodeId: 'start',
      status: 'completed',
      startedAt: new Date('2025-09-18T10:00:00Z'),
      completedAt: new Date('2025-09-18T10:00:01Z'),
    },
    {
      nodeId: 'task',
      status: 'completed',
      startedAt: new Date('2025-09-18T10:00:02Z'),
      completedAt: new Date('2025-09-18T10:00:10Z'),
    },
    {
      nodeId: 'end',
      status: 'completed',
      startedAt: new Date('2025-09-18T10:00:11Z'),
      completedAt: new Date('2025-09-18T10:00:12Z'),
    },
  ],
  completedAt: new Date('2025-09-18T10:00:12Z'),
});

// Additional workflow templates for comprehensive testing
const approvalWorkflowTemplate = createWorkflowTemplate(adminUser._id, {
  name: 'Approval Workflow',
  description: 'Workflow requiring multiple approvals',
  category: 'approval',
  nodes: [
    {
      id: 'start',
      type: 'start',
      position: { x: 0, y: 0 },
      config: {},
    },
    {
      id: 'request_approval',
      type: 'approval',
      position: { x: 200, y: 0 },
      config: {
        title: 'Manager Approval Required',
        message: 'Please review and approve this request',
        approver: adminUser._id,
        priority: 'high',
        timeout: 24 * 60 * 60 * 1000, // 24 hours
      },
    },
    {
      id: 'create_task',
      type: 'task',
      position: { x: 400, y: 0 },
      config: {
        title: 'Approved Task: {{requestTitle}}',
        description: 'Task created after approval: {{requestDescription}}',
        priority: '{{requestPriority}}',
        project: 'Approved Requests',
        assignedTo: '{{requestAssignee}}',
      },
    },
    {
      id: 'send_notification',
      type: 'email',
      position: { x: 600, y: 0 },
      config: {
        recipient: '{{requestAssignee}}',
        subject: 'Request Approved: {{requestTitle}}',
        body: 'Your request "{{requestTitle}}" has been approved and a task has been created.',
        priority: 'medium',
      },
    },
    {
      id: 'end',
      type: 'end',
      position: { x: 800, y: 0 },
      config: {},
    },
  ],
  connections: [
    { source: 'start', target: 'request_approval' },
    { source: 'request_approval', target: 'create_task', condition: 'approved == true' },
    { source: 'create_task', target: 'send_notification' },
    { source: 'send_notification', target: 'end' },
  ],
  variables: [
    { name: 'requestTitle', type: 'string', required: true },
    { name: 'requestDescription', type: 'string', required: true },
    { name: 'requestPriority', type: 'string', default: 'medium' },
    { name: 'requestAssignee', type: 'string', required: true },
  ],
});

const dataProcessingWorkflowTemplate = createWorkflowTemplate(adminUser._id, {
  name: 'Data Processing Workflow',
  description: 'Workflow for processing and validating data',
  category: 'data_processing',
  nodes: [
    {
      id: 'start',
      type: 'start',
      position: { x: 0, y: 0 },
      config: {},
    },
    {
      id: 'validate_data',
      type: 'api_call',
      position: { x: 200, y: 0 },
      config: {
        url: 'https://api.example.com/validate',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { data: '{{inputData}}' },
        timeout: 30000,
      },
    },
    {
      id: 'check_validation',
      type: 'condition',
      position: { x: 400, y: 0 },
      config: {
        condition: '{{validationResult.valid}} == true',
      },
    },
    {
      id: 'process_data',
      type: 'api_call',
      position: { x: 600, y: -100 },
      config: {
        url: 'https://api.example.com/process',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { data: '{{inputData}}' },
      },
    },
    {
      id: 'handle_error',
      type: 'email',
      position: { x: 600, y: 100 },
      config: {
        recipient: adminUser._id,
        subject: 'Data Validation Failed',
        body: 'Data validation failed for: {{inputData}}. Error: {{validationResult.error}}',
        priority: 'high',
      },
    },
    {
      id: 'delay_retry',
      type: 'delay',
      position: { x: 800, y: 100 },
      config: {
        duration: 5 * 60 * 1000, // 5 minutes
      },
    },
    {
      id: 'end_success',
      type: 'end',
      position: { x: 800, y: -100 },
      config: {},
    },
    {
      id: 'end_error',
      type: 'end',
      position: { x: 1000, y: 100 },
      config: {},
    },
  ],
  connections: [
    { source: 'start', target: 'validate_data' },
    { source: 'validate_data', target: 'check_validation' },
    { source: 'check_validation', target: 'process_data', condition: 'valid == true' },
    { source: 'check_validation', target: 'handle_error', condition: 'valid == false' },
    { source: 'process_data', target: 'end_success' },
    { source: 'handle_error', target: 'delay_retry' },
    { source: 'delay_retry', target: 'end_error' },
  ],
});

const integrationWorkflowTemplate = createWorkflowTemplate(adminUser._id, {
  name: 'Integration Workflow',
  description: 'Workflow integrating multiple external services',
  category: 'integration',
  nodes: [
    {
      id: 'start',
      type: 'start',
      position: { x: 0, y: 0 },
      config: {},
    },
    {
      id: 'create_jira_ticket',
      type: 'api_call',
      position: { x: 200, y: 0 },
      config: {
        url: 'https://company.atlassian.net/rest/api/2/issue',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer {{jiraToken}}',
          'Content-Type': 'application/json',
        },
        body: {
          fields: {
            project: { key: '{{jiraProject}}' },
            summary: '{{taskTitle}}',
            description: '{{taskDescription}}',
            issuetype: { name: 'Task' },
            priority: { name: '{{taskPriority}}' },
          },
        },
      },
    },
    {
      id: 'send_slack_notification',
      type: 'api_call',
      position: { x: 400, y: 0 },
      config: {
        url: '{{slackWebhookUrl}}',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          text: 'New Jira ticket created: {{jiraTicketKey}}',
          channel: '#development',
          username: 'Workflow Bot',
          icon_emoji: ':robot_face:',
        },
      },
    },
    {
      id: 'create_internal_task',
      type: 'task',
      position: { x: 600, y: 0 },
      config: {
        title: '{{taskTitle}}',
        description: '{{taskDescription}} (Jira: {{jiraTicketKey}})',
        priority: '{{taskPriority}}',
        project: 'External Integration',
        assignedTo: '{{taskAssignee}}',
        tags: ['jira', 'integration'],
      },
    },
    {
      id: 'end',
      type: 'end',
      position: { x: 800, y: 0 },
      config: {},
    },
  ],
  connections: [
    { source: 'start', target: 'create_jira_ticket' },
    { source: 'create_jira_ticket', target: 'send_slack_notification' },
    { source: 'send_slack_notification', target: 'create_internal_task' },
    { source: 'create_internal_task', target: 'end' },
  ],
});

// Workflow execution fixtures for different scenarios
const pendingWorkflowExecution = createWorkflowExecution(approvalWorkflowTemplate._id, regularUser._id, {
  name: 'Pending Approval Execution',
  status: 'pending',
  variables: {
    requestTitle: 'New Feature Request',
    requestDescription: 'Add user authentication feature',
    requestPriority: 'high',
    requestAssignee: regularUser._id,
  },
  context: {
    userId: regularUser._id,
    userEmail: 'user@example.com',
    executionTime: new Date('2025-09-18T10:00:00Z'),
  },
  steps: [],
});

const runningWorkflowExecution = createWorkflowExecution(dataProcessingWorkflowTemplate._id, regularUser._id, {
  name: 'Data Processing Execution',
  status: 'running',
  currentStep: 'validate_data',
  variables: {
    inputData: { records: [{ id: 1, name: 'Test' }] },
  },
  steps: [
    {
      nodeId: 'start',
      nodeType: 'start',
      status: 'completed',
      startTime: new Date('2025-09-18T10:00:00Z'),
      endTime: new Date('2025-09-18T10:00:01Z'),
      duration: 1000,
      input: null,
      output: { message: 'Workflow started' },
      logs: [
        {
          timestamp: new Date('2025-09-18T10:00:00Z'),
          level: 'info',
          message: 'Starting workflow execution',
        },
      ],
    },
    {
      nodeId: 'validate_data',
      nodeType: 'api_call',
      status: 'running',
      startTime: new Date('2025-09-18T10:00:02Z'),
      input: { data: { records: [{ id: 1, name: 'Test' }] } },
      retryCount: 0,
      logs: [
        {
          timestamp: new Date('2025-09-18T10:00:02Z'),
          level: 'info',
          message: 'Making API call to validation service',
        },
      ],
    },
  ],
  progress: {
    totalSteps: 8,
    completedSteps: 1,
    failedSteps: 0,
    percentage: 12.5,
  },
  logs: [
    {
      timestamp: new Date('2025-09-18T10:00:00Z'),
      level: 'info',
      message: 'Workflow execution started',
      data: { templateId: dataProcessingWorkflowTemplate._id },
    },
  ],
});

const failedWorkflowExecution = createWorkflowExecution(integrationWorkflowTemplate._id, regularUser._id, {
  name: 'Failed Integration Execution',
  status: 'failed',
  variables: {
    taskTitle: 'Integration Task',
    taskDescription: 'Test integration workflow',
    taskPriority: 'medium',
    jiraProject: 'TEST',
    jiraToken: 'invalid-token',
  },
  steps: [
    {
      nodeId: 'start',
      nodeType: 'start',
      status: 'completed',
      startTime: new Date('2025-09-18T10:00:00Z'),
      endTime: new Date('2025-09-18T10:00:01Z'),
      duration: 1000,
      output: { message: 'Workflow started' },
    },
    {
      nodeId: 'create_jira_ticket',
      nodeType: 'api_call',
      status: 'failed',
      startTime: new Date('2025-09-18T10:00:02Z'),
      endTime: new Date('2025-09-18T10:00:05Z'),
      duration: 3000,
      error: {
        message: 'Authentication failed',
        code: 'JIRA_AUTH_ERROR',
        stack: 'Error: Authentication failed\n    at ...',
      },
      retryCount: 3,
    },
  ],
  errors: [
    {
      nodeId: 'create_jira_ticket',
      timestamp: new Date('2025-09-18T10:00:05Z'),
      error: {
        message: 'Authentication failed',
        code: 'JIRA_AUTH_ERROR',
      },
      resolved: false,
    },
  ],
  endTime: new Date('2025-09-18T10:00:05Z'),
  duration: 5000,
});

const pausedWorkflowExecution = createWorkflowExecution(approvalWorkflowTemplate._id, regularUser._id, {
  name: 'Paused Approval Execution',
  status: 'paused',
  currentStep: 'request_approval',
  variables: {
    requestTitle: 'Budget Approval Request',
    requestDescription: 'Request approval for additional budget',
    requestPriority: 'high',
    requestAssignee: regularUser._id,
  },
  steps: [
    {
      nodeId: 'start',
      nodeType: 'start',
      status: 'completed',
      startTime: new Date('2025-09-18T10:00:00Z'),
      endTime: new Date('2025-09-18T10:00:01Z'),
      duration: 1000,
      output: { message: 'Workflow started' },
    },
    {
      nodeId: 'request_approval',
      nodeType: 'approval',
      status: 'waiting_approval',
      startTime: new Date('2025-09-18T10:00:02Z'),
      assignedTo: adminUser._id,
      approvals: [],
      logs: [
        {
          timestamp: new Date('2025-09-18T10:00:02Z'),
          level: 'info',
          message: 'Approval request sent to manager',
        },
      ],
    },
  ],
});

// Workflow execution with complex branching
const branchingWorkflowExecution = createWorkflowExecution(complexWorkflowTemplate._id, regularUser._id, {
  name: 'Complex Branching Execution',
  status: 'completed',
  variables: {
    priority: 'high',
    taskTitle: 'High Priority Task',
  },
  steps: [
    {
      nodeId: 'start',
      nodeType: 'start',
      status: 'completed',
      startTime: new Date('2025-09-18T10:00:00Z'),
      endTime: new Date('2025-09-18T10:00:01Z'),
      duration: 1000,
      output: { message: 'Workflow started' },
    },
    {
      nodeId: 'condition',
      nodeType: 'condition',
      status: 'completed',
      startTime: new Date('2025-09-18T10:00:02Z'),
      endTime: new Date('2025-09-18T10:00:03Z'),
      duration: 1000,
      input: { priority: 'high' },
      output: { result: true, condition: 'priority === "high"' },
    },
    {
      nodeId: 'approval',
      nodeType: 'approval',
      status: 'completed',
      startTime: new Date('2025-09-18T10:00:04Z'),
      endTime: new Date('2025-09-18T10:00:30Z'),
      duration: 26000,
      assignedTo: adminUser._id,
      approvals: [
        {
          userId: adminUser._id,
          status: 'approved',
          comment: 'Approved for high priority',
          timestamp: new Date('2025-09-18T10:00:30Z'),
        },
      ],
    },
    {
      nodeId: 'end',
      nodeType: 'end',
      status: 'completed',
      startTime: new Date('2025-09-18T10:00:31Z'),
      endTime: new Date('2025-09-18T10:00:32Z'),
      duration: 1000,
      output: { message: 'Workflow completed successfully' },
    },
  ],
  progress: {
    totalSteps: 5,
    completedSteps: 4,
    failedSteps: 0,
    percentage: 100,
  },
  endTime: new Date('2025-09-18T10:00:32Z'),
  duration: 32000,
});

// Error scenarios for testing
const errorScenarios = {
  invalidTemplate: createWorkflowTemplate(adminUser._id, {
    name: 'Invalid Workflow',
    nodes: [
      { id: 'start', type: 'start' },
      // Missing end node
    ],
    connections: [
      { source: 'start', target: 'nonexistent' }, // Invalid connection
    ],
  }),
  
  circularDependency: createWorkflowTemplate(adminUser._id, {
    name: 'Circular Dependency Workflow',
    nodes: [
      { id: 'node1', type: 'task' },
      { id: 'node2', type: 'task' },
      { id: 'node3', type: 'task' },
    ],
    connections: [
      { source: 'node1', target: 'node2' },
      { source: 'node2', target: 'node3' },
      { source: 'node3', target: 'node1' }, // Creates circular dependency
    ],
  }),
  
  timeoutExecution: createWorkflowExecution(dataProcessingWorkflowTemplate._id, regularUser._id, {
    name: 'Timeout Execution',
    status: 'failed',
    errors: [
      {
        nodeId: 'validate_data',
        timestamp: new Date('2025-09-18T10:05:00Z'),
        error: {
          message: 'Request timeout',
          code: 'TIMEOUT_ERROR',
        },
      },
    ],
  }),
};

module.exports = {
  createWorkflowTemplate,
  createWorkflowExecution,
  simpleWorkflowTemplate,
  complexWorkflowTemplate,
  approvalWorkflowTemplate,
  dataProcessingWorkflowTemplate,
  integrationWorkflowTemplate,
  workflowExecution,
  completedWorkflowExecution,
  pendingWorkflowExecution,
  runningWorkflowExecution,
  failedWorkflowExecution,
  pausedWorkflowExecution,
  branchingWorkflowExecution,
  errorScenarios,
};