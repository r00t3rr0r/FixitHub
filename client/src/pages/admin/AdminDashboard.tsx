import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  HardDrive,
  MessageCircle,
  Package,
  RefreshCw,
  Settings,
  Timer,
  TrendingUp,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react"
import { getDashboardSummary, getCustomerMessages, type CustomerMessage } from "@/api/adminDashboard"
import "./AdminDashboard.css"

type NotificationMeta = {
  unreadCount: number
  urgentCount: number
  totalCount: number
}

type SectionCounts = {
  bookings: number
  repairRequests: number
  activities: number
  staffStatus: number
  assignedOrders: number
}

interface DashboardData {
  bookings: any[]
  repairRequests: any[]
  notifications: any[]
  activities: any[]
  staffStatus: any[]
  assignedOrders: any[]
  systemOverview: Record<string, any>
  notificationMeta: NotificationMeta
  sectionCounts: SectionCounts
}

const FALLBACK_DATA: DashboardData = {
  bookings: [],
  repairRequests: [],
  notifications: [],
  activities: [],
  staffStatus: [],
  assignedOrders: [],
  systemOverview: {},
  notificationMeta: {
    unreadCount: 0,
    urgentCount: 0,
    totalCount: 0,
  },
  sectionCounts: {
    bookings: 0,
    repairRequests: 0,
    activities: 0,
    staffStatus: 0,
    assignedOrders: 0,
  },
}

const safeArray = (value: unknown) => (Array.isArray(value) ? value : [])
const safeObject = (value: unknown) =>
  typeof value === "object" && value !== null ? (value as Record<string, any>) : {}

const toName = (entity: any, fallback = "Unknown") => {
  if (!entity || typeof entity !== "object") return fallback
  if (typeof entity.name === "string" && entity.name.trim()) return entity.name.trim()

  const first = typeof entity.firstName === "string" ? entity.firstName.trim() : ""
  const last = typeof entity.lastName === "string" ? entity.lastName.trim() : ""
  const merged = `${first} ${last}`.trim()
  return merged || fallback
}

const toCurrency = (value: number) => {
  const amount = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 2,
  }).format(amount)
}

