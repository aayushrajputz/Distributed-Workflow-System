const notificationCacheService = require('./notificationCacheService');
const emailService = require('./emailService');
const { getPrometheusService } = require('./prometheusService');

class NotificationTemplateService {
  constructor() {
    this.templates = new Map();
    this.templateVersions = new Map();
    this.templateAnalytics = new Map();
    this.localizationData = new Map();
    
    // Performance metrics
    this.metrics = {
      templatesRendered: 0,
      cacheHits: 0,
      cacheMisses: 0,
      renderTime: 0,
      validationErrors: 0,
    };

    // Default templates
    this.initializeDefaultTemplates();
    
    // Load localization data
    this.loadLocalizationData();
  }

  /**
   * Initialize default notification templates
   */
  initializeDefaultTemplates() {
    // Task assignment template
    this.registerTemplate('task_assigned', {
      name: 'Task Assignment',
      description: 'Template for task assignment notifications',
      category: 'task',
      channels: {
        inApp: {
          title: 'New Task Assigned: {{task.title}}',
          message: 'You have been assigned a new task "{{task.title}}" by {{assignedBy.name}}. Due date: {{task.dueDate | date}}',
        },
        email: {
          subject: 'New Task Assigned: {{task.title}}',
          template: 'task_assigned_email',
          variables: {
            taskTitle: '{{task.title}}',
            taskDescription: '{{task.description}}',
            assignedBy: '{{assignedBy.name}}',
            dueDate: '{{task.dueDate | date}}',
            priority: '{{task.priority}}',
            projectName: '{{task.project}}',
          },
        },
        push: {
          title: 'New Task: {{task.title}}',
          body: 'Assigned by {{assignedBy.name}} - Due {{task.dueDate | date}}',
          data: {
            taskId: '{{task.id}}',
            type: 'task_assigned',
            priority: '{{task.priority}}',
          },
        },
        slack: {
          text: ':clipboard: *New Task Assigned*\n*Task:* {{task.title}}\n*Assigned by:* {{assignedBy.name}}\n*Due:* {{task.dueDate | date}}\n*Priority:* {{task.priority}}',
          attachments: [{
            color: '{{task.priority | priorityColor}}',
            fields: [
              { title: 'Project', value: '{{task.project}}', short: true },
              { title: 'Status', value: '{{task.status}}', short: true },
            ],
          }],
        },
      },
      variables: [
        { name: 'task', type: 'object', required: true },
        { name: 'assignedBy', type: 'object', required: true },
        { name: 'user', type: 'object', required: true },
      ],
      version: '1.0.0',
      isActive: true,
    });

    // Task completion template
    this.registerTemplate('task_completed', {
      name: 'Task Completion',
      description: 'Template for task completion notifications',
      category: 'task',
      channels: {
        inApp: {
          title: 'Task Completed: {{task.title}}',
          message: '{{completedBy.name}} has completed the task "{{task.title}}"',
        },
        email: {
          subject: 'Task Completed: {{task.title}}',
          template: 'task_completed_email',
          variables: {
            taskTitle: '{{task.title}}',
            completedBy: '{{completedBy.name}}',
            completedAt: '{{task.completedAt | datetime}}',
            projectName: '{{task.project}}',
          },
        },
        push: {
          title: 'Task Completed',
          body: '{{completedBy.name}} completed "{{task.title}}"',
          data: {
            taskId: '{{task.id}}',
            type: 'task_completed',
          },
        },
        slack: {
          text: ':white_check_mark: *Task Completed*\n*Task:* {{task.title}}\n*Completed by:* {{completedBy.name}}\n*Project:* {{task.project}}',
          attachments: [{
            color: 'good',
            fields: [
              { title: 'Completed At', value: '{{task.completedAt | datetime}}', short: true },
            ],
          }],
        },
      },
      variables: [
        { name: 'task', type: 'object', required: true },
        { name: 'completedBy', type: 'object', required: true },
      ],
      version: '1.0.0',
      isActive: true,
    });

    // System announcement template
    this.registerTemplate('system_announcement', {
      name: 'System Announcement',
      description: 'Template for system-wide announcements',
      category: 'system',
      channels: {
        inApp: {
          title: '{{announcement.title}}',
          message: '{{announcement.message}}',
        },
        email: {
          subject: '[System] {{announcement.title}}',
          template: 'system_announcement_email',
          variables: {
            title: '{{announcement.title}}',
            message: '{{announcement.message}}',
            priority: '{{announcement.priority}}',
            actionUrl: '{{announcement.actionUrl}}',
          },
        },
        push: {
          title: '{{announcement.title}}',
          body: '{{announcement.message}}',
          data: {
            type: 'system_announcement',
            priority: '{{announcement.priority}}',
          },
        },
        slack: {
          text: ':loudspeaker: *{{announcement.title}}*\n{{announcement.message}}',
          attachments: [{
            color: '{{announcement.priority | priorityColor}}',
          }],
        },
      },
      variables: [
        { name: 'announcement', type: 'object', required: true },
      ],
      version: '1.0.0',
      isActive: true,
    });

    // Workflow completion template
    this.registerTemplate('workflow_completed', {
      name: 'Workflow Completion',
      description: 'Template for workflow completion notifications',
      category: 'workflow',
      channels: {
        inApp: {
          title: 'Workflow Completed: {{workflow.name}}',
          message: 'The workflow "{{workflow.name}}" has been completed successfully',
        },
        email: {
          subject: 'Workflow Completed: {{workflow.name}}',
          template: 'workflow_completed_email',
          variables: {
            workflowName: '{{workflow.name}}',
            completedAt: '{{workflow.completedAt | datetime}}',
            duration: '{{workflow.duration | duration}}',
            tasksCompleted: '{{workflow.tasksCompleted}}',
          },
        },
        push: {
          title: 'Workflow Complete',
          body: '{{workflow.name}} finished in {{workflow.duration | duration}}',
          data: {
            workflowId: '{{workflow.id}}',
            type: 'workflow_completed',
          },
        },
      },
      variables: [
        { name: 'workflow', type: 'object', required: true },
      ],
      version: '1.0.0',
      isActive: true,
    });

    console.log('✅ Default notification templates initialized');
  }

