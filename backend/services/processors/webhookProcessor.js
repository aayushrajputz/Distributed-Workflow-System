const { createWebhookRequest } = require('../../utils/requestUtils');
const logger = require('../../utils/logger');

/**
 * Process webhook call job
 * @param {Object} job - Bull job object
 * @returns {Promise} Processing result
 */
async function processWebhook(job) {
  const { url, data, config, options } = job.data;
  
  logger.info(`Processing webhook job ${job.id}`, {
    url,
    type: config?.headers?.['X-Webhook-Type'] || 'general'
  });

  try {
    const response = await createWebhookRequest(url, data, config, options);
    return {
      success: true,
      statusCode: response.status,
      response: response.data
    };
  } catch (error) {
    logger.error(`Webhook call failed for job ${job.id}:`, error);
    throw error;
  }
}

module.exports = { processWebhook };