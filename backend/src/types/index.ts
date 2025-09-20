import { Request } from 'express';
import { Document } from 'mongoose';

// User types
export interface IUser extends Document {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  role: 'user' | 'admin';
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// API Key types
export interface IApiKey extends Document {
  _id: string;
  userId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt?: Date;
  rateLimit: {
    requestsPerHour: number;
    requestsPerDay: number;
  };
  metadata: {
    environment: string;
    createdFrom: string;
    userAgent?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Task types
export interface ITask extends Document {
  _id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  assignedBy: string;
  project: string;
  tags: string[];
  dueDate: Date;
  scheduledDate: Date;
  estimatedHours?: number;
  actualHours: number;
  progress: number;
  attachments: Array<{
    filename: string;
    url: string;
    uploadedAt: Date;
  }>;
  comments: Array<{
    _id: string;
    user: string;
    text: string;
    createdAt: Date;
  }>;
  isActive: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Workflow types
export interface IWorkflow extends Document {
  _id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  owner: string;
  nodes: Array<{
    id: string;
    name: string;
    type: 'start' | 'end' | 'task' | 'email' | 'api_call' | 'condition' | 'delay' | 'approval';
    status: 'pending' | 'running' | 'completed' | 'failed';
    position: { x: number; y: number };
    config: any;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    condition?: string;
  }>;
  variables: Record<string, any>;
  isTemplate: boolean;
  templateId?: string;
  executionHistory: Array<{
    executionId: string;
    startedAt: Date;
    completedAt?: Date;
    status: 'running' | 'completed' | 'failed';
    variables: Record<string, any>;
  }>;
  createdAt: Date;
  updatedAt: Date;
  // Methods
  addExecution(executionData: any): Promise<IWorkflow>;
  updateExecution(executionId: string, updates: any): Promise<IWorkflow>;
}

// Notification types
export interface INotification extends Document {
  _id: string;
  userId: string;
  type: 'task_assigned' | 'task_completed' | 'task_overdue' | 'task_reminder' | 'workflow_update' | 'system' | 'mention';
  title: string;
  message: string;
  data?: {
    taskId?: string;
    workflowId?: string;
    projectName?: string;
    assignedBy?: string;
    dueDate?: Date;
    priority?: string;
    url?: string;
  };
  channels: ('in_app' | 'email' | 'slack' | 'websocket')[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isRead: boolean;
  readAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Usage Log types
export interface IUsageLog extends Document {
  _id: string;
  apiKeyId?: string;
  userId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  ipAddress: string;
  userAgent?: string;
  requestSize?: number;
  responseSize?: number;
  errorMessage?: string;
  createdAt: Date;
}

// Integration types
export interface IIntegration extends Document {
  _id: string;
  userId: string;
  name: string;
  type: 'slack' | 'github' | 'webhook' | 'email';
  config: {
    webhookUrl?: string;
    apiKey?: string;
    token?: string;
    settings?: Record<string, any>;
  };
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Methods
  test(): Promise<any>;
  updateLastUsed(): Promise<IIntegration>;
  testWebhook(): Promise<any>;
  testSlack(): Promise<any>;
  testGitHub(): Promise<any>;
  testEmail(): Promise<any>;
}

// Extended Request types
export interface AuthenticatedRequest extends Request {
  user?: IUser;
  apiKey?: IApiKey;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Metrics types
export interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_io_bytes: number;
  uptime_seconds: number;
  active_connections: number;
  requests_per_second: number;
  error_rate: number;
}

export interface ApiMetrics {
  total_requests: number;
  requests_per_second: number;
  error_rate: number;
  avg_response_time: number;
  active_api_keys: number;
}

export interface TaskMetrics {
  total_tasks: number;
  running_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  avg_execution_time: number;
  tasks_per_hour: number;
}

export interface DistributedNode {
  id: string;
  name: string;
  region: string;
  status: 'healthy' | 'warning' | 'critical';
  cpu_usage: number;
  memory_usage: number;
  last_heartbeat: string;
  services: string[];
}

// Socket.IO event types
export interface SocketEvents {
  // Client to server
  authenticate: (data: { token: string }) => void;
  join_task: (taskId: string) => void;
  leave_task: (taskId: string) => void;
  join_project: (projectName: string) => void;
  task_update: (data: { taskId: string; changes: any; projectName?: string }) => void;
  task_status_change: (data: { taskId: string; oldStatus: string; newStatus: string; projectName?: string }) => void;
  notification_read: (notificationIds: string[]) => void;
  typing_start: (data: { taskId: string }) => void;
  typing_stop: (data: { taskId: string }) => void;

  // Server to client
  authenticated: (data: { userId: string; email: string }) => void;
  auth_error: (error: string) => void;
  notification: (notification: any) => void;
  task_updated: (data: { taskId: string; updatedBy: string; changes: any; timestamp: string }) => void;
  task_status_changed: (data: { taskId: string; oldStatus: string; newStatus: string; changedBy: string; timestamp: string }) => void;
  task_assigned: (data: any) => void;
  task_completed: (data: any) => void;
  dashboard_update: (data: any) => void;
  project_task_updated: (data: any) => void;
  user_typing: (data: any) => void;
  pending_notifications: (data: any) => void;
  metrics_update: (data: any) => void;
  activity_update: (data: any) => void;
  notifications_marked_read: (data: any) => void;
  system_announcement: (data: any) => void;
}

// Validation schemas
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

export interface CreateApiKeyData {
  name: string;
  permissions?: string[];
  environment?: string;
}

export interface CreateWorkflowData {
  name: string;
  description?: string;
  nodes?: any[];
  edges?: any[];
  variables?: Record<string, any>;
  isTemplate?: boolean;
}