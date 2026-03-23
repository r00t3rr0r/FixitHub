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
  createdAt: string
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
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const { toast } = useToast()

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

        setOrders(ordersResult.orders || [])
        setFilteredOrders(ordersResult.orders || [])
        setRepairRequests(repairResult.requests || [])
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
                            className="h-7 w-7 p-0"
                            title="Messages"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MessageSquare className="h-4 w-4" />
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewRepairRequest(request._id)
                          }}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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