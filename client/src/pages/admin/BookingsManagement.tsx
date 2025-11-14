import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { getAdminBookings, getBooking, updateBookingStatus, updateBookingBillingStatus, cancelBooking } from "@/api/bookings"
import {
  Search,
  Filter,
  Eye,
  Edit2,
  X,
  ChevronDown,
  ChevronUp,
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
  Trash2
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
      setBookings(bookingsData.map((b: any) => ({ ...b, isExpanded: false })))
      setFilteredBookings(bookingsData.map((b: any) => ({ ...b, isExpanded: false })))
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

  const toggleExpand = (bookingId: string) => {
    setFilteredBookings(prev =>
      prev.map(b =>
        b._id === bookingId ? { ...b, isExpanded: !b.isExpanded } : b
      )
    )
  }

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

      {/* Bookings List */}
      <Card>
        <CardHeader>
          <CardTitle>Bookings List</CardTitle>
          <CardDescription>{filteredBookings.length} bookings found</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="space-y-4">
              {filteredBookings.length === 0 ? (
                <div className="text-center py-8 text-foreground/60">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p>No bookings found</p>
                </div>
              ) : (
                filteredBookings.map((booking) => (
                  <div key={booking._id} className="border rounded-lg overflow-hidden">
                    {/* Booking Header */}
                    <div className="bg-card border-b p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div>
                              <h3 className="font-semibold text-sm">Booking #{booking._id.slice(-8).toUpperCase()}</h3>
                              <p className="text-xs text-foreground/60">Created: {formatDateTime(booking.createdAt)}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge className={getStatusColor(booking.status)}>
                              {booking.status}
                            </Badge>
                            <Badge className={getBillingStatusColor(booking.billingStatus)}>
                              {booking.billingStatus}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{formatCurrency(booking.finalCost || booking.totalCost)}</div>
                          <p className="text-xs text-foreground/60">Total Cost</p>
                        </div>
                      </div>

                      {/* Customer Info Preview */}
                      <div className="flex items-center gap-3 mt-4 pt-4 border-t">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={booking.customerId.avatar} />
                          <AvatarFallback>{(booking.customerId.firstName || booking.customerId.name || booking.customerId.email).charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{booking.customerId.firstName ? `${booking.customerId.firstName} ${booking.customerId.lastName || ''}` : (booking.customerId.name || booking.customerId.email)}</p>
                          <p className="text-xs text-foreground/60 truncate">{booking.customerId.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{(booking.orderIds?.length || 0)} Orders</p>
                          <p className="text-xs text-foreground/60">{booking.items.length} Items</p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-4 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleExpand(booking._id)}
                          className="flex-1"
                        >
                          {booking.isExpanded ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                          {booking.isExpanded ? "Collapse" : "Expand"}
                        </Button>
                        <Dialog open={selectedBooking?._id === booking._id && showDetailDialog} onOpenChange={(open) => {
                          if (!open) {
                            setShowDetailDialog(false)
                            setSelectedBooking(null)
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(booking)}
                              className="flex-1"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Details
                            </Button>
                          </DialogTrigger>
                          {selectedBooking?._id === booking._id && (
                            <BookingDetailDialog
                              booking={selectedBooking}
                              onStatusUpdate={() => {
                                setSelectedBooking(null)
                                setShowDetailDialog(false)
                                fetchBookings()
                              }}
                            />
                          )}
                        </Dialog>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleCancelBooking(booking._id)}
                          disabled={deleting === booking._id || booking.status === 'cancelled'}
                          className="flex-1"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {booking.isExpanded && (
                      <div className="bg-muted/30 p-4 space-y-4 border-t">
                        {/* Repair Jobs Section */}
                        {booking.items && booking.items.filter(item => item.type === 'repair').length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">Repair Jobs</h4>
                            <div className="space-y-2">
                              {booking.items.filter(item => item.type === 'repair').map((item, idx) => (
                                <div key={idx} className="text-sm bg-card p-3 rounded border">
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <p className="font-medium">{item.device || 'Device Repair'}</p>
                                      {item.services && item.services.length > 0 && (
                                        <p className="text-xs text-foreground/60">{item.services.map(s => s.name).join(', ')}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-foreground/60">Cost:</span>
                                    <span className="font-medium">{formatCurrency(item.cost)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Products Section */}
                        {booking.items && booking.items.filter(item => item.type === 'product').length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">Products</h4>
                            <div className="space-y-2">
                              {booking.items.filter(item => item.type === 'product').map((item, idx) => (
                                <div key={idx} className="text-sm bg-card p-3 rounded border">
                                  <h5 className="font-medium mb-2">Product Item</h5>
                                  {item.products && item.products.length > 0 && (
                                    <div className="space-y-1">
                                      {item.products.map((product, pidx) => (
                                        <div key={pidx} className="flex justify-between items-center text-xs">
                                          <span>{product.name} × {product.quantity}</span>
                                          <span className="font-medium">{formatCurrency(product.totalPrice)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center mt-2 pt-2 border-t">
                                    <span className="text-xs text-foreground/60">Total:</span>
                                    <span className="font-medium">{formatCurrency(item.cost)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Timeline Section */}
                        {booking.timeline && booking.timeline.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">Timeline</h4>
                            <div className="space-y-2">
                              {booking.timeline.map((event, idx) => (
                                <div key={idx} className="text-sm bg-card p-3 rounded border flex gap-3">
                                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <p className="font-medium">{event.status}</p>
                                    <p className="text-xs text-foreground/60">{event.description}</p>
                                    <p className="text-xs text-foreground/60 mt-1">{formatDateTime(event.completedAt)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Internal Notes */}
                        {booking.internalNotes && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">Internal Notes</h4>
                            <div className="text-sm bg-card p-3 rounded border">
                              <p className="text-foreground/80">{booking.internalNotes}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

// Detailed Booking Dialog Component
function BookingDetailDialog({ booking, onStatusUpdate }: { booking: Booking; onStatusUpdate: () => void }) {
  const { t } = useToast()
  const [activeTab, setActiveTab] = useState("overview")
  const [updating, setUpdating] = useState(false)
  const [newStatus, setNewStatus] = useState(booking.status)
  const [newBillingStatus, setNewBillingStatus] = useState(booking.billingStatus)
  const [description, setDescription] = useState("")
  const { toast } = useToast()

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
                    <AvatarFallback>{booking.customerId.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{booking.customerId.name}</p>
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
                <div key={idx} className="border p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold">{item.device || 'Device Repair'}</h4>
                      {item.services && item.services.length > 0 && (
                        <p className="text-sm text-foreground/60">{item.services.map(s => s.name).join(', ')}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Item Cost: {formatCurrency(item.cost)}</div>
                    {item.services && item.services[0]?.estimatedTime && (
                      <div className="text-right">Est. Time: {item.services[0].estimatedTime} min</div>
                    )}
                  </div>
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
                  <h4 className="font-semibold mb-3">Product Item</h4>
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
