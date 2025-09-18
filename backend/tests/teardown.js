const mongoose = require('mongoose');

module.exports = async () => {
  // Ensure all mongoose connections are closed
  await mongoose.disconnect();

  // Clear all mocks
  jest.clearAllMocks();
  jest.resetModules();

  // Clear any remaining timeouts or intervals
  jest.useRealTimers();

  // Reset any modified globals
  if (global.originalDate) {
    global.Date = global.originalDate;
  }

  // Clear any test data from memory
  if (global.testData) {
    delete global.testData;
  }

  // Clear any rate limiter data
  if (global.rateLimitStore) {
    global.rateLimitStore.clear();
  }

  // Reset environment variables to initial state
  process.env.NODE_ENV = 'test';
};