import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ToastAction } from "@/components/ui/toast"
import {
  getAllComplaints,
  type Complaint,
} from "@/api/complaints"
import {
  getFinancialReports,
  getInvoices,
  getPayments,
} from "@/api/financial"
import { formatMoney } from "@/lib/utils"
import {
  getEPartOrders,
} from "@/api/epartOrders"
import {
  Activity,
  AlertCircle,
  BadgeDollarSign,
  ArrowRight,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  HardDrive,
  MessageCircle,
  Package,
  RefreshCw,
  ShoppingCart,
  Settings,
  Timer,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react"
import { getDashboardSummary } from "@/api/adminDashboard"
// Kundennachrichten: dieselbe Quelle und Regel wie das Postfach (/messages).
import { getCommunicationSummary, type InboxItem } from "@/api/messages"
import { getContactMessages, type ContactMessage } from "@/api/contactMessages"
import { markNotificationAsRead } from "@/api/notifications"
import { InactiveRepairsList } from "@/components/admin/InactiveRepairsList"
import "./AdminDashboard.css"

type NotificationMeta = {
  unreadCount: number
  urgentCount: number
  totalCount: number
}

type DashboardKpiKey =
  | "priorityOrders" | "pendingBookings" | "pendingRepairRequests" | "awaitingCustomer"
  | "complaintsOpen" | "complaintsApproval" | "complaintsUrgent"
  | "epartActive" | "epartPending" | "epartDelayed"
  | "openInvoices" | "overdueInvoices" | "paymentsInReview"
type DashboardKpis = Record<DashboardKpiKey, number | null>

// Ziel jedes Zaehlers: die Liste MIT angewendetem Filter (Server: adminDashboardRoutes getDashboardKpis;
// Gruppenregeln Reklamation/EPart: server/utils/listFilterGroups.js, Finanzen: FinancialService
// getOpenReceivables / paymentsInReviewQuery). Zahl = Gesamtzahl der gefilterten Liste.
const KPI_LINKS: Record<DashboardKpiKey, string> = {
  priorityOrders: "/admin/orders?prio=high-urgent",
  pendingBookings: "/admin/bookings?status=pending",
  pendingRepairRequests: "/admin/repair-requests?status=pending",
  awaitingCustomer: "/admin/orders?rueckmeldung=offen",
  complaintsOpen: "/admin/complaints?status=offen",
  complaintsApproval: "/admin/complaints?status=pending_approval",
  complaintsUrgent: "/admin/complaints?status=offen&priority=high-urgent",
  epartActive: "/admin/epart-orders?status=aktiv",
  epartPending: "/admin/epart-orders?status=ausstehend",
  epartDelayed: "/admin/epart-orders?status=verzoegert",
  openInvoices: "/admin/financial?tab=invoices&forderung=offen",
  overdueInvoices: "/admin/financial?tab=invoices&forderung=ueberfaellig",
  paymentsInReview: "/admin/financial?tab=payments&zahlungen=pruefung",
}

const KPI_KEYS = Object.keys(KPI_LINKS) as DashboardKpiKey[]

const EMPTY_KPIS = KPI_KEYS.reduce((acc, key) => ({ ...acc, [key]: null }), {} as DashboardKpis)

const readKpis = (raw: any): DashboardKpis => KPI_KEYS.reduce((acc, key) => {
  const value = raw?.[key]?.count
  return { ...acc, [key]: typeof value === "number" && Number.isFinite(value) ? value : null }
}, {} as DashboardKpis)

// Unbekannter Zaehler: "–" (nie 0 aus einer Teilliste).
const kpiText = (value: number | null) => (value === null ? "–" : String(value))

type SectionCounts = {
  bookings: number
  repairRequests: number
  activities: number
  staffStatus: number
  assignedOrders: number
}

type DashboardOperations = {
  complaints: {
    openCount: number
    approvalQueueCount: number
    urgentCount: number
    items: Complaint[]
  }
  financial: {
    openInvoices: number
    overdueInvoices: number
    pendingPayments: number
    periodRevenue: number
    weekRevenue: number
  }
  epartOrders: {
    openCount: number
    pendingCount: number
    delayedCount: number
    items: any[]
  }
}

interface DashboardData {
  bookings: any[]
  repairRequests: any[]
  notifications: any[]
  activities: any[]
  staffStatus: any[]
  assignedOrders: any[]
  systemOverview: Record<string, any>
  // Serverzaehler je Dashboard-Link (gleiche Regel wie die gefilterte Zielliste); null = unbekannt.
  kpis: DashboardKpis
  notificationMeta: NotificationMeta
  sectionCounts: SectionCounts
}

const FALLBACK_OPERATIONS: DashboardOperations = {
  complaints: {
    openCount: 0,
    approvalQueueCount: 0,
    urgentCount: 0,
    items: [],
  },
  financial: {
    openInvoices: 0,
    overdueInvoices: 0,
    pendingPayments: 0,
    periodRevenue: 0,
    weekRevenue: 0,
  },
  epartOrders: {
    openCount: 0,
    pendingCount: 0,
    delayedCount: 0,
    items: [],
  },
}

const FALLBACK_DATA: DashboardData = {
  bookings: [],
  repairRequests: [],
  notifications: [],
  activities: [],
  staffStatus: [],
  assignedOrders: [],
  systemOverview: {},
  kpis: EMPTY_KPIS,
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

const CORE_REFRESH_INTERVAL_MS = 30_000
const OPERATIONS_REFRESH_INTERVAL_MS = 120_000

const OPEN_CONTACT_STATUSES = new Set(["new", "read"])

const CONTACT_SUBJECT_LABELS: Record<string, string> = {
  repair: "Reparatur",
  status: "Status",
  business: "Business",
  complaint: "Reklamation",
  other: "Sonstiges",
}

const safeArray = (value: unknown) => (Array.isArray(value) ? value : [])
const safeObject = (value: unknown) =>
  typeof value === "object" && value !== null ? (value as Record<string, any>) : {}

const toName = (entity: any, fallback = "Unbekannt") => {
  if (!entity || typeof entity !== "object") return fallback
  if (typeof entity.name === "string" && entity.name.trim()) return entity.name.trim()

  const first = typeof entity.firstName === "string" ? entity.firstName.trim() : ""
  const last = typeof entity.lastName === "string" ? entity.lastName.trim() : ""
  const merged = `${first} ${last}`.trim()
  return merged || fallback
}

// FIN-12/CUSTUX-12: frueher de-CH/CHF fuer EUR-Daten. Jetzt der gemeinsame Formatter
// (lib/utils formatMoney): Waehrung EUR aus den Daten, Format de-DE.
const toCurrency = (value: number) => formatMoney(Number.isFinite(value) ? value : 0, "EUR")

const toEuroCurrency = (value: number) => formatMoney(Number.isFinite(value) ? value : 0, "EUR")

const capitalize = (value?: string) => {
  if (!value) return "Unbekannt"
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const hasUnlockInfoUpdateAction = (notification: any) => {
  const actionType = String(notification?.metadata?.actionType || "").toLowerCase()
  if (actionType === "unlock_info_updated") return true

  const text = `${notification?.title || ""} ${notification?.message || ""}`.toLowerCase()
  return text.includes("entsperr") && text.includes("aktualisiert")
}

const resolveNotificationOrderPath = (notification: any) => {
  if (typeof notification?.actionUrl === "string" && notification.actionUrl.trim()) {
    return notification.actionUrl.trim()
  }
  if (notification?.orderId) {
    return `/orders/${notification.orderId}`
  }
  return ""
}

export function AdminDashboard() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { t } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [dashboardData, setDashboardData] = useState<DashboardData>(FALLBACK_DATA)
  const [operationsData, setOperationsData] = useState<DashboardOperations>(FALLBACK_OPERATIONS)
  const [customerMessages, setCustomerMessages] = useState<InboxItem[]>([])
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0)
  // "Antwort ausstehend" gilt teamweit; "ungelesen" nur fuer den angemeldeten Admin.
  const [awaitingReplyMessages, setAwaitingReplyMessages] = useState(0)
  // Ladefehler wird angezeigt ("–"), nie als 0 Nachrichten.
  const [messagesLoadFailed, setMessagesLoadFailed] = useState(false)
  const [messagesPartial, setMessagesPartial] = useState(false)
  const [openContactRequests, setOpenContactRequests] = useState<ContactMessage[]>([])
  const [unansweredContactCount, setUnansweredContactCount] = useState(0)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  const dashboardDataSignatureRef = useRef<string>("")
  const seenUnlockUpdateIdsRef = useRef<Set<string>>(new Set())
  const isCoreFetchInFlightRef = useRef(false)
  const isOperationsFetchInFlightRef = useRef(false)
  const lastOperationsRefreshAtRef = useRef(0)

  const captureScrollPositions = () => {
    const windowScrollTop = window.scrollY
    const panelScrollTops: number[] = []

    const viewports = document.querySelectorAll<HTMLElement>(".compact-scroll-area [data-radix-scroll-area-viewport]")
    viewports.forEach((viewport) => {
      panelScrollTops.push(viewport.scrollTop)
    })

    return { windowScrollTop, panelScrollTops }
  }

  const restoreScrollPositions = (snapshot: { windowScrollTop: number; panelScrollTops: number[] } | null) => {
    if (!snapshot) return

    window.scrollTo({ top: snapshot.windowScrollTop, left: 0, behavior: "auto" })

    const viewports = document.querySelectorAll<HTMLElement>(".compact-scroll-area [data-radix-scroll-area-viewport]")
    viewports.forEach((viewport, index) => {
      const saved = snapshot.panelScrollTops[index]
      if (typeof saved === "number") {
        viewport.scrollTop = saved
      }
    })
  }

  const removeBookingFromDashboard = (bookingId?: string) => {
    if (!bookingId) return

    setDashboardData((prev) => {
      const nextBookings = prev.bookings.filter((booking: any) => String(booking?._id || "") !== String(bookingId))
      if (nextBookings.length === prev.bookings.length) return prev

      return {
        ...prev,
        bookings: nextBookings,
        sectionCounts: {
          ...prev.sectionCounts,
          bookings: Math.max(0, prev.sectionCounts.bookings - 1),
        },
      }
    })
  }

  const clearBookingsFromDashboard = () => {
    setDashboardData((prev) => ({
      ...prev,
      bookings: [],
      sectionCounts: {
        ...prev.sectionCounts,
        bookings: 0,
      },
    }))
  }

  const removeRepairRequestFromDashboard = (requestId?: string) => {
    if (!requestId) return

    setDashboardData((prev) => {
      const nextRequests = prev.repairRequests.filter((request: any) => String(request?._id || "") !== String(requestId))
      if (nextRequests.length === prev.repairRequests.length) return prev

      return {
        ...prev,
        repairRequests: nextRequests,
        sectionCounts: {
          ...prev.sectionCounts,
          repairRequests: Math.max(0, prev.sectionCounts.repairRequests - 1),
        },
      }
    })
  }

  const clearRepairRequestsFromDashboard = () => {
    setDashboardData((prev) => ({
      ...prev,
      repairRequests: [],
      sectionCounts: {
        ...prev.sectionCounts,
        repairRequests: 0,
      },
    }))
  }

  const clearNotificationsFromDashboard = () => {
    setDashboardData((prev) => ({
      ...prev,
      notifications: [],
      notificationMeta: {
        ...prev.notificationMeta,
        unreadCount: 0,
        urgentCount: 0,
        totalCount: 0,
      },
    }))
  }


  const removeOpenContactRequestFromDashboard = (requestId?: string) => {
    if (!requestId) return

    setOpenContactRequests((prev) => {
      const nextRequests = prev.filter((request) => String(request?._id || "") !== String(requestId))
      if (nextRequests.length === prev.length) return prev
      setUnansweredContactCount((current) => Math.max(0, current - 1))
      return nextRequests
    })
  }

  const clearOpenContactRequestsFromDashboard = () => {
    setOpenContactRequests([])
    setUnansweredContactCount(0)
  }

  const handleNotificationClick = async (notification: any, notificationPath: string) => {
    if (!notificationPath) return

    const notificationId = String(notification?._id || "")
    const isUnread = !notification?.isRead
    const isUrgent = Boolean(notification?.isUrgent)

    if (notificationId && !notification?.isRead) {
      try {
        await markNotificationAsRead(notificationId)
      } catch {
        // Ignore read-sync failures; navigation should still work.
      }
    }

    setDashboardData((prev) => {
      const nextNotifications = prev.notifications.filter((item: any) => String(item?._id || "") !== notificationId)

      const nextUnreadCount = Math.max(0, prev.notificationMeta.unreadCount - (isUnread ? 1 : 0))
      const nextUrgentCount = Math.max(0, prev.notificationMeta.urgentCount - (isUrgent ? 1 : 0))

      return {
        ...prev,
        notifications: nextNotifications,
        notificationMeta: {
          ...prev.notificationMeta,
          unreadCount: nextUnreadCount,
          urgentCount: nextUrgentCount,
          totalCount: Math.max(0, prev.notificationMeta.totalCount - 1),
        },
      }
    })

    navigate(notificationPath)
  }

  const fetchCoreDashboardData = async (showToast = false, silent = true) => {
    if (isCoreFetchInFlightRef.current) {
      return
    }
    isCoreFetchInFlightRef.current = true

    const scrollSnapshot = silent ? captureScrollPositions() : null

    try {
      if (showToast) {
        setRefreshing(true)
      } else if (!hasLoadedOnce && !silent) {
        setLoading(true)
      }

      const [data, msgData, contactData] = await Promise.all([
        getDashboardSummary(),
        getCommunicationSummary(15)
          .then((summary) => ({ ok: true as const, summary }))
          .catch(() => ({ ok: false as const, summary: null })),
        getContactMessages({
          limit: 12,
          page: 1,
          sortBy: "createdAt",
          sortOrder: "desc",
        }),
      ])

      const unresolvedContactMessages = Array.isArray(contactData?.messages)
        ? contactData.messages.filter((message: ContactMessage) => OPEN_CONTACT_STATUSES.has(String(message?.status || "").toLowerCase()))
        : []

      const processedData: DashboardData = {
        bookings: safeArray(data.bookings),
        repairRequests: safeArray(data.repairRequests),
        notifications: safeArray(data.notifications),
        activities: safeArray(data.activities),
        staffStatus: safeArray(data.staffStatus),
        assignedOrders: safeArray(data.assignedOrders),
        systemOverview: safeObject(data.systemOverview),
        kpis: readKpis((data as any).kpis),
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

      const signature = JSON.stringify({
        processedData,
        messagesOk: msgData.ok,
        totalUnread: msgData.summary?.unread ?? null,
        awaitingReply: msgData.summary?.awaitingReply ?? null,
        customerMessageIds: (msgData.summary?.recent || []).map((item) => `${item.key}:${item.unreadCount}:${item.awaitingReply}`),
        unresolvedContactIds: unresolvedContactMessages.map((message: ContactMessage) => message._id),
      })

      const hasChanged = dashboardDataSignatureRef.current !== signature

      if (hasChanged) {
        dashboardDataSignatureRef.current = signature
        setDashboardData(processedData)
        setMessagesLoadFailed(!msgData.ok)
        setMessagesPartial(Boolean(msgData.summary?.partial))
        setCustomerMessages(msgData.summary?.recent || [])
        setTotalUnreadMessages(msgData.summary?.unread || 0)
        setAwaitingReplyMessages(msgData.summary?.awaitingReply || 0)
        setOpenContactRequests(unresolvedContactMessages.slice(0, 5))
        setUnansweredContactCount(unresolvedContactMessages.length)
        setLastUpdatedAt(new Date())
      }

      if (!hasLoadedOnce) {
        setHasLoadedOnce(true)
      }

      if (showToast) {
        toast({
          title: t('adminDashboard.updated'),
          description: `${processedData.bookings.length} ${t('adminDashboard.bookingsLabel')}, ${processedData.repairRequests.length} ${t('adminDashboard.repairRequests')}, ${processedData.notificationMeta.unreadCount} ${t('adminDashboard.unreadNotices')}`,
        })
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('adminDashboard.loadError'),
        description: error?.message || t('adminDashboard.unknownError'),
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
      isCoreFetchInFlightRef.current = false

      if (silent) {
        window.requestAnimationFrame(() => {
          restoreScrollPositions(scrollSnapshot)
          window.requestAnimationFrame(() => {
            restoreScrollPositions(scrollSnapshot)
          })
        })
      }
    }
  }

  const fetchOperationsData = async () => {
    if (isOperationsFetchInFlightRef.current) {
      return
    }
    isOperationsFetchInFlightRef.current = true

    try {
      const [complaintsData, invoicesData, paymentsData, reportData, epartData, weekReportData] = await Promise.all([
        getAllComplaints({
          limit: 20,
          skip: 0,
        }),
        getInvoices({
          limit: 50,
          page: 1,
        }),
        getPayments({
          limit: 50,
          page: 1,
        }),
        getFinancialReports({ period: "month" }),
        getEPartOrders({
          limit: 20,
          page: 1,
        }),
        // FIN-6: Zahlungseingang dieser Woche (ab Montag) aus derselben Berechnung.
        getFinancialReports({ period: "week" }).catch(() => null),
      ])

      const complaintItems = Array.isArray(complaintsData?.complaints) ? complaintsData.complaints : []
      const invoiceItems = Array.isArray(invoicesData?.invoices) ? invoicesData.invoices : []
      const paymentItems = Array.isArray(paymentsData?.payments) ? paymentsData.payments : []
      const epartItems = Array.isArray(epartData?.orders) ? epartData.orders : []

      const openComplaintStatuses = new Set(["pending_approval", "approved", "acknowledged", "new_repair", "open", "in-progress", "pending-customer"])
      const complaintUrgencySet = new Set(["high", "urgent"])
      const now = Date.now()

      const nextOperationsData: DashboardOperations = {
        complaints: {
          openCount: complaintItems.filter((item: Complaint) => openComplaintStatuses.has(String(item?.status || "").toLowerCase())).length,
          approvalQueueCount: complaintItems.filter((item: Complaint) => String(item?.status || "").toLowerCase() === "pending_approval").length,
          urgentCount: complaintItems.filter((item: Complaint) => complaintUrgencySet.has(String(item?.priority || "").toLowerCase())).length,
          items: complaintItems.slice(0, 5),
        },
        financial: {
          // FIN-6: Zaehler serverseitig (alle offenen Rechnungen), nicht aus den ersten 50.
          openInvoices: Number.isFinite(Number(reportData?.report?.openInvoiceCount))
            ? Number(reportData.report.openInvoiceCount)
            : invoiceItems.filter((item: any) => ["draft", "pending_approval", "sent", "viewed", "partially_paid", "overdue"].includes(String(item?.status || "").toLowerCase())).length,
          overdueInvoices: Number.isFinite(Number(reportData?.report?.overdueInvoiceCount))
            ? Number(reportData.report.overdueInvoiceCount)
            : invoiceItems.filter((item: any) => String(item?.status || "").toLowerCase() === "overdue").length,
          // Serverseitig gezaehlt (ohne abgebrochene PayPal-Checkouts); Liste nur als Rueckfall.
          pendingPayments: Number.isFinite(Number(reportData?.report?.paymentsInReviewCount))
            ? Number(reportData.report.paymentsInReviewCount)
            : paymentItems.filter((item: any) => ["pending", "processing", "disputed"].includes(String(item?.status || "").toLowerCase())).length,
          periodRevenue: Number(reportData?.report?.collectedGross ?? reportData?.report?.totalRevenue ?? 0),
          weekRevenue: Number(weekReportData?.report?.collectedGross ?? weekReportData?.report?.totalRevenue ?? 0),
        },
        epartOrders: {
          openCount: epartItems.filter((item: any) => !["received", "cancelled"].includes(String(item?.status || "").toLowerCase())).length,
          pendingCount: epartItems.filter((item: any) => ["draft", "pending", "confirmed"].includes(String(item?.status || "").toLowerCase())).length,
          delayedCount: epartItems.filter((item: any) => {
            const status = String(item?.status || "").toLowerCase()
            const expectedTime = item?.expectedDeliveryDate ? new Date(item.expectedDeliveryDate).getTime() : NaN
            return !["received", "cancelled"].includes(status) && Number.isFinite(expectedTime) && expectedTime < now
          }).length,
          items: epartItems.slice(0, 5),
        },
      }

      setOperationsData(nextOperationsData)
      lastOperationsRefreshAtRef.current = Date.now()
    } catch (error) {
      // Non-blocking section: keep last good snapshot if a refresh fails.
      console.error("AdminDashboard: operations refresh failed", error)
    } finally {
      isOperationsFetchInFlightRef.current = false
    }
  }

  const fetchDashboardData = async (showToast = false, silent = true) => {
    await Promise.all([
      fetchCoreDashboardData(showToast, silent),
      fetchOperationsData(),
    ])
  }

  useEffect(() => {
    fetchDashboardData(false, false)

    const coreInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchCoreDashboardData(false, true)
      }
    }, CORE_REFRESH_INTERVAL_MS)

    const operationsInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchOperationsData()
      }
    }, OPERATIONS_REFRESH_INTERVAL_MS)

    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") {
        fetchCoreDashboardData(false, true)
        if (Date.now() - lastOperationsRefreshAtRef.current >= CORE_REFRESH_INTERVAL_MS) {
          fetchOperationsData()
        }
      }
    }

    window.addEventListener("focus", refreshOnFocus)
    window.addEventListener("online", refreshOnFocus)
    document.addEventListener("visibilitychange", refreshOnFocus)

    return () => {
      clearInterval(coreInterval)
      clearInterval(operationsInterval)
      window.removeEventListener("focus", refreshOnFocus)
      window.removeEventListener("online", refreshOnFocus)
      document.removeEventListener("visibilitychange", refreshOnFocus)
    }
  }, [])

  useEffect(() => {
    const unlockNotifications = dashboardData.notifications.filter((notification: any) =>
      hasUnlockInfoUpdateAction(notification)
    )

    if (unlockNotifications.length === 0) return

    if (seenUnlockUpdateIdsRef.current.size === 0) {
      unlockNotifications.forEach((notification: any) => {
        if (notification?._id) {
          seenUnlockUpdateIdsRef.current.add(String(notification._id))
        }
      })
      return
    }

    const newestUnseen = unlockNotifications.find((notification: any) => {
      const id = String(notification?._id || "")
      return id && !seenUnlockUpdateIdsRef.current.has(id)
    })

    unlockNotifications.forEach((notification: any) => {
      if (notification?._id) {
        seenUnlockUpdateIdsRef.current.add(String(notification._id))
      }
    })

    if (!newestUnseen) return

    const orderPath = resolveNotificationOrderPath(newestUnseen)
    const orderLabel = newestUnseen?.orderNumber
      ? `#${newestUnseen.orderNumber}`
      : t('adminDashboard.thisOrder', { defaultValue: 'diesen Auftrag' })

    toast({
      title: t('adminDashboard.unlockInfoResponseTitle', { defaultValue: 'Neue Antwort zu Entsperrinformation' }),
      description: t('adminDashboard.unlockInfoResponseDescription', {
        defaultValue: `Die Kund:innen-Antwort ist eingegangen (${orderLabel}).`,
      }),
      action: orderPath ? (
        <ToastAction altText={t('adminDashboard.openOrder', { defaultValue: 'Auftrag öffnen' })} onClick={() => navigate(orderPath)}>
          {t('adminDashboard.openOrder', { defaultValue: 'Auftrag öffnen' })}
        </ToastAction>
      ) : undefined,
    })
  }, [dashboardData.notifications, navigate, t, toast])

  const systemOverview = dashboardData.systemOverview
  const counts = safeObject(systemOverview.counts)
  const today = safeObject(systemOverview.today)
  const thisWeek = safeObject(systemOverview.thisWeek)
  const performance = safeObject(systemOverview.performance)
  const health = safeObject(systemOverview.systemHealth)

  // Prioritätsaufträge, offene Buchungen und ausstehende Reparaturanfragen kommen als Serverzähler
  // (dashboardData.kpis) - früher aus den 10 zugewiesenen Aufträgen bzw. 5 neuesten Einträgen gezählt.
  const derived = useMemo(() => {
    const overloadedStaff = dashboardData.staffStatus.filter((staff) => Number(staff?.utilizationRate || 0) >= 85).length

    return {
      overloadedStaff,
    }
  }, [dashboardData])
  const kpis = dashboardData.kpis || EMPTY_KPIS

  // Kachel mit Serverzahl; Klick öffnet die Liste mit genau diesem Filter (KPI_LINKS).
  const renderKpiTile = (label: string, key: DashboardKpiKey) => (
    <div key={key}>
      <button
        type="button"
        onClick={() => navigate(KPI_LINKS[key])}
        className="w-full text-left"
        style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
        aria-label={`${label}: ${kpiText(kpis[key])} – gefilterte Liste öffnen`}
      >
        <p>{label}</p>
        <h4>{kpiText(kpis[key])}</h4>
      </button>
    </div>
  )

  const timeAgo = (date?: string | Date) => {
    if (!date) return "-"
    const then = new Date(date).getTime()
    if (!Number.isFinite(then)) return "-"

    const diff = Date.now() - then
    const min = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (min < 1) return t('adminDashboard.justNow')
    if (min < 60) return t('adminDashboard.minutesAgo', { count: min })
    if (hours < 24) return t('adminDashboard.hoursAgo', { count: hours })
    return t('adminDashboard.daysAgo', { count: days })
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
        <p>{t('adminDashboard.loading')}</p>
      </div>
    )
  }

  return (
    <div className="admin-dashboard-container compact-dashboard">
      <div className="admin-dashboard-header compact-header">
        <div className="compact-header-main">
          <h1>{t('adminDashboard.title')}</h1>
          <p>{t('adminDashboard.description')}</p>
        </div>

        <div className="compact-header-meta">
          <Badge variant="outline" className="compact-badge-muted">
            {t('adminDashboard.lastUpdate')}: {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString() : "-"}
          </Badge>
          <Badge variant="outline" className="compact-badge-muted">
            {t('adminDashboard.autoRefresh')}
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
            {t('common.export')}
          </Button>

          <Button size="sm" variant="outline" onClick={() => fetchDashboardData(true)} disabled={refreshing} className="compact-btn-light">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      <div className="compact-stats-grid">
        <Card className="compact-stat-card">
          <CardContent className="compact-stat-content">
            <div>
              <p>{t('adminDashboard.totalOrders')}</p>
              <h3>{counts.totalOrders || 0}</h3>
              <small>{counts.activeOrders || 0} {t('adminDashboard.active')}</small>
            </div>
            <Package className="h-4 w-4" />
          </CardContent>
        </Card>

        <Card className="compact-stat-card">
          <CardContent className="compact-stat-content">
            <div>
              <p>{t('adminDashboard.customers')}</p>
              <h3>{counts.totalUsers || 0}</h3>
              <small>{counts.activeStaff || 0} {t('adminDashboard.teamActive')}</small>
            </div>
            <Users className="h-4 w-4" />
          </CardContent>
        </Card>

        <Card className="compact-stat-card">
          <CardContent className="compact-stat-content">
            <div>
              <p>{t('adminDashboard.messagesLabel')}</p>
              <h3 title={messagesLoadFailed ? "Nachrichten konnten nicht geladen werden" : undefined}>{messagesLoadFailed ? "–" : totalUnreadMessages}</h3>
              <small>
                {messagesLoadFailed
                  ? "Konnte nicht geladen werden"
                  : `ungelesen (Sie) · ${awaitingReplyMessages} Antwort ausstehend (Team)`}
              </small>
            </div>
            <MessageCircle className="h-4 w-4" />
          </CardContent>
        </Card>

        <Card className="compact-stat-card">
          <CardContent className="compact-stat-content">
            <div>
              <p>{t('adminDashboard.unread')}</p>
              <h3>{dashboardData.notificationMeta.unreadCount}</h3>
              <small>{dashboardData.notificationMeta.urgentCount} {t('adminDashboard.urgent')}</small>
            </div>
            <Bell className="h-4 w-4" />
          </CardContent>
        </Card>

        <Card className="compact-stat-card">
          <CardContent className="compact-stat-content">
            <div>
              <p>{t('adminDashboard.system')}</p>
              <h3>{capitalize(String(health.status || t('adminDashboard.healthy')))}</h3>
              <small>{t('adminDashboard.databaseShort')}: {capitalize(String(health.dbConnection || t('adminDashboard.connected')))}</small>
            </div>
            <Activity className="h-4 w-4" />
          </CardContent>
        </Card>
      </div>

      <div className="compact-alert-bar">
        <button type="button" onClick={() => navigate("/notifications")}>{t('adminDashboard.urgentNotices')}: <strong>{dashboardData.notificationMeta.urgentCount}</strong></button>
        <button type="button" onClick={() => navigate(KPI_LINKS.priorityOrders)}>{t('adminDashboard.priorityOrders')}: <strong>{kpiText(kpis.priorityOrders)}</strong></button>
        <button type="button" onClick={() => navigate("/admin/staff")}>{t('adminDashboard.teamOverload')}: <strong>{derived.overloadedStaff}</strong></button>
        <button type="button" onClick={() => navigate(KPI_LINKS.pendingBookings)}>{t('adminDashboard.openBookings')}: <strong>{kpiText(kpis.pendingBookings)}</strong></button>
        <button type="button" onClick={() => navigate(KPI_LINKS.awaitingCustomer)}>Warten auf Kundenrückmeldung: <strong>{kpiText(kpis.awaitingCustomer)}</strong></button>
        {!messagesLoadFailed && totalUnreadMessages > 0 && (
          <button type="button" className="compact-alert-messages" onClick={() => navigate("/messages?filter=unread")}>{t('adminDashboard.newCustomerMessages')}: <strong>{totalUnreadMessages}</strong></button>
        )}
        {!messagesLoadFailed && awaitingReplyMessages > 0 && (
          <button type="button" className="compact-alert-messages" onClick={() => navigate("/messages?filter=awaiting_reply")}>Antwort ausstehend: <strong>{awaitingReplyMessages}</strong></button>
        )}
      </div>

      <div className="compact-main-grid">
        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <Calendar className="h-4 w-4" />
              {t('adminDashboard.newBookings')}
            </CardTitle>
            <CardDescription>{dashboardData.sectionCounts.bookings || dashboardData.bookings.length} {t('adminDashboard.entries')}</CardDescription>
          </CardHeader>
          <CardContent className="compact-panel-content">
            <ScrollArea className="compact-scroll-area">
              <div className="compact-list">
                {dashboardData.bookings.length === 0 && <p className="compact-empty">{t('adminDashboard.noBookings')}</p>}
                {dashboardData.bookings.slice(0, 6).map((booking: any) => {
                  const customerName = toName(booking.customer)
                  const amount = Number(booking.totalCost ?? booking.totalAmount ?? 0)
                  const bookingId = booking.bookingNumber || booking._id?.slice(-6) || "-"
                  return (
                    <button
                      key={booking._id || bookingId}
                      type="button"
                      className="compact-list-item compact-list-item-button"
                      onClick={() => {
                        if (!booking?._id) return
                        removeBookingFromDashboard(booking._id)
                        navigate(`/admin/bookings?highlightBookingId=${booking._id}`)
                      }}
                    >
                      <div>
                        <p className="compact-title">{customerName}</p>
                        <p className="compact-sub">#{bookingId}</p>
                      </div>
                      <div className="compact-list-side">
                        <Badge variant="outline" className="compact-badge">{String(booking.status || t('adminDashboard.unknown'))}</Badge>
                        <span>{toEuroCurrency(amount)}</span>
                        <small>{timeAgo(booking.createdAt || booking.bookingTime)}</small>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
            <Separator />
            <Button size="sm" variant="outline" className="w-full" onClick={() => {
              clearBookingsFromDashboard()
              navigate("/admin/bookings")
            }}>
              {t('adminDashboard.manageBookings')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <Wrench className="h-4 w-4" />
              {t('adminDashboard.repairRequests')}
            </CardTitle>
            <CardDescription>
              <button
                type="button"
                className="underline-offset-2 hover:underline"
                onClick={() => navigate(KPI_LINKS.pendingRepairRequests)}
                title="Reparaturanfragen mit Status „Ausstehend“ öffnen"
              >
                {kpiText(kpis.pendingRepairRequests)} ausstehend
              </button>
            </CardDescription>
          </CardHeader>
          <CardContent className="compact-panel-content">
            <ScrollArea className="compact-scroll-area">
              <div className="compact-list">
                {dashboardData.repairRequests.length === 0 && <p className="compact-empty">{t('adminDashboard.noRepairRequests')}</p>}
                {dashboardData.repairRequests.slice(0, 6).map((request: any) => {
                  const customerName = toName(request.customer)
                  const device = request.device
                    ? `${request.device.brand || ""} ${request.device.model || ""}`.trim() || request.device.type || t('adminDashboard.unknownDevice')
                    : request.deviceType || t('adminDashboard.unknownDevice')

                  return (
                    <button
                      key={request._id || request.requestNumber}
                      type="button"
                      className="compact-list-item compact-list-item-button"
                      onClick={() => {
                        removeRepairRequestFromDashboard(request._id)
                        navigate(`/admin/repair-requests?tab=repair-requests&requestId=${request._id}`)
                      }}
                    >
                      <div>
                        <p className="compact-title">{customerName}</p>
                        <p className="compact-sub">{device}</p>
                      </div>
                      <div className="compact-list-side">
                        <Badge variant="outline" className="compact-badge">{String(request.status || "pending")}</Badge>
                        <small>{timeAgo(request.createdAt)}</small>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
            <Separator />
            <Button size="sm" variant="outline" className="w-full" onClick={() => {
              clearRepairRequestsFromDashboard()
              navigate("/admin/repair-requests")
            }}>
              {t('adminDashboard.viewRequests')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <Bell className="h-4 w-4" />
              {t('adminDashboard.notices')}
            </CardTitle>
            <CardDescription>{dashboardData.notificationMeta.totalCount || dashboardData.notifications.length} {t('adminDashboard.entries')}</CardDescription>
          </CardHeader>
          <CardContent className="compact-panel-content">
            <ScrollArea className="compact-scroll-area">
              <div className="compact-list">
                {dashboardData.notifications.length === 0 && <p className="compact-empty">{t('adminDashboard.noNotices')}</p>}
                {dashboardData.notifications.slice(0, 8).map((notification: any) => {
                  const isUnlockUpdate = hasUnlockInfoUpdateAction(notification)
                  const notificationPath = resolveNotificationOrderPath(notification)
                  const clickable = Boolean(notificationPath)

                  const itemContent = (
                    <>
                    <div>
                      <p className="compact-title">
                        {notification?.isUrgent ? <AlertCircle className="h-3.5 w-3.5 text-[#c53030]" /> : null}
                        {notification?.title || t('adminDashboard.notice')}
                      </p>
                      <p className="compact-sub line-clamp-2">{notification?.message || "-"}</p>
                    </div>
                    <div className="compact-list-side">
                      {isUnlockUpdate && (
                        <Badge className="compact-badge-unread">{t('adminDashboard.unlockInfoBadge', { defaultValue: 'Neue Entsperrinformationen eingegangen' })}</Badge>
                      )}
                      {!notification?.isRead && <Badge className="compact-badge-unread">{t('common.new')}</Badge>}
                      <small>{timeAgo(notification?.createdAt)}</small>
                    </div>
                    </>
                  )

                  if (!clickable) {
                    return (
                      <div key={notification._id} className="compact-list-item">
                        {itemContent}
                      </div>
                    )
                  }

                  return (
                    <button
                      key={notification._id}
                      type="button"
                      className="compact-list-item compact-list-item-button"
                      onClick={() => handleNotificationClick(notification, notificationPath)}
                    >
                      {itemContent}
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
            <Separator />
            <Button size="sm" variant="outline" className="w-full" onClick={() => {
              clearNotificationsFromDashboard()
              navigate("/notifications")
            }}>
              {t('adminDashboard.allNotices')}
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
              {t('adminDashboard.newCustomerMessages')}
            </CardTitle>
            <CardDescription>
              {messagesLoadFailed
                ? <span role="alert">Nachrichten konnten nicht geladen werden.</span>
                : <span className="compact-messages-count-label">{totalUnreadMessages} ungelesen (Sie) · {awaitingReplyMessages} Antwort ausstehend (Team)</span>}
            </CardDescription>
          </CardHeader>
          <CardContent className="compact-panel-content">
            <ScrollArea className="compact-scroll-area">
              <div className="compact-list">
                {messagesLoadFailed && (
                  <div className="compact-empty" role="alert">
                    <p>Nachrichten konnten nicht geladen werden.</p>
                    <Button size="sm" variant="outline" onClick={() => fetchDashboardData()}>Erneut versuchen</Button>
                  </div>
                )}
                {!messagesLoadFailed && messagesPartial && (
                  <p className="compact-sub" role="alert">Nicht alle Quellen konnten geladen werden – Details im Postfach.</p>
                )}
                {!messagesLoadFailed && customerMessages.length === 0 && (
                  <p className="compact-empty">Keine ungelesenen oder offenen Kundengespräche.</p>
                )}
                {customerMessages.slice(0, 8).map((item) => {
                  const preview = (item.lastMessage?.preview || "").length > 60
                    ? `${(item.lastMessage?.preview || "").slice(0, 60)}…`
                    : (item.lastMessage?.preview || "")
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className="compact-msg-item"
                      onClick={() => navigate(item.threadUrl)}
                      title="Gespräch im Postfach öffnen"
                    >
                      <div className="compact-msg-avatar">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </div>
                      <div className="compact-msg-body">
                        <p className="compact-title">{item.customer?.name || item.lastMessage?.senderName || "Kunde"}</p>
                        <p className="compact-sub compact-msg-ref">{item.sourceLabel}: {item.title}</p>
                        <p className="compact-sub compact-msg-preview">{preview}</p>
                      </div>
                      <div className="compact-list-side">
                        {item.unreadCount > 0 && <Badge className="compact-badge-unread">{item.unreadCount} neu</Badge>}
                        {item.awaitingReply && <Badge variant="outline">Antwort ausstehend</Badge>}
                        <small>{timeAgo(item.lastMessage?.createdAt || item.lastActivityAt || "")}</small>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>

            <div className="compact-nested-contact">
              <div className="compact-nested-contact-head">
                <p>
                  <MessageCircle className="h-3 w-3" />
                  <span>{t('adminDashboard.contactRequestsOpen')}</span>
                </p>
                <Badge variant="outline" className="compact-badge compact-nested-contact-count">
                  {unansweredContactCount}
                </Badge>
              </div>

              {openContactRequests.length === 0 ? (
                <p className="compact-empty compact-nested-empty">{t('adminDashboard.noOpenContactRequests')}</p>
              ) : (
                <div className="compact-nested-contact-list">
                  {openContactRequests.map((request) => (
                    <button
                      key={request._id}
                      type="button"
                      className="compact-nested-contact-item"
                      onClick={() => {
                        removeOpenContactRequestFromDashboard(request._id)
                        navigate(`/admin/contact-requests?messageId=${request._id}`)
                      }}
                    >
                      <div>
                        <p className="compact-title compact-nested-title">
                          <Users className="h-3 w-3" />
                          <span>{request.name}</span>
                        </p>
                        <p className="compact-sub">{CONTACT_SUBJECT_LABELS[request.subject] || request.subject}</p>
                      </div>
                      <div className="compact-list-side">
                        <Badge className="compact-badge-unread">{t('adminDashboard.open')}</Badge>
                        <small>{timeAgo(request.createdAt)}</small>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  clearOpenContactRequestsFromDashboard()
                  navigate("/admin/contact-requests")
                }}
              >
                {t('adminDashboard.allContactRequests')}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <Separator />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/messages")}>
              Alle Nachrichten im Postfach
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <UserCheck className="h-4 w-4" />
              {t('adminDashboard.teamStatus')}
            </CardTitle>
            <CardDescription>{dashboardData.staffStatus.length} {t('adminDashboard.activeTeamMembers')}</CardDescription>
          </CardHeader>
          <CardContent className="compact-panel-content">
            <ScrollArea className="compact-scroll-area">
              <div className="compact-list">
                {dashboardData.staffStatus.length === 0 && <p className="compact-empty">{t('adminDashboard.noTeamData')}</p>}
                {dashboardData.staffStatus.slice(0, 10).map((staff: any) => (
                  <div key={staff._id || staff.email} className="compact-list-item">
                    <div>
                      <p className="compact-title">{toName(staff)}</p>
                      <p className="compact-sub">{staff.currentOrder ? `${t('adminDashboard.currentOrder')}: ${staff.currentOrder}` : t('adminDashboard.noCurrentOrder')}</p>
                    </div>
                    <div className="compact-list-side">
                        <Badge variant="outline" className="compact-badge">{String(staff.availability || t('adminDashboard.offline'))}</Badge>
                      <span>{Number(staff.utilizationRate || 0)}%</span>
                      <small>{staff.assignedOrders || 0} {t('adminDashboard.ordersLabel')}</small>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Separator />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/admin/staff")}>
              {t('adminDashboard.manageTeam')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <Timer className="h-4 w-4" />
              {t('adminDashboard.assignedOrders')}
            </CardTitle>
            <CardDescription>{dashboardData.sectionCounts.assignedOrders || dashboardData.assignedOrders.length} {t('adminDashboard.activeCases')}</CardDescription>
          </CardHeader>
          <CardContent className="compact-panel-content">
            <ScrollArea className="compact-scroll-area">
              <div className="compact-list">
                {dashboardData.assignedOrders.length === 0 && <p className="compact-empty">{t('adminDashboard.noActiveOrders')}</p>}
                {dashboardData.assignedOrders.slice(0, 10).map((order: any) => {
                  const assignee = Array.isArray(order.assignedStaff) && order.assignedStaff.length > 0
                    ? order.assignedStaff[0]?.staffName
                    : t('adminDashboard.notAssigned')

                  return (
                    <div key={order._id || order.orderNumber} className="compact-list-item">
                      <div>
                        <p className="compact-title">#{order.orderNumber || "-"}</p>
                        <p className="compact-sub">{assignee}</p>
                      </div>
                      <div className="compact-list-side">
                        <Badge variant="outline" className="compact-badge">{String(order.status || t('adminDashboard.pending'))}</Badge>
                        <span>{formatDurationMinutes(order.totalTimeSpent)}</span>
                        <small>{String(order.priority || t('adminDashboard.normal'))}</small>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
            <Separator />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/admin/orders")}>
              {t('adminDashboard.openOrders')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="compact-repair-monitoring">
        <InactiveRepairsList />
      </div>

      <div className="compact-ops-grid">
        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <ClipboardList className="h-4 w-4" />
              {t('adminDashboard.complaintsTitle')}
            </CardTitle>
            <CardDescription>{kpiText(kpis.complaintsOpen)} {t('adminDashboard.open')}</CardDescription>
          </CardHeader>
          <CardContent className="compact-panel-content">
            <div className="compact-kpi-grid compact-kpi-grid--3">
              {renderKpiTile(t('adminDashboard.approvals'), "complaintsApproval")}
              {/* Dringend = offen UND Priorität hoch/dringend */}
              {renderKpiTile(t('adminDashboard.urgent'), "complaintsUrgent")}
              {renderKpiTile(t('adminDashboard.openTotal'), "complaintsOpen")}
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/admin/complaints")}>
              {t('adminDashboard.goToComplaints')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <Wallet className="h-4 w-4" />
              {t('adminDashboard.financialTitle')}
            </CardTitle>
            <CardDescription>Zahlungseingang diesen Monat (brutto): {toCurrency(operationsData.financial.periodRevenue)}</CardDescription>
          </CardHeader>
          <CardContent className="compact-panel-content">
            <div className="compact-kpi-grid compact-kpi-grid--3">
              {renderKpiTile(t('adminDashboard.openInvoices'), "openInvoices")}
              {renderKpiTile(t('adminDashboard.overdue'), "overdueInvoices")}
              {renderKpiTile("Zahlungen in Prüfung", "paymentsInReview")}
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/admin/financial")}>
              {t('adminDashboard.goToFinancial')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <ShoppingCart className="h-4 w-4" />
              {t('adminDashboard.epartTitle')}
            </CardTitle>
            <CardDescription>{kpiText(kpis.epartActive)} {t('adminDashboard.active')}</CardDescription>
          </CardHeader>
          <CardContent className="compact-panel-content">
            <div className="compact-kpi-grid compact-kpi-grid--3">
              {renderKpiTile(t('adminDashboard.pending'), "epartPending")}
              {renderKpiTile(t('adminDashboard.delayed'), "epartDelayed")}
              {renderKpiTile(t('adminDashboard.openTotal'), "epartActive")}
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/admin/epart-orders")}>
              {t('adminDashboard.goToEpart')}
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
              {t('adminDashboard.dailyWeeklyKpis')}
            </CardTitle>
          </CardHeader>
          <CardContent className="compact-kpi-grid">
            <div>
              <p>{t('adminDashboard.todayOrders')}</p>
              <h4>{today.orders || 0}</h4>
            </div>
            <div>
              <p>{t('adminDashboard.todayBookings')}</p>
              <h4>{today.bookings || 0}</h4>
            </div>
            <div>
              <p>{t('adminDashboard.weekOrders')}</p>
              <h4>{thisWeek.orders || 0}</h4>
            </div>
            <div>
              <p>Zahlungseingang diese Woche (brutto)</p>
              <h4>{toCurrency(Number(operationsData.financial.weekRevenue || 0))}</h4>
            </div>
          </CardContent>
        </Card>

        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <HardDrive className="h-4 w-4" />
              {t('adminDashboard.systemPerformance')}
            </CardTitle>
          </CardHeader>
          <CardContent className="compact-kpi-grid">
            <div>
              <p>{t('adminDashboard.avgCompletion')}</p>
              <h4>{performance.avgCompletionTime || 0} d</h4>
            </div>
            <div>
              <p>{t('adminDashboard.completionRate')}</p>
              <h4>{performance.orderCompletionRate || 0}%</h4>
            </div>
            <div>
              <p>{t('adminDashboard.memory')}</p>
              <h4>{Math.round(Number(health.memoryUsage || 0))} MB</h4>
            </div>
            <div>
              <p>{t('adminDashboard.uptime')}</p>
              <h4>{Math.floor(Number(health.uptime || 0) / 3600)} h</h4>
            </div>
          </CardContent>
        </Card>

        <Card className="compact-panel">
          <CardHeader className="compact-panel-header">
            <CardTitle>
              <Settings className="h-4 w-4" />
              {t('adminDashboard.quickNavigationTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="compact-action-grid">
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/bookings")}><Calendar className="h-3.5 w-3.5" /> {t('navigation.bookings')}</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/orders")}><Package className="h-3.5 w-3.5" /> {t('navigation.orders')}</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/repair-requests")}><Wrench className="h-3.5 w-3.5" /> {t('adminDashboard.repairRequests')}</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/complaints")}><ClipboardList className="h-3.5 w-3.5" /> {t('adminDashboard.complaintsTitle')}</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/financial")}><BadgeDollarSign className="h-3.5 w-3.5" /> {t('adminDashboard.finances')}</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/epart-orders")}><ShoppingCart className="h-3.5 w-3.5" /> {t('adminDashboard.epartOrders')}</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/users")}><Users className="h-3.5 w-3.5" /> {t('adminDashboard.users')}</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/customer-groups")}><Users className="h-3.5 w-3.5" /> {t('adminDashboard.customerGroups')}</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/analytics")}><BarChart3 className="h-3.5 w-3.5" /> {t('analyticsPage.title')}</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/staff")}><FileText className="h-3.5 w-3.5" /> {t('adminDashboard.team')}</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/live-tracking")}><Activity className="h-3.5 w-3.5" /> {t('adminDashboard.liveTracking')}</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/workflow")}><Timer className="h-3.5 w-3.5" /> {t('adminDashboard.workflow')}</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/notifications")}><CheckCircle2 className="h-3.5 w-3.5" /> {t('adminDashboard.notices')}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
