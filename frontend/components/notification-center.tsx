"use client"

import type React from "react"

import { useState } from "react"
import { Bell, Check, CheckCheck, Trash2, X, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useNotifications, type Notification } from "@/contexts/notification-context"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

const getNotificationIcon = (type: Notification["type"]) => {
  switch (type) {
    case "success":
      return "🟢"
    case "error":
      return "🔴"
    case "warning":
      return "🟡"
    default:
      return "🔵"
  }
}

const getCategoryLabel = (category: Notification["category"]) => {
  switch (category) {
    case "workflow":
      return "Workflows"
    case "task":
      return "Tasks"
    case "system":
      return "System"
    case "security":
      return "Security"
    default:
      return "General"
  }
}

function NotificationItem({ notification }: { notification: Notification }) {
  const { markAsRead, deleteNotification } = useNotifications()

  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.stopPropagation()
    markAsRead(notification.id)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    deleteNotification(notification.id)
  }

  return (
    <div
      className={`p-4 border-b last:border-b-0 hover:bg-muted/50 transition-colors ${
        !notification.read ? "bg-blue-50/50 border-l-4 border-l-blue-500" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{getNotificationIcon(notification.type)}</span>
            <h4 className="font-medium text-sm truncate">{notification.title}</h4>
            {!notification.read && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                New
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{notification.message}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
            </span>
            {notification.actionUrl && 
             typeof notification.actionUrl === 'string' && 
             notification.actionUrl.startsWith('/') && 
             notification.actionUrl !== '/tasks/[object Object]' && (
              <Link href={notification.actionUrl}>
                <Button variant="ghost" size="sm" className="h-6 text-xs">
                  {notification.actionLabel || "View"}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!notification.read && (
            <Button variant="ghost" size="sm" onClick={handleMarkAsRead} className="h-6 w-6 p-0" title="Mark as read">
              <Check className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            title="Delete notification"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function NotificationCenter() {
  const { notifications, unreadCount, markAllAsRead, clearAll } = useNotifications()
  const [activeTab, setActiveTab] = useState("all")

  const filteredNotifications =
    activeTab === "all" ? (notifications || []) : (notifications || []).filter((n) => n.category === activeTab)

  const categories = ["workflow", "task", "system", "security"]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96 p-0" align="end">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-6 text-xs">
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-6 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            </div>
          </div>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground">
              You have {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-4 pt-2">
            <TabsList className="grid w-full grid-cols-5 h-8">
              <TabsTrigger value="all" className="text-xs">
                All
              </TabsTrigger>
              {categories.map((category) => (
                <TabsTrigger key={category} value={category} className="text-xs">
                  {getCategoryLabel(category)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            <ScrollArea className="h-96">
              {filteredNotifications.length > 0 ? (
                filteredNotifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} />
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
