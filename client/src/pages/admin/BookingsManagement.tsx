import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import {
  getAdminBookings,
  getBooking,
  updateBookingStatus,
  updateBookingBillingStatus,
  cancelBooking,
  getBookingOrders,
  previewBookingInvoice,
  createBookingInvoice,
  getBookingInvoices
} from "@/api/bookings"
import {
  createComplaint,
  getComplaintsByBooking
} from "@/api/complaints"
import {
  createReminder,
  getRemindersByBooking
} from "@/api/reminders"
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
  FileText,
  Bell,
  MessageSquare,
  MoreVertical
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
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
  overallProgress?: number
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
  const [calculatedProgress, setCalculatedProgress] = useState<Record<string, number>>({})
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false)
  const [showReminderDialog, setShowReminderDialog] = useState(false)
  const [showComplaintDialog, setShowComplaintDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const response = await getAdminBookings({
        limit: 100,
        skip: 0
      })
      const bookingsData = (response as any).bookings || []
      setBookings(bookingsData)
      setFilteredBookings(bookingsData)
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

        // Calculate actual progress from fresh order data
        let totalProgress = 0
        ordersData.forEach((order: any) => {
          totalProgress += (order.progress || 0)
        })
        const averageProgress = ordersData.length > 0 ? Math.round(totalProgress / ordersData.length) : 0

        console.log(`Calculated progress for booking ${bookingId}: ${averageProgress}%`)

        setExpandedOrdersData(prev => ({
          ...prev,
          [bookingId]: ordersData
        }))

        setCalculatedProgress(prev => ({
          ...prev,
          [bookingId]: averageProgress
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

  // Helper function to get actual progress (calculated from orders if expanded, otherwise from booking)
  const getBookingProgress = (bookingId: string, fallbackProgress: number = 0) => {
    // If we have calculated progress from expanded orders, use that
    if (calculatedProgress[bookingId] !== undefined) {
      return calculatedProgress[bookingId]
    }
    // Otherwise use the fallback (booking's overallProgress from database)
    return fallbackProgress
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bookings Management</h1>
        <p className="text-foreground/60">Manage and oversee all booking-related tasks</p>
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

      {/* Bookings Table */}
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
                    <TableHead>Progress</TableHead>
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
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${getBookingProgress(booking._id, booking.overallProgress || 0)}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-semibold whitespace-nowrap">
                            {getBookingProgress(booking._id, booking.overallProgress || 0)}%
                          </span>
                        </div>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleViewDetails(booking)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedBooking(booking)
                              setShowInvoiceDialog(true)
                            }}>
                              <FileText className="h-4 w-4 mr-2" />
                              Create Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedBooking(booking)
                              setShowReminderDialog(true)
                            }}>
                              <Bell className="h-4 w-4 mr-2" />
                              Create Reminder
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedBooking(booking)
                              setShowComplaintDialog(true)
                            }}>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              File Complaint
                            </DropdownMenuItem>
                            {(booking.orderIds?.length || 0) > 0 && (
                              <DropdownMenuItem onClick={() => {
                                window.location.href = `/admin/orders?bookingId=${booking._id}`
                              }}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Orders
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleCancelBooking(booking._id)}
                              disabled={deleting === booking._id || booking.status === 'cancelled'}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Cancel Booking
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Hidden Dialog for View Details */}
                        <Dialog open={selectedBooking?._id === booking._id && showDetailDialog} onOpenChange={(open) => {
                          if (!open) {
                            setShowDetailDialog(false)
                            setSelectedBooking(null)
                          }
                        }}>
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
                      </TableCell>
                    </TableRow>

                    {/* Expanded Row with Orders/Repair Jobs */}
                    {expandedBookings.has(booking._id) && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={11}>
                          <div className="p-4 space-y-4">
                            {/* Booking Status Summary */}
                            <div className="bg-muted/50 p-3 rounded-lg border">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-foreground/60 uppercase">Booking Status</span>
                                <Badge className={getStatusColor(booking.status)}>
                                  {booking.status}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
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
                              <div>
                                <span className="text-xs text-foreground/60 mb-1 block">Overall Progress:</span>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-muted rounded-full h-3">
                                    <div
                                      className="bg-primary h-3 rounded-full transition-all"
                                      style={{ width: `${getBookingProgress(booking._id, booking.overallProgress || 0)}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm font-semibold whitespace-nowrap">
                                    {getBookingProgress(booking._id, booking.overallProgress || 0)}%
                                  </span>
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
                                      {expandedOrdersData[booking._id].map((item: any) => (
                                        <TableRow
                                          key={item.orderId || item._id}
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

      {/* Invoice Dialog */}
      {selectedBooking && (
        <InvoiceDialog
          booking={selectedBooking}
          open={showInvoiceDialog}
          onClose={() => {
            setShowInvoiceDialog(false)
            setSelectedBooking(null)
          }}
          onSuccess={() => {
            toast({
              title: "Success",
              description: "Invoice created successfully"
            })
            setShowInvoiceDialog(false)
            setSelectedBooking(null)
          }}
        />
      )}

      {/* Reminder Dialog */}
      {selectedBooking && (
        <ReminderDialog
          booking={selectedBooking}
          open={showReminderDialog}
          onClose={() => {
            setShowReminderDialog(false)
            setSelectedBooking(null)
          }}
          onSuccess={() => {
            toast({
              title: "Success",
              description: "Reminder created successfully"
            })
            setShowReminderDialog(false)
            setSelectedBooking(null)
          }}
        />
      )}

      {/* Complaint Dialog */}
      {selectedBooking && (
        <ComplaintDialog
          booking={selectedBooking}
          open={showComplaintDialog}
          onClose={() => {
            setShowComplaintDialog(false)
            setSelectedBooking(null)
          }}
          onSuccess={() => {
            toast({
              title: "Success",
              description: "Complaint filed successfully"
            })
            setShowComplaintDialog(false)
            setSelectedBooking(null)
          }}
        />
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="repairs">Repair Jobs</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
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
              {booking.items.filter(item => item.type === 'repair').map((item) => (
                <div
                  key={item._id || item.orderId}
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
              {booking.items.filter(item => item.type === 'product').map((item) => (
                <div key={item._id || item.orderId} className="border p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">Product Item</h4>
                    <Badge className={getStatusColor(item.status || 'pending')}>
                      {item.status || 'pending'}
                    </Badge>
                  </div>
                  {item.products && item.products.length > 0 ? (
                    <div className="space-y-2">
                      {item.products.map((product) => (
                        <div key={product._id || product.productId} className="flex justify-between items-center text-sm pb-2 border-b last:border-0">
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

        <TabsContent value="invoices" className="space-y-4 mt-4">
          <InvoicesTabContent booking={booking} />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4 mt-4">
          {booking.timeline && booking.timeline.length > 0 ? (
            <div className="space-y-3">
              {booking.timeline.map((event) => (
                <div key={event._id || event.completedAt} className="border p-4 rounded-lg flex gap-4">
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

// Invoices Tab Content Component
// Description: Display invoices for a booking with reminder actions
function InvoicesTabContent({ booking }: { booking: Booking }) {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadInvoices()
  }, [booking._id])

  const loadInvoices = async () => {
    try {
      setLoading(true)
      const response = await getBookingInvoices(booking._id)
      setInvoices(response.invoices || [])
    } catch (error) {
      console.error('Error loading invoices:', error)
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSendReminder = (invoice: any) => {
    setSelectedInvoice(invoice)
    setReminderDialogOpen(true)
  }

  const getInvoiceStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
        <p className="text-foreground/60">No invoices created for this booking yet</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {invoices.map((invoice) => (
          <div key={invoice._id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">Invoice #{invoice.invoiceNumber}</h4>
                  <Badge className={getInvoiceStatusColor(invoice.status)}>
                    {invoice.status}
                  </Badge>
                </div>
                <p className="text-sm text-foreground/60">
                  Created: {formatDate(invoice.createdAt)}
                </p>
                {invoice.dueDate && (
                  <p className="text-sm text-foreground/60">
                    Due: {formatDate(invoice.dueDate)}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{formatCurrency(invoice.total)}</p>
                {invoice.amountPaid > 0 && (
                  <p className="text-sm text-green-600">
                    Paid: {formatCurrency(invoice.amountPaid)}
                  </p>
                )}
              </div>
            </div>

            <Separator className="my-3" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-foreground/60">
                <Mail className="h-4 w-4" />
                <span>{booking.customerId.email}</span>
              </div>
              <div className="flex gap-2">
                {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendReminder(invoice)}
                  >
                    <Bell className="h-4 w-4 mr-1" />
                    Send Reminder
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Open invoice in new tab or download
                    window.open(`/api/invoices/${invoice._id}/pdf`, '_blank')
                  }}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  View PDF
                </Button>
              </div>
            </div>

            {invoice.notes && (
              <div className="mt-3 p-2 bg-muted rounded text-sm">
                <p className="text-foreground/60">Notes: {invoice.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reminder Dialog for Invoice */}
      {selectedInvoice && (
        <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Payment Reminder</DialogTitle>
              <DialogDescription>
                Send a reminder to {booking.customerId.firstName || booking.customerId.email} about Invoice #{selectedInvoice.invoiceNumber}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded">
                <p className="text-sm font-medium">Invoice Details</p>
                <p className="text-sm text-foreground/60">Amount: {formatCurrency(selectedInvoice.total)}</p>
                <p className="text-sm text-foreground/60">Status: {selectedInvoice.status}</p>
                {selectedInvoice.dueDate && (
                  <p className="text-sm text-foreground/60">Due Date: {formatDate(selectedInvoice.dueDate)}</p>
                )}
              </div>
              <p className="text-sm text-foreground/60">
                A payment reminder email will be sent to the customer with invoice details and a payment link.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={async () => {
                try {
                  await createReminder({
                    bookingId: booking._id,
                    customerId: booking.customerId._id,
                    type: 'payment',
                    title: `Payment Reminder - Invoice #${selectedInvoice.invoiceNumber}`,
                    message: `This is a reminder that Invoice #${selectedInvoice.invoiceNumber} for ${formatCurrency(selectedInvoice.total)} is ${selectedInvoice.status === 'overdue' ? 'overdue' : 'pending payment'}. Please make payment at your earliest convenience.`,
                    scheduledDate: new Date().toISOString(),
                    priority: selectedInvoice.status === 'overdue' ? 'high' : 'medium',
                    notificationMethod: ['email', 'in-app']
                  })
                  toast({
                    title: "Success",
                    description: "Payment reminder sent successfully"
                  })
                  setReminderDialogOpen(false)
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to send reminder",
                    variant: "destructive"
                  })
                }
              }}>
                <Bell className="h-4 w-4 mr-2" />
                Send Reminder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

