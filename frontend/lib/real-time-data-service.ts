'use client'

import { api, ApiKeyError } from './api'
import { toast } from 'sonner'

export interface SystemMetrics {
  cpu_usage: number
  memory_usage: number
  disk_usage: number
  network_io_bytes: number
  uptime_seconds: number
  active_connections: number
  requests_per_second: number
  error_rate: number
  active_api_keys: number
  timestamp: string
}

export interface DistributedNode {
  id: string
  name: string
  region: string
  status: 'healthy' | 'warning' | 'critical'
  cpu_usage: number
  memory_usage: number
  last_heartbeat: string
  services: string[]
}

export interface ApiMetrics {
  total_requests: number
  requests_per_second: number
  error_rate: number
  avg_response_time: number
  active_api_keys: number
  timestamp: string
}

export interface TaskMetrics {
  total: number
  pending: number
  in_progress: number
  completed: number
  blocked: number
  completion_rate: number
  timestamp: string
}

export interface DashboardMetrics {
  system: SystemMetrics
  api: ApiMetrics
  tasks: TaskMetrics
  nodes: {
    total_nodes: number
    healthy_nodes: number
    nodes: DistributedNode[]
  }
  timestamp: string
}

type DataType = 'system' | 'api' | 'tasks' | 'nodes' | 'dashboard'

interface Subscription {
  id: string
  type: DataType
  callback: (data: any, error?: ApiKeyError) => void
  interval: number
  active: boolean
}

class RealTimeDataService {
  private static instance: RealTimeDataService
  private subscriptions = new Map<string, Subscription>()
  private intervals = new Map<string, NodeJS.Timeout>()
  private isApiKeyValid = true
  private lastApiKeyError: string | null = null

  static getInstance(): RealTimeDataService {
    if (!RealTimeDataService.instance) {
      RealTimeDataService.instance = new RealTimeDataService()
    }
    return RealTimeDataService.instance
  }

  // Subscribe to real-time data updates
  subscribe(
    type: DataType,
    callback: (data: any, error?: ApiKeyError) => void,
    interval: number = 5000
  ): string {
    const id = `${type}_${Date.now()}_${Math.random()}`
    
    const subscription: Subscription = {
      id,
      type,
      callback,
      interval,
      active: true
    }

    this.subscriptions.set(id, subscription)
    this.startPolling(subscription)

    return id
  }

