const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
} = require('../controllers/noteController');
const { authenticate } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation rules
const createNoteValidation = [
  body('title')
    .notEmpty()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title is required and cannot exceed 200 characters'),
  body('content')
    .optional()
    .isString()
    .withMessage('Content must be a string'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags) => {
      if (tags.some(tag => typeof tag !== 'string' || tag.length > 30)) {
        throw new Error('Each tag must be a string with max 30 characters');
      }
      return true;
    }),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
];

const updateNoteValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid note ID'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title cannot be empty and cannot exceed 200 characters'),
  body('content')
    .optional()
    .isString()
    .withMessage('Content must be a string'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags) => {
      if (tags.some(tag => typeof tag !== 'string' || tag.length > 30)) {
        throw new Error('Each tag must be a string with max 30 characters');
      }
      return true;
    }),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
];

const getNotesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .isString()
    .trim()
    .withMessage('Search must be a string'),
  query('tags')
    .optional()
    .isString()
    .withMessage('Tags must be a comma-separated string'),
];

const noteIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid note ID'),
];

// Routes
router.get('/', getNotesValidation, handleValidationErrors, getNotes);
router.get('/:id', noteIdValidation, handleValidationErrors, getNote);
router.post('/', createNoteValidation, handleValidationErrors, createNote);
router.put('/:id', updateNoteValidation, handleValidationErrors, updateNote);
router.delete('/:id', noteIdValidation, handleValidationErrors, deleteNote);

module.exports = router;
