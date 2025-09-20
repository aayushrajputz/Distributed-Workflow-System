import { Server as SocketIOServer } from 'socket.io';

class SocketService {
  private static instance: SocketService;
  private io: SocketIOServer | null = null;

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  setIO(io: SocketIOServer) {
    this.io = io;
  }

  getIO(): SocketIOServer | null {
    return this.io;
  }

  // Emit task created event
  emitTaskCreated(taskData: any) {
    if (this.io) {
      this.io.emit('task_created', {
        taskId: taskData._id,
        task: taskData,
        createdBy: taskData.createdBy,
        timestamp: new Date().toISOString()
      });

      // Emit to project room
      this.io.to(`project:${taskData.project}`).emit('project_task_updated', {
        action: 'created',
        taskId: taskData._id,
        task: taskData,
        projectName: taskData.project
      });
    }
  }

  // Emit task updated event
  emitTaskUpdated(taskId: string, updatedBy: string, changes: any, task: any) {
    if (this.io) {
      this.io.emit('task_updated', {
        taskId,
        updatedBy,
        changes,
        timestamp: new Date().toISOString()
      });

      // Emit to project room
      this.io.to(`project:${task.project}`).emit('project_task_updated', {
        action: 'updated',
        taskId,
        task,
        changes,
        projectName: task.project
      });
    }
  }

  // Emit task status changed event
  emitTaskStatusChanged(taskId: string, oldStatus: string, newStatus: string, changedBy: string, task: any) {
    if (this.io) {
      this.io.emit('task_status_changed', {
        taskId,
        oldStatus,
        newStatus,
        changedBy,
        timestamp: new Date().toISOString()
      });

      // Emit task completion event
      if (newStatus === 'completed') {
        this.io.emit('task_completed', {
          taskId,
          task,
          completedBy: changedBy,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Emit task deleted event
  emitTaskDeleted(data: { taskId: string; deletedBy: string; project?: string; task?: any }) {
    if (this.io) {
      this.io.emit('task_deleted', {
        taskId: data.taskId,
        deletedBy: data.deletedBy,
        timestamp: new Date().toISOString()
      });

      if (data.project) {
        this.io.to(`project:${data.project}`).emit('project_task_updated', {
          action: 'deleted',
          taskId: data.taskId,
          task: data.task,
          projectName: data.project
        });
      }
    }
  }

  // Emit task comment added event
  emitTaskCommentAdded(data: { taskId: string; comment: any; project?: string }) {
    if (this.io) {
      this.io.emit('task_comment_added', {
        taskId: data.taskId,
        comment: data.comment,
        timestamp: new Date().toISOString()
      });

      if (data.project) {
        this.io.to(`project:${data.project}`).emit('project_task_updated', {
          action: 'comment_added',
          taskId: data.taskId,
          comment: data.comment,
          projectName: data.project
        });
      }
    }
  }

  // Emit notification to user
  emitNotificationToUser(userId: string, notification: any) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit('notification', notification);
    }
  }

  // Emit notification to task participants
  emitNotificationToTask(taskId: string, notification: any) {
    if (this.io) {
      this.io.to(`task:${taskId}`).emit('notification', notification);
    }
  }

  // Emit notification to project members
  emitNotificationToProject(projectName: string, notification: any) {
    if (this.io) {
      this.io.to(`project:${projectName}`).emit('notification', notification);
    }
  }

  // Send dashboard update
  emitDashboardUpdate(data: any) {
    if (this.io) {
      this.io.emit('dashboard_update', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Send system announcement
  emitSystemAnnouncement(type: 'maintenance' | 'update' | 'alert', message: string) {
    if (this.io) {
      this.io.emit('system_announcement', {
        type,
        message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    if (!this.io) return 0;
    return this.io.engine.clientsCount;
  }

  // Get rooms info
  getRoomsInfo(): Record<string, number> {
    if (!this.io) return {};
    const rooms = this.io.sockets.adapter.rooms as Map<string, Set<string>>;
    const roomsInfo: Record<string, number> = {};

    rooms.forEach((sockets: Set<string>, roomName: string) => {
      if (!roomName.startsWith('/')) { // Skip default rooms
        roomsInfo[roomName] = sockets.size;
      }
    });

    return roomsInfo;
  }
}

export const socketService = SocketService.getInstance();
export default socketService;
