'use client';

import { realApiRequest } from './api';

export interface User {
  _id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: 'admin' | 'manager' | 'user';
  permissions: string[];
  department?: string;
  jobTitle?: string;
  avatar?: string;
  phone?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  managedUsers?: User[];
  notificationPreferences?: {
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
  };
}

export interface UserStats {
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    department?: string;
  };
  taskStats: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    blocked: number;
    cancelled: number;
  };
  overdueTasks: number;
  upcomingTasks: number;
  completedThisMonth: number;
  avgCompletionTime: number;
  recentTasks: Array<{
    _id: string;
    title: string;
    status: string;
    priority: string;
    project: string;
    updatedAt: string;
  }>;
}

export interface UpdateRoleData {
  role: 'admin' | 'manager' | 'user';
  managedUsers?: string[];
}

export interface UserFilters {
  role?: string;
  department?: string;
  limit?: number;
  offset?: number;
  search?: string;
  active?: boolean;
}

export interface UsersResponse {
  success: boolean;
  data: User[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

class UserService {
  private cache = new Map<string, User[]>();
  private userCache = new Map<string, User>();
  private listeners = new Map<string, Function[]>();

  // Get all users with filtering and pagination
  async getUsers(filters: UserFilters = {}): Promise<UsersResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const queryString = queryParams.toString();
      const url = queryString ? `/users?${queryString}` : '/users';
      
      const response = await realApiRequest(url, {
        method: 'GET'
      });

      if (response.success) {
        // Cache the users
        const cacheKey = JSON.stringify(filters);
        this.cache.set(cacheKey, response.data);
        
        // Cache individual users
        response.data.forEach((user: User) => {
          this.userCache.set(user._id, user);
        });

        return response;
      }

      throw new Error(response.message || 'Failed to fetch users');
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  // Get user by ID
  async getUser(userId: string): Promise<{ success: boolean; data: User }> {
    try {
      const response = await realApiRequest(`/users/${userId}`, {
        method: 'GET'
      });

      if (response.success) {
        // Cache the user
        this.userCache.set(userId, response.data);
        return response;
      }

      throw new Error(response.message || 'Failed to fetch user');
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  }

  // Get team members (for managers/admins)
  async getTeamMembers(): Promise<{ success: boolean; data: User[] }> {
    try {
      const response = await realApiRequest('/users/team', {
        method: 'GET'
      });

      if (response.success) {
        // Cache team members
        response.data.forEach((user: User) => {
          this.userCache.set(user._id, user);
        });
        
        this.emit('team_members_loaded', response.data);
        return response;
      }

      throw new Error(response.message || 'Failed to fetch team members');
    } catch (error) {
      console.error('Error fetching team members:', error);
      throw error;
    }
  }

  // Get user statistics
  async getUserStats(userId: string): Promise<{ success: boolean; data: UserStats }> {
    try {
      const response = await realApiRequest(`/users/${userId}/stats`, {
        method: 'GET'
      });

      if (response.success) {
        return response;
      }

      throw new Error(response.message || 'Failed to fetch user stats');
    } catch (error) {
      console.error('Error fetching user stats:', error);
      throw error;
    }
  }

  // Update user role (admin only)
  async updateUserRole(userId: string, roleData: UpdateRoleData): Promise<{ success: boolean; data: any; message: string }> {
    try {
      const response = await realApiRequest(`/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify(roleData)
      });

      if (response.success) {
        // Update cached user
        const cachedUser = this.userCache.get(userId);
        if (cachedUser) {
          const updatedUser = {
            ...cachedUser,
            role: roleData.role,
            managedUsers: roleData.role === 'manager' ? roleData.managedUsers || [] : []
          };
          this.userCache.set(userId, updatedUser);
        }

        // Clear cache to force refresh
        this.cache.clear();
        this.emit('user_role_updated', { userId, roleData, user: response.data.user });
        
        return response;
      }

      throw new Error(response.message || 'Failed to update user role');
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }

  // Deactivate user (admin only)
  async deactivateUser(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await realApiRequest(`/users/${userId}`, {
        method: 'DELETE'
      });

      if (response.success) {
        // Update cached user
        const cachedUser = this.userCache.get(userId);
        if (cachedUser) {
          const updatedUser = { ...cachedUser, isActive: false };
          this.userCache.set(userId, updatedUser);
        }

        // Clear cache to force refresh
        this.cache.clear();
        this.emit('user_deactivated', { userId });
        
        return response;
      }

      throw new Error(response.message || 'Failed to deactivate user');
    } catch (error) {
      console.error('Error deactivating user:', error);
      throw error;
    }
  }

  // Get users by role (helper method)
  async getUsersByRole(role: 'admin' | 'manager' | 'user'): Promise<User[]> {
    try {
      const response = await this.getUsers({ role });
      return response.success ? response.data : [];
    } catch (error) {
      console.error('Error fetching users by role:', error);
      return [];
    }
  }

  // Get users by department (helper method)
  async getUsersByDepartment(department: string): Promise<User[]> {
    try {
      const response = await this.getUsers({ department });
      return response.success ? response.data : [];
    } catch (error) {
      console.error('Error fetching users by department:', error);
      return [];
    }
  }

  // Search users (helper method)
  async searchUsers(searchTerm: string, limit: number = 20): Promise<User[]> {
    try {
      const response = await this.getUsers({ search: searchTerm, limit });
      return response.success ? response.data : [];
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  // Get active users only (helper method)
  async getActiveUsers(): Promise<User[]> {
    try {
      const response = await this.getUsers({ active: true });
      return response.success ? response.data : [];
    } catch (error) {
      console.error('Error fetching active users:', error);
      return [];
    }
  }

  // Check if user has permission
  hasPermission(user: User, permission: string): boolean {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission) || user.role === 'admin';
  }

  // Check if user can assign tasks
  canAssignTasks(user: User): boolean {
    return this.hasPermission(user, 'assign_tasks') || ['admin', 'manager'].includes(user.role);
  }

  // Check if user can view all tasks
  canViewAllTasks(user: User): boolean {
    return this.hasPermission(user, 'view_all_tasks') || ['admin', 'manager'].includes(user.role);
  }

  // Check if user can manage users
  canManageUsers(user: User): boolean {
    return this.hasPermission(user, 'manage_users') || user.role === 'admin';
  }

  // Check if user can view analytics
  canViewAnalytics(user: User): boolean {
    return this.hasPermission(user, 'view_analytics') || ['admin', 'manager'].includes(user.role);
  }

  // Get role display name
  getRoleDisplayName(role: string): string {
    const roleNames = {
      admin: 'Administrator',
      manager: 'Manager',
      user: 'User'
    };
    return roleNames[role as keyof typeof roleNames] || role;
  }

  // Get role color
  getRoleColor(role: string): string {
    const roleColors = {
      admin: 'bg-red-100 text-red-800',
      manager: 'bg-blue-100 text-blue-800',
      user: 'bg-green-100 text-green-800'
    };
    return roleColors[role as keyof typeof roleColors] || 'bg-gray-100 text-gray-800';
  }

  // Format user for display
  formatUserForDisplay(user: User) {
    return {
      ...user,
      displayName: user.fullName || `${user.firstName} ${user.lastName}`,
      roleDisplayName: this.getRoleDisplayName(user.role),
      roleColor: this.getRoleColor(user.role),
      initials: `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase(),
      isOnline: user.lastLogin ? 
        (new Date().getTime() - new Date(user.lastLogin).getTime()) < (15 * 60 * 1000) : // 15 minutes
        false
    };
  }

  // Get departments list
  async getDepartments(): Promise<string[]> {
    try {
      const response = await this.getUsers();
      if (response.success) {
        const departments = new Set<string>();
        response.data.forEach(user => {
          if (user.department) {
            departments.add(user.department);
          }
        });
        return Array.from(departments).sort();
      }
      return [];
    } catch (error) {
      console.error('Error fetching departments:', error);
      return [];
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

  private emit(event: string, data?: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  // Cache management
  getCachedUsers(filters: UserFilters): User[] | null {
    const cacheKey = JSON.stringify(filters);
    return this.cache.get(cacheKey) || null;
  }

  getCachedUser(userId: string): User | null {
    return this.userCache.get(userId) || null;
  }

  clearCache() {
    this.cache.clear();
    this.userCache.clear();
  }

  // Update cached user
  updateCachedUser(userId: string, updates: Partial<User>) {
    const cachedUser = this.userCache.get(userId);
    if (cachedUser) {
      const updatedUser = { ...cachedUser, ...updates };
      this.userCache.set(userId, updatedUser);
      this.emit('user_updated', updatedUser);
    }
  }
}

// Export singleton instance
export const userService = new UserService();
export default userService;
