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

module.exports = {
  createWorkflowTemplate,
  createWorkflowExecution,
  simpleWorkflowTemplate,
  complexWorkflowTemplate,
  workflowExecution,
  completedWorkflowExecution,
};