  // Unsubscribe from data updates
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId)
    if (subscription) {
      subscription.active = false
      this.subscriptions.delete(subscriptionId)
      
      const interval = this.intervals.get(subscriptionId)
      if (interval) {
        clearInterval(interval)
        this.intervals.delete(subscriptionId)
      }
    }
  }

  // Unsubscribe all subscriptions
  unsubscribeAll(): void {
    this.subscriptions.forEach((_, id) => {
      this.unsubscribe(id)
    })
  }

  // Start polling for a subscription
  private startPolling(subscription: Subscription): void {
    // Initial fetch
    this.fetchData(subscription)

    // Set up interval
    const interval = setInterval(() => {
      if (subscription.active) {
        this.fetchData(subscription)
      }
    }, subscription.interval)

    this.intervals.set(subscription.id, interval)
  }

  // Fetch data based on subscription type
  private async fetchData(subscription: Subscription): Promise<void> {
    if (!subscription.active) return

    try {
      let data: any

      // Check if API key is available for metrics endpoints
      const apiKey = localStorage.getItem('apiKey')
      const hasApiKey = apiKey && apiKey.trim() !== ''

      console.log(`🔍 Fetching ${subscription.type} data, API key available: ${!!hasApiKey}`)

      switch (subscription.type) {
        case 'system':
          if (!hasApiKey) {
            subscription.callback(null, {
              message: 'API key required for system metrics',
              status: 403,
              type: 'API_KEY_REQUIRED'
            })
            return
          }
          console.log('📊 Fetching system metrics...')
          data = await api.getSystemMetrics()
          break
        case 'api':
          if (!hasApiKey) {
            subscription.callback(null, {
              message: 'API key required for API metrics',
              status: 403,
              type: 'API_KEY_REQUIRED'
            })
            return
          }
          console.log('📈 Fetching API metrics...')
          data = await api.getApiMetrics()
          break
        case 'tasks':
          if (!hasApiKey) {
            subscription.callback(null, {
              message: 'API key required for task metrics',
              status: 403,
              type: 'API_KEY_REQUIRED'
            })
            return
          }
          console.log('📋 Fetching task metrics...')
          data = await api.getTaskMetrics()
          break
        case 'nodes':
          if (!hasApiKey) {
            subscription.callback(null, {
              message: 'API key required for distributed nodes',
              status: 403,
              type: 'API_KEY_REQUIRED'
            })
            return
          }
          console.log('🌐 Fetching distributed nodes...')
          data = await api.getDistributedNodes()
          break
        case 'dashboard':
          if (!hasApiKey) {
            subscription.callback(null, {
              message: 'API key required for dashboard metrics',
              status: 403,
              type: 'API_KEY_REQUIRED'
            })
            return
          }
          console.log('📊 Fetching dashboard metrics...')
          data = await api.getDashboardMetrics()
          break
        default:
          throw new Error(`Unknown data type: ${subscription.type}`)
      }

      // Reset API key error state on successful request
      if (!this.isApiKeyValid) {
        this.isApiKeyValid = true
        this.lastApiKeyError = null
        toast.success('API key connection restored')
      }

      subscription.callback(data.data || data)
    } catch (error) {
      console.error(`Error fetching ${subscription.type} data:`, error)

      if (error instanceof ApiKeyError) {
        // Handle API key errors
        this.handleApiKeyError(error, subscription)
      } else {
        // Handle other errors
        subscription.callback(null, error as ApiKeyError)
      }
    }
  }

  // Handle API key authentication errors
  private handleApiKeyError(error: ApiKeyError, subscription: Subscription): void {
    const errorMessage = error.message || 'API key authentication failed'
    
    // Only show toast if this is a new error
    if (this.isApiKeyValid || this.lastApiKeyError !== errorMessage) {
      this.isApiKeyValid = false
      this.lastApiKeyError = errorMessage
      
      toast.error(`API Key Error: ${errorMessage}`, {
        description: 'Please check your API key configuration',
        action: {
          label: 'Configure',
          onClick: () => {
            // Navigate to API key setup (you can customize this)
            window.location.href = '/dashboard/api-keys'
          }
        }
      })
    }

    subscription.callback(null, error)
  }

  // Get current API key validation status
  getApiKeyStatus(): { isValid: boolean; lastError: string | null } {
    return {
      isValid: this.isApiKeyValid,
      lastError: this.lastApiKeyError
    }
  }

  // Force refresh all active subscriptions
  refreshAll(): void {
    this.subscriptions.forEach(subscription => {
      if (subscription.active) {
        this.fetchData(subscription)
      }
    })
  }

  // Pause all subscriptions
  pauseAll(): void {
    this.intervals.forEach(interval => {
      clearInterval(interval)
    })
    this.intervals.clear()
  }

  // Resume all subscriptions
  resumeAll(): void {
    this.subscriptions.forEach(subscription => {
      if (subscription.active) {
        this.startPolling(subscription)
      }
    })
  }

  // Get subscription count
  getActiveSubscriptionCount(): number {
    return Array.from(this.subscriptions.values()).filter(s => s.active).length
  }

  // Get subscriptions by type
  getSubscriptionsByType(type: DataType): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(s => s.type === type && s.active)
  }
}

// Export singleton instance
export const realTimeDataService = RealTimeDataService.getInstance()

// React hook for real-time data
export function useRealTimeData<T>(
  type: DataType,
  interval: number = 5000,
  enabled: boolean = true
): {
  data: T | null
  error: ApiKeyError | null
  isLoading: boolean
  refresh: () => void
} {
  const [data, setData] = React.useState<T | null>(null)
  const [error, setError] = React.useState<ApiKeyError | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [subscriptionId, setSubscriptionId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!enabled) {
      if (subscriptionId) {
        realTimeDataService.unsubscribe(subscriptionId)
        setSubscriptionId(null)
      }
      return
    }

    const id = realTimeDataService.subscribe(
      type,
      (newData: T, newError?: ApiKeyError) => {
        setIsLoading(false)
        if (newError) {
          setError(newError)
          setData(null)
        } else {
          setError(null)
          setData(newData)
        }
      },
      interval
    )

    setSubscriptionId(id)

    return () => {
      realTimeDataService.unsubscribe(id)
    }
  }, [type, interval, enabled])

  const refresh = React.useCallback(() => {
    if (subscriptionId) {
      realTimeDataService.refreshAll()
    }
  }, [subscriptionId])

  return { data, error, isLoading, refresh }
}

// We need to import React for the hook
import React from 'react'
