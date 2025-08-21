'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, Settings, X, Filter, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { notificationService, Notification, NotificationStats } from '@/lib/notification-service';
import { webSocketService } from '@/lib/websocket-service';
import { formatDistanceToNow } from 'date-fns';

interface NotificationCenterProps {
  className?: string;
}

export function NotificationCenter({ className }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const intervalRef = useRef<NodeJS.Timeout>();

  // Load notifications and stats
  const loadNotifications = async (refresh = false) => {
    if (loading && !refresh) return;
    
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      
      if (activeTab === 'unread') params.unreadOnly = true;
      if (filterType) params.type = filterType;
      if (filterPriority) params.priority = filterPriority;

      const [notificationData, statsData] = await Promise.all([
        notificationService.getNotifications(params),
        notificationService.getNotificationStats()
      ]);

      setNotifications(notificationData.notifications);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  // Initialize component
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
      
      // Set up polling for new notifications
      intervalRef.current = setInterval(() => {
        loadNotifications(true);
      }, 30000); // Poll every 30 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isOpen, activeTab, filterType, filterPriority]);

  // WebSocket event handlers
  useEffect(() => {
    const handleNewNotification = (notification: Notification) => {
      setNotifications(prev => [notification, ...prev]);
      loadNotifications(true); // Refresh stats
    };

    const handleNotificationsRead = (notificationIds: string[]) => {
      setNotifications(prev => 
        prev.map(notification => 
          notificationIds.includes(notification._id)
            ? { ...notification, isRead: true, readAt: new Date().toISOString() }
            : notification
        )
      );
      loadNotifications(true); // Refresh stats
    };

    webSocketService.on('notification', handleNewNotification);
    webSocketService.on('notifications_marked_read', handleNotificationsRead);

    return () => {
      webSocketService.off('notification', handleNewNotification);
      webSocketService.off('notifications_marked_read', handleNotificationsRead);
    };
  }, []);

  // Mark notifications as read
  const markAsRead = async (notificationIds: string[]) => {
    try {
      await notificationService.markAsRead(notificationIds);
      setSelectedNotifications([]);
      toast.success(`Marked ${notificationIds.length} notification(s) as read`);
    } catch (error) {
      toast.error('Failed to mark notifications as read');
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all notifications as read');
    }
  };

  // Delete notifications
  const deleteNotifications = async (notificationIds: string[]) => {
    try {
      await notificationService.deleteNotifications(notificationIds);
      setNotifications(prev => prev.filter(n => !notificationIds.includes(n._id)));
      setSelectedNotifications([]);
      toast.success(`Deleted ${notificationIds.length} notification(s)`);
    } catch (error) {
      toast.error('Failed to delete notifications');
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.isRead) {
      await markAsRead([notification._id]);
    }

    // Navigate to related content
    if (notification.data?.taskId) {
      window.location.href = `/tasks/${notification.data.taskId}`;
    } else if (notification.data?.url) {
      window.location.href = notification.data.url;
    }
  };

  // Toggle notification selection
  const toggleSelection = (notificationId: string) => {
    setSelectedNotifications(prev => 
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  // Get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'task_assigned': return '📋';
      case 'task_completed': return '✅';
      case 'task_overdue': return '⚠️';
      case 'task_reminder': return '⏰';
      case 'workflow_update': return '🔄';
      case 'system': return '⚙️';
      case 'mention': return '💬';
      default: return '📢';
    }
  };

  // Filter notifications based on active tab
  const filteredNotifications = (notifications || []).filter(notification => {
    if (activeTab === 'unread' && notification.isRead) return false;
    if (activeTab === 'urgent' && notification.priority !== 'urgent') return false;
    return true;
  });

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={`relative ${className}`}>
          <Bell className="h-5 w-5" />
          {stats && stats.unread > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {stats.unread > 99 ? '99+' : stats.unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-96 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notifications</CardTitle>
              <div className="flex items-center gap-2">
                {selectedNotifications.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(selectedNotifications)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNotifications(selectedNotifications)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={markAllAsRead}>
                      Mark all as read
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => loadNotifications(true)}>
                      Refresh
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsOpen(false)}>
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {stats && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{stats.total} total</span>
                <span>{stats.unread} unread</span>
                {stats.byPriority.urgent > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {stats.byPriority.urgent} urgent
                  </Badge>
                )}
              </div>
            )}
          </CardHeader>

          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mx-4 mb-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">
                  Unread {stats?.unread ? `(${stats.unread})` : ''}
                </TabsTrigger>
                <TabsTrigger value="urgent">
                  Urgent {stats?.byPriority.urgent ? `(${stats.byPriority.urgent})` : ''}
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-0">
                <div className="max-h-96 overflow-y-auto">
                  {loading && notifications.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : filteredNotifications.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No notifications</p>
                    </div>
                  ) : (
                    (filteredNotifications || []).map((notification) => (
                      <div
                        key={notification._id}
                        className={`p-4 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors ${
                          !notification.isRead ? 'bg-blue-50/50' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedNotifications.includes(notification._id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelection(notification._id);
                            }}
                            className="mt-1"
                          />
                          
                          <div className="flex-shrink-0">
                            <div className="text-lg">
                              {getTypeIcon(notification.type)}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm truncate">
                                {notification.title}
                              </h4>
                              <div className={`w-2 h-2 rounded-full ${getPriorityColor(notification.priority)}`} />
                            </div>
                            
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {notification.message}
                            </p>
                            
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>
                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                              </span>
                              {!notification.isRead && (
                                <Badge variant="secondary" className="text-xs">
                                  New
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationCenter;