  /**
   * Load localization data
   */
  loadLocalizationData() {
    // English (default)
    this.localizationData.set('en', {
      common: {
        'task': 'Task',
        'project': 'Project',
        'priority': 'Priority',
        'dueDate': 'Due Date',
        'assignedBy': 'Assigned By',
        'completedBy': 'Completed By',
        'status': 'Status',
      },
      priorities: {
        'low': 'Low',
        'medium': 'Medium',
        'high': 'High',
        'critical': 'Critical',
      },
      statuses: {
        'pending': 'Pending',
        'in_progress': 'In Progress',
        'completed': 'Completed',
        'cancelled': 'Cancelled',
      },
    });

    // Spanish
    this.localizationData.set('es', {
      common: {
        'task': 'Tarea',
        'project': 'Proyecto',
        'priority': 'Prioridad',
        'dueDate': 'Fecha de Vencimiento',
        'assignedBy': 'Asignado Por',
        'completedBy': 'Completado Por',
        'status': 'Estado',
      },
      priorities: {
        'low': 'Baja',
        'medium': 'Media',
        'high': 'Alta',
        'critical': 'Crítica',
      },
      statuses: {
        'pending': 'Pendiente',
        'in_progress': 'En Progreso',
        'completed': 'Completado',
        'cancelled': 'Cancelado',
      },
    });

    // French
    this.localizationData.set('fr', {
      common: {
        'task': 'Tâche',
        'project': 'Projet',
        'priority': 'Priorité',
        'dueDate': 'Date d\'échéance',
        'assignedBy': 'Assigné Par',
        'completedBy': 'Terminé Par',
        'status': 'Statut',
      },
      priorities: {
        'low': 'Faible',
        'medium': 'Moyen',
        'high': 'Élevé',
        'critical': 'Critique',
      },
      statuses: {
        'pending': 'En Attente',
        'in_progress': 'En Cours',
        'completed': 'Terminé',
        'cancelled': 'Annulé',
      },
    });
  }

  /**
   * Register a new template
   * @param {string} templateId - Template identifier
   * @param {Object} template - Template configuration
   */
  registerTemplate(templateId, template) {
    // Validate template
    const validation = this.validateTemplate(template);
    if (!validation.isValid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
    }

    // Add metadata
    template.id = templateId;
    template.createdAt = new Date();
    template.updatedAt = new Date();

    // Store template
    this.templates.set(templateId, template);

    // Initialize analytics
    this.templateAnalytics.set(templateId, {
      rendersCount: 0,
      avgRenderTime: 0,
      errorCount: 0,
      engagementRate: 0,
      lastUsed: null,
    });

    // Cache template
    this.cacheTemplate(templateId, template);

    console.log(`✅ Template '${templateId}' registered successfully`);
  }

