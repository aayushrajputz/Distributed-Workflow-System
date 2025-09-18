const WorkflowExecution = require('../models/WorkflowExecution');
const WorkflowTemplate = require('../models/WorkflowTemplate');
const Task = require('../models/Task');
const User = require('../models/User');
const notificationService = require('./notificationService');
const workflowEngine = require('./workflowEngine');

class WorkflowExecutor {
  constructor() {
    this.runningExecutions = new Map();
    this.maxConcurrentExecutions = process.env.MAX_CONCURRENT_WORKFLOWS || 10;
    this.retryDelays = [1000, 5000, 15000, 30000, 60000]; // Exponential backoff
  }

  /**
   * Start execution of a workflow
   * @param {string} executionId - The workflow execution ID
   */
  async startExecution(executionId) {
    try {
      const execution = await WorkflowExecution.findById(executionId)
        .populate('workflowTemplateId')
        .populate('triggeredBy');

      if (!execution) {
        throw new Error(`Workflow execution ${executionId} not found`);
      }

      if (!execution.canExecute()) {
        throw new Error(`Workflow execution ${executionId} cannot be executed (status: ${execution.status})`);
      }

      // Check concurrent execution limit
      if (this.runningExecutions.size >= this.maxConcurrentExecutions) {
        await execution.addLog('warn', 'Execution queued due to concurrent execution limit');
        return { status: 'queued', message: 'Execution queued due to system load' };
      }

      // Mark as running
      execution.status = 'running';
      execution.startTime = new Date();
      await execution.save();

      // Add to running executions
      this.runningExecutions.set(executionId, execution);

      await execution.addLog('info', 'Workflow execution started');

      // Start processing workflow nodes
      await this.processWorkflow(execution);

      return { status: 'started', executionId };
    } catch (error) {
      console.error(`Error starting workflow execution ${executionId}:`, error);
      await this.handleExecutionError(executionId, error);
      throw error;
    }
  }

  /**
   * Process workflow execution
   * @param {Object} execution - The workflow execution document
   */
  async processWorkflow(execution) {
    try {
      const template = execution.workflowTemplateId;
      const startNode = template.nodes.find(node => node.type === 'start');

      if (!startNode) {
        throw new Error('No start node found in workflow template');
      }

      // Process nodes starting from the start node
      await this.processNode(execution, startNode.id);

    } catch (error) {
      console.error(`Error processing workflow ${execution._id}:`, error);
      await this.handleExecutionError(execution._id, error);
    } finally {
      // Remove from running executions
      this.runningExecutions.delete(execution._id.toString());
    }
  }

