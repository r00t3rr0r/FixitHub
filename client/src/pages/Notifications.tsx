import { useState, useEffect, useMemo, useCallback } from "react"
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
import { downloadAuthorizedFile } from "@/components/complaints/ComplaintLabelDownloadButton"
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
  AlertTriangle,
  UserCheck,
  ArrowRight,
  RefreshCw,
  Download,
  Loader2,
  FileWarning,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import "../styles/notifications.css"

/** Strukturierte Aktion aus GET /api/notifications (siehe NotificationService). */
export type NotificationAction = { kind: "open" | "download"; label: string; url: string; filename?: string }
export type NotificationCategory = "order" | "message" | "payment" | "complaint" | "assignment" | "reminder" | "system"
export type NotificationItem = Notification & {
  category?: NotificationCategory
  actions?: NotificationAction[]
  metadata?: Record<string, any>
  orderId?: any
}

type FilterType = "all" | "unread" | NotificationCategory
type CountMap = Partial<Record<NotificationCategory, number>>

const PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200
const DATA_URI = /data:[\w.+/-]+;base64,[A-Za-z0-9+/=\r\n]+/g

export const NOTIFICATIONS_CHANGED_EVENT = "notifications:changed"

export function emitNotificationsChanged() {
  try {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
  } catch {
    /* ohne window (Tests) */
  }
}

// Letzte Absicherung: eingebettete Dateien nie als Text anzeigen (Server bereinigt bereits).
function cleanMessage(text: string) {
  return String(text || "").replace(DATA_URI, "").replace(/\s{2,}/g, " ").trim()
}

function orderIdOf(notification: NotificationItem): string {
  const raw = notification.orderId?._id || notification.orderId || notification.metadata?.orderId
  return raw ? String(raw) : ""
}

