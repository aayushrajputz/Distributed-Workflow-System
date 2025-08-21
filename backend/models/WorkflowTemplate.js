const mongoose = require('mongoose');

const workflowNodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: ['start', 'task', 'condition', 'parallel', 'merge', 'end', 'api_call', 'email', 'delay', 'approval']
  },
  label: { type: String, required: true },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  data: {
    // Task-specific data
    taskType: String,
    assignee: String,
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    estimatedHours: Number,
    description: String,
    
    // Condition-specific data
    conditionType: { type: String, enum: ['if_then', 'switch', 'loop'] },
    conditions: [{
      field: String,
      operator: { type: String, enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains'] },
      value: mongoose.Schema.Types.Mixed,
      nextNodeId: String
    }],
    
    // API call data
    apiEndpoint: String,
    httpMethod: { type: String, enum: ['GET', 'POST', 'PUT', 'DELETE'] },
    headers: mongoose.Schema.Types.Mixed,
    payload: mongoose.Schema.Types.Mixed,
    
    // Email data
    emailTemplate: String,
    recipients: [String],
    subject: String,
    
    // Delay data
    delayAmount: Number,
    delayUnit: { type: String, enum: ['minutes', 'hours', 'days'] },
    
    // Approval data
    approvers: [String],
    approvalType: { type: String, enum: ['any', 'all', 'majority'] }
  },
  style: {
    backgroundColor: String,
    borderColor: String,
    textColor: String,
    width: Number,
    height: Number
  }
});

const workflowConnectionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  sourceHandle: String,
  targetHandle: String,
  label: String,
  type: { type: String, default: 'default' },
  animated: { type: Boolean, default: false },
  style: {
    stroke: String,
    strokeWidth: Number,
    strokeDasharray: String
  },
  conditions: [{
    field: String,
    operator: String,
    value: mongoose.Schema.Types.Mixed
  }]
});

const workflowTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  category: { 
    type: String, 
    enum: ['general', 'approval', 'data_processing', 'notification', 'integration', 'custom'],
    default: 'general'
  },
  version: { type: String, default: '1.0.0' },
  isPublic: { type: Boolean, default: false },
  
  // Visual workflow definition
  nodes: [workflowNodeSchema],
  connections: [workflowConnectionSchema],
  
  // Workflow metadata
  variables: [{
    name: String,
    type: { type: String, enum: ['string', 'number', 'boolean', 'date', 'array', 'object'] },
    defaultValue: mongoose.Schema.Types.Mixed,
    required: { type: Boolean, default: false },
    description: String
  }],
  
  // Execution settings
  settings: {
    maxExecutionTime: { type: Number, default: 3600 }, // seconds
    retryPolicy: {
      enabled: { type: Boolean, default: true },
      maxRetries: { type: Number, default: 3 },
      retryDelay: { type: Number, default: 60 } // seconds
    },
    errorHandling: {
      onError: { type: String, enum: ['stop', 'continue', 'retry'], default: 'stop' },
      notifyOnError: { type: Boolean, default: true }
    },
    parallelExecution: { type: Boolean, default: false },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
  },
  
  // Access control
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sharedWith: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    permission: { type: String, enum: ['view', 'edit', 'execute'], default: 'view' }
  }],
  
  // Usage statistics
  stats: {
    timesUsed: { type: Number, default: 0 },
    successRate: { type: Number, default: 0 },
    avgExecutionTime: { type: Number, default: 0 },
    lastUsed: Date
  },
  
  // Tags for organization
  tags: [String],
  
  // Validation rules
  validationRules: [{
    field: String,
    rule: String,
    message: String
  }]
}, {
  timestamps: true
});

// Indexes for performance
workflowTemplateSchema.index({ createdBy: 1, category: 1 });
workflowTemplateSchema.index({ name: 'text', description: 'text', tags: 'text' });
workflowTemplateSchema.index({ isPublic: 1, category: 1 });

// Methods
workflowTemplateSchema.methods.validateWorkflow = function() {
  const errors = [];
  
  // Check for start and end nodes
  const startNodes = this.nodes.filter(node => node.type === 'start');
  const endNodes = this.nodes.filter(node => node.type === 'end');
  
  if (startNodes.length === 0) {
    errors.push('Workflow must have at least one start node');
  }
  if (endNodes.length === 0) {
    errors.push('Workflow must have at least one end node');
  }
  
  // Check for orphaned nodes
  const connectedNodeIds = new Set();
  this.connections.forEach(conn => {
    connectedNodeIds.add(conn.source);
    connectedNodeIds.add(conn.target);
  });
  
  const orphanedNodes = this.nodes.filter(node => 
    node.type !== 'start' && !connectedNodeIds.has(node.id)
  );
  
  if (orphanedNodes.length > 0) {
    errors.push(`Orphaned nodes found: ${orphanedNodes.map(n => n.label).join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

workflowTemplateSchema.methods.incrementUsage = function() {
  this.stats.timesUsed += 1;
  this.stats.lastUsed = new Date();
  return this.save();
};

module.exports = mongoose.model('WorkflowTemplate', workflowTemplateSchema);
