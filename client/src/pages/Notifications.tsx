import { useState, useEffect, useMemo } from "react"
import { SEO } from '@/components/SEO'
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/useToast"
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  Notification,
} from "@/api/notifications"
import { CommunicationPanel } from "@/components/inspection/CommunicationPanel"
import {
  Bell,
  Package,
  CreditCard,
  MessageSquare,
  Settings,
  Check,
  Clock,
  CheckCheck,
  Search,
  Trash2,
  CalendarDays,
  AlertCircle,
  UserCheck,
  ArrowRight,
  RefreshCw,
} from "lucide-react"
import { Link } from "react-router-dom"
import "../styles/notifications.css"

type FilterType = "all" | "unread" | "order_update" | "payment" | "message" | "system" | "assignment" | "reminder"

export function Notifications() {
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [showCommunicationPanel, setShowCommunicationPanel] = useState(false)
  const [selectedOrderForCommunication, setSelectedOrderForCommunication] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await getNotifications({ limit: 100 }) as any
      setNotifications(response.notifications || [])
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message || t('notificationsPage.loadError'), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (notificationId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await markNotificationAsRead(notificationId)
      setNotifications(prev =>
        prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
      )
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" })
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      toast({ title: t('common.success'), description: t('notificationsPage.allMarkedRead') })
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" })
    }
  }

  const handleDelete = async (notificationId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await deleteNotification(notificationId)
      setNotifications(prev => prev.filter(n => n._id !== notificationId))
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" })
    }
  }

  const handleDeleteAll = async () => {
    try {
      await deleteAllNotifications()
      setNotifications([])
      setShowDeleteAllConfirm(false)
      toast({ title: t('common.success'), description: t('notificationsPage.allDeleted') })
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" })
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) handleMarkAsRead(notification._id)
    if (notification.type === "message") {
      const orderId = (notification as any).metadata?.orderId as string | undefined
      if (orderId) {
        setSelectedOrderForCommunication(orderId)
        setShowCommunicationPanel(true)
      }
    }
  }

  // Derived counts
  const counts = useMemo(() => {
    const base: Record<string, number> = { all: notifications.length, unread: 0 }
    notifications.forEach(n => {
      if (!n.isRead) base.unread = (base.unread || 0) + 1
      base[n.type] = (base[n.type] || 0) + 1
    })
    return base
  }, [notifications])

  // Filtered list
  const filtered = useMemo(() => {
    let list = notifications
    if (filter === "unread") list = list.filter(n => !n.isRead)
    else if (filter !== "all") list = list.filter(n => n.type === filter)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      list = list.filter(n =>
        n.title.toLowerCase().includes(term) || n.message.toLowerCase().includes(term)
      )
    }
    return list
  }, [notifications, filter, searchTerm])

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, Notification[]> = {}
    filtered.forEach(n => {
      const label = getDateLabel(n.createdAt)
      if (!groups[label]) groups[label] = []
      groups[label].push(n)
    })
    return groups
  }, [filtered])

  const unreadCount = counts.unread || 0

  function getDateLabel(dateStr: string): string {
    const d = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return t('notificationsPage.today')
    if (diffDays === 1) return t('notificationsPage.yesterday')
    if (diffDays < 7) return t('notificationsPage.thisWeek')
    if (diffDays < 30) return t('notificationsPage.thisMonth')
    return t('notificationsPage.older')
  }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000)
    if (diff < 1) return t('notificationsPage.justNow')
    if (diff < 60) return t('notificationsPage.minutesAgo', { count: diff })
    if (diff < 1440) return t('notificationsPage.hoursAgo', { count: Math.floor(diff / 60) })
    if (diff < 10080) return t('notificationsPage.daysAgo', { count: Math.floor(diff / 1440) })
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" })
  }

  function getIcon(type: string) {
    const cls = "h-5 w-5"
    switch (type) {
      case "order_update": return <Package className={cls} />
      case "payment":      return <CreditCard className={cls} />
      case "message":      return <MessageSquare className={cls} />
      case "assignment":   return <UserCheck className={cls} />
      case "reminder":     return <AlertCircle className={cls} />
      default:             return <Settings className={cls} />
    }
  }

  // Tab definitions
  const tabs: { key: FilterType; label: string; shortLabel: string; icon?: React.ReactNode }[] = [
    { key: "all",          label: t('notificationsPage.filterAll'),         shortLabel: t('notificationsPage.filterAll') },
    { key: "unread",       label: t('notificationsPage.filterUnread'),    shortLabel: t('notificationsPage.filterNew') },
    { key: "order_update", label: t('notificationsPage.filterOrders'),     shortLabel: t('notificationsPage.filterOrdersShort'), icon: <Package className="h-3.5 w-3.5" /> },
    { key: "payment",      label: t('notificationsPage.filterPayments'),   shortLabel: t('notificationsPage.filterPaymentsShort'), icon: <CreditCard className="h-3.5 w-3.5" /> },
    { key: "message",      label: t('notificationsPage.filterMessages'),  shortLabel: t('notificationsPage.filterMessagesShort'), icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { key: "assignment",   label: t('notificationsPage.filterAssignments'),  shortLabel: t('notificationsPage.filterAssignmentsShort'), icon: <UserCheck className="h-3.5 w-3.5" /> },
    { key: "reminder",     label: t('notificationsPage.filterReminders'), shortLabel: t('notificationsPage.filterRemindersShort'), icon: <AlertCircle className="h-3.5 w-3.5" /> },
    { key: "system",       label: t('notificationsPage.filterSystem'),       shortLabel: t('notificationsPage.filterSystem'), icon: <Settings className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="notifications-page">
      <SEO
        title="Benachrichtigungen – McRepair.de Kundenportal"
        description="Alle Benachrichtigungen zu Ihren Aufträgen und Buchungen auf einen Blick. Immer up to date im McRepair.de Kundenportal."
        canonical="/notifications"
        noindex={true}
      />
      {/* ── HERO HEADER ── */}
      <div className="notifications-header">
        <div className="notifications-header-content">
          <div className="notifications-header-top">
            <div className="notifications-header-title">
              <Bell className="notifications-icon-lg" />
              <div>
                <h1>{t('notifications.title')}</h1>
                <p>{t('notificationsPage.subtitle')}</p>
              </div>
            </div>
            <div className="notifications-header-actions">
              {unreadCount > 0 && (
                <button className="notifications-btn-primary" onClick={handleMarkAllAsRead}>
                  <CheckCheck className="h-4 w-4" />
                  <span>{t('notificationsPage.allRead')}</span>
                </button>
              )}
              <button className="notifications-btn-ghost" onClick={fetchNotifications}>
                <RefreshCw className="h-4 w-4" />
                <span>{t('common.refresh')}</span>
              </button>
              {notifications.length > 0 && (
                <button className="notifications-btn-ghost" onClick={() => setShowDeleteAllConfirm(true)}>
                  <Trash2 className="h-4 w-4" />
                  <span>{t('notificationsPage.deleteAll')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="notifications-stats">
            <div className="notifications-stat">
              <div className="notifications-stat-value">{counts.all || 0}</div>
              <div className="notifications-stat-label">{t('notificationsPage.total')}</div>
            </div>
            {unreadCount > 0 && (
              <div className="notifications-stat">
                <div className="notifications-stat-value" style={{ color: "#fbbf24" }}>{unreadCount}</div>
                <div className="notifications-stat-label">{t('notificationsPage.filterUnread')}</div>
              </div>
            )}
            {(counts.order_update || 0) > 0 && (
              <div className="notifications-stat">
                <div className="notifications-stat-value">{counts.order_update}</div>
                <div className="notifications-stat-label">{t('notificationsPage.filterOrders')}</div>
              </div>
            )}
            {(counts.message || 0) > 0 && (
              <div className="notifications-stat">
                <div className="notifications-stat-value">{counts.message}</div>
                <div className="notifications-stat-label">{t('notificationsPage.filterMessages')}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TOOLBAR ── */}
      <div className="notifications-toolbar">
        <div className="notifications-search-box">
          <Search />
          <input
            className="notifications-search-input"
            type="text"
            placeholder={t('notificationsPage.searchPlaceholder')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* ── MOBILE FILTER ── */}
      <div className="notifications-filter-mobile" aria-label={t('notificationsPage.filterLabel')}>
        <label className="notifications-filter-mobile-label" htmlFor="notifications-filter-select">
          {t('notificationsPage.category')}
        </label>
        <div className="notifications-filter-mobile-row">
          <select
            id="notifications-filter-select"
            className="notifications-filter-mobile-select"
            value={filter}
            onChange={e => setFilter(e.target.value as FilterType)}
          >
            {tabs.map(tab => {
              const count = tab.key === "all" ? notifications.length : (tab.key === "unread" ? unreadCount : (counts[tab.key] || 0))
              return (
                <option key={tab.key} value={tab.key}>
                  {tab.label} ({count})
                </option>
              )
            })}
          </select>
          {filter !== "all" && (
            <button
              type="button"
              className="notifications-filter-mobile-reset"
              onClick={() => setFilter("all")}
            >
              {t('common.reset')}
            </button>
          )}
        </div>
        <div className="notifications-filter-mobile-quick" role="group" aria-label={t('notificationsPage.quickFilter')}>
          <button
            type="button"
            className={`notifications-filter-mobile-chip${filter === "all" ? " active" : ""}`}
            onClick={() => setFilter("all")}
          >
            {t('notificationsPage.filterAll')}
            <span className="notifications-filter-mobile-chip-count">{notifications.length}</span>
          </button>
          <button
            type="button"
            className={`notifications-filter-mobile-chip${filter === "unread" ? " active" : ""}`}
            onClick={() => setFilter("unread")}
          >
            {t('notificationsPage.filterUnread')}
            <span className="notifications-filter-mobile-chip-count">{unreadCount}</span>
          </button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="notifications-tabs">
        {tabs.map(tab => {
          const count = tab.key === "unread" ? unreadCount : (counts[tab.key] || 0)
          const showCount = tab.key === "all" || count > 0
          return (
            <button
              key={tab.key}
              className={`notifications-tab${filter === tab.key ? " active" : ""}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.icon}
              <span className="notifications-tab-label" title={tab.label}>{tab.label}</span>
              <span className="notifications-tab-label-short" title={tab.label}>{tab.shortLabel}</span>
              {showCount && (
                <span className={`notifications-tab-count${tab.key === "unread" && unreadCount > 0 ? " unread" : ""}`}>
                  {tab.key === "all" ? notifications.length : count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── CONTENT ── */}
      <div className="notifications-content">
        {loading ? (
          <LoadingSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState filter={filter} searchTerm={searchTerm} />
        ) : (
          Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel} className="notifications-date-group">
              <div className="notifications-date-label">
                <CalendarDays className="h-3.5 w-3.5" />
                {dateLabel}
              </div>
              <div className="notifications-list">
                {items.map(notification => (
                  <div
                    key={notification._id}
                    className={`notification-item${!notification.isRead ? " unread" : ""}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Icon */}
                    <div className={`notification-icon-wrap ${notification.type}`}>
                      {getIcon(notification.type)}
                    </div>

                    {/* Body */}
                    <div className="notification-body">
                      <div className="notification-row-top">
                        <span className="notification-title">{notification.title}</span>
                        <div className="notification-meta">
                          <span className="notification-time">
                            <Clock className="h-3 w-3" />
                            {formatTime(notification.createdAt)}
                          </span>
                          {!notification.isRead && (
                            <span className="notification-unread-dot" title={t('notificationsPage.filterUnread')} />
                          )}
                        </div>
                      </div>

                      <p className="notification-message">{notification.message}</p>

                      <div className="notification-footer">
                        <div className="notification-footer-main">
                          <span className={`notification-type-badge ${notification.type}`}>
                            {getIcon(notification.type)}
                          {t(`notifications.types.${notification.type}`) || notification.type}
                          </span>
                          {notification.actionUrl && (
                            <Link
                              to={notification.actionUrl}
                              className="notification-link"
                              onClick={e => e.stopPropagation()}
                            >
                              Details <ArrowRight className="h-3 w-3" />
                            </Link>
                          )}
                          {notification.type === "message" && (notification as any).metadata?.orderId && (
                            <button
                              className="notification-link"
                              type="button"
                              onClick={e => {
                                e.stopPropagation()
                                const oid = (notification as any).metadata?.orderId as string
                                setSelectedOrderForCommunication(oid)
                                setShowCommunicationPanel(true)
                              }}
                            >
                              {t('notificationsPage.openMessage')} <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        <div className="notification-actions">
                          {!notification.isRead && (
                            <button
                              className="notification-action-btn"
                            title={t('notifications.markAsRead')}
                              onClick={e => handleMarkAsRead(notification._id, e)}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            className="notification-action-btn delete"
                            title={t('common.delete')}
                            onClick={e => handleDelete(notification._id, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── DELETE ALL CONFIRM ── */}
      {showDeleteAllConfirm && (
        <div className="notifications-confirm-overlay" onClick={() => setShowDeleteAllConfirm(false)}>
          <div className="notifications-confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>{t('notificationsPage.deleteAllConfirmTitle')}</h3>
            <p>
              {t('notificationsPage.deleteAllConfirmDesc', { count: notifications.length })}
            </p>
            <div className="notifications-confirm-btns">
              <button className="notif-btn-sm outline" onClick={() => setShowDeleteAllConfirm(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="notif-btn-sm danger"
                style={{ background: "#ef4444", color: "#fff", borderColor: "#ef4444" }}
                onClick={handleDeleteAll}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('notificationsPage.deleteAll')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── COMMUNICATION PANEL ── */}
      {selectedOrderForCommunication && (
        <Dialog open={showCommunicationPanel} onOpenChange={open => {
          setShowCommunicationPanel(open)
          if (!open) setSelectedOrderForCommunication(null)
        }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader className="pb-2">
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t('notificationsPage.orderCommunication')}
              </DialogTitle>
              <DialogDescription>
                {t('notificationsPage.communicationDesc')}
              </DialogDescription>
            </DialogHeader>
            <CommunicationPanel orderId={selectedOrderForCommunication} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────
   Sub-components
────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="notifications-skeleton">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="notification-skeleton-item">
          <div className="skeleton-circle" />
          <div className="skeleton-lines">
            <div className="skeleton-line medium" />
            <div className="skeleton-line long" />
            <div className="skeleton-line short" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ filter, searchTerm }: { filter: string; searchTerm: string }) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { t } = useTranslation()
  return (
    <div className="notifications-empty">
      <Bell style={{ width: 64, height: 64 }} />
      <h3>
        {searchTerm
          ? t('notificationsPage.noResults')
          : filter === "unread"
          ? t('notificationsPage.noUnread')
          : t('notifications.noNotifications')}
      </h3>
      <p>
        {searchTerm
          ? t('notificationsPage.noResultsFor', { term: searchTerm })
          : filter === "unread"
          ? t('notificationsPage.allCaughtUp')
          : t('notificationsPage.newNotificationsWillAppear')}
      </p>
    </div>
  )
}
