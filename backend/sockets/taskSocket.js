const { verifyToken } = require('../config/jwt');
const User = require('../models/User');
const Task = require('../models/Task');
const notificationService = require('../services/notificationService');
const { getPrometheusService } = require('../services/prometheusService');
const logger = require('../utils/logger');

// Configuration constants
const AUTH_RATE_LIMIT = {
  maxFailedAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 30 * 60 * 1000, // 30 minutes
};

const METRICS_DEBOUNCE_MS = 2000;
const TYPING_THROTTLE_MS = 1000;
const TASK_UPDATE_THROTTLE_MS = 500;
const TOKEN_WARNING_THRESHOLD_MS = 5 * 60 * 1000; // warn 5m before expiry
const STALE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute
const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Whether to trust X-Forwarded-For headers for client IPs
const TRUST_PROXY = String(process.env.TRUST_PROXY || '').toLowerCase() === 'true';

class TaskSocketHandler {
  constructor(io) {
    this.io = io;

    // Connection tracking
    this.connectedUsers = new Map(); // userId -> Set<socketId>
    this.userRooms = new Map(); // socketId -> userId
    this.socketConnectedAt = new Map(); // socketId -> timestamp

    // Auth rate limiting state: ip -> { failures, firstAttemptAt, blockedUntil }
    this.authAttempts = new Map();

    // Token expiration monitoring: userId -> { token, expiresAt, warningScheduled, warningTimeoutId }
    this.tokenMonitoring = new Map();
    this.tokenCheckInterval = null;

    // Admin/manager cache
    this.adminManagerCache = new Map(); // userId -> { role, socketIds }
    this.cacheExpiry = 0;

    // Metrics
    this._metricsDebounceMs = METRICS_DEBOUNCE_MS;
    this._metricsTimer = null;
    this.metricsUpdateQueue = new Set();

    // Throttling
    this._typingThrottle = new Map(); // key `${userId}:${taskId}` -> timeoutId
    this.taskUpdateThrottlers = new Map(); // taskId -> lastTimestamp

    // Handlers
    this.setupSocketHandlers();

    // Periodic cleanup
    this._staleCleanupInterval = setInterval(() => this.cleanupStaleConnections(), STALE_CLEANUP_INTERVAL_MS);
  }

 
  addUserSocket(userId, socketId) {
    if (!this.connectedUsers.has(userId)) this.connectedUsers.set(userId, new Set());
    this.connectedUsers.get(userId).add(socketId);
    this.socketConnectedAt.set(socketId, Date.now());
  }

