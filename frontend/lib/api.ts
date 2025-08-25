// API service layer with error handling and caching
import { dataStore } from "./data-store"
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000"

export interface Workflow {
  id: string
  name: string
  status: "running" | "completed" | "failed" | "pending"
  createdAt: string
  lastUpdated: string
  owner: string
  nodeCount: number
  description?: string
  nodes?: WorkflowNode[]
  tasks?: Task[]
}

export interface WorkflowNode {
  id: string
  name: string
  type: "input" | "process" | "output" | "condition"
  status: "running" | "completed" | "failed" | "pending"
  x: number
  y: number
}

export interface Task {
  id: string
  name: string
  workflowId: string
  workflowName: string
  status: "running" | "completed" | "failed" | "pending"
  startTime: string | null
  endTime: string | null
  duration?: string
  owner: string
  description?: string
  input?: any
  output?: any
  logs?: TaskLog[]
  metrics?: TaskMetrics
}

export interface TaskLog {
  timestamp: string
  level: "INFO" | "WARN" | "ERROR"
  message: string
}

export interface TaskMetrics {
  cpuUsage: string
  memoryUsage: string
  diskIO: string
  networkIO: string
}

export interface SystemStatus {
  totalNodes: number
  activeNodes: number
  failedNodes: number
  maintenanceNodes: number
  uptime: string
  lastFailure: string
  avgResponseTime: number
  totalRequests: number
  errorRate: number
}

export interface ApiKey {
  _id: string
  name: string
  keyPrefix: string
  permissions: string[]
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
  rateLimit: {
    requestsPerHour: number
    requestsPerDay: number
  }
  metadata: {
    environment: string
    createdFrom: string
  }
  stats?: {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    avgResponseTime: number
    successRate: string
  }
}

export interface UsageLog {
  _id: string
  endpoint: string
  method: string
  statusCode: number
  responseTimeMs: number
  ipAddress: string
  createdAt: string
  apiKey: {
    name: string
    prefix: string
  }
}

export interface AnalyticsData {
  overview: {
    totalRequests: number
    uniqueEndpoints: number
    successfulRequests: number
    failedRequests: number
    avgResponseTime: number
    successRate: string
    lastRequestAt: string | null
  }
  endpoints: Array<{
    endpoint: string
    method: string
    requestCount: number
    avgResponseTime: number
    successRate: string
  }>
  daily: Array<{
    date: string
    requestCount: number
    successfulRequests: number
    failedRequests: number
    avgResponseTime: number
    successRate: string
  }>
  recentLogs: UsageLog[]
  insights: {
    mostUsedEndpoint: any
    peakUsageDay: any
    avgDailyRequests: string
    errorTrend: number
    apiKeysCount: number
  }
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// API Key Authentication Error
export class ApiKeyError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 401
  ) {
    super(message)
    this.name = "ApiKeyError"
  }
}

// API Key Management
export class ApiKeyManager {
  private static instance: ApiKeyManager
  private apiKey: string | null = null
  private isValidating = false
  private validationPromise: Promise<boolean> | null = null

  static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager()
    }
    return ApiKeyManager.instance
  }

  setApiKey(key: string): void {
    this.apiKey = key
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard_api_key', key)
    }
  }

  getApiKey(): string | null {
    if (!this.apiKey && typeof window !== 'undefined') {
      this.apiKey = localStorage.getItem('dashboard_api_key')
    }
    return this.apiKey
  }

  clearApiKey(): void {
    this.apiKey = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dashboard_api_key')
    }
  }

  async validateApiKey(): Promise<boolean> {
    if (this.isValidating && this.validationPromise) {
      return this.validationPromise
    }

    const apiKey = this.getApiKey()
    if (!apiKey) {
      return false
    }

    this.isValidating = true
    this.validationPromise = this.performValidation(apiKey)

    try {
      const result = await this.validationPromise
      return result
    } finally {
      this.isValidating = false
      this.validationPromise = null
    }
  }

  private async performValidation(apiKey: string): Promise<boolean> {
    try {
      console.log('🔑 Validating API key:', apiKey.substring(0, 20) + '...')
      console.log('🌐 Validation endpoint:', `${API_BASE_URL}/api/v1/status`)

      const response = await fetch(`${API_BASE_URL}/api/v1/status`, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      })

      console.log('📊 Validation response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error('❌ API key validation failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })

        // Provide specific error messages
        if (response.status === 401) {
          console.error('🚫 API key is invalid or expired')
        } else if (response.status === 403) {
          console.error('🚫 API key lacks required permissions')
        } else if (response.status === 429) {
          console.error('⏰ Rate limit exceeded')
        }

        return false
      }

      const data = await response.json().catch(() => null)
      console.log('✅ API key validation successful:', data?.api_key?.name || 'Unknown key')
      return true

    } catch (error) {
      console.error('🔥 API key validation error:', error)
      return false
    }
  }
}

