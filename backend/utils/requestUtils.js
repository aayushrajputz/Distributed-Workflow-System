const axios = require('axios');
const axiosRetry = require('axios-retry').default || require('axios-retry');
const pTimeout = require('p-timeout');
const logger = require('./logger');

// Circuit breaker state
const circuitBreakers = new Map();

// Circuit breaker configuration
const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT = 60000; // 1 minute
const HALF_OPEN_REQUESTS = 3;

class CircuitBreaker {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.failures = 0;
    this.state = 'closed'; // closed, open, half-open
    this.lastError = null;
    this.nextAttempt = Date.now();
  }

  async executeRequest(requestFn) {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is open for ${this.serviceName}`);
      }
      this.state = 'half-open';
      this.failures = 0;
    }

    try {
      const result = await requestFn();
      if (this.state === 'half-open') {
        this.state = 'closed';
        logger.info(`Circuit breaker closed for ${this.serviceName}`);
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastError = error;

      if (this.failures >= FAILURE_THRESHOLD || this.state === 'half-open') {
        this.state = 'open';
        this.nextAttempt = Date.now() + RESET_TIMEOUT;
        logger.error(`Circuit breaker opened for ${this.serviceName}: ${error.message}`);
      }
      throw error;
    }
  }
}

// Configure axios retry with exponential backoff
axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount, error) => axiosRetry.exponentialDelay(retryCount, error),
  retryCondition: (error) => {
    return (axiosRetry.isNetworkOrIdempotentRequestError
              ? axiosRetry.isNetworkOrIdempotentRequestError(error)
              : ['ECONNABORTED', 'ENOTFOUND', 'ETIMEDOUT'].includes(error.code)) ||
           (error.response && error.response.status >= 500);
  }
});

/**
 * Make a request with timeout, retry, and circuit breaker pattern
 * @param {Object} config - Axios request configuration
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} serviceName - Name of the service (for circuit breaker)
 * @returns {Promise} - Request promise
 */
async function requestWithTimeout(config, timeoutMs, serviceName) {
  // Get or create circuit breaker
  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(serviceName, new CircuitBreaker(serviceName));
  }
  const breaker = circuitBreakers.get(serviceName);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await breaker.executeRequest(async () => {
      const response = await pTimeout(
        axios({
          ...config,
          signal: controller.signal
        }),
        timeoutMs,
        `Request to ${serviceName} timed out after ${timeoutMs}ms`
      );
      return response;
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Helper functions for different services
function createSlackRequest(url, data, options = {}) {
  return requestWithTimeout({
    url,
    method: 'POST',
    data,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  }, options.timeout || 5000, 'slack');
}

function createJiraRequest(url, data, auth, options = {}) {
  return requestWithTimeout({
    url,
    method: options.method || 'POST',
    data,
    auth,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  }, options.timeout || 15000, 'jira');
}

function createGitHubRequest(url, data, token, options = {}) {
  return requestWithTimeout({
    url,
    method: options.method || 'POST',
    data,
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
      ...options.headers
    }
  }, options.timeout || 8000, 'github');
}

function createWebhookRequest(url, data, config = {}, options = {}) {
  return requestWithTimeout({
    url,
    method: 'POST',
    data,
    ...config,
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
      ...options.headers
    }
  }, options.timeout || 12000, 'webhook');
}

// Service health monitoring
function getCircuitBreakerStatus(serviceName) {
  const breaker = circuitBreakers.get(serviceName);
  if (!breaker) return null;
  
  return {
    serviceName,
    state: breaker.state,
    failures: breaker.failures,
    lastError: breaker.lastError ? breaker.lastError.message : null,
    nextAttempt: breaker.nextAttempt
  };
}

function getAllCircuitBreakersStatus() {
  const status = {};
  for (const [serviceName, breaker] of circuitBreakers) {
    status[serviceName] = getCircuitBreakerStatus(serviceName);
  }
  return status;
}

function resetCircuitBreaker(serviceName) {
  const breaker = circuitBreakers.get(serviceName);
  if (breaker) {
    breaker.state = 'closed';
    breaker.failures = 0;
    breaker.lastError = null;
    breaker.nextAttempt = Date.now();
    logger.info(`Circuit breaker manually reset for ${serviceName}`);
  }
}

module.exports = {
  requestWithTimeout,
  createSlackRequest,
  createJiraRequest,
  createGitHubRequest,
  createWebhookRequest,
  getCircuitBreakerStatus,
  getAllCircuitBreakersStatus,
  resetCircuitBreaker
};