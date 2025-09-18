/** @type {import('jest').Config} */
module.exports = {
  // Test environment and execution
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  testTimeout: 30000,
  detectOpenHandles: true,
  forceExit: true,
  verbose: true,

  // Integration test specific configuration
  projects: [
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      testTimeout: 30000,
      maxWorkers: 1,
      setupFilesAfterEnv: [
        '<rootDir>/tests/jest.setup.js',
        '<rootDir>/tests/integration/setup.js'
      ]
    },
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/**/*.test.js'],
      testPathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/', '/tests/integration/']
    }
  ],

  // Coverage configuration - initially scoped to core components
  collectCoverage: true,
  collectCoverageFrom: [
    'models/**/*.js',
    'controllers/**/*.js',
    'middleware/**/*.js',
    'services/**/*.js',
    'routes/**/*.js',
    'sockets/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/coverage/**',
    '!**/dist/**'
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60
    },
    './models/': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80
    },
    './services/': {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70
    },
    './routes/': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80
    },
    './sockets/': {
      statements: 75,
      branches: 65,
      functions: 75,
      lines: 75
    }
  },

  // File patterns and locations
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  moduleFileExtensions: ['js', 'json'],

  // Performance and execution
  maxWorkers: '50%',
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,

  // Reporter configuration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results/junit',
      outputName: 'junit.xml',
      classNameTemplate: '{filepath}',
      titleTemplate: '{title}'
    }]
  ],

  // Error handling
  bail: false,
  silent: false
};