// Real API request function with API key support
export async function realApiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Check if we're on client-side (avoid SSR issues)
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const apiKeyManager = ApiKeyManager.getInstance()
  const apiKey = apiKeyManager.getApiKey()

  // For API key endpoints, ensure we have a token
  if (endpoint.startsWith('/api/keys') && !token) {
    throw new ApiError(401, 'Authentication required. Please log in first.')
  }

  // For dashboard metrics endpoints, use API key if available
  const useApiKey = endpoint.startsWith('/api/v1/') ||
                   endpoint.includes('/metrics') ||
                   endpoint.includes('/prometheus')

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(useApiKey && apiKey && { 'X-API-Key': apiKey }),
      ...options.headers,
    },
  }

  console.log('Making API request:', {
    endpoint,
    method: options.method || 'GET',
    url: `${API_BASE_URL}${endpoint}`,
    hasApiKey: !!apiKey,
    useApiKey
  })

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))

    // Handle API key specific errors
    if (useApiKey && (response.status === 401 || response.status === 403)) {
      const code = errorData.code || 'INVALID_API_KEY'
      throw new ApiKeyError(code, errorData.message || 'API key authentication failed', response.status)
    }

    // Create enhanced error with additional properties
    const error = new ApiError(response.status, errorData.message || 'Request failed')
    // Add additional properties from the error response
    if (errorData.requiresEmailVerification) {
      (error as any).requiresEmailVerification = errorData.requiresEmailVerification
    }
    if (errorData.email) {
      (error as any).email = errorData.email
    }

    throw error
  }

  const data = await response.json()
  return data
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Check if this is a new API endpoint (API keys, analytics, public API)
  if (endpoint.startsWith('/api/keys') ||
      endpoint.startsWith('/api/analytics') ||
      endpoint.startsWith('/api/v1') ||
      endpoint.startsWith('/api/auth')) {
    return realApiRequest<T>(endpoint, options)
  }

  // Simulate API delay for realistic experience for existing endpoints
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000 + 500))

  try {
    // Use data store for existing workflow/task endpoints
    return handleDataStoreRequest<T>(endpoint, options)
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(500, "Internal server error")
  }
}