// Invoice Creation Dialog Component
// Description: Dialog for previewing and creating invoices for bookings
function InvoiceDialog({
  booking,
  open,
  onClose,
  onSuccess
}: {
  booking: Booking;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [notes, setNotes] = useState('')
  const [sendImmediately, setSendImmediately] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open && booking) {
      loadPreview()
    }
  }, [open, booking])

  const loadPreview = async () => {
    try {
      setLoading(true)
      const response = await previewBookingInvoice(booking._id)
      setPreview(response.invoicePreview)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load invoice preview",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      setLoading(true)
      await createBookingInvoice(booking._id, {
        notes,
        sendImmediately
      })
      onSuccess()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice for Booking</DialogTitle>
          <DialogDescription>Preview and confirm invoice details</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : preview ? (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-muted/30">
              <h3 className="font-semibold mb-2">Customer Information</h3>
              <p className="text-sm">{preview.customerName}</p>
              <p className="text-sm text-foreground/60">{preview.customerEmail}</p>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Invoice Items</h3>
              <div className="space-y-2">
                {preview.items.map((item: any) => (
                  <div key={item._id || item.description} className="flex justify-between text-sm border-b pb-2 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-foreground/60">
                        Qty: {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <p className="font-semibold">{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(preview.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax:</span>
                  <span>{formatCurrency(preview.tax)}</span>
                </div>
                {preview.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount:</span>
                    <span>-{formatCurrency(preview.discount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatCurrency(preview.total)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any additional notes..."
                  rows={3}
                  className="mt-2"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="sendImmediately"
                  checked={sendImmediately}
                  onChange={(e) => setSendImmediately(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="sendImmediately" className="text-sm">
                  Send invoice immediately to customer
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-foreground/60">
            No preview available
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || !preview}>
            Create Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Reminder Creation Dialog Component
// Description: Dialog for creating reminders for bookings
function ReminderDialog({
  booking,
  open,
  onClose,
  onSuccess
}: {
  booking: Booking;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false)
  const [reminderType, setReminderType] = useState('payment')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [priority, setPriority] = useState('medium')
  const { toast } = useToast()

  const handleCreate = async () => {
    if (!title || !message || !scheduledDate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    try {
      setLoading(true)
      await createReminder({
        bookingId: booking._id,
        customerId: booking.customerId._id,
        type: reminderType,
        title,
        message,
        scheduledDate,
        priority,
        notificationMethod: ['email', 'in-app']
      })
      onSuccess()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create reminder",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Reminder</DialogTitle>
          <DialogDescription>Schedule a reminder for this booking</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Reminder Type</label>
            <Select value={reminderType} onValueChange={setReminderType}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="pickup">Pickup</SelectItem>
                <SelectItem value="followup">Follow-up</SelectItem>
                <SelectItem value="feedback">Feedback</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reminder title"
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Message *</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Reminder message"
              rows={4}
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Scheduled Date & Time *</label>
            <Input
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Priority</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            Create Reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Complaint Creation Dialog Component
// Description: Dialog for filing complaints about bookings
function ComplaintDialog({
  booking,
  open,
  onClose,
  onSuccess
}: {
  booking: Booking;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState('service')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const { toast } = useToast()

  const handleCreate = async () => {
    if (!subject || !description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    try {
      setLoading(true)
      await createComplaint({
        bookingId: booking._id,
        subject,
        description,
        category,
        priority
      })
      onSuccess()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to file complaint",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>File Complaint</DialogTitle>
          <DialogDescription>Report an issue with this booking</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quality">Quality</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="communication">Communication</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Subject *</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of the issue"
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description *</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of the issue"
              rows={5}
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Priority</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            File Complaint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
