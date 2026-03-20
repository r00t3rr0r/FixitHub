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
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

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
        return <Package className="h-5 w-5 text-[#1a2a5e]" />
      case 'payment':
        return <CreditCard className="h-5 w-5 text-[#10b981]" />
      case 'message':
        return <MessageSquare className="h-5 w-5 text-[#f5b800]" />
      default:
        return <Bell className="h-5 w-5 text-[#636e85]" />
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
    <>
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 rounded-lg transition-colors"
            aria-label={`${t('navigation.notifications')} ${unreadCount > 0 ? `(${unreadCount} ${t('common.new')})` : ''}`}
            title={`${t('navigation.notifications')} ${unreadCount > 0 ? `- ${unreadCount} new` : ''}`}
          >
            <Bell className="h-[18px] w-[18px] transition-colors duration-200" />
            {unreadCount > 0 && (
              <Badge
                className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center px-1 bg-[#f5b800] hover:bg-[#e5ab00] text-[#1a2a5e] text-xs font-bold border-2 border-background shadow-md"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-[420px] p-0 shadow-xl border border-border"
          sideOffset={12}
        >
          <div className="bg-card">
            {/* Header with McRepair styling */}
            <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e]">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base flex items-center gap-2 text-white">
                  <Bell className="h-5 w-5 text-[#f5b800]" />
                  {t('navigation.notifications')}
                </h3>
                {unreadCount > 0 && (
                  <Badge className="bg-[#f5b800] hover:bg-[#e5ab00] text-[#1a2a5e] font-semibold text-xs px-2.5 py-0.5">
                    {unreadCount} {t('common.new')}
                  </Badge>
                )}
              </div>
            </div>

            {/* Notification Content */}
            <div className="max-h-[450px] overflow-y-auto">
              {loading ? (
                <div className="p-10 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-3">
                    <Bell className="h-8 w-8 text-muted-foreground animate-pulse" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('common.loading')}...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-4">
                    <Bell className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <p className="font-semibold text-foreground text-base mb-1">
                    {t('notifications.noNotifications')}
                  </p>
                  <p className="text-sm text-muted-foreground">Sie haben alle Benachrichtigungen gelesen</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification._id}
                      className={`bg-card rounded-lg p-3 border transition-all duration-200 cursor-pointer ${
                        !notification.isRead 
                          ? 'border-[#f5b800] bg-accent hover:shadow-md' 
                          : 'border-border hover:border-primary hover:shadow-md'
                      }`}
                      onClick={() => {
                        if (!notification.isRead) {
                          handleMarkAsRead(notification._id)
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-[#f5b800] rounded-full flex-shrink-0 ml-2" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5 leading-relaxed">
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
                          className="block mt-2 text-xs font-semibold text-foreground hover:text-[#f5b800] transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Details ansehen →
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-5 py-3 border-t border-border bg-muted">
                <Link 
                  to="/notifications" 
                  className="block text-center text-sm font-semibold text-foreground hover:text-[#f5b800] transition-colors"
                >
                  {t('navigation.viewAllNotifications')}
                </Link>
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}