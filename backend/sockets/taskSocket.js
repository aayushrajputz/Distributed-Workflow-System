const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Task = require('../models/Task');
const notificationService = require('../services/notificationService');
const { getPrometheusService } = require('../services/prometheusService');

class TaskSocketHandler {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> socketId mapping
    this.userRooms = new Map(); // socketId -> userId mapping
    this.setupSocketHandlers();
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

      // Handle typing indicators for task comments
      socket.on('typing_start', (data) => {
        if (data.taskId) {
          socket.to(`task_${data.taskId}`).emit('user_typing', {
            userId: this.userRooms.get(socket.id),
            taskId: data.taskId,
            typing: true,
          });
        }
      });

      socket.on('typing_stop', (data) => {
        if (data.taskId) {
          socket.to(`task_${data.taskId}`).emit('user_typing', {
            userId: this.userRooms.get(socket.id),
            taskId: data.taskId,
            typing: false,
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  // Authenticate socket connection
  async authenticateSocket(socket, token) {
    if (!token) {
      throw new Error('No token provided');
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.isActive) {
      throw new Error('Invalid user');
    }

    // Store user mapping
    this.connectedUsers.set(user._id.toString(), socket.id);
    this.userRooms.set(socket.id, user._id.toString());

    // Join user-specific room for notifications
    socket.join(`user_${user._id}`);

    // Store user data in socket
    socket.userId = user._id.toString();
    socket.userRole = user.role;
    socket.userPermissions = user.permissions;

    console.log(`✅ Socket authenticated: ${user.email} (${user.role})`);

    // Send authentication success
    socket.emit('authenticated', {
      userId: user._id,
      role: user.role,
      permissions: user.permissions,
    });

    // Send any pending notifications
    await this.sendPendingNotifications(socket, user._id);
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

  // Handle task status changes
  async handleTaskStatusChange(socket, data) {
    const { userId } = socket;
    if (!userId) {
      throw new Error('Socket not authenticated');
    }

    // Broadcast status change to all relevant users
    if (data.taskId) {
      this.io.to(`task_${data.taskId}`).emit('task_status_changed', {
        taskId: data.taskId,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        changedBy: userId,
        timestamp: new Date(),
      });

      // Broadcast to project room
      if (data.projectName) {
        this.io.to(`project_${data.projectName}`).emit('project_task_status_changed', {
          taskId: data.taskId,
          projectName: data.projectName,
          oldStatus: data.oldStatus,
          newStatus: data.newStatus,
          changedBy: userId,
          timestamp: new Date(),
        });
      }

      // Send dashboard update to all managers and admins
      this.broadcastDashboardUpdate(data.taskId, data.newStatus, userId);

      // Update Prometheus metrics
      this.updateTaskMetrics();
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

  // Broadcast dashboard update to managers and admins
  async broadcastDashboardUpdate(taskId, newStatus, changedBy) {
    try {
      // Find all managers and admins
      const managers = await User.find({
        $or: [
          { role: 'admin' },
          { role: 'manager' },
        ],
        isActive: true,
      });

      // Send dashboard update to each manager/admin
      for (const manager of managers) {
        const socketId = this.connectedUsers.get(manager._id.toString());
        if (socketId) {
          this.io.to(socketId).emit('dashboard_update', {
            type: 'task_status_change',
            taskId,
            newStatus,
            changedBy,
            timestamp: new Date(),
          });
        }
      }

      // Broadcast real-time metrics update to all connected users
      this.broadcastMetricsUpdate();
    } catch (error) {
      console.error('❌ Error broadcasting dashboard update:', error);
    }
  }

  // Update task metrics in Prometheus
  async updateTaskMetrics() {
    try {
      const [totalTasks, pendingTasks, inProgressTasks, completedTasks, blockedTasks] = await Promise.all([
        Task.countDocuments(),
        Task.countDocuments({ status: 'pending' }),
        Task.countDocuments({ status: 'in_progress' }),
        Task.countDocuments({ status: 'completed' }),
        Task.countDocuments({ status: 'blocked' }),
      ]);

      const taskStats = {
        total: totalTasks,
        pending: pendingTasks,
        in_progress: inProgressTasks,
        completed: completedTasks,
        blocked: blockedTasks,
      };

      const prometheusService = getPrometheusService();
      prometheusService.updateTaskMetrics(taskStats);
    } catch (error) {
      console.error('Error updating task metrics:', error);
    }
  }

  // Broadcast real-time metrics to all connected users
  async broadcastMetricsUpdate() {
    try {
      // Get current task stats
      const [totalTasks, pendingTasks, inProgressTasks, completedTasks, blockedTasks] = await Promise.all([
        Task.countDocuments(),
        Task.countDocuments({ status: 'pending' }),
        Task.countDocuments({ status: 'in_progress' }),
        Task.countDocuments({ status: 'completed' }),
        Task.countDocuments({ status: 'blocked' }),
      ]);

      const taskMetrics = {
        total: totalTasks,
        pending: pendingTasks,
        in_progress: inProgressTasks,
        completed: completedTasks,
        blocked: blockedTasks,
        completion_rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100 * 100) / 100 : 0,
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

  // Handle socket disconnect
  handleDisconnect(socket) {
    const userId = this.userRooms.get(socket.id);

    if (userId) {
      this.connectedUsers.delete(userId);
      this.userRooms.delete(socket.id);
      console.log(`👋 Socket disconnected: ${socket.id} (user: ${userId})`);
    } else {
      console.log(`👋 Socket disconnected: ${socket.id}`);
    }
  }

  // Broadcast notification to specific user
  broadcastNotificationToUser(userId, notification) {
    const socketId = this.connectedUsers.get(userId.toString());
    if (socketId) {
      this.io.to(socketId).emit('notification', notification);
      console.log(`📡 Notification broadcasted to user ${userId}`);
      return true;
    }
    return false;
  }

  // Broadcast task assignment to user
  broadcastTaskAssignment(userId, taskData) {
    const socketId = this.connectedUsers.get(userId.toString());
    if (socketId) {
      this.io.to(socketId).emit('task_assigned', taskData);
      console.log(`📋 Task assignment broadcasted to user ${userId}`);
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

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Get connected users list (for admin)
  getConnectedUsersList() {
    return Array.from(this.connectedUsers.entries()).map(([userId, socketId]) => ({
      userId,
      socketId,
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
}

module.exports = TaskSocketHandler;