export function Notifications() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [countsByCategory, setCountsByCategory] = useState<CountMap>({})
  const [filter, setFilter] = useState<FilterType>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [showCommunicationPanel, setShowCommunicationPanel] = useState(false)
  const [selectedOrderForCommunication, setSelectedOrderForCommunication] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchNotifications = useCallback(async (nextLimit: number = limit, mode: "initial" | "more" | "silent" = "initial") => {
    try {
      if (mode === "initial") setLoading(true)
      if (mode === "more") setLoadingMore(true)
      const response = await getNotifications({ limit: nextLimit }) as any
      setNotifications(response.notifications || [])
      setUnreadCount(Number(response.unreadCount || 0))
      setTotalCount(Number(response.totalCount ?? (response.notifications || []).length))
      setCountsByCategory(response.countsByCategory || {})
      setHasMore(Boolean(response.hasMore))
      setLimit(nextLimit)
      setLoadError(null)
    } catch (error: any) {
      if (mode === "more") {
        toast({ title: t('common.error'), description: error.message || t('notificationsPage.loadError'), variant: "destructive" })
      } else {
        setLoadError(error.message || t('notificationsPage.loadError'))
      }
    } finally {
      if (mode === "initial") setLoading(false)
      if (mode === "more") setLoadingMore(false)
    }
  }, [limit, t, toast])

  useEffect(() => {
    fetchNotifications(PAGE_SIZE, "initial")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMarkAsRead = async (notificationId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const target = notifications.find(n => n._id === notificationId)
    if (!target || target.isRead) return
    try {
      await markNotificationAsRead(notificationId)
      setNotifications(prev => prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
      emitNotificationsChanged()
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" })
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
      emitNotificationsChanged()
      toast({ title: t('notificationsPage.allMarkedRead') })
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" })
    }
  }

  const handleDelete = async (notificationId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await deleteNotification(notificationId)
      const removed = notifications.find(n => n._id === notificationId)
      setNotifications(prev => prev.filter(n => n._id !== notificationId))
      setTotalCount(prev => Math.max(0, prev - 1))
      if (removed && !removed.isRead) setUnreadCount(prev => Math.max(0, prev - 1))
      if (removed?.category) {
        setCountsByCategory(prev => ({ ...prev, [removed.category as NotificationCategory]: Math.max(0, (prev[removed.category as NotificationCategory] || 0) - 1) }))
      }
      emitNotificationsChanged()
      toast({ title: t('notificationsPage.deleted') })
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" })
    }
  }

  const handleDeleteAll = async () => {
    try {
      await deleteAllNotifications()
      setNotifications([])
      setTotalCount(0)
      setUnreadCount(0)
      setCountsByCategory({})
      setHasMore(false)
      setShowDeleteAllConfirm(false)
      emitNotificationsChanged()
      toast({ title: t('notificationsPage.allDeleted') })
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" })
    }
  }

  const openTarget = async (notification: NotificationItem) => {
    if (!notification.isRead) await handleMarkAsRead(notification._id)
    const openAction = notification.actions?.find(a => a.kind === "open")
    const target = openAction?.url || notification.actionUrl
    if (target) {
      navigate(target)
      return
    }
    const orderId = orderIdOf(notification)
    if (notification.type === "message" && orderId) {
      setSelectedOrderForCommunication(orderId)
      setShowCommunicationPanel(true)
    }
  }

  const runDownload = async (notification: NotificationItem, action: NotificationAction, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      setDownloadingId(notification._id)
      await downloadAuthorizedFile(action.url, action.filename || "Versandlabel.pdf")
      if (!notification.isRead) await handleMarkAsRead(notification._id)
    } catch (error: any) {
      toast({ title: t('notificationsPage.downloadFailed'), description: error.message, variant: "destructive" })
    } finally {
      setDownloadingId(null)
    }
  }

  const categoryOf = (n: NotificationItem): NotificationCategory => {
    if (n.category) return n.category
    if (n.type === "payment" || n.metadata?.isInvoice) return "payment"
    if (n.metadata?.complaintId) return "complaint"
    if (n.type === "message") return "message"
    if (n.type === "order_update") return "order"
    if (n.type === "assignment" || n.type === "reminder") return n.type
    return "system"
  }

  // Gefilterte Liste (Kategorie + Suche auf den geladenen Eintraegen)
  const filtered = useMemo(() => {
    let list = notifications
    if (filter === "unread") list = list.filter(n => !n.isRead)
    else if (filter !== "all") list = list.filter(n => categoryOf(n) === filter)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      list = list.filter(n =>
        String(n.title || "").toLowerCase().includes(term) || cleanMessage(n.message).toLowerCase().includes(term)
      )
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications, filter, searchTerm])

  const grouped = useMemo(() => {
    const groups: Record<string, NotificationItem[]> = {}
    filtered.forEach(n => {
      const label = getDateLabel(n.createdAt)
      if (!groups[label]) groups[label] = []
      groups[label].push(n)
    })
    return groups
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered])

  function getDateLabel(dateStr: string): string {
    const d = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays <= 0) return t('notificationsPage.today')
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
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  const categoryMeta: Record<NotificationCategory, { label: string; tab: string; icon: (cls: string) => React.ReactNode; css: string }> = {
    order: { label: t('notificationsPage.typeOrder'), tab: t('notificationsPage.filterOrders'), icon: cls => <Package className={cls} />, css: "order_update" },
    message: { label: t('notificationsPage.typeMessage'), tab: t('notificationsPage.filterMessages'), icon: cls => <MessageSquare className={cls} />, css: "message" },
    payment: { label: t('notificationsPage.typePayment'), tab: t('notificationsPage.filterPayments'), icon: cls => <CreditCard className={cls} />, css: "payment" },
    complaint: { label: t('notificationsPage.typeComplaint'), tab: t('notificationsPage.filterComplaints'), icon: cls => <AlertTriangle className={cls} />, css: "reminder" },
    assignment: { label: t('notificationsPage.typeAssignment'), tab: t('notificationsPage.filterAssignments'), icon: cls => <UserCheck className={cls} />, css: "assignment" },
    reminder: { label: t('notificationsPage.typeReminder'), tab: t('notificationsPage.filterReminders'), icon: cls => <AlertCircle className={cls} />, css: "reminder" },
    system: { label: t('notificationsPage.typeSystem'), tab: t('notificationsPage.filterSystem'), icon: cls => <Settings className={cls} />, css: "system" },
  }

  // Kunden sehen nur ihre Kategorien; Personal-Kategorien erscheinen nur, wenn es Eintraege gibt.
  const categoryTabs: NotificationCategory[] = (["order", "message", "payment", "complaint", "assignment", "reminder", "system"] as NotificationCategory[])
    .filter(key => ["order", "message", "payment", "complaint"].includes(key) || (countsByCategory[key] || 0) > 0)

  const tabs: { key: FilterType; label: string; count: number; icon?: React.ReactNode }[] = [
    { key: "all", label: t('notificationsPage.filterAll'), count: totalCount },
    { key: "unread", label: t('notificationsPage.filterUnread'), count: unreadCount },
    ...categoryTabs.map(key => ({
      key: key as FilterType,
      label: categoryMeta[key].tab,
      count: countsByCategory[key] || 0,
      icon: categoryMeta[key].icon("h-3.5 w-3.5"),
    })),
  ]

  const activeTabCount = tabs.find(tab => tab.key === filter)?.count || 0
  const loadedInFilter = filtered.length
  const canLoadMore = hasMore && limit < MAX_PAGE_SIZE && !searchTerm.trim()

  return (
    <div className="notifications-page">
      <SEO
        title="Benachrichtigungen – McRepair.de Kundenportal"
        description="Alle Benachrichtigungen zu Ihren Aufträgen und Buchungen auf einen Blick. Immer up to date im McRepair.de Kundenportal."
        canonical="/notifications"
        noindex={true}
      />
      {/* ── KOPF ── */}
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
              <button className="notifications-btn-ghost" onClick={() => fetchNotifications(limit, "initial")} disabled={loading}>
                <RefreshCw className={`h-4 w-4${loading ? " animate-spin" : ""}`} />
                <span>{t('notificationsPage.refresh')}</span>
              </button>
              {totalCount > 0 && (
                <button className="notifications-btn-ghost" onClick={() => setShowDeleteAllConfirm(true)}>
                  <Trash2 className="h-4 w-4" />
                  <span>{t('notificationsPage.deleteAll')}</span>
                </button>
              )}
            </div>
          </div>

          <div className="notifications-stats">
            <div className="notifications-stat">
              <div className="notifications-stat-value">{totalCount}</div>
              <div className="notifications-stat-label">{t('notificationsPage.total')}</div>
            </div>
            <div className="notifications-stat">
              <div className="notifications-stat-value" style={{ color: unreadCount > 0 ? "#fbbf24" : undefined }}>{unreadCount}</div>
              <div className="notifications-stat-label">{t('notificationsPage.filterUnread')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SUCHE ── */}
      <div className="notifications-toolbar">
        <div className="notifications-search-box">
          <Search />
          <input
            className="notifications-search-input"
            type="search"
            aria-label={t('notificationsPage.searchPlaceholder')}
            placeholder={t('notificationsPage.searchPlaceholder')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* ── FILTER (mobil) ── */}
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
            {tabs.map(tab => (
              <option key={tab.key} value={tab.key}>
                {tab.label} ({tab.count})
              </option>
            ))}
          </select>
          {filter !== "all" && (
            <button type="button" className="notifications-filter-mobile-reset" onClick={() => setFilter("all")}>
              {t('notificationsPage.resetFilter')}
            </button>
          )}
        </div>
      </div>

      {/* ── FILTER (Tabs) ── */}
      <div className="notifications-tabs" role="tablist" aria-label={t('notificationsPage.filterLabel')}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={filter === tab.key}
            className={`notifications-tab${filter === tab.key ? " active" : ""}`}
            onClick={() => setFilter(tab.key)}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span className={`notifications-tab-count${tab.key === "unread" && unreadCount > 0 ? " unread" : ""}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── INHALT: Laden / Fehler / Leer / Liste ── */}
      <div className="notifications-content">
        {loading ? (
          <div aria-busy="true">
            <p className="sr-only">{t('notificationsPage.loading')}</p>
            <LoadingSkeleton />
          </div>
        ) : loadError ? (
          <div className="notifications-empty" role="alert">
            <FileWarning style={{ width: 56, height: 56 }} />
            <h3>{t('notificationsPage.loadError')}</h3>
            <p>{loadError}</p>
            <button className="notifications-btn-primary" style={{ marginTop: 12 }} onClick={() => fetchNotifications(limit, "initial")}>
              <RefreshCw className="h-4 w-4" />
              <span>{t('notificationsPage.retry')}</span>
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            filter={filter}
            searchTerm={searchTerm}
            hasAny={totalCount > 0}
            categoryLabel={filter !== "all" && filter !== "unread" ? categoryMeta[filter].tab : ""}
            hiddenInFilter={activeTabCount > loadedInFilter}
            onLoadMore={canLoadMore ? () => fetchNotifications(Math.min(limit + PAGE_SIZE, MAX_PAGE_SIZE), "more") : undefined}
          />
        ) : (
          <>
            {Object.entries(grouped).map(([dateLabel, items]) => (
              <div key={dateLabel} className="notifications-date-group">
                <div className="notifications-date-label">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {dateLabel}
                </div>
                <div className="notifications-list">
                  {items.map(notification => {
                    const category = categoryOf(notification)
                    const meta = categoryMeta[category]
                    const downloadAction = notification.actions?.find(a => a.kind === "download")
                    const openAction = notification.actions?.find(a => a.kind === "open")
                      || (notification.actionUrl ? { kind: "open" as const, label: t('notificationsPage.open'), url: notification.actionUrl } : undefined)
                    const orderId = orderIdOf(notification)
                    const canOpenThread = notification.type === "message" && Boolean(orderId)
                    const isClickable = Boolean(openAction) || canOpenThread
                    return (
                      <article
                        key={notification._id}
                        className={`notification-item${!notification.isRead ? " unread" : ""}`}
                        style={{ cursor: isClickable ? "pointer" : "default" }}
                        onClick={() => { if (isClickable) openTarget(notification) }}
                        aria-label={notification.title}
                      >
                        <div className={`notification-icon-wrap ${meta.css}`}>
                          {meta.icon("h-5 w-5")}
                        </div>

                        <div className="notification-body">
                          <div className="notification-row-top">
                            <span className="notification-title">{notification.title}</span>
                            <div className="notification-meta">
                              <span className="notification-time">
                                <Clock className="h-3 w-3" />
                                {formatTime(notification.createdAt)}
                              </span>
                              {!notification.isRead && (
                                <span className="rounded-full bg-[#f5b800] px-2 py-0.5 text-[11px] font-bold text-[#1a2a5e]">
                                  {t('notificationsPage.unreadBadge')}
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="notification-message">{cleanMessage(notification.message)}</p>

                          <div className="mb-2">
                            <span className={`notification-type-badge ${meta.css}`}>
                              {meta.icon("h-3 w-3")}
                              {meta.label}
                            </span>
                          </div>

                          {/* Aktionen: immer sichtbar, mit Text */}
                          <div className="flex flex-wrap items-center gap-2">
                            {downloadAction && (
                              <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-lg bg-[#1a2a5e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2a3f7e] disabled:opacity-60"
                                disabled={downloadingId === notification._id}
                                onClick={e => runDownload(notification, downloadAction, e)}
                              >
                                {downloadingId === notification._id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Download className="h-3.5 w-3.5" />}
                                {downloadingId === notification._id ? t('notificationsPage.downloading') : downloadAction.label}
                              </button>
                            )}
                            {openAction && (
                              <button
                                type="button"
                                className={downloadAction
                                  ? "inline-flex items-center gap-1.5 rounded-lg border border-[#1a2a5e] bg-white px-3 py-1.5 text-xs font-semibold text-[#1a2a5e] hover:bg-[#eef3ff]"
                                  : "inline-flex items-center gap-1.5 rounded-lg bg-[#1a2a5e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2a3f7e]"}
                                onClick={e => { e.stopPropagation(); openTarget(notification) }}
                              >
                                {openAction.label} <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {canOpenThread && (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                onClick={e => {
                                  e.stopPropagation()
                                  if (!notification.isRead) handleMarkAsRead(notification._id)
                                  setSelectedOrderForCommunication(orderId)
                                  setShowCommunicationPanel(true)
                                }}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                {t('notificationsPage.openMessage')}
                              </button>
                            )}
                            <span className="flex-1" />
                            {!notification.isRead && (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                                onClick={e => handleMarkAsRead(notification._id, e)}
                              >
                                <Check className="h-3.5 w-3.5" />
                                {t('notificationsPage.markRead')}
                              </button>
                            )}
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600"
                              onClick={e => handleDelete(notification._id, e)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {t('notificationsPage.delete')}
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="flex flex-col items-center gap-2 py-4 text-sm text-gray-500">
              <span>{t('notificationsPage.showingOf', { shown: notifications.length, total: totalCount })}</span>
              {canLoadMore && (
                <button
                  className="notifications-btn-ghost"
                  style={{ color: "#1a2a5e", borderColor: "#1a2a5e" }}
                  disabled={loadingMore}
                  onClick={() => fetchNotifications(Math.min(limit + PAGE_SIZE, MAX_PAGE_SIZE), "more")}
                >
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span>{loadingMore ? t('notificationsPage.loadingMore') : t('notificationsPage.loadMore')}</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── ALLE LOESCHEN ── */}
      {showDeleteAllConfirm && (
        <div className="notifications-confirm-overlay" onClick={() => setShowDeleteAllConfirm(false)}>
          <div className="notifications-confirm-dialog" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <h3>{t('notificationsPage.deleteAllConfirmTitle')}</h3>
            <p>{t('notificationsPage.deleteAllConfirmDesc', { count: totalCount })}</p>
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

      {/* ── NACHRICHTEN ZUM AUFTRAG ── */}
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
   Unterkomponenten
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

function EmptyState({
  filter,
  searchTerm,
  hasAny,
  categoryLabel,
  hiddenInFilter,
  onLoadMore,
}: {
  filter: string
  searchTerm: string
  hasAny: boolean
  categoryLabel: string
  hiddenInFilter: boolean
  onLoadMore?: () => void
}) {
  const { t } = useTranslation()
  let title = t('notificationsPage.noNotificationsYet')
  let text = t('notificationsPage.newNotificationsWillAppear')
  if (searchTerm) {
    title = t('notificationsPage.noResults')
    text = t('notificationsPage.noResultsFor', { term: searchTerm })
  } else if (filter === "unread") {
    title = t('notificationsPage.noUnread')
    text = t('notificationsPage.allCaughtUp')
  } else if (filter !== "all" && hasAny) {
    title = t('notificationsPage.noInCategory', { category: categoryLabel })
    text = hiddenInFilter ? t('notificationsPage.olderInCategory') : t('notificationsPage.newNotificationsWillAppear')
  }
  return (
    <div className="notifications-empty">
      <Bell style={{ width: 64, height: 64 }} />
      <h3>{title}</h3>
      <p>{text}</p>
      {hiddenInFilter && onLoadMore && (
        <button className="notifications-btn-ghost" style={{ marginTop: 12, color: "#1a2a5e", borderColor: "#1a2a5e" }} onClick={onLoadMore}>
          <RefreshCw className="h-4 w-4" />
          <span>{t('notificationsPage.loadMore')}</span>
        </button>
      )}
    </div>
  )
}
