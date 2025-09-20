// Helper functions for environment validation
const requireVar = (name) => {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return process.env[name];
};

const requireNumber = (name, { min, max } = {}) => {
  const value = Number(process.env[name]);
  if (isNaN(value)) {
    throw new Error(`${name} must be a valid number`);
  }
  if (min !== undefined && value < min) {
    throw new Error(`${name} must be at least ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`${name} must not exceed ${max}`);
  }
  return value;
};

const requireUrl = (name) => {
  try {
    const url = new URL(requireVar(name));
    return url.toString();
  } catch (error) {
    throw new Error(`${name} must be a valid URL`);
  }
};

const parseCsv = (name) => {
  if (!process.env[name]) return [];
  return process.env[name].split(',').map(item => item.trim()).filter(Boolean);
};

const warnIf = (predicate, msg) => {
  if (predicate) {
    console.warn(`⚠️ WARNING: ${msg}`);
  }
};

const validateEnvironment = () => {
  const isProd = process.env.NODE_ENV === 'production';
  
  // Core required variables
  requireVar('MONGODB_URI');
  requireVar('JWT_SECRET');
  requireVar('NODE_ENV');
  // Support both REFRESH_TOKEN_SECRET and JWT_REFRESH_SECRET env names
  if (!process.env.REFRESH_TOKEN_SECRET && !process.env.JWT_REFRESH_SECRET) {
    throw new Error('Missing required environment variable: REFRESH_TOKEN_SECRET or JWT_REFRESH_SECRET');
  }
  // In production, require PORT and CLIENT_URL; in development allow defaults
  if (isProd) {
    requireVar('PORT');
    requireVar('CLIENT_URL');
  }
  
  // Validate JWT_SECRET length
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }

  // Validate MONGODB_URI format
  if (!process.env.MONGODB_URI.startsWith('mongodb')) {
    throw new Error('MONGODB_URI must be a valid MongoDB connection string');
  }

  // Validate NODE_ENV
  const validEnvs = ['development', 'test', 'production'];
  if (!validEnvs.includes(process.env.NODE_ENV)) {
    throw new Error(`NODE_ENV must be one of: ${validEnvs.join(', ')}`);
  }

  // Validate refresh secret length and difference
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_REFRESH_SECRET;
  if (refreshSecret.length < 32) {
    throw new Error('Refresh token secret must be at least 32 characters long for security');
  }
  if (refreshSecret === process.env.JWT_SECRET) {
    throw new Error('Refresh token secret must be different from JWT_SECRET for security');
  }

  // Validate PORT as a number
  if (process.env.PORT) {
    requireNumber('PORT', { min: 1, max: 65535 });
  }

  // Validate CLIENT_URL as a proper URL if provided
  if (process.env.CLIENT_URL) {
    requireUrl('CLIENT_URL');
  }

  // Validate CORS_ORIGINS
  const origins = parseCsv('CORS_ORIGINS');
  if (origins.length === 0 && isProd) {
    console.warn('⚠️ CORS_ORIGINS should be explicitly set in production');
  }

  // Validate rate limits as integers with ranges if provided (enforced in production)
  if (process.env.RATE_LIMIT_WINDOW_MS) requireNumber('RATE_LIMIT_WINDOW_MS', {min: 60000, max: 24*60*60*1000});
  if (process.env.RATE_LIMIT_MAX_REQUESTS) requireNumber('RATE_LIMIT_MAX_REQUESTS', {min: 1, max: 1000});
  if (process.env.API_KEY_RATE_LIMIT) requireNumber('API_KEY_RATE_LIMIT', {min: 1, max: 100000});

  // Validate CORS_ORIGINS
  const corsOrigins = parseCsv('CORS_ORIGINS');
  corsOrigins.forEach(origin => {
    try {
      new URL(origin);
    } catch (error) {
      throw new Error(`Invalid URL in CORS_ORIGINS: ${origin}`);
    }
  });

  // Production-specific validations
  if (isProd) {
    // Validate security-specific variables in production
    const prodSecurityVars = [
      'CSRF_COOKIE_NAME',
      'CSRF_HEADER_NAME',
      'RATE_LIMIT_WINDOW_MS',
      'RATE_LIMIT_MAX_REQUESTS',
      'API_KEY_RATE_LIMIT'
    ];
    
    // Ensure API_KEY_SECRET is strong in production
    const apiKeySecret = requireVar('API_KEY_SECRET');
    if (apiKeySecret.length < 32) {
      throw new Error('API_KEY_SECRET must be at least 32 characters long in production');
    }
    
    // Ensure ENCRYPTION_KEY is strong in production
    const encryptionKey = requireVar('ENCRYPTION_KEY');
    if (encryptionKey.length < 64) {
      throw new Error('ENCRYPTION_KEY must be at least 64 characters long for AES-256 in production');
    }
    
    // Ensure CSRF cookie is secure in production
    if (process.env.CSRF_COOKIE_SECURE !== 'true') {
      throw new Error('CSRF_COOKIE_SECURE must be set to "true" in production for security');
    }

    prodSecurityVars.forEach(requireVar);
    
    // Validate rate limiting settings
    if (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) > 500) {
      console.warn('⚠️ RATE_LIMIT_MAX_REQUESTS is set very high for production');
    }
  }

  console.log('✅ Environment validation passed');
};

// Security configuration validation
const validateSecurityConfig = () => {
  const isProd = process.env.NODE_ENV === 'production';

  // Validate encryption key
  if (process.env.ENCRYPTION_KEY) {
    if (process.env.ENCRYPTION_KEY.length < 32) {
      console.warn('⚠️ ENCRYPTION_KEY should be at least 32 characters long for AES-256');
    }
    if (isProd && process.env.ENCRYPTION_KEY.length < 64) {
      throw new Error('ENCRYPTION_KEY must be at least 64 characters long in production for AES-256');
    }
  } else if (isProd) {
    throw new Error('ENCRYPTION_KEY is required in production environment');
  }

  // Validate API key secret
  if (process.env.API_KEY_SECRET) {
    if (process.env.API_KEY_SECRET === 'default-secret' || 
        process.env.API_KEY_SECRET.length < 32) {
      const msg = 'API_KEY_SECRET is using a default or weak value';
      if (isProd) {
        throw new Error(msg);
      } else {
        console.warn(`⚠️ ${msg}`);
      }
    }
  } else if (isProd) {
    throw new Error('API_KEY_SECRET is required in production environment');
  }

  // Validate rate limiting
  if (process.env.RATE_LIMIT_WINDOW_MS && process.env.RATE_LIMIT_MAX_REQUESTS) {
    try {
      requireNumber('RATE_LIMIT_WINDOW_MS', { min: 60000, max: 24*60*60*1000 });
      requireNumber('RATE_LIMIT_MAX_REQUESTS', { min: 1, max: 1000 });
      
      if (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) > 100) {
        console.warn('⚠️ RATE_LIMIT_MAX_REQUESTS is set high. Consider lowering for better security.');
      }
    } catch (error) {
      if (isProd) throw error;
      console.warn(`⚠️ Rate limiting configuration issue: ${error.message}`);
    }
  }

  // Validate API key rate limit
  if (process.env.API_KEY_RATE_LIMIT) {
    try {
      requireNumber('API_KEY_RATE_LIMIT', { min: 1, max: 100000 });
    } catch (error) {
      if (isProd) throw error;
      console.warn(`⚠️ API key rate limit configuration issue: ${error.message}`);
    }
  }

  // CSRF validation
  if (isProd) {
    if (!process.env.CSRF_COOKIE_NAME || !process.env.CSRF_HEADER_NAME) {
      throw new Error('CSRF_COOKIE_NAME and CSRF_HEADER_NAME are required in production');
    }
    if (process.env.CSRF_COOKIE_SECURE !== 'true') {
      throw new Error('CSRF_COOKIE_SECURE must be set to "true" in production');
    }
  }

  // Validate email configuration if enabled
  if (process.env.EMAIL_HOST) {
    if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
      console.warn('⚠️ Email configuration is incomplete. EMAIL_USERNAME and EMAIL_PASSWORD are required');
    }
    
    if (process.env.EMAIL_PORT && !['25', '465', '587', '2525'].includes(process.env.EMAIL_PORT)) {
      console.warn('⚠️ EMAIL_PORT is set to an unusual value. Common SMTP ports are 25, 465, 587, or 2525');
    }
  }

  // Validate webhook secrets
  if (process.env.ENABLE_WEBHOOKS === 'true') {
    if (process.env.GITHUB_WEBHOOK_SECRET && process.env.GITHUB_WEBHOOK_SECRET.length < 16) {
      console.warn('⚠️ GITHUB_WEBHOOK_SECRET should be at least 16 characters long');
    }
  }

  // Validate Redis configuration if provided
  if (process.env.REDIS_URL && !process.env.REDIS_PASSWORD && isProd) {
    console.warn('⚠️ Redis is configured without a password in production');
  }

  // Validate CSP directives
  if (!process.env.CSP_DIRECTIVES && isProd) {
    console.warn('⚠️ Content Security Policy directives not configured for production');
  }

  console.log('✅ Security configuration validation completed');
};

module.exports = {
  validateEnvironment,
  validateSecurityConfig,
  // Export helper functions for use in other modules
  requireVar,
  requireNumber,
  requireUrl,
  parseCsv,
  warnIf
};