import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import { getAdminOrders, getAssignedOrders, updateOrderStatus } from "@/api/adminOrders"
import { getCommunicationThread as getInspectionCommunication, getPendingFeedbackCount, getUnreadMessageCounts } from "@/api/inspectionCommunication"
import { getInspection } from "@/api/deviceInspection"
import { getRepairWorkflow } from "@/api/repairWorkflow"
import { getManufacturersByDeviceType, getModelsByTypeAndManufacturer } from "@/api/devices"
import { getRepairRequests, updateRepairRequestStatus } from "@/api/repairRequests"
import { startWorkflow, updateWorkflowStatus } from "@/api/workflow"
import { Calendar, Eye, Loader2, MessageSquare, RefreshCw, Search, Smartphone, Workflow } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CommunicationPanel } from "@/components/inspection/CommunicationPanel"

type OrderStatus = "pending" | "in-progress" | "quality-check" | "ready-for-pickup" | "completed"
type RepairRequestStatus = "pending" | "reviewing" | "approved" | "converted" | "rejected"
type WorkflowStatus = "not-started" | "in-progress" | "on-hold" | "completed"

interface AssignedOrder {
  _id: string
  orderNumber: string
  services?: Array<string | { name?: string; title?: string; serviceName?: string }>
  deviceBrand?: string
  deviceModel?: string
  deviceType?: string
  createdAt?: string
  customerId?: { name?: string }
  priority?: "low" | "normal" | "high" | "urgent"
  status?: OrderStatus
  estimatedCompletion?: string
  timeline?: Array<{
    status?: string
    description?: string
    completedAt?: string
  }>
  workflows?: Array<{
    _id?: string
    workflowName?: string
    status?: WorkflowStatus | "in_progress"
    assignedStaffId?: string | { _id?: string }
    assignedStaff?: Array<{ staffId?: string | { _id?: string } }>
    currentStepIndex?: number
    pausedAt?: string
    startedAt?: string
    completedAt?: string
    steps?: Array<{
      stepName?: string
      name?: string
      status?: WorkflowStatus | "in_progress"
      assignedStaffId?: string | { _id?: string }
      assignedStaff?: Array<{ staffId?: string | { _id?: string } }>
    }>
  }>
}

interface AssignedRepairRequest {
  _id: string
  requestNumber?: string
  customerName?: string
  customerId?: { firstName?: string; lastName?: string; name?: string }
  deviceBrand?: string
  deviceModel?: string
  issueDescription?: string
  priority?: "low" | "medium" | "high" | "urgent"
  status?: RepairRequestStatus
}

interface WorkflowCardItem {
  id: string
  orderId: string
  workflowId: string
  orderNumber: string
  workflowName: string
  status: WorkflowStatus
  activeStepLabel: string
}

type DragItem =
  | { type: "order"; id: string; fromStatus: OrderStatus }
  | { type: "repair"; id: string; fromStatus: RepairRequestStatus }
  | { type: "workflow"; id: string; orderId: string; workflowId: string; fromStatus: WorkflowStatus }

const ORDER_COLUMNS: Array<{ key: OrderStatus; title: string }> = [
  { key: "pending", title: "Pending" },
  { key: "in-progress", title: "In Progress" },
  { key: "quality-check", title: "Quality Check" },
  { key: "ready-for-pickup", title: "Ready Pickup" },
  { key: "completed", title: "Completed" },
]

const REPAIR_COLUMNS: Array<{ key: RepairRequestStatus; title: string }> = [
  { key: "pending", title: "Pending" },
  { key: "reviewing", title: "Reviewing" },
  { key: "approved", title: "Approved" },
  { key: "converted", title: "Converted" },
  { key: "rejected", title: "Rejected" },
]

const WORKFLOW_COLUMNS: Array<{ key: WorkflowStatus; title: string }> = [
  { key: "not-started", title: "Not Started" },
  { key: "in-progress", title: "In Progress" },
  { key: "on-hold", title: "On Hold" },
  { key: "completed", title: "Completed" },
]

const safeArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : [])

const toId = (value: unknown) => {
  if (!value) return ""
  if (typeof value === "string") return value
  if (typeof value === "object" && value && "_id" in value) return String((value as { _id?: string })._id || "")
  return String(value)
}

const normalizeWorkflowStatus = (status?: string): WorkflowStatus => {
  const value = String(status || "").toLowerCase()
  if (value === "in_progress" || value === "in-progress") return "in-progress"
  if (value === "on-hold") return "on-hold"
  if (value === "completed") return "completed"
  return "not-started"
}

const isAssignedToStaff = (entity: unknown, staffId?: string) => {
  if (!entity || !staffId) return false
  const entry = entity as {
    assignedStaff?: { id?: string; staffId?: string | { _id?: string } }
    assignedStaffId?: string | { _id?: string }
    assignedTo?: string | { _id?: string }
  }
  const assignedId =
    entry.assignedStaff?.id ??
    (typeof entry.assignedStaff?.staffId === "object" ? entry.assignedStaff?.staffId?._id : undefined) ??
    entry.assignedStaff?.staffId ??
    (typeof entry.assignedStaffId === "object" ? entry.assignedStaffId?._id : undefined) ??
    entry.assignedStaffId ??
    (typeof entry.assignedTo === "object" ? entry.assignedTo?._id : undefined) ??
    entry.assignedTo
  return toId(assignedId) === String(staffId)
}

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case "urgent":
      return "bg-red-600 text-white"
    case "high":
      return "bg-orange-500 text-white"
    case "medium":
    case "normal":
      return "bg-blue-500 text-white"
    default:
      return "bg-slate-500 text-white"
  }
}

const getStatusColor = (status?: string) => {
  switch (status) {
    case "completed":
    case "approved":
    case "converted":
      return "bg-green-600 text-white"
    case "in-progress":
    case "reviewing":
      return "bg-blue-600 text-white"
    case "quality-check":
      return "bg-yellow-500 text-black"
    case "ready-for-pickup":
      return "bg-purple-600 text-white"
    case "on-hold":
    case "rejected":
      return "bg-orange-600 text-white"
    default:
      return "bg-slate-500 text-white"
  }
}

const getStatusBorderColor = (status?: string) => {
  switch (status) {
    case "completed":
    case "approved":
    case "converted":
      return "border-l-green-500"
    case "in-progress":
    case "reviewing":
      return "border-l-blue-500"
    case "quality-check":
      return "border-l-yellow-500"
    case "ready-for-pickup":
      return "border-l-purple-500"
    case "on-hold":
    case "rejected":
      return "border-l-orange-500"
    default:
      return "border-l-slate-400"
  }
}

const getStatusCardBackgroundColor = (status?: string) => {
  switch (status) {
    case "completed":
    case "approved":
    case "converted":
      return "bg-green-50"
    case "in-progress":
    case "reviewing":
      return "bg-blue-50"
    case "quality-check":
      return "bg-yellow-50"
    case "ready-for-pickup":
      return "bg-purple-50"
    case "on-hold":
    case "rejected":
      return "bg-orange-50"
    case "pending":
      return "bg-amber-50"
    default:
      return "bg-background"
  }
}

const getOrderStatusLabel = (status?: string) => {
  switch (String(status || "").toLowerCase()) {
    case "pending":
      return "Pending"
    case "in-progress":
      return "In Progress"
    case "quality-check":
      return "Quality Check"
    case "ready-for-pickup":
      return "Ready Pickup"
    case "completed":
      return "Completed"
    case "approved":
      return "Approved"
    case "converted":
      return "Converted"
    case "reviewing":
      return "Reviewing"
    case "on-hold":
      return "On Hold"
    case "rejected":
      return "Rejected"
    default:
      return String(status || "Unknown")
  }
}

const formatDuration = (durationMs: number) => {
  const totalMinutes = Math.max(0, Math.floor(durationMs / 60000))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  const parts = []
  if (days > 0) parts.push(`${days} Tag${days === 1 ? "" : "e"}`)
  if (hours > 0) parts.push(`${hours} Std.`)
  if (parts.length === 0 && minutes > 0) parts.push(`${minutes} Min.`)
  if (parts.length === 0) parts.push("weniger als 1 Min.")
  return parts.join(" ")
}

const getLatestOrderAction = (order: AssignedOrder) => {
  const timeline = Array.isArray(order.timeline) ? order.timeline : []
  const latestEntry = [...timeline].sort((a, b) => {
    const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0
    const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0
    return timeB - timeA
  })[0]

  return latestEntry?.description || latestEntry?.status || "Auftrag erstellt"
}

const getBookedServiceLabels = (order: AssignedOrder) => {
  const services = Array.isArray(order.services) ? order.services : []
  if (services.length === 0) return []

  return services
    .map((service) =>
      typeof service === "string"
        ? service
        : service?.name || service?.title || service?.serviceName || "Service"
    )
    .filter((serviceLabel) => Boolean(serviceLabel?.trim()))
}

const getOrderDeviceImage = (order: AssignedOrder) => {
  const orderAny = order as any
  const imageCandidates = [
    orderAny.deviceImage,
    orderAny.deviceModelImage,
    orderAny.device?.image,
    orderAny.deviceModel?.image,
    orderAny.deviceModel?.images?.[0]?.url,
    orderAny.deviceModel?.images?.[0]?.base64,
    orderAny.deviceModelId?.image,
    orderAny.deviceModelId?.images?.[0]?.url,
    orderAny.deviceModelId?.images?.[0]?.base64,
  ]

  const image = imageCandidates.find((value) => typeof value === "string" && value.trim())
  return typeof image === "string" ? image : null
}

const getDeviceLabel = (order: AssignedOrder) => {
  const deviceLabel = `${order.deviceBrand || ""} ${order.deviceModel || ""}`.trim()
  return deviceLabel || "Gerät unbekannt"
}

const getPendingDuration = (order: AssignedOrder) => {
  if (String(order.status || "").toLowerCase() !== "pending") return null

  const timeline = Array.isArray(order.timeline) ? order.timeline : []
  const latestPendingEntry = [...timeline]
    .filter((entry) => String(entry.status || "").toLowerCase() === "pending")
    .sort((a, b) => {
      const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return timeB - timeA
    })[0]

  const startTime = latestPendingEntry?.completedAt || order.createdAt
  if (!startTime) return null

  const elapsed = Date.now() - new Date(startTime).getTime()
  if (!Number.isFinite(elapsed) || elapsed < 0) return null

  return formatDuration(elapsed)
}

const getPendingCustomerResponseCount = (communication: { messages?: Array<{ messageType?: string; feedbackRequest?: { status?: string } }> } | null | undefined) => {
  const messages = Array.isArray(communication?.messages) ? communication.messages : []
  return messages.filter(
    (message) => String(message.messageType || "").toLowerCase() === "feedback_request"
      && String(message.feedbackRequest?.status || "").toLowerCase() === "pending"
  ).length
}

export function Schedule() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [orders, setOrders] = useState<AssignedOrder[]>([])
  const [repairRequests, setRepairRequests] = useState<AssignedRepairRequest[]>([])
  const [dragItem, setDragItem] = useState<DragItem | null>(null)
  const [activeDropZone, setActiveDropZone] = useState<string | null>(null)
  const [pendingFeedbackCounts, setPendingFeedbackCounts] = useState<Record<string, number>>({})
  const [unreadMessageCounts, setUnreadMessageCounts] = useState<Record<string, { unread: number; senderType?: string }>>({})
  const [deviceImageByOrderId, setDeviceImageByOrderId] = useState<Record<string, string | null>>({})
  const [inspectionDataByOrderId, setInspectionDataByOrderId] = useState<Record<string, any>>({})
  const [repairWorkflowDataByOrderId, setRepairWorkflowDataByOrderId] = useState<Record<string, any>>({})
  const [communicationDialogOpen, setCommunicationDialogOpen] = useState(false)
  const [selectedCommunicationOrder, setSelectedCommunicationOrder] = useState<{ orderId: string; orderNumber: string } | null>(null)

  const fetchData = useCallback(async (manualRefresh = false) => {
    try {
      if (manualRefresh) setRefreshing(true)
      else setLoading(true)

      const [assignedOrdersResult, adminOrdersResult, assignedRepairResult, allRepairResult] = await Promise.all([
        getAssignedOrders({
          page: 1,
          limit: 120,
          search: searchTerm || undefined,
        }),
        getAdminOrders({
          page: 1,
          limit: 200,
          search: searchTerm || undefined,
        }),
        getRepairRequests({
          assignedStaffId: user?._id,
          page: 1,
          limit: 120,
          search: searchTerm || undefined,
          sortBy: "createdAt",
          sortOrder: "desc",
        }),
        getRepairRequests({
          page: 1,
          limit: 200,
          search: searchTerm || undefined,
          sortBy: "createdAt",
          sortOrder: "desc",
        }),
      ])

      const assignedOrders = safeArray<AssignedOrder>(
        assignedOrdersResult?.orders ?? assignedOrdersResult?.data ?? assignedOrdersResult
      )
      const adminOrders = safeArray<AssignedOrder>(
        adminOrdersResult?.orders ?? adminOrdersResult?.data ?? adminOrdersResult
      )
      const fallbackAssignedOrders = adminOrders.filter((order) => isAssignedToStaff(order, user?._id))
      const nextOrders = assignedOrders.length > 0 ? assignedOrders : fallbackAssignedOrders
      setOrders(nextOrders)

      if (nextOrders.length > 0) {
        const unreadCounts = await getUnreadMessageCounts(nextOrders.map((order) => order._id))
        setUnreadMessageCounts(unreadCounts || {})
      } else {
        setUnreadMessageCounts({})
      }

      const pendingCountsEntries = await Promise.allSettled(
        nextOrders.map(async (order) => [order._id, await getPendingFeedbackCount(order._id)] as const)
      )
      const pendingCountsFallbackOrders = nextOrders.filter((order, index) => {
        const settled = pendingCountsEntries[index]
        return settled?.status !== "fulfilled" || Number(settled.value?.[1] || 0) <= 0
      })

      const communicationFallbackEntries = await Promise.allSettled(
        pendingCountsFallbackOrders.map(async (order) => {
          const communication = await getInspectionCommunication(order._id)
          const count = getPendingCustomerResponseCount(communication?.communication || communication)
          return [order._id, count] as const
        })
      )

      const nextPendingCounts = pendingCountsEntries.reduce<Record<string, number>>((accumulator, result) => {
        if (result.status === "fulfilled") {
          const [orderId, count] = result.value
          accumulator[orderId] = Number(count || 0)
        }
        return accumulator
      }, {})

      communicationFallbackEntries.forEach((result) => {
        if (result.status === "fulfilled") {
          const [orderId, count] = result.value
          if ((nextPendingCounts[orderId] || 0) <= 0 && Number(count || 0) > 0) {
            nextPendingCounts[orderId] = Number(count || 0)
          }
        }
      })

      setPendingFeedbackCounts(nextPendingCounts)

      const assignedRepairs = safeArray<AssignedRepairRequest>(
        assignedRepairResult?.requests ??
        assignedRepairResult?.repairRequests ??
        assignedRepairResult?.data ??
        assignedRepairResult
      )
      const allRepairs = safeArray<AssignedRepairRequest>(
        allRepairResult?.requests ??
        allRepairResult?.repairRequests ??
        allRepairResult?.data ??
        allRepairResult
      )
      const fallbackAssignedRepairs = allRepairs.filter((request) => isAssignedToStaff(request, user?._id))
      setRepairRequests(assignedRepairs.length > 0 ? assignedRepairs : fallbackAssignedRepairs)
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: error instanceof Error ? error.message : "Daten konnten nicht geladen werden.",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [searchTerm, toast, user?._id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    let isCancelled = false

    const normalize = (value: string = "") => value.toLowerCase().replace(/\s+/g, " ").trim()
    const pickImageUrl = (value: unknown): string | null => {
      return typeof value === "string" && value.trim() ? value.trim() : null
    }

    const resolveImages = async () => {
      if (!orders.length) {
        setDeviceImageByOrderId({})
        return
      }

      const directImages: Record<string, string | null> = {}
      const unresolvedByKey: Record<string, AssignedOrder[]> = {}
      const manufacturerIdsByType: Record<string, Record<string, string>> = {}

      const uniqueDeviceTypes = [...new Set(orders.map((order) => normalize(order.deviceType || "smartphone") || "smartphone"))]

      await Promise.all(
        uniqueDeviceTypes.map(async (deviceType) => {
          try {
            const response = await getManufacturersByDeviceType(deviceType)
            const manufacturers = Array.isArray((response as any)?.manufacturers) ? (response as any).manufacturers : []
            manufacturerIdsByType[deviceType] = manufacturers.reduce<Record<string, string>>((accumulator, manufacturer) => {
              const normalizedName = normalize(manufacturer.name || manufacturer.displayName || manufacturer.slug || "")
              const manufacturerId = String(manufacturer._id || manufacturer.id || "")
              if (normalizedName && manufacturerId) {
                accumulator[normalizedName] = manufacturerId
              }
              return accumulator
            }, {})
          } catch (error) {
            console.error("Schedule: Failed to load manufacturers:", error)
            manufacturerIdsByType[deviceType] = {}
          }
        })
      )

      orders.forEach((order) => {
        const orderAny = order as any
        const directCandidates: unknown[] = [
          orderAny.deviceImage,
          orderAny.deviceModelImage,
          orderAny.device?.image,
          orderAny.deviceModel?.image,
          orderAny.deviceModelId?.image,
          orderAny.deviceModelId?.images?.[0]?.url,
          orderAny.deviceModelId?.images?.[0]?.base64,
        ]

        const directImage = directCandidates
          .map((candidate) => pickImageUrl(candidate))
          .find((candidate): candidate is string => Boolean(candidate))

        if (directImage) {
          directImages[order._id] = directImage
          return
        }

        const key = `${normalize(order.deviceType || "smartphone")}|${normalize(order.deviceBrand)}|${normalize(order.deviceModel)}`
        if (!unresolvedByKey[key]) {
          unresolvedByKey[key] = []
        }
        unresolvedByKey[key].push(order)
      })

      const resolvedByKey: Record<string, string | null> = {}

      await Promise.all(
        Object.entries(unresolvedByKey).map(async ([key, keyOrders]) => {
          const sample = keyOrders[0]
          const deviceType = normalize(sample.deviceType || "smartphone") || "smartphone"
          const manufacturerKey = normalize(sample.deviceBrand)
          const manufacturerId = manufacturerIdsByType[deviceType]?.[manufacturerKey]

          try {
            if (manufacturerId) {
              const response = await getModelsByTypeAndManufacturer(deviceType, manufacturerId)
              const models = Array.isArray((response as any)?.models) ? (response as any).models : []
              const modelName = normalize(sample.deviceModel)

              const exactModel = models.find((model) => {
                const name = normalize(model.name)
                const displayName = normalize(model.displayName)
                return Boolean(model.image) && (name === modelName || displayName === modelName)
              })

              const fuzzyModel = models.find((model) => {
                const name = normalize(model.name)
                const displayName = normalize(model.displayName)
                return Boolean(model.image) && (displayName.includes(modelName) || modelName.includes(name))
              })

              const bestMatch = exactModel || fuzzyModel || models.find((model) => Boolean(model.image))
              resolvedByKey[key] = bestMatch?.image || null
              return
            }

            resolvedByKey[key] = null
          } catch (error) {
            console.error("Schedule: Failed to resolve model image:", error)
            resolvedByKey[key] = null
          }
        })
      )

      const nextByOrderId: Record<string, string | null> = {}
      orders.forEach((order) => {
        const key = `${normalize(order.deviceType || "smartphone")}|${normalize(order.deviceBrand)}|${normalize(order.deviceModel)}`
        nextByOrderId[order._id] = directImages[order._id] || resolvedByKey[key] || null
      })

      if (!isCancelled) {
        setDeviceImageByOrderId(nextByOrderId)
      }
    }

    resolveImages()

    return () => {
      isCancelled = true
    }
  }, [orders])

  // Load inspection data for all orders
  useEffect(() => {
    let isCancelled = false

    const loadInspections = async () => {
      if (!orders.length) {
        setInspectionDataByOrderId({})
        return
      }

      const inspectionData: Record<string, any> = {}
      
      await Promise.all(
        orders.map(async (order) => {
          try {
            const result = await getInspection(order._id)
            if (!isCancelled && result?.inspection) {
              inspectionData[order._id] = result.inspection
            }
          } catch (error) {
            // Silently handle inspection load errors
            inspectionData[order._id] = null
          }
        })
      )

      if (!isCancelled) {
        setInspectionDataByOrderId(inspectionData)
      }
    }

    loadInspections()

    return () => {
      isCancelled = true
    }
  }, [orders])

  // Load repair workflow data for all orders
  useEffect(() => {
    let isCancelled = false

    const loadRepairWorkflows = async () => {
      if (!orders.length) {
        setRepairWorkflowDataByOrderId({})
        return
      }

      const workflowData: Record<string, any> = {}
      
      await Promise.all(
        orders.map(async (order) => {
          try {
            const result = await getRepairWorkflow(order._id)
            if (!isCancelled) {
              // Handle both response formats: { workflow: {...} } or direct {...}
              const workflow = (result as any)?.workflow || result
              if (workflow && workflow._id) {
                workflowData[order._id] = workflow
              }
            }
          } catch (error) {
            // Silently handle repair workflow load errors
            workflowData[order._id] = null
          }
        })
      )

      if (!isCancelled) {
        setRepairWorkflowDataByOrderId(workflowData)
      }
    }

    loadRepairWorkflows()

    return () => {
      isCancelled = true
    }
  }, [orders])

  const assignedWorkflows = useMemo<WorkflowCardItem[]>(() => {
    const myStaffId = String(user?._id || "")

    return orders
      .flatMap((order) => {
        const workflows = Array.isArray(order.workflows) ? order.workflows : []
        return workflows
          .filter((workflow) => {
            const workflowAssignedIds = [
              toId(workflow.assignedStaffId),
              ...(Array.isArray(workflow.assignedStaff)
                ? workflow.assignedStaff.map((assignment) => toId(assignment?.staffId))
                : []),
            ].filter(Boolean)

            if (workflowAssignedIds.includes(myStaffId)) return true

            return Array.isArray(workflow.steps) && workflow.steps.some((step) => {
              const stepAssignedIds = [
                toId(step.assignedStaffId),
                ...(Array.isArray(step.assignedStaff)
                  ? step.assignedStaff.map((assignment) => toId(assignment?.staffId))
                  : []),
              ].filter(Boolean)
              return stepAssignedIds.includes(myStaffId)
            })
          })
          .map((workflow) => {
            const status = normalizeWorkflowStatus(workflow.status)
            const steps = Array.isArray(workflow.steps) ? workflow.steps : []
            const currentStepIndex = Number.isInteger(workflow.currentStepIndex)
              ? Math.min(Math.max(Number(workflow.currentStepIndex), 0), Math.max(steps.length - 1, 0))
              : Math.max(steps.findIndex((step) => normalizeWorkflowStatus(step.status) === "in-progress"), 0)
            const currentStep = steps[currentStepIndex]

            return {
              id: `${order._id}-${String(workflow._id || workflow.workflowName || "workflow")}`,
              orderId: order._id,
              workflowId: String(workflow._id || ""),
              orderNumber: order.orderNumber || order._id.slice(-6),
              workflowName: workflow.workflowName || "Workflow",
              status,
              activeStepLabel: currentStep?.stepName || currentStep?.name || "Kein Step aktiv",
            }
          })
      })
      .sort((a, b) => a.orderNumber.localeCompare(b.orderNumber))
  }, [orders, user?._id])

  const groupedOrders = useMemo(() => {
    const data: Record<OrderStatus, AssignedOrder[]> = {
      pending: [],
      "in-progress": [],
      "quality-check": [],
      "ready-for-pickup": [],
      completed: [],
    }
    orders.forEach((order) => {
      const rawStatus = String(order.status || "pending").toLowerCase()
      const normalizedStatus = rawStatus === "in_progress" ? "in-progress" : rawStatus
      const status: OrderStatus = (
        ORDER_COLUMNS.some((column) => column.key === normalizedStatus)
          ? normalizedStatus
          : "pending"
      ) as OrderStatus
      data[status]?.push(order)
    })
    return data
  }, [orders])

  const groupedRepairRequests = useMemo(() => {
    const data: Record<RepairRequestStatus, AssignedRepairRequest[]> = {
      pending: [],
      reviewing: [],
      approved: [],
      converted: [],
      rejected: [],
    }
    repairRequests.forEach((request) => {
      const rawStatus = String(request.status || "pending").toLowerCase()
      const status: RepairRequestStatus = (
        REPAIR_COLUMNS.some((column) => column.key === rawStatus)
          ? rawStatus
          : "pending"
      ) as RepairRequestStatus
      data[status]?.push(request)
    })
    return data
  }, [repairRequests])

  const groupedWorkflows = useMemo(() => {
    const data: Record<WorkflowStatus, WorkflowCardItem[]> = {
      "not-started": [],
      "in-progress": [],
      "on-hold": [],
      completed: [],
    }
    assignedWorkflows.forEach((workflow) => {
      data[workflow.status].push(workflow)
    })
    return data
  }, [assignedWorkflows])

  const getRequestCustomerName = (request: AssignedRepairRequest) => {
    if (request.customerName) return request.customerName
    const firstName = request.customerId?.firstName || ""
    const lastName = request.customerId?.lastName || ""
    const fullName = `${firstName} ${lastName}`.trim()
    return fullName || request.customerId?.name || "Unbekannt"
  }

  const onOrderDrop = async (toStatus: OrderStatus) => {
    if (!dragItem || dragItem.type !== "order") return
    if (dragItem.fromStatus === toStatus) {
      setDragItem(null)
      setActiveDropZone(null)
      return
    }

    try {
      setOrders((prev) =>
        prev.map((order) => (order._id === dragItem.id ? { ...order, status: toStatus } : order))
      )
      await updateOrderStatus(dragItem.id, toStatus)
      toast({ title: "Order-Status aktualisiert", description: `Neuer Status: ${toStatus}` })
    } catch (error: unknown) {
      await fetchData()
      toast({
        variant: "destructive",
        title: "Statusänderung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Order-Status konnte nicht aktualisiert werden.",
      })
    } finally {
      setDragItem(null)
      setActiveDropZone(null)
    }
  }

  const onRepairDrop = async (toStatus: RepairRequestStatus) => {
    if (!dragItem || dragItem.type !== "repair") return
    if (dragItem.fromStatus === toStatus) {
      setDragItem(null)
      setActiveDropZone(null)
      return
    }

    try {
      setRepairRequests((prev) =>
        prev.map((request) => (request._id === dragItem.id ? { ...request, status: toStatus } : request))
      )
      await updateRepairRequestStatus(dragItem.id, toStatus)
      toast({ title: "Repair-Request Status aktualisiert", description: `Neuer Status: ${toStatus}` })
    } catch (error: unknown) {
      await fetchData()
      toast({
        variant: "destructive",
        title: "Statusänderung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Repair-Request Status konnte nicht aktualisiert werden.",
      })
    } finally {
      setDragItem(null)
      setActiveDropZone(null)
    }
  }

  const onWorkflowDrop = async (toStatus: WorkflowStatus) => {
    if (!dragItem || dragItem.type !== "workflow") return
    if (dragItem.fromStatus === toStatus) {
      setDragItem(null)
      setActiveDropZone(null)
      return
    }

    try {
      if (!dragItem.workflowId) {
        throw new Error("Workflow-ID fehlt. Bitte Seite aktualisieren.")
      }
      if (toStatus === "completed") {
        throw new Error("Workflow kann hier nicht direkt auf 'completed' gesetzt werden.")
      }
      if (toStatus === "not-started") {
        throw new Error("Workflow kann nicht zurück auf 'not-started' gesetzt werden.")
      }

      if (toStatus === "in-progress") {
        if (dragItem.fromStatus === "not-started") {
          await startWorkflow(dragItem.orderId, dragItem.workflowId)
        } else {
          await updateWorkflowStatus(dragItem.orderId, dragItem.workflowId, "in-progress")
        }
      }

      if (toStatus === "on-hold") {
        await updateWorkflowStatus(dragItem.orderId, dragItem.workflowId, "on-hold")
      }

      setOrders((prev) =>
        prev.map((order) => ({
          ...order,
          workflows: safeArray(order.workflows).map((workflow) =>
            String(workflow._id || "") === dragItem.workflowId
              ? { ...workflow, status: toStatus }
              : workflow
          ),
        }))
      )

      toast({ title: "Workflow-Status aktualisiert", description: `Neuer Status: ${toStatus}` })
    } catch (error: unknown) {
      await fetchData()
      toast({
        variant: "destructive",
        title: "Workflow-Status konnte nicht geändert werden",
        description: error instanceof Error ? error.message : "Bitte später erneut versuchen.",
      })
    } finally {
      setDragItem(null)
      setActiveDropZone(null)
    }
  }

  const getDropZoneClass = (dropZoneKey: string, isAllowed: boolean) => {
    if (activeDropZone !== dropZoneKey) return "border bg-muted/25"
    return isAllowed
      ? "border-2 border-primary/60 bg-primary/10 shadow-sm"
      : "border-2 border-red-500/60 bg-red-500/10"
  }

  const openCommunicationDialog = (order: AssignedOrder) => {
    setSelectedCommunicationOrder({
      orderId: order._id,
      orderNumber: order.orderNumber || order._id.slice(-6),
    })
    setCommunicationDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <Card className="animate-pulse">
          <CardContent className="pt-6">
            <div className="space-y-3">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-16 rounded bg-muted" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Calendar className="h-6 w-6" />
            Schedule Board (Kanban)
          </h1>
          <p className="text-sm text-muted-foreground">
            Alternativer Überblick für Assigned Orders, Repair Requests und Workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Suchen..."
              className="w-[240px] pl-9"
            />
          </div>
          <Button variant="outline" onClick={() => fetchData(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Aktualisieren
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Assigned Orders</p>
            <p className="text-2xl font-bold">{orders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Assigned Repair Requests</p>
            <p className="text-2xl font-bold">{repairRequests.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Abzuarbeitende Workflows</p>
            <p className="text-2xl font-bold">{assignedWorkflows.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assigned Orders</CardTitle>
          <CardDescription>Kanban nach Order-Status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {ORDER_COLUMNS.map((column) => (
              <div
                key={column.key}
                className={`space-y-3 rounded-lg p-3 transition-colors ${getDropZoneClass(
                  `order:${column.key}`,
                  Boolean(dragItem?.type === "order" && dragItem.fromStatus !== column.key)
                )}`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setActiveDropZone(`order:${column.key}`)
                }}
                onDrop={() => onOrderDrop(column.key)}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{column.title}</p>
                  <Badge variant="secondary">{groupedOrders[column.key].length}</Badge>
                </div>
                {groupedOrders[column.key].length === 0 ? (
                  <p className="text-xs text-muted-foreground">Keine Einträge</p>
                ) : (
                  groupedOrders[column.key].map((order) => {
                    const pendingDuration = getPendingDuration(order)
                    const bookedServices = getBookedServiceLabels(order)
                    const deviceImage = deviceImageByOrderId[order._id] || getOrderDeviceImage(order)
                    const visibleServices = bookedServices.slice(0, 3)
                    const hiddenServicesCount = Math.max(0, bookedServices.length - visibleServices.length)
                    const pendingFeedbackCount = Number(pendingFeedbackCounts[order._id] || 0)
                    const hasPendingCustomerResponse = pendingFeedbackCount > 0
                    const unreadInfo = unreadMessageCounts[order._id]
                    const unreadCount = Number(unreadInfo?.unread || 0)
                    const hasCustomerReply = unreadCount > 0 && String(unreadInfo?.senderType || "").toLowerCase() === "customer"

                    return (
                      <div
                        key={order._id}
                        role="button"
                        tabIndex={0}
                        draggable
                        onDragStart={() =>
                          setDragItem({ type: "order", id: order._id, fromStatus: column.key })
                        }
                        onDragEnd={() => {
                          setDragItem(null)
                          setActiveDropZone(null)
                        }}
                        onClick={() => navigate(`/orders/${order._id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            navigate(`/orders/${order._id}`)
                          }
                        }}
                        className={`w-full rounded-md border-l-4 p-3 text-left transition hover:border-primary/40 ${getStatusBorderColor(order.status)} ${getStatusCardBackgroundColor(order.status)}`}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-none">{order.orderNumber || order._id.slice(-6)}</p>
                            <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">Auftrag</p>
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/40 p-2">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Letzte Aktion</p>
                          <p className="mt-0.5 text-sm font-semibold leading-snug text-foreground">
                            {getLatestOrderAction(order)}
                          </p>
                        </div>

                        {/* Status-Übersicht: Inspection, Ersatzteile, Workflows */}
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          {/* Device Inspection Status */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/orders/${order._id}#order-device-inspection`)
                            }}
                            className="rounded-md p-2 text-left transition border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 group"
                            title="Zur Geräteprüfung"
                          >
                            <p className="text-[9px] font-semibold uppercase text-slate-500 truncate">Prüfung</p>
                            <div className="mt-0.5 space-y-1">
                              {(() => {
                                const inspection = inspectionDataByOrderId[order._id]
                                const status = inspection?.status || "not-started"
                                const isCompleted = status === "completed"
                                const isInProgress = status === "in-progress"
                                const bgColor = isCompleted ? "bg-emerald-100" : isInProgress ? "bg-blue-100" : "bg-slate-100"
                                const textColor = isCompleted ? "text-emerald-700" : isInProgress ? "text-blue-700" : "text-slate-600"
                                const label = isCompleted ? "✓" : isInProgress ? "→" : "○"
                                
                                return (
                                  <>
                                    <div className="flex items-center gap-1">
                                      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full ${bgColor} ${textColor} text-[10px] font-bold`}>
                                        {label}
                                      </span>
                                      <span className="text-[10px] font-medium text-slate-700 truncate">
                                        {isCompleted ? "Fertig" : isInProgress ? "Läuft" : "Offen"}
                                      </span>
                                    </div>
                                    
                                    {/* Progress indicator for in-progress */}
                                    {isInProgress && inspection && (
                                      <div className="text-[9px] text-muted-foreground space-y-0.5">
                                        {inspection.modelVerification && (
                                          <div className="truncate">Modell: {inspection.modelVerification.actualModel?.slice(0, 12)}…</div>
                                        )}
                                        {inspection.deviceTest && (
                                          <div className="truncate">
                                            Tests: {[inspection.deviceTest.charging, inspection.deviceTest.power, inspection.deviceTest.wifi]
                                              .filter(t => t?.status === 'OK').length}/3 ✓
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Completion summary */}
                                    {isCompleted && inspection && (
                                      <div className="text-[9px] text-muted-foreground space-y-0.5">
                                        {inspection.isRepairable !== undefined && (
                                          <div className="truncate">
                                            {inspection.isRepairable ? "♻ Reparierbar" : "✗ Nicht reparierbar"}
                                          </div>
                                        )}
                                        {inspection.hasFailedTests && (
                                          <div className="truncate text-red-600 font-medium">Fehler gefunden</div>
                                        )}
                                        {!inspection.hasFailedTests && (
                                          <div className="truncate text-emerald-600">Alle Tests bestanden</div>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )
                              })()}
                            </div>
                          </button>

                          {/* Ersatzteile Status */}
                          {(() => {
                            const eparts = (order as any)?.eParts || []
                            const needListEntries = (order as any)?.ePartNeedListEntries || []
                            if (eparts.length === 0 && needListEntries.length === 0) {
                              return null
                            }
                            
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(`/orders/${order._id}#order-eparts`)
                                }}
                                className="rounded-md p-2 text-left transition border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50"
                                title="Zu den Ersatzteilen"
                              >
                                <p className="text-[9px] font-semibold uppercase text-slate-500 truncate">Teile</p>
                                <div className="mt-0.5 space-y-1">
                                  {(() => {
                                    // Count by status
                                    const used = eparts.filter((p: any) => p.status === 'used').length
                                    const allocated = eparts.filter((p: any) => p.status === 'allocated').length
                                    const inStock = eparts.filter((p: any) => !p.status || (p.status !== 'used' && p.status !== 'allocated')).length
                                    const onOrder = needListEntries.length
                                    
                                    const totalParts = eparts.length
                                    
                                    return (
                                      <>
                                        <div className="flex items-center gap-1">
                                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                                            {(totalParts + onOrder) > 9 ? "+" : (totalParts + onOrder)}
                                          </span>
                                          <span className="text-[10px] font-medium text-slate-700 truncate">
                                            {(totalParts + onOrder) === 1 ? "1 Teil" : `${totalParts + onOrder} Teile`}
                                          </span>
                                        </div>
                                        
                                        {/* Status breakdown */}
                                        <div className="text-[9px] text-muted-foreground space-y-0.5">
                                          {used > 0 && (
                                            <div className="truncate">✓ {used} verwendet</div>
                                          )}
                                          {allocated > 0 && (
                                            <div className="truncate">→ {allocated} reserviert</div>
                                          )}
                                          {inStock > 0 && (
                                            <div className="truncate">✓ {inStock} vorhanden</div>
                                          )}
                                          {onOrder > 0 && (
                                            <div className="truncate text-amber-600">◆ {onOrder} bestellt</div>
                                          )}
                                        </div>
                                      </>
                                    )
                                  })()}
                                </div>
                              </button>
                            )
                          })()}

                          {/* Workflow Status */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/orders/${order._id}#order-workflow`)
                            }}
                            className="rounded-md p-2 text-left transition border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50"
                            title="Zu den Workflows"
                          >
                            <p className="text-[9px] font-semibold uppercase text-slate-500 truncate">Workflow</p>
                            <div className="mt-0.5 space-y-1">
                              {(() => {
                                const repairWorkflow = repairWorkflowDataByOrderId[order._id]
                                
                                if (!repairWorkflow) {
                                  return (
                                    <div className="flex items-center gap-1">
                                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">-</span>
                                      <span className="text-[10px] font-medium text-slate-600 truncate">Keine</span>
                                    </div>
                                  )
                                }

                                const status = repairWorkflow.status || "not-started"
                                let statusLabel = ""
                                let statusColor = ""
                                let statusBgColor = ""
                                let statusIcon = ""

                                if (status === "pending-confirmation") {
                                  statusLabel = "Freigabe erforderlich"
                                  statusColor = "text-slate-600"
                                  statusBgColor = "bg-slate-100"
                                  statusIcon = "○"
                                } else if (status === "in-progress") {
                                  statusLabel = "In Bearbeitung"
                                  statusColor = "text-purple-700"
                                  statusBgColor = "bg-purple-100"
                                  statusIcon = "→"
                                } else if (status === "paused") {
                                  statusLabel = "Pausiert"
                                  statusColor = "text-amber-700"
                                  statusBgColor = "bg-amber-100"
                                  statusIcon = "⏸"
                                } else if (status === "incident") {
                                  statusLabel = "Zwischenfall"
                                  statusColor = "text-red-700"
                                  statusBgColor = "bg-red-100"
                                  statusIcon = "!"
                                } else if (status === "completed") {
                                  statusLabel = "Fertig"
                                  statusColor = "text-emerald-700"
                                  statusBgColor = "bg-emerald-100"
                                  statusIcon = "✓"
                                }

                                return (
                                  <>
                                    <div className="flex items-center gap-1">
                                      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full ${statusBgColor} ${statusColor} text-[10px] font-bold`}>
                                        {statusIcon}
                                      </span>
                                      <span className="text-[10px] font-medium text-slate-700 truncate">
                                        {statusLabel}
                                      </span>
                                    </div>

                                    {/* Duration info */}
                                    {repairWorkflow.timerData?.startedAt && (
                                      <div className="text-[9px] text-muted-foreground space-y-0.5">
                                        {status === "in-progress" && (
                                          <>
                                            {(() => {
                                              const startedAt = new Date(repairWorkflow.timerData.startedAt).getTime()
                                              const endTime = Date.now()
                                              const totalMs = endTime - startedAt - (repairWorkflow.timerData.totalPausedMs || 0)
                                              const hrs = Math.floor(totalMs / 3600000)
                                              const mins = Math.floor((totalMs % 3600000) / 60000)
                                              return (
                                                <div className="truncate">
                                                  ⏱ {hrs > 0 ? `${hrs}h ${mins}min` : `${mins}min`}
                                                </div>
                                              )
                                            })()}
                                            {repairWorkflow.timerData?.pauseHistory?.length > 0 && (
                                              <div className="truncate text-amber-600">
                                                ⏸ {repairWorkflow.timerData.pauseHistory.length}x pausiert
                                              </div>
                                            )}
                                            {repairWorkflow.incidents?.length > 0 && (
                                              <div className="truncate text-red-600">
                                                ! {repairWorkflow.incidents.length} Zwischenfall{repairWorkflow.incidents.length > 1 ? 'e' : ''}
                                              </div>
                                            )}
                                          </>
                                        )}
                                        {status === "paused" && (
                                          <>
                                            <div className="truncate">
                                              ⏸ Pausiert seit {repairWorkflow.timerData.pausedAt 
                                                ? new Date(repairWorkflow.timerData.pausedAt).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })
                                                : "—"
                                              }
                                            </div>
                                            {repairWorkflow.timerData?.pauseHistory?.length > 0 && (
                                              <div className="truncate text-amber-600">
                                                {repairWorkflow.timerData.pauseHistory.length}x pausiert
                                              </div>
                                            )}
                                          </>
                                        )}
                                        {status === "incident" && (
                                          <div className="truncate text-red-600">
                                            {repairWorkflow.incidents?.length || 1} Zwischenfall{(repairWorkflow.incidents?.length || 1) > 1 ? 'e' : ''}
                                          </div>
                                        )}
                                        {status === "completed" && (
                                          <div className="truncate text-emerald-600">
                                            Fertig: {new Date(repairWorkflow.timerData.completedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )
                              })()}
                            </div>
                          </button>
                        </div>

                        <div className="mt-2 space-y-2">
                          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 shadow-sm">
                            <div className="flex gap-2">
                              {deviceImage ? (
                                <img
                                  src={deviceImage}
                                  alt={`${order.deviceBrand || ""} ${order.deviceModel || ""}`.trim() || "Gerät"}
                                  className="h-14 w-14 shrink-0 rounded-md border border-slate-200 bg-white object-cover shadow-sm"
                                  onError={(event) => {
                                    event.currentTarget.style.display = "none"
                                    const fallback = event.currentTarget.nextElementSibling as HTMLElement | null
                                    if (fallback) fallback.style.display = "flex"
                                  }}
                                />
                              ) : null}
                              <div
                                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-slate-200 text-slate-500"
                                style={{ display: deviceImage ? "none" : "flex" }}
                              >
                                <Smartphone className="h-6 w-6" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Geräteinformationen</p>
                                <p className="mt-0.5 truncate text-xs font-semibold text-foreground">{getDeviceLabel(order)}</p>
                                <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Repair Services</p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {visibleServices.length > 0 ? (
                                    <>
                                      {visibleServices.map((serviceLabel, index) => (
                                        <Badge
                                          key={`${order._id}-device-service-${index}`}
                                          variant="outline"
                                          className="border-blue-300 bg-white/90 px-2 py-0.5 text-[10px] font-medium text-blue-900"
                                        >
                                          {serviceLabel}
                                        </Badge>
                                      ))}
                                      {hiddenServicesCount > 0 && (
                                        <Badge
                                          variant="outline"
                                          className="border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                                        >
                                          +{hiddenServicesCount}
                                        </Badge>
                                      )}
                                    </>
                                  ) : (
                                    <p className="text-xs font-medium text-muted-foreground">Kein Service hinterlegt</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          {pendingDuration && (
                            <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                              Pending seit {pendingDuration}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${hasCustomerReply
                              ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                              : hasPendingCustomerResponse
                                ? "border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100"
                                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
                            title={hasCustomerReply
                              ? `Kundenantwort eingegangen (${unreadCount})`
                              : hasPendingCustomerResponse
                              ? `Kundenantwort erwartet (${pendingFeedbackCount})`
                              : "Kundenkommunikation öffnen"
                            }
                            aria-label={hasCustomerReply
                              ? `Kundenantwort eingegangen (${unreadCount})`
                              : hasPendingCustomerResponse
                              ? `Kundenantwort erwartet (${pendingFeedbackCount})`
                              : "Kundenkommunikation öffnen"
                            }
                            onClick={(event) => {
                              event.stopPropagation()
                              openCommunicationDialog(order)
                            }}
                          >
                            <MessageSquare className={`h-3.5 w-3.5 ${hasPendingCustomerResponse || hasCustomerReply ? "animate-pulse" : ""}`} />
                            {(hasCustomerReply || hasPendingCustomerResponse) && (
                              <span className={`absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-4 text-white ${hasCustomerReply ? "bg-green-600" : "bg-amber-500"}`}>
                                {(hasCustomerReply ? unreadCount : pendingFeedbackCount) > 99 ? "99+" : (hasCustomerReply ? unreadCount : pendingFeedbackCount)}
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                            title="Auftrag öffnen"
                            aria-label="Auftrag öffnen"
                            onClick={(event) => {
                              event.stopPropagation()
                              navigate(`/orders/${order._id}`)
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={communicationDialogOpen && !!selectedCommunicationOrder}
        onOpenChange={(open) => {
          setCommunicationDialogOpen(open)
          if (!open) {
            setSelectedCommunicationOrder(null)
          }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="sr-only">Kundenkommunikation</DialogTitle>
            <DialogDescription className="sr-only">
              Kundenkommunikation des ausgewählten Auftrags einsehen und verwalten.
            </DialogDescription>
          </DialogHeader>

          {selectedCommunicationOrder && (
            <div className="px-6 pb-6">
              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    <h4 className="font-medium text-sm">Kundenkommunikation</h4>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {selectedCommunicationOrder.orderNumber}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Kundenfeedback, Anfragen und Rückfragen zentral verwalten.
                </p>
                <div className="rounded-lg border p-2 bg-background">
                  <CommunicationPanel
                    orderId={selectedCommunicationOrder.orderId}
                    inspectionId={selectedCommunicationOrder.orderId}
                    entityType="order"
                  />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Assigned Repair Requests</CardTitle>
          <CardDescription>Kanban nach Request-Status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {REPAIR_COLUMNS.map((column) => (
              <div
                key={column.key}
                className={`space-y-3 rounded-lg p-3 transition-colors ${getDropZoneClass(
                  `repair:${column.key}`,
                  Boolean(dragItem?.type === "repair" && dragItem.fromStatus !== column.key)
                )}`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setActiveDropZone(`repair:${column.key}`)
                }}
                onDrop={() => onRepairDrop(column.key)}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{column.title}</p>
                  <Badge variant="secondary">{groupedRepairRequests[column.key].length}</Badge>
                </div>
                {groupedRepairRequests[column.key].length === 0 ? (
                  <p className="text-xs text-muted-foreground">Keine Einträge</p>
                ) : (
                  groupedRepairRequests[column.key].map((request) => (
                    <button
                      key={request._id}
                      type="button"
                      draggable
                      onDragStart={() =>
                        setDragItem({ type: "repair", id: request._id, fromStatus: column.key })
                      }
                      onDragEnd={() => {
                        setDragItem(null)
                        setActiveDropZone(null)
                      }}
                      className="w-full rounded-md border bg-background p-3 text-left transition hover:border-primary/40"
                      onClick={() => navigate(`/staff/repair-requests?requestId=${encodeURIComponent(request._id)}`)}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{request.requestNumber || request._id.slice(-8)}</p>
                        <Badge className={getPriorityColor(request.priority)}>{request.priority || "medium"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{getRequestCustomerName(request)}</p>
                      <p className="text-xs text-muted-foreground">{request.deviceBrand || "-"} {request.deviceModel || ""}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{request.issueDescription || "-"}</p>
                    </button>
                  ))
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Abzuarbeitende Workflows
          </CardTitle>
          <CardDescription>Kanban nach Workflow-Status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {WORKFLOW_COLUMNS.map((column) => (
              <div
                key={column.key}
                className={`space-y-3 rounded-lg p-3 transition-colors ${getDropZoneClass(
                  `workflow:${column.key}`,
                  Boolean(
                    dragItem?.type === "workflow" &&
                    dragItem.fromStatus !== column.key &&
                    column.key !== "completed" &&
                    column.key !== "not-started"
                  )
                )}`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setActiveDropZone(`workflow:${column.key}`)
                }}
                onDrop={() => onWorkflowDrop(column.key)}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{column.title}</p>
                  <Badge variant="secondary">{groupedWorkflows[column.key].length}</Badge>
                </div>
                {groupedWorkflows[column.key].length === 0 ? (
                  <p className="text-xs text-muted-foreground">Keine Einträge</p>
                ) : (
                  groupedWorkflows[column.key].map((workflow) => (
                    <button
                      key={workflow.id}
                      type="button"
                      draggable
                      onDragStart={() =>
                        setDragItem({
                          type: "workflow",
                          id: workflow.id,
                          orderId: workflow.orderId,
                          workflowId: workflow.workflowId,
                          fromStatus: column.key,
                        })
                      }
                      onDragEnd={() => {
                        setDragItem(null)
                        setActiveDropZone(null)
                      }}
                      className="w-full rounded-md border bg-background p-3 text-left transition hover:border-primary/40"
                      onClick={() => navigate(`/orders/${workflow.orderId}`)}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{workflow.workflowName}</p>
                        <Badge className={getStatusColor(workflow.status)}>{workflow.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Order: {workflow.orderNumber}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Aktiver Step: {workflow.activeStepLabel}</p>
                    </button>
                  ))
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}