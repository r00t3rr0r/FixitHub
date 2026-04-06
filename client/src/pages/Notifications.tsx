import { useState, useEffect, useMemo } from "react"
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
  Repeat2,
  UserCheck,
  ArrowRight,
  RefreshCw,
} from "lucide-react"
import { Link } from "react-router-dom"
import "../styles/notifications.css"

type FilterType = "all" | "unread" | "order_update" | "payment" | "message" | "system" | "assignment" | "reminder"

const TYPE_LABELS: Record<string, string> = {
  order_update: "Auftrag",
  payment: "Zahlung",
  message: "Nachricht",
  system: "System",
  assignment: "Zuweisung",
  reminder: "Erinnerung",
}

export function Notifications() {
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
      toast({ title: "Fehler", description: error.message || "Benachrichtigungen konnten nicht geladen werden", variant: "destructive" })
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
      toast({ title: "Fehler", description: error.message, variant: "destructive" })
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      toast({ title: "Erledigt", description: "Alle als gelesen markiert" })
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" })
    }
  }

  const handleDelete = async (notificationId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await deleteNotification(notificationId)
      setNotifications(prev => prev.filter(n => n._id !== notificationId))
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" })
    }
  }

  const handleDeleteAll = async () => {
    try {
      await deleteAllNotifications()
      setNotifications([])
      setShowDeleteAllConfirm(false)
      toast({ title: "Erledigt", description: "Alle Benachrichtigungen gelöscht" })
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" })
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
    if (diffDays === 0) return "Heute"
    if (diffDays === 1) return "Gestern"
    if (diffDays < 7) return "Diese Woche"
    if (diffDays < 30) return "Dieser Monat"
    return "Älter"
  }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000)
    if (diff < 1) return "Gerade eben"
    if (diff < 60) return `vor ${diff} Min`
    if (diff < 1440) return `vor ${Math.floor(diff / 60)} Std`
    if (diff < 10080) return `vor ${Math.floor(diff / 1440)} Tag${Math.floor(diff / 1440) > 1 ? "en" : ""}`
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short" })
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
    { key: "all",          label: "Alle",         shortLabel: "Alle" },
    { key: "unread",       label: "Ungelesen",    shortLabel: "Neu" },
    { key: "order_update", label: "Aufträge",     shortLabel: "Jobs", icon: <Package className="h-3.5 w-3.5" /> },
    { key: "payment",      label: "Zahlungen",    shortLabel: "Zahl.", icon: <CreditCard className="h-3.5 w-3.5" /> },
    { key: "message",      label: "Nachrichten",  shortLabel: "Msg", icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { key: "assignment",   label: "Zuweisungen",  shortLabel: "Zuweis.", icon: <UserCheck className="h-3.5 w-3.5" /> },
    { key: "reminder",     label: "Erinnerungen", shortLabel: "Erinn.", icon: <AlertCircle className="h-3.5 w-3.5" /> },
    { key: "system",       label: "System",       shortLabel: "System", icon: <Settings className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="notifications-page">
      {/* ── HERO HEADER ── */}
      <div className="notifications-header">
        <div className="notifications-header-content">
          <div className="notifications-header-top">
            <div className="notifications-header-title">
              <Bell className="notifications-icon-lg" />
              <div>
                <h1>Benachrichtigungen</h1>
                <p>Bleib über deine Reparaturaufträge und Systemmeldungen auf dem Laufenden</p>
              </div>
            </div>
            <div className="notifications-header-actions">
              {unreadCount > 0 && (
                <button className="notifications-btn-primary" onClick={handleMarkAllAsRead}>
                  <CheckCheck className="h-4 w-4" />
                  <span>Alle gelesen</span>
                </button>
              )}
              <button className="notifications-btn-ghost" onClick={fetchNotifications}>
                <RefreshCw className="h-4 w-4" />
                <span>Aktualisieren</span>
              </button>
              {notifications.length > 0 && (
                <button className="notifications-btn-ghost" onClick={() => setShowDeleteAllConfirm(true)}>
                  <Trash2 className="h-4 w-4" />
                  <span>Alle löschen</span>
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="notifications-stats">
            <div className="notifications-stat">
              <div className="notifications-stat-value">{counts.all || 0}</div>
              <div className="notifications-stat-label">Gesamt</div>
            </div>
            {unreadCount > 0 && (
              <div className="notifications-stat">
                <div className="notifications-stat-value" style={{ color: "#fbbf24" }}>{unreadCount}</div>
                <div className="notifications-stat-label">Ungelesen</div>
              </div>
            )}
            {(counts.order_update || 0) > 0 && (
              <div className="notifications-stat">
                <div className="notifications-stat-value">{counts.order_update}</div>
                <div className="notifications-stat-label">Aufträge</div>
              </div>
            )}
            {(counts.message || 0) > 0 && (
              <div className="notifications-stat">
                <div className="notifications-stat-value">{counts.message}</div>
                <div className="notifications-stat-label">Nachrichten</div>
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
            placeholder="Benachrichtigungen suchen…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* ── MOBILE FILTER ── */}
      <div className="notifications-filter-mobile" aria-label="Benachrichtigungsfilter">
        <label className="notifications-filter-mobile-label" htmlFor="notifications-filter-select">
          Kategorie
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
              Zurücksetzen
            </button>
          )}
        </div>
        <div className="notifications-filter-mobile-quick" role="group" aria-label="Schnellfilter">
          <button
            type="button"
            className={`notifications-filter-mobile-chip${filter === "all" ? " active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Alle
            <span className="notifications-filter-mobile-chip-count">{notifications.length}</span>
          </button>
          <button
            type="button"
            className={`notifications-filter-mobile-chip${filter === "unread" ? " active" : ""}`}
            onClick={() => setFilter("unread")}
          >
            Ungelesen
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
                            <span className="notification-unread-dot" title="Ungelesen" />
                          )}
                        </div>
                      </div>

                      <p className="notification-message">{notification.message}</p>

                      <div className="notification-footer">
                        <div className="notification-footer-main">
                          <span className={`notification-type-badge ${notification.type}`}>
                            {getIcon(notification.type)}
                            {TYPE_LABELS[notification.type] || notification.type}
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
                              Nachricht öffnen <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        <div className="notification-actions">
                          {!notification.isRead && (
                            <button
                              className="notification-action-btn"
                              title="Als gelesen markieren"
                              onClick={e => handleMarkAsRead(notification._id, e)}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            className="notification-action-btn delete"
                            title="Löschen"
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
            <h3>Alle Benachrichtigungen löschen?</h3>
            <p>
              Dieser Vorgang löscht alle {notifications.length} Benachrichtigungen unwiderruflich.
              Du kannst dies nicht rückgängig machen.
            </p>
            <div className="notifications-confirm-btns">
              <button className="notif-btn-sm outline" onClick={() => setShowDeleteAllConfirm(false)}>
                Abbrechen
              </button>
              <button
                className="notif-btn-sm danger"
                style={{ background: "#ef4444", color: "#fff", borderColor: "#ef4444" }}
                onClick={handleDeleteAll}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Alle löschen
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
                Auftragskommunikation
              </DialogTitle>
              <DialogDescription>
                Kommuniziere mit unserem Support-Team über deinen Reparaturauftrag
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
  return (
    <div className="notifications-empty">
      <Bell style={{ width: 64, height: 64 }} />
      <h3>
        {searchTerm
          ? "Keine Ergebnisse"
          : filter === "unread"
          ? "Keine ungelesenen Benachrichtigungen"
          : "Keine Benachrichtigungen"}
      </h3>
      <p>
        {searchTerm
          ? `Für „${searchTerm}" wurden keine Benachrichtigungen gefunden.`
          : filter === "unread"
          ? "Du bist auf dem neuesten Stand – alle Benachrichtigungen wurden gelesen."
          : "Neue Benachrichtigungen erscheinen hier, sobald etwas passiert."}
      </p>
    </div>
  )
}
