const express = require('express');
const { body } = require('express-validator');
const {
  getWorkflowTemplates,
  getWorkflowTemplate,
  createWorkflowTemplate,
  updateWorkflowTemplate,
  deleteWorkflowTemplate,
  duplicateWorkflowTemplate,
  executeWorkflowTemplate,
  getWorkflowExecutions
} = require('../controllers/workflowBuilderController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const workflowTemplateValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('category')
    .optional()
    .isIn(['general', 'approval', 'data_processing', 'notification', 'integration', 'custom'])
    .withMessage('Invalid category'),
  body('nodes')
    .isArray()
    .withMessage('Nodes must be an array'),
  body('connections')
    .isArray()
    .withMessage('Connections must be an array'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean')
];

const executionValidation = [
  body('variables')
    .optional()
    .isObject()
    .withMessage('Variables must be an object'),
  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be an object'),
  body('name')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Name must be less than 200 characters')
];

// Apply authentication to all routes
router.use(authenticate);

// Workflow Template Routes
router.get('/templates', getWorkflowTemplates);
router.get('/templates/:id', getWorkflowTemplate);
router.post('/templates', workflowTemplateValidation, createWorkflowTemplate);
router.put('/templates/:id', workflowTemplateValidation, updateWorkflowTemplate);
router.delete('/templates/:id', deleteWorkflowTemplate);
router.post('/templates/:id/duplicate', duplicateWorkflowTemplate);

// Workflow Execution Routes
router.post('/templates/:id/execute', executionValidation, executeWorkflowTemplate);
router.get('/executions', getWorkflowExecutions);

module.exports = router;
