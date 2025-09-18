const { validationResult } = require('express-validator');
const validator = require('validator');
const mongoose = require('mongoose');

// Constants for validation and limits
const VALIDATION_CONSTANTS = {
  TASK: {
    TITLE: { 
      MIN: 1, 
      MAX: 200, 
      PATTERN: /^[a-zA-Z0-9\s.,!?-]{1,200}$/,
      MESSAGE: 'Title must be 1-200 characters and contain only letters, numbers, spaces, and basic punctuation'
    },
    DESCRIPTION: { 
      MIN: 1, 
      MAX: 2000, 
      PATTERN: /^[\p{L}\p{N}\s.,!?()'"&%$#@-]{1,2000}$/u,
      MESSAGE: 'Description must be 1-2000 characters and contain only letters, numbers, spaces, and common punctuation'
    },
    PROJECT: { 
      MIN: 1, 
      MAX: 100, 
      PATTERN: /^[a-zA-Z0-9\s-]{1,100}$/,
      MESSAGE: 'Project name must be 1-100 characters and contain only letters, numbers, spaces, and hyphens'
    },
    COMMENT: { 
      MIN: 1, 
      MAX: 1000, 
      PATTERN: /^[\p{L}\p{N}\s.,!?()'"&%$#@-]{1,1000}$/u,
      MESSAGE: 'Comment must be 1-1000 characters and contain only letters, numbers, spaces, and common punctuation'
    },
    TAG: {
      PATTERN: /^[\w-]{1,30}$/,
      MAX_COUNT: 10,
      MESSAGE: 'Tags must be 1-30 characters and contain only letters, numbers, underscores, and hyphens'
    }
  },
  PAGINATION: {
    MIN_PAGE: 1,
    MAX_PAGE: 10000,
    MIN_LIMIT: 1,
    MAX_LIMIT: 100,
    DEFAULT_LIMIT: 20,
    RECENT_MAX_LIMIT: 50
  },
  SORT: {
    ALLOWED_FIELDS: ['createdAt', 'updatedAt', 'title', 'priority', 'dueDate', 'status'],
    DEFAULT_SORT: { createdAt: -1 }
  },
  SEARCH: {
    MAX_LENGTH: 100
  },
  PAGINATION: {
    MIN_PAGE: 1,
    MAX_PAGE: 10000,
    MIN_LIMIT: 1,
    MAX_LIMIT: 100,
    DEFAULT_LIMIT: 20
  },
  SORT: {
    ALLOWED_FIELDS: ['createdAt', 'updatedAt', 'title', 'priority', 'dueDate', 'status']
  }
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

// RegExp sanitization to prevent ReDoS
const sanitizeRegexInput = (input) => {
  if (!input || typeof input !== 'string') return '';
  // Escape special regex characters to prevent ReDoS
  return validator.escape(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Pagination parameter validation
const validatePaginationParams = (page, limit, maxLimit = VALIDATION_CONSTANTS.PAGINATION.MAX_LIMIT) => {
  const sanitizedPage = parseInt(page) || VALIDATION_CONSTANTS.PAGINATION.MIN_PAGE;
  const sanitizedLimit = parseInt(limit) || VALIDATION_CONSTANTS.PAGINATION.DEFAULT_LIMIT;

  if (sanitizedPage < VALIDATION_CONSTANTS.PAGINATION.MIN_PAGE || 
      sanitizedPage > VALIDATION_CONSTANTS.PAGINATION.MAX_PAGE) {
    throw new Error(`Page must be between ${VALIDATION_CONSTANTS.PAGINATION.MIN_PAGE} and ${VALIDATION_CONSTANTS.PAGINATION.MAX_PAGE}`);
  }

  if (sanitizedLimit < VALIDATION_CONSTANTS.PAGINATION.MIN_LIMIT || sanitizedLimit > maxLimit) {
    throw new Error(`Limit must be between ${VALIDATION_CONSTANTS.PAGINATION.MIN_LIMIT} and ${maxLimit}`);
  }

  return { page: sanitizedPage, limit: sanitizedLimit };
};

// String length and character validation
const validateStringLength = (value, fieldName, { min, max }) => {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length < min || trimmedValue.length > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max} characters`);
  }

  return trimmedValue;
};

// Character pattern validation
const validateCharacters = (value, fieldName, pattern) => {
  if (!pattern.test(value)) {
    throw new Error(`${fieldName} contains invalid characters`);
  }
  return value;
};

// Search query sanitization
const sanitizeSearchQuery = (query) => {
  if (!query || typeof query !== 'string') return '';
  
  // Remove potential MongoDB injection characters
  const sanitized = validator.escape(query)
    .replace(/[${}()]/g, '')
    .trim();

  // Limit length to prevent DoS
  return sanitized.substring(0, 100);
};

// Sort parameter validation
const validateSortParameter = (sort, allowedFields = VALIDATION_CONSTANTS.SORT.ALLOWED_FIELDS) => {
  if (!sort) return { createdAt: -1 }; // default sort

  const sortObj = {};
  const sortFields = sort.split(',');

  for (const field of sortFields) {
    const [name, order] = field.trim().split(':');
    if (!allowedFields.includes(name)) {
      throw new Error(`Invalid sort field: ${name}`);
    }
    sortObj[name] = order === 'desc' ? -1 : 1;
  }

  return sortObj;
};

// Task query parameters validation middleware
const validateTaskQueryParams = (req, res, next) => {
  try {
    // Validate and sanitize pagination
    const { page, limit } = validatePaginationParams(
      req.query.page,
      req.query.limit
    );
    req.query.page = page;
    req.query.limit = limit;

    // Sanitize project search
    if (req.query.project) {
      req.query.project = sanitizeRegexInput(req.query.project);
    }

    // Validate sort parameters
    if (req.query.sort) {
      req.query.sort = validateSortParameter(req.query.sort);
    }

    // Sanitize status and priority
    if (req.query.status) {
      req.query.status = validator.escape(req.query.status);
    }
    if (req.query.priority) {
      req.query.priority = validator.escape(req.query.priority);
    }

    // Sanitize assignedTo (assuming it's a MongoDB ObjectId)
    if (req.query.assignedTo) {
      if (!validator.isMongoId(req.query.assignedTo)) {
        throw new Error('Invalid assignedTo parameter');
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Task creation validation middleware
const validateTaskCreation = (req, res, next) => {
  try {
    const { title, description, project, dueDate, tags } = req.body;

    // Validate title
    req.body.title = validateStringLength(title, 'Title', VALIDATION_CONSTANTS.TASK.TITLE);
    validateCharacters(req.body.title, 'Title', VALIDATION_CONSTANTS.TASK.TITLE.PATTERN);

    // Validate description if provided
    if (description) {
      req.body.description = validateStringLength(description, 'Description', VALIDATION_CONSTANTS.TASK.DESCRIPTION);
      validateCharacters(req.body.description, 'Description', VALIDATION_CONSTANTS.TASK.DESCRIPTION.PATTERN);
    }

    // Validate project if provided
    if (project) {
      req.body.project = validateStringLength(project, 'Project', VALIDATION_CONSTANTS.TASK.PROJECT);
      validateCharacters(req.body.project, 'Project', VALIDATION_CONSTANTS.TASK.PROJECT.PATTERN);
    }

    // Validate dueDate if provided
    if (dueDate) {
      if (!validator.isISO8601(dueDate)) {
        throw new Error('Invalid due date format');
      }
    }

    // Validate tags if provided
    if (tags) {
      if (!Array.isArray(tags)) {
        throw new Error('Tags must be an array');
      }
      if (tags.length > 10) {
        throw new Error('Maximum 10 tags allowed');
      }
      req.body.tags = tags.map(tag => {
        if (typeof tag !== 'string' || tag.length > 20) {
          throw new Error('Tags must be strings with maximum 20 characters');
        }
        return validator.escape(tag);
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Task update validation middleware
const validateTaskUpdate = (req, res, next) => {
  try {
    const allowedFields = ['title', 'description', 'status', 'priority', 'dueDate', 'assignedTo', 'project', 'tags'];
    const updates = Object.keys(req.body);
    
    // Check for invalid fields
    const invalidFields = updates.filter(field => !allowedFields.includes(field));
    if (invalidFields.length > 0) {
      throw new Error(`Invalid update fields: ${invalidFields.join(', ')}`);
    }

    // Validate each field that's being updated
    if (req.body.title) {
      req.body.title = validateStringLength(req.body.title, 'Title', VALIDATION_CONSTANTS.TASK.TITLE);
      validateCharacters(req.body.title, 'Title', VALIDATION_CONSTANTS.TASK.TITLE.PATTERN);
    }

    if (req.body.description) {
      req.body.description = validateStringLength(req.body.description, 'Description', VALIDATION_CONSTANTS.TASK.DESCRIPTION);
      validateCharacters(req.body.description, 'Description', VALIDATION_CONSTANTS.TASK.DESCRIPTION.PATTERN);
    }

    if (req.body.project) {
      req.body.project = validateStringLength(req.body.project, 'Project', VALIDATION_CONSTANTS.TASK.PROJECT);
      validateCharacters(req.body.project, 'Project', VALIDATION_CONSTANTS.TASK.PROJECT.PATTERN);
    }

    if (req.body.status) {
      const validStatuses = ['pending', 'in_progress', 'completed', 'blocked'];
      if (!validStatuses.includes(req.body.status)) {
        throw new Error('Invalid status value');
      }
    }

    if (req.body.priority) {
      const validPriorities = ['low', 'medium', 'high'];
      if (!validPriorities.includes(req.body.priority)) {
        throw new Error('Invalid priority value');
      }
    }

    if (req.body.dueDate) {
      if (!validator.isISO8601(req.body.dueDate)) {
        throw new Error('Invalid due date format');
      }
    }

    if (req.body.assignedTo) {
      if (!validator.isMongoId(req.body.assignedTo)) {
        throw new Error('Invalid assignedTo value');
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Comment validation middleware
const validateCommentInput = (req, res, next) => {
  try {
    const { text } = req.body;

    // Validate comment text
    req.body.text = validateStringLength(text, 'Comment', VALIDATION_CONSTANTS.TASK.COMMENT);
    validateCharacters(req.body.text, 'Comment', VALIDATION_CONSTANTS.TASK.COMMENT.PATTERN);

    // Additional XSS protection
    req.body.text = validator.escape(req.body.text);

    next();
  } catch (error) {
    next(error);
  }
};

// Reusable pagination middleware
const validatePaginationMiddleware = (req, res, next) => {
  try {
    const { page, limit } = validatePaginationParams(
      req.query.page,
      req.query.limit
    );
    req.query.page = page;
    req.query.limit = limit;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  VALIDATION_CONSTANTS,
  handleValidationErrors,
  sanitizeRegexInput,
  validatePaginationParams,
  validateStringLength,
  validateCharacters,
  sanitizeSearchQuery,
  validateSortParameter,
  validateTaskQueryParams,
  validateTaskCreation,
  validateTaskUpdate,
  validateCommentInput,
  validatePaginationMiddleware,

  // Safe regex escape function
  escapeRegex: (string) => {
    if (!string || typeof string !== 'string') return '';
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, VALIDATION_CONSTANTS.SEARCH.MAX_LENGTH);
  },

  // Parse positive integer with bounds
  parsePositiveInt: (value, min, max, defaultValue) => {
    const num = parseInt(value);
    if (isNaN(num) || num < min) return defaultValue || min;
    if (num > max) return max;
    return num;
  },

  // Parse and validate sort parameter
  parseSort: (sort) => {
    if (!sort) return VALIDATION_CONSTANTS.SORT.DEFAULT_SORT;

    try {
      const sortObj = {};
      const fields = sort.split(',');

      for (const field of fields) {
        const [name, direction] = field.trim().split(':');
        if (!VALIDATION_CONSTANTS.SORT.ALLOWED_FIELDS.includes(name)) {
          continue;
        }
        sortObj[name] = direction === 'desc' ? -1 : 1;
      }

      return Object.keys(sortObj).length > 0 ? sortObj : VALIDATION_CONSTANTS.SORT.DEFAULT_SORT;
    } catch (error) {
      return VALIDATION_CONSTANTS.SORT.DEFAULT_SORT;
    }
  },

  // Validate MongoDB ObjectId
  isValidObjectId: (id) => {
    return mongoose.Types.ObjectId.isValid(id);
  },

  // String sanitization
  sanitizeString: (str, maxLength = 100) => {
    if (!str || typeof str !== 'string') return '';
    return validator.escape(str.trim()).slice(0, maxLength);
  },

  // Tags array sanitization
  sanitizeTags: (tags) => {
    if (!Array.isArray(tags)) return [];
    if (tags.length > VALIDATION_CONSTANTS.TASK.TAG.MAX_COUNT) {
      tags = tags.slice(0, VALIDATION_CONSTANTS.TASK.TAG.MAX_COUNT);
    }
    return tags
      .filter(tag => typeof tag === 'string' && VALIDATION_CONSTANTS.TASK.TAG.PATTERN.test(tag))
      .map(tag => validator.escape(tag));
  },

  // Strip HTML tags
  stripTags: (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '');
  }
};
