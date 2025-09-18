const nodemailer = require('nodemailer');
const logger = require('../../utils/logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Process email notification job
 * @param {Object} job - Bull job object
 * @returns {Promise} Processing result
 */
async function processEmailNotification(job) {
  const { to, subject, html, text, from, attachments } = job.data;
  
  logger.info(`Processing email notification job ${job.id}`, {
    to,
    subject
  });

  try {
    const response = await transporter.sendMail({
      from: from || process.env.SMTP_FROM,
      to,
      subject,
      html,
      text,
      attachments
    });

    return {
      success: true,
      messageId: response.messageId
    };
  } catch (error) {
    logger.error(`Email notification failed for job ${job.id}:`, error);
    throw error;
  }
}

module.exports = { processEmailNotification };