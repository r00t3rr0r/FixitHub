import { useState, useEffect, useCallback } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { useToast } from "@/hooks/useToast"
import { getNotifications, markNotificationAsRead, Notification } from "@/api/notifications"
import { downloadAuthorizedFile } from "@/components/complaints/ComplaintLabelDownloadButton"
import {
  Bell,
  Package,
  CreditCard,
  MessageSquare,
  AlertTriangle,
  Clock,
  Download,
  Loader2,
  ArrowRight,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

// Gleicher Ereignisname wie in pages/Notifications.tsx: nach "gelesen"/"geloescht" dort
// aktualisiert sich die Glocke sofort (nicht erst beim naechsten 30-s-Abruf).
const NOTIFICATIONS_CHANGED_EVENT = "notifications:changed"
const DATA_URI = /data:[\w.+/-]+;base64,[A-Za-z0-9+/=\r\n]+/g

type BellAction = { kind: "open" | "download"; label: string; url: string; filename?: string }
type BellNotification = Notification & { category?: string; actions?: BellAction[]; metadata?: Record<string, any> }

export function NotificationBell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<BellNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchNotifications = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true)
      const response = await getNotifications({ limit: 10, unreadOnly: true })
      const data = response as any
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
      setLoadError(false)
    } catch (error) {
      console.error("NotificationBell: Error fetching notifications:", error)
      if (showSpinner) setLoadError(true)
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications(true)
    const pollInterval = setInterval(() => fetchNotifications(false), 30000)
    const onChanged = () => fetchNotifications(false)
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged)
    return () => {
      clearInterval(pollInterval)
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged)
    }
  }, [fetchNotifications])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      fetchNotifications(false)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId)
      setNotifications(prev => prev.filter(notif => notif._id !== notificationId))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('notificationsPage.markReadError'),
        variant: "destructive"
      })
    }
  }

  const getNotificationIcon = (notification: BellNotification) => {
    if (notification.category === 'complaint') return <AlertTriangle className="h-5 w-5 text-[#b45309]" />
    switch (notification.category || notification.type) {
      case 'order':
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
    const diff = Math.floor((Date.now() - date.getTime()) / 60000)
    if (diff < 1) return t('notificationsPage.justNow')
    if (diff < 60) return t('notificationsPage.minutesAgo', { count: diff })
    if (diff < 1440) return t('notificationsPage.hoursAgo', { count: Math.floor(diff / 60) })
    if (diff < 10080) return t('notificationsPage.daysAgo', { count: Math.floor(diff / 1440) })
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Ziel kommt vom Server (bereits auf den Datensatz abgebildet, z. B. /invoices?invoiceId=...).
  const openActionOf = (notification: BellNotification): BellAction | undefined =>
    notification.actions?.find(action => action.kind === 'open')
    || (notification.actionUrl ? { kind: 'open', label: t('notificationsPage.open'), url: notification.actionUrl } : undefined)

  const openNotification = async (notification: BellNotification) => {
    const target = openActionOf(notification)?.url
    if (!notification.isRead) await handleMarkAsRead(notification._id)
    setIsOpen(false)
    navigate(target || '/notifications')
  }

  const runDownload = async (notification: BellNotification, action: BellAction) => {
    try {
      setDownloadingId(notification._id)
      await downloadAuthorizedFile(action.url, action.filename || 'Versandlabel.pdf')
      if (!notification.isRead) await handleMarkAsRead(notification._id)
    } catch (error: any) {
      toast({ title: t('notificationsPage.downloadFailed'), description: error.message, variant: 'destructive' })
    } finally {
      setDownloadingId(null)
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
            aria-label={`${t('navigation.notifications')}${unreadCount > 0 ? ` (${t('notificationsPage.unreadCount', { count: unreadCount })})` : ''}`}
            title={`${t('navigation.notifications')}${unreadCount > 0 ? ` – ${t('notificationsPage.unreadCount', { count: unreadCount })}` : ''}`}
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
          className="w-[420px] max-w-[calc(100vw-12px)] p-0 shadow-xl border border-border"
          sideOffset={8}
          collisionPadding={6}
        >
          <div className="bg-card">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-border bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e]">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base flex items-center gap-2 text-white">
                  <Bell className="h-5 w-5 text-[#f5b800]" />
                  {t('navigation.notifications')}
                </h3>
                {unreadCount > 0 && (
                  <Badge className="bg-[#f5b800] hover:bg-[#e5ab00] text-[#1a2a5e] font-semibold text-xs px-2.5 py-0.5">
                    {t('notificationsPage.unreadCount', { count: unreadCount })}
                  </Badge>
                )}
              </div>
            </div>

            <div className="max-h-[68dvh] sm:max-h-[450px] overflow-y-auto">
              {loading ? (
                <div className="p-10 text-center">
                  <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('notificationsPage.loading')}</p>
                </div>
              ) : loadError ? (
                <div className="p-8 text-center" role="alert">
                  <p className="font-semibold text-foreground mb-2">{t('notificationsPage.loadError')}</p>
                  <button type="button" className="text-sm font-semibold text-[#1a2a5e] underline" onClick={() => fetchNotifications(true)}>
                    {t('notificationsPage.retry')}
                  </button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-4">
                    <Bell className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <p className="font-semibold text-foreground text-base mb-1">
                    {t('notificationsPage.noUnread')}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('notificationsPage.allCaughtUp')}</p>
                </div>
              ) : (
                <div className="p-2 sm:p-4 space-y-2 sm:space-y-3">
                  {notifications.map((notification) => {
                    const downloadAction = notification.actions?.find(action => action.kind === 'download')
                    const openAction = openActionOf(notification)
                    return (
                      <div
                        key={notification._id}
                        className={`bg-card rounded-lg p-2.5 sm:p-3 border transition-all duration-200 ${
                          !notification.isRead
                            ? 'border-[#f5b800] bg-accent hover:shadow-md'
                            : 'border-border hover:border-primary hover:shadow-md'
                        }`}
                      >
                        <button
                          type="button"
                          className="flex w-full items-start gap-3 text-left"
                          onClick={() => openNotification(notification)}
                        >
                          <div className="flex-shrink-0 mt-0.5 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            {getNotificationIcon(notification)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[13px] sm:text-sm font-semibold text-foreground truncate pr-1">
                                {notification.title}
                              </p>
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-[#f5b800] rounded-full flex-shrink-0 ml-2" aria-label={t('notificationsPage.unreadBadge')} />
                              )}
                            </div>
                            <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2 mb-1.5 leading-relaxed">
                              {String(notification.message || '').replace(DATA_URI, '').trim()}
                            </p>
                            <div className="flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatTime(notification.createdAt)}
                            </div>
                          </div>
                        </button>
                        <div className="mt-2 flex flex-wrap items-center gap-2 pl-[52px]">
                          {downloadAction && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-md bg-[#1a2a5e] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#2a3f7e] disabled:opacity-60"
                              disabled={downloadingId === notification._id}
                              onClick={() => runDownload(notification, downloadAction)}
                            >
                              {downloadingId === notification._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                              {downloadingId === notification._id ? t('notificationsPage.downloading') : downloadAction.label}
                            </button>
                          )}
                          {openAction && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-[#f5b800]"
                              onClick={() => openNotification(notification)}
                            >
                              {openAction.label} <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="px-3 sm:px-5 py-3 border-t border-border bg-muted">
              <Link
                to="/notifications"
                className="block text-center text-sm font-semibold text-foreground hover:text-[#f5b800] transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {t('navigation.viewAllNotifications')}
              </Link>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
