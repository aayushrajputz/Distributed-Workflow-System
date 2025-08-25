const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');
const Task = require('../models/Task');
const UsageLog = require('../models/UsageLog');
const WorkflowExecution = require('../models/WorkflowExecution');
const Notification = require('../models/Notification');

// @desc    Export tasks data
// @route   GET /api/export/tasks
// @access  Private
const exportTasks = async (req, res) => {
  try {
    const {
      format = 'csv', startDate, endDate, status, priority, assignee,
    } = req.query;
    const userId = req.user._id;

    // Build query
    const query = { userId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    if (assignee) {
      query.assignee = new RegExp(assignee, 'i');
    }

    const tasks = await Task.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Transform data for export
    const exportData = tasks.map((task) => ({
      id: task._id,
      name: task.name,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      dueDate: task.dueDate ? task.dueDate.toISOString() : '',
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      completedAt: task.completedAt ? task.completedAt.toISOString() : '',
      estimatedHours: task.estimatedHours || 0,
      actualHours: task.actualHours || 0,
      tags: Array.isArray(task.tags) ? task.tags.join(', ') : '',
      createdBy: task.userId?.name || task.userId?.email || '',
    }));

    if (format === 'csv') {
      const fields = [
        'id', 'name', 'description', 'status', 'priority', 'assignee',
        'dueDate', 'createdAt', 'updatedAt', 'completedAt',
        'estimatedHours', 'actualHours', 'tags', 'createdBy',
      ];

      const parser = new Parser({ fields });
      const csv = parser.parse(exportData);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="tasks_${Date.now()}.csv"`);
      res.send(csv);
    } else if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Tasks');

      // Add headers
      worksheet.columns = [
        { header: 'ID', key: 'id', width: 25 },
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Description', key: 'description', width: 50 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Priority', key: 'priority', width: 15 },
        { header: 'Assignee', key: 'assignee', width: 25 },
        { header: 'Due Date', key: 'dueDate', width: 20 },
        { header: 'Created At', key: 'createdAt', width: 20 },
        { header: 'Updated At', key: 'updatedAt', width: 20 },
        { header: 'Completed At', key: 'completedAt', width: 20 },
        { header: 'Estimated Hours', key: 'estimatedHours', width: 15 },
        { header: 'Actual Hours', key: 'actualHours', width: 15 },
        { header: 'Tags', key: 'tags', width: 30 },
        { header: 'Created By', key: 'createdBy', width: 25 },
      ];

      // Add data
      worksheet.addRows(exportData);

      // Style headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="tasks_${Date.now()}.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="tasks_${Date.now()}.json"`);
      res.json({
        exportedAt: new Date().toISOString(),
        totalRecords: exportData.length,
        filters: {
          startDate, endDate, status, priority, assignee,
        },
        data: exportData,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Supported formats: csv, excel, json',
      });
    }
  } catch (error) {
    console.error('Error exporting tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export tasks',
      error: error.message,
    });
  }
};

// @desc    Export analytics data
// @route   GET /api/export/analytics
// @access  Private
const exportAnalytics = async (req, res) => {
  try {
    const {
      format = 'csv', startDate, endDate, endpoint, statusCode,
    } = req.query;
    const userId = req.user._id;

    // Build query
    const query = { userId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (endpoint) {
      query.endpoint = new RegExp(endpoint, 'i');
    }

    if (statusCode) {
      query.statusCode = parseInt(statusCode);
    }

    const logs = await UsageLog.find(query)
      .populate('apiKeyId', 'name keyPrefix')
      .sort({ createdAt: -1 })
      .lean();

    // Transform data for export
    const exportData = logs.map((log) => ({
      id: log._id,
      endpoint: log.endpoint,
      method: log.method,
      statusCode: log.statusCode,
      responseTime: log.responseTimeMs || log.responseTime,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      apiKey: log.apiKeyId?.name || log.apiKeyId?.keyPrefix || '',
      createdAt: log.createdAt.toISOString(),
      requestSize: log.requestSize || 0,
      responseSize: log.responseSize || 0,
    }));

    if (format === 'csv') {
      const fields = [
        'id', 'endpoint', 'method', 'statusCode', 'responseTime',
        'ipAddress', 'userAgent', 'apiKey', 'createdAt',
        'requestSize', 'responseSize',
      ];

      const parser = new Parser({ fields });
      const csv = parser.parse(exportData);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics_${Date.now()}.csv"`);
      res.send(csv);
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="analytics_${Date.now()}.json"`);
      res.json({
        exportedAt: new Date().toISOString(),
        totalRecords: exportData.length,
        filters: {
          startDate, endDate, endpoint, statusCode,
        },
        data: exportData,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Supported formats: csv, json',
      });
    }
  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export analytics',
      error: error.message,
    });
  }
};

// @desc    Export workflow executions
// @route   GET /api/export/workflow-executions
// @access  Private
const exportWorkflowExecutions = async (req, res) => {
  try {
    const {
      format = 'csv', startDate, endDate, status, templateId,
    } = req.query;
    const userId = req.user._id;

    // Build query
    const query = { triggeredBy: userId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (templateId) {
      query.workflowTemplateId = templateId;
    }

    const executions = await WorkflowExecution.find(query)
      .populate('workflowTemplateId', 'name category')
      .populate('triggeredBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Transform data for export
    const exportData = executions.map((execution) => ({
      id: execution._id,
      executionId: execution.executionId,
      workflowName: execution.workflowTemplateId?.name || '',
      workflowCategory: execution.workflowTemplateId?.category || '',
      status: execution.status,
      triggerType: execution.triggerType,
      triggeredBy: execution.triggeredBy?.name || execution.triggeredBy?.email || '',
      startTime: execution.startTime ? execution.startTime.toISOString() : '',
      endTime: execution.endTime ? execution.endTime.toISOString() : '',
      duration: execution.duration || 0,
      totalSteps: execution.progress?.totalSteps || 0,
      completedSteps: execution.progress?.completedSteps || 0,
      failedSteps: execution.progress?.failedSteps || 0,
      progressPercentage: execution.progress?.percentage || 0,
      createdAt: execution.createdAt.toISOString(),
    }));

    if (format === 'csv') {
      const fields = [
        'id', 'executionId', 'workflowName', 'workflowCategory', 'status',
        'triggerType', 'triggeredBy', 'startTime', 'endTime', 'duration',
        'totalSteps', 'completedSteps', 'failedSteps', 'progressPercentage', 'createdAt',
      ];

      const parser = new Parser({ fields });
      const csv = parser.parse(exportData);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="workflow_executions_${Date.now()}.csv"`);
      res.send(csv);
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="workflow_executions_${Date.now()}.json"`);
      res.json({
        exportedAt: new Date().toISOString(),
        totalRecords: exportData.length,
        filters: {
          startDate, endDate, status, templateId,
        },
        data: exportData,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Supported formats: csv, json',
      });
    }
  } catch (error) {
    console.error('Error exporting workflow executions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export workflow executions',
      error: error.message,
    });
  }
};

// @desc    Get export history
// @route   GET /api/export/history
// @access  Private
const getExportHistory = async (req, res) => {
  try {
    // This would typically be stored in a separate ExportHistory model
    // For now, return a simple response
    res.json({
      success: true,
      data: {
        exports: [],
        message: 'Export history feature coming soon',
      },
    });
  } catch (error) {
    console.error('Error getting export history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get export history',
      error: error.message,
    });
  }
};

module.exports = {
  exportTasks,
  exportAnalytics,
  exportWorkflowExecutions,
  getExportHistory,
};
