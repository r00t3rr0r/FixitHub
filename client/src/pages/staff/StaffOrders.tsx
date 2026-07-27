import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import { generateAvatarPlaceholder } from "@/utils/placeholders"
import { getAssignedOrders } from "@/api/adminOrders"
import { getUnreadMessageCounts } from "@/api/inspectionCommunication"
import { getUnreadMessageCount as getRepairRequestUnreadMessageCount } from "@/api/repairRequestCommunication"
import { getRepairRequests } from "@/api/repairRequests"
import {
  Search,
  Filter,
  Package,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  MessageSquare,
  Camera,
  Phone,
  Mail,
  DollarSign
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface AssignedOrder {
  _id: string
  orderNumber: string
  customerId: {
    _id: string
    name: string
    email: string
    phone: string
    avatar: string
  }
  deviceBrand: string
  deviceModel: string
  services: Array<{ name: string; price: number }>
  addOns: Array<{ _id: string; name: string; price: number; status: string }>
  status: 'pending' | 'in-progress' | 'quality-check' | 'completed' | 'ready-for-pickup' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  estimatedCompletion: string
  totalCost: number
  progress: number
  workflows?: Array<{
    _id: string
    workflowName?: string
    assignedStaffId?: string | { _id?: string }
    assignedStaff?: Array<{
      staffId?: string | { _id?: string }
      name?: string
    }>
    status?: 'not-started' | 'in_progress' | 'in-progress' | 'on-hold' | 'completed'
    currentStepIndex?: number
    startedAt?: string
    completedAt?: string
    pausedAt?: string
    steps?: Array<{
      _id?: string
      stepName?: string
      name?: string
      assignedStaffId?: string | { _id?: string }
      assignedStaff?: Array<{
        staffId?: string | { _id?: string }
        name?: string
      }>
      status?: 'not-started' | 'in_progress' | 'in-progress' | 'on-hold' | 'completed'
    }>
  }>
  createdAt: string
}

interface ActionableWorkflowItem {
  id: string
  orderId: string
  orderNumber: string
  orderStatus: string
  orderPriority: string
  workflowName: string
  isDirectWorkflowAssignment: boolean
  workflowStatus: string
  activeStepLabel: string
  pausedAt?: string
  updatedAt?: string
  progressPercentage: number
  completedSteps: number
  totalSteps: number
}

interface AssignedRepairRequest {
  _id: string
  requestNumber?: string
  customerId?: {
    _id: string
    firstName?: string
    lastName?: string
    name?: string
    email?: string
    phone?: string
    avatar?: string
  }
  customerName?: string
  customerPhone?: string
  deviceBrand?: string
  deviceModel?: string
  issueDescription?: string
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'converted'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  createdAt: string
}

export function StaffOrders() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [orders, setOrders] = useState<AssignedOrder[]>([])
  const [filteredOrders, setFilteredOrders] = useState<AssignedOrder[]>([])
  const [repairRequests, setRepairRequests] = useState<AssignedRepairRequest[]>([])
  const [unreadCounts, setUnreadCounts] = useState<Record<string, { unread: number; senderType?: string }>>({})
  const [repairUnreadCounts, setRepairUnreadCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now())
  const { toast } = useToast()

  const normalizeWorkflowStatus = (status?: string) => {
    const value = String(status || '').toLowerCase()
    if (value === 'in_progress') return 'in-progress'
    return value || 'not-started'
  }

  const getWorkflowStatusLabel = (status?: string) => {
    switch (normalizeWorkflowStatus(status)) {
      case 'in-progress':
        return 'In Progress'
      case 'on-hold':
        return 'Paused'
      case 'completed':
        return 'Completed'
      default:
        return 'Pending'
    }
  }

  const getWorkflowStatusColor = (status?: string) => {
    switch (normalizeWorkflowStatus(status)) {
      case 'in-progress':
        return 'bg-blue-500 text-white'
      case 'on-hold':
        return 'bg-orange-500 text-white'
      case 'completed':
        return 'bg-green-500 text-white'
      default:
        return 'bg-yellow-400 text-black font-semibold ring-1 ring-yellow-600/40'
    }
  }

  const getWorkflowCurrentStep = (workflow: AssignedOrder['workflows'][number]) => {
    const steps = Array.isArray(workflow?.steps) ? workflow.steps : []
    if (steps.length === 0) return null

    const currentIndex = Number.isInteger(workflow?.currentStepIndex)
      ? Math.min(Math.max(Number(workflow?.currentStepIndex), 0), steps.length - 1)
      : Math.max(steps.findIndex((step) => normalizeWorkflowStatus(step?.status) === 'in-progress'), 0)

    return steps[currentIndex] || steps[0] || null
  }

  const getWorkflowProgress = (workflow: AssignedOrder['workflows'][number]) => {
    const steps = Array.isArray(workflow?.steps) ? workflow.steps : []
    const totalSteps = steps.length
    const completedSteps = steps.filter((step) => normalizeWorkflowStatus(step?.status) === 'completed').length

    return {
      totalSteps,
      completedSteps,
      percentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    }
  }

  const formatDuration = (valueMs: number) => {
    if (valueMs <= 0) return '0m'
    const totalMinutes = Math.floor(valueMs / 60000)
    const days = Math.floor(totalMinutes / 1440)
    const hours = Math.floor((totalMinutes % 1440) / 60)
    const minutes = totalMinutes % 60

    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getPausedDurationLabel = (pausedAt?: string) => {
    if (!pausedAt) return '-'
    const pausedTimestamp = new Date(pausedAt).getTime()
    if (!Number.isFinite(pausedTimestamp)) return '-'
    return formatDuration(nowTimestamp - pausedTimestamp)
  }

  const toId = (value: any): string => {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'object' && value._id) return String(value._id)
    return String(value)
  }

  const isWorkflowAssignedToCurrentStaff = (workflow: AssignedOrder['workflows'][number]) => {
    const myStaffId = String(user?._id || '')
    if (!myStaffId || !workflow) return false

    const workflowAssignedIds = [
      toId(workflow.assignedStaffId),
      ...(Array.isArray(workflow.assignedStaff)
        ? workflow.assignedStaff.map((assignment) => toId(assignment?.staffId))
        : []),
    ]
      .filter(Boolean)
      .map(String)

    if (workflowAssignedIds.includes(myStaffId)) return true

    const steps = Array.isArray(workflow.steps) ? workflow.steps : []
    return steps.some((step) => {
      const stepAssignedIds = [
        toId(step?.assignedStaffId),
        ...(Array.isArray(step?.assignedStaff)
          ? step.assignedStaff.map((assignment) => toId(assignment?.staffId))
          : []),
      ]
        .filter(Boolean)
        .map(String)

      return stepAssignedIds.includes(myStaffId)
    })
  }

  const actionableWorkflows: ActionableWorkflowItem[] = filteredOrders
    .flatMap((order) => {
      const workflows = Array.isArray(order.workflows) ? order.workflows : []

      return workflows
        .filter((workflow) => isWorkflowAssignedToCurrentStaff(workflow))
        .map((workflow) => {
        const workflowStatus = normalizeWorkflowStatus(workflow?.status)
        const currentStep = getWorkflowCurrentStep(workflow)
        const progress = getWorkflowProgress(workflow)
        const myStaffId = String(user?._id || '')
        const workflowAssignedIds = [
          toId(workflow.assignedStaffId),
          ...(Array.isArray(workflow.assignedStaff)
            ? workflow.assignedStaff.map((assignment) => toId(assignment?.staffId))
            : []),
        ]
          .filter(Boolean)
          .map(String)
        const isDirectWorkflowAssignment = Boolean(myStaffId) && workflowAssignedIds.includes(myStaffId)

        return {
          id: `${order._id}-${String(workflow?._id || workflow?.workflowName || 'workflow')}`,
          orderId: order._id,
          orderNumber: order.orderNumber || order._id.slice(-6),
          orderStatus: order.status,
          orderPriority: order.priority,
          workflowName: workflow?.workflowName || 'Workflow',
          isDirectWorkflowAssignment,
          workflowStatus,
          activeStepLabel: currentStep?.stepName || currentStep?.name || 'No step assigned',
          pausedAt: workflow?.pausedAt,
          updatedAt: workflow?.pausedAt || workflow?.completedAt || workflow?.startedAt || order.createdAt,
          progressPercentage: progress.percentage,
          completedSteps: progress.completedSteps,
          totalSteps: progress.totalSteps,
        }
      })
    })
    .filter((workflow) => workflow.workflowStatus !== 'completed')
    .sort((a, b) => {
      const toTimestamp = (value?: string) => {
        if (!value) return 0
        const ts = new Date(value).getTime()
        return Number.isFinite(ts) ? ts : 0
      }

      const statusWeight = (status: string) => {
        switch (status) {
          case 'not-started':
            return 0
          case 'on-hold':
            return 1
          case 'in-progress':
            return 2
          default:
            return 3
        }
      }

      const byStatus = statusWeight(a.workflowStatus) - statusWeight(b.workflowStatus)
      if (byStatus !== 0) return byStatus

      if (a.workflowStatus === 'on-hold' && b.workflowStatus === 'on-hold') {
        const pausedA = toTimestamp(a.pausedAt)
        const pausedB = toTimestamp(b.pausedAt)
        if (pausedA !== pausedB) return pausedA - pausedB
      }

      const priorityWeight = (priority: string) => {
        switch (priority) {
          case 'urgent':
            return 0
          case 'high':
            return 1
          case 'normal':
            return 2
          default:
            return 3
        }
      }

      const byPriority = priorityWeight(a.orderPriority) - priorityWeight(b.orderPriority)
      if (byPriority !== 0) return byPriority

      return toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt)
    })

  useEffect(() => {
    const fetchAssignedOrders = async () => {
      try {
        setLoading(true)
        const filters: any = {
          page: 1,
          limit: 100
        }

        if (searchTerm) filters.search = searchTerm
        if (statusFilter !== "all") filters.status = statusFilter
        if (priorityFilter !== "all") filters.priority = priorityFilter

        const [ordersResult, repairResult] = await Promise.all([
          getAssignedOrders(filters),
          getRepairRequests({
            assignedStaffId: user?._id,
            search: searchTerm || undefined,
            page: 1,
            limit: 100,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          }),
        ])

        console.log('Assigned orders fetched:', ordersResult.orders)

        const nextOrders = ordersResult.orders || []
        setOrders(nextOrders)
        setFilteredOrders(nextOrders)
        setRepairRequests(repairResult.requests || [])

        if (nextOrders.length > 0) {
          const counts = await getUnreadMessageCounts(nextOrders.map((order: AssignedOrder) => order._id))
          setUnreadCounts(counts || {})
        } else {
          setUnreadCounts({})
        }

        const nextRepairRequests = repairResult.requests || []
        if (nextRepairRequests.length > 0) {
          const repairCountEntries = await Promise.allSettled(
            nextRepairRequests.map(async (request: AssignedRepairRequest) => [request._id, await getRepairRequestUnreadMessageCount(request._id)] as const)
          )

          const nextRepairUnreadCounts = repairCountEntries.reduce<Record<string, number>>((accumulator, result) => {
            if (result.status === "fulfilled") {
              const [requestId, count] = result.value
              accumulator[requestId] = Number(count || 0)
            }
            return accumulator
          }, {})

          setRepairUnreadCounts(nextRepairUnreadCounts)
        } else {
          setRepairUnreadCounts({})
        }
      } catch (error: any) {
        console.error("Error fetching assigned orders:", error)
        toast({
          title: "Error",
          description: error.message || "Failed to load orders",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAssignedOrders()
  }, [searchTerm, statusFilter, priorityFilter, toast, user?._id])

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now())
    }, 60000)

    return () => clearInterval(timer)
  }, [])

  const handleViewOrder = (orderId: string) => {
    console.log('Navigating to order details:', orderId)
    navigate(`/orders/${orderId}`)
  }

  const handleViewRepairRequest = (requestId: string) => {
    navigate(`/staff/repair-requests?requestId=${encodeURIComponent(requestId)}`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white'
      case 'in-progress':
        return 'bg-blue-500 text-white'
      case 'quality-check':
        return 'bg-yellow-500 text-black'
      case 'ready-for-pickup':
        return 'bg-purple-500 text-white'
      case 'pending':
        return 'bg-gray-500 text-white'
      case 'cancelled':
        return 'bg-red-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-600 text-white'
      case 'high':
        return 'bg-orange-500 text-white'
      case 'normal':
        return 'bg-blue-500 text-white'
      case 'low':
        return 'bg-gray-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getRepairStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500 text-white'
      case 'reviewing':
        return 'bg-blue-500 text-white'
      case 'pending':
        return 'bg-gray-500 text-white'
      case 'rejected':
        return 'bg-red-500 text-white'
      case 'converted':
        return 'bg-purple-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getRepairPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-600 text-white'
      case 'high':
        return 'bg-orange-500 text-white'
      case 'medium':
        return 'bg-blue-500 text-white'
      case 'low':
        return 'bg-gray-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getCustomerName = (request: AssignedRepairRequest) => {
    if (request.customerName) return request.customerName
    const firstName = request.customerId?.firstName || ''
    const lastName = request.customerId?.lastName || ''
    const fullName = `${firstName} ${lastName}`.trim()
    if (fullName) return fullName
    return request.customerId?.name || 'Unknown Customer'
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-7 bg-muted rounded w-44 animate-pulse"></div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl bg-[#1a2a5e] px-4 py-3 shadow-sm md:px-5 md:py-4">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-white md:text-2xl">
          <Package className="h-6 w-6" />
          My Orders
        </h1>
        <p className="mt-1 text-xs text-blue-100 md:text-sm">
          Manage your assigned repair orders
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-blue-700 dark:text-blue-300">
              Assigned Orders
            </CardTitle>
            <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
              {orders.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-orange-700 dark:text-orange-300">
              In Progress
            </CardTitle>
            <Clock className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="text-xl font-bold text-orange-900 dark:text-orange-100">
              {orders.filter(o => o.status === 'in-progress').length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-green-700 dark:text-green-300">
              Completed
            </CardTitle>
            <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="text-xl font-bold text-green-900 dark:text-green-100">
              {orders.filter(o => o.status === 'completed').length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-red-700 dark:text-red-300">
              Urgent Orders
            </CardTitle>
            <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="text-xl font-bold text-red-900 dark:text-red-100">
              {orders.filter(o => o.priority === 'urgent').length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 border-indigo-200 dark:border-indigo-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
              Assigned Repair Requests
            </CardTitle>
            <Package className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="text-xl font-bold text-indigo-900 dark:text-indigo-100">
              {repairRequests.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="px-4 pb-3 pt-3">
          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transform text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 pl-9 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-36 text-xs">
                  <Filter className="mr-1 h-3.5 w-3.5" />
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="quality-check">Quality Check</SelectItem>
                  <SelectItem value="ready-for-pickup">Ready for Pickup</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-9 w-32 text-xs">
                  <SelectValue placeholder="All Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actionable Workflows Table */}
      <Card>
        <CardHeader className="rounded-t-xl bg-[#1a2a5e] px-4 py-3">
          <CardTitle className="text-sm font-semibold text-white">Abzuarbeitende Workflows</CardTitle>
          <CardDescription className="text-xs text-blue-100">
            Pending Workflows sind hervorgehoben. Bei pausierten Workflows wird die Pausenzeit angezeigt.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Workflow</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Order</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Status</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Current Step</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Progress</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Pause Duration</TableHead>
                  <TableHead className="h-9 px-2 text-right text-[11px] uppercase tracking-wide">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actionableWorkflows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center">
                      <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">Keine abzuarbeitenden Workflows gefunden</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  actionableWorkflows.map((workflow) => {
                    const isPending = workflow.workflowStatus === 'not-started'
                    const rowClassName = isPending
                      ? 'cursor-pointer bg-yellow-50/70 hover:bg-yellow-100/70'
                      : 'cursor-pointer hover:bg-muted/50'

                    return (
                      <TableRow
                        key={workflow.id}
                        className={rowClassName}
                        onClick={() => handleViewOrder(workflow.orderId)}
                      >
                        <TableCell className="px-2 py-2 align-middle">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold">{workflow.workflowName}</p>
                            {workflow.isDirectWorkflowAssignment && (
                              <Badge className="h-5 px-1.5 text-[10px] bg-green-600 text-white">Dir zugewiesen</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2 align-middle">
                          <div>
                            <p className="text-xs font-semibold">{workflow.orderNumber}</p>
                            <p className="text-xs text-muted-foreground capitalize">{workflow.orderStatus.replace('-', ' ')}</p>
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2 align-middle">
                          <Badge className={`${getWorkflowStatusColor(workflow.workflowStatus)} h-5 px-1.5 text-[10px]`}>
                            {getWorkflowStatusLabel(workflow.workflowStatus)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 py-2 align-middle">
                          <span className="text-xs">{workflow.activeStepLabel}</span>
                        </TableCell>
                        <TableCell className="px-2 py-2 align-middle">
                          <div className="space-y-1">
                            <div className="h-1.5 w-24 overflow-hidden rounded bg-muted">
                              <div
                                className={`h-full ${workflow.workflowStatus === 'on-hold' ? 'bg-orange-500' : 'bg-blue-500'}`}
                                style={{ width: `${workflow.progressPercentage}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {workflow.completedSteps}/{workflow.totalSteps || 0} steps
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2 align-middle">
                          <span className="text-xs">
                            {workflow.workflowStatus === 'on-hold'
                              ? getPausedDurationLabel(workflow.pausedAt)
                              : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="px-2 py-2 text-right align-middle">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewOrder(workflow.orderId)
                            }}
                            title="Open Order"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader className="rounded-t-xl bg-[#1a2a5e] px-4 py-3">
          <CardTitle className="text-sm font-semibold text-white">Assigned Orders</CardTitle>
          <CardDescription className="text-xs text-blue-100">
            Click on any order to view details
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Order Number</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Customer</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Device</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Services</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Status</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Priority</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Progress</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Total Cost</TableHead>
                  <TableHead className="h-9 px-2 text-right text-[11px] uppercase tracking-wide">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6 text-center">
                      <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No orders found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow
                      key={order._id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewOrder(order._id)}
                    >
                      <TableCell className="px-2 py-2 align-middle">
                        <div>
                          <p className="text-xs font-semibold">{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2 align-middle">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={order.customerId?.avatar || generateAvatarPlaceholder(order.customerId?.name || 'U', 32)} />
                            <AvatarFallback>
                              {order.customerId?.name ? order.customerId.name.split(' ').map(n => n[0]).join('') : 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs font-medium">{order.customerId?.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {order.customerId?.phone}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2 align-middle">
                        <div>
                          <p className="text-xs font-medium">{order.deviceBrand} {order.deviceModel}</p>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2 align-middle">
                        <div className="flex flex-wrap gap-1">
                          {order.services && order.services.length > 0 ? (
                            order.services.slice(0, 2).map((service: any, idx) => (
                              <Badge key={idx} variant="outline" className="h-5 px-1.5 text-[10px]">
                                {typeof service === 'string' ? service : service.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                          {order.services && order.services.length > 2 && (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                              +{order.services.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2 align-middle">
                        <Badge className={`${getStatusColor(order.status)} h-5 px-1.5 text-[10px]`}>
                          {order.status.replace('-', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-2 py-2 align-middle">
                        <Badge className={`${getPriorityColor(order.priority)} h-5 px-1.5 text-[10px]`}>
                          {order.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-2 py-2 align-middle">
                        <div className="text-xs font-semibold">{order.progress}%</div>
                      </TableCell>
                      <TableCell className="px-2 py-2 text-right align-middle">
                        <span className="text-xs font-semibold">{formatCurrency(order.totalCost)}</span>
                      </TableCell>
                      <TableCell className="px-2 py-2 text-right align-middle">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewOrder(order._id)
                            }}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="relative h-7 w-7 p-0"
                            title={unreadCounts[order._id]?.unread > 0
                              ? `${unreadCounts[order._id].unread} new message${unreadCounts[order._id].unread > 1 ? "s" : ""}`
                              : "Messages"
                            }
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MessageSquare className="h-4 w-4" />
                            {unreadCounts[order._id]?.unread > 0 && (
                              <Badge className="absolute -right-1 -top-1 h-4 min-w-[16px] border-0 bg-red-500 px-1 text-[10px] font-semibold text-white shadow-sm">
                                {unreadCounts[order._id].unread > 99 ? "99+" : unreadCounts[order._id].unread}
                              </Badge>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Repair Requests Table */}
      <Card>
        <CardHeader className="rounded-t-xl bg-[#1a2a5e] px-4 py-3">
          <CardTitle className="text-sm font-semibold text-white">Assigned Repair Requests</CardTitle>
          <CardDescription className="text-xs text-blue-100">
            Repair Requests assigned to you
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Request</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Customer</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Device</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Issue</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Status</TableHead>
                  <TableHead className="h-9 px-2 text-[11px] uppercase tracking-wide">Priority</TableHead>
                  <TableHead className="h-9 px-2 text-right text-[11px] uppercase tracking-wide">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repairRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center">
                      <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No assigned repair requests found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  repairRequests.map((request) => (
                    <TableRow
                      key={request._id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewRepairRequest(request._id)}
                    >
                      <TableCell className="px-2 py-2 align-middle">
                        <div>
                          <p className="text-xs font-semibold">{request.requestNumber || request._id.slice(-8)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2 align-middle">
                        <div>
                          <p className="text-xs font-medium">{getCustomerName(request)}</p>
                          <p className="text-xs text-muted-foreground">{request.customerPhone || request.customerId?.phone || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2 align-middle">
                        <p className="text-xs font-medium">{request.deviceBrand || '-'} {request.deviceModel || ''}</p>
                      </TableCell>
                      <TableCell className="px-2 py-2 align-middle">
                        <p className="line-clamp-2 max-w-[260px] text-xs text-muted-foreground">
                          {request.issueDescription || '-'}
                        </p>
                      </TableCell>
                      <TableCell className="px-2 py-2 align-middle">
                        <Badge className={`${getRepairStatusColor(request.status)} h-5 px-1.5 text-[10px]`}>
                          {String(request.status).replace('-', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-2 py-2 align-middle">
                        <Badge className={`${getRepairPriorityColor(request.priority)} h-5 px-1.5 text-[10px]`}>
                          {request.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-2 py-2 text-right align-middle">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="relative h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewRepairRequest(request._id)
                            }}
                            title={repairUnreadCounts[request._id] > 0
                              ? `${repairUnreadCounts[request._id]} new message${repairUnreadCounts[request._id] > 1 ? "s" : ""}`
                              : "View Details"
                            }
                          >
                            <Eye className="h-4 w-4" />
                            {repairUnreadCounts[request._id] > 0 && (
                              <Badge className="absolute -right-1 -top-1 h-4 min-w-[16px] border-0 bg-red-500 px-1 text-[10px] font-semibold text-white shadow-sm">
                                {repairUnreadCounts[request._id] > 99 ? "99+" : repairUnreadCounts[request._id]}
                              </Badge>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}