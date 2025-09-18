const { Worker, Queue } = require('bullmq');
const Redis = require('ioredis');
const logger = require('../utils/logger');
const { processSlackNotification } = require('./processors/slackProcessor');
const { processJiraOperation } = require('./processors/jiraProcessor');
const { processEmailNotification } = require('./processors/emailProcessor');
const { processWebhook } = require('./processors/webhookProcessor');
const { processBatchNotifications } = require('./processors/notificationBatchProcessor');

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

// Create Redis connection
const connection = new Redis(redisConfig);

// Queue configurations
const queueConfigs = {
  'slack-notifications': {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: 100,
      removeOnFail: 500
    }
  },
  'jira-operations': {
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: 100,
      removeOnFail: 500
    }
  },
  'email-notifications': {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: 100,
      removeOnFail: 500
    }
  },
  'webhook-calls': {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      timeout: 12000,
      removeOnComplete: 100,
      removeOnFail: 500
    }
  },
  'notification-batches': {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: 100,
      removeOnFail: 500
    }
  }
};

// Create queues
const queues = {};
for (const [queueName, config] of Object.entries(queueConfigs)) {
  queues[queueName] = new Queue(queueName, {
    connection,
    defaultJobOptions: config.defaultJobOptions
  });
}

// Create workers
const workers = {
  'slack-notifications': new Worker('slack-notifications', processSlackNotification, { connection }),
  'jira-operations': new Worker('jira-operations', processJiraOperation, { connection }),
  'email-notifications': new Worker('email-notifications', processEmailNotification, { connection }),
  'webhook-calls': new Worker('webhook-calls', processWebhook, { connection }),
  'notification-batches': new Worker('notification-batches', processBatchNotifications, { connection })
};

// Error handling for workers
Object.entries(workers).forEach(([name, worker]) => {
  worker.on('failed', (job, err) => {
    logger.error(`Job failed in ${name} queue:`, {
      jobId: job.id,
      error: err.message,
      stack: err.stack
    });
  });

  worker.on('completed', (job) => {
    logger.info(`Job completed in ${name} queue:`, {
      jobId: job.id,
      result: job.returnvalue
    });
  });

  worker.on('error', (err) => {
    logger.error(`Error in ${name} worker:`, {
      error: err.message,
      stack: err.stack
    });
  });
});

// Graceful shutdown handler
async function gracefulShutdown() {
  logger.info('Shutting down background workers...');
  
  // Close all workers
  await Promise.all(Object.values(workers).map(worker => worker.close()));
  
  // Close all queues
  await Promise.all(Object.values(queues).map(queue => queue.close()));
  
  // Close Redis connection
  await connection.quit();
  
  logger.info('Background workers shut down successfully');
  process.exit(0);
}

// Handle process termination
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = {
  queues,
  workers,
  connection,
  gracefulShutdown
};