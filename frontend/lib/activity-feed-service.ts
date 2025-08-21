'use client'

import { webSocketService } from './websocket-service'

export interface ActivityItem {
  id: string
  user: {
    id: string
    name: string
    avatar?: string
  }
  action: string
  target?: {
    type: 'task' | 'note' | 'project' | 'system'
    id: string
    name: string
  }
  timestamp: string
  type: 'user' | 'system'
  metadata?: any
}

class ActivityFeedService {
  private static instance: ActivityFeedService
  private activities: ActivityItem[] = []
  private listeners = new Map<string, Function[]>()
  private maxActivities = 100

  static getInstance(): ActivityFeedService {
    if (!ActivityFeedService.instance) {
      ActivityFeedService.instance = new ActivityFeedService()
    }
    return ActivityFeedService.instance
  }

  constructor() {
    this.setupWebSocketListeners()
  }

  private setupWebSocketListeners() {
    // Listen for real-time activity updates
    webSocketService.on('activity_update', (data: any) => {
      this.handleActivityUpdate(data)
    })

    // Listen for task updates and convert to activities
    webSocketService.on('task_updated', (data: any) => {
      this.handleTaskUpdate(data)
    })

    webSocketService.on('task_status_changed', (data: any) => {
      this.handleTaskStatusChange(data)
    })

    webSocketService.on('task_assigned', (data: any) => {
      this.handleTaskAssigned(data)
    })

    webSocketService.on('task_completed', (data: any) => {
      this.handleTaskCompleted(data)
    })

    // Listen for user authentication to get user info
    webSocketService.on('authenticated', (data: any) => {
      this.currentUser = data.user
    })
  }

  private currentUser: any = null

  private handleActivityUpdate(data: any) {
    if (data.type === 'new_activity' && data.data) {
      this.addActivity(data.data)
    }
  }

  private handleTaskUpdate(data: any) {
    const activity: ActivityItem = {
      id: `task_update_${data.taskId}_${Date.now()}`,
      user: {
        id: data.updatedBy,
        name: this.getUserName(data.updatedBy),
        avatar: this.getUserAvatar(data.updatedBy)
      },
      action: 'updated task',
      target: {
        type: 'task',
        id: data.taskId,
        name: data.changes?.title || 'Task'
      },
      timestamp: data.timestamp || new Date().toISOString(),
      type: 'user',
      metadata: {
        changes: data.changes
      }
    }
    this.addActivity(activity)
  }

  private handleTaskStatusChange(data: any) {
    const activity: ActivityItem = {
      id: `task_status_${data.taskId}_${Date.now()}`,
      user: {
        id: data.changedBy,
        name: this.getUserName(data.changedBy),
        avatar: this.getUserAvatar(data.changedBy)
      },
      action: `changed task status from ${data.oldStatus} to ${data.newStatus}`,
      target: {
        type: 'task',
        id: data.taskId,
        name: 'Task'
      },
      timestamp: data.timestamp || new Date().toISOString(),
      type: 'user',
      metadata: {
        oldStatus: data.oldStatus,
        newStatus: data.newStatus
      }
    }
    this.addActivity(activity)
  }

  private handleTaskAssigned(data: any) {
    const activity: ActivityItem = {
      id: `task_assigned_${data.taskId}_${Date.now()}`,
      user: {
        id: data.assignedBy || 'system',
        name: this.getUserName(data.assignedBy) || 'System',
        avatar: this.getUserAvatar(data.assignedBy)
      },
      action: 'assigned task',
      target: {
        type: 'task',
        id: data.taskId,
        name: data.title || 'Task'
      },
      timestamp: data.timestamp || new Date().toISOString(),
      type: data.assignedBy ? 'user' : 'system',
      metadata: {
        assignedTo: data.assignedTo
      }
    }
    this.addActivity(activity)
  }

  private handleTaskCompleted(data: any) {
    const activity: ActivityItem = {
      id: `task_completed_${data.taskId}_${Date.now()}`,
      user: {
        id: data.completedBy || 'system',
        name: this.getUserName(data.completedBy) || 'System',
        avatar: this.getUserAvatar(data.completedBy)
      },
      action: 'completed task',
      target: {
        type: 'task',
        id: data.taskId,
        name: data.title || 'Task'
      },
      timestamp: data.timestamp || new Date().toISOString(),
      type: data.completedBy ? 'user' : 'system'
    }
    this.addActivity(activity)
  }

  private getUserName(userId: string): string {
    // In a real app, you'd have a user cache or lookup
    if (this.currentUser && this.currentUser.id === userId) {
      return `${this.currentUser.firstName} ${this.currentUser.lastName}`
    }
    // For now, return a placeholder that's more user-friendly
    return userId === 'system' ? 'System' : 'Team Member'
  }

  private getUserAvatar(userId: string): string | undefined {
    // In a real app, you'd have a user cache or lookup
    if (this.currentUser && this.currentUser.id === userId) {
      return this.currentUser.avatar
    }
    return undefined
  }

  // Method to update current user info
  setCurrentUser(user: any) {
    this.currentUser = user
  }

  private addActivity(activity: ActivityItem) {
    // Add to the beginning of the array
    this.activities.unshift(activity)
    
    // Keep only the latest activities
    if (this.activities.length > this.maxActivities) {
      this.activities = this.activities.slice(0, this.maxActivities)
    }

    // Notify listeners
    this.emit('activity_added', activity)
    this.emit('activities_updated', this.activities)
  }

  // Public methods
  getActivities(): ActivityItem[] {
    return [...this.activities]
  }

  getRecentActivities(limit: number = 10): ActivityItem[] {
    return this.activities.slice(0, limit)
  }

  clearActivities(): void {
    this.activities = []
    this.emit('activities_updated', this.activities)
  }

  // Event system
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(callback)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }

  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data))
    }
  }

  // Add manual activity (for system events)
  addManualActivity(activity: Omit<ActivityItem, 'id' | 'timestamp'>): void {
    const fullActivity: ActivityItem = {
      ...activity,
      id: `manual_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toISOString()
    }
    this.addActivity(fullActivity)
  }
}

// Export singleton instance
export const activityFeedService = ActivityFeedService.getInstance()

// React hook for activity feed
export function useActivityFeed(limit?: number) {
  const [activities, setActivities] = React.useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    // Get initial activities
    const initialActivities = limit 
      ? activityFeedService.getRecentActivities(limit)
      : activityFeedService.getActivities()
    
    setActivities(initialActivities)
    setIsLoading(false)

    // Listen for updates
    const handleActivitiesUpdate = (newActivities: ActivityItem[]) => {
      const limitedActivities = limit 
        ? newActivities.slice(0, limit)
        : newActivities
      setActivities(limitedActivities)
    }

    activityFeedService.on('activities_updated', handleActivitiesUpdate)

    return () => {
      activityFeedService.off('activities_updated', handleActivitiesUpdate)
    }
  }, [limit])

  const addActivity = React.useCallback((activity: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    activityFeedService.addManualActivity(activity)
  }, [])

  const clearActivities = React.useCallback(() => {
    activityFeedService.clearActivities()
  }, [])

  return {
    activities,
    isLoading,
    addActivity,
    clearActivities
  }
}

// We need to import React for the hook
import React from 'react'
