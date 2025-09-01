import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/useToast"
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, Notification } from "@/api/notifications"
import {
  Bell,
  Package,
  CreditCard,
  MessageSquare,
  Settings,
  Check,
  Clock,
  CheckCheck,
  Filter
} from "lucide-react"
import { Link } from "react-router-dom"

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const { toast } = useToast()

  useEffect(() => {
    fetchNotifications()
  }, [filter])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await getNotifications({ 
        limit: 50,
        unreadOnly: filter === 'unread' ? 'true' : 'false'
      })
      const data = response as any
      setNotifications(data.notifications || [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load notifications",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId)
      setNotifications(prev =>
        prev.map(notif =>
          notif._id === notificationId ? { ...notif, isRead: true } : notif
        )
      )
      toast({
        title: "Success",
        description: "Notification marked as read"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to mark notification as read",
        variant: "destructive"
      })
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead()
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, isRead: true }))
      )
      toast({
        title: "Success",
        description: "All notifications marked as read"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to mark all notifications as read",
        variant: "destructive"
      })
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order_update':
        return <Package className="h-5 w-5 text-blue-500" />
      case 'payment':
        return <CreditCard className="h-5 w-5 text-green-500" />
      case 'message':
        return <MessageSquare className="h-5 w-5 text-purple-500" />
      case 'assignment':
        return <Bell className="h-5 w-5 text-orange-500" />
      default:
        return <Settings className="h-5 w-5 text-gray-500" />
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Notifications</h1>
        </div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated with your repair orders and system updates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'unread' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unread')}
          >
            <Filter className="h-4 w-4 mr-2" />
            Unread ({unreadCount})
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Your Notifications
          </CardTitle>
          <CardDescription>
            {notifications.length === 0 
              ? "No notifications to display"
              : `${notifications.length} notification${notifications.length > 1 ? 's' : ''}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No notifications</p>
              <p>You're all caught up! New notifications will appear here.</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-1">
                {notifications.map((notification, index) => (
                  <div key={notification._id}>
                    <div
                      className={`p-4 hover:bg-accent transition-colors cursor-pointer ${
                        !notification.isRead ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                      }`}
                      onClick={() => {
                        if (!notification.isRead) {
                          handleMarkAsRead(notification._id)
                        }
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-sm">
                              {notification.title}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(notification.createdAt)}
                              </span>
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                              {notification.type.replace('_', ' ')}
                            </Badge>
                            {notification.actionUrl && (
                              <Link
                                to={notification.actionUrl}
                                className="text-xs text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View Details →
                              </Link>
                            )}
                          </div>
                        </div>
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMarkAsRead(notification._id)
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {index < notifications.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}