  removeUserSocket(userId, socketId) {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) this.connectedUsers.delete(userId);
    }
    this.socketConnectedAt.delete(socketId);
  }

  emitToUserSockets(userId, event, payload) {
    const userSockets = this.connectedUsers.get(userId);
    if (!userSockets) return 0;

    let validEmitCount = 0;
    for (const socketId of userSockets) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket && socket.connected) {
        socket.emit(event, payload);
        validEmitCount++;
      } else {
        this.removeUserSocket(userId, socketId);
        logger.debug(`Pruned stale socket ${socketId} for user ${userId} during emit`);
      }
    }
    return validEmitCount;
  }

  getUserSockets(userId) {
    const sockets = this.connectedUsers.get(userId);
    if (!sockets) return new Set();

    const validSockets = new Set();
    for (const socketId of sockets) {
      if (this.io.sockets.sockets.has(socketId)) validSockets.add(socketId);
    }

    if (validSockets.size !== sockets.size) {
      if (validSockets.size === 0) this.connectedUsers.delete(userId);
      else this.connectedUsers.set(userId, validSockets);
    }
    return validSockets;
  }

  isUserConnected(userId) {
    return this.getUserSockets(userId).size > 0;
  }

  // ============ Admin Cache ============
  async refreshAdminManagerCache() {
    const startTime = Date.now();
    try {
      const managers = await User.find({
        $or: [{ role: 'admin' }, { role: 'manager' }],
        isActive: true,
      }).select('_id role');

      this.adminManagerCache.clear();
      for (const manager of managers) {
        const sockets = this.getUserSockets(manager._id.toString());
        if (sockets.size > 0) {
          this.adminManagerCache.set(manager._id.toString(), {
            role: manager.role,
            socketIds: Array.from(sockets),
          });
        }
      }
      this.cacheExpiry = Date.now() + ADMIN_CACHE_TTL_MS;
      logger.info(`Admin/manager cache refreshed in ${Date.now() - startTime}ms, ${this.adminManagerCache.size} users cached`);
    } catch (error) {
      logger.error('Error refreshing admin/manager cache', { error });
      throw error;
    }
  }

  isCacheValid() {
    return Date.now() < this.cacheExpiry && this.adminManagerCache.size > 0;
  }

  async getAdminManagerSockets() {
    if (!this.isCacheValid()) await this.refreshAdminManagerCache();
    return this.adminManagerCache;
  }

  invalidateUserCache(userId) {
    if (this.adminManagerCache.has(userId)) {
      this.adminManagerCache.delete(userId);
      logger.debug(`Invalidated cache entry for user ${userId}`);
    }
  }

  handleUserRoleChange(userId, newRole) {
    // Invalidate specific user and force cache refresh soon
    this.invalidateUserCache(userId);
    this.cacheExpiry = 0;
  }

  // ============ Rate Limiting ============
  sanitizeIP(ip) {
    if (!ip) return 'unknown';
    // Strip IPv6 mapped IPv4 prefix ::ffff:
    return ip.startsWith('::ffff:') ? ip.substring(7) : ip;
  }

  getClientIP(socket) {
    const headers = socket.handshake.headers || {};
    let ip;
    if (TRUST_PROXY) {
      const xff = (headers['x-forwarded-for'] || '').toString();
      ip = xff ? xff.split(',')[0].trim() : (headers['x-real-ip'] || socket.handshake.address || socket.conn?.remoteAddress);
    } else {
      ip = socket.handshake.address || socket.conn?.remoteAddress;
    }
    return this.sanitizeIP(ip || 'unknown');
  }

  checkAuthRateLimit(clientIP) {
    const now = Date.now();
    const rec = this.authAttempts.get(clientIP);
    if (!rec) return true;

    if (rec.blockedUntil && now < rec.blockedUntil) return false;

    // Reset window if expired
    if (rec.firstAttemptAt && now - rec.firstAttemptAt > AUTH_RATE_LIMIT.windowMs) {
      this.authAttempts.delete(clientIP);
      return true;
    }
    return true;
  }

  recordAuthAttempt(clientIP, success) {
    const now = Date.now();

    if (success) {
      // On success, clear any failure tracking
      this.authAttempts.delete(clientIP);
      logger.info(`Socket auth success from ${clientIP}`);
      return;
    }

    const rec = this.authAttempts.get(clientIP) || { failures: 0, firstAttemptAt: now, blockedUntil: 0 };

    // Reset window if expired
    if (now - rec.firstAttemptAt > AUTH_RATE_LIMIT.windowMs) {
      rec.failures = 0;
      rec.firstAttemptAt = now;
      rec.blockedUntil = 0;
    }

    rec.failures += 1;

    if (rec.failures >= AUTH_RATE_LIMIT.maxFailedAttempts) {
      rec.blockedUntil = now + AUTH_RATE_LIMIT.blockDurationMs;
      logger.warn(`IP ${clientIP} blocked due to too many failed authentication attempts`);
    }

    this.authAttempts.set(clientIP, rec);
    logger.warn(`Socket auth failed from ${clientIP}: failures=${rec.failures}`);
  }

  cleanupAuthAttempts() {
    const now = Date.now();
    for (const [ip, rec] of this.authAttempts.entries()) {
      if ((rec.blockedUntil && now > rec.blockedUntil) || (rec.firstAttemptAt && now - rec.firstAttemptAt > AUTH_RATE_LIMIT.windowMs)) {
        this.authAttempts.delete(ip);
      }
    }
  }

  // ============ Typing throttle ============
  _canSendTyping(userId, taskId) {
    const key = `${userId}:${taskId}`;
    if (this._typingThrottle.has(key)) return false;
    const t = setTimeout(() => this._typingThrottle.delete(key), TYPING_THROTTLE_MS);
    this._typingThrottle.set(key, t);
    return true;
  }

  throttleTaskUpdate(taskId) {
    const now = Date.now();
    const last = this.taskUpdateThrottlers.get(taskId);
    if (last && now - last < TASK_UPDATE_THROTTLE_MS) return false;
    this.taskUpdateThrottlers.set(taskId, now);
    return true;
  }

  // ============ Token monitoring ============
  setupTokenMonitoring(userId, token, expiresAt) {
    const existing = this.tokenMonitoring.get(userId);
    if (existing?.warningTimeoutId) {
      clearTimeout(existing.warningTimeoutId);
    }

    const entry = {
      token,
      expiresAt,
      warningScheduled: false,
      warningTimeoutId: null,
    };

    // Schedule warning if appropriate
    const timeUntilExpiry = expiresAt - Date.now();
    if (timeUntilExpiry > TOKEN_WARNING_THRESHOLD_MS) {
      entry.warningTimeoutId = setTimeout(() => {
        this.sendTokenExpiryWarning(userId);
      }, timeUntilExpiry - TOKEN_WARNING_THRESHOLD_MS);
    }

    this.tokenMonitoring.set(userId, entry);

    // Start monitoring loop if needed
    if (!this.tokenCheckInterval) {
      this.tokenCheckInterval = setInterval(() => this.checkTokenExpirations(), TOKEN_CHECK_INTERVAL_MS);
    }
  }

  async sendTokenExpiryWarning(userId) {
    const monitoring = this.tokenMonitoring.get(userId);
    if (!monitoring || monitoring.warningScheduled) return;

    monitoring.warningScheduled = true;
    this.tokenMonitoring.set(userId, monitoring);

    const timeLeftMin = Math.max(0, Math.ceil((monitoring.expiresAt - Date.now()) / 60000));
    const warningMessage = {
      type: 'token_expiry_warning',
      message: `Your session will expire in ${timeLeftMin} minutes. Please refresh to continue.`,
      expiresAt: monitoring.expiresAt,
    };
    this.emitToUserSockets(userId, 'session_warning', warningMessage);
  }

  checkTokenExpirations() {
    const now = Date.now();
    for (const [userId, monitoring] of this.tokenMonitoring.entries()) {
      if (now >= monitoring.expiresAt) {
        const userSockets = this.connectedUsers.get(userId);
        if (userSockets) {
          for (const socketId of userSockets) {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket) {
              socket.emit('session_expired', { message: 'Your session has expired. Please log in again.' });
              socket.disconnect(true);
            }
          }
        }
        if (monitoring.warningTimeoutId) clearTimeout(monitoring.warningTimeoutId);
        this.tokenMonitoring.delete(userId);
        logger.info(`Session expired for user ${userId}, disconnected all sockets`);
      } else if (!monitoring.warningScheduled && (monitoring.expiresAt - now) <= TOKEN_WARNING_THRESHOLD_MS) {
        this.sendTokenExpiryWarning(userId);
      }
    }

    if (this.tokenMonitoring.size === 0 && this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
      this.tokenCheckInterval = null;
    }
  }

  // ============ Metrics ============
  debouncedMetricsUpdate() {
    if (this._metricsTimer) clearTimeout(this._metricsTimer);
    this._metricsTimer = setTimeout(async () => {
      try {
        const updatedTaskIds = Array.from(this.metricsUpdateQueue);
        this.metricsUpdateQueue.clear();
        if (updatedTaskIds.length > 0) {
          await this.updateTaskMetrics();
          await this.broadcastMetricsUpdate();
        }
      } catch (error) {
        logger.error('Error in debounced metrics update', { error });
      } finally {
        this._metricsTimer = null;
      }
    }, this._metricsDebounceMs);
  }

  async computeTaskMetrics() {
    const start = Date.now();
    const rows = await Task.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const base = { total: 0, pending: 0, in_progress: 0, completed: 0, blocked: 0, cancelled: 0 };
    for (const r of rows) {
      const key = String(r._id || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(base, key)) base[key] = r.count;
      base.total += r.count;
    }
    const metrics = {
      ...base,
      completion_rate: base.total > 0 ? Math.round((base.completed / base.total) * 10000) / 100 : 0,
      timestamp: new Date().toISOString(),
    };
    logger.debug(`Task metrics aggregation took ${Date.now() - start}ms`);
    return metrics;
  }

  async updateTaskMetrics() {
    try {
      const m = await this.computeTaskMetrics();
      getPrometheusService().updateTaskMetrics({
        total: m.total,
        pending: m.pending,
        in_progress: m.in_progress,
        completed: m.completed,
        blocked: m.blocked,
        cancelled: m.cancelled,
      });
    } catch (error) {
      logger.error('Failed to update Prometheus task metrics', { error });
    }
  }

  async broadcastMetricsUpdate() {
    try {
      const metrics = await this.computeTaskMetrics();
      this.io.emit('metrics_update', { type: 'tasks', data: metrics });
    } catch (error) {
      logger.error('Error broadcasting metrics update', { error });
    }
  }

  // ============ Socket Handlers ============
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Socket connected: ${socket.id}`);

      socket.on('authenticate', async (data) => {
        try {
          await this.authenticateSocket(socket, data?.token);
        } catch (error) {
          logger.error('Socket authentication failed', { error });
          socket.emit('auth_error', { message: 'Authentication failed' });
          socket.disconnect(true);
        }
      });

      socket.on('task_update', async (data) => {
        try {
          await this.handleTaskUpdate(socket, data);
        } catch (error) {
          logger.error('Error handling task update', { error });
          socket.emit('error', { message: 'Failed to update task' });
        }
      });

      socket.on('task_status_change', async (data) => {
        try {
          await this.handleTaskStatusChange(socket, data);
        } catch (error) {
          logger.error('Error handling task status change', { error });
          socket.emit('error', { message: 'Failed to change task status' });
        }
      });

      socket.on('join_task', async (taskId) => {
        try {
          const uid = this.userRooms.get(socket.id);
          const role = socket.userRole;
          if (!uid || !taskId) return;

          let authorized = false;
          if (role === 'admin' || role === 'manager') {
            authorized = true;
          } else {
            authorized = await Task.exists({
              _id: taskId,
              isActive: true,
              $or: [
                { assignedTo: uid },
                { assignedBy: uid },
              ],
            });
          }

          if (authorized) {
            socket.join(`task_${taskId}`);
            logger.info(`Socket ${socket.id} joined task room: task_${taskId}`);
          } else {
            socket.emit('error', { code: 'FORBIDDEN', message: 'No access to this task' });
          }
        } catch (error) {
          logger.error('Error handling join_task', { error });
        }
      });

      socket.on('leave_task', (taskId) => {
        if (!taskId) return;
        socket.leave(`task_${taskId}`);
        logger.info(`Socket ${socket.id} left task room: task_${taskId}`);
      });

      socket.on('join_project', async (projectName) => {
        try {
          const uid = this.userRooms.get(socket.id);
          const role = socket.userRole;
          if (!uid || !projectName) return;

          let authorized = false;
          if (role === 'admin' || role === 'manager') {
            authorized = true;
          } else {
            authorized = await Task.exists({
              project: projectName,
              isActive: true,
              $or: [
                { assignedTo: uid },
                { assignedBy: uid },
              ],
            });
          }

          if (authorized) {
            socket.join(`project_${projectName}`);
            logger.info(`Socket ${socket.id} joined project room: project_${projectName}`);
          } else {
            socket.emit('error', { code: 'FORBIDDEN', message: 'No access to this project' });
          }
        } catch (error) {
          logger.error('Error handling join_project', { error });
        }
      });

      socket.on('notification_read', async (notificationIds) => {
        try {
          const userId = this.userRooms.get(socket.id);
          if (!userId) return;
          if (!Array.isArray(notificationIds) || notificationIds.length === 0) return;

          await notificationService.markAsRead(userId, notificationIds);
          socket.emit('notifications_marked_read', { notificationIds });
        } catch (error) {
          logger.error('Error marking notifications as read', { error });
        }
      });

      socket.on('typing_start', (data) => {
        const uid = this.userRooms.get(socket.id);
        if (data?.taskId && uid && this._canSendTyping(uid, data.taskId)) {
          socket.to(`task_${data.taskId}`).emit('user_typing', { userId: uid, taskId: data.taskId, typing: true });
        }
      });

      socket.on('typing_stop', (data) => {
        const uid = this.userRooms.get(socket.id);
        if (!data?.taskId || !uid) return;
        // always allow stop event to ensure state consistency
        socket.to(`task_${data.taskId}`).emit('user_typing', { userId: uid, taskId: data.taskId, typing: false });
      });

      // Workflow execution events
      socket.on('join_workflow_execution', async (executionId) => {
        try {
          const uid = this.userRooms.get(socket.id);
          const role = socket.userRole;
          if (!uid || !executionId) return;

          // Check if user has access to this workflow execution
          const WorkflowExecution = require('../models/WorkflowExecution');
          const WorkflowTemplate = require('../models/WorkflowTemplate');
          
          const execution = await WorkflowExecution.findById(executionId).populate('workflowTemplateId');
          if (!execution) {
            socket.emit('error', { code: 'NOT_FOUND', message: 'Workflow execution not found' });
            return;
          }

          let authorized = false;
          if (role === 'admin' || role === 'manager') {
            authorized = true;
          } else if (execution.triggeredBy.toString() === uid) {
            authorized = true;
          } else {
            // Check if user has access to the template
            const template = execution.workflowTemplateId;
            authorized = template.createdBy.toString() === uid ||
                        template.isPublic ||
                        template.sharedWith.some(share => share.userId.toString() === uid);
          }

          if (authorized) {
            socket.join(`workflow_execution_${executionId}`);
            logger.info(`Socket ${socket.id} joined workflow execution room: workflow_execution_${executionId}`);
            
            // Send current execution status
            socket.emit('workflow_execution_status', {
              executionId: execution.executionId,
              status: execution.status,
              progress: execution.progress,
              currentStep: execution.currentStep,
              startTime: execution.startTime,
              endTime: execution.endTime,
            });
          } else {
            socket.emit('error', { code: 'FORBIDDEN', message: 'No access to this workflow execution' });
          }
        } catch (error) {
          logger.error('Error handling join_workflow_execution', { error });
          socket.emit('error', { message: 'Failed to join workflow execution' });
        }
      });

      socket.on('leave_workflow_execution', (executionId) => {
        if (!executionId) return;
        socket.leave(`workflow_execution_${executionId}`);
        logger.info(`Socket ${socket.id} left workflow execution room: workflow_execution_${executionId}`);
      });

      socket.on('workflow_approval_response', async (data) => {
        try {
          const uid = this.userRooms.get(socket.id);
          if (!uid || !data?.executionId || !data?.nodeId || !data?.response) return;

          const WorkflowExecution = require('../models/WorkflowExecution');
          const execution = await WorkflowExecution.findById(data.executionId);
          
          if (!execution) {
            socket.emit('error', { code: 'NOT_FOUND', message: 'Workflow execution not found' });
            return;
          }

          const step = execution.steps.find(s => s.nodeId === data.nodeId);
          if (!step || step.status !== 'waiting_approval') {
            socket.emit('error', { code: 'INVALID_STATE', message: 'Step is not waiting for approval' });
            return;
          }

          if (step.assignedTo.toString() !== uid) {
            socket.emit('error', { code: 'FORBIDDEN', message: 'You are not authorized to approve this step' });
            return;
          }

          // Record approval response
          step.approvals.push({
            userId: uid,
            status: data.response, // 'approved' or 'rejected'
            comment: data.comment || '',
            timestamp: new Date(),
          });

          if (data.response === 'approved') {
            step.status = 'completed';
            step.endTime = new Date();
            step.duration = step.startTime ? step.endTime - step.startTime : 0;
          } else {
            step.status = 'failed';
            step.endTime = new Date();
            step.duration = step.startTime ? step.endTime - step.startTime : 0;
            step.error = {
              message: `Approval rejected: ${data.comment || 'No reason provided'}`,
              code: 'APPROVAL_REJECTED',
            };
          }

          await execution.save();

          // Broadcast approval response
          this.io.to(`workflow_execution_${data.executionId}`).emit('workflow_approval_response', {
            executionId: data.executionId,
            nodeId: data.nodeId,
            response: data.response,
            comment: data.comment,
            approver: uid,
            timestamp: new Date(),
          });

          // Continue workflow execution if approved
          if (data.response === 'approved') {
            try {
              const workflowExecutor = require('../services/workflowExecutor');
              await workflowExecutor.processNextNodes(execution, data.nodeId, { approved: true });
            } catch (executorError) {
              logger.error('Error continuing workflow after approval:', executorError);
            }
          }

        } catch (error) {
          logger.error('Error handling workflow approval response', { error });
          socket.emit('error', { message: 'Failed to process approval response' });
        }
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  // ============ Auth ============
  async authenticateSocket(socket, token) {
    const clientIP = this.getClientIP(socket);

    try {
      if (!this.checkAuthRateLimit(clientIP)) {
        logger.warn(`Authentication attempt blocked from ${clientIP} due to rate limiting`);
        socket.emit('auth_error', { code: 'TOO_MANY_AUTH_ATTEMPTS', message: 'Too many authentication attempts. Please try again later.' });
        socket.disconnect(true);
        return;
      }

      if (!token) throw new Error('NO_TOKEN');

      const decoded = await verifyToken(token);
      const userId = decoded.userId || decoded.id;
      if (!userId) throw new Error('INVALID_TOKEN_PAYLOAD');

      const user = await User.findById(userId).select('-password -loginAttempts -lockUntil').lean();
      if (!user) throw new Error('USER_NOT_FOUND');
      if (!user.isActive) throw new Error('ACCOUNT_DEACTIVATED');
      if (process.env.NODE_ENV === 'production' && !user.isEmailVerified) throw new Error('EMAIL_NOT_VERIFIED');

      // Map user and rooms
      this.addUserSocket(user._id.toString(), socket.id);
      this.userRooms.set(socket.id, user._id.toString());
      socket.join(`user_${user._id}`);

      // Attach user info to socket
      socket.userId = user._id.toString();
      socket.userRole = user.role;
      socket.userPermissions = Array.isArray(user.permissions) ? user.permissions : [];

      // Token monitoring
      this.setupTokenMonitoring(user._id.toString(), token, decoded.exp * 1000);

      // Rate limit success
      this.recordAuthAttempt(clientIP, true);

      logger.info(`Socket authenticated: ${user.email} (${user.role}) - Socket: ${socket.id} IP: ${clientIP}`);

      socket.emit('authenticated', {
        userId: user._id,
        role: user.role,
        permissions: socket.userPermissions,
        expiresAt: decoded.exp * 1000,
      });

      await this.sendPendingNotifications(socket, user._id);
    } catch (error) {
      this.recordAuthAttempt(clientIP, false);

      const errorResponse = { code: error.message || 'AUTHENTICATION_FAILED', message: 'Authentication failed' };
      switch (error.message) {
        case 'NO_TOKEN':
          errorResponse.message = 'No authentication token provided';
          break;
        case 'INVALID_TOKEN':
          errorResponse.message = 'Invalid authentication token';
          break;
        case 'INVALID_TOKEN_PAYLOAD':
          errorResponse.message = 'Invalid authentication token payload';
          break;
        case 'USER_NOT_FOUND':
          errorResponse.message = 'User not found';
          break;
        case 'ACCOUNT_DEACTIVATED':
          errorResponse.message = 'Account is deactivated';
          break;
        case 'EMAIL_NOT_VERIFIED':
          errorResponse.message = 'Please verify your email address';
          break;
        case 'TokenExpiredError':
          errorResponse.code = 'TOKEN_EXPIRED';
          errorResponse.message = 'Authentication token has expired';
          break;
      }

      logger.warn(`Socket authentication failed from ${clientIP}: ${errorResponse.code}`);
      socket.emit('auth_error', errorResponse);
      socket.disconnect(true);
    }
  }

  // ============ Business events ============
  async handleTaskUpdate(socket, data) {
    const { userId } = socket;
    if (!userId) throw new Error('Socket not authenticated');

    if (data?.taskId) {
      const payload = { taskId: data.taskId, updatedBy: userId, changes: data.changes, timestamp: new Date() };
      this.io.to(`task_${data.taskId}`).emit('task_updated', payload);

      if (data.projectName) {
        this.io.to(`project_${data.projectName}`).emit('project_task_updated', { ...payload, projectName: data.projectName });
      }
    }
  }

  async handleTaskStatusChange(socket, data) {
    const { userId } = socket;
    if (!userId) throw new Error('Socket not authenticated');

    if (data?.taskId && this.throttleTaskUpdate(data.taskId)) {
      const timestamp = new Date();
      const statusPayload = {
        taskId: data.taskId,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        changedBy: userId,
        timestamp,
      };

      this.io.to(`task_${data.taskId}`).emit('task_status_changed', statusPayload);

      if (data.projectName) {
        this.io.to(`project_${data.projectName}`).emit('project_task_status_changed', { ...statusPayload, projectName: data.projectName });
      }

      await this.broadcastDashboardUpdate(data.taskId, data.newStatus, userId);

      // Queue metrics update for debounced processing
      this.metricsUpdateQueue.add(data.taskId);
      this.debouncedMetricsUpdate();
    }
  }

  async sendPendingNotifications(socket, userId) {
    try {
      const result = await notificationService.getNotificationsForUser(userId, { limit: 10, unreadOnly: true });
      if (result && Array.isArray(result.notifications) && result.notifications.length > 0) {
        socket.emit('pending_notifications', { notifications: result.notifications, unreadCount: result.unreadCount || 0 });
      }
    } catch (error) {
      logger.error('Error sending pending notifications', { error });
    }
  }

  async broadcastDashboardUpdate(taskId, newStatus, changedBy) {
    try {
      const startTime = Date.now();
      const adminManagerSockets = await this.getAdminManagerSockets();

      const dashboardUpdate = {
        type: 'task_status_change',
        taskId,
        newStatus,
        changedBy,
        timestamp: new Date(),
      };

      let totalDeliveries = 0;
      let targetUsers = 0;

      for (const [userId, userData] of adminManagerSockets) {
        const sentCount = this.emitToUserSockets(userId, 'dashboard_update', dashboardUpdate);
        if (sentCount > 0) {
          totalDeliveries += sentCount;
          targetUsers++;
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`Dashboard update broadcast complete: duration=${duration}ms targetUsers=${targetUsers} totalDeliveries=${totalDeliveries}`);

      // Do NOT trigger metrics here (handled by debounced pipeline)
    } catch (error) {
      logger.error('Error broadcasting dashboard update', { error });
    }
  }

  broadcastActivityUpdate(activity) {
    this.io.emit('activity_update', { type: 'new_activity', data: activity, timestamp: new Date().toISOString() });
  }

  // ============ Disconnect ============
  handleDisconnect(socket) {
    const userId = this.userRooms.get(socket.id);

    if (userId) {
      this.removeUserSocket(userId, socket.id);
      this.userRooms.delete(socket.id);

      const remainingSockets = this.getUserSockets(userId).size;
      logger.info(`Socket disconnected: ${socket.id} (user: ${userId}, remaining connections: ${remainingSockets})`);

      if (remainingSockets === 0) {
        const monitoring = this.tokenMonitoring.get(userId);
        if (monitoring?.warningTimeoutId) clearTimeout(monitoring.warningTimeoutId);
        this.tokenMonitoring.delete(userId);
        logger.info(`Token monitoring cleaned up for user ${userId} - no active connections`);
      }

      this.cleanupStaleConnections();
    } else {
      logger.info(`Socket disconnected: ${socket.id}`);
      this.socketConnectedAt.delete(socket.id);
    }
  }

  // ============ Broadcast helpers ============
  broadcastNotificationToUser(userId, notification) {
    this.io.to(`user_${userId}`).emit('notification', notification);
    const sentCount = this.emitToUserSockets(userId.toString(), 'notification', notification);
    if (sentCount > 0) {
      logger.info(`Notification broadcasted to user ${userId} on ${sentCount} device(s)`);
      return true;
    }
    return false;
  }

  broadcastTaskAssignment(userId, taskData) {
    this.io.to(`user_${userId}`).emit('task_assigned', taskData);
    const sentCount = this.emitToUserSockets(userId.toString(), 'task_assigned', taskData);
    if (sentCount > 0) {
      logger.info(`Task assignment broadcasted to user ${userId} on ${sentCount} device(s)`);
      return true;
    }
    return false;
  }

  broadcastTaskCompletion(taskData, assignedBy, managers = []) {
    if (assignedBy) {
      this.broadcastNotificationToUser(assignedBy, {
        type: 'task_completed',
        taskId: taskData._id,
        title: `Task Completed: ${taskData.title}`,
        message: `Task "${taskData.title}" has been completed.`,
        timestamp: new Date(),
      });
    }

    for (const manager of managers) {
      this.broadcastNotificationToUser(manager._id, {
        type: 'task_completed',
        taskId: taskData._id,
        title: `Team Task Completed: ${taskData.title}`,
        message: `A team member completed "${taskData.title}".`,
        timestamp: new Date(),
      });
    }

    this.io.to(`task_${taskData._id}`).emit('task_completed', { taskId: taskData._id, title: taskData.title, completedAt: new Date() });
  }

  getConnectedUsersCount({ by = 'users' } = {}) {
    if (by === 'sockets') {
      let totalSockets = 0;
      for (const sockets of this.connectedUsers.values()) totalSockets += sockets.size;
      return totalSockets;
    }
    return this.connectedUsers.size;
  }

  getConnectedUsersList() {
    return Array.from(this.connectedUsers.entries()).map(([userId, sockets]) => {
      let earliest = Date.now();
      for (const sid of sockets) {
        const t = this.socketConnectedAt.get(sid) || Date.now();
        if (t < earliest) earliest = t;
      }
      return { userId, deviceCount: sockets.size, socketIds: Array.from(sockets), connectedAt: new Date(earliest) };
    });
  }

  broadcastSystemAnnouncement(announcement) {
    this.io.emit('system_announcement', {
      title: announcement.title,
      message: announcement.message,
      type: announcement.type || 'info',
      timestamp: new Date(),
    });
    logger.info(`System announcement broadcasted: ${announcement.title}`);
  }

  // ============ Workflow Execution Broadcasting ============
  broadcastWorkflowExecutionUpdate(executionId, update) {
    this.io.to(`workflow_execution_${executionId}`).emit('workflow_execution_update', {
      executionId,
      ...update,
      timestamp: new Date(),
    });
    logger.info(`Workflow execution update broadcasted for execution ${executionId}`);
  }

  broadcastWorkflowProgress(executionId, progress) {
    this.io.to(`workflow_execution_${executionId}`).emit('workflow_progress', {
      executionId,
      progress,
      timestamp: new Date(),
    });
  }

  broadcastWorkflowStepUpdate(executionId, stepUpdate) {
    this.io.to(`workflow_execution_${executionId}`).emit('workflow_step_update', {
      executionId,
      ...stepUpdate,
      timestamp: new Date(),
    });
  }

  broadcastWorkflowCompletion(executionId, result) {
    this.io.to(`workflow_execution_${executionId}`).emit('workflow_completed', {
      executionId,
      result,
      timestamp: new Date(),
    });
    logger.info(`Workflow completion broadcasted for execution ${executionId}`);
  }

  broadcastWorkflowError(executionId, error) {
    this.io.to(`workflow_execution_${executionId}`).emit('workflow_error', {
      executionId,
      error: {
        message: error.message,
        code: error.code,
      },
      timestamp: new Date(),
    });
    logger.error(`Workflow error broadcasted for execution ${executionId}: ${error.message}`);
  }

  cleanupStaleConnections() {
    logger.debug('Running stale connection cleanup...');
    for (const [userId, sockets] of this.connectedUsers.entries()) {
      const validSockets = new Set();
      for (const socketId of sockets) {
        if (this.io.sockets.sockets.has(socketId)) {
          validSockets.add(socketId);
        } else {
          this.userRooms.delete(socketId);
          this.socketConnectedAt.delete(socketId);
          logger.debug(`Removed stale socket ${socketId} for user ${userId}`);
        }
      }
      if (validSockets.size === 0) {
        this.connectedUsers.delete(userId);
        logger.debug(`Removed user ${userId} with no valid sockets`);
      } else if (validSockets.size !== sockets.size) {
        this.connectedUsers.set(userId, validSockets);
        logger.debug(`Updated socket set for user ${userId}: ${validSockets.size} valid sockets`);
      }
    }

    // Cleanup old task throttles (keep only entries updated within last 10 minutes)
    const now = Date.now();
    for (const [taskId, ts] of this.taskUpdateThrottlers.entries()) {
      if (now - ts > 10 * 60 * 1000) this.taskUpdateThrottlers.delete(taskId);
    }

    // Clear outdated auth attempts
    this.cleanupAuthAttempts();
  }

  destroy() {
    if (this._staleCleanupInterval) {
      clearInterval(this._staleCleanupInterval);
      this._staleCleanupInterval = null;
    }
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
      this.tokenCheckInterval = null;
    }

    for (const [, entry] of this.tokenMonitoring.entries()) {
      if (entry.warningTimeoutId) clearTimeout(entry.warningTimeoutId);
    }

    if (this._metricsTimer) {
      clearTimeout(this._metricsTimer);
      this._metricsTimer = null;
    }

    this._typingThrottle.forEach((timerId) => clearTimeout(timerId));

    this.connectedUsers.clear();
    this.userRooms.clear();
    this.socketConnectedAt.clear();
    this.tokenMonitoring.clear();
    this.authAttempts.clear();
    this.adminManagerCache.clear();

    logger.info('TaskSocketHandler destroyed and cleaned up');
  }
}

module.exports = TaskSocketHandler;
