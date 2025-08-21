import { realApiRequest } from './api';
import { webSocketService } from './websocket-service';

export interface Task {
  _id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignedBy: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  project: string;
  tags: string[];
  dueDate: string;
  scheduledDate: string;
  estimatedHours?: number;
  actualHours: number;
  progress: number;
  attachments: Array<{
    filename: string;
    url: string;
    uploadedAt: string;
  }>;
  comments: Array<{
    _id: string;
    user: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    text: string;
    createdAt: string;
  }>;
  isActive: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  isOverdue?: boolean;
  daysRemaining?: number;
}

export interface CreateTaskData {
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  project: string;
  tags?: string[];
  dueDate: string;
  scheduledDate: string;
  estimatedHours?: number;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  progress?: number;
  actualHours?: number;
  dueDate?: string;
  scheduledDate?: string;
  estimatedHours?: number;
  tags?: string[];
}

export interface TaskStats {
  taskStats: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    blocked: number;
    cancelled: number;
  };
  completionRate: number;
  overdueTasks: number;
  upcomingTasks: number;
  priorityDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  projectStats: Array<{
    name: string;
    totalTasks: number;
    completedTasks: number;
    progress: number;
  }>;
}

export interface TaskFilters {
  status?: string;
  priority?: string;
  project?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

export interface TaskResponse {
  success: boolean;
  data: Task[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class TaskService {
  private listeners = new Map<string, Function[]>();
  private taskCache = new Map<string, Task>();
  // Get all tasks with optional filters
  async getTasks(filters: TaskFilters = {}): Promise<TaskResponse> {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });

    const queryString = queryParams.toString();
    const url = queryString ? `/tasks?${queryString}` : '/tasks';
    
    return realApiRequest(url, {
      method: 'GET',
    });
  }

  // Get single task by ID
  async getTask(taskId: string): Promise<{ success: boolean; data: Task }> {
    const response = await realApiRequest(`/api/tasks/${taskId}`, {
      method: 'GET',
    });

    if (response.success) {
      const task = response.data;
      // Cache the task
      this.taskCache.set(taskId, task);
      // Join task room for real-time updates
      if (webSocketService.isSocketConnected()) {
        webSocketService.joinTask(taskId);
        if (task.project) {
          webSocketService.joinProject(task.project);
        }
      }
    }

    return response;
  }

  // Create new task
  async createTask(taskData: CreateTaskData): Promise<{ success: boolean; data: Task; message: string }> {
    console.log('🔨 Creating task with data:', taskData);

    // Validate required fields before sending
    if (!taskData.title?.trim()) {
      throw new Error('Task title is required');
    }
    if (!taskData.description?.trim()) {
      throw new Error('Task description is required');
    }
    if (!taskData.project?.trim()) {
      throw new Error('Project name is required');
    }
    if (!taskData.dueDate) {
      throw new Error('Due date is required');
    }
    if (!taskData.scheduledDate) {
      throw new Error('Scheduled date is required');
    }

    const response = await realApiRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });

    if (response.success && webSocketService.isSocketConnected()) {
      const newTask = response.data;
      // Join task room for real-time updates
      webSocketService.joinTask(newTask._id);
      if (newTask.project) {
        webSocketService.joinProject(newTask.project);
      }
      // Cache the task
      this.taskCache.set(newTask._id, newTask);
      this.emit('task_created', newTask);
    }