const capitalize = (value?: string) => {
  if (!value) return "Unknown"
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function AdminDashboard() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [dashboardData, setDashboardData] = useState<DashboardData>(FALLBACK_DATA)
  const [customerMessages, setCustomerMessages] = useState<CustomerMessage[]>([])
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0)

  const fetchDashboardData = async (showToast = false) => {
    try {
      if (showToast) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const [data, msgData] = await Promise.all([
        getDashboardSummary(),
        getCustomerMessages(15),
      ])
      setCustomerMessages(msgData.messages)
      setTotalUnreadMessages(msgData.totalUnread)
      const processedData: DashboardData = {
        bookings: safeArray(data.bookings),
        repairRequests: safeArray(data.repairRequests),
        notifications: safeArray(data.notifications),
        activities: safeArray(data.activities),
        staffStatus: safeArray(data.staffStatus),
        assignedOrders: safeArray(data.assignedOrders),
        systemOverview: safeObject(data.systemOverview),
        notificationMeta: {
          unreadCount: Number(data.notificationMeta?.unreadCount || 0),
          urgentCount: Number(data.notificationMeta?.urgentCount || 0),
          totalCount: Number(data.notificationMeta?.totalCount || 0),
        },
        sectionCounts: {
          bookings: Number(data.sectionCounts?.bookings || 0),
          repairRequests: Number(data.sectionCounts?.repairRequests || 0),
          activities: Number(data.sectionCounts?.activities || 0),
          staffStatus: Number(data.sectionCounts?.staffStatus || 0),
          assignedOrders: Number(data.sectionCounts?.assignedOrders || 0),
        },
      }

      setDashboardData(processedData)
      setLastUpdatedAt(new Date())

      if (showToast) {
        toast({
          title: "Dashboard aktualisiert",
          description: `${processedData.bookings.length} Buchungen, ${processedData.repairRequests.length} Repair Requests, ${processedData.notificationMeta.unreadCount} ungelesene Hinweise`,
        })
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Dashboard konnte nicht geladen werden",
        description: error?.message || "Unbekannter Fehler",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()

    const interval = setInterval(() => {
      fetchDashboardData()
    }, 15000)

    return () => clearInterval(interval)
  }, [])

  const systemOverview = dashboardData.systemOverview
  const counts = safeObject(systemOverview.counts)
  const today = safeObject(systemOverview.today)
  const thisWeek = safeObject(systemOverview.thisWeek)
  const performance = safeObject(systemOverview.performance)
  const health = safeObject(systemOverview.systemHealth)

  const derived = useMemo(() => {
    const urgentOrders = dashboardData.assignedOrders.filter((order) =>
      ["urgent", "high"].includes(String(order?.priority || "").toLowerCase())
    ).length

    const overloadedStaff = dashboardData.staffStatus.filter((staff) => Number(staff?.utilizationRate || 0) >= 85).length

    const pendingBookings = dashboardData.bookings.filter((booking) => String(booking?.status || "") === "pending").length

    const openRepairs = dashboardData.repairRequests.filter((request) => {
      const status = String(request?.status || "")
      return ["pending", "reviewing", "approved"].includes(status)
    }).length

    return {
      urgentOrders,
      overloadedStaff,
      pendingBookings,
      openRepairs,
    }
  }, [dashboardData])

  const timeAgo = (date?: string | Date) => {
    if (!date) return "-"
    const then = new Date(date).getTime()
    if (!Number.isFinite(then)) return "-"

    const diff = Date.now() - then
    const min = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (min < 1) return "just now"
    if (min < 60) return `${min} min ago`
    if (hours < 24) return `${hours} h ago`
    return `${days} d ago`
  }

  const formatDurationMinutes = (hoursFloat?: number) => {
    const value = Number(hoursFloat || 0)
    const totalMinutes = Math.round(value * 60)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours <= 0) return `${minutes}m`
    return `${hours}h ${minutes}m`
  }

  if (loading) {
    return (
      <div className="admin-dashboard-loading-screen">
        <RefreshCw className="h-6 w-6 animate-spin text-[#1a2a5e]" />
        <p>Dashboard wird geladen...</p>
      </div>
    )
  }

  return (
    <div className="admin-dashboard-container compact-dashboard">
      <div className="admin-dashboard-header compact-header">
        <div className="compact-header-main">
          <h1>Admin Dashboard</h1>
          <p>Platzsparende Live-Uebersicht fuer Betrieb, Team und offene Vorgaenge</p>
        </div>

        <div className="compact-header-meta">
          <Badge variant="outline" className="compact-badge-muted">
            Letztes Update: {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString("de-CH") : "-"}
          </Badge>
          <Badge variant="outline" className="compact-badge-muted">
            Auto Refresh: 15s
          </Badge>
        </div>

        <div className="compact-header-actions">
          <Button size="sm" variant="outline" onClick={() => {
            const dataStr = JSON.stringify(dashboardData, null, 2)
            const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`
            const fileName = `admin-dashboard-${new Date().toISOString()}.json`
            const link = document.createElement("a")
            link.setAttribute("href", dataUri)
            link.setAttribute("download", fileName)
            link.click()
          }} className="compact-btn-light">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>

          <Button size="sm" variant="outline" onClick={() => fetchDashboardData(true)} disabled={refreshing} className="compact-btn-light">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        </div>
      </div>

      <div className="compact-stats-grid">
        <Card className="compact-stat-card">
          <CardContent className="compact-stat-content">
            <div>
              <p>Auftraege gesamt</p>
              <h3>{counts.totalOrders || 0}</h3>
              <small>{counts.activeOrders || 0} aktiv</small>
            </div>
            <Package className="h-4 w-4" />
          </CardContent>
        </Card>

        <Card className="compact-stat-card">
          <CardContent className="compact-stat-content">
            <div>
              <p>Kunden</p>
              <h3>{counts.totalUsers || 0}</h3>
              <small>{counts.activeStaff || 0} Team aktiv</small>
            </div>
            <Users className="h-4 w-4" />
          </CardContent>
        </Card>

        <Card className="compact-stat-card">
          <CardContent className="compact-stat-content">
            <div>
              <p>Nachrichten</p>
              <h3>{totalUnreadMessages}</h3>
              <small>ungelesen von Kunden</small>
            </div>
            <MessageCircle className="h-4 w-4" />
          </CardContent>
        </Card>

        <Card className="compact-stat-card">
          <CardContent className="compact-stat-content">
            <div>
              <p>Ungelesen</p>
              <h3>{dashboardData.notificationMeta.unreadCount}</h3>
              <small>{dashboardData.notificationMeta.urgentCount} dringend</small>
            </div>
            <Bell className="h-4 w-4" />
          </CardContent>
        </Card>

        <Card className="compact-stat-card">
          <CardContent className="compact-stat-content">
            <div>
              <p>System</p>
              <h3>{capitalize(String(health.status || "healthy"))}</h3>
              <small>DB: {capitalize(String(health.dbConnection || "connected"))}</small>
            </div>
            <Activity className="h-4 w-4" />
          </CardContent>
        </Card>
      </div>

      <div className="compact-alert-bar">
        <button type="button" onClick={() => navigate("/notifications")}>Dringende Hinweise: <strong>{dashboardData.notificationMeta.urgentCount}</strong></button>
        <button type="button" onClick={() => navigate("/admin/orders")}>Prioritaet Auftraege: <strong>{derived.urgentOrders}</strong></button>
        <button type="button" onClick={() => navigate("/admin/staff")}>Team Auslastung {">"} 85%: <strong>{derived.overloadedStaff}</strong></button>
        <button type="button" onClick={() => navigate("/admin/bookings")}>Buchungen offen: <strong>{derived.pendingBookings}</strong></button>
        {totalUnreadMessages > 0 && (
          <button type="button" className="compact-alert-messages" onClick={() => navigate("/admin/orders")}>Neue Kundennachrichten: <strong>{totalUnreadMessages}</strong></button>
        )}
      </div>

      <div className="compact-main-grid">
        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <Calendar className="h-4 w-4" />
              Neue Buchungen
            </CardTitle>
            <CardDescription>{dashboardData.sectionCounts.bookings || dashboardData.bookings.length} Eintraege</CardDescription>
          </CardHeader>
          <CardContent className="compact-panel-content">
            <ScrollArea className="compact-scroll-area">
              <div className="compact-list">
                {dashboardData.bookings.length === 0 && <p className="compact-empty">Keine aktuellen Buchungen</p>}
                {dashboardData.bookings.slice(0, 6).map((booking: any) => {
                  const customerName = toName(booking.customer)
                  const amount = Number(booking.totalCost ?? booking.totalAmount ?? 0)
                  const bookingId = booking.bookingNumber || booking._id?.slice(-6) || "-"
                  return (
                    <div key={booking._id || bookingId} className="compact-list-item">
                      <div>
                        <p className="compact-title">{customerName}</p>
                        <p className="compact-sub">#{bookingId}</p>
                      </div>
                      <div className="compact-list-side">
                        <Badge variant="outline" className="compact-badge">{String(booking.status || "unknown")}</Badge>
                        <span>{toCurrency(amount)}</span>
                        <small>{timeAgo(booking.createdAt || booking.bookingTime)}</small>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
            <Separator />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/admin/bookings")}>
              Buchungen verwalten
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <Wrench className="h-4 w-4" />
              Repair Requests
            </CardTitle>
            <CardDescription>{derived.openRepairs} offen</CardDescription>
          </CardHeader>
          <CardContent className="compact-panel-content">
            <ScrollArea className="compact-scroll-area">
              <div className="compact-list">
                {dashboardData.repairRequests.length === 0 && <p className="compact-empty">Keine offenen Repair Requests</p>}
                {dashboardData.repairRequests.slice(0, 6).map((request: any) => {
                  const customerName = toName(request.customer)
                  const device = request.device
                    ? `${request.device.brand || ""} ${request.device.model || ""}`.trim() || request.device.type || "Unknown device"
                    : request.deviceType || "Unknown device"

                  return (
                    <div key={request._id || request.requestNumber} className="compact-list-item">
                      <div>
                        <p className="compact-title">{customerName}</p>
                        <p className="compact-sub">{device}</p>
                      </div>
                      <div className="compact-list-side">
                        <Badge variant="outline" className="compact-badge">{String(request.status || "pending")}</Badge>
                        <small>{timeAgo(request.createdAt)}</small>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
            <Separator />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/admin/repair-requests")}>
              Requests ansehen
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <Bell className="h-4 w-4" />
              Hinweise
            </CardTitle>
            <CardDescription>{dashboardData.notificationMeta.totalCount || dashboardData.notifications.length} Eintraege</CardDescription>
          </CardHeader>
          <CardContent className="compact-panel-content">
            <ScrollArea className="compact-scroll-area">
              <div className="compact-list">
                {dashboardData.notifications.length === 0 && <p className="compact-empty">Keine neuen Hinweise</p>}
                {dashboardData.notifications.slice(0, 8).map((notification: any) => (
                  <div key={notification._id} className="compact-list-item">
                    <div>
                      <p className="compact-title">
                        {notification?.isUrgent ? <AlertCircle className="h-3.5 w-3.5 text-[#c53030]" /> : null}
                        {notification?.title || "Hinweis"}
                      </p>
                      <p className="compact-sub line-clamp-2">{notification?.message || "-"}</p>
                    </div>
                    <div className="compact-list-side">
                      {!notification?.isRead && <Badge className="compact-badge-unread">neu</Badge>}
                      <small>{timeAgo(notification?.createdAt)}</small>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Separator />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/notifications")}>
              Alle Hinweise
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="compact-bottom-grid compact-bottom-grid--3col">
        <Card className="compact-panel compact-panel--messages">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <MessageCircle className="h-4 w-4 compact-messages-icon" />
              Neue Kundennachrichten
            </CardTitle>
            <CardDescription>
              {totalUnreadMessages > 0
                ? <span className="compact-messages-count-label">{totalUnreadMessages} ungelesen</span>
                : "Keine neuen Nachrichten"}
            </CardDescription>
          </CardHeader>
          <CardContent className="compact-panel-content">
            <ScrollArea className="compact-scroll-area">
              <div className="compact-list">
                {customerMessages.length === 0 && (
                  <p className="compact-empty">Keine ungelesenen Kundennachrichten</p>
                )}
                {customerMessages.slice(0, 8).map((msg) => {
                  const label = msg.source === "inspection"
                    ? msg.orderNumber ? `Auftrag #${msg.orderNumber}` : "Auftrag"
                    : msg.requestNumber ? `Anfrage #${msg.requestNumber}` : (msg.deviceType || "Repair Request")
                  const preview = msg.content.length > 60
                    ? `${msg.content.slice(0, 60)}…`
                    : msg.content
                  return (
                    <button
                      key={msg._id}
                      type="button"
                      className="compact-msg-item"
                      onClick={() => navigate(msg.navigateTo)}
                    >
                      <div className="compact-msg-avatar">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </div>
                      <div className="compact-msg-body">
                        <p className="compact-title">{msg.senderName}</p>
                        <p className="compact-sub compact-msg-ref">{label}</p>
                        <p className="compact-sub compact-msg-preview">{preview}</p>
                      </div>
                      <div className="compact-list-side">
                        <Badge className="compact-badge-unread">neu</Badge>
                        <small>{timeAgo(msg.createdAt)}</small>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
            <Separator />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/admin/orders")}>
              Alle Auftraege
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <UserCheck className="h-4 w-4" />
              Team Status
            </CardTitle>
            <CardDescription>{dashboardData.staffStatus.length} aktive Teammitglieder</CardDescription>
          </CardHeader>
          <CardContent className="compact-panel-content">
            <ScrollArea className="compact-scroll-area">
              <div className="compact-list">
                {dashboardData.staffStatus.length === 0 && <p className="compact-empty">Keine Teamdaten</p>}
                {dashboardData.staffStatus.slice(0, 10).map((staff: any) => (
                  <div key={staff._id || staff.email} className="compact-list-item">
                    <div>
                      <p className="compact-title">{toName(staff)}</p>
                      <p className="compact-sub">{staff.currentOrder ? `Aktueller Auftrag: ${staff.currentOrder}` : "Kein aktueller Auftrag"}</p>
                    </div>
                    <div className="compact-list-side">
                      <Badge variant="outline" className="compact-badge">{String(staff.availability || "offline")}</Badge>
                      <span>{Number(staff.utilizationRate || 0)}%</span>
                      <small>{staff.assignedOrders || 0} Auftraege</small>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Separator />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/admin/staff")}>
              Team verwalten
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <Timer className="h-4 w-4" />
              Zugewiesene Auftraege
            </CardTitle>
            <CardDescription>{dashboardData.sectionCounts.assignedOrders || dashboardData.assignedOrders.length} aktive Faelle</CardDescription>
          </CardHeader>
          <CardContent className="compact-panel-content">
            <ScrollArea className="compact-scroll-area">
              <div className="compact-list">
                {dashboardData.assignedOrders.length === 0 && <p className="compact-empty">Keine aktiven Auftraege</p>}
                {dashboardData.assignedOrders.slice(0, 10).map((order: any) => {
                  const assignee = Array.isArray(order.assignedStaff) && order.assignedStaff.length > 0
                    ? order.assignedStaff[0]?.staffName
                    : "Nicht zugewiesen"

                  return (
                    <div key={order._id || order.orderNumber} className="compact-list-item">
                      <div>
                        <p className="compact-title">#{order.orderNumber || "-"}</p>
                        <p className="compact-sub">{assignee}</p>
                      </div>
                      <div className="compact-list-side">
                        <Badge variant="outline" className="compact-badge">{String(order.status || "pending")}</Badge>
                        <span>{formatDurationMinutes(order.totalTimeSpent)}</span>
                        <small>{String(order.priority || "normal")}</small>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
            <Separator />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/admin/orders")}>
              Auftraege oeffnen
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="compact-summary-grid">
        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <TrendingUp className="h-4 w-4" />
              Tages- und Wochenkennzahlen
            </CardTitle>
          </CardHeader>
          <CardContent className="compact-kpi-grid">
            <div>
              <p>Heute Auftraege</p>
              <h4>{today.orders || 0}</h4>
            </div>
            <div>
              <p>Heute Buchungen</p>
              <h4>{today.bookings || 0}</h4>
            </div>
            <div>
              <p>Diese Woche Auftraege</p>
              <h4>{thisWeek.orders || 0}</h4>
            </div>
            <div>
              <p>Wochenumsatz</p>
              <h4>{toCurrency(Number(thisWeek.revenue || 0))}</h4>
            </div>
          </CardContent>
        </Card>

        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <HardDrive className="h-4 w-4" />
              System & Leistung
            </CardTitle>
          </CardHeader>
          <CardContent className="compact-kpi-grid">
            <div>
              <p>Avg. Completion</p>
              <h4>{performance.avgCompletionTime || 0} d</h4>
            </div>
            <div>
              <p>Completion Rate</p>
              <h4>{performance.orderCompletionRate || 0}%</h4>
            </div>
            <div>
              <p>Memory</p>
              <h4>{Math.round(Number(health.memoryUsage || 0))} MB</h4>
            </div>
            <div>
              <p>Uptime</p>
              <h4>{Math.floor(Number(health.uptime || 0) / 3600)} h</h4>
            </div>
          </CardContent>
        </Card>

        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <Settings className="h-4 w-4" />
              Schnellaktionen
            </CardTitle>
          </CardHeader>
          <CardContent className="compact-action-grid">
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/bookings")}><Calendar className="h-3.5 w-3.5" /> Buchungen</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/orders")}><Package className="h-3.5 w-3.5" /> Auftraege</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/users")}><Users className="h-3.5 w-3.5" /> Benutzer</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/analytics")}><BarChart3 className="h-3.5 w-3.5" /> Analytics</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/staff")}><FileText className="h-3.5 w-3.5" /> Team</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/notifications")}><CheckCircle2 className="h-3.5 w-3.5" /> Hinweise</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