  /**
   * Process a single workflow node
   * @param {Object} execution - The workflow execution document
   * @param {string} nodeId - The node ID to process
   */
  async processNode(execution, nodeId) {
    try {
      const template = execution.workflowTemplateId;
      const node = template.nodes.find(n => n.id === nodeId);
      const step = execution.steps.find(s => s.nodeId === nodeId);

      if (!node || !step) {
        throw new Error(`Node ${nodeId} not found in template or execution`);
      }

      // Update step status
      step.status = 'running';
      step.startTime = new Date();
      execution.currentStep = nodeId;
      await execution.save();

      await execution.addLog('info', `Processing node: ${node.type}`, nodeId);

      let result;
      switch (node.type) {
        case 'start':
          result = await this.processStartNode(execution, node);
          break;
        case 'task':
          result = await this.processTaskNode(execution, node);
          break;
        case 'email':
          result = await this.processEmailNode(execution, node);
          break;
        case 'delay':
          result = await this.processDelayNode(execution, node);
          break;
        case 'condition':
          result = await this.processConditionNode(execution, node);
          break;
        case 'approval':
          result = await this.processApprovalNode(execution, node);
          break;
        case 'api_call':
          result = await this.processApiCallNode(execution, node);
          break;
        case 'end':
          result = await this.processEndNode(execution, node);
          break;
        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      // Update step with result
      step.status = 'completed';
      step.endTime = new Date();
      step.duration = step.endTime - step.startTime;
      step.output = result;
      await execution.updateProgress();

      await execution.addLog('info', `Node completed: ${node.type}`, nodeId, result);

      // Process next nodes if not end node
      if (node.type !== 'end') {
        await this.processNextNodes(execution, nodeId, result);
      }

    } catch (error) {
      console.error(`Error processing node ${nodeId}:`, error);
      await this.handleNodeError(execution, nodeId, error);
    }
  }

  /**
   * Process start node
   */
  async processStartNode(execution, node) {
    return {
      message: 'Workflow started',
      timestamp: new Date(),
      variables: execution.variables,
      context: execution.context,
    };
  }

  /**
   * Process task creation node
   */
  async processTaskNode(execution, node) {
    try {
      const { config } = node;
      const variables = execution.variables || {};
      const context = execution.context || {};

      // Replace variables in task configuration
      const taskData = {
        title: this.replaceVariables(config.title, variables, context),
        description: this.replaceVariables(config.description, variables, context),
        priority: config.priority || 'medium',
        project: this.replaceVariables(config.project, variables, context),
        assignedTo: config.assignedTo || execution.triggeredBy,
        assignedBy: execution.triggeredBy,
        dueDate: config.dueDate ? new Date(config.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        scheduledDate: config.scheduledDate ? new Date(config.scheduledDate) : new Date(),
        tags: config.tags || [],
      };

      const task = await Task.create(taskData);
      await task.populate('assignedBy', 'firstName lastName email');
      await task.populate('assignedTo', 'firstName lastName email');

      // Trigger workflow engine for task creation
      await workflowEngine.executeEventRules('task_created', task);

      return {
        taskId: task._id,
        title: task.title,
        assignedTo: task.assignedTo.email,
        message: 'Task created successfully',
      };
    } catch (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }
  }

  /**
   * Process email notification node
   */
  async processEmailNode(execution, node) {
    try {
      const { config } = node;
      const variables = execution.variables || {};
      const context = execution.context || {};

      const emailData = {
        recipient: config.recipient || execution.triggeredBy,
        sender: execution.triggeredBy,
        type: 'workflow_notification',
        title: this.replaceVariables(config.subject, variables, context),
        message: this.replaceVariables(config.body, variables, context),
        priority: config.priority || 'medium',
        data: {
          workflowExecutionId: execution._id,
          workflowName: execution.name,
        },
        channels: {
          inApp: { sent: false, read: false },
          email: { sent: false },
          websocket: { sent: false },
        },
      };

      await notificationService.sendNotification(emailData);

      return {
        recipient: config.recipient,
        subject: emailData.title,
        message: 'Email notification sent successfully',
      };
    } catch (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Process delay node
   */
  async processDelayNode(execution, node) {
    try {
      const { config } = node;
      const delayMs = config.duration || 1000;

      await execution.addLog('info', `Delaying execution for ${delayMs}ms`, node.id);

      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            delayDuration: delayMs,
            message: `Delayed execution for ${delayMs}ms`,
          });
        }, delayMs);
      });
    } catch (error) {
      throw new Error(`Failed to process delay: ${error.message}`);
    }
  }

  /**
   * Process condition node
   */
  async processConditionNode(execution, node) {
    try {
      const { config } = node;
      const variables = execution.variables || {};
      const context = execution.context || {};

      // Simple condition evaluation (can be extended)
      const condition = this.replaceVariables(config.condition, variables, context);
      const result = this.evaluateCondition(condition, variables, context);

      return {
        condition,
        result,
        message: `Condition evaluated to: ${result}`,
      };
    } catch (error) {
      throw new Error(`Failed to evaluate condition: ${error.message}`);
    }
  }

  /**
   * Process approval node
   */
  async processApprovalNode(execution, node) {
    try {
      const { config } = node;
      const step = execution.steps.find(s => s.nodeId === node.id);

      // Set step to waiting for approval
      step.status = 'waiting_approval';
      step.assignedTo = config.approver || execution.triggeredBy;
      await execution.save();

      // Send approval notification
      const approvalData = {
        recipient: step.assignedTo,
        sender: execution.triggeredBy,
        type: 'workflow_approval',
        title: `Approval Required: ${execution.name}`,
        message: config.message || 'Your approval is required to continue this workflow.',
        priority: config.priority || 'high',
        data: {
          workflowExecutionId: execution._id,
          nodeId: node.id,
          workflowName: execution.name,
        },
        channels: {
          inApp: { sent: false, read: false },
          email: { sent: false },
          websocket: { sent: false },
        },
      };

      await notificationService.sendNotification(approvalData);

      return {
        status: 'waiting_approval',
        approver: step.assignedTo,
        message: 'Approval request sent',
      };
    } catch (error) {
      throw new Error(`Failed to process approval: ${error.message}`);
    }
  }

  /**
   * Process API call node
   */
  async processApiCallNode(execution, node) {
    try {
      const { config } = node;
      const variables = execution.variables || {};
      const context = execution.context || {};

      const url = this.replaceVariables(config.url, variables, context);
      const method = config.method || 'GET';
      const headers = config.headers || {};
      const body = config.body ? this.replaceVariables(JSON.stringify(config.body), variables, context) : null;

      const fetch = require('node-fetch');
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.parse(body) : null,
      });

      const responseData = await response.json();

      return {
        url,
        method,
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        message: 'API call completed successfully',
      };
    } catch (error) {
      throw new Error(`Failed to make API call: ${error.message}`);
    }
  }

  /**
   * Process end node
   */
  async processEndNode(execution, node) {
    try {
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.duration = execution.endTime - execution.startTime;
      await execution.save();

      await execution.addLog('info', 'Workflow execution completed');

      // Send completion notification
      const completionData = {
        recipient: execution.triggeredBy,
        sender: execution.triggeredBy,
        type: 'workflow_completed',
        title: `Workflow Completed: ${execution.name}`,
        message: `Your workflow "${execution.name}" has completed successfully.`,
        priority: 'medium',
        data: {
          workflowExecutionId: execution._id,
          workflowName: execution.name,
          duration: execution.duration,
        },
        channels: {
          inApp: { sent: false, read: false },
          email: { sent: false },
          websocket: { sent: false },
        },
      };

      await notificationService.sendNotification(completionData);

      return {
        status: 'completed',
        duration: execution.duration,
        message: 'Workflow execution completed successfully',
      };
    } catch (error) {
      throw new Error(`Failed to complete workflow: ${error.message}`);
    }
  }

  /**
   * Process next nodes based on connections
   */
  async processNextNodes(execution, currentNodeId, result) {
    try {
      const template = execution.workflowTemplateId;
      const connections = template.connections.filter(conn => conn.source === currentNodeId);

      for (const connection of connections) {
        // Check connection conditions if any
        if (connection.condition) {
          const conditionMet = this.evaluateCondition(
            connection.condition,
            execution.variables,
            { ...execution.context, nodeResult: result }
          );
          if (!conditionMet) {
            continue;
          }
        }

        // Process the target node
        await this.processNode(execution, connection.target);
      }
    } catch (error) {
      console.error(`Error processing next nodes from ${currentNodeId}:`, error);
      throw error;
    }
  }

  /**
   * Handle execution error
   */
  async handleExecutionError(executionId, error) {
    try {
      const execution = await WorkflowExecution.findById(executionId);
      if (execution) {
        execution.status = 'failed';
        execution.endTime = new Date();
        execution.duration = execution.startTime ? execution.endTime - execution.startTime : 0;
        execution.errors.push({
          timestamp: new Date(),
          error: {
            message: error.message,
            stack: error.stack,
            code: error.code,
          },
        });
        await execution.save();

        await execution.addLog('error', `Workflow execution failed: ${error.message}`);

        // Send failure notification
        const failureData = {
          recipient: execution.triggeredBy,
          sender: execution.triggeredBy,
          type: 'workflow_failed',
          title: `Workflow Failed: ${execution.name}`,
          message: `Your workflow "${execution.name}" has failed: ${error.message}`,
          priority: 'high',
          data: {
            workflowExecutionId: execution._id,
            workflowName: execution.name,
            error: error.message,
          },
          channels: {
            inApp: { sent: false, read: false },
            email: { sent: false },
            websocket: { sent: false },
          },
        };

        await notificationService.sendNotification(failureData);
      }
    } catch (handlingError) {
      console.error('Error handling execution error:', handlingError);
    }
  }

  /**
   * Handle node error with retry logic
   */
  async handleNodeError(execution, nodeId, error) {
    try {
      const step = execution.steps.find(s => s.nodeId === nodeId);
      if (step) {
        step.status = 'failed';
        step.endTime = new Date();
        step.duration = step.startTime ? step.endTime - step.startTime : 0;
        step.error = {
          message: error.message,
          stack: error.stack,
          code: error.code,
        };

        // Implement retry logic
        if (step.retryCount < this.retryDelays.length) {
          const delay = this.retryDelays[step.retryCount];
          step.retryCount++;
          
          await execution.addLog('warn', `Node failed, retrying in ${delay}ms (attempt ${step.retryCount})`, nodeId);
          
          setTimeout(async () => {
            try {
              await this.processNode(execution, nodeId);
            } catch (retryError) {
              console.error(`Retry failed for node ${nodeId}:`, retryError);
            }
          }, delay);
        } else {
          await execution.addLog('error', `Node failed after ${step.retryCount} retries: ${error.message}`, nodeId);
          throw error; // Propagate error to fail the entire execution
        }

        await execution.save();
      }
    } catch (handlingError) {
      console.error('Error handling node error:', handlingError);
      throw error; // Propagate original error
    }
  }

  /**
   * Replace variables in text
   */
  replaceVariables(text, variables, context) {
    if (typeof text !== 'string') return text;

    let result = text;
    
    // Replace variables: {{variableName}}
    result = result.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] || context[varName] || match;
    });

    // Replace context variables: {{context.propertyName}}
    result = result.replace(/\{\{context\.(\w+)\}\}/g, (match, propName) => {
      return context[propName] || match;
    });

    return result;
  }

  /**
   * Evaluate simple conditions
   */
  evaluateCondition(condition, variables, context) {
    try {
      // Simple condition evaluation - can be extended with a proper expression parser
      // For now, support basic comparisons like: variable == value, variable > value, etc.
      
      // Replace variables in condition
      let evaluatedCondition = this.replaceVariables(condition, variables, context);
      
      // Basic evaluation (this is a simplified implementation)
      // In production, you'd want to use a proper expression parser
      if (evaluatedCondition.includes('==')) {
        const [left, right] = evaluatedCondition.split('==').map(s => s.trim());
        return left === right;
      } else if (evaluatedCondition.includes('>')) {
        const [left, right] = evaluatedCondition.split('>').map(s => s.trim());
        return parseFloat(left) > parseFloat(right);
      } else if (evaluatedCondition.includes('<')) {
        const [left, right] = evaluatedCondition.split('<').map(s => s.trim());
        return parseFloat(left) < parseFloat(right);
      } else if (evaluatedCondition.includes('!=')) {
        const [left, right] = evaluatedCondition.split('!=').map(s => s.trim());
        return left !== right;
      }
      
      // Default to true if condition format is not recognized
      return true;
    } catch (error) {
      console.error('Error evaluating condition:', error);
      return false;
    }
  }

  /**
   * Pause workflow execution
   */
  async pauseExecution(executionId) {
    try {
      const execution = await WorkflowExecution.findById(executionId);
      if (execution && execution.status === 'running') {
        execution.status = 'paused';
        await execution.save();
        await execution.addLog('info', 'Workflow execution paused');
        
        // Remove from running executions
        this.runningExecutions.delete(executionId);
        
        return { status: 'paused' };
      }
      throw new Error('Execution not found or not in running state');
    } catch (error) {
      console.error(`Error pausing execution ${executionId}:`, error);
      throw error;
    }
  }

  /**
   * Resume workflow execution
   */
  async resumeExecution(executionId) {
    try {
      const execution = await WorkflowExecution.findById(executionId);
      if (execution && execution.status === 'paused') {
        execution.status = 'running';
        await execution.save();
        await execution.addLog('info', 'Workflow execution resumed');
        
        // Continue processing from current step
        if (execution.currentStep) {
          await this.processNode(execution, execution.currentStep);
        }
        
        return { status: 'resumed' };
      }
      throw new Error('Execution not found or not in paused state');
    } catch (error) {
      console.error(`Error resuming execution ${executionId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel workflow execution
   */
  async cancelExecution(executionId) {
    try {
      const execution = await WorkflowExecution.findById(executionId);
      if (execution && !execution.isCompleted()) {
        execution.status = 'cancelled';
        execution.endTime = new Date();
        execution.duration = execution.startTime ? execution.endTime - execution.startTime : 0;
        await execution.save();
        await execution.addLog('info', 'Workflow execution cancelled');
        
        // Remove from running executions
        this.runningExecutions.delete(executionId);
        
        return { status: 'cancelled' };
      }
      throw new Error('Execution not found or already completed');
    } catch (error) {
      console.error(`Error cancelling execution ${executionId}:`, error);
      throw error;
    }
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId) {
    try {
      const execution = await WorkflowExecution.findById(executionId)
        .populate('workflowTemplateId', 'name description')
        .populate('triggeredBy', 'firstName lastName email');

      if (!execution) {
        throw new Error('Execution not found');
      }

      return {
        executionId: execution.executionId,
        status: execution.status,
        progress: execution.progress,
        currentStep: execution.currentStep,
        startTime: execution.startTime,
        endTime: execution.endTime,
        duration: execution.duration,
        errors: execution.errors,
        template: execution.workflowTemplateId,
        triggeredBy: execution.triggeredBy,
      };
    } catch (error) {
      console.error(`Error getting execution status ${executionId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new WorkflowExecutor();