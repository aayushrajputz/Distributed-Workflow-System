const { verifyToken } = require('../config/jwt');
const User = require('../models/User');
const Task = require('../models/Task');
const notificationService = require('../services/notificationService');
const { getPrometheusService } = require('../services/prometheusService');
const logger = require('../utils/logger');

class TaskSocketHandler {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> Set<socketId> mapping
    this.userRooms = new Map(); // socketId -> userId mapping

    // Authentication rate limiting
    this.authAttempts = new Map(); // IP -> { attempts: number, lastAttempt: timestamp, blocked: boolean }
    this.authRateLimit = {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDurationMs: 30 * 60 * 1000 // 30 minutes
    };

    // Token expiration monitoring
    this.tokenMonitoring = new Map(); // userId -> { token, expiresAt, warningScheduled }
    this.tokenWarningThreshold = 5 * 60 * 1000; // 5 minutes before expiry
    this.tokenCheckInterval = null;

    // Admin/manager caching
    this._adminManagerIds = [];
    this._adminCacheExpiresAt = 0; // ms timestamp
    this._adminCacheTTL = 5 * 60 * 1000; // 5m

      // Metrics and throttling state
    this._metricsDebounceMs = 2000;
    this._metricsTimer = null;
    this.metricsUpdateQueue = new Set(); // For queuing taskIds that need metrics update
    
    // Throttling maps and settings
    this._typingThrottle = new Map(); // key: `${userId}:${taskId}` -> timeoutId
    this._typingThrottleMs = 1000;
    this.typingThrottlers = new Map(); // For backward compatibility
    
    // Task update throttling
    this._taskUpdateThrottle = new Map(); // taskId -> { timer, lastPayload }
    this._taskThrottleMs = 500;
    this.taskUpdateThrottlers = new Map(); // For backward compatibility