  /**
   * Get template by ID
   * @param {string} templateId - Template identifier
   * @param {string} version - Template version (optional)
   * @returns {Object|null} - Template or null if not found
   */
  async getTemplate(templateId, version = null) {
    const cacheKey = version ? `${templateId}:${version}` : templateId;
    
    // Try cache first
    const cached = await notificationCacheService.getTemplate(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    this.metrics.cacheMisses++;

    // Get from memory
    let template = this.templates.get(templateId);
    
    if (!template) {
      return null;
    }

    // Handle versioning
    if (version && this.templateVersions.has(templateId)) {
      const versions = this.templateVersions.get(templateId);
      template = versions.get(version) || template;
    }

    // Cache for future use
    await this.cacheTemplate(cacheKey, template);

    return template;
  }

  /**
   * Render template for specific channel
   * @param {string} templateId - Template identifier
   * @param {string} channel - Notification channel
   * @param {Object} variables - Template variables
   * @param {Object} options - Rendering options
   * @returns {Object} - Rendered template
   */
  async renderTemplate(templateId, channel, variables = {}, options = {}) {
    const startTime = Date.now();

    try {
      // Get template
      const template = await this.getTemplate(templateId, options.version);
      if (!template) {
        throw new Error(`Template '${templateId}' not found`);
      }

      // Check if template is active
      if (!template.isActive) {
        throw new Error(`Template '${templateId}' is not active`);
      }

      // Get channel configuration
      const channelConfig = template.channels[channel];
      if (!channelConfig) {
        throw new Error(`Channel '${channel}' not configured for template '${templateId}'`);
      }

      // Prepare rendering context
      const context = {
        variables,
        user: options.user || {},
        locale: options.locale || 'en',
        timezone: options.timezone || 'UTC',
        timestamp: new Date(),
      };

      // Render template
      const rendered = this.processTemplateContent(channelConfig, context);

      // Update analytics
      this.updateTemplateAnalytics(templateId, Date.now() - startTime);

      // Record metrics
      this.metrics.templatesRendered++;
      this.metrics.renderTime += Date.now() - startTime;

      return {
        success: true,
        templateId,
        channel,
        rendered,
        renderTime: Date.now() - startTime,
      };

    } catch (error) {
      this.metrics.validationErrors++;
      this.updateTemplateAnalytics(templateId, Date.now() - startTime, true);

      return {
        success: false,
        templateId,
        channel,
        error: error.message,
        renderTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Process template content with variables
   * @param {Object} channelConfig - Channel configuration
   * @param {Object} context - Rendering context
   * @returns {Object} - Processed content
   */
  processTemplateContent(channelConfig, context) {
    const processed = {};

    for (const [key, value] of Object.entries(channelConfig)) {
      if (typeof value === 'string') {
        processed[key] = this.replaceVariables(value, context);
      } else if (typeof value === 'object' && value !== null) {
        processed[key] = this.processNestedObject(value, context);
      } else {
        processed[key] = value;
      }
    }

    return processed;
  }

  /**
   * Process nested objects in templates
   * @param {Object} obj - Object to process
   * @param {Object} context - Rendering context
   * @returns {Object} - Processed object
   */
  processNestedObject(obj, context) {
    if (Array.isArray(obj)) {
      return obj.map(item => 
        typeof item === 'object' ? this.processNestedObject(item, context) : 
        typeof item === 'string' ? this.replaceVariables(item, context) : item
      );
    }

    const processed = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        processed[key] = this.replaceVariables(value, context);
      } else if (typeof value === 'object' && value !== null) {
        processed[key] = this.processNestedObject(value, context);
      } else {
        processed[key] = value;
      }
    }

    return processed;
  }

  /**
   * Replace variables in template string
   * @param {string} template - Template string
   * @param {Object} context - Rendering context
   * @returns {string} - Processed string
   */
  replaceVariables(template, context) {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      try {
        return this.evaluateExpression(expression.trim(), context);
      } catch (error) {
        console.warn(`⚠️ Template expression error: ${expression} - ${error.message}`);
        return match; // Return original if evaluation fails
      }
    });
  }

  /**
   * Evaluate template expression
   * @param {string} expression - Expression to evaluate
   * @param {Object} context - Rendering context
   * @returns {string} - Evaluated result
   */
  evaluateExpression(expression, context) {
    // Handle filters (e.g., "date | format")
    const [path, ...filters] = expression.split('|').map(s => s.trim());
    
    // Get value from context
    let value = this.getValueFromPath(path, context);
    
    // Apply filters
    for (const filter of filters) {
      value = this.applyFilter(value, filter, context);
    }

    return value !== undefined && value !== null ? String(value) : '';
  }

