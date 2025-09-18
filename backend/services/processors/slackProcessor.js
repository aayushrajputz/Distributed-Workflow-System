const { createSlackRequest } = require('../../utils/requestUtils');
const logger = require('../../utils/logger');

/**
 * Process Slack notification job
 * @param {Object} job - Bull job object
 * @returns {Promise} Processing result
 */
async function processSlackNotification(job) {
  const { webhookUrl, message, options } = job.data;
  
  logger.info(`Processing Slack notification job ${job.id}`, {
    message: message.text || message
  });

  try {
    const response = await createSlackRequest(webhookUrl, message, options);
    return {
      success: true,
      statusCode: response.status,
      response: response.data
    };
  } catch (error) {
    logger.error(`Slack notification failed for job ${job.id}:`, error);
    throw error; // Let BullMQ handle retries based on queue configuration
  }
}

module.exports = { processSlackNotification };