import mongoose, { Schema } from 'mongoose';
import { IWorkflow } from '../types';

const workflowSchema = new Schema<IWorkflow>({
  name: {
    type: String,
    required: [true, 'Workflow name is required'],
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed', 'failed'],
    default: 'draft'
  },
  owner: {
    type: String,
    required: true,
    ref: 'User'
  },
  nodes: [{
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['start', 'end', 'task', 'email', 'api_call', 'condition', 'delay', 'approval'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending'
    },
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true }
    },
    config: {
      type: Schema.Types.Mixed,
      default: {}
    }
  }],
  edges: [{
    id: {
      type: String,
      required: true
    },
    source: {
      type: String,
      required: true
    },
    target: {
      type: String,
      required: true
    },
    condition: String
  }],
  variables: {
    type: Schema.Types.Mixed,
    default: {}
  },
  isTemplate: {
    type: Boolean,
    default: false
  },
  templateId: {
    type: String,
    ref: 'Workflow'
  },
  executionHistory: [{
    executionId: {
      type: String,
      required: true
    },
    startedAt: {
      type: Date,
      required: true
    },
    completedAt: Date,
    status: {
      type: String,
      enum: ['running', 'completed', 'failed'],
      required: true
    },
    variables: {
      type: Schema.Types.Mixed,
      default: {}
    }
  }]
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
workflowSchema.index({ owner: 1 });
workflowSchema.index({ status: 1 });
workflowSchema.index({ isTemplate: 1 });
workflowSchema.index({ templateId: 1 });
workflowSchema.index({ createdAt: -1 });
workflowSchema.index({ updatedAt: -1 });

// Compound indexes
workflowSchema.index({ owner: 1, status: 1 });
workflowSchema.index({ owner: 1, isTemplate: 1 });

// Virtual for node count
workflowSchema.virtual('nodeCount').get(function() {
  return this.nodes ? this.nodes.length : 0;
});

// Method to add execution record
workflowSchema.methods.addExecution = function(executionData: any) {
  this.executionHistory.push({
    executionId: executionData.executionId || `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    startedAt: new Date(),
    status: 'running',
    variables: executionData.variables || {}
  });
  return this.save();
};

// Method to update execution status
workflowSchema.methods.updateExecution = function(executionId: string, updates: any) {
  const execution = this.executionHistory.find((exec: any) => exec.executionId === executionId);
  if (execution) {
    Object.assign(execution, updates);
    if (updates.status === 'completed' || updates.status === 'failed') {
      execution.completedAt = new Date();
    }
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to get workflow statistics
workflowSchema.statics.getStats = async function(filters: any = {}) {
  const pipeline = [
    { $match: filters },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        paused: { $sum: { $cond: [{ $eq: ['$status', 'paused'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        templates: { $sum: { $cond: ['$isTemplate', 1, 0] } },
        avgNodes: { $avg: { $size: '$nodes' } }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    total: 0,
    draft: 0,
    active: 0,
    paused: 0,
    completed: 0,
    failed: 0,
    templates: 0,
    avgNodes: 0
  };
};

export default mongoose.model<IWorkflow>('Workflow', workflowSchema);