function handleDataStoreRequest<T>(endpoint: string, options: RequestInit = {}): T {
  const method = options.method || "GET"
  const body = options.body ? JSON.parse(options.body as string) : null

  // Workflows endpoints
  if (endpoint === "/api/workflows") {
    if (method === "GET") {
      return dataStore.getWorkflows() as T
    }
    if (method === "POST") {
      return dataStore.createWorkflow(body) as T
    }
  }

  if (endpoint.startsWith("/api/workflows/") && endpoint.endsWith("/tasks")) {
    const workflowId = endpoint.split("/")[3]
    return dataStore.getWorkflowTasks(workflowId) as T
  }

  if (endpoint.startsWith("/api/workflows/")) {
    const workflowId = endpoint.split("/")[3]
    if (method === "GET") {
      const workflow = dataStore.getWorkflow(workflowId)
      if (!workflow) {
        throw new ApiError(404, "Workflow not found")
      }
      return workflow as T
    }
    if (method === "PUT") {
      const updated = dataStore.updateWorkflow(workflowId, body)
      if (!updated) {
        throw new ApiError(404, "Workflow not found")
      }
      return updated as T
    }
    if (method === "DELETE") {
      dataStore.deleteWorkflow(workflowId)
      return {} as T
    }
  }

  // Tasks endpoints
  if (endpoint === "/api/tasks") {
    if (method === "GET") {
      return dataStore.getTasks() as T
    }
    if (method === "POST") {
      const newTask = dataStore.createTask(body)
      // Simulate task progress
      dataStore.simulateTaskProgress(newTask.id)
      return newTask as T
    }
  }

  if (endpoint.startsWith("/api/tasks/")) {
    const taskId = endpoint.split("/")[3]
    const action = endpoint.split("/")[4]

    if (!action && method === "GET") {
      const task = dataStore.getTask(taskId)
      if (!task) {
        throw new ApiError(404, "Task not found")
      }
      return task as T
    }

    if (action === "retry" && method === "POST") {
      const updated = dataStore.retryTask(taskId)
      if (!updated) {
        throw new ApiError(404, "Task not found")
      }
      // Simulate task progress
      dataStore.simulateTaskProgress(taskId)
      return {} as T
    }

    if (action === "cancel" && method === "POST") {
      const updated = dataStore.cancelTask(taskId)
      if (!updated) {
        throw new ApiError(404, "Task not found")
      }
      return {} as T
    }
  }

  // System status endpoint
  if (endpoint === "/api/system/status") {
    let status = dataStore.getSystemStatus()
    if (!status) {
      // Initialize with default values
      status = dataStore.updateSystemStatus({
        totalNodes: 10,
        activeNodes: 8,
        failedNodes: 1,
        maintenanceNodes: 1,
        uptime: "99.94%",
        lastFailure: "2024-01-14T15:30:00Z",
        avgResponseTime: Math.floor(Math.random() * 20) + 35, // 35-55ms
        totalRequests: 1247832 + Math.floor(Math.random() * 1000),
        errorRate: Math.random() * 0.05, // 0-5%
      })
    } else {
      // Update with slight variations for realism
      status = dataStore.updateSystemStatus({
        ...status,
        avgResponseTime: Math.floor(Math.random() * 20) + 35,
        totalRequests: status.totalRequests + Math.floor(Math.random() * 100),
        errorRate: Math.max(0, Math.min(0.1, status.errorRate + (Math.random() - 0.5) * 0.01)),
      })
    }
    return status as T
  }

  throw new ApiError(404, "Endpoint not found")
}

