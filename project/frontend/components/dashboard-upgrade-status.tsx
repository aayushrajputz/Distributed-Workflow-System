'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  CheckCircle, 
  AlertTriangle, 
  Key, 
  Activity, 
  Server, 
  Users,
  Wifi,
  WifiOff
} from 'lucide-react'
import { useApiKey } from '@/contexts/api-key-context'
import { useUserSession } from '@/hooks/use-user-session'
import { webSocketService } from '@/lib/websocket-service'
import { useState, useEffect } from 'react'

export function DashboardUpgradeStatus() {
  const { apiKey, isValid: isApiKeyValid, error: apiKeyError } = useApiKey()
  const { user, isAuthenticated } = useUserSession()
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false)

  useEffect(() => {
    const checkWebSocketConnection = () => {
      setIsWebSocketConnected(webSocketService.isSocketConnected())
    }

    checkWebSocketConnection()
    
    // Listen for connection changes
    webSocketService.on('connect', () => setIsWebSocketConnected(true))
    webSocketService.on('disconnect', () => setIsWebSocketConnected(false))

    return () => {
      webSocketService.off('connect', () => setIsWebSocketConnected(true))
      webSocketService.off('disconnect', () => setIsWebSocketConnected(false))
    }
  }, [])

  const features = [
    {
      name: 'User Authentication',
      status: isAuthenticated ? 'active' : 'inactive',
      icon: Users,
      description: isAuthenticated 
        ? `Logged in as ${user?.firstName} ${user?.lastName}` 
        : 'Not authenticated'
    },
    {
      name: 'API Key Authentication',
      status: isApiKeyValid ? 'active' : apiKey ? 'error' : 'inactive',
      icon: Key,
      description: isApiKeyValid 
        ? 'API key validated and active' 
        : apiKey 
          ? `API key error: ${apiKeyError}` 
          : 'No API key configured'
    },
    {
      name: 'Real-time Metrics',
      status: isApiKeyValid ? 'active' : 'inactive',
      icon: Activity,
      description: isApiKeyValid 
        ? 'Live Prometheus metrics enabled' 
        : 'Requires valid API key'
    },
    {
      name: 'WebSocket Connection',
      status: isWebSocketConnected ? 'active' : 'inactive',
      icon: isWebSocketConnected ? Wifi : WifiOff,
      description: isWebSocketConnected 
        ? 'Real-time updates active' 
        : 'WebSocket disconnected'
    },
    {
      name: 'Distributed Monitoring',
      status: isApiKeyValid ? 'active' : 'inactive',
      icon: Server,
      description: isApiKeyValid 
        ? 'Multi-region node monitoring' 
        : 'Requires valid API key'
    }
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Active</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getStatusIcon = (status: string, IconComponent: any) => {
    const baseClasses = "h-4 w-4"
    switch (status) {
      case 'active':
        return <IconComponent className={`${baseClasses} text-green-500`} />
      case 'error':
        return <AlertTriangle className={`${baseClasses} text-red-500`} />
      case 'inactive':
        return <IconComponent className={`${baseClasses} text-gray-400`} />
      default:
        return <IconComponent className={`${baseClasses} text-gray-400`} />
    }
  }

  const activeFeatures = features.filter(f => f.status === 'active').length
  const totalFeatures = features.length
  const upgradeProgress = (activeFeatures / totalFeatures) * 100

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Dashboard Upgrade Status
          <Badge variant="outline" className="ml-auto">
            {activeFeatures}/{totalFeatures} Features Active
          </Badge>
        </CardTitle>
        <CardDescription>
          Real-time dashboard upgrade progress and feature status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Overview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Upgrade Progress</span>
            <span className="font-medium">{Math.round(upgradeProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${upgradeProgress}%` }}
            />
          </div>
        </div>

        {/* Feature Status */}
        <div className="space-y-3">
          {features.map((feature) => (
            <div key={feature.name} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(feature.status, feature.icon)}
                <div>
                  <div className="font-medium">{feature.name}</div>
                  <div className="text-sm text-muted-foreground">{feature.description}</div>
                </div>
              </div>
              {getStatusBadge(feature.status)}
            </div>
          ))}
        </div>

        {/* Upgrade Summary */}
        {upgradeProgress === 100 ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              🎉 Dashboard upgrade complete! All real-time features are now active and working with live data.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {!isApiKeyValid && !apiKey && (
                <>Configure an API key to enable real-time metrics and live data features.</>
              )}
              {apiKey && !isApiKeyValid && (
                <>API key validation failed. Please check your API key configuration.</>
              )}
              {!isAuthenticated && (
                <>Please log in to access all dashboard features.</>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Actions */}
        <div className="pt-4 border-t">
          <div className="text-sm font-medium mb-2">Quick Actions</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {!isAuthenticated && (
              <Badge variant="outline" className="cursor-pointer">
                <Users className="h-3 w-3 mr-1" />
                Login Required
              </Badge>
            )}
            {!apiKey && (
              <Badge variant="outline" className="cursor-pointer">
                <Key className="h-3 w-3 mr-1" />
                Configure API Key
              </Badge>
            )}
            {apiKey && !isApiKeyValid && (
              <Badge variant="outline" className="cursor-pointer">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Fix API Key
              </Badge>
            )}
            {!isWebSocketConnected && (
              <Badge variant="outline" className="cursor-pointer">
                <Wifi className="h-3 w-3 mr-1" />
                Reconnect WebSocket
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