  /**
   * Get value from object path
   * @param {string} path - Object path (e.g., "user.name")
   * @param {Object} context - Context object
   * @returns {*} - Value at path
   */
  getValueFromPath(path, context) {
    const parts = path.split('.');
    let current = context;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else if (current && typeof current === 'object' && 'variables' in current && part in current.variables) {
        current = current.variables[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Apply filter to value
   * @param {*} value - Value to filter
   * @param {string} filter - Filter name
   * @param {Object} context - Rendering context
   * @returns {*} - Filtered value
   */
  applyFilter(value, filter, context) {
    switch (filter) {
      case 'date':
        return value instanceof Date ? value.toLocaleDateString(context.locale) : value;
      
      case 'datetime':
        return value instanceof Date ? value.toLocaleString(context.locale) : value;
      
      case 'time':
        return value instanceof Date ? value.toLocaleTimeString(context.locale) : value;
      
      case 'duration':
        return this.formatDuration(value);
      
      case 'uppercase':
        return String(value).toUpperCase();
      
      case 'lowercase':
        return String(value).toLowerCase();
      
      case 'capitalize':
        return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
      
      case 'priorityColor':
        return this.getPriorityColor(value);
      
      case 'localize':
        return this.localizeValue(value, context.locale);
      
      default:
        console.warn(`⚠️ Unknown filter: ${filter}`);
        return value;
    }
  }

  /**
   * Format duration in milliseconds to human readable
   * @param {number} ms - Duration in milliseconds
   * @returns {string} - Formatted duration
   */
  formatDuration(ms) {
    if (typeof ms !== 'number') return ms;
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Get color for priority
   * @param {string} priority - Priority level
   * @returns {string} - Color code
   */
  getPriorityColor(priority) {
    const colors = {
      low: '#28a745',
      medium: '#ffc107',
      high: '#fd7e14',
      critical: '#dc3545',
    };
    return colors[priority] || '#6c757d';
  }

  /**
   * Localize value
   * @param {string} value - Value to localize
   * @param {string} locale - Locale code
   * @returns {string} - Localized value
   */
  localizeValue(value, locale) {
    const localization = this.localizationData.get(locale) || this.localizationData.get('en');
    
    // Check common translations
    if (localization.common && localization.common[value]) {
      return localization.common[value];
    }
    
    // Check priority translations
    if (localization.priorities && localization.priorities[value]) {
      return localization.priorities[value];
    }
    
    // Check status translations
    if (localization.statuses && localization.statuses[value]) {
      return localization.statuses[value];
    }
    
    return value;
  }

  /**
   * Validate template configuration
   * @param {Object} template - Template to validate
   * @returns {Object} - Validation result
   */
  validateTemplate(template) {
    const errors = [];

    // Required fields
    if (!template.name) errors.push('Template name is required');
    if (!template.channels) errors.push('Template channels are required');
    if (!template.variables) errors.push('Template variables are required');

    // Validate channels
    if (template.channels) {
      const validChannels = ['inApp', 'email', 'push', 'slack', 'websocket'];
      for (const channel of Object.keys(template.channels)) {
        if (!validChannels.includes(channel)) {
          errors.push(`Invalid channel: ${channel}`);
        }
      }
    }

    // Validate variables
    if (template.variables && Array.isArray(template.variables)) {
      for (const variable of template.variables) {
        if (!variable.name) errors.push('Variable name is required');
        if (!variable.type) errors.push('Variable type is required');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Cache template
   * @param {string} key - Cache key
   * @param {Object} template - Template to cache
   */
  async cacheTemplate(key, template) {
    try {
      await notificationCacheService.setTemplate(key, template);
    } catch (error) {
      console.warn('⚠️ Failed to cache template:', error.message);
    }
  }

  /**
   * Update template analytics
   * @param {string} templateId - Template ID
   * @param {number} renderTime - Render time in ms
   * @param {boolean} hasError - Whether there was an error
   */
  updateTemplateAnalytics(templateId, renderTime, hasError = false) {
    const analytics = this.templateAnalytics.get(templateId);
    if (!analytics) return;

    analytics.rendersCount++;
    analytics.avgRenderTime = ((analytics.avgRenderTime * (analytics.rendersCount - 1)) + renderTime) / analytics.rendersCount;
    analytics.lastUsed = new Date();

    if (hasError) {
      analytics.errorCount++;
    }

    this.templateAnalytics.set(templateId, analytics);
  }

  /**
   * Get template analytics
   * @param {string} templateId - Template ID
   * @returns {Object} - Template analytics
   */
  getTemplateAnalytics(templateId) {
    return this.templateAnalytics.get(templateId) || {
      rendersCount: 0,
      avgRenderTime: 0,
      errorCount: 0,
      engagementRate: 0,
      lastUsed: null,
    };
  }

  /**
   * List all templates
   * @param {Object} filters - Filter options
   * @returns {Array} - List of templates
   */
  listTemplates(filters = {}) {
    let templates = Array.from(this.templates.values());

    // Apply filters
    if (filters.category) {
      templates = templates.filter(t => t.category === filters.category);
    }

    if (filters.isActive !== undefined) {
      templates = templates.filter(t => t.isActive === filters.isActive);
    }

    if (filters.channel) {
      templates = templates.filter(t => t.channels[filters.channel]);
    }

    return templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      version: template.version,
      isActive: template.isActive,
      channels: Object.keys(template.channels),
      analytics: this.getTemplateAnalytics(template.id),
    }));
  }

  /**
   * Create template version
   * @param {string} templateId - Template ID
   * @param {Object} template - New template version
   * @returns {string} - New version number
   */
  createTemplateVersion(templateId, template) {
    const currentTemplate = this.templates.get(templateId);
    if (!currentTemplate) {
      throw new Error(`Template '${templateId}' not found`);
    }

    // Generate new version number
    const currentVersion = currentTemplate.version || '1.0.0';
    const versionParts = currentVersion.split('.').map(Number);
    versionParts[1]++; // Increment minor version
    const newVersion = versionParts.join('.');

    // Store version
    if (!this.templateVersions.has(templateId)) {
      this.templateVersions.set(templateId, new Map());
    }
    
    const versions = this.templateVersions.get(templateId);
    versions.set(newVersion, { ...template, version: newVersion });

    // Update current template
    template.version = newVersion;
    template.updatedAt = new Date();
    this.templates.set(templateId, template);

    // Invalidate cache
    notificationCacheService.invalidateTemplateCache(templateId);

    return newVersion;
  }

  /**
   * Test template rendering
   * @param {string} templateId - Template ID
   * @param {string} channel - Channel to test
   * @param {Object} testData - Test data
   * @returns {Object} - Test result
   */
  async testTemplate(templateId, channel, testData = {}) {
    const defaultTestData = {
      task: {
        id: 'test-task-123',
        title: 'Test Task',
        description: 'This is a test task for template testing',
        priority: 'medium',
        status: 'pending',
        project: 'Test Project',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        completedAt: new Date(),
      },
      user: {
        id: 'test-user-123',
        name: 'John Doe',
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      assignedBy: {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
      },
      completedBy: {
        name: 'John Doe',
        email: 'john.doe@example.com',
      },
      workflow: {
        id: 'test-workflow-123',
        name: 'Test Workflow',
        completedAt: new Date(),
        duration: 3600000, // 1 hour
        tasksCompleted: 5,
      },
      announcement: {
        title: 'Test Announcement',
        message: 'This is a test system announcement',
        priority: 'medium',
        actionUrl: 'https://example.com/action',
      },
    };

    const mergedTestData = { ...defaultTestData, ...testData };

    return await this.renderTemplate(templateId, channel, mergedTestData, {
      locale: 'en',
      timezone: 'UTC',
    });
  }

  /**
   * Get service metrics
   * @returns {Object} - Service metrics
   */
  getMetrics() {
    const avgRenderTime = this.metrics.templatesRendered > 0 
      ? this.metrics.renderTime / this.metrics.templatesRendered 
      : 0;

    return {
      ...this.metrics,
      avgRenderTime: Math.round(avgRenderTime),
      cacheHitRate: this.metrics.cacheHits + this.metrics.cacheMisses > 0
        ? ((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100).toFixed(2) + '%'
        : '0%',
      totalTemplates: this.templates.size,
      activeTemplates: Array.from(this.templates.values()).filter(t => t.isActive).length,
    };
  }

  /**
   * Get health status
   * @returns {Object} - Health status
   */
  getHealthStatus() {
    return {
      status: 'healthy',
      templatesLoaded: this.templates.size,
      localesSupported: this.localizationData.size,
      metrics: this.getMetrics(),
    };
  }
}

// Create singleton instance
const notificationTemplateService = new NotificationTemplateService();

module.exports = notificationTemplateService;