import nodemailer from 'nodemailer';

// Create transporter
const createTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('Email service not configured. Email features will be disabled.');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false // Allow self-signed certificates in development
    }
  });
};

// Send verification email
export const sendVerificationEmail = async (email: string, token: string): Promise<void> => {
  const transporter = createTransporter();
  if (!transporter) {
    throw new Error('Email service not configured');
  }

  const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Verify Your Email - Workflow Management System',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f9fafb; }
          .button { 
            display: inline-block; 
            background: #3b82f6; 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Workflow Management System</h1>
          </div>
          <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Thank you for signing up! Please click the button below to verify your email address and activate your account.</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #3b82f6;">${verificationUrl}</p>
            
            <p><strong>This link will expire in 24 hours.</strong></p>
            
            <p>If you didn't create an account with us, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 Workflow Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Welcome to Workflow Management System!
      
      Please verify your email address by visiting this link:
      ${verificationUrl}
      
      This link will expire in 24 hours.
      
      If you didn't create an account with us, please ignore this email.
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (email: string, token: string): Promise<void> => {
  const transporter = createTransporter();
  if (!transporter) {
    throw new Error('Email service not configured');
  }

  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Password Reset - Workflow Management System',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f9fafb; }
          .button { 
            display: inline-block; 
            background: #ef4444; 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your password for your Workflow Management System account.</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #ef4444;">${resetUrl}</p>
            
            <div class="warning">
              <strong>⚠️ Important:</strong>
              <ul>
                <li>This link will expire in 10 minutes for security reasons</li>
                <li>You can only use this link once</li>
                <li>If you didn't request this reset, please ignore this email</li>
              </ul>
            </div>
            
            <p>If you continue to have problems, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>© 2024 Workflow Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Password Reset Request
      
      We received a request to reset your password for your Workflow Management System account.
      
      Please reset your password by visiting this link:
      ${resetUrl}
      
      This link will expire in 10 minutes for security reasons.
      
      If you didn't request this reset, please ignore this email.
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

// Send task notification email
export const sendTaskNotificationEmail = async (
  email: string, 
  type: 'assigned' | 'completed' | 'overdue' | 'reminder',
  taskData: any
): Promise<void> => {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('Email service not configured, skipping task notification email');
    return;
  }

  let subject = '';
  let heading = '';
  let message = '';
  let color = '#3b82f6';

  switch (type) {
    case 'assigned':
      subject = `New Task Assigned: ${taskData.title}`;
      heading = 'New Task Assigned';
      message = `You have been assigned a new task: "${taskData.title}"`;
      color = '#10b981';
      break;
    case 'completed':
      subject = `Task Completed: ${taskData.title}`;
      heading = 'Task Completed';
      message = `The task "${taskData.title}" has been completed.`;
      color = '#10b981';
      break;
    case 'overdue':
      subject = `Task Overdue: ${taskData.title}`;
      heading = 'Task Overdue';
      message = `The task "${taskData.title}" is now overdue.`;
      color = '#ef4444';
      break;
    case 'reminder':
      subject = `Task Reminder: ${taskData.title}`;
      heading = 'Task Reminder';
      message = `Reminder: The task "${taskData.title}" is due soon.`;
      color = '#f59e0b';
      break;
  }

  const taskUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/tasks/${taskData._id}`;
  
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${color}; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f9fafb; }
          .task-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .button { 
            display: inline-block; 
            background: ${color}; 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${heading}</h1>
          </div>
          <div class="content">
            <p>${message}</p>
            
            <div class="task-details">
              <h3>${taskData.title}</h3>
              <p><strong>Description:</strong> ${taskData.description}</p>
              <p><strong>Priority:</strong> ${taskData.priority}</p>
              <p><strong>Due Date:</strong> ${new Date(taskData.dueDate).toLocaleDateString()}</p>
              <p><strong>Project:</strong> ${taskData.project}</p>
            </div>
            
            <div style="text-align: center;">
              <a href="${taskUrl}" class="button">View Task</a>
            </div>
          </div>
          <div class="footer">
            <p>© 2024 Workflow Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ${heading}
      
      ${message}
      
      Task Details:
      - Title: ${taskData.title}
      - Description: ${taskData.description}
      - Priority: ${taskData.priority}
      - Due Date: ${new Date(taskData.dueDate).toLocaleDateString()}
      - Project: ${taskData.project}
      
      View task: ${taskUrl}
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Task notification email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send task notification email:', error);
    // Don't throw error for notification emails
  }
};

// Test email configuration
export const testEmailConfiguration = async (): Promise<boolean> => {
  const transporter = createTransporter();
  if (!transporter) {
    return false;
  }

  try {
    await transporter.verify();
    console.log('Email configuration is valid');
    return true;
  } catch (error) {
    console.error('Email configuration test failed:', error);
    return false;
  }
};
