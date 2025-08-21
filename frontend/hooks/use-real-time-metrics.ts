'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApiKey } from '@/contexts/api-key-context'
import { 
  realTimeDataService, 
  SystemMetrics, 
  ApiMetrics, 
  TaskMetrics, 
  DistributedNode,
  DashboardMetrics 
} from '@/lib/real-time-data-service'
import { ApiKeyError } from '@/lib/api'

interface UseRealTimeMetricsOptions {
  interval?: number
  enabled?: boolean
  autoRetry?: boolean
}

interface MetricsState<T> {
  data: T | null
  error: ApiKeyError | null
  isLoading: boolean
  lastUpdated: Date | null
  isConnected: boolean
}

// Hook for system metrics
export function useSystemMetrics(options: UseRealTimeMetricsOptions = {}) {
  const { interval = 5000, enabled = true, autoRetry = true } = options
  const { isValid: isApiKeyValid, apiKey } = useApiKey()
  const [state, setState] = useState<MetricsState<SystemMetrics>>({
    data: null,
    error: null,
    isLoading: true,
    lastUpdated: null,
    isConnected: false
  })

  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)

  useEffect(() => {
    if (!isApiKeyValid || !apiKey || !enabled) {
      // Clean up existing subscription
      if (subscriptionId) {
        realTimeDataService.unsubscribe(subscriptionId)
        setSubscriptionId(null)
        setState(prev => ({ ...prev, isConnected: false }))
      }
      return
    }

    // Don't create a new subscription if one already exists
    if (subscriptionId) return

    const id = realTimeDataService.subscribe(
      'system',
      (data: SystemMetrics, error?: ApiKeyError) => {
        setState(prev => ({
          ...prev,
          data: error ? null : data,
          error: error || null,
          isLoading: false,
          lastUpdated: error ? prev.lastUpdated : new Date(),
          isConnected: !error
        }))
      },
      interval
    )

    setSubscriptionId(id)
    setState(prev => ({ ...prev, isLoading: true }))

    // Cleanup function
    return () => {
      realTimeDataService.unsubscribe(id)
      setSubscriptionId(null)
      setState(prev => ({ ...prev, isConnected: false }))
    }
  }, [isApiKeyValid, apiKey, enabled, interval]) // Removed subscriptionId from dependencies

  const stopSubscription = useCallback(() => {
    if (subscriptionId) {
      realTimeDataService.unsubscribe(subscriptionId)
      setSubscriptionId(null)
      setState(prev => ({ ...prev, isConnected: false }))
    }
  }, [subscriptionId])

  const refresh = useCallback(() => {
    if (subscriptionId) {
      realTimeDataService.refreshAll()
    }
  }, [subscriptionId])

  const retry = useCallback(() => {
    if (autoRetry && subscriptionId) {
      // Stop current subscription
      stopSubscription()
      // Force a re-subscription by clearing and setting the subscription ID
      setTimeout(() => {
        setSubscriptionId(null)
        // The useEffect will automatically create a new subscription
      }, 1000)
    }
  }, [autoRetry, subscriptionId, stopSubscription])

  return {
    ...state,
    refresh,
    retry,
    isEnabled: enabled && isApiKeyValid && !!apiKey
  }
}

// Hook for API metrics
export function useApiMetrics(options: UseRealTimeMetricsOptions = {}) {
  const { interval = 5000, enabled = true } = options
  const { isValid: isApiKeyValid, apiKey } = useApiKey()
  const [state, setState] = useState<MetricsState<ApiMetrics>>({
    data: null,
    error: null,
    isLoading: true,
    lastUpdated: null,
    isConnected: false
  })

  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)

  useEffect(() => {
    if (!isApiKeyValid || !apiKey || !enabled) {
      if (subscriptionId) {
        realTimeDataService.unsubscribe(subscriptionId)
        setSubscriptionId(null)
        setState(prev => ({ ...prev, isConnected: false }))
      }
      return
    }

    // Don't create a new subscription if one already exists
    if (subscriptionId) return

    const id = realTimeDataService.subscribe(
      'api',
      (data: ApiMetrics, error?: ApiKeyError) => {
        setState(prev => ({
          ...prev,
          data: error ? null : data,
          error: error || null,
          isLoading: false,
          lastUpdated: error ? prev.lastUpdated : new Date(),
          isConnected: !error
        }))
      },
      interval
    )

    setSubscriptionId(id)
    setState(prev => ({ ...prev, isLoading: true }))

    return () => {
      realTimeDataService.unsubscribe(id)
      setSubscriptionId(null)
      setState(prev => ({ ...prev, isConnected: false }))
    }
  }, [isApiKeyValid, apiKey, enabled, interval]) // Removed subscriptionId from dependencies

  const refresh = useCallback(() => {
    realTimeDataService.refreshAll()
  }, [])

  return {
    ...state,
    refresh,
    isEnabled: enabled && isApiKeyValid && !!apiKey
  }
}

// Hook for task metrics
export function useTaskMetrics(options: UseRealTimeMetricsOptions = {}) {
  const { interval = 10000, enabled = true } = options // Tasks update less frequently
  const { isValid: isApiKeyValid, apiKey } = useApiKey()
  const [state, setState] = useState<MetricsState<TaskMetrics>>({
    data: null,
    error: null,
    isLoading: true,
    lastUpdated: null,
    isConnected: false
  })

  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)

  useEffect(() => {
    if (!isApiKeyValid || !apiKey || !enabled) {
      if (subscriptionId) {
        realTimeDataService.unsubscribe(subscriptionId)
        setSubscriptionId(null)
        setState(prev => ({ ...prev, isConnected: false }))
      }
      return
    }

    // Don't create a new subscription if one already exists
    if (subscriptionId) return

    const id = realTimeDataService.subscribe(
      'tasks',
      (data: TaskMetrics, error?: ApiKeyError) => {
        setState(prev => ({
          ...prev,
          data: error ? null : data,
          error: error || null,
          isLoading: false,
          lastUpdated: error ? prev.lastUpdated : new Date(),
          isConnected: !error
        }))
      },
      interval
    )

    setSubscriptionId(id)
    setState(prev => ({ ...prev, isLoading: true }))

    return () => {
      realTimeDataService.unsubscribe(id)
      setSubscriptionId(null)
      setState(prev => ({ ...prev, isConnected: false }))
    }
  }, [isApiKeyValid, apiKey, enabled, interval]) // Removed subscriptionId from dependencies

  const refresh = useCallback(() => {
    realTimeDataService.refreshAll()
  }, [])

  return {
    ...state,
    refresh,
    isEnabled: enabled && isApiKeyValid && !!apiKey
  }
}

// Hook for distributed nodes
export function useDistributedNodes(options: UseRealTimeMetricsOptions = {}) {
  const { interval = 15000, enabled = true } = options // Nodes update less frequently
  const { isValid: isApiKeyValid, apiKey } = useApiKey()
  const [state, setState] = useState<MetricsState<{ nodes: DistributedNode[]; total_nodes: number; healthy_nodes: number }>>({
    data: null,
    error: null,
    isLoading: true,
    lastUpdated: null,
    isConnected: false
  })

  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)

  useEffect(() => {
    if (!isApiKeyValid || !apiKey || !enabled) {
      if (subscriptionId) {
        realTimeDataService.unsubscribe(subscriptionId)
        setSubscriptionId(null)
        setState(prev => ({ ...prev, isConnected: false }))
      }
      return
    }

    // Don't create a new subscription if one already exists
    if (subscriptionId) return

    const id = realTimeDataService.subscribe(
      'nodes',
      (data: any, error?: ApiKeyError) => {
        setState(prev => ({
          ...prev,
          data: error ? null : data,
          error: error || null,
          isLoading: false,
          lastUpdated: error ? prev.lastUpdated : new Date(),
          isConnected: !error
        }))
      },
      interval
    )

    setSubscriptionId(id)
    setState(prev => ({ ...prev, isLoading: true }))

    return () => {
      realTimeDataService.unsubscribe(id)
      setSubscriptionId(null)
      setState(prev => ({ ...prev, isConnected: false }))
    }
  }, [isApiKeyValid, apiKey, enabled, interval]) // Removed subscriptionId from dependencies

  const refresh = useCallback(() => {
    realTimeDataService.refreshAll()
  }, [])

  return {
    ...state,
    refresh,
    isEnabled: enabled && isApiKeyValid && !!apiKey
  }
}

// Hook for comprehensive dashboard metrics
export function useDashboardMetrics(options: UseRealTimeMetricsOptions = {}) {
  const { interval = 5000, enabled = true } = options
  const { isValid: isApiKeyValid, apiKey } = useApiKey()
  const [state, setState] = useState<MetricsState<DashboardMetrics>>({
    data: null,
    error: null,
    isLoading: true,
    lastUpdated: null,
    isConnected: false
  })

  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)

  useEffect(() => {
    if (!isApiKeyValid || !apiKey || !enabled) {
      if (subscriptionId) {
        realTimeDataService.unsubscribe(subscriptionId)
        setSubscriptionId(null)
        setState(prev => ({ ...prev, isConnected: false }))
      }
      return
    }

    // Don't create a new subscription if one already exists
    if (subscriptionId) return

    const id = realTimeDataService.subscribe(
      'dashboard',
      (data: DashboardMetrics, error?: ApiKeyError) => {
        setState(prev => ({
          ...prev,
          data: error ? null : data,
          error: error || null,
          isLoading: false,
          lastUpdated: error ? prev.lastUpdated : new Date(),
          isConnected: !error
        }))
      },
      interval
    )

    setSubscriptionId(id)
    setState(prev => ({ ...prev, isLoading: true }))

    return () => {
      realTimeDataService.unsubscribe(id)
      setSubscriptionId(null)
      setState(prev => ({ ...prev, isConnected: false }))
    }
  }, [isApiKeyValid, apiKey, enabled, interval]) // Removed subscriptionId from dependencies

  const refresh = useCallback(() => {
    realTimeDataService.refreshAll()
  }, [])

  return {
    ...state,
    refresh,
    isEnabled: enabled && isApiKeyValid && !!apiKey
  }
}
