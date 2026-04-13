import { useEffect, useMemo, useState } from "react"
import { useTranslation } from 'react-i18next'
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coffee,
  Loader2,
  LogIn,
  LogOut,
  Package,
  Play,
  RefreshCw,
  Settings,
  Timer,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react"
import { getAdminOrders, getAssignedOrders } from "@/api/adminOrders"
import { getNotifications } from "@/api/notifications"
import { getRepairRequests } from "@/api/repairRequests"
import { getStaffMembers } from "@/api/staff"
import { getTeamChatRooms } from "@/api/teamChat"
import {
  getCurrentStatus,
  getTimeTrackingSummary,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  type CurrentStatus,
  type TimeTrackingSummary,
} from "@/api/timeTracking"
import { TimeTrackingBreakdown } from "@/components/staff/TimeTrackingBreakdown"
import "./StaffDashboard.css"

const safeArray = (v: unknown) => (Array.isArray(v) ? v : [])

const toId = (value: any): string => {
  if (!value) return ""
  if (typeof value === "string") return value
  if (typeof value === "object" && value._id) return String(value._id)
  return String(value)
}

const isAssignedToStaff = (entity: any, staffId?: string) => {
  if (!staffId || !entity) return false
  const assignedId =
    entity?.assignedStaff?.id ??
    entity?.assignedStaff?.staffId?._id ??
    entity?.assignedStaff?.staffId ??
    entity?.assignedStaffId?._id ??
    entity?.assignedStaffId ??
    entity?.assignedTo?._id ??
    entity?.assignedTo
  return toId(assignedId) === String(staffId)
}

const isUnassignedRepairRequest = (entity: any) => {
  if (!entity) return true
  const assignedId =
    entity?.assignedStaff?.id ??
    entity?.assignedStaff?.staffId?._id ??
    entity?.assignedStaff?.staffId ??
    entity?.assignedStaffId?._id ??
    entity?.assignedStaffId ??
    entity?.assignedTo?._id ??
    entity?.assignedTo
  return !toId(assignedId)
}

const hasOrderStaffAssignment = (order: any) => {
  if (!order || typeof order !== "object") return false
  if (typeof order.hasAssignedStaff === "boolean") return order.hasAssignedStaff
  if (order.assignedStaffId || order.assignedTo) return true
  if (Array.isArray(order.assignedStaff) && order.assignedStaff.length > 0) {
    return order.assignedStaff.some((staff: any) =>
      Boolean(toId(staff?.staffId ?? staff?._id ?? staff?.id ?? staff))
    )
  }
  return false
}

const toName = (entity: any, fallback = "Unbekannt") => {
  if (!entity || typeof entity !== "object") return fallback
  if (typeof entity.name === "string" && entity.name.trim()) return entity.name.trim()
  const first = typeof entity.firstName === "string" ? entity.firstName.trim() : ""
  const last = typeof entity.lastName === "string" ? entity.lastName.trim() : ""
  return `${first} ${last}`.trim() || fallback
}

const capitalize = (v?: string) => {
  if (!v) return "–"
  return v.charAt(0).toUpperCase() + v.slice(1)
}

const timeStatusInfo = (s?: string) => {
  switch (s) {
    case "online":   return { label: "staffDashboard.timeStatusOnline",   cls: "online" }
    case "working":  return { label: "staffDashboard.timeStatusWorking",  cls: "working" }
    case "on_break": return { label: "staffDashboard.timeStatusBreak",    cls: "break" }
    default:         return { label: "staffDashboard.timeStatusOffline",  cls: "offline" }
  }
}

const fmtHours = (h?: number) => {
  if (!h || !Number.isFinite(h)) return "0h"
  const hr  = Math.floor(h)
  const min = Math.round((h - hr) * 60)
  return min > 0 ? `${hr}h ${min}m` : `${hr}h`
}

const toDateInputValue = (value?: string | Date | null) => {
  const date = value ? new Date(value) : new Date()
  if (!Number.isFinite(date.getTime())) return new Date().toISOString().slice(0, 10)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const timeAgo = (t: any, date?: string | Date) => {
  if (!date) return "–"
  const then = new Date(date).getTime()
  if (!Number.isFinite(then)) return "–"
  const diff = Date.now() - then
  const min = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (min < 1) return t('staffDashboard.justNow')
  if (min < 60) return t('staffDashboard.minutesAgo', { count: min })
  if (hours < 24) return t('staffDashboard.hoursAgo', { count: hours })
  return t('staffDashboard.daysAgo', { count: days })
}

const toTimestamp = (value?: string | Date | null) => {
  if (!value) return 0
  const ts = new Date(value).getTime()
  return Number.isFinite(ts) ? ts : 0
}

const isRecent = (value?: string | Date | null, hours = 72) => {
  const ts = toTimestamp(value)
  if (!ts) return false
  return Date.now() - ts <= hours * 60 * 60 * 1000
}

const isNotificationRead = (notification: any) => Boolean(notification?.isRead || notification?.read)

const formatDateLabel = (value?: string | Date | null) => {
  const ts = toTimestamp(value)
  if (!ts) return "–"
  return new Date(ts).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const getOrderAssignmentDate = (order: any, staffId?: string) => {
  if (!order) return undefined
  if (Array.isArray(order.assignedStaff) && staffId) {
    const match = order.assignedStaff.find((staff: any) =>
      toId(staff?.staffId ?? staff?._id ?? staff?.id ?? staff) === String(staffId)
    )
    if (match?.assignedAt) return match.assignedAt
  }
  return order?.assignedAt || order?.updatedAt || order?.createdAt
}

const isOpenStatus = (status?: string) => {
  const value = String(status || "").toLowerCase()
  return !["completed", "done", "cancelled", "canceled", "resolved", "closed"].includes(value)
}

const getDeadlineState = (value?: string | Date | null) => {
  const ts = toTimestamp(value)
  if (!ts) return { isOverdue: false, isDueSoon: false }
  const diff = ts - Date.now()
  return {
    isOverdue: diff < 0,
    isDueSoon: diff >= 0 && diff <= 48 * 60 * 60 * 1000,
  }
}

const listPreview = (items: string[], limit = 2) => items.slice(0, limit).join(", ")

const normalizeWorkflowStatus = (status?: string) => {
  const value = String(status || "").toLowerCase()
  if (value === "in_progress") return "in-progress"
  return value || "not-started"
}

const getWorkflowMode = (workflow: any): "start" | "resume" | "execute" | "view" => {
  const status = normalizeWorkflowStatus(workflow?.status)
  if (status === "not-started") return "start"
  if (status === "on-hold") return "resume"
  if (status === "in-progress") return "execute"
  return "view"
}

const getWorkflowStatusLabel = (status?: string) => {
  switch (normalizeWorkflowStatus(status)) {
    case "in-progress":
      return "staffDashboard.workflowInProgress"
    case "on-hold":
      return "staffDashboard.workflowPaused"
    case "completed":
      return "staffDashboard.workflowCompleted"
    default:
      return "staffDashboard.workflowPending"
  }
}

const getWorkflowStatusTone = (status?: string) => {
  switch (normalizeWorkflowStatus(status)) {
    case "in-progress":
      return "staff-dash-badge-new"
    case "on-hold":
      return "staff-dash-badge-urgent"
    case "completed":
      return "staff-dash-badge-ok"
    default:
      return "staff-dash-badge"
  }
}

const getWorkflowCurrentStep = (workflow: any) => {
  const steps = safeArray(workflow?.steps)
  if (steps.length === 0) return null

  const currentIndex = Number.isInteger(workflow?.currentStepIndex)
    ? Math.min(Math.max(Number(workflow.currentStepIndex), 0), steps.length - 1)
    : Math.max(steps.findIndex((step: any) => normalizeWorkflowStatus(step?.status) === "in-progress"), 0)

  return steps[currentIndex] || steps[0] || null
}

const getWorkflowProgress = (workflow: any) => {
  const steps = safeArray(workflow?.steps)
  const totalSteps = steps.length
  const completedSteps = steps.filter((step: any) => normalizeWorkflowStatus(step?.status) === "completed").length

  return {
    totalSteps,
    completedSteps,
    percentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
  }
}

const getWorkflowSortWeight = (status?: string) => {
  switch (normalizeWorkflowStatus(status)) {
    case "in-progress":
      return 0
    case "on-hold":
      return 1
    case "not-started":
      return 2
    default:
      return 3
  }
}

const statusDot = (status: string) => {
  const s = String(status || "").toLowerCase()
  if (s === "in-progress" || s === "in_progress" || s === "active") return "staff-dash-dot--blue"
  if (s === "completed" || s === "done") return "staff-dash-dot--green"
  if (s === "urgent" || s === "high") return "staff-dash-dot--red"
  if (s === "pending" || s === "pending_review") return "staff-dash-dot--yellow"
  return "staff-dash-dot--gray"
}

interface StaffData {
  orders: any[]
  unassignedOrders: any[]
  repairRequests: any[]
  notifications: any[]
  teamMembers: any[]
  chatRooms: any[]
  unreadCount: number
  urgentCount: number
}

interface DashboardHint {
  id: string
  title: string
  description: string
  badge: string
  path?: string
  isUrgent?: boolean
  isNew?: boolean
}

interface DashboardWorkflowItem {
  id: string
  orderId: string
  orderNumber: string
  workflowId: string
  workflowName: string
  workflowStatus: string
  workflowStatusLabel: string
  workflowMode: "start" | "resume" | "execute" | "view"
  customerName: string
  deviceLabel: string
  activeStepLabel: string
  createdAt?: string
  updatedAt?: string
  orderPriority?: string
  orderStatus?: string
  progressPercentage: number
  completedSteps: number
  totalSteps: number
}

const FALLBACK: StaffData = {
  orders: [],
  unassignedOrders: [],
  repairRequests: [],
  notifications: [],
  teamMembers: [],
  chatRooms: [],
  unreadCount: 0,
  urgentCount: 0,
}

export function StaffDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [data, setData] = useState<StaffData>(FALLBACK)

  // ── Time tracking state ─────────────────────────────────
  const [timeStatus, setTimeStatus] = useState<CurrentStatus | null>(null)
  const [timeSummary, setTimeSummary] = useState<TimeTrackingSummary | null>(null)
  const [timeActionLoading, setTimeActionLoading] = useState(false)
  const [liveTime, setLiveTime] = useState("")
  const [selectedTimeDate, setSelectedTimeDate] = useState(() => toDateInputValue(new Date()))
  const [timeBreakdownExpanded, setTimeBreakdownExpanded] = useState(false)

  const fetchData = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true)
      else setLoading(true)

      const [ordersResult, unassignedOrdersResult, repairResult, notifResult, staffResult, chatRoomsResult] = await Promise.allSettled([
        getAssignedOrders({ limit: 50 }),
        getAdminOrders({ page: 1, limit: 200 }),
        getRepairRequests({
          sortBy: "createdAt",
          sortOrder: "desc",
          limit: 200,
          page: 1,
        }),
        getNotifications(),
        getStaffMembers({ status: "all" }),
        getTeamChatRooms(),
      ])

      const orders = safeArray(
        ordersResult.status === "fulfilled"
          ? (ordersResult.value as any)?.orders ?? (ordersResult.value as any)?.data ?? ordersResult.value
          : []
      )
      const unassignedOrders = safeArray(
        unassignedOrdersResult.status === "fulfilled"
          ? (unassignedOrdersResult.value as any)?.orders
            ?? (unassignedOrdersResult.value as any)?.data
            ?? unassignedOrdersResult.value
          : []
      )
      const repairRequests = safeArray(
        repairResult.status === "fulfilled"
          ? (repairResult.value as any)?.requests
            ?? (repairResult.value as any)?.repairRequests
            ?? (repairResult.value as any)?.data
            ?? repairResult.value
          : []
      )
      const notifications = safeArray(
        notifResult.status === "fulfilled"
          ? (notifResult.value as any)?.notifications ?? notifResult.value
          : []
      )
      const teamMembers = safeArray(
        staffResult.status === "fulfilled"
          ? (staffResult.value as any)?.staff ?? staffResult.value
          : []
      )
      const chatRooms = safeArray(
        chatRoomsResult.status === "fulfilled"
          ? (chatRoomsResult.value as any)?.rooms ?? chatRoomsResult.value
          : []
      )

      const unreadCount = notifications.filter((notification: any) => !isNotificationRead(notification)).length
      const urgentCount = notifications.filter((n: any) => n.isUrgent).length

      setData({ orders, unassignedOrders, repairRequests, notifications, teamMembers, chatRooms, unreadCount, urgentCount })
      setLastUpdated(new Date())

      if (showToast) {
        toast({
          title: t('staffDashboard.dashboardUpdated'),
          description: t('staffDashboard.dashboardUpdatedDesc', { orders: orders.length, repairs: repairRequests.length, unassigned: unassignedOrders.length }),
        })
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t('staffDashboard.loadError'),
        description: err?.message || t('staffDashboard.unknownError'),
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchTimeData = async () => {
    try {
      const [statusRes, summaryRes] = await Promise.allSettled([
        getCurrentStatus(),
        getTimeTrackingSummary({ date: selectedTimeDate }),
      ])
      if (statusRes.status === "fulfilled")  setTimeStatus(statusRes.value)
      if (summaryRes.status === "fulfilled") setTimeSummary(summaryRes.value)
    } catch { /* non-critical — time tracking may not be set up */ }
  }

  const handleClockIn = async () => {
    setTimeActionLoading(true)
    try {
      await clockIn()
      await fetchTimeData()
      toast({ title: t('staffDashboard.clockedIn'), description: t('staffDashboard.workStarted') })
    } catch (err: any) {
      toast({ variant: "destructive", title: t('common.error'), description: err?.message || t('staffDashboard.clockInFailed') })
    } finally { setTimeActionLoading(false) }
  }

  const handleClockOut = async () => {
    setTimeActionLoading(true)
    try {
      await clockOut()
      await fetchTimeData()
      toast({ title: t('staffDashboard.clockedOut'), description: t('staffDashboard.goodEvening') })
    } catch (err: any) {
      toast({ variant: "destructive", title: t('common.error'), description: err?.message || t('staffDashboard.clockOutFailed') })
    } finally { setTimeActionLoading(false) }
  }

  const handleStartBreak = async () => {
    setTimeActionLoading(true)
    try {
      await startBreak()
      await fetchTimeData()
      toast({ title: t('staffDashboard.breakStarted'), description: t('staffDashboard.restWell') })
    } catch (err: any) {
      toast({ variant: "destructive", title: t('common.error'), description: err?.message || t('staffDashboard.breakNotPossible') })
    } finally { setTimeActionLoading(false) }
  }

  const handleEndBreak = async () => {
    setTimeActionLoading(true)
    try {
      await endBreak()
      await fetchTimeData()
      toast({ title: t('staffDashboard.breakEnded'), description: t('staffDashboard.letsGo') })
    } catch (err: any) {
      toast({ variant: "destructive", title: t('common.error'), description: err?.message || t('staffDashboard.breakEndFailed') })
    } finally { setTimeActionLoading(false) }
  }

  const handleOpenOrderDetails = (order: any) => {
    const orderId = order?._id
    if (!orderId) return
    navigate(`/orders/${orderId}`)
  }

  const handleOpenWorkflowDetails = (workflowItem: DashboardWorkflowItem) => {
    if (!workflowItem.orderId || !workflowItem.workflowId) return

    navigate(`/orders/${workflowItem.orderId}`, {
      state: {
        openWorkflowId: workflowItem.workflowId,
        workflowMode: workflowItem.workflowMode,
        source: "staff-dashboard",
      },
    })
  }

  const handleOpenRepairRequestDetails = (request: any) => {
    const requestId = request?._id
    if (!requestId) return
    navigate(`/staff/repair-requests?requestId=${encodeURIComponent(String(requestId))}`)
  }

  useEffect(() => {
    fetchData()
    fetchTimeData()
    const interval     = setInterval(() => fetchData(), 30000)
    const timeInterval = setInterval(() => fetchTimeData(), 30000)
    return () => { clearInterval(interval); clearInterval(timeInterval) }
  }, [selectedTimeDate])

  // Live clock – ticks every second
  useEffect(() => {
    const tick = () =>
      setLiveTime(
        new Date().toLocaleTimeString("de-CH", {
          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        })
      )
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const derived = useMemo(() => {
    const myStaffId = user?._id || ""
    const assignedRepairRequests = data.repairRequests.filter((r: any) => isAssignedToStaff(r, myStaffId))
    const unassignedRepairRequests = data.repairRequests.filter((r: any) => isUnassignedRepairRequest(r))
    const unassignedOrders = data.unassignedOrders
      .filter((order: any) => !hasOrderStaffAssignment(order))
      .sort((a: any, b: any) => {
        const aDate = new Date(a?.createdAt || 0).getTime()
        const bDate = new Date(b?.createdAt || 0).getTime()
        return bDate - aDate
      })
    const myTasks = [
      ...data.orders.map((order: any) => ({ type: "order", item: order })),
      ...assignedRepairRequests.map((request: any) => ({ type: "repair", item: request })),
    ].sort((a: any, b: any) => {
      const aDate = new Date(a?.item?.createdAt || 0).getTime()
      const bDate = new Date(b?.item?.createdAt || 0).getTime()
      return bDate - aDate
    })
    const inProgress = data.orders.filter((o: any) =>
      ["in-progress", "in_progress", "active"].includes(String(o?.status || "").toLowerCase())
    ).length
    const completed = data.orders.filter((o: any) =>
      ["completed", "done"].includes(String(o?.status || "").toLowerCase())
    ).length
    const urgent = data.orders.filter((o: any) =>
      ["urgent", "high"].includes(String(o?.priority || "").toLowerCase())
    ).length
    const pendingRepairs = unassignedRepairRequests.length
    const myTasksCount = data.orders.length + assignedRepairRequests.length
    const assignedWorkflowItems: DashboardWorkflowItem[] = data.orders.flatMap((order: any) => {
      const orderId = toId(order?._id)
      if (!orderId) return []

      const deviceLabel = order.device
        ? `${order.device.brand || ""} ${order.device.model || ""}`.trim() || order.device.type || t('staffDashboard.device')
        : `${order.deviceBrand || ""} ${order.deviceModel || ""}`.trim() || order.deviceType || t('staffDashboard.device')

      return safeArray(order?.workflows).map((workflow: any) => {
        const workflowStatus = normalizeWorkflowStatus(workflow?.status)
        const currentStep = getWorkflowCurrentStep(workflow)
        const progress = getWorkflowProgress(workflow)

        return {
          id: `${orderId}-${toId(workflow?._id || workflow?.workflowTemplateId || workflow?.workflowName)}`,
          orderId,
          orderNumber: order.orderNumber || orderId.slice(-6) || "–",
          workflowId: toId(workflow?._id),
          workflowName: workflow?.workflowName || workflow?.workflowTemplateId?.name || "Workflow",
          workflowStatus,
          workflowStatusLabel: getWorkflowStatusLabel(workflowStatus),
          workflowMode: getWorkflowMode(workflow),
          customerName: toName(order.customer || order.customerId),
          deviceLabel,
          activeStepLabel: currentStep?.stepName || currentStep?.name || t('staffDashboard.noStepDefined'),
          createdAt: workflow?.startedAt || order?.updatedAt || order?.createdAt,
          updatedAt: workflow?.pausedAt || workflow?.completedAt || order?.updatedAt || order?.createdAt,
          orderPriority: String(order?.priority || ""),
          orderStatus: String(order?.status || ""),
          progressPercentage: progress.percentage,
          completedSteps: progress.completedSteps,
          totalSteps: progress.totalSteps,
        }
      }).filter((workflow: DashboardWorkflowItem) => Boolean(workflow.workflowId))
    })
      .sort((a, b) => {
        const byStatus = getWorkflowSortWeight(a.workflowStatus) - getWorkflowSortWeight(b.workflowStatus)
        if (byStatus !== 0) return byStatus

        const priorityA = ["urgent", "high"].includes(String(a.orderPriority || "").toLowerCase()) ? 0 : 1
        const priorityB = ["urgent", "high"].includes(String(b.orderPriority || "").toLowerCase()) ? 0 : 1
        if (priorityA !== priorityB) return priorityA - priorityB

        return toTimestamp(b.updatedAt || b.createdAt) - toTimestamp(a.updatedAt || a.createdAt)
      })

    const pendingWorkflows = assignedWorkflowItems.filter((workflow) => workflow.workflowStatus === "not-started")
    const actionableWorkflows = assignedWorkflowItems.filter((workflow) =>
      ["in-progress", "on-hold"].includes(workflow.workflowStatus)
    )
    const recentAssignedOrders = data.orders
      .filter((order: any) => isRecent(getOrderAssignmentDate(order, myStaffId), 72))
      .map((order: any) => ({
        label: `#${order.orderNumber || order._id?.slice(-6) || "–"}`,
        when: getOrderAssignmentDate(order, myStaffId),
      }))
      .sort((a: any, b: any) => toTimestamp(b.when) - toTimestamp(a.when))
    const recentAssignedRequests = assignedRepairRequests
      .filter((request: any) => isRecent(request?.assignedAt || request?.updatedAt || request?.createdAt, 72))
      .map((request: any) => ({
        label: `RR #${request.requestNumber || request._id?.slice(-6) || "–"}`,
        when: request?.assignedAt || request?.updatedAt || request?.createdAt,
      }))
      .sort((a: any, b: any) => toTimestamp(b.when) - toTimestamp(a.when))

    const unreadNotificationMessages = data.notifications.filter((notification: any) =>
      String(notification?.type || "").toLowerCase() === "message" && !isNotificationRead(notification)
    )
    const unreadTeamChatRooms = data.chatRooms.filter((room: any) => Number(room?.unreadCount || 0) > 0)
    const unreadTeamChatMessages = unreadTeamChatRooms.reduce(
      (sum: number, room: any) => sum + Number(room?.unreadCount || 0),
      0
    )

    const deadlineOrders = data.orders
      .filter((order: any) => isOpenStatus(order?.status))
      .map((order: any) => ({
        label: `#${order.orderNumber || order._id?.slice(-6) || "–"}`,
        dueAt: order?.estimatedCompletion || order?.estimatedCompletionTime,
        ...getDeadlineState(order?.estimatedCompletion || order?.estimatedCompletionTime),
      }))
      .filter((order: any) => order.isOverdue || order.isDueSoon)
    const deadlineRequests = assignedRepairRequests
      .filter((request: any) => isOpenStatus(request?.status))
      .map((request: any) => ({
        label: `RR #${request.requestNumber || request._id?.slice(-6) || "–"}`,
        dueAt: request?.reviewDeadline,
        ...getDeadlineState(request?.reviewDeadline),
      }))
      .filter((request: any) => request.isOverdue || request.isDueSoon)

    const statusUpdates = data.notifications.filter((notification: any) => {
      const type = String(notification?.type || "").toLowerCase()
      return type === "order_update" && (!isNotificationRead(notification) || isRecent(notification?.createdAt, 72))
    })

    const unavailableTeamMembers = data.teamMembers.filter((member: any) =>
      toId(member?._id) !== String(myStaffId) && ["inactive", "on_leave"].includes(String(member?.status || "").toLowerCase())
    )

    const dashboardHints: DashboardHint[] = []

    const assignmentCount = recentAssignedOrders.length + recentAssignedRequests.length
    if (assignmentCount > 0) {
      dashboardHints.push({
        id: "assignments",
        title: t('staffDashboard.newAssignments'),
        description: `${assignmentCount} ${t('staffDashboard.newAssignmentDesc')}: ${listPreview(
          [...recentAssignedOrders, ...recentAssignedRequests].map((item: any) => item.label)
        )}`,
        badge: t('staffDashboard.newBadge', { count: assignmentCount }),
        path: recentAssignedRequests.length >= recentAssignedOrders.length ? "/staff/repair-requests" : "/staff/orders",
        isNew: true,
      })
    }

    const communicationCount = unreadNotificationMessages.length + unreadTeamChatMessages
    if (communicationCount > 0) {
      const roomPreview = unreadTeamChatRooms.length > 0
        ? t('staffDashboard.unreadTeamChat', { count: unreadTeamChatMessages, rooms: unreadTeamChatRooms.length })
        : t('staffDashboard.newCommHints', { count: unreadNotificationMessages.length })
      dashboardHints.push({
        id: "messages",
        title: t('staffDashboard.newMessages'),
        description: roomPreview,
        badge: t('staffDashboard.openBadge', { count: communicationCount }),
        path: "/notifications",
        isNew: true,
      })
    }

    const overdueEntries = [...deadlineOrders, ...deadlineRequests].filter((entry: any) => entry.isOverdue)
    const soonEntries = [...deadlineOrders, ...deadlineRequests].filter((entry: any) => !entry.isOverdue && entry.isDueSoon)
    if (overdueEntries.length > 0 || soonEntries.length > 0) {
      const activeEntries = overdueEntries.length > 0 ? overdueEntries : soonEntries
      const deadlineLabel = overdueEntries.length > 0
        ? t('staffDashboard.overdueBadge', { count: overdueEntries.length })
        : t('staffDashboard.dueSoonBadge', { count: soonEntries.length })
      const deadlineDescription = activeEntries
        .slice(0, 2)
        .map((entry: any) => `${entry.label} (${formatDateLabel(entry.dueAt)})`)
        .join(", ")
      dashboardHints.push({
        id: "deadlines",
        title: overdueEntries.length > 0 ? t('staffDashboard.overdueDeadlines') : t('staffDashboard.openDeadlines'),
        description: deadlineDescription,
        badge: deadlineLabel,
        path: overdueEntries.some((entry: any) => String(entry.label).startsWith("RR #")) ? "/staff/repair-requests" : "/staff/orders",
        isUrgent: overdueEntries.length > 0,
      })
    }

    if (statusUpdates.length > 0) {
      dashboardHints.push({
        id: "status-updates",
        title: t('staffDashboard.statusChanges'),
        description: listPreview(
          statusUpdates.map((notification: any) => notification?.title || notification?.message || t('staffDashboard.statusUpdated'))
        ),
        badge: t('staffDashboard.changedBadge', { count: statusUpdates.length }),
        path: "/notifications",
      })
    }

    if (unavailableTeamMembers.length > 0) {
      dashboardHints.push({
        id: "team-updates",
        title: t('staffDashboard.teamUpdates'),
        description: `${unavailableTeamMembers.length} ${t('staffDashboard.teamMembersUnavailable')}: ${listPreview(
          unavailableTeamMembers.map((member: any) => toName(member))
        )}`,
        badge: t('staffDashboard.absentBadge', { count: unavailableTeamMembers.length }),
      })
    }

    return {
      inProgress,
      completed,
      urgent,
      pendingRepairs,
      assignedRepairRequests,
      unassignedRepairRequests,
      unassignedOrders,
      pendingWorkflows,
      actionableWorkflows,
      myTasksCount,
      myTasks,
      dashboardHints,
    }
  }, [data, user?._id])

  const timeInsights = useMemo(() => {
    const summary = timeSummary?.summary

    return {
      totalHoursWorked: summary?.totalHoursWorked ?? 0,
      totalBreakHours: summary?.totalBreakHours ?? 0,
      breakHoursToday: summary?.breakHoursToday ?? 0,
      breaksToday: summary?.breaksToday ?? [],
      ordersToday: summary?.ordersToday ?? [],
      selectedDate: summary?.selectedDate ?? selectedTimeDate,
    }
  }, [selectedTimeDate, timeSummary])

  if (loading) {
    return (
      <div className="staff-dashboard-loading">
        <RefreshCw className="h-6 w-6 animate-spin" style={{ color: "#1a2a5e", margin: "0 auto" }} />
        <p>{t('staffDashboard.loading')}</p>
      </div>
    )
  }

  return (
    <div className="staff-dashboard-container">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="staff-dash-header">
        <div className="staff-dash-header-main">
          <h1>{t('staffDashboard.title')}</h1>
          <p>{t('staffDashboard.description')}</p>
        </div>

        <div className="staff-dash-header-meta">
          <Badge variant="outline" className="staff-dash-badge-muted">
            {t('staffDashboard.lastUpdated')}: {lastUpdated ? lastUpdated.toLocaleTimeString("de-CH") : "–"}
          </Badge>
          <Badge variant="outline" className="staff-dash-badge-muted">
            {t('staffDashboard.autoRefresh')}
          </Badge>
        </div>

        <div className="staff-dash-header-actions">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="staff-dash-btn-light"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {t('staffDashboard.refresh')}
          </Button>
        </div>
      </div>

      {/* ── Stats Row ────────────────────────────────────────── */}
      <div className="staff-dash-stats-grid">
        <Card className="staff-dash-stat-card">
          <CardContent className="staff-dash-stat-content">
            <div>
              <p>{t('staffDashboard.myOrders')}</p>
              <h3>{derived.myTasksCount}</h3>
              <small>{derived.inProgress} {t('staffDashboard.active')}</small>
            </div>
            <Package className="h-4 w-4 staff-dash-stat-icon" />
          </CardContent>
        </Card>

        <Card className="staff-dash-stat-card">
          <CardContent className="staff-dash-stat-content">
            <div>
              <p>{t('staffDashboard.inProgress')}</p>
              <h3>{derived.inProgress}</h3>
              <small>{t('staffDashboard.activeRepairs')}</small>
            </div>
            <Wrench className="h-4 w-4 staff-dash-stat-icon" />
          </CardContent>
        </Card>

        <Card className="staff-dash-stat-card">
          <CardContent className="staff-dash-stat-content">
            <div>
              <p>{t('staffDashboard.completedLabel')}</p>
              <h3>{derived.completed}</h3>
              <small>{t('staffDashboard.completedOrders')}</small>
            </div>
            <CheckCircle2 className="h-4 w-4 staff-dash-stat-icon" />
          </CardContent>
        </Card>

        <Card className="staff-dash-stat-card staff-dash-stat-card--urgent">
          <CardContent className="staff-dash-stat-content">
            <div>
              <p>{t('staffDashboard.urgent')}</p>
              <h3>{derived.urgent}</h3>
              <small>{t('staffDashboard.highPriority')}</small>
            </div>
            <AlertCircle className="h-4 w-4 staff-dash-stat-icon" />
          </CardContent>
        </Card>

        <Card className="staff-dash-stat-card">
          <CardContent className="staff-dash-stat-content">
            <div>
              <p>{t('staffDashboard.repairRequests')}</p>
              <h3>{derived.pendingRepairs}</h3>
              <small>{t('staffDashboard.open')}</small>
            </div>
            <Timer className="h-4 w-4 staff-dash-stat-icon" />
          </CardContent>
        </Card>
      </div>

      {/* ── Alert Bar ────────────────────────────────────────── */}
      <div className="staff-dash-alert-bar">
        <button type="button" onClick={() => navigate("/staff/orders")}>
          {t('staffDashboard.myOrdersAlert')}: <strong>{derived.myTasksCount}</strong>
        </button>
        <button
          type="button"
          className={derived.urgent > 0 ? "alert-urgent" : ""}
          onClick={() => navigate("/staff/orders")}
        >
          {t('staffDashboard.urgentOrdersAlert')}: <strong>{derived.urgent}</strong>
        </button>
        <button type="button" onClick={() => navigate("/staff/repair-requests")}>
          {t('staffDashboard.openRepairRequestsAlert')}: <strong>{derived.pendingRepairs}</strong>
        </button>
        <button
          type="button"
          className={data.unreadCount > 0 ? "alert-urgent" : ""}
          onClick={() => navigate("/notifications")}
        >
          {t('staffDashboard.unreadNoticesAlert')}: <strong>{data.unreadCount}</strong>
        </button>
      </div>

      <div className="staff-dash-workflow-grid">
        <Card className="staff-dash-panel staff-dash-panel--highlight">
          <CardHeader className="staff-dash-panel-header">
            <CardTitle>
              <Clock className="h-4 w-4 staff-dash-messages-icon" />
              {t('staffDashboard.pendingWorkflows')}
            </CardTitle>
            <CardDescription>
              {derived.pendingWorkflows.length > 0 ? (
                <span className="staff-dash-messages-label">{derived.pendingWorkflows.length} {t('staffDashboard.waiting')}</span>
              ) : t('staffDashboard.noOpenWorkflowStarts')}
            </CardDescription>
          </CardHeader>
          <CardContent className="staff-dash-panel-content">
            <ScrollArea className="staff-dash-scroll-area">
              <div className="staff-dash-list">
                {derived.pendingWorkflows.length === 0 && (
                  <p className="staff-dash-empty">{t('staffDashboard.noPendingWorkflows')}</p>
                )}
                {derived.pendingWorkflows.slice(0, 8).map((workflow: DashboardWorkflowItem) => {
                  const isUrgent = ["urgent", "high"].includes(String(workflow.orderPriority || "").toLowerCase())

                  return (
                    <button
                      key={workflow.id}
                      type="button"
                      className={`staff-dash-list-item ${isUrgent ? "staff-dash-list-item--urgent" : ""}`}
                      onClick={() => handleOpenWorkflowDetails(workflow)}
                    >
                      <div style={{ display: "grid", gap: "0.2rem", minWidth: 0 }}>
                        <p className="staff-dash-title">{workflow.workflowName}</p>
                        <p className="staff-dash-sub">Order #{workflow.orderNumber} · {workflow.customerName}</p>
                        <p className="staff-dash-sub">{workflow.deviceLabel}</p>
                        <p className="staff-dash-sub">{t('staffDashboard.firstStep')}: {workflow.activeStepLabel}</p>
                        <div className="staff-dash-progress">
                          <div className="staff-dash-progress-fill" style={{ width: `${workflow.progressPercentage}%` }} />
                        </div>
                      </div>
                      <div className="staff-dash-list-side">
                        <Badge variant="outline" className={getWorkflowStatusTone(workflow.workflowStatus)}>
                          {t(workflow.workflowStatusLabel)}
                        </Badge>
                        <small>{workflow.completedSteps}/{workflow.totalSteps || 0} {t('staffDashboard.steps')}</small>
                        <small>{timeAgo(t, workflow.createdAt)}</small>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
            <Separator className="staff-dash-sep" />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/staff/orders")}>
              {t('staffDashboard.openAssignedOrders')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card className="staff-dash-panel staff-dash-panel--accent">
          <CardHeader className="staff-dash-panel-header">
            <CardTitle>
              <Play className="h-4 w-4" />
              {t('staffDashboard.workflowsToProcess')}
            </CardTitle>
            <CardDescription>
              {derived.actionableWorkflows.length > 0 ? (
                <span className="staff-dash-messages-label">{derived.actionableWorkflows.length} {t('staffDashboard.activeOrPaused')}</span>
              ) : t('staffDashboard.noActiveWorkflows')}
            </CardDescription>
          </CardHeader>
          <CardContent className="staff-dash-panel-content">
            <ScrollArea className="staff-dash-scroll-area">
              <div className="staff-dash-list">
                {derived.actionableWorkflows.length === 0 && (
                  <p className="staff-dash-empty">{t('staffDashboard.noWorkflowsToProcess')}</p>
                )}
                {derived.actionableWorkflows.slice(0, 8).map((workflow: DashboardWorkflowItem) => {
                  const isUrgent = ["urgent", "high"].includes(String(workflow.orderPriority || "").toLowerCase())
                  const progressClass = workflow.workflowStatus === "on-hold"
                    ? "staff-dash-progress-fill staff-dash-progress-fill--yellow"
                    : "staff-dash-progress-fill"

                  return (
                    <button
                      key={workflow.id}
                      type="button"
                      className={`staff-dash-list-item ${isUrgent ? "staff-dash-list-item--urgent" : ""}`}
                      onClick={() => handleOpenWorkflowDetails(workflow)}
                    >
                      <div style={{ display: "grid", gap: "0.2rem", minWidth: 0 }}>
                        <p className="staff-dash-title">{workflow.workflowName}</p>
                        <p className="staff-dash-sub">Order #{workflow.orderNumber} · {workflow.customerName}</p>
                        <p className="staff-dash-sub">{t('staffDashboard.activeStep')}: {workflow.activeStepLabel}</p>
                        <p className="staff-dash-sub">{t('staffDashboard.orderStatus')}: {capitalize(workflow.orderStatus)}</p>
                        <div className="staff-dash-progress">
                          <div className={progressClass} style={{ width: `${workflow.progressPercentage}%` }} />
                        </div>
                      </div>
                      <div className="staff-dash-list-side">
                        <Badge variant="outline" className={getWorkflowStatusTone(workflow.workflowStatus)}>
                          {t(workflow.workflowStatusLabel)}
                        </Badge>
                        <small>{workflow.completedSteps}/{workflow.totalSteps || 0} {t('staffDashboard.steps')}</small>
                        <small>{timeAgo(t, workflow.updatedAt || workflow.createdAt)}</small>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
            <Separator className="staff-dash-sep" />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/staff/orders")}>
              {t('staffDashboard.viewAllWorkflowOrders')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Grid: Aufträge | Repair Requests | Hinweise ─── */}
      <div className="staff-dash-main-grid">

        {/* Meine Aufträge */}
        <Card className="staff-dash-panel">
          <CardHeader className="staff-dash-panel-header">
            <CardTitle>
              <Package className="h-4 w-4" />
              {t('staffDashboard.myOrders')}
            </CardTitle>
            <CardDescription>
              {derived.myTasksCount} {t('staffDashboard.assigned')} ({data.orders.length} Orders, {derived.assignedRepairRequests.length} Repair Requests)
            </CardDescription>
          </CardHeader>
          <CardContent className="staff-dash-panel-content">
            <ScrollArea className="staff-dash-scroll-area">
              <div className="staff-dash-list">
                {derived.myTasksCount === 0 && (
                  <p className="staff-dash-empty">{t('staffDashboard.noOrdersAssigned')}</p>
                )}
                {derived.myTasks.slice(0, 8).map((task: any) => {
                  if (task.type === "repair") {
                    const req = task.item
                    const customer = toName(req.customer || req.customerId)
                    const device = req.device
                      ? `${req.device.brand || ""} ${req.device.model || ""}`.trim() || req.device.type || t('staffDashboard.device')
                      : `${req.deviceBrand || ""} ${req.deviceModel || ""}`.trim() || req.deviceType || t('staffDashboard.device')
                    const isUrgent = ["urgent", "high"].includes(String(req.priority || req.urgency || "").toLowerCase())
                    return (
                      <button
                        key={`repair-${req._id || req.requestNumber}`}
                        type="button"
                        className={`staff-dash-list-item ${isUrgent ? "staff-dash-list-item--urgent" : ""}`}
                        onClick={() => handleOpenRepairRequestDetails(req)}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.35rem" }}>
                          <div className={`staff-dash-dot ${statusDot(req.status)} `} style={{ marginTop: "0.3rem" }} />
                          <div>
                            <p className="staff-dash-title">RR #{req.requestNumber || "–"}</p>
                            <p className="staff-dash-sub">{customer} · {device}</p>
                          </div>
                        </div>
                        <div className="staff-dash-list-side">
                          <Badge variant="outline" className="staff-dash-badge">
                            {capitalize(req.status)}
                          </Badge>
                          {isUrgent && (
                            <Badge className="staff-dash-badge-urgent">{t('staffDashboard.urgentBadge')}</Badge>
                          )}
                          <small>{timeAgo(t, req.createdAt)}</small>
                        </div>
                      </button>
                    )
                  }

                  const order = task.item
                  const customer = toName(order.customer)
                  const device = order.device
                    ? `${order.device.brand || ""} ${order.device.model || ""}`.trim() || order.device.type || t('staffDashboard.device')
                    : order.deviceType || t('staffDashboard.device')
                  const isUrgent = ["urgent", "high"].includes(String(order.priority || "").toLowerCase())
                  return (
                    <button
                      key={`order-${order._id || order.orderNumber}`}
                      type="button"
                      className={`staff-dash-list-item ${isUrgent ? "staff-dash-list-item--urgent" : ""}`}
                      onClick={() => handleOpenOrderDetails(order)}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.35rem" }}>
                        <div className={`staff-dash-dot ${statusDot(order.status)} `} style={{ marginTop: "0.3rem" }} />
                        <div>
                          <p className="staff-dash-title">#{order.orderNumber || "–"}</p>
                          <p className="staff-dash-sub">{customer} · {device}</p>
                        </div>
                      </div>
                      <div className="staff-dash-list-side">
                        <Badge variant="outline" className="staff-dash-badge">
                          {capitalize(order.status)}
                        </Badge>
                        {isUrgent && (
                          <Badge className="staff-dash-badge-urgent">{t('staffDashboard.urgentBadge')}</Badge>
                        )}
                        <small>{timeAgo(t, order.createdAt)}</small>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
            <Separator className="staff-dash-sep" />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/staff/orders")}>
              {t('staffDashboard.viewAllOrders')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Repair Requests */}
        <Card className="staff-dash-panel">
          <CardHeader className="staff-dash-panel-header">
            <CardTitle>
              <Wrench className="h-4 w-4" />
              {t('staffDashboard.repairRequests')}
            </CardTitle>
            <CardDescription>{derived.pendingRepairs} {t('staffDashboard.open')}</CardDescription>
          </CardHeader>
          <CardContent className="staff-dash-panel-content">
            <ScrollArea className="staff-dash-scroll-area">
              <div className="staff-dash-list">
                {derived.unassignedRepairRequests.length === 0 && (
                  <p className="staff-dash-empty">{t('staffDashboard.noOpenRepairRequests')}</p>
                )}
                {derived.unassignedRepairRequests.map((req: any) => {
                  const customer = toName(req.customer || req.customerId)
                  const device = req.device
                    ? `${req.device.brand || ""} ${req.device.model || ""}`.trim() || req.device.type || t('staffDashboard.device')
                    : `${req.deviceBrand || ""} ${req.deviceModel || ""}`.trim() || req.deviceType || t('staffDashboard.device')
                  return (
                    <button
                      key={req._id || req.requestNumber}
                      type="button"
                      className="staff-dash-list-item"
                      onClick={() => handleOpenRepairRequestDetails(req)}
                    >
                      <div>
                        <p className="staff-dash-title">{customer}</p>
                        <p className="staff-dash-sub">{device}</p>
                      </div>
                      <div className="staff-dash-list-side">
                        <Badge variant="outline" className="staff-dash-badge">
                          {capitalize(req.status)}
                        </Badge>
                        <small>{timeAgo(t, req.createdAt)}</small>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
            <Separator className="staff-dash-sep" />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/staff/repair-requests")}>
              {t('staffDashboard.viewAllRequests')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Hinweise / Notifications */}
        <Card className="staff-dash-panel">
          <CardHeader className="staff-dash-panel-header">
            <CardTitle>
              <Bell className="h-4 w-4" />
              {t('staffDashboard.notices')}
            </CardTitle>
            <CardDescription>
              {derived.dashboardHints.length > 0 ? (
                <span className="staff-dash-messages-label">{derived.dashboardHints.length} {t('staffDashboard.relevant')}</span>
              ) : t('staffDashboard.noNewNotices')}
            </CardDescription>
          </CardHeader>
          <CardContent className="staff-dash-panel-content">
            <ScrollArea className="staff-dash-scroll-area">
              <div className="staff-dash-list">
                {derived.dashboardHints.length === 0 && (
                  <p className="staff-dash-empty">{t('staffDashboard.noNoticesAvailable')}</p>
                )}
                {derived.dashboardHints.slice(0, 8).map((hint: DashboardHint) => {
                  const content = (
                    <>
                      <div>
                        <p className="staff-dash-title">
                          {hint.isUrgent && (
                            <AlertCircle className="h-3.5 w-3.5" style={{ color: "#c53030" }} />
                          )}
                          {hint.title}
                        </p>
                        <p className="staff-dash-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "220px" }}>
                          {hint.description}
                        </p>
                      </div>
                      <div className="staff-dash-list-side">
                        <Badge variant="outline" className="staff-dash-badge">
                          {hint.badge}
                        </Badge>
                        {hint.isNew && (
                          <Badge className="staff-dash-badge-new">{t('staffDashboard.newBadgeLabel')}</Badge>
                        )}
                        {hint.isUrgent && (
                          <Badge className="staff-dash-badge-urgent">{t('staffDashboard.urgentBadge')}</Badge>
                        )}
                      </div>
                    </>
                  )

                  if (!hint.path) {
                    return (
                      <div key={hint.id} className={`staff-dash-list-item ${hint.isUrgent ? "staff-dash-list-item--urgent" : ""}`}>
                        {content}
                      </div>
                    )
                  }

                  return (
                    <button
                      key={hint.id}
                      type="button"
                      className={`staff-dash-list-item ${hint.isUrgent ? "staff-dash-list-item--urgent" : ""}`}
                      onClick={() => navigate(hint.path || "/notifications")}
                    >
                      {content}
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
            <Separator className="staff-dash-sep" />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/notifications")}>
              {t('staffDashboard.viewAllNotices')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom Grid: Orders | Nachrichten | Team ────────── */}
      <div className="staff-dash-bottom-grid">

        {/* Unzugewiesene Orders */}
        <Card className="staff-dash-panel staff-dash-panel--highlight">
          <CardHeader className="staff-dash-panel-header">
            <CardTitle>
              <Package className="h-4 w-4 staff-dash-messages-icon" />
              Orders
            </CardTitle>
            <CardDescription>
              {derived.unassignedOrders.length > 0 ? (
                <span className="staff-dash-messages-label">{derived.unassignedOrders.length} {t('staffDashboard.unassigned')}</span>
              ) : t('staffDashboard.noOpenOrders')}
            </CardDescription>
          </CardHeader>
          <CardContent className="staff-dash-panel-content">
            <ScrollArea className="staff-dash-scroll-area">
              <div className="staff-dash-list">
                {derived.unassignedOrders.length === 0 && (
                  <p className="staff-dash-empty">{t('staffDashboard.noUnassignedOrders')}</p>
                )}
                {derived.unassignedOrders.map((order: any) => {
                  const customer = toName(order.customer || order.customerId)
                  const orderNumber = order.orderNumber || order._id?.slice(-6) || "–"
                  const device = order.device
                    ? `${order.device.brand || ""} ${order.device.model || ""}`.trim() || order.device.type || t('staffDashboard.device')
                    : `${order.deviceBrand || ""} ${order.deviceModel || ""}`.trim() || order.deviceType || t('staffDashboard.device')
                  return (
                    <button
                      key={order._id || orderNumber}
                      type="button"
                      className="staff-dash-msg-item"
                      onClick={() => handleOpenOrderDetails(order)}
                    >
                      <div className="staff-dash-msg-avatar">
                        <Package className="h-3.5 w-3.5" />
                      </div>
                      <div className="staff-dash-msg-body">
                        <p className="staff-dash-title">{customer}</p>
                        <p className="staff-dash-sub staff-dash-msg-ref">#{orderNumber}</p>
                        <p className="staff-dash-sub staff-dash-msg-preview">
                          {device}
                        </p>
                      </div>
                      <div className="staff-dash-list-side">
                        <Badge variant="outline" className="staff-dash-badge">
                          {capitalize(order.status)}
                        </Badge>
                        <small>{timeAgo(t, order.createdAt)}</small>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
            <Separator className="staff-dash-sep" />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/staff/orders")}>
              {t('staffDashboard.allOrders')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Meine Leistung */}
        <Card className="staff-dash-panel">
          <CardHeader className="staff-dash-panel-header">
            <CardTitle>
              <TrendingUp className="h-4 w-4" />
              {t('staffDashboard.myPerformance')}
            </CardTitle>
          </CardHeader>
          <CardContent className="staff-dash-kpi-grid">
            <div>
              <p>{t('staffDashboard.totalOrders')}</p>
              <h4>{data.orders.length}</h4>
            </div>
            <div>
              <p>{t('staffDashboard.completedLabel')}</p>
              <h4>{derived.completed}</h4>
            </div>
            <div>
              <p>{t('staffDashboard.inProgress')}</p>
              <h4>{derived.inProgress}</h4>
            </div>
            <div>
              <p>{t('staffDashboard.urgentCases')}</p>
              <h4 style={{ color: derived.urgent > 0 ? "#c53030" : undefined }}>{derived.urgent}</h4>
            </div>
          </CardContent>
        </Card>

        {/* Schnellaktionen */}
        <Card className="staff-dash-panel staff-dash-panel--accent">
          <CardHeader className="staff-dash-panel-header">
            <CardTitle>
              <Settings className="h-4 w-4" />
              {t('staffDashboard.quickActions')}
            </CardTitle>
          </CardHeader>
          <CardContent className="staff-dash-action-grid">
            <Button size="sm" variant="outline" onClick={() => navigate("/staff/orders")}>
              <Package className="h-3.5 w-3.5" /> {t('staffDashboard.orders')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/staff/bookings")}>
              <Calendar className="h-3.5 w-3.5" /> {t('staffDashboard.bookings')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/staff/repair-requests")}>
              <Wrench className="h-3.5 w-3.5" /> {t('staffDashboard.repairReq')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/staff/schedule")}>
              <Clock className="h-3.5 w-3.5" /> {t('staffDashboard.schedule')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/staff/time-tracking")}>
              <Timer className="h-3.5 w-3.5" /> {t('staffDashboard.timeTracking')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/staff/performance")}>
              <BarChart3 className="h-3.5 w-3.5" /> {t('staffDashboard.performance')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/staff/chat")}>
              <Users className="h-3.5 w-3.5" /> {t('staffDashboard.teamChat')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/staff/knowledge-base")}>
              <BookOpen className="h-3.5 w-3.5" /> {t('staffDashboard.knowledgeBase')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Zeiterfassung & Leistung ──────────────────────────── */}
      <div className="staff-dash-time-grid">

        {/* Zeiterfassung */}
        <Card className="staff-dash-panel staff-dash-panel--time">
          <CardHeader className="staff-dash-panel-header">
            <CardTitle>
              <Timer className="h-4 w-4" />
              {t('staffDashboard.timeTracking')}
            </CardTitle>
            <CardDescription>
              {(() => {
                const s = timeStatusInfo(timeStatus?.status)
                return (
                  <span className={`staff-dash-time-status-badge staff-dash-time-status-badge--${s.cls}`}>
                    {t(s.label)}
                  </span>
                )
              })()}
            </CardDescription>
          </CardHeader>
          <CardContent className="staff-dash-panel-content" style={{ paddingTop: "0.15rem" }}>

            <div className="staff-dash-time-filter-row">
              <label htmlFor="staff-dash-time-date">{t('staffDashboard.date')}</label>
              <Input
                id="staff-dash-time-date"
                type="date"
                value={selectedTimeDate}
                onChange={(event) => setSelectedTimeDate(event.target.value)}
                className="staff-dash-time-date-input"
              />
            </div>

            {/* Live clock + active since */}
            <div className="staff-dash-live-clock">
              <span className="staff-dash-clock-digits">{liveTime || "––:––:––"}</span>
              {timeStatus?.lastClockIn && timeStatus.status !== "offline" && (
                <span className="staff-dash-clock-since">
                  {t('staffDashboard.since')} {new Date(timeStatus.lastClockIn).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })} {t('staffDashboard.oclock')}
                </span>
              )}
            </div>

            {/* Hours summary */}
            <div className="staff-dash-time-hours">
              <div>
                <p>{t('staffDashboard.today')}</p>
                <h5>{fmtHours(timeSummary?.summary?.hoursToday)}</h5>
              </div>
              <div>
                <p>{t('staffDashboard.thisWeek')}</p>
                <h5>{fmtHours(timeSummary?.summary?.hoursThisWeek)}</h5>
              </div>
              <div>
                <p>{t('staffDashboard.thisMonth')}</p>
                <h5>{fmtHours(timeSummary?.summary?.hoursThisMonth)}</h5>
              </div>
            </div>

            <div className="staff-dash-time-metrics-grid">
              <div className="staff-dash-time-metric-card">
                <p>{t('staffDashboard.totalWorked')}</p>
                <h5>{fmtHours(timeInsights.totalHoursWorked)}</h5>
              </div>
              <div className="staff-dash-time-metric-card">
                <p>{t('staffDashboard.totalBreak')}</p>
                <h5>{fmtHours(timeInsights.totalBreakHours)}</h5>
              </div>
              <div className="staff-dash-time-metric-card">
                <p>{t('staffDashboard.breakToday')}</p>
                <h5>{fmtHours(timeInsights.breakHoursToday)}</h5>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="staff-dash-time-breakdown-toggle"
              onClick={() => setTimeBreakdownExpanded((current) => !current)}
            >
              <span>{t('staffDashboard.dailyBreakdown')}</span>
              <span className="staff-dash-time-breakdown-toggle-meta">
                {timeBreakdownExpanded ? t('staffDashboard.hide') : t('staffDashboard.show')}
                {timeBreakdownExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </span>
            </Button>

            {timeBreakdownExpanded && (
              <TimeTrackingBreakdown
                compact
                className="staff-dash-time-breakdown"
                breakHours={timeInsights.breakHoursToday}
                breaks={timeInsights.breaksToday}
                orders={timeInsights.ordersToday}
                selectedDate={timeInsights.selectedDate}
              />
            )}

            {/* Action buttons – state-aware */}
            <div className="staff-dash-time-actions">
              {(!timeStatus || timeStatus.status === "offline") && (
                <Button
                  className="staff-dash-time-btn staff-dash-time-btn--in"
                  disabled={timeActionLoading}
                  onClick={handleClockIn}
                >
                  {timeActionLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <LogIn className="h-3.5 w-3.5" />}
                  {t('timeTracking.clockIn')}
                </Button>
              )}
              {(timeStatus?.status === "online" || timeStatus?.status === "working") && (
                <>
                  <Button
                    className="staff-dash-time-btn staff-dash-time-btn--break"
                    disabled={timeActionLoading}
                    onClick={handleStartBreak}
                    variant="outline"
                  >
                    {timeActionLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Coffee className="h-3.5 w-3.5" />}
                    {t('timeTracking.breakStart')}
                  </Button>
                  <Button
                    className="staff-dash-time-btn staff-dash-time-btn--out"
                    disabled={timeActionLoading}
                    onClick={handleClockOut}
                    variant="outline"
                  >
                    {timeActionLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <LogOut className="h-3.5 w-3.5" />}
                    {t('timeTracking.clockOut')}
                  </Button>
                </>
              )}
              {timeStatus?.status === "on_break" && (
                <>
                  <Button
                    className="staff-dash-time-btn staff-dash-time-btn--resume"
                    disabled={timeActionLoading}
                    onClick={handleEndBreak}
                  >
                    {timeActionLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Play className="h-3.5 w-3.5" />}
                    {t('timeTracking.breakEnd')}
                  </Button>
                  <Button
                    className="staff-dash-time-btn staff-dash-time-btn--out"
                    disabled={timeActionLoading}
                    onClick={handleClockOut}
                    variant="outline"
                  >
                    {timeActionLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <LogOut className="h-3.5 w-3.5" />}
                    {t('timeTracking.clockOut')}
                  </Button>
                </>
              )}
            </div>

            <Separator className="staff-dash-sep" />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/staff/time-tracking")}>
              {t('staffDashboard.fullTimeTracking')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Leistungs-Übersicht mit Progress-Balken */}
        <Card className="staff-dash-panel">
          <CardHeader className="staff-dash-panel-header">
            <CardTitle>
              <TrendingUp className="h-4 w-4" />
              {t('staffDashboard.myPerformance')}
            </CardTitle>
            <CardDescription>{t('staffDashboard.orderMetrics')}</CardDescription>
          </CardHeader>
          <CardContent className="staff-dash-perf-content">

            {/* Abgeschlossen */}
            <div className="staff-dash-perf-row">
              <div className="staff-dash-perf-row-head">
                <span>{t('staffDashboard.completedLabel')}</span>
                <strong>
                  {data.orders.length > 0
                    ? `${Math.round((derived.completed / data.orders.length) * 100)}%`
                    : "–"}
                </strong>
              </div>
              <div className="staff-dash-progress">
                <div
                  className="staff-dash-progress-fill staff-dash-progress-fill--green"
                  style={{
                    width: data.orders.length > 0
                      ? `${(derived.completed / data.orders.length) * 100}%`
                      : "0%",
                    height: "100%",
                  }}
                />
              </div>
              <small>{derived.completed} {t('staffDashboard.ofOrders', { total: data.orders.length })}</small>
            </div>

            {/* In Bearbeitung */}
            <div className="staff-dash-perf-row">
              <div className="staff-dash-perf-row-head">
                <span>{t('staffDashboard.inProgress')}</span>
                <strong>
                  {data.orders.length > 0
                    ? `${Math.round((derived.inProgress / data.orders.length) * 100)}%`
                    : "–"}
                </strong>
              </div>
              <div className="staff-dash-progress">
                <div
                  className="staff-dash-progress-fill"
                  style={{
                    width: data.orders.length > 0
                      ? `${(derived.inProgress / data.orders.length) * 100}%`
                      : "0%",
                    height: "100%",
                  }}
                />
              </div>
              <small>{derived.inProgress} {t('staffDashboard.activeRepairs')}</small>
            </div>

            {/* Dringende Fälle */}
            <div className="staff-dash-perf-row">
              <div className="staff-dash-perf-row-head">
                <span>{t('staffDashboard.urgentCases')}</span>
                <strong style={{ color: derived.urgent > 0 ? "#c53030" : undefined }}>
                  {derived.urgent}
                </strong>
              </div>
              <div className="staff-dash-progress">
                <div
                  className={`staff-dash-progress-fill ${derived.urgent > 0 ? "staff-dash-progress-fill--red" : "staff-dash-progress-fill--green"}`}
                  style={{
                    width: data.orders.length > 0
                      ? `${Math.min((derived.urgent / data.orders.length) * 100, 100)}%`
                      : "0%",
                    height: "100%",
                  }}
                />
              </div>
              <small>{t('staffDashboard.highPriority')}</small>
            </div>

            {/* Repair Requests */}
            <div className="staff-dash-perf-row">
              <div className="staff-dash-perf-row-head">
                <span>{t('staffDashboard.repairRequests')}</span>
                <strong>{data.repairRequests.length}</strong>
              </div>
              <div className="staff-dash-progress">
                <div
                  className="staff-dash-progress-fill staff-dash-progress-fill--yellow"
                  style={{ width: `${Math.min(data.repairRequests.length * 8, 100)}%`, height: "100%" }}
                />
              </div>
              <small>{derived.pendingRepairs} {t('staffDashboard.open')}</small>
            </div>

            <Separator className="staff-dash-sep" />
            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/staff/performance")}>
              {t('staffDashboard.performanceOverview')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}