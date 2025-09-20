import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { SocketEvents } from '../types';
import { socketService } from '../services/socketService';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

export function setupSocketIO(io: SocketIOServer) {
  console.log('🔌 Setting up Socket.IO server');

  // Middleware for authentication
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      if (!process.env.JWT_SECRET) {
        return next(new Error('Server configuration error'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      
      // Find user
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        return next(new Error('Invalid token or user not found'));
      }

      // Attach user info to socket
      socket.userId = user._id.toString();
      socket.userEmail = user.email;
      
      next();
    } catch (error: any) {
      console.error('Socket authentication error:', error.message);
      next(new Error('Authentication failed'));
    }
  });

  // Handle connections
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`👤 User connected: ${socket.userEmail} (${socket.id})`);

    // Join user to their personal room
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Handle authentication confirmation
    socket.on('authenticate', (data: { token: string }) => {
      socket.emit('authenticated', {
        userId: socket.userId,
        email: socket.userEmail
      });
    });

    // Handle task room management
    socket.on('join_task', (taskId: string) => {
      socket.join(`task:${taskId}`);
      console.log(`👥 ${socket.userEmail} joined task room: ${taskId}`);
    });

    socket.on('leave_task', (taskId: string) => {
      socket.leave(`task:${taskId}`);
      console.log(`👋 ${socket.userEmail} left task room: ${taskId}`);
    });

    // Handle project room management
    socket.on('join_project', (projectName: string) => {
      socket.join(`project:${projectName}`);
      console.log(`👥 ${socket.userEmail} joined project room: ${projectName}`);
    });

    // Handle task updates
    socket.on('task_update', (data: { taskId: string; changes: any; projectName?: string }) => {
      const updateData = {
        taskId: data.taskId,
        updatedBy: socket.userEmail,
        changes: data.changes,
        timestamp: new Date().toISOString()
      };

      // Broadcast to task room
      socket.to(`task:${data.taskId}`).emit('task_updated', updateData);

      // Broadcast to project room if specified
      if (data.projectName) {
        socket.to(`project:${data.projectName}`).emit('project_task_updated', {
          action: 'updated',
          ...updateData,
          projectName: data.projectName
        });
      }
    });

    // Handle task status changes
    socket.on('task_status_change', (data: { taskId: string; oldStatus: string; newStatus: string; projectName?: string }) => {
      const statusChangeData = {
        taskId: data.taskId,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        changedBy: socket.userEmail,
        timestamp: new Date().toISOString()
      };

      // Broadcast to task room
      socket.to(`task:${data.taskId}`).emit('task_status_changed', statusChangeData);

      // Broadcast to project room if specified
      if (data.projectName) {
        socket.to(`project:${data.projectName}`).emit('project_task_updated', {
          action: 'status_changed',
          ...statusChangeData,
          projectName: data.projectName
        });
      }

      // Emit completion event if task was completed
      if (data.newStatus === 'completed') {
        io.emit('task_completed', {
          taskId: data.taskId,
          completedBy: socket.userEmail,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle notification read events
    socket.on('notification_read', (notificationIds: string[]) => {
      // Broadcast to user's other sessions
      socket.to(`user:${socket.userId}`).emit('notifications_marked_read', {
        notificationIds,
        readBy: socket.userEmail,
        timestamp: new Date().toISOString()
      });
    });

    // Handle typing indicators
    socket.on('typing_start', (data: { taskId: string }) => {
      socket.to(`task:${data.taskId}`).emit('user_typing', {
        taskId: data.taskId,
        user: socket.userEmail,
        typing: true,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('typing_stop', (data: { taskId: string }) => {
      socket.to(`task:${data.taskId}`).emit('user_typing', {
        taskId: data.taskId,
        user: socket.userEmail,
        typing: false,
        timestamp: new Date().toISOString()
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`👤 User disconnected: ${socket.userEmail} (${reason})`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.userEmail}:`, error);
    });
  });

  // Periodic system updates
  setInterval(() => {
    // Emit system metrics update
    io.emit('metrics_update', {
      timestamp: new Date().toISOString(),
      type: 'system_metrics'
    });

    // Emit activity feed update
    io.emit('activity_update', {
      timestamp: new Date().toISOString(),
      type: 'activity_feed'
    });
  }, 30000); // Every 30 seconds

  // System announcements
  const sendSystemAnnouncement = (type: 'maintenance' | 'update' | 'alert', message: string) => {
    io.emit('system_announcement', {
      type,
      message,
      timestamp: new Date().toISOString()
    });
  };

  // Export utility functions
  return {
    // Send notification to specific user
    sendNotificationToUser: (userId: string, notification: any) => {
      io.to(`user:${userId}`).emit('notification', notification);
    },

    // Send notification to task participants
    sendNotificationToTask: (taskId: string, notification: any) => {
      io.to(`task:${taskId}`).emit('notification', notification);
    },

    // Send notification to project members
    sendNotificationToProject: (projectName: string, notification: any) => {
      io.to(`project:${projectName}`).emit('notification', notification);
    },

    // Broadcast system announcement
    sendSystemAnnouncement,

    // Send dashboard update
    sendDashboardUpdate: (data: any) => {
      io.emit('dashboard_update', {
        ...data,
        timestamp: new Date().toISOString()
      });
    },

    // Send task assignment notification
    sendTaskAssigned: (taskData: any) => {
      io.emit('task_assigned', {
        taskId: taskData._id,
        title: taskData.title,
        assignedTo: taskData.assignedTo,
        assignedBy: taskData.assignedBy,
        project: taskData.project,
        timestamp: new Date().toISOString()
      });
    },

    // Get connected users count
    getConnectedUsersCount: () => {
      return io.engine.clientsCount;
    },

    // Get rooms info
    getRoomsInfo: () => {
      const rooms = io.sockets.adapter.rooms;
      const roomsInfo: any = {};
      
      rooms.forEach((sockets, roomName) => {
        if (!roomName.startsWith('/')) { // Skip default rooms
          roomsInfo[roomName] = sockets.size;
        }
      });
      
      return roomsInfo;
    }
  };
}