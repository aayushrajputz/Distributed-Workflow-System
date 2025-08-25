const mongoose = require('mongoose');

const executionStepSchema = new mongoose.Schema({
  nodeId: { type: String, required: true },
  nodeType: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'skipped', 'waiting_approval'],
    default: 'pending',
  },
  startTime: Date,
  endTime: Date,
  duration: Number, // milliseconds
  input: mongoose.Schema.Types.Mixed,
  output: mongoose.Schema.Types.Mixed,
  error: {
    message: String,
    stack: String,
    code: String,
  },
  retryCount: { type: Number, default: 0 },
  logs: [{
    timestamp: { type: Date, default: Date.now },
    level: { type: String, enum: ['info', 'warn', 'error', 'debug'] },
    message: String,
    data: mongoose.Schema.Types.Mixed,
  }],
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvals: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'] },
    comment: String,
    timestamp: { type: Date, default: Date.now },
  }],
});

const workflowExecutionSchema = new mongoose.Schema({
  workflowTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkflowTemplate',
    required: true,
  },
  templateVersion: { type: String, required: true },

  // Execution metadata
  executionId: { type: String, unique: true, required: true },
  name: String,
  description: String,

  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled', 'paused'],
    default: 'pending',
  },

  // Timing
  startTime: Date,
  endTime: Date,
  duration: Number, // milliseconds
  estimatedDuration: Number, // milliseconds

  // Execution context
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  triggerType: {
    type: String,
    enum: ['manual', 'scheduled', 'webhook', 'api', 'event'],
    default: 'manual',
  },
  triggerData: mongoose.Schema.Types.Mixed,

  // Input variables and context
  variables: mongoose.Schema.Types.Mixed,
  context: mongoose.Schema.Types.Mixed,

  // Execution steps
  steps: [executionStepSchema],
  currentStep: String, // nodeId of current step

  // Progress tracking
  progress: {
    totalSteps: { type: Number, default: 0 },
    completedSteps: { type: Number, default: 0 },
    failedSteps: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
  },

  // Error handling
  errors: [{
    nodeId: String,
    timestamp: { type: Date, default: Date.now },
    error: {
      message: String,
      stack: String,
      code: String,
    },
    resolved: { type: Boolean, default: false },
  }],

  // Execution logs
  logs: [{
    timestamp: { type: Date, default: Date.now },
    level: { type: String, enum: ['info', 'warn', 'error', 'debug'] },
    message: String,
    nodeId: String,
    data: mongoose.Schema.Types.Mixed,
  }],

  // Results and outputs
  results: mongoose.Schema.Types.Mixed,
  artifacts: [{
    name: String,
    type: String,
    url: String,
    size: Number,
    createdAt: { type: Date, default: Date.now },
  }],

  // Notifications
  notifications: [{
    type: { type: String, enum: ['email', 'slack', 'webhook', 'in_app'] },
    recipient: String,
    status: { type: String, enum: ['pending', 'sent', 'failed'] },
    sentAt: Date,
    error: String,
  }],

  // Scheduling (for recurring workflows)
  schedule: {
    enabled: { type: Boolean, default: false },
    cron: String,
    timezone: String,
    nextRun: Date,
    lastRun: Date,
  },

  // Performance metrics
  metrics: {
    cpuUsage: Number,
    memoryUsage: Number,
    networkIO: Number,
    diskIO: Number,
  },

  // Parent/child relationships for sub-workflows
  parentExecutionId: String,
  childExecutions: [String],

  // Tags and metadata
  tags: [String],
  metadata: mongoose.Schema.Types.Mixed,
}, {
  timestamps: true,
});

// Indexes for performance
workflowExecutionSchema.index({ workflowTemplateId: 1, status: 1 });
workflowExecutionSchema.index({ triggeredBy: 1, createdAt: -1 });
workflowExecutionSchema.index({ executionId: 1 });
workflowExecutionSchema.index({ status: 1, createdAt: -1 });
workflowExecutionSchema.index({ 'schedule.enabled': 1, 'schedule.nextRun': 1 });

// Methods
workflowExecutionSchema.methods.updateProgress = function () {
  const totalSteps = this.steps.length;
  const completedSteps = this.steps.filter((step) => step.status === 'completed').length;
  const failedSteps = this.steps.filter((step) => step.status === 'failed').length;

  this.progress = {
    totalSteps,
    completedSteps,
    failedSteps,
    percentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
  };

  return this.save();
};

workflowExecutionSchema.methods.addLog = function (level, message, nodeId = null, data = null) {
  this.logs.push({
    level,
    message,
    nodeId,
    data,
    timestamp: new Date(),
  });

  return this.save();
};

workflowExecutionSchema.methods.updateStepStatus = function (nodeId, status, output = null, error = null) {
  const step = this.steps.find((s) => s.nodeId === nodeId);
  if (step) {
    step.status = status;
    step.endTime = new Date();
    step.duration = step.startTime ? step.endTime - step.startTime : 0;

    if (output) step.output = output;
    if (error) step.error = error;

    this.updateProgress();
  }

  return this.save();
};

workflowExecutionSchema.methods.canExecute = function () {
  return ['pending', 'paused'].includes(this.status);
};

workflowExecutionSchema.methods.isCompleted = function () {
  return ['completed', 'failed', 'cancelled'].includes(this.status);
};

// Static methods
workflowExecutionSchema.statics.generateExecutionId = function () {
  return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

module.exports = mongoose.model('WorkflowExecution', workflowExecutionSchema);
