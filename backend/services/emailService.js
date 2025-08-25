const nodemailer = require('nodemailer');
const crypto = require('crypto');

class EmailService {
  constructor() {
    // Check if email credentials are configured
    this.isConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

    if (this.isConfigured) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      console.warn('⚠️  Email service not configured - SMTP credentials missing');
      this.transporter = null;
    }
  }

  // Generate email verification token
  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Send email verification email
  async sendVerificationEmail(email, firstName, verificationToken) {
    // Check if email service is configured
    if (!this.isConfigured || !this.transporter) {
      console.warn('⚠️  Email service not configured - skipping email send');
      throw new Error('Email service not configured. Please set SMTP_USER and SMTP_PASS in .env file.');
    }

    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

    const mailOptions = {
      from: {
        name: 'Workflow Management System',
        address: process.env.SMTP_FROM || process.env.SMTP_USER,
      },
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f8f9fa;
            }
            .container {
              background-color: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 10px;
            }
            .title {
              font-size: 28px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 10px;
            }
            .subtitle {
              font-size: 16px;
              color: #6b7280;
              margin-bottom: 30px;
            }
            .content {
              margin-bottom: 30px;
            }
            .verify-button {
              display: inline-block;
              background-color: #2563eb;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              text-align: center;
              margin: 20px 0;
            }
            .verify-button:hover {
              background-color: #1d4ed8;
            }
            .alternative-link {
              background-color: #f3f4f6;
              padding: 15px;
              border-radius: 6px;
              margin: 20px 0;
              word-break: break-all;
              font-size: 14px;
              color: #6b7280;
            }
            .footer {
              text-align: center;
              font-size: 14px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
              padding-top: 20px;
              margin-top: 30px;
            }
            .warning {
              background-color: #fef3c7;
              border: 1px solid #f59e0b;
              color: #92400e;
              padding: 15px;
              border-radius: 6px;
              margin: 20px 0;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🚀 Workflow Management</div>
              <h1 class="title">Verify Your Email</h1>
              <p class="subtitle">Welcome to our platform, ${firstName}!</p>
            </div>
            
            <div class="content">
              <p>Thank you for signing up! To complete your registration and start using our workflow management system, please verify your email address by clicking the button below:</p>
              
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="verify-button">Verify Email Address</a>
              </div>
              
              <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
              <div class="alternative-link">${verificationUrl}</div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> This verification link will expire in 24 hours for security reasons. If you don't verify your email within this time, you'll need to request a new verification email.
              </div>
              
              <p>Once verified, you'll be able to:</p>
              <ul>
                <li>Access your dashboard and manage workflows</li>
                <li>Create and manage API keys</li>
                <li>Collaborate with team members</li>
                <li>Monitor system status and analytics</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>If you didn't create an account with us, please ignore this email.</p>
              <p>Need help? Contact our support team at support@workflowmanagement.com</p>
              <p>&copy; 2024 Workflow Management System. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to Workflow Management System!
        
        Hi ${firstName},
        
        Thank you for signing up! To complete your registration, please verify your email address by visiting this link:
        
        ${verificationUrl}
        
        This verification link will expire in 24 hours for security reasons.
        
        If you didn't create an account with us, please ignore this email.
        
        Best regards,
        Workflow Management Team
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Verification email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  // Send welcome email after verification
  async sendWelcomeEmail(email, firstName) {
    const mailOptions = {
      from: {
        name: 'Workflow Management System',
        address: process.env.SMTP_FROM || process.env.SMTP_USER,
      },
      to: email,
      subject: 'Welcome to Workflow Management System!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f8f9fa;
            }
            .container {
              background-color: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 10px;
            }
            .title {
              font-size: 28px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 10px;
            }
            .dashboard-button {
              display: inline-block;
              background-color: #10b981;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              text-align: center;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              font-size: 14px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
              padding-top: 20px;
              margin-top: 30px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🎉 Workflow Management</div>
              <h1 class="title">Welcome Aboard!</h1>
            </div>
            
            <div class="content">
              <p>Hi ${firstName},</p>
              <p>Congratulations! Your email has been successfully verified and your account is now active.</p>
              
              <div style="text-align: center;">
                <a href="${process.env.CLIENT_URL}/dashboard" class="dashboard-button">Go to Dashboard</a>
              </div>
              
              <p>You can now access all features of our workflow management system:</p>
              <ul>
                <li>Create and manage workflows</li>
                <li>Generate API keys for integrations</li>
                <li>Monitor system analytics</li>
                <li>Collaborate with your team</li>
              </ul>
              
              <p>If you have any questions or need assistance, don't hesitate to reach out to our support team.</p>
            </div>
            
            <div class="footer">
              <p>Happy workflow managing!</p>
              <p>&copy; 2024 Workflow Management System. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Welcome email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending welcome email:', error);
      // Don't throw error for welcome email as it's not critical
      return { success: false, error: error.message };
    }
  }

  // Send digest email (daily/weekly)
  async sendDigestEmail({ user, tasks, frequency }) {
    const subject = frequency === 'weekly' ? 'Your Weekly Task Digest' : 'Your Daily Task Digest';
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    const items = tasks.map(t => `<li><strong>${t.title}</strong> — ${t.status} — ${t.project} — due ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'n/a'}</li>`).join('');
    const html = `
      <h2>${subject}</h2>
      <p>Hi ${user.firstName || user.email}, here is your summary:</p>
      <ul>${items}</ul>
      <p><a href="${baseUrl}/dashboard/tasks">View tasks</a></p>
    `;
    const text = `${subject}\n\n${tasks.map(t => `- ${t.title} — ${t.status} (${t.project})`).join('\n')}`;

    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          to: user.email,
          subject,
          html,
          text,
        });
      } else {
        console.log('📧 [DEV] Digest email (no transporter):', subject, 'to', user.email);
      }
      return { success: true };
    } catch (e) {
      console.error('Digest send failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  // Send notification email (NEW - for task notifications)
  async sendNotificationEmail(notification, recipient) {
    if (!this.isConfigured || !this.transporter) {
      console.warn('⚠️  Email service not configured - skipping notification email');
      return { success: false, error: 'Email service not configured' };
    }

    const template = this.generateNotificationTemplate(notification, recipient);

    const mailOptions = {
      from: {
        name: 'Workflow Management System',
        address: process.env.SMTP_FROM || process.env.SMTP_USER,
      },
      to: recipient.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`📧 Notification email sent to ${recipient.email}:`, info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending notification email:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate notification email template
  generateNotificationTemplate(notification, recipient) {
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    let actionUrl = `${baseUrl}/dashboard`;

    if (notification.data?.taskId) {
      actionUrl = `${baseUrl}/tasks/${notification.data.taskId}`;
    }

    const typeEmojis = {
      task_assigned: '📋',
      task_completed: '✅',
      task_overdue: '⏰',
      task_escalated: '🚨',
      task_updated: '📝',
      task_comment: '💬',
      workflow_completed: '🎉',
      system_alert: '⚠️',
      daily_digest: '📊',
    };

    const priorityColors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444',
      urgent: '#dc2626',
    };

    const emoji = typeEmojis[notification.type] || '📢';
    const priorityColor = priorityColors[notification.priority] || '#6b7280';

    const subject = `${emoji} ${notification.title}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${notification.title}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #f0f0f0; }
            .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
            .notification-type { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 10px 0; }
            .priority-${notification.priority} { background-color: ${priorityColor}; color: white; }
            .content { padding: 20px 0; }
            .title { font-size: 20px; font-weight: bold; margin-bottom: 10px; color: #1f2937; }
            .message { font-size: 16px; margin-bottom: 20px; color: #4b5563; }
            .task-details { background: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .detail-row { display: flex; justify-content: space-between; margin: 5px 0; }
            .detail-label { font-weight: bold; color: #6b7280; }
            .detail-value { color: #1f2937; }
            .action-button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
            .unsubscribe { color: #9ca3af; font-size: 12px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🔄 Workflow Management</div>
              <div class="notification-type priority-${notification.priority}">
                ${emoji} ${notification.type.replace('_', ' ').toUpperCase()}
              </div>
            </div>

            <div class="content">
              <h1 class="title">${notification.title}</h1>
              <p class="message">${notification.message}</p>

              ${notification.data ? `
                <div class="task-details">
                  <h3>📋 Task Details</h3>
                  ${notification.data.projectName ? `<div class="detail-row"><span class="detail-label">Project:</span><span class="detail-value">${notification.data.projectName}</span></div>` : ''}
                  ${notification.data.priority ? `<div class="detail-row"><span class="detail-label">Priority:</span><span class="detail-value">${notification.data.priority.toUpperCase()}</span></div>` : ''}
                  ${notification.data.dueDate ? `<div class="detail-row"><span class="detail-label">Due Date:</span><span class="detail-value">${new Date(notification.data.dueDate).toLocaleDateString()}</span></div>` : ''}
                  ${notification.data.completedAt ? `<div class="detail-row"><span class="detail-label">Completed:</span><span class="detail-value">${new Date(notification.data.completedAt).toLocaleString()}</span></div>` : ''}
                </div>
              ` : ''}

              <a href="${actionUrl}" class="action-button">View Task →</a>
            </div>

            <div class="footer">
              <p>Hi ${recipient.firstName || recipient.email},</p>
              <p>This notification was sent because you have email notifications enabled for ${notification.type.replace('_', ' ')} events.</p>
              <p class="unsubscribe">
                <a href="${baseUrl}/settings/notifications">Manage notification preferences</a> |
                <a href="${baseUrl}/unsubscribe?token=${recipient._id}">Unsubscribe</a>
              </p>
              <p>&copy; 2024 Workflow Management System. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
${emoji} ${notification.title}

${notification.message}

${notification.data ? `
Task Details:
${notification.data.projectName ? `Project: ${notification.data.projectName}` : ''}
${notification.data.priority ? `Priority: ${notification.data.priority.toUpperCase()}` : ''}
${notification.data.dueDate ? `Due Date: ${new Date(notification.data.dueDate).toLocaleDateString()}` : ''}
${notification.data.completedAt ? `Completed: ${new Date(notification.data.completedAt).toLocaleString()}` : ''}
` : ''}

View Task: ${actionUrl}

---
This notification was sent to ${recipient.email}
Manage preferences: ${baseUrl}/settings/notifications
Unsubscribe: ${baseUrl}/unsubscribe?token=${recipient._id}
    `;

    return { subject, html, text };
  }
}

module.exports = new EmailService();
