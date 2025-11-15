import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { getAdminBookings, getBooking, updateBookingStatus, updateBookingBillingStatus, cancelBooking, getBookingOrders } from "@/api/bookings"
import { getBookingsKanban, updateBookingStatus as updateKanbanBookingStatus } from "@/api/kanban"
import { KanbanBoard } from "@/components/admin/KanbanBoard"
import {
  Search,
  Filter,
  Eye,
  Edit2,
  X,
  Calendar,
  DollarSign,
  User,
  Phone,
  Mail,
  Package,
  Wrench,
  ShoppingCart,
  Clock,
  CheckCircle,
  AlertCircle,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

interface Booking {
  _id: string
  bookingNumber?: string
  customerId: {
    _id: string
    firstName?: string
    lastName?: string
    name?: string
    email: string
    phone: string
    avatar?: string
  }
  orderIds?: Array<any>
  repairOrderIds?: Array<any>
  items: Array<{
    _id?: string
    type: string
    device?: string
    orderId: string
    services?: Array<{
      name: string
      price: number
      estimatedTime?: number
    }>
    products?: Array<{
      name: string
      quantity: number
      price: number
      totalPrice: number
    }>
    cost: number
  }>
  status: 'pending' | 'payment-pending' | 'processing' | 'completed' | 'cancelled'
  billingStatus: 'unpaid' | 'partially-paid' | 'paid'
  totalCost: number
  subtotal?: number
  tax?: number
  discount?: number
  createdAt: string
  updatedAt: string
  timeline?: Array<{
    _id?: string
    status: string
    description: string
    completedAt: string
    staffName?: string
    staffId?: string
  }>
  paymentStatus?: string
}

interface ExpandedBooking extends Booking {
  isExpanded: boolean
}

export function BookingsManagement() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<ExpandedBooking[]>([])
  const [filteredBookings, setFilteredBookings] = useState<ExpandedBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [billingStatusFilter, setBillingStatusFilter] = useState("all")
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [updateStatusDialog, setUpdateStatusDialog] = useState(false)
  const [updateBillingDialog, setUpdateBillingDialog] = useState(false)
  const [newStatus, setNewStatus] = useState("")
  const [newBillingStatus, setNewBillingStatus] = useState("")
  const [description, setDescription] = useState("")
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set())
  const [expandedOrdersData, setExpandedOrdersData] = useState<Record<string, any[]>>({})
  const [loadingOrders, setLoadingOrders] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table')
  const [kanbanColumns, setKanbanColumns] = useState<any>({})
  const { toast } = useToast()

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      setLoading(true)

      if (viewMode === 'table') {
        const response = await getAdminBookings({
          limit: 100,
          skip: 0
        })
        const bookingsData = (response as any).bookings || []
        setBookings(bookingsData)
        setFilteredBookings(bookingsData)
      } else {
        const filters = {
          search: searchTerm || undefined,
          billingStatus: billingStatusFilter !== 'all' ? billingStatusFilter : undefined
        }
        const response = await getBookingsKanban(filters)
        setKanbanColumns(response.columns)
      }
    } catch (error) {
      console.error("Error fetching bookings:", error)
      toast({
        title: t('common.error'),
        description: "Failed to load bookings",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let filtered = bookings

    if (searchTerm) {
      filtered = filtered.filter(booking => {
        const customerName = booking.customerId.firstName
          ? `${booking.customerId.firstName} ${booking.customerId.lastName || ''}`
          : (booking.customerId.name || '')
        return (
          booking._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (booking.bookingNumber && booking.bookingNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
          customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          booking.customerId.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          booking.customerId.phone.includes(searchTerm)
        )
      })
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(booking => booking.status === statusFilter)
    }

    if (billingStatusFilter !== "all") {
      filtered = filtered.filter(booking => booking.billingStatus === billingStatusFilter)
    }

    setFilteredBookings(filtered)
  }, [bookings, searchTerm, statusFilter, billingStatusFilter])

  const handleViewDetails = async (booking: Booking) => {
    try {
      const response = await getBooking(booking._id)
      setSelectedBooking(response.booking)
      setShowDetailDialog(true)
    } catch (error) {
      toast({
        title: t('common.error'),
        description: "Failed to load booking details",
        variant: "destructive"
      })
    }
  }

  const handleUpdateStatus = async () => {
    if (!selectedBooking || !newStatus) return

    try {
      setUpdating(true)
      await updateBookingStatus(selectedBooking._id, newStatus as any, description)
      toast({
        title: t('common.success'),
        description: "Booking status updated successfully"
      })
      setUpdateStatusDialog(false)
      setDescription("")
      setNewStatus("")
      fetchBookings()
    } catch (error) {
      toast({
        title: t('common.error'),
        description: "Failed to update booking status",
        variant: "destructive"
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleUpdateBillingStatus = async () => {
    if (!selectedBooking || !newBillingStatus) return

    try {
      setUpdating(true)
      await updateBookingBillingStatus(selectedBooking._id, newBillingStatus as any)
      toast({
        title: t('common.success'),
        description: "Billing status updated successfully"
      })
      setUpdateBillingDialog(false)
      setNewBillingStatus("")
      fetchBookings()
    } catch (error) {
      toast({
        title: t('common.error'),
        description: "Failed to update billing status",
        variant: "destructive"
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleCancelBooking = async (bookingId: string) => {
    try {
      setDeleting(bookingId)
      await cancelBooking(bookingId)
      toast({
        title: t('common.success'),
        description: "Booking cancelled successfully"
      })
      fetchBookings()
    } catch (error) {
      toast({
        title: t('common.error'),
        description: "Failed to cancel booking",
        variant: "destructive"
      })
    } finally {
      setDeleting(null)
    }
  }

  // Description: Toggle expanded view of booking with associated orders
  // Fetches orders related to the booking ID from the API and displays them in a nested table with current repair progress status
  const toggleExpandBooking = async (bookingId: string) => {
    const newExpanded = new Set(expandedBookings)

    if (newExpanded.has(bookingId)) {
      // Collapse
      newExpanded.delete(bookingId)
      setExpandedBookings(newExpanded)
    } else {
      // Expand - fetch fresh orders data from API
      try {
        const newLoading = new Set(loadingOrders)
        newLoading.add(bookingId)
        setLoadingOrders(newLoading)

        // Fetch fresh order data from API with current repair progress status
        console.log(`Fetching orders for booking: ${bookingId}`)
        const response = await getBookingOrders(bookingId)
        const ordersData = response.orders || []

        console.log(`Retrieved ${ordersData.length} orders with repair progress status`)

        setExpandedOrdersData(prev => ({
          ...prev,
          [bookingId]: ordersData
        }))

        newExpanded.add(bookingId)
        setExpandedBookings(newExpanded)

        const newLoading2 = new Set(loadingOrders)
        newLoading2.delete(bookingId)
        setLoadingOrders(newLoading2)
      } catch (error) {
        console.error("Error loading orders:", error)
        toast({
          title: t('common.error'),
          description: "Failed to load associated orders",
          variant: "destructive"
        })
        const newLoading = new Set(loadingOrders)
        newLoading.delete(bookingId)
        setLoadingOrders(newLoading)
      }
    }
  }

  const handleKanbanStatusChange = async (bookingId: string, newStatus: string) => {
    try {
      await updateKanbanBookingStatus(bookingId, newStatus)
      // Refresh kanban data
      const filters = {
        search: searchTerm || undefined,
        billingStatus: billingStatusFilter !== 'all' ? billingStatusFilter : undefined
      }
      const response = await getBookingsKanban(filters)
      setKanbanColumns(response.columns)
    } catch (error: any) {
      throw error
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'payment-pending':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Description: Get color for repair order progress status (not payment status)
  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'quality-check':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'ready-for-pickup':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getBillingStatusColor = (status: string) => {
    switch (status) {
      case 'unpaid':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'partially-paid':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-foreground/60">Loading bookings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bookings Management</h1>
          <p className="text-foreground/60">Manage and oversee all booking-related tasks</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            onClick={() => {
              setViewMode('table')
              setLoading(true)
              fetchBookings()
            }}
          >
            <List className="h-4 w-4 mr-2" />
            Table View
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            onClick={() => {
              setViewMode('kanban')
              setLoading(true)
              fetchBookings()
            }}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Kanban View
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground/60">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookings.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground/60">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookings.filter(b => b.status === 'pending').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground/60">Payment Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookings.filter(b => b.status === 'payment-pending').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground/60">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(bookings.reduce((sum, b) => sum + (b.finalCost || b.totalCost || 0), 0))}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-foreground/40" />
                <Input
                  placeholder="Search by booking ID, customer name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <label className="text-sm font-medium mb-2 block">Booking Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="payment-pending">Payment Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48">
              <label className="text-sm font-medium mb-2 block">Billing Status</label>
              <Select value={billingStatusFilter} onValueChange={setBillingStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Billing Statuses</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partially-paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table or Kanban View */}
      {viewMode === 'table' ? (
        <Card>
          <CardHeader>
            <CardTitle>Bookings List</CardTitle>
            <CardDescription>{filteredBookings.length} bookings found</CardDescription>
          </CardHeader>
          <CardContent>
          {filteredBookings.length === 0 ? (
            <div className="text-center py-8 text-foreground/60">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>No bookings found</p>
            </div>
          ) : (
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Billing Status</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => (
                    <React.Fragment key={booking._id}>
                    <TableRow className="hover:bg-muted/50">
                      <TableCell className="w-12">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpandBooking(booking._id)}
                          disabled={loadingOrders.has(booking._id)}
                        >
                          {expandedBookings.has(booking._id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>#{booking._id.slice(-8).toUpperCase()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={booking.customerId.avatar} />
                            <AvatarFallback>{(booking.customerId.firstName || booking.customerId.name || booking.customerId.email).charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{booking.customerId.firstName ? `${booking.customerId.firstName} ${booking.customerId.lastName || ''}` : (booking.customerId.name || booking.customerId.email)}</p>
                            <p className="text-xs text-foreground/60 truncate">{booking.customerId.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(booking.status)}>
                          {booking.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getBillingStatusColor(booking.billingStatus)}>
                          {booking.billingStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(booking.finalCost || booking.totalCost)}
                      </TableCell>
                      <TableCell className="text-center">
                        {(booking.orderIds?.length || 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        {booking.items.length}
                      </TableCell>
                      <TableCell className="text-sm text-foreground/60">
                        {formatDate(booking.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {(booking.orderIds?.length || 0) > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="View associated orders"
                              onClick={() => {
                                // Store booking info and navigate to orders filtered view
                                window.location.href = `/admin/orders?bookingId=${booking._id}`
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          <Dialog open={selectedBooking?._id === booking._id && showDetailDialog} onOpenChange={(open) => {
                            if (!open) {
                              setShowDetailDialog(false)
                              setSelectedBooking(null)
                            }
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDetails(booking)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            {selectedBooking?._id === booking._id && (
                              <BookingDetailDialog
                                booking={selectedBooking}
                                navigate={navigate}
                                onStatusUpdate={() => {
                                  setSelectedBooking(null)
                                  setShowDetailDialog(false)
                                  fetchBookings()
                                }}
                              />
                            )}
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelBooking(booking._id)}
                            disabled={deleting === booking._id || booking.status === 'cancelled'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Row with Orders/Repair Jobs */}
                    {expandedBookings.has(booking._id) && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={10}>
                          <div className="p-4 space-y-4">
                            {/* Booking Status Summary */}
                            <div className="bg-muted/50 p-3 rounded-lg border">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-foreground/60 uppercase">Booking Status</span>
                                <Badge className={getStatusColor(booking.status)}>
                                  {booking.status}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-foreground/60">Billing Status:</span>
                                  <Badge className={`${getBillingStatusColor(booking.billingStatus)} ml-2`}>
                                    {booking.billingStatus}
                                  </Badge>
                                </div>
                                <div className="text-right">
                                  <span className="text-foreground/60">Total: </span>
                                  <span className="font-semibold">{formatCurrency(booking.totalCost)}</span>
                                </div>
                              </div>
                            </div>

                            {loadingOrders.has(booking._id) ? (
                              <div className="text-center py-4">
                                <p className="text-sm text-foreground/60">Loading orders...</p>
                              </div>
                            ) : expandedOrdersData[booking._id] && expandedOrdersData[booking._id].length > 0 ? (
                              <div className="space-y-4">
                                <h4 className="font-semibold text-sm mb-3">Associated Orders & Repairs</h4>
                                <div className="border rounded-lg overflow-hidden">
                                  <Table className="text-sm">
                                    <TableHeader>
                                      <TableRow className="bg-muted/50">
                                        <TableHead>Order Number</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Device/Product</TableHead>
                                        <TableHead>Services/Details</TableHead>
                                        <TableHead className="text-center">Progress</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Cost</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {expandedOrdersData[booking._id].map((item: any, idx: number) => (
                                        <TableRow
                                          key={idx}
                                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                                          onClick={() => item.orderId && navigate(`/orders/${item.orderId}`)}
                                        >
                                          <TableCell className="font-medium">
                                            <div className="text-sm font-semibold">
                                              {item.orderNumber}
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <Badge variant={item.type === 'repair' ? 'default' : 'secondary'}>
                                              {item.type === 'repair' ? 'Repair' : 'Product'}
                                            </Badge>
                                          </TableCell>
                                          <TableCell>
                                            <div className="text-sm">
                                              {item.type === 'repair' ? (
                                                <span>{item.device || 'Device Repair'}</span>
                                              ) : (
                                                <span>{item.products?.map((p: any) => p.name).join(', ') || 'Product Item'}</span>
                                              )}
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <div className="text-sm space-y-1">
                                              {item.type === 'repair' && item.services && item.services.length > 0 ? (
                                                <div>
                                                  {item.services.map((service: any, sidx: number) => (
                                                    <div key={sidx} className="text-xs text-foreground/70 flex items-center justify-between gap-2">
                                                      <span>• {service.name} {service.price && `($${service.price})`}</span>
                                                      {service.status && (
                                                        <span className="text-xs px-1 py-0 rounded bg-muted text-foreground/60">
                                                          {service.status}
                                                        </span>
                                                      )}
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : item.type === 'product' && item.products && item.products.length > 0 ? (
                                                <div>
                                                  {item.products.map((product: any, pidx: number) => (
                                                    <div key={pidx} className="text-xs text-foreground/70">
                                                      • {product.name} × {product.quantity}
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : (
                                                <span className="text-xs text-foreground/50">No details</span>
                                              )}
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-2">
                                              <div className="w-16 bg-muted rounded-full h-2">
                                                <div
                                                  className="bg-primary h-2 rounded-full transition-all"
                                                  style={{ width: `${item.progress || 0}%` }}
                                                ></div>
                                              </div>
                                              <span className="text-xs font-semibold whitespace-nowrap">
                                                {item.progress || 0}%
                                              </span>
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <Badge className={getOrderStatusColor(item.status || 'pending')}>
                                              {item.status || 'pending'}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="text-right font-medium">
                                            ${item.cost?.toFixed(2) || '0.00'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <p className="text-sm text-foreground/60">No associated orders found</p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Kanban Board</CardTitle>
              <CardDescription>
                Drag and drop bookings to change their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <KanbanBoard
                columns={kanbanColumns}
                type="booking"
                onStatusChange={handleKanbanStatusChange}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// Detailed Booking Dialog Component
// Description: Display detailed booking information with tabs for overview, repair jobs, items, and timeline
// Features: Status/billing updates, clickable repair jobs linking to orders
function BookingDetailDialog({
  booking,
  navigate,
  onStatusUpdate
}: {
  booking: Booking;
  navigate: any;
  onStatusUpdate: () => void
}) {
  const [activeTab, setActiveTab] = useState("overview")
  const [updating, setUpdating] = useState(false)
  const [newStatus, setNewStatus] = useState(booking.status)
  const [newBillingStatus, setNewBillingStatus] = useState(booking.billingStatus)
  const [description, setDescription] = useState("")
  const { toast } = useToast()

  // Description: Navigate to the order details page for a specific order
  // Endpoint: None (client-side navigation)
  const handleViewOrder = (orderId: string) => {
    if (!orderId) {
      console.warn("No order ID provided for navigation")
      return
    }
    navigate(`/orders/${orderId}`)
  }

  const handleStatusUpdate = async () => {
    try {
      setUpdating(true)
      await updateBookingStatus(booking._id, newStatus as any, description)
      toast({
        title: "Success",
        description: "Booking status updated"
      })
      setDescription("")
      onStatusUpdate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive"
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleBillingUpdate = async () => {
    try {
      setUpdating(true)
      await updateBookingBillingStatus(booking._id, newBillingStatus as any)
      toast({
        title: "Success",
        description: "Billing status updated"
      })
      onStatusUpdate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update billing status",
        variant: "destructive"
      })
    } finally {
      setUpdating(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'payment-pending':
        return 'bg-orange-100 text-orange-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getBillingStatusColor = (status: string) => {
    switch (status) {
      case 'unpaid':
        return 'bg-red-100 text-red-800'
      case 'partially-paid':
        return 'bg-orange-100 text-orange-800'
      case 'paid':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Booking Details</DialogTitle>
        <DialogDescription>Booking ID: {booking._id}</DialogDescription>
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="repairs">Repair Jobs</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-sm mb-3">Customer Information</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={booking.customerId.avatar} />
                    <AvatarFallback>{(booking.customerId.firstName || booking.customerId.name || booking.customerId.email).charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{booking.customerId.firstName ? `${booking.customerId.firstName} ${booking.customerId.lastName || ''}` : (booking.customerId.name || booking.customerId.email)}</p>
                    <p className="text-xs text-foreground/60">{booking.customerId.email}</p>
                  </div>
                </div>
                <div className="text-sm">
                  <span className="text-foreground/60">Phone: </span>
                  <span>{booking.customerId.phone}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-3">Booking Status</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-foreground/60 mb-1">Current Status</p>
                  <Badge className={getStatusColor(booking.status)}>{booking.status}</Badge>
                </div>
                <div>
                  <p className="text-xs text-foreground/60 mb-1">Billing Status</p>
                  <Badge className={getBillingStatusColor(booking.billingStatus)}>{booking.billingStatus}</Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Update Booking Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="payment-pending">Payment Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              {newStatus !== booking.status && (
                <>
                  <Textarea
                    placeholder="Add description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-2"
                    rows={2}
                  />
                  <Button
                    onClick={handleStatusUpdate}
                    disabled={updating}
                    className="w-full mt-2"
                  >
                    Update Status
                  </Button>
                </>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Update Billing Status</label>
              <Select value={newBillingStatus} onValueChange={setNewBillingStatus}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partially-paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
              {newBillingStatus !== booking.billingStatus && (
                <Button
                  onClick={handleBillingUpdate}
                  disabled={updating}
                  className="w-full mt-8"
                >
                  Update Billing
                </Button>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/50 p-3 rounded">
              <p className="text-xs text-foreground/60">Total Cost</p>
              <p className="text-lg font-bold">{formatCurrency(booking.totalCost)}</p>
            </div>
            <div className="bg-muted/50 p-3 rounded">
              <p className="text-xs text-foreground/60">Final Cost</p>
              <p className="text-lg font-bold">{formatCurrency(booking.finalCost || booking.totalCost)}</p>
            </div>
            <div className="bg-muted/50 p-3 rounded">
              <p className="text-xs text-foreground/60">Items Count</p>
              <p className="text-lg font-bold">{booking.items.length}</p>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-xs text-foreground/60 mb-2">Dates</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Created: {formatDateTime(booking.createdAt)}</div>
              <div>Updated: {formatDateTime(booking.updatedAt)}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="repairs" className="space-y-4 mt-4">
          {booking.items && booking.items.filter(item => item.type === 'repair').length > 0 ? (
            <div className="space-y-3">
              {booking.items.filter(item => item.type === 'repair').map((item, idx) => (
                <div
                  key={idx}
                  className="border p-4 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => item.orderId && handleViewOrder(item.orderId)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{item.device || 'Device Repair'}</h4>
                        <Badge className={getStatusColor(item.status || 'pending')}>
                          {item.status || 'pending'}
                        </Badge>
                        {item.orderId && (
                          <span className="text-xs text-foreground/50 flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />
                            Order: {item.orderId?.slice(-8)}
                          </span>
                        )}
                      </div>
                      {item.services && item.services.length > 0 && (
                        <p className="text-sm text-foreground/60 mt-1">{item.services.map(s => s.name).join(', ')}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Item Cost: {formatCurrency(item.cost)}</div>
                    {item.services && item.services[0]?.estimatedTime && (
                      <div className="text-right">Est. Time: {item.services[0].estimatedTime} min</div>
                    )}
                  </div>
                  {item.orderId && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      Click to view order details
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-foreground/60 text-center py-4">No repair jobs in this booking</p>
          )}
        </TabsContent>

        <TabsContent value="items" className="space-y-4 mt-4">
          {booking.items && booking.items.filter(item => item.type === 'product').length > 0 ? (
            <div className="space-y-3">
              {booking.items.filter(item => item.type === 'product').map((item, idx) => (
                <div key={idx} className="border p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">Product Item</h4>
                    <Badge className={getStatusColor(item.status || 'pending')}>
                      {item.status || 'pending'}
                    </Badge>
                  </div>
                  {item.products && item.products.length > 0 ? (
                    <div className="space-y-2">
                      {item.products.map((product, pidx) => (
                        <div key={pidx} className="flex justify-between items-center text-sm pb-2 border-b last:border-0">
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-foreground/60">Qty: {product.quantity} × {formatCurrency(product.price)}</p>
                          </div>
                          <p className="font-semibold">{formatCurrency(product.totalPrice)}</p>
                        </div>
                      ))}
                      <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t font-semibold">
                        <span>Total:</span>
                        <span>{formatCurrency(item.cost)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground/60">No products</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-foreground/60 text-center py-4">No product items in this booking</p>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4 mt-4">
          {booking.timeline && booking.timeline.length > 0 ? (
            <div className="space-y-3">
              {booking.timeline.map((event, idx) => (
                <div key={idx} className="border p-4 rounded-lg flex gap-4">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-1" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{event.status}</h4>
                    <p className="text-sm text-foreground/60 mt-1">{event.description}</p>
                    {event.staffName && (
                      <p className="text-sm text-foreground/60 mt-2">By: {event.staffName}</p>
                    )}
                    <p className="text-xs text-foreground/60 mt-2">{formatDateTime(event.completedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-foreground/60 text-center py-4">No timeline events</p>
          )}
        </TabsContent>
      </Tabs>
    </DialogContent>
  )
}
