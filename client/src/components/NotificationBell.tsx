import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { useToast } from "@/hooks/useToast"
import { getNotifications, markNotificationAsRead, Notification } from "@/api/notifications"
import {
  Bell,
  Package,
  CreditCard,
  MessageSquare,
  Settings,
  Check,
  Clock
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { ScrollArea } from "./ui/scroll-area"

export function NotificationBell() {
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    console.log('NotificationBell: Initializing notification polling');
    fetchNotifications()

    // Set up polling to refresh notifications every 5 seconds
    const pollInterval = setInterval(() => {
      console.log('NotificationBell: Polling for new notifications');
      fetchNotifications()
    }, 5000)

    return () => {
      console.log('NotificationBell: Cleaning up notification polling');
      clearInterval(pollInterval)
    }
  }, [])

  // Refresh notifications when dropdown is opened
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      console.log('NotificationBell: Dropdown opened, refreshing notifications');
      fetchNotifications()
    }
  }

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await getNotifications({ limit: 10 })
      const data = response as any
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
      console.log('NotificationBell: Notifications fetched:', {
        count: data.notifications?.length || 0,
        unreadCount: data.unreadCount || 0
      })
    } catch (error) {
      console.error("NotificationBell: Error fetching notifications:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      console.log('NotificationBell: Marking notification as read:', notificationId)
      await markNotificationAsRead(notificationId)
      setNotifications(prev =>
        prev.map(notif =>
          notif._id === notificationId ? { ...notif, isRead: true } : notif
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
      console.log('NotificationBell: Notification marked as read successfully')
    } catch (error: any) {
      console.error('NotificationBell: Error marking notification as read:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to mark notification as read",
        variant: "destructive"
      })
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order_update':
        return <Package className="h-4 w-4 text-blue-500" />
      case 'payment':
        return <CreditCard className="h-4 w-4 text-green-500" />
      case 'message':
        return <MessageSquare className="h-4 w-4 text-purple-500" />
      default:
        return <Settings className="h-4 w-4 text-gray-500" />
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

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-accent/50 transition-colors duration-200"
          aria-label={`${t('navigation.notifications')} ${unreadCount > 0 ? `(${unreadCount} ${t('common.new')})` : ''}`}
          title={`${t('navigation.notifications')} ${unreadCount > 0 ? `- ${unreadCount} new` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs font-bold shadow-lg"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-background">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t('navigation.notifications')}</span>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} {t('common.new')}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {t('common.loading')}...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {t('notifications.noNotifications')}
          </div>
        ) : (
          <ScrollArea className="h-80">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification._id}
                className="p-0 focus:bg-accent"
                asChild
              >
                <div
                  className={`p-3 cursor-pointer hover:bg-accent transition-colors ${
                    !notification.isRead ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                  }`}
                  onClick={() => {
                    if (!notification.isRead) {
                      handleMarkAsRead(notification._id)
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium truncate">
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 ml-2" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatTime(notification.createdAt)}
                      </div>
                    </div>
                  </div>
                  {notification.actionUrl && (
                    <Link
                      to={notification.actionUrl}
                      className="block mt-2 text-xs text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View Details →
                    </Link>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/notifications" className="w-full text-center text-sm hover:bg-accent">
            {t('navigation.viewAllNotifications')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}