// API functions - keeping the same interface but now with real data
export const api = {
  // Authentication
  login: (email: string, password: string): Promise<{ token: string; user: any }> => {
    console.log('🔐 Frontend login attempt:', { email, passwordLength: password?.length });
    return realApiRequest("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  },
  register: (userData: any): Promise<{ token: string; user: any }> =>
    apiRequest("/api/auth/register", { method: "POST", body: JSON.stringify(userData) }),
  getProfile: (): Promise<any> => apiRequest("/api/auth/me"),

  // API Keys
  getApiKeys: (): Promise<{ apiKeys: ApiKey[]; total: number }> => apiRequest("/api/keys"),
  createApiKey: (data: { name: string; permissions?: string[]; environment?: string }): Promise<{ apiKey: ApiKey; key: string }> =>
    apiRequest("/api/keys", { method: "POST", body: JSON.stringify(data) }),
  getApiKey: (id: string): Promise<{ apiKey: ApiKey; stats: any; recentUsage: UsageLog[] }> =>
    apiRequest(`/api/keys/${id}`),
  updateApiKey: (id: string, data: Partial<ApiKey>): Promise<{ apiKey: ApiKey }> =>
    apiRequest(`/api/keys/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  regenerateApiKey: (id: string): Promise<{ apiKey: ApiKey; key: string }> =>
    apiRequest(`/api/keys/${id}/regenerate`, { method: "POST" }),
  deleteApiKey: (id: string): Promise<void> =>
    apiRequest(`/api/keys/${id}`, { method: "DELETE" }),

  // Analytics
  getUsageStats: (days = 30): Promise<{ stats: any; period: string }> =>
    apiRequest(`/api/analytics/usage?days=${days}`),
  getEndpointStats: (days = 30): Promise<{ endpoints: any[]; period: string }> =>
    apiRequest(`/api/analytics/endpoints?days=${days}`),
  getDailyStats: (days = 30): Promise<{ daily: any[]; period: string }> =>
    apiRequest(`/api/analytics/daily?days=${days}`),
  getRecentLogs: (limit = 50): Promise<{ logs: UsageLog[]; total: number }> =>
    apiRequest(`/api/analytics/logs?limit=${limit}`),
  getDashboardData: (days = 30): Promise<AnalyticsData> =>
    apiRequest(`/api/analytics/dashboard?days=${days}`),

  // Workflows
  getWorkflows: (): Promise<Workflow[]> => apiRequest("/api/workflows"),
  getWorkflow: (id: string): Promise<Workflow> => apiRequest(`/api/workflows/${id}`),
  createWorkflow: (workflow: Partial<Workflow>): Promise<Workflow> =>
    apiRequest("/api/workflows", { method: "POST", body: JSON.stringify(workflow) }),
  updateWorkflow: (id: string, updates: Partial<Workflow>): Promise<Workflow> =>
    apiRequest(`/api/workflows/${id}`, { method: "PUT", body: JSON.stringify(updates) }),
  deleteWorkflow: (id: string): Promise<void> => apiRequest(`/api/workflows/${id}`, { method: "DELETE" }),
  getWorkflowTasks: (id: string): Promise<Task[]> => apiRequest(`/api/workflows/${id}/tasks`),

  // Tasks
  getTasks: (): Promise<Task[]> => apiRequest("/api/tasks"),
  getTask: (id: string): Promise<Task> => apiRequest(`/api/tasks/${id}`),
  createTask: (task: Partial<Task>): Promise<Task> =>
    apiRequest("/api/tasks", { method: "POST", body: JSON.stringify(task) }),
  retryTask: (id: string): Promise<void> => apiRequest(`/api/tasks/${id}/retry`, { method: "POST" }),
  cancelTask: (id: string): Promise<void> => apiRequest(`/api/tasks/${id}/cancel`, { method: "POST" }),

  // System
  getSystemStatus: (): Promise<SystemStatus> => apiRequest("/api/system/status"),

  // Prometheus Metrics (API Key authenticated)
  getPrometheusMetrics: (): Promise<any> => realApiRequest("/api/v1/metrics"),
  getSystemMetrics: (): Promise<{
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    network_io_bytes: number;
    uptime_seconds: number;
    active_connections: number;
    requests_per_second: number;
    error_rate: number;
  }> => realApiRequest("/api/v1/metrics/system"),

  getDistributedNodes: (): Promise<{
    nodes: Array<{
      id: string;
      name: string;
      region: string;
      status: 'healthy' | 'warning' | 'critical';
      cpu_usage: number;
      memory_usage: number;
      last_heartbeat: string;
      services: string[];
    }>;
  }> => realApiRequest("/api/v1/metrics/nodes"),

  // Real-time API request metrics
  getApiMetrics: (): Promise<{
    total_requests: number;
    requests_per_second: number;
    error_rate: number;
    avg_response_time: number;
    active_api_keys: number;
  }> => realApiRequest("/api/v1/metrics/api"),

  // Task metrics
  getTaskMetrics: (): Promise<{
    total_tasks: number;
    running_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    avg_execution_time: number;
    tasks_per_hour: number;
  }> => realApiRequest("/api/v1/metrics/tasks"),

  // Dashboard metrics (comprehensive)
  getDashboardMetrics: (): Promise<{
    system: any;
    api: any;
    tasks: any;
    nodes: any;
  }> => realApiRequest("/api/v1/metrics/dashboard"),
}
