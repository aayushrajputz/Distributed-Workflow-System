'use client';

import { realApiRequest } from './api';

export interface Notification {
  _id: string;
  userId: string;
  type: 'task_assigned' | 'task_completed' | 'task_overdue' | 'task_reminder' | 'workflow_update' | 'system' | 'mention';
  title: string;
  message: string;
  data?: {
    taskId?: string;
    projectName?: string;
    assignedBy?: string;
    dueDate?: string;
    priority?: string;
    url?: string;
  };
  channels: ('in_app' | 'email' | 'slack' | 'websocket')[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byPriority: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  byType: {
    task_assigned: number;
    task_completed: number;
    task_overdue: number;
    task_reminder: number;
    workflow_update: number;
    system: number;
    mention: number;
  };
}

export interface NotificationPreferences {
  email: {
    enabled: boolean;
    taskAssigned: boolean;
    taskCompleted: boolean;
    taskOverdue: boolean;
    taskReminder: boolean;
    workflowUpdate: boolean;
    dailyDigest: boolean;
  };
  slack: {
    enabled: boolean;
    taskAssigned: boolean;
    taskCompleted: boolean;
    taskOverdue: boolean;
    urgentOnly: boolean;
  };
  inApp: {
    enabled: boolean;
    showToasts: boolean;
    playSound: boolean;
    desktopNotifications: boolean;
  };
  websocket: {
    enabled: boolean;
    realTimeUpdates: boolean;
  };
}

class NotificationService {
  private cache = new Map<string, Notification[]>();
  private listeners = new Map<string, Function[]>();

  // Get notifications with filtering and pagination
  async getNotifications(params: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    type?: string;
    priority?: string;
  } = {}): Promise<{
    notifications: Notification[];
    pagination: {
      limit: number;
      offset: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.offset) queryParams.append('offset', params.offset.toString());
      if (params.unreadOnly) queryParams.append('unreadOnly', 'true');
      if (params.type) queryParams.append('type', params.type);
      if (params.priority) queryParams.append('priority', params.priority);

      const response = await realApiRequest(`/notifications?${queryParams.toString()}`, {
        method: 'GET'
      });

      if (response.success) {
        // Cache the notifications
        const cacheKey = JSON.stringify(params);
        this.cache.set(cacheKey, response.data.notifications);
        
        return {
          notifications: response.data.notifications,
          pagination: response.data.pagination
        };
      }

      throw new Error(response.message || 'Failed to fetch notifications');
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  // Get notification statistics
  async getNotificationStats(): Promise<NotificationStats> {
    try {
      const response = await realApiRequest('/notifications/stats', {
        method: 'GET'
      });

      if (response.success) {
        return response.data;
      }

      throw new Error(response.message || 'Failed to fetch notification stats');
    } catch (error) {
      console.error('Error fetching notification stats:', error);
      throw error;
    }
  }

  // Mark notifications as read
  async markAsRead(notificationIds: string[]): Promise<void> {
    try {
      const response = await realApiRequest('/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ notificationIds })
      });

      if (response.success) {
        // Update cache
        this.updateCacheReadStatus(notificationIds, true);
        this.emit('notifications_read', notificationIds);
        return;
      }

      throw new Error(response.message || 'Failed to mark notifications as read');
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllAsRead(): Promise<void> {
    try {
      const response = await realApiRequest('/notifications/read-all', {
        method: 'POST'
      });

      if (response.success) {
        // Clear cache to force refresh
        this.cache.clear();
        this.emit('all_notifications_read');
        return;
      }

      throw new Error(response.message || 'Failed to mark all notifications as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Delete notifications
  async deleteNotifications(notificationIds: string[]): Promise<void> {
    try {
      const response = await realApiRequest('/notifications', {
        method: 'DELETE',
        body: JSON.stringify({ notificationIds })
      });

      if (response.success) {
        // Update cache
        this.removeCacheItems(notificationIds);
        this.emit('notifications_deleted', notificationIds);
        return;
      }

      throw new Error(response.message || 'Failed to delete notifications');
    } catch (error) {
      console.error('Error deleting notifications:', error);
      throw error;
    }
  }

  // Get notification preferences
  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const response = await realApiRequest('/notifications/preferences', {
        method: 'GET'
      });

      if (response.success) {
        return response.data;
      }

      throw new Error(response.message || 'Failed to fetch notification preferences');
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      throw error;
    }
  }

  // Update notification preferences
  async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    try {
      const response = await realApiRequest('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify(preferences)
      });

      if (response.success) {
        this.emit('preferences_updated', preferences);
        return;
      }

      throw new Error(response.message || 'Failed to update notification preferences');
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  // Send test notification (admin only)
  async sendTestNotification(type: string, userId?: string): Promise<void> {
    try {
      const response = await realApiRequest('/notifications/test', {
        method: 'POST',
        body: JSON.stringify({ type, userId })
      });

      if (response.success) {
        return;
      }

      throw new Error(response.message || 'Failed to send test notification');
    } catch (error) {
      console.error('Error sending test notification:', error);
      throw error;
    }
  }

  // Request browser notification permission
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission;
    }

    return Notification.permission;
  }

  // Show browser notification
  showBrowserNotification(title: string, options: {
    body?: string;
    icon?: string;
    tag?: string;
    data?: any;
    requireInteraction?: boolean;
  } = {}) {
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction || false
      });

      notification.onclick = () => {
        window.focus();
        if (options.data?.url) {
          window.location.href = options.data.url;
        }
        notification.close();
      };

      // Auto-close after 5 seconds unless requireInteraction is true
      if (!options.requireInteraction) {
        setTimeout(() => notification.close(), 5000);
      }

      return notification;
    }
  }

  // Play notification sound
  playNotificationSound(type: 'default' | 'urgent' | 'success' = 'default') {
    try {
      const audio = new Audio();
      
      switch (type) {
        case 'urgent':
          audio.src = '/sounds/urgent-notification.mp3';
          break;
        case 'success':
          audio.src = '/sounds/success-notification.mp3';
          break;
        default:
          audio.src = '/sounds/default-notification.mp3';
      }
      
      audio.volume = 0.5;
      audio.play().catch(console.warn);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }

  // Cache management
  private updateCacheReadStatus(notificationIds: string[], isRead: boolean) {
    this.cache.forEach((notifications, key) => {
      const updated = notifications.map(notification => {
        if (notificationIds.includes(notification._id)) {
          return {
            ...notification,
            isRead,
            readAt: isRead ? new Date().toISOString() : undefined
          };
        }
        return notification;
      });
      this.cache.set(key, updated);
    });
  }

  private removeCacheItems(notificationIds: string[]) {
    this.cache.forEach((notifications, key) => {
      const filtered = notifications.filter(
        notification => !notificationIds.includes(notification._id)
      );
      this.cache.set(key, filtered);
    });
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

  private emit(event: string, data?: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  // Clear all cached data
  clearCache() {
    this.cache.clear();
  }

  // Get cached notifications
  getCachedNotifications(params: any): Notification[] | null {
    const cacheKey = JSON.stringify(params);
    return this.cache.get(cacheKey) || null;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;