    return response;
  }

  // Update existing task
  async updateTask(taskId: string, taskData: UpdateTaskData): Promise<{ success: boolean; data: Task; message: string }> {
    const oldTask = this.taskCache.get(taskId);
    const response = await realApiRequest(`/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(taskData),
    });

    if (response.success && webSocketService.isSocketConnected()) {
      const updatedTask = response.data;
      // Send real-time update
      webSocketService.sendTaskUpdate(taskId, taskData, updatedTask.project);
      // Update cache
      this.taskCache.set(taskId, updatedTask);
      this.emit('task_updated', { oldTask, newTask: updatedTask, changes: taskData });
    }

    return response;
  }

  // Update task status only
  async updateTaskStatus(taskId: string, status: Task['status']): Promise<{ success: boolean; data: Task; message: string }> {
    const oldTask = this.taskCache.get(taskId);
    const response = await realApiRequest(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });

    if (response.success && webSocketService.isSocketConnected()) {
      const updatedTask = response.data;
      const oldStatus = oldTask?.status || 'unknown';
      // Send real-time status change
      webSocketService.sendTaskStatusChange(taskId, oldStatus, status, updatedTask.project);
      // Update cache
      this.taskCache.set(taskId, updatedTask);
      this.emit('task_status_changed', { taskId, oldStatus, newStatus: status, task: updatedTask });
    }

    return response;
  }

  // Delete task (soft delete)
  async deleteTask(taskId: string): Promise<{ success: boolean; message: string }> {
    return realApiRequest(`/api/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  // Get task statistics for dashboard
  async getTaskStats(): Promise<{ success: boolean; data: TaskStats }> {
    return realApiRequest('/api/tasks/stats', {
      method: 'GET',
    });
  }

  // Get recent tasks for activity feed
  async getRecentTasks(limit: number = 10): Promise<{ success: boolean; data: Task[] }> {
    return realApiRequest(`/api/tasks/recent?limit=${limit}`, {
      method: 'GET',
    });
  }

  // Add comment to task
  async addComment(taskId: string, text: string): Promise<{ success: boolean; data: any; message: string }> {
    return realApiRequest(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  // Get tasks by status (helper method)
  async getTasksByStatus(status: Task['status']): Promise<Task[]> {
    const response = await this.getTasks({ status });
    return response.success ? response.data : [];
  }

  // Get tasks by priority (helper method)
  async getTasksByPriority(priority: Task['priority']): Promise<Task[]> {
    const response = await this.getTasks({ priority });
    return response.success ? response.data : [];
  }

  // Get tasks by project (helper method)
  async getTasksByProject(project: string): Promise<Task[]> {
    const response = await this.getTasks({ project });
    return response.success ? response.data : [];
  }

  // Get overdue tasks (helper method)
  async getOverdueTasks(): Promise<Task[]> {
    const response = await this.getTasks({ sort: 'dueDate' });
    if (!response.success) return [];
    
    const now = new Date();
    return response.data.filter(task => 
      new Date(task.dueDate) < now && 
      task.status !== 'completed' && 
      task.status !== 'cancelled'
    );
  }

  // Get upcoming tasks (helper method)
  async getUpcomingTasks(days: number = 7): Promise<Task[]> {
    const response = await this.getTasks({ sort: 'dueDate' });
    if (!response.success) return [];
    
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    return response.data.filter(task => {
      const dueDate = new Date(task.dueDate);
      return dueDate >= now && 
             dueDate <= endDate && 
             task.status !== 'completed' && 
             task.status !== 'cancelled';
    });
  }

  // Format task for display (helper method)
  formatTaskForDisplay(task: Task) {
    return {
      ...task,
      formattedDueDate: new Date(task.dueDate).toLocaleDateString(),
      formattedScheduledDate: new Date(task.scheduledDate).toLocaleDateString(),
      formattedCreatedAt: new Date(task.createdAt).toLocaleDateString(),
      assignedToName: `${task.assignedTo.firstName} ${task.assignedTo.lastName}`,
      assignedByName: `${task.assignedBy.firstName} ${task.assignedBy.lastName}`,
      statusColor: this.getStatusColor(task.status),
      priorityColor: this.getPriorityColor(task.priority),
      isOverdue: new Date(task.dueDate) < new Date() && task.status !== 'completed',
      daysRemaining: Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    };
  }

  // Get status color (helper method)
  private getStatusColor(status: Task['status']): string {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      blocked: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  // Get priority color (helper method)
  private getPriorityColor(priority: Task['priority']): string {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  }

  // Real-time event handling methods
  initializeWebSocketHandlers() {
    if (!webSocketService.isSocketConnected()) return;

    // Handle real-time task updates
    webSocketService.on('task_updated', (data: any) => {
      const { taskId, changes } = data;
      const cachedTask = this.taskCache.get(taskId);
      if (cachedTask) {
        const updatedTask = { ...cachedTask, ...changes, updatedAt: new Date().toISOString() };
        this.taskCache.set(taskId, updatedTask);
        this.emit('task_updated', { taskId, task: updatedTask, changes });
      }
    });

    // Handle real-time status changes
    webSocketService.on('task_status_changed', (data: any) => {
      const { taskId, newStatus } = data;
      const cachedTask = this.taskCache.get(taskId);
      if (cachedTask) {
        const updatedTask = { ...cachedTask, status: newStatus, updatedAt: new Date().toISOString() };
        this.taskCache.set(taskId, updatedTask);
        this.emit('task_status_changed', data);
      }
    });

    // Handle task assignments
    webSocketService.on('task_assigned', (data: any) => {
      this.emit('task_assigned', data);
    });

    // Handle task completions
    webSocketService.on('task_completed', (data: any) => {
      this.emit('task_completed', data);
    });

    // Handle dashboard updates
    webSocketService.on('dashboard_update', (data: any) => {
      this.emit('dashboard_update', data);
    });
  }

  // Join task room for real-time updates
  joinTaskRoom(taskId: string) {
    if (webSocketService.isSocketConnected()) {
      webSocketService.joinTask(taskId);
    }
  }

  // Leave task room
  leaveTaskRoom(taskId: string) {
    if (webSocketService.isSocketConnected()) {
      webSocketService.leaveTask(taskId);
    }
  }

  // Join project room for real-time updates
  joinProjectRoom(projectName: string) {
    if (webSocketService.isSocketConnected()) {
      webSocketService.joinProject(projectName);
    }
  }

  // Send typing indicator
  startTyping(taskId: string) {
    if (webSocketService.isSocketConnected()) {
      webSocketService.startTyping(taskId);
    }
  }

  stopTyping(taskId: string) {
    if (webSocketService.isSocketConnected()) {
      webSocketService.stopTyping(taskId);
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

  // Get cached task
  getCachedTask(taskId: string): Task | null {
    return this.taskCache.get(taskId) || null;
  }

  // Clear cache
  clearCache() {
    this.taskCache.clear();
  }
}

// Export singleton instance
export const taskService = new TaskService();
export default taskService;
