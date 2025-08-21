'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Activity, 
  User, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff
} from 'lucide-react'
import { useActivityFeed } from '@/lib/activity-feed-service'
import { formatDistanceToNow } from 'date-fns'
import { useEffect, useState } from 'react'
import { webSocketService } from '@/lib/websocket-service'

interface RealTimeActivityFeedProps {
  className?: string
  limit?: number
}

export function RealTimeActivityFeed({ className, limit = 10 }: RealTimeActivityFeedProps) {
  const { activities, isLoading, clearActivities } = useActivityFeed(limit)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Check WebSocket connection status
    const checkConnection = () => {
      setIsConnected(webSocketService.isSocketConnected())
    }

    checkConnection()
    
    // Listen for connection changes
    webSocketService.on('connect', () => setIsConnected(true))
    webSocketService.on('disconnect', () => setIsConnected(false))

    return () => {
      webSocketService.off('connect', () => setIsConnected(true))
      webSocketService.off('disconnect', () => setIsConnected(false))
    }
  }, [])

  const getActivityIcon = (action: string) => {
    if (action.includes('completed')) return <CheckCircle className="h-4 w-4 text-green-500" />
    if (action.includes('assigned')) return <User className="h-4 w-4 text-blue-500" />
    if (action.includes('updated')) return <Activity className="h-4 w-4 text-orange-500" />
    if (action.includes('status')) return <Clock className="h-4 w-4 text-purple-500" />
    return <Activity className="h-4 w-4 text-gray-500" />
  }

  const getActivityColor = (action: string) => {
    if (action.includes('completed')) return 'text-green-600'
    if (action.includes('assigned')) return 'text-blue-600'
    if (action.includes('updated')) return 'text-orange-600'
    if (action.includes('status')) return 'text-purple-600'
    return 'text-gray-600'
  }

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
          <div className="ml-auto flex items-center gap-2">
            {isConnected ? (
              <Badge variant="default" className="bg-green-500">
                <Wifi className="h-3 w-3 mr-1" />
                Live
              </Badge>
            ) : (
              <Badge variant="secondary">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
            {activities.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearActivities}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardTitle>
        <CardDescription>
          Real-time activity feed from your team
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-start space-x-3">
                <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No recent activity</p>
            <p className="text-sm text-gray-400 mt-1">
              Activity will appear here as your team works
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(activities || []).map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={activity.user.avatar} />
                  <AvatarFallback className="text-xs">
                    {getUserInitials(activity.user.name)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getActivityIcon(activity.action)}
                    <span className="text-sm font-medium">{activity.user.name}</span>
                    <span className={`text-sm ${getActivityColor(activity.action)}`}>
                      {activity.action}
                    </span>
                    {activity.target && (
                      <Badge variant="outline" className="text-xs">
                        {activity.target.name}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </span>
                    
                    {activity.type === 'system' && (
                      <Badge variant="secondary" className="text-xs">
                        System
                      </Badge>
                    )}
                  </div>
                  
                  {/* Additional metadata for certain activities */}
                  {activity.metadata && activity.action.includes('status') && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {activity.metadata.oldStatus} → {activity.metadata.newStatus}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {activities.length >= limit && (
              <div className="text-center pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing latest {limit} activities
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
