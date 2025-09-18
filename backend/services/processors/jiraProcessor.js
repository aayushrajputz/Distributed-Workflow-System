const { createJiraRequest } = require('../../utils/requestUtils');
const logger = require('../../utils/logger');

/**
 * Process Jira operation job
 * @param {Object} job - Bull job object
 * @returns {Promise} Processing result
 */
async function processJiraOperation(job) {
  const { operation, data, auth, options } = job.data;
  
  logger.info(`Processing Jira ${operation} job ${job.id}`, {
    type: operation,
    ...data
  });

  try {
    const response = await createJiraRequest(
      data.url,
      data.payload,
      auth,
      {
        method: data.method || 'POST',
        ...options
      }
    );

    return {
      success: true,
      statusCode: response.status,
      response: response.data,
      operation
    };
  } catch (error) {
    logger.error(`Jira operation failed for job ${job.id}:`, error);
    throw error;
  }
}

module.exports = { processJiraOperation };