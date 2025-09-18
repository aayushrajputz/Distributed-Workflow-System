/** @type {import('jest').Config} */
module.exports = {
  // Test environment and execution
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  testTimeout: 10000,
  detectOpenHandles: true,
  forceExit: true,
  verbose: true,

  // Coverage configuration - initially scoped to core components
  collectCoverage: true,
  collectCoverageFrom: [
    'models/**/*.js',
    'controllers/**/*.js',
    'middleware/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
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