    // Admin/manager caching
    this.adminManagerCache = new Map();
    this.cacheExpiry = 0;    this.setupSocketHandlers();
    // Start periodic cleanup of stale connections
    this._staleCleanupInterval = setInterval(() => this.cleanupStaleConnections(), 5 * 60 * 1000); // every 5 minutes
  }

  // Socket Set Management Utilities
  addUserSocket(userId, socketId) {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId).add(socketId);
  }

  removeUserSocket(userId, socketId) {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }
  }

  // Utility method for validating and emitting to user sockets
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
        console.log(`🔍 Pruned stale socket ${socketId} for user ${userId} during emit`);
      }
    }
    return validEmitCount;
  }

  // Admin/Manager Cache Management
  async refreshAdminManagerCache() {
    const users = await User.find({ $or: [{ role: 'admin' }, { role: 'manager' }], isActive: true }).select('_id');
    this._adminManagerIds = users.map(u => u._id.toString());
    this._adminCacheExpiresAt = Date.now() + this._adminCacheTTL;
  }

  async getAdminManagerIds() {
    if (!this._adminManagerIds.length || Date.now() > this._adminCacheExpiresAt) {
      await this.refreshAdminManagerCache();
    }
    return this._adminManagerIds;
  }

  invalidateAdminManagerCache() {
    this._adminCacheExpiresAt = 0;
  }

  // Role change handler
  handleUserRoleChange(userId, newRole) {
    // For now, just invalidate; future enhancements can adjust rooms/permissions
    this.invalidateAdminManagerCache();
  }

  // Authentication rate limiting methods
  getClientIP(socket) {
    const headers = socket.handshake.headers;
    return headers['x-forwarded-for']?.split(',')[0].trim() || 
           headers['x-real-ip'] || 
           socket.handshake.address ||
           socket.conn.remoteAddress;
  }

  checkAuthRateLimit(clientIP) {
    const now = Date.now();
    const attempt = this.authAttempts.get(clientIP);

    if (!attempt) return true;

    // Check if IP is blocked
    if (attempt.blocked) {
      if (now - attempt.lastAttempt > this.authRateLimit.blockDurationMs) {
        // Unblock if block duration has passed
        this.authAttempts.delete(clientIP);
        return true;
      }
      return false;
    }

    // Check if attempts have expired
    if (now - attempt.lastAttempt > this.authRateLimit.windowMs) {
      this.authAttempts.delete(clientIP);
      return true;
    }

    // Check if max attempts exceeded
    return attempt.attempts < this.authRateLimit.maxAttempts;
  }

  recordAuthAttempt(clientIP, success) {
    const now = Date.now();
    const attempt = this.authAttempts.get(clientIP) || { attempts: 0, lastAttempt: now, blocked: false };

    // Reset attempts if window has expired
    if (now - attempt.lastAttempt > this.authRateLimit.windowMs) {
      attempt.attempts = 0;
      attempt.blocked = false;
    }

    attempt.attempts++;
    attempt.lastAttempt = now;

    // Block IP if max attempts exceeded
    if (!success && attempt.attempts >= this.authRateLimit.maxAttempts) {
      attempt.blocked = true;
      logger.warn(`IP ${clientIP} blocked due to too many failed authentication attempts`);
    }

    this.authAttempts.set(clientIP, attempt);

    // Log authentication attempt
    logger.info(`Socket auth attempt from ${clientIP}: ${success ? 'success' : 'failed'} (attempts: ${attempt.attempts})`);
  }

  cleanupAuthAttempts() {
    const now = Date.now();
    for (const [ip, attempt] of this.authAttempts.entries()) {
      if (now - attempt.lastAttempt > this.authRateLimit.windowMs) {
        this.authAttempts.delete(ip);
      }
    }
  }

  // Typing throttle helper
  _canSendTyping(userId, taskId) {
    const key = `${userId}:${taskId}`;
    if (this._typingThrottle.has(key)) return false;
    const t = setTimeout(() => this._typingThrottle.delete(key), this._typingThrottleMs);
    this._typingThrottle.set(key, t);
    return true;
  }

  getUserSockets(userId) {
    const sockets = this.connectedUsers.get(userId);
    if (!sockets) return new Set();
    
    // Filter out stale sockets during retrieval
    const validSockets = new Set();
    for (const socketId of sockets) {
      if (this.io.sockets.sockets.has(socketId)) {
        validSockets.add(socketId);
      }
    }
    
    // Update the stored set if we removed any stale sockets
    if (validSockets.size !== sockets.size) {
      if (validSockets.size === 0) {
        this.connectedUsers.delete(userId);
      } else {
        this.connectedUsers.set(userId, validSockets);
      }
    }
    
    return validSockets;
  }

  isUserConnected(userId) {
    return this.getUserSockets(userId).size > 0;
  }

  cleanupStaleConnections() {
    console.log('🧹 Running stale connection cleanup...');
    for (const [userId, sockets] of this.connectedUsers.entries()) {
      const validSockets = new Set();
      for (const socketId of sockets) {
        if (this.io.sockets.sockets.has(socketId)) {
          validSockets.add(socketId);
        } else {
          this.userRooms.delete(socketId);
          console.log(`🗑️ Removed stale socket ${socketId} for user ${userId}`);
        }
      }
      if (validSockets.size === 0) {
        this.connectedUsers.delete(userId);
        console.log(`🗑️ Removed user ${userId} with no valid sockets`);
      } else if (validSockets.size !== sockets.size) {
        this.connectedUsers.set(userId, validSockets);
        console.log(`♻️ Updated socket set for user ${userId}: ${validSockets.size} valid sockets`);
      }
    }

    // Clean up throttling maps
    const now = Date.now();
    for (const [key, timestamp] of this.typingThrottlers.entries()) {
      if (now - timestamp > 1000) { // 1 second window
        this.typingThrottlers.delete(key);
      }
    }
    for (const [key, timestamp] of this.taskUpdateThrottlers.entries()) {
      if (now - timestamp > 500) { // 500ms window
        this.taskUpdateThrottlers.delete(key);
      }
    }
  }

  // Admin/Manager Cache Management Methods
  async refreshAdminManagerCache() {
    console.log('🔄 Refreshing admin/manager cache...');
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

      this.cacheExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes TTL
      const duration = Date.now() - startTime;
      console.log(`✅ Admin/manager cache refreshed in ${duration}ms, ${this.adminManagerCache.size} users cached`);
    } catch (error) {
      console.error('❌ Error refreshing admin/manager cache:', error);
      throw error;
    }
  }

  async getAdminManagerSockets() {
    if (!this.isCacheValid()) {
      await this.refreshAdminManagerCache();
    }
    return this.adminManagerCache;
  }

  invalidateUserCache(userId) {
    if (this.adminManagerCache.has(userId)) {
      this.adminManagerCache.delete(userId);
      console.log(`🔄 Invalidated cache entry for user ${userId}`);
    }
  }

  isCacheValid() {
    return Date.now() < this.cacheExpiry && this.adminManagerCache.size > 0;
  }

  // Event throttling methods
  throttleTypingEvent(userId, taskId) {
    const key = `${userId}_${taskId}`;
    const now = Date.now();
    const lastUpdate = this.typingThrottlers.get(key);

    if (lastUpdate && now - lastUpdate < 1000) { // 1 second throttle
      return false;
    }

    this.typingThrottlers.set(key, now);
    return true;
  }

  throttleTaskUpdate(taskId) {
    const now = Date.now();
    const lastUpdate = this.taskUpdateThrottlers.get(taskId);

    if (lastUpdate && now - lastUpdate < 500) { // 500ms throttle
      return false;
    }

    this.taskUpdateThrottlers.set(taskId, now);
    return true;
  }

  // Schedule debounced metrics update
  scheduleMetricsUpdate() {
    if (this._metricsTimer) clearTimeout(this._metricsTimer);
    this._metricsTimer = setTimeout(async () => {
      this._metricsTimer = null;
      try {
        const m = await this.computeTaskMetrics();
        getPrometheusService().updateTaskMetrics({
          total: m.total,
          pending: m.pending,
          in_progress: m.in_progress,
          completed: m.completed,
          blocked: m.blocked
        });
        this.io.emit('metrics_update', { type: 'tasks', data: m });
      } catch (e) {
        console.error('Error in debounced metrics update', e);
      }
    }, this._metricsDebounceMs);
  }

  // Token monitoring methods
  setupTokenMonitoring(userId, token, expiresAt) {
    this.tokenMonitoring.set(userId, {
      token,
      expiresAt,
      warningScheduled: false
    });

    // Check if we need to schedule a warning
    const timeUntilExpiry = expiresAt - Date.now();
    if (timeUntilExpiry > this.tokenWarningThreshold) {
      setTimeout(() => {
        this.sendTokenExpiryWarning(userId);
      }, timeUntilExpiry - this.tokenWarningThreshold);
    }

    // Start token check interval if not already running
    if (!this.tokenCheckInterval) {
      this.tokenCheckInterval = setInterval(() => this.checkTokenExpirations(), 60000); // Check every minute
    }
  }

  async sendTokenExpiryWarning(userId) {
    const monitoring = this.tokenMonitoring.get(userId);
    if (!monitoring || monitoring.warningScheduled) return;

    monitoring.warningScheduled = true;
    this.tokenMonitoring.set(userId, monitoring);

    const timeLeft = Math.ceil((monitoring.expiresAt - Date.now()) / 60000); // Minutes left
    const warningMessage = {
      type: 'token_expiry_warning',
      message: `Your session will expire in ${timeLeft} minutes. Please refresh to continue.`,
      expiresAt: monitoring.expiresAt
    };

    // Send warning to all user's connected sockets
    this.emitToUserSockets(userId, 'session_warning', warningMessage);
  }

  checkTokenExpirations() {
    const now = Date.now();
    for (const [userId, monitoring] of this.tokenMonitoring.entries()) {
      // If token is expired, disconnect all sockets for this user
      if (now >= monitoring.expiresAt) {
        const userSockets = this.connectedUsers.get(userId);
        if (userSockets) {
          for (const socketId of userSockets) {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket) {
              socket.emit('session_expired', {
                message: 'Your session has expired. Please log in again.'
              });
              socket.disconnect(true);
            }
          }
        }
        this.tokenMonitoring.delete(userId);
        logger.info(`Session expired for user ${userId}, disconnected all sockets`);
      }
      // If token is approaching expiry and warning not sent
      else if (!monitoring.warningScheduled && (monitoring.expiresAt - now) <= this.tokenWarningThreshold) {
        this.sendTokenExpiryWarning(userId);
      }
    }

    // Clean up interval if no more tokens to monitor
    if (this.tokenMonitoring.size === 0) {
      clearInterval(this.tokenCheckInterval);
      this.tokenCheckInterval = null;
    }
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Socket connected: ${socket.id}`);

      // Handle authentication
      socket.on('authenticate', async (data) => {
        try {
          await this.authenticateSocket(socket, data.token);
        } catch (error) {
          console.error('❌ Socket authentication failed:', error);
          socket.emit('auth_error', { message: 'Authentication failed' });
          socket.disconnect();
        }
      });

      // Handle task updates
      socket.on('task_update', async (data) => {
        try {
          await this.handleTaskUpdate(socket, data);
        } catch (error) {
          console.error('❌ Error handling task update:', error);
          socket.emit('error', { message: 'Failed to update task' });
        }
      });

      // Handle task status changes
      socket.on('task_status_change', async (data) => {
        try {
          await this.handleTaskStatusChange(socket, data);
        } catch (error) {
          console.error('❌ Error handling task status change:', error);
          socket.emit('error', { message: 'Failed to change task status' });
        }
      });

      // Handle joining task rooms for real-time updates
      socket.on('join_task', (taskId) => {
        socket.join(`task_${taskId}`);
        console.log(`👥 Socket ${socket.id} joined task room: task_${taskId}`);
      });

      // Handle leaving task rooms
      socket.on('leave_task', (taskId) => {
        socket.leave(`task_${taskId}`);
        console.log(`👋 Socket ${socket.id} left task room: task_${taskId}`);
      });

      // Handle joining project rooms
      socket.on('join_project', (projectName) => {
        socket.join(`project_${projectName}`);
        console.log(`👥 Socket ${socket.id} joined project room: project_${projectName}`);
      });

      // Handle notification acknowledgment
      socket.on('notification_read', async (notificationIds) => {
        try {
          const userId = this.userRooms.get(socket.id);
          if (userId) {
            await notificationService.markAsRead(userId, notificationIds);
            socket.emit('notifications_marked_read', { notificationIds });
          }
        } catch (error) {
          console.error('❌ Error marking notifications as read:', error);
        }
      });

      // Handle typing indicators for task comments with throttling
      socket.on('typing_start', (data) => {
        const uid = this.userRooms.get(socket.id);
        if (data.taskId && uid && this._canSendTyping(uid, data.taskId)) {
          socket.to(`task_${data.taskId}`).emit('user_typing', {
            userId: uid,
            taskId: data.taskId,
            typing: true,
          });
        }
      });

      socket.on('typing_stop', (data) => {
        if (!data.taskId) return;
        
        const userId = this.userRooms.get(socket.id);
        if (!userId) return;

        // Typing stop events bypass throttle to ensure state consistency
        socket.to(`task_${data.taskId}`).emit('user_typing', {
          userId,
          taskId: data.taskId,
          typing: false,
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  // Authenticate socket connection
  async authenticateSocket(socket, token) {
    const clientIP = this.getClientIP(socket);

    try {
      // Check rate limiting first
      if (!this.checkAuthRateLimit(clientIP)) {
        logger.warn(`Authentication attempt blocked from ${clientIP} due to rate limiting`);
        socket.emit('auth_error', {
          code: 'TOO_MANY_AUTH_ATTEMPTS',
          message: 'Too many authentication attempts. Please try again later.'
        });
        socket.disconnect();
        return;
      }

      // Validate token presence
      if (!token) {
        throw new Error('NO_TOKEN');
      }

      // Verify JWT token using centralized function
      const decoded = await verifyToken(token);
      
      // Support both userId and id for backward compatibility
      const userId = decoded.userId || decoded.id;
      if (!userId) {
        throw new Error('INVALID_TOKEN_PAYLOAD');
      }

      // Find and validate user
      const user = await User.findById(decoded.userId)
        .select('-password -loginAttempts -lockUntil')
        .lean();

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      if (!user.isActive) {
        throw new Error('ACCOUNT_DEACTIVATED');
      }

      // In production, verify email
      if (process.env.NODE_ENV === 'production' && !user.isEmailVerified) {
        throw new Error('EMAIL_NOT_VERIFIED');
      }

      // Store user mapping with multi-socket support
      this.addUserSocket(user._id.toString(), socket.id);
      this.userRooms.set(socket.id, user._id.toString());

      // Join user-specific room for notifications
      socket.join(`user_${user._id}`);

      // Store user data in socket
      socket.userId = user._id.toString();
      socket.userRole = user.role;
      socket.userPermissions = user.permissions;

      // Schedule token expiration monitoring
      this.setupTokenMonitoring(user._id.toString(), token, decoded.exp * 1000);

      // Record successful authentication
      this.recordAuthAttempt(clientIP, true);

      logger.info(`Socket authenticated: ${user.email} (${user.role}) - Socket: ${socket.id} IP: ${clientIP}`);

      // Send authentication success
      socket.emit('authenticated', {
        userId: user._id,
        role: user.role,
        permissions: user.permissions,
        expiresAt: decoded.exp * 1000
      });

      // Send any pending notifications
      await this.sendPendingNotifications(socket, user._id);

    } catch (error) {
      // Record failed authentication attempt
      this.recordAuthAttempt(clientIP, false);

      const errorResponse = {
        code: error.message || 'AUTHENTICATION_FAILED',
        message: 'Authentication failed'
      };

      // Map specific errors to user-friendly messages
      switch (error.message) {
        case 'NO_TOKEN':
          errorResponse.message = 'No authentication token provided';
          break;
        case 'INVALID_TOKEN':
          errorResponse.message = 'Invalid authentication token';
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
      socket.disconnect();
    }
  }

  // Handle task updates
  async handleTaskUpdate(socket, data) {
    const { userId } = socket;
    if (!userId) {
      throw new Error('Socket not authenticated');
    }

    // Broadcast task update to all users in task room
    if (data.taskId) {
      this.io.to(`task_${data.taskId}`).emit('task_updated', {
        taskId: data.taskId,
        updatedBy: userId,
        changes: data.changes,
        timestamp: new Date(),
      });

      // Also broadcast to project room
      if (data.projectName) {
        this.io.to(`project_${data.projectName}`).emit('project_task_updated', {
          taskId: data.taskId,
          projectName: data.projectName,
          updatedBy: userId,
          changes: data.changes,
          timestamp: new Date(),
        });
      }
    }
  }

  // Handle task status changes with throttling and debounced metrics
  async handleTaskStatusChange(socket, data) {
    const { userId } = socket;
    if (!userId) {
      throw new Error('Socket not authenticated');
    }

    // Broadcast status change to all relevant users
    if (data.taskId && this.throttleTaskUpdate(data.taskId)) {
      const timestamp = new Date();

      this.io.to(`task_${data.taskId}`).emit('task_status_changed', {
        taskId: data.taskId,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        changedBy: userId,
        timestamp,
      });

      // Broadcast to project room
      if (data.projectName) {
        this.io.to(`project_${data.projectName}`).emit('project_task_status_changed', {
          taskId: data.taskId,
          projectName: data.projectName,
          oldStatus: data.oldStatus,
          newStatus: data.newStatus,
          changedBy: userId,
          timestamp,
        });
      }

      // Send dashboard update to all managers and admins
      await this.broadcastDashboardUpdate(data.taskId, data.newStatus, userId);

      // Queue metrics update for debounced processing
      this.metricsUpdateQueue.add(data.taskId);
      this.debouncedMetricsUpdate();
    }
  }

  // Send pending notifications to newly connected user
  async sendPendingNotifications(socket, userId) {
    try {
      const notifications = await notificationService.getNotificationsForUser(userId, {
        limit: 10,
        unreadOnly: true,
      });

      if (notifications.notifications.length > 0) {
        socket.emit('pending_notifications', {
          notifications: notifications.notifications,
          unreadCount: notifications.unreadCount,
        });
      }
    } catch (error) {
      console.error('❌ Error sending pending notifications:', error);
    }
  }

  // Broadcast dashboard update to managers and admins using cached data
  async broadcastDashboardUpdate(taskId, newStatus, changedBy) {
    try {
      const startTime = Date.now();
      const adminManagerSockets = await this.getAdminManagerSockets();

      // Prepare update payload once
      const dashboardUpdate = {
        type: 'task_status_change',
        taskId,
        newStatus,
        changedBy,
        timestamp: new Date(),
      };

      // Track broadcast stats
      let totalDeliveries = 0;
      let targetUsers = 0;

      // Broadcast to all cached admin/manager sockets
      for (const [userId, userData] of adminManagerSockets) {
        const sentCount = this.emitToUserSockets(userId, 'dashboard_update', dashboardUpdate);
        if (sentCount > 0) {
          totalDeliveries += sentCount;
          targetUsers++;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`📊 Dashboard update broadcast complete:
        - Duration: ${duration}ms
        - Target Users: ${targetUsers}
        - Total Deliveries: ${totalDeliveries}
      `);

      // Broadcast real-time metrics update to all connected users
      this.broadcastMetricsUpdate();
    } catch (error) {
      console.error('❌ Error broadcasting dashboard update:', error);
    }
  }

  // Compute task metrics using aggregation
  // Get aggregated task stats
  async getAggregatedTaskStats() {
    const stats = await Task.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    return stats.reduce((acc, curr) => {
      acc[curr._id.toLowerCase()] = curr.count;
      return acc;
    }, { total: 0, pending: 0, in_progress: 0, completed: 0, blocked: 0 });
  }

  // Debounced metrics update
  debouncedMetricsUpdate() {
    if (this._metricsTimer) {
      clearTimeout(this._metricsTimer);
    }
    
    this._metricsTimer = setTimeout(async () => {
      try {
        const updatedTaskIds = Array.from(this.metricsUpdateQueue);
        this.metricsUpdateQueue.clear();
        
        if (updatedTaskIds.length > 0) {
          await this.updateTaskMetrics();
          await this.broadcastMetricsUpdate();
        }
      } catch (error) {
        logger.error('Error in debounced metrics update:', error);
      }
    }, this._metricsDebounceMs);
  }

  async computeTaskMetrics() {
    const start = Date.now();
    const agg = await Task.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $group: { _id: null, byStatus: { $push: { k: '$_id', v: '$count' } }, total: { $sum: '$count' } } },
      { $project: { _id: 0, byStatus: { $arrayToObject: '$byStatus' }, total: 1 } }
    ]);
    const res = agg[0] || { byStatus: {}, total: 0 };
    const m = {
      total: res.total || 0,
      pending: res.byStatus?.pending || 0,
      in_progress: res.byStatus?.in_progress || 0,
      completed: res.byStatus?.completed || 0,
      blocked: res.byStatus?.blocked || 0,
    };
    m.completion_rate = m.total > 0 ? Math.round((m.completed / m.total) * 10000) / 100 : 0;
    m.timestamp = new Date().toISOString();
    console.log(`metrics aggregation took ${Date.now()-start}ms`);
    return m;
  }

  // Update task metrics in Prometheus
  async updateTaskMetrics() {
    const m = await this.computeTaskMetrics();
    getPrometheusService().updateTaskMetrics({
      total: m.total,
      pending: m.pending,
      in_progress: m.in_progress,
      completed: m.completed,
      blocked: m.blocked
    });
  }

  // Broadcast real-time metrics to all connected users
  async broadcastMetricsUpdate() {
    try {
      const startTime = Date.now();
      const stats = await this.getAggregatedTaskStats();

      const taskMetrics = {
        ...stats,
        completion_rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100 * 100) / 100 : 0,
        timestamp: new Date().toISOString(),
      };

      // Broadcast to all connected users
      this.io.emit('metrics_update', {
        type: 'tasks',
        data: taskMetrics,
      });
    } catch (error) {
      console.error('Error broadcasting metrics update:', error);
    }
  }

  // Broadcast activity feed update
  broadcastActivityUpdate(activity) {
    this.io.emit('activity_update', {
      type: 'new_activity',
      data: activity,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle socket disconnect with multi-socket support
  handleDisconnect(socket) {
    const userId = this.userRooms.get(socket.id);

    if (userId) {
      this.removeUserSocket(userId, socket.id);
      this.userRooms.delete(socket.id);
      
      const remainingSockets = this.getUserSockets(userId).size;
      console.log(`👋 Socket disconnected: ${socket.id} (user: ${userId}, remaining connections: ${remainingSockets})`);
      
      // Clean up token monitoring if no more active sockets
      if (remainingSockets === 0) {
        this.tokenMonitoring.delete(userId);
        logger.info(`Token monitoring cleaned up for user ${userId} - no active connections`);
      }
      
      // Run cleanup after disconnect to ensure consistency
      this.cleanupStaleConnections();
    } else {
      console.log(`👋 Socket disconnected: ${socket.id}`);
    }
  }

  // Broadcast notification to specific user across all their devices
  broadcastNotificationToUser(userId, notification) {
    // First, try room-based broadcast for efficiency
    this.io.to(`user_${userId}`).emit('notification', notification);
    
    // Then validate and prune any stale sockets while tracking delivery
    const sentCount = this.emitToUserSockets(userId.toString(), 'notification', notification);

    if (sentCount > 0) {
      console.log(`📡 Notification broadcasted to user ${userId} on ${sentCount} device(s)`);
      return true;
    }
    return false;
  }

  // Broadcast task assignment to user across all their devices
  broadcastTaskAssignment(userId, taskData) {
    // First, try room-based broadcast for efficiency
    this.io.to(`user_${userId}`).emit('task_assigned', taskData);
    
    // Then validate and prune any stale sockets while tracking delivery
    const sentCount = this.emitToUserSockets(userId.toString(), 'task_assigned', taskData);

    if (sentCount > 0) {
      console.log(`📋 Task assignment broadcasted to user ${userId} on ${sentCount} device(s)`);
      return true;
    }
    return false;
  }

  // Broadcast task completion to relevant users
  broadcastTaskCompletion(taskData, assignedBy, managers = []) {
    // Notify the person who assigned the task
    if (assignedBy) {
      this.broadcastNotificationToUser(assignedBy, {
        type: 'task_completed',
        taskId: taskData._id,
        title: `Task Completed: ${taskData.title}`,
        message: `Task "${taskData.title}" has been completed.`,
        timestamp: new Date(),
      });
    }

    // Notify managers
    for (const manager of managers) {
      this.broadcastNotificationToUser(manager._id, {
        type: 'task_completed',
        taskId: taskData._id,
        title: `Team Task Completed: ${taskData.title}`,
        message: `A team member completed "${taskData.title}".`,
        timestamp: new Date(),
      });
    }

    // Broadcast to task room
    this.io.to(`task_${taskData._id}`).emit('task_completed', {
      taskId: taskData._id,
      title: taskData.title,
      completedAt: new Date(),
    });
  }

  // Get connected users count with optional by parameter
  getConnectedUsersCount({ by = 'users' } = {}) {
    if (by === 'sockets') {
      let totalSockets = 0;
      for (const sockets of this.connectedUsers.values()) {
        totalSockets += sockets.size;
      }
      return totalSockets;
    }
    return this.connectedUsers.size; // return unique users count
  }

  // Get connected users list with device count (for admin)
  getConnectedUsersList() {
    return Array.from(this.connectedUsers.entries()).map(([userId, sockets]) => ({
      userId,
      deviceCount: sockets.size,
      socketIds: Array.from(sockets),
      connectedAt: new Date(), // You might want to track this properly
    }));
  }

  // Send system-wide announcement
  broadcastSystemAnnouncement(announcement) {
    this.io.emit('system_announcement', {
      title: announcement.title,
      message: announcement.message,
      type: announcement.type || 'info',
      timestamp: new Date(),
    });
    console.log(`📢 System announcement broadcasted: ${announcement.title}`);
  }

  // Cleanup method to be called on server shutdown or hot reload
  destroy() {
    // Clear all intervals
    if (this._staleCleanupInterval) {
      clearInterval(this._staleCleanupInterval);
      this._staleCleanupInterval = null;
    }
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
      this.tokenCheckInterval = null;
    }

    // Clear all maps
    this.connectedUsers.clear();
    this.userRooms.clear();
    this.tokenMonitoring.clear();
    this.authAttempts.clear();

    // Clear all debounce timers
    if (this._metricsTimer) {
      clearTimeout(this._metricsTimer);
      this._metricsTimer = null;
    }
    this._typingThrottle.forEach(timerId => clearTimeout(timerId));
    this._typingThrottle.clear();
  }
}

module.exports = TaskSocketHandler;