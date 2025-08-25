'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { 
  Cpu, 
  HardDrive, 
  Network, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Wifi,
  WifiOff,
  Clock
} from 'lucide-react'
import { useSystemMetrics } from '@/hooks/use-real-time-metrics'
import { useApiKey } from '@/contexts/api-key-context'
import { formatDistanceToNow } from 'date-fns'

interface RealTimeMetricsCardProps {
  className?: string
}

export function RealTimeMetricsCard({ className }: RealTimeMetricsCardProps) {
  const { isValid: isApiKeyValid, apiKey } = useApiKey()
  const { 
    data: metrics, 
    error, 
    isLoading, 
    lastUpdated, 
    isConnected,
    refresh,
    retry,
    isEnabled 
  } = useSystemMetrics({ 
    interval: 5000, 
    enabled: isApiKeyValid && !!apiKey,
    autoRetry: true 
  })

  const getStatusColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'text-red-500'
    if (value >= thresholds.warning) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getProgressColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'bg-red-500'
    if (value >= thresholds.warning) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  if (!isEnabled) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Metrics
          </CardTitle>
          <CardDescription>Real-time system performance monitoring</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              API key required for real-time metrics. Please configure your API key to view live system data.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Metrics
            <Badge variant="destructive" className="ml-auto">
              <WifiOff className="h-3 w-3 mr-1" />
              Error
            </Badge>
          </CardTitle>
          <CardDescription>Real-time system performance monitoring</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error.message}</span>
              <Button variant="outline" size="sm" onClick={retry}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Metrics
          <div className="ml-auto flex items-center gap-2">
            {isConnected ? (
              <Badge variant="default" className="bg-green-500">
                <Wifi className="h-3 w-3 mr-1" />
                Live
              </Badge>
            ) : (
              <Badge variant="secondary">
                <WifiOff className="h-3 w-3 mr-1" />
                Connecting...
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          Real-time system performance monitoring
          {lastUpdated && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && !metrics ? (
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-2 bg-gray-200 rounded"></div>
            </div>
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
              <div className="h-2 bg-gray-200 rounded"></div>
            </div>
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-2 bg-gray-200 rounded"></div>
            </div>
          </div>
        ) : metrics ? (
          <>
            {/* CPU Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  <span className="text-sm font-medium">CPU Usage</span>
                </div>
                <span className={`text-sm font-mono ${getStatusColor(metrics.cpu_usage, { warning: 70, critical: 90 })}`}>
                  {metrics.cpu_usage.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={metrics.cpu_usage} 
                className="h-2"
                style={{
                  '--progress-background': getProgressColor(metrics.cpu_usage, { warning: 70, critical: 90 })
                } as React.CSSProperties}
              />
            </div>

            {/* Memory Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  <span className="text-sm font-medium">Memory Usage</span>
                </div>
                <span className={`text-sm font-mono ${getStatusColor(metrics.memory_usage, { warning: 80, critical: 95 })}`}>
                  {metrics.memory_usage.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={metrics.memory_usage} 
                className="h-2"
                style={{
                  '--progress-background': getProgressColor(metrics.memory_usage, { warning: 80, critical: 95 })
                } as React.CSSProperties}
              />
            </div>

            {/* Disk Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  <span className="text-sm font-medium">Disk Usage</span>
                </div>
                <span className={`text-sm font-mono ${getStatusColor(metrics.disk_usage, { warning: 85, critical: 95 })}`}>
                  {metrics.disk_usage.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={metrics.disk_usage} 
                className="h-2"
                style={{
                  '--progress-background': getProgressColor(metrics.disk_usage, { warning: 85, critical: 95 })
                } as React.CSSProperties}
              />
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  <span className="text-xs text-muted-foreground">Network I/O</span>
                </div>
                <span className="text-sm font-mono">{formatBytes(metrics.network_io_bytes)}</span>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs text-muted-foreground">Uptime</span>
                </div>
                <span className="text-sm font-mono">{formatUptime(metrics.uptime_seconds)}</span>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  <span className="text-xs text-muted-foreground">Requests/sec</span>
                </div>
                <span className="text-sm font-mono">{metrics.requests_per_second.toFixed(1)}</span>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs text-muted-foreground">Error Rate</span>
                </div>
                <span className={`text-sm font-mono ${getStatusColor(metrics.error_rate, { warning: 1, critical: 5 })}`}>
                  {metrics.error_rate.toFixed(2)}%
                </span>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
