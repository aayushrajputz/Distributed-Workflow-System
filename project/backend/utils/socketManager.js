let io = null;

const setIO = (socketIO) => {
  io = socketIO;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

// Emit workflow execution updates
const emitWorkflowUpdate = (executionId, update) => {
  if (io) {
    io.to(`execution_${executionId}`).emit('workflow_execution_update', {
      executionId,
      ...update,
      timestamp: new Date().toISOString()
    });
  }
};

// Emit integration health updates
const emitIntegrationHealth = (userId, healthData) => {
  if (io) {
    io.to(`integration_health_${userId}`).emit('integration_health_update', {
      ...healthData,
      timestamp: new Date().toISOString()
    });
  }
};

// Emit audit log events
const emitAuditLog = (logData) => {
  if (io) {
    io.emit('audit_log', {
      ...logData,
      timestamp: new Date().toISOString()
    });
  }
};

// Emit user-specific notifications
const emitUserNotification = (userId, notification) => {
  if (io) {
    io.to(`user_${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date().toISOString()
    });
  }
};

// Emit system-wide alerts
const emitSystemAlert = (alert) => {
  if (io) {
    io.emit('system_alert', {
      ...alert,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  setIO,
  getIO,
  emitWorkflowUpdate,
  emitIntegrationHealth,
  emitAuditLog,
  emitUserNotification,
  emitSystemAlert
};
