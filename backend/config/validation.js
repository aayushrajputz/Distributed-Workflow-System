const validateEnvironment = () => {
  const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'NODE_ENV',
  ];

  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  // Validate MongoDB URI format
  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.startsWith('mongodb')) {
    throw new Error('MONGODB_URI must be a valid MongoDB connection string');
  }

  // Validate NODE_ENV
  const validEnvs = ['development', 'production', 'test'];
  if (!validEnvs.includes(process.env.NODE_ENV)) {
    throw new Error(`NODE_ENV must be one of: ${validEnvs.join(', ')}`);
  }

  console.log('✅ Environment validation passed');
};

const validateSecurityConfig = () => {
  // Check for weak encryption keys
  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 64) {
    console.warn('⚠️ ENCRYPTION_KEY should be at least 64 characters for AES-256');
  }

  // Check for weak API key secrets
  if (process.env.API_KEY_SECRET && process.env.API_KEY_SECRET === 'default-secret') {
    console.warn('⚠️ API_KEY_SECRET should be changed from default value');
  }

  // Validate rate limiting configuration
  const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100;

  if (rateLimitMax > 1000) {
    console.warn('⚠️ Rate limit is set very high, consider reducing for security');
  }

  console.log('✅ Security configuration validation passed');
};

module.exports = {
  validateEnvironment,
  validateSecurityConfig,
};