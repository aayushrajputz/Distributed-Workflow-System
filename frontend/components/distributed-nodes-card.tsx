'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { 
  Server, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  MapPin,
  Cpu,
  HardDrive
} from 'lucide-react'
import { useDistributedNodes } from '@/hooks/use-real-time-metrics'
import { useApiKey } from '@/contexts/api-key-context'
import { formatDistanceToNow } from 'date-fns'

interface DistributedNodesCardProps {
  className?: string
}

export function DistributedNodesCard({ className }: DistributedNodesCardProps) {
  const { isValid: isApiKeyValid, apiKey } = useApiKey()
  const { 
    data: nodesData, 
    error, 
    isLoading, 
    lastUpdated, 
    isConnected,
    refresh,
    isEnabled 
  } = useDistributedNodes({ 
    interval: 15000, 
    enabled: isApiKeyValid && !!apiKey 
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      default:
        return <Server className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-500">Healthy</Badge>
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-500">Warning</Badge>
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  if (!isEnabled) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Distributed Nodes
          </CardTitle>
          <CardDescription>System health across multiple regions</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              API key required for distributed nodes monitoring. Please configure your API key to view node health.
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
            <Server className="h-5 w-5" />
            Distributed Nodes
            <Badge variant="destructive" className="ml-auto">
              <WifiOff className="h-3 w-3 mr-1" />
              Error
            </Badge>
          </CardTitle>
          <CardDescription>System health across multiple regions</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error.message}</span>
              <Button variant="outline" size="sm" onClick={refresh}>
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
          <Server className="h-5 w-5" />
          Distributed Nodes
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
          System health across multiple regions
          {lastUpdated && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && !nodesData ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="h-4 w-4 bg-gray-200 rounded-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4 ml-auto"></div>
                </div>
              </div>
            ))}
          </div>
        ) : nodesData ? (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{nodesData.healthy_nodes}</div>
                <div className="text-xs text-muted-foreground">Healthy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {nodesData.total_nodes - nodesData.healthy_nodes}
                </div>
                <div className="text-xs text-muted-foreground">Issues</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{nodesData.total_nodes}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>

            {/* Node List */}
            <div className="space-y-3">
              {(nodesData?.nodes || []).map((node) => (
                <div key={node.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(node.status)}
                    <div>
                      <div className="font-medium">{node.name}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {node.region}
                        <span className="text-xs">
                          {formatDistanceToNow(new Date(node.last_heartbeat), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Resource Usage */}
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Cpu className="h-3 w-3" />
                        <span className={node.cpu_usage > 80 ? 'text-red-500' : node.cpu_usage > 60 ? 'text-yellow-500' : 'text-green-500'}>
                          {node.cpu_usage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        <span className={node.memory_usage > 85 ? 'text-red-500' : node.memory_usage > 70 ? 'text-yellow-500' : 'text-green-500'}>
                          {node.memory_usage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    
                    {getStatusBadge(node.status)}
                  </div>
                </div>
              ))}
            </div>

            {/* Services Summary */}
            {(nodesData?.nodes || []).length > 0 && (
              <div className="pt-4 border-t">
                <div className="text-sm font-medium mb-2">Services Distribution</div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set((nodesData?.nodes || []).flatMap(node => node.services || []))).map((service) => {
                    const serviceNodes = (nodesData?.nodes || []).filter(node => (node.services || []).includes(service))
                    const healthyServiceNodes = serviceNodes.filter(node => node.status === 'healthy')
                    const isServiceHealthy = healthyServiceNodes.length > 0
                    
                    return (
                      <Badge 
                        key={service} 
                        variant={isServiceHealthy ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {service} ({healthyServiceNodes.length}/{serviceNodes.length})
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
