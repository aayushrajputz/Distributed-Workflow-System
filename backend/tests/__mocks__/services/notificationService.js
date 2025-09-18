module.exports = {
  sendNotification: jest.fn().mockResolvedValue({ success: true }),
  batchNotifications: jest.fn().mockResolvedValue({ success: true }),
  sendDigestEmail: jest.fn().mockResolvedValue({ success: true }),
  sendTaskAssignmentNotification: jest.fn().mockResolvedValue({ success: true }),
  sendTaskStatusUpdateNotification: jest.fn().mockResolvedValue({ success: true }),
  sendWorkflowNotification: jest.fn().mockResolvedValue({ success: true }),
};