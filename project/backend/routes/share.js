const express = require('express');
const { body, param } = require('express-validator');
const {
  shareNote,
  updateCollaboratorPermission,
  removeCollaborator,
  getCollaborators,
  getSharedNotes,
} = require('../controllers/shareController');
const { authenticate } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation rules
const shareNoteValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid note ID'),
  body('userEmail')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('permission')
    .isIn(['read', 'write'])
    .withMessage('Permission must be either "read" or "write"'),
];

const updatePermissionValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid note ID'),
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
  body('permission')
    .isIn(['read', 'write'])
    .withMessage('Permission must be either "read" or "write"'),
];

const collaboratorParamsValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid note ID'),
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
];

const noteIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid note ID'),
];

// Routes
router.get('/shared', getSharedNotes);
router.post('/:id/share', shareNoteValidation, handleValidationErrors, shareNote);
router.get('/:id/collaborators', noteIdValidation, handleValidationErrors, getCollaborators);
router.put('/:id/share/:userId', updatePermissionValidation, handleValidationErrors, updateCollaboratorPermission);
router.delete('/:id/share/:userId', collaboratorParamsValidation, handleValidationErrors, removeCollaborator);

module.exports = router;
