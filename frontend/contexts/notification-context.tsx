"use client"

import type React from "react"
import { createContext, useContext, useState, useCallback, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"

export interface Notification {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  category: "workflow" | "task" | "system" | "security" | "general"
  timestamp: Date
  read: boolean
  actionUrl?: string
  actionLabel?: string
  metadata?: Record<string, any>
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  deleteNotification: (id: string) => void
  clearAll: () => void
  getNotificationsByCategory: (category: string) => Notification[]
  loading: boolean
  loadNotifications: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length

  // Load real notifications from backend
  const loadNotifications = async () => {
    const token = localStorage.getItem('token')
    if (!token) return

    try {
      setLoading(true)
      const response = await fetch('http://localhost:5000/api/notifications?limit=20', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const backendNotifications = data.data.map((notif: any) => ({
          id: notif._id,
          title: notif.title,
          message: notif.message,
          type: notif.type === 'task_completed' ? 'success' :
                notif.type === 'task_overdue' ? 'warning' :
                notif.type === 'task_escalated' ? 'error' : 'info',
          category: notif.type.includes('task') ? 'task' :
                   notif.type.includes('workflow') ? 'workflow' : 'system',
          timestamp: new Date(notif.createdAt),
          read: notif.channels?.inApp?.read || false,
          actionUrl: notif.data?.taskId ? `/tasks/${typeof notif.data.taskId === 'object' ? notif.data.taskId._id || notif.data.taskId.id : notif.data.taskId}` : undefined,
          actionLabel: notif.data?.taskId ? 'View Task' : undefined
        }))

        setNotifications(backendNotifications)
        console.log(`📋 Loaded ${backendNotifications.length} real notifications from backend`)
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load notifications on mount
  useEffect(() => {
    loadNotifications()
  }, [])

  const addNotification = useCallback(
    (notificationData: Omit<Notification, "id" | "timestamp" | "read">) => {
      const newNotification: Notification = {
        ...notificationData,
        id: Date.now().toString(),
        timestamp: new Date(),
        read: false,
      }

      setNotifications((prev) => [newNotification, ...prev])

      // Show toast notification
      toast({
        title: newNotification.title,
        description: newNotification.message,
        variant: newNotification.type === "error" ? "destructive" : "default",
      })
    },
    [toast],
  )

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)),
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
  }, [])

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    // Also clear from backend if possible
    const token = localStorage.getItem('token')
    if (token) {
      fetch('http://localhost:5000/api/notifications/clear', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }).catch(err => console.log('Could not clear backend notifications:', err))
    }
  }, [])

  const getNotificationsByCategory = useCallback(
    (category: string) => {
      return notifications.filter((notification) => notification.category === category)
    },
    [notifications],
  )

  // Initialize with empty notifications (no dummy data)
  useEffect(() => {
    setNotifications([])
  }, [])

  // Connect to real-time notifications via Socket.io (not raw WebSocket)
  useEffect(() => {
    // Only connect if user is authenticated
    const token = localStorage.getItem('token')
    if (!token) {
      console.log('🔑 No auth token found, skipping WebSocket connection')
      return
    }

    console.log('🔔 Connecting to real-time notifications via Socket.io...')

    // Use Socket.io client instead of raw WebSocket
    let socket: any = null

    const connectSocketIO = async () => {
      try {
        // Import Socket.io client dynamically
        const { io } = await import('socket.io-client')

        socket = io('http://localhost:5000', {
          auth: {
            token: token
          },
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        })

        socket.on('connect', () => {
          console.log('✅ Connected to real-time notifications via Socket.io')
        })

        socket.on('notification', (notification: any) => {
          console.log('📨 Received real notification:', notification)

          // Add real notification to the list
          addNotification({
            title: notification.title,
            message: notification.message,
            type: notification.type === 'task_completed' ? 'success' :
                  notification.type === 'task_overdue' ? 'warning' :
                  notification.type === 'task_escalated' ? 'error' : 'info',
            category: notification.category || 'task',
            actionUrl: notification.actionUrl && typeof notification.actionUrl === 'string' ? notification.actionUrl : undefined,
            actionLabel: notification.actionLabel
          })
        })

        socket.on('notification_count_update', (data: any) => {
          console.log('🔢 Notification count updated:', data.unreadCount)
          // Could update unread count here if needed
        })

        socket.on('connect_error', (error: any) => {
          console.error('❌ Socket.io connection error:', error.message)
        })

        socket.on('disconnect', (reason: string) => {
          console.log('🔌 Socket.io disconnected:', reason)
        })

        return socket
      } catch (error) {
        console.error('❌ Failed to connect to Socket.io:', error)
        return null
      }
    }

    connectSocketIO()

    return () => {
      if (socket) {
        console.log('🔌 Disconnecting Socket.io...')
        socket.disconnect()
      }
    }
  }, [addNotification])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        getNotificationsByCategory,
        loading,
        loadNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}
