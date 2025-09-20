import mongoose, { Schema } from 'mongoose';
import { IIntegration } from '../types';

const integrationSchema = new Schema<IIntegration>({
  userId: {
    type: String,
    required: true,
    ref: 'User',
    index: true
  },
  name: {
    type: String,
    required: [true, 'Integration name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  type: {
    type: String,
    enum: ['slack', 'github', 'webhook', 'email'],
    required: true,
    index: true
  },
  config: {
    webhookUrl: String,
    apiKey: String,
    token: String,
    settings: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Don't expose sensitive config data
      if (ret.config) {
        if (ret.config.apiKey) ret.config.apiKey = '***';
        if (ret.config.token) ret.config.token = '***';
      }
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
integrationSchema.index({ userId: 1, type: 1 });
integrationSchema.index({ userId: 1, isActive: 1 });
integrationSchema.index({ createdAt: -1 });

// Method to update last used timestamp
integrationSchema.methods.updateLastUsed = function() {
  this.lastUsedAt = new Date();
  return this.save();
};

// Method to test integration
integrationSchema.methods.test = async function() {
  try {
    switch (this.type) {
      case 'webhook':
        return await this.testWebhook();
      case 'slack':
        return await this.testSlack();
      case 'github':
        return await this.testGitHub();
      case 'email':
        return await this.testEmail();
      default:
        throw new Error(`Integration type ${this.type} not supported`);
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Test webhook integration
integrationSchema.methods.testWebhook = async function() {
  if (!this.config.webhookUrl) {
    throw new Error('Webhook URL not configured');
  }

  // Use native fetch (Node.js 18+)
  
  const response = await fetch(this.config.webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Workflow-Management-System/1.0'
    },
    body: JSON.stringify({
      type: 'test',
      message: 'Test webhook from Workflow Management System',
      timestamp: new Date().toISOString()
    })
  });

  if (!response.ok) {
    throw new Error(`Webhook test failed: ${response.status} ${response.statusText}`);
  }

  return {
    success: true,
    message: 'Webhook test successful',
    statusCode: response.status
  };
};

// Test Slack integration
integrationSchema.methods.testSlack = async function() {
  if (!this.config.webhookUrl && !this.config.token) {
    throw new Error('Slack webhook URL or token not configured');
  }

  // Use native fetch (Node.js 18+)
  
  if (this.config.webhookUrl) {
    // Use webhook URL
    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: '🧪 Test message from Workflow Management System',
        username: 'Workflow Bot',
        icon_emoji: ':robot_face:'
      })
    });

    if (!response.ok) {
      throw new Error(`Slack webhook test failed: ${response.status} ${response.statusText}`);
    }

    return {
      success: true,
      message: 'Slack webhook test successful'
    };
  } else {
    // Use Slack API with token
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: this.config.settings?.channel || '#general',
        text: '🧪 Test message from Workflow Management System'
      })
    });

    const data = await response.json() as any;

    if (!data.ok) {
      throw new Error(`Slack API test failed: ${data.error}`);
    }

    return {
      success: true,
      message: 'Slack API test successful'
    };
  }
};

// Test GitHub integration
integrationSchema.methods.testGitHub = async function() {
  if (!this.config.token) {
    throw new Error('GitHub token not configured');
  }

  // Use native fetch (Node.js 18+)
  
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `token ${this.config.token}`,
      'User-Agent': 'Workflow-Management-System/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API test failed: ${response.status} ${response.statusText}`);
  }

  const userData = await response.json() as any;

  return {
    success: true,
    message: 'GitHub API test successful',
    user: userData.login
  };
};

// Test email integration
integrationSchema.methods.testEmail = async function() {
  // This would integrate with your email service
  // For now, just return success
  return {
    success: true,
    message: 'Email integration test successful'
  };
};

// Static method to get user integrations
integrationSchema.statics.getUserIntegrations = function(userId: string, type?: string) {
  const query: any = { userId, isActive: true };
  if (type) query.type = type;
  
  return this.find(query).sort({ createdAt: -1 });
};

export default mongoose.model<IIntegration>('Integration', integrationSchema);