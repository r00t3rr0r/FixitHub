import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import { getAdminOrders, getAssignedOrders, updateOrderStatus } from "@/api/adminOrders"
import { getRepairRequests, updateRepairRequestStatus } from "@/api/repairRequests"
import { startWorkflow, updateWorkflowStatus } from "@/api/workflow"
import { Calendar, Eye, Loader2, RefreshCw, Search, Workflow } from "lucide-react"

type OrderStatus = "pending" | "in-progress" | "quality-check" | "ready-for-pickup" | "completed"
type RepairRequestStatus = "pending" | "reviewing" | "approved" | "converted" | "rejected"
type WorkflowStatus = "not-started" | "in-progress" | "on-hold" | "completed"

interface AssignedOrder {
  _id: string
  orderNumber: string
  deviceBrand?: string
  deviceModel?: string
  customerId?: { name?: string }
  priority?: "low" | "normal" | "high" | "urgent"
  status?: OrderStatus
  estimatedCompletion?: string
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
      setOrders(assignedOrders.length > 0 ? assignedOrders : fallbackAssignedOrders)

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
                  groupedOrders[column.key].map((order) => (
                    <button
                      key={order._id}
                      type="button"
                      draggable
                      onDragStart={() =>
                        setDragItem({ type: "order", id: order._id, fromStatus: column.key })
                      }
                      onDragEnd={() => {
                        setDragItem(null)
                        setActiveDropZone(null)
                      }}
                      className="w-full rounded-md border bg-background p-3 text-left transition hover:border-primary/40"
                      onClick={() => navigate(`/orders/${order._id}`)}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{order.orderNumber || order._id.slice(-6)}</p>
                        <Badge className={getPriorityColor(order.priority)}>{order.priority || "normal"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{order.customerId?.name || "Unbekannt"}</p>
                      <p className="text-xs text-muted-foreground">{order.deviceBrand || "-"} {order.deviceModel || ""}</p>
                      <div className="mt-2 flex justify-end">
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
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