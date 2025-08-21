'use client';

import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
}

export interface TaskUpdateData {
  taskId: string;
  updatedBy: string;
  changes: any;
  timestamp: string;
}

export interface TaskStatusChangeData {
  taskId: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  timestamp: string;
}

class WebSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Function[]> = new Map();

  // Initialize WebSocket connection
  connect(token: string) {
    if (this.socket?.connected) {
      console.log('🔌 WebSocket already connected');
      return;
    }

    const serverUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
    
    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    this.setupEventHandlers();
  }

  // Setup event handlers
  private setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Authenticate the socket
      const token = localStorage.getItem('token');
      if (token) {
        this.socket?.emit('authenticate', { token });
      }
    });

    this.socket.on('authenticated', (data) => {
      console.log('🔐 WebSocket authenticated:', data);
      this.emit('authenticated', data);
    });

    this.socket.on('auth_error', (error) => {
      console.error('❌ WebSocket authentication failed:', error);
      toast.error('Real-time connection failed. Please refresh the page.');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      this.isConnected = false;
      this.handleReconnection();
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.handleReconnection();
    });

    // Task-related events
    this.socket.on('notification', (notification: NotificationData) => {
      this.handleNotification(notification);
    });

    this.socket.on('task_updated', (data: TaskUpdateData) => {
      this.emit('task_updated', data);
    });

    this.socket.on('task_status_changed', (data: TaskStatusChangeData) => {
      this.emit('task_status_changed', data);
      this.showTaskStatusNotification(data);
    });

    this.socket.on('task_assigned', (data: any) => {
      this.emit('task_assigned', data);
      toast.success(`New task assigned: ${data.title}`);
    });

    this.socket.on('task_completed', (data: any) => {
      this.emit('task_completed', data);
      toast.success(`Task completed: ${data.title}`);
    });

    this.socket.on('dashboard_update', (data: any) => {
      this.emit('dashboard_update', data);
    });

    this.socket.on('project_task_updated', (data: any) => {
      this.emit('project_task_updated', data);
    });

    this.socket.on('user_typing', (data: any) => {
      this.emit('user_typing', data);
    });

    this.socket.on('pending_notifications', (data: any) => {
      this.emit('pending_notifications', data);
    });

    // Real-time metrics events
    this.socket.on('metrics_update', (data: any) => {
      this.emit('metrics_update', data);
    });

    this.socket.on('activity_update', (data: any) => {
      this.emit('activity_update', data);
    });

    this.socket.on('notifications_marked_read', (data: any) => {
      this.emit('notifications_marked_read', data);
    });

    this.socket.on('system_announcement', (data: any) => {
      this.handleSystemAnnouncement(data);
    });

    this.socket.on('error', (error: any) => {
      console.error('❌ WebSocket error:', error);
      toast.error(error.message || 'Real-time connection error');
    });
  }

  // Handle incoming notifications
  private handleNotification(notification: NotificationData) {
    this.emit('notification', notification);
    
    // Show toast notification based on priority
    const toastOptions = {
      duration: notification.priority === 'urgent' ? 10000 : 5000,
      action: notification.data?.taskId ? {
        label: 'View Task',
        onClick: () => {
          window.location.href = `/tasks/${notification.data.taskId}`;
        }
      } : undefined
    };

    switch (notification.priority) {
      case 'urgent':
        toast.error(notification.message, toastOptions);
        break;
      case 'high':
        toast.warning(notification.message, toastOptions);
        break;
      case 'medium':
        toast.info(notification.message, toastOptions);
        break;
      default:
        toast(notification.message, toastOptions);
    }
  }

  // Show task status change notification
  private showTaskStatusNotification(data: TaskStatusChangeData) {
    const statusColors = {
      pending: '🟡',
      in_progress: '🔵',
      completed: '✅',
      blocked: '🔴',
      cancelled: '⚫'
    };

    const message = `Task status changed: ${statusColors[data.oldStatus as keyof typeof statusColors]} → ${statusColors[data.newStatus as keyof typeof statusColors]}`;
    toast.info(message, {
      action: {
        label: 'View Task',
        onClick: () => {
          window.location.href = `/tasks/${data.taskId}`;
        }
      }
    });
  }

  // Handle system announcements
  private handleSystemAnnouncement(data: any) {
    this.emit('system_announcement', data);
    
    switch (data.type) {
      case 'maintenance':
        toast.warning(data.message, { duration: 10000 });
        break;
      case 'update':
        toast.info(data.message, { duration: 8000 });
        break;
      case 'alert':
        toast.error(data.message, { duration: 12000 });
        break;
      default:
        toast(data.message, { duration: 6000 });
    }
  }

  // Handle reconnection logic
  private handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      toast.error('Lost connection to server. Please refresh the page.');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      const token = localStorage.getItem('token');
      if (token) {
        this.connect(token);
      }
    }, delay);
  }

  // Join task room for real-time updates
  joinTask(taskId: string) {
    if (this.socket?.connected) {
      this.socket.emit('join_task', taskId);
      console.log(`👥 Joined task room: ${taskId}`);
    }
  }

  // Leave task room
  leaveTask(taskId: string) {
    if (this.socket?.connected) {
      this.socket.emit('leave_task', taskId);
      console.log(`👋 Left task room: ${taskId}`);
    }
  }

  // Join project room for real-time updates
  joinProject(projectName: string) {
    if (this.socket?.connected) {
      this.socket.emit('join_project', projectName);
      console.log(`👥 Joined project room: ${projectName}`);
    }
  }

  // Send task update
  sendTaskUpdate(taskId: string, changes: any, projectName?: string) {
    if (this.socket?.connected) {
      this.socket.emit('task_update', {
        taskId,
        changes,
        projectName
      });
    }
  }

  // Send task status change
  sendTaskStatusChange(taskId: string, oldStatus: string, newStatus: string, projectName?: string) {
    if (this.socket?.connected) {
      this.socket.emit('task_status_change', {
        taskId,
        oldStatus,
        newStatus,
        projectName
      });
    }
  }

  // Mark notifications as read
  markNotificationsAsRead(notificationIds: string[]) {
    if (this.socket?.connected) {
      this.socket.emit('notification_read', notificationIds);
    }
  }

  // Send typing indicator
  startTyping(taskId: string) {
    if (this.socket?.connected) {
      this.socket.emit('typing_start', { taskId });
    }
  }

  stopTyping(taskId: string) {
    if (this.socket?.connected) {
      this.socket.emit('typing_stop', { taskId });
    }
  }

  // Event listener management
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  off(event: string, callback?: Function) {
    if (!callback) {
      this.listeners.delete(event);
      return;
    }
    
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  // Disconnect WebSocket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
      console.log('🔌 WebSocket disconnected');
    }
  }

  // Get connection status
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  // Get socket instance (for advanced usage)
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
export default webSocketService;
