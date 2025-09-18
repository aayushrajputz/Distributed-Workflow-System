const logger = require('../../utils/logger');
const { queues } = require('../backgroundWorker');

/**
 * Process notification batch job
 * @param {Object} job - Bull job object
 * @returns {Promise} Processing result
 */
async function processBatchNotifications(job) {
  const { notifications, type } = job.data;
  
  logger.info(`Processing notification batch job ${job.id}`, {
    type,
    count: notifications.length
  });

  const results = {
    success: [],
    failed: []
  };

  // Group notifications by recipient and type for efficient processing
  const groups = groupNotifications(notifications);

  // Process each group
  for (const [key, group] of Object.entries(groups)) {
    try {
      // Based on notification type, queue appropriate job
      const result = await queueGroupedNotifications(group);
      results.success.push({
        group: key,
        count: group.notifications.length,
        result
      });
    } catch (error) {
      logger.error(`Failed to process notification group ${key}:`, error);
      results.failed.push({
        group: key,
        count: group.notifications.length,
        error: error.message
      });
      
      // If group processing fails, queue individual notifications
      await queueIndividualNotifications(group.notifications);
    }
  }

  return results;
}

/**
 * Group notifications by recipient and type
 */
function groupNotifications(notifications) {
  const groups = {};
  
  for (const notification of notifications) {
    const key = `${notification.recipient}_${notification.type}`;
    if (!groups[key]) {
      groups[key] = {
        type: notification.type,
        recipient: notification.recipient,
        notifications: []
      };
    }
    groups[key].notifications.push(notification);
  }
  
  return groups;
}

/**
 * Queue notification jobs based on group type
 */
async function queueGroupedNotifications(group) {
  switch (group.type) {
    case 'email':
      return await queues['email-notifications'].add('batch-email', {
        to: group.recipient,
        notifications: group.notifications,
        template: 'digest'
      });
      
    case 'slack':
      return await queues['slack-notifications'].add('batch-message', {
        channel: group.recipient,
        messages: group.notifications.map(n => n.message)
      });
      
    default:
      throw new Error(`Unknown notification type: ${group.type}`);
  }
}

/**
 * Queue individual notifications as fallback
 */
async function queueIndividualNotifications(notifications) {
  for (const notification of notifications) {
    try {
      switch (notification.type) {
        case 'email':
          await queues['email-notifications'].add('single-email', notification);
          break;
          
        case 'slack':
          await queues['slack-notifications'].add('single-message', notification);
          break;
      }
    } catch (error) {
      logger.error(`Failed to queue individual notification:`, error);
    }
  }
}

module.exports = { processBatchNotifications };