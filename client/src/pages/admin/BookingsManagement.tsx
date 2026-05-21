import React, { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import "./BookingsManagement.css"
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
  getBookingInvoices,
  createReturnLabel,
  getReturnTracking,
  updateReturnStatus,
  downloadBookingShippingLabel,
  downloadBookingReturnLabel
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
  getUnreadMessageCounts
} from "@/api/inspectionCommunication"
import { CommunicationPanel } from "@/components/inspection/CommunicationPanel"
import { CreateBookingShippingLabelDialog } from "@/components/admin/CreateBookingShippingLabelDialog"
import { buildOrderDetailsState, getOrderDetailsPath } from "@/lib/orderDetailsNavigation"
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
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Truck,
  Download,
  QrCode,
  RefreshCw,
  MapPin,
  TrendingUp,
  Activity,
  Hash,
  CreditCard,
  Home
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
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/contexts/AuthContext"

interface AddressFields {
  street?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
}

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
    invoiceAddress?: AddressFields
    paymentAddress?: AddressFields & { sameAsInvoice?: boolean }
  } | null
  guestInfo?: {
    email?: string
    firstName?: string
    lastName?: string
    phone?: string
    isGuest?: boolean
    billingAddress?: AddressFields
    shippingAddress?: AddressFields
  }
  orderIds?: Array<any>
  repairOrderIds?: Array<any>
  hasComplaintOrders?: boolean
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
  // DHL Returns information
  trackingNumber?: string
  carrier?: string
  shippingStatus?: 'pending' | 'label-created' | 'shipped' | 'in-transit' | 'out-for-delivery' | 'delivered' | 'failed' | ''
  shippingStatusDescription?: string
  shippingLabelUrl?: string
  shippingCost?: number
  shippingCreatedAt?: string
  estimatedDelivery?: string
  actualDelivery?: string
  returnLabelUrl?: string
  returnQRCodeUrl?: string
  returnTrackingNumber?: string
  returnShipmentId?: string
  returnShipmentStatus?: 'pending' | 'label-created' | 'in-transit' | 'delivered' | 'failed' | ''
  returnCreatedAt?: string
  returnReceivedAt?: string
  liveShippingTracking?: {
    status?: string
    statusCodeRaw?: string
    description?: string
    estimatedDelivery?: string
    service?: string
    shipmentId?: string
    events?: Array<{
      timestamp?: string
      location?: string
      status?: string
      statusCode?: string
      description?: string
    }>
  }
}

interface ExpandedBooking extends Booking {
  isExpanded: boolean
}

const FALLBACK_BOOKING_CUSTOMER = {
  _id: '',
  firstName: '',
  lastName: '',
  name: 'Unknown customer',
  email: 'unknown@customer.local',
  phone: '',
  avatar: ''
}

const getSafeBookingCustomer = (booking: Pick<Booking, 'customerId' | 'guestInfo'>) => {
  if (booking.customerId) return booking.customerId
  if (booking.guestInfo?.isGuest || booking.guestInfo?.email) {
    return {
      _id: '',
      firstName: booking.guestInfo.firstName || '',
      lastName: booking.guestInfo.lastName || '',
      name: `${booking.guestInfo.firstName || ''} ${booking.guestInfo.lastName || ''}`.trim() || 'Guest',
      email: booking.guestInfo.email || '',
      phone: booking.guestInfo.phone || '',
      avatar: ''
    }
  }
  return FALLBACK_BOOKING_CUSTOMER
}

const getCustomerDisplayName = (customer: typeof FALLBACK_BOOKING_CUSTOMER) => {
  if (customer.firstName) {
    return `${customer.firstName} ${customer.lastName || ''}`.trim()
  }

  return customer.name || customer.email || 'Unknown customer'
}

export function BookingsManagement() {
  console.log('BookingsManagement: Component rendered/mounted')
  const { t } = useTranslation()
  const { user } = useAuth()
  const location = useLocation()
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
  const [showCreateShippingLabelDialog, setShowCreateShippingLabelDialog] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [totalBookings, setTotalBookings] = useState(0)

  // Unread message counts state
  const [unreadCounts, setUnreadCounts] = useState<Record<string, { unread: number; senderType?: string }>>({})
  const [loadingUnreadCounts, setLoadingUnreadCounts] = useState(false)
  const [communicationDialogOpen, setCommunicationDialogOpen] = useState(false)
  const [selectedCommunicationOrder, setSelectedCommunicationOrder] = useState<{ orderId: string; orderNumber?: string } | null>(null)

  const { toast } = useToast()

  useEffect(() => {
    console.log('BookingsManagement: useEffect - Fetching bookings (pagination/filter changed)')
    fetchBookings()
  }, [currentPage, itemsPerPage, statusFilter, billingStatusFilter])

  useEffect(() => {
    const reopenBookingId = (location.state as { reopenBookingDialog?: string } | null)?.reopenBookingDialog
    if (!reopenBookingId) {
      return
    }

    const reopenBookingDialog = async () => {
      try {
        const response = await getBooking(reopenBookingId)
        setSelectedBooking(response.booking)
        setShowDetailDialog(true)
      } catch (error) {
        console.error('BookingsManagement: Error reopening booking dialog:', error)
      }
    }

    reopenBookingDialog()
  }, [location.state])

  useEffect(() => {
    // Ensure admins always land on the full booking list by default.
    if (user?.role === 'admin' && statusFilter === 'pending') {
      setStatusFilter('all')
    }
  }, [user?.role, statusFilter])

  // Fetch unread counts when bookings change and set up periodic refresh
  useEffect(() => {
    console.log(`BookingsManagement: useEffect - Bookings changed, length: ${bookings.length}`)
    if (bookings.length > 0) {
      console.log('BookingsManagement: Bookings available, fetching unread counts')
      fetchUnreadCounts()

      // Set up periodic refresh every 10 seconds
      const intervalId = setInterval(() => {
        console.log('BookingsManagement: Auto-refreshing unread counts (periodic)')
        fetchUnreadCounts()
      }, 10000) // 10 seconds

      return () => {
        console.log('BookingsManagement: Cleaning up interval on bookings change')
        clearInterval(intervalId)
      }
    } else {
      console.log('BookingsManagement: No bookings, clearing unread counts')
      setUnreadCounts({})
    }
  }, [bookings])

  const fetchBookings = async () => {
    try {
      setLoading(true)

      const filters: any = {
        limit: itemsPerPage,
        skip: (currentPage - 1) * itemsPerPage
      }

      if (statusFilter !== "all") {
        filters.status = statusFilter
      }

      if (billingStatusFilter !== "all") {
        filters.billingStatus = billingStatusFilter
      }

      console.log('Fetching bookings with filters:', filters)
      const response = await getAdminBookings(filters)

      const bookingsData = (response as any).bookings || []
      const total = (response as any).total || 0

      console.log('Received bookings:', bookingsData.length, 'Total:', total)

      setBookings(bookingsData)
      setTotalBookings(total)
      setFilteredBookings(bookingsData)
    } catch (error) {
      console.error("Error fetching bookings:", error)
      toast({
        title: t('common.error'),
        description: "Buchungen konnten nicht geladen werden",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Fetch unread message counts for all visible bookings
  const fetchUnreadCounts = async () => {
    try {
      setLoadingUnreadCounts(true)

      console.log(`BookingsManagement: fetchUnreadCounts called with ${bookings.length} bookings`)

      // Collect all order IDs from all bookings' items
      const allOrderIds: string[] = []
      const bookingToOrderMapping: Record<string, string[]> = {}

      bookings.forEach((booking) => {
        const orderIds: string[] = []
        booking.items.forEach(item => {
          if (item.orderId) {
            allOrderIds.push(item.orderId)
            orderIds.push(item.orderId)
          }
        })
        if (orderIds.length > 0) {
          bookingToOrderMapping[booking._id] = orderIds
        }
      })

      console.log(`BookingsManagement: Collected ${allOrderIds.length} order IDs from ${bookings.length} bookings`)
      console.log('BookingsManagement: Booking to order mapping:', bookingToOrderMapping)

      if (allOrderIds.length === 0) {
        console.log('BookingsManagement: No order IDs found in bookings, clearing unread counts')
        setUnreadCounts({})
        return
      }

      console.log(`BookingsManagement: Calling API to fetch unread counts for ${allOrderIds.length} orders`)
      const counts = await getUnreadMessageCounts(allOrderIds)
      console.log('BookingsManagement: Received unread counts from API:', counts)
      console.log('BookingsManagement: Unread counts type:', typeof counts, 'Keys:', Object.keys(counts || {}))

      // Ensure we have an object to work with
      const countsToSet = counts && typeof counts === 'object' ? counts : {}
      console.log('BookingsManagement: Setting unread counts state:', countsToSet)
      setUnreadCounts(countsToSet)

      // Log booking-to-order mapping for debugging
      let totalUnreadAcrossAllBookings = 0
      bookings.forEach(booking => {
        const bookingUnread = booking.items.reduce((sum, item) => {
          const itemUnread = countsToSet[item.orderId]?.unread || 0
          return sum + itemUnread
        }, 0)
        totalUnreadAcrossAllBookings += bookingUnread
        if (bookingUnread > 0) {
          console.log(`BookingsManagement: Booking ${booking._id.slice(-8)} - orders: [${booking.items.map(i => i.orderId.slice(-8)).join(', ')}] - total unread: ${bookingUnread}`)
        }
      })
      console.log(`BookingsManagement: Total unread messages across all bookings: ${totalUnreadAcrossAllBookings}`)
    } catch (error) {
      console.error("BookingsManagement: Error fetching unread counts:", error)
      console.error("BookingsManagement: Error details:", (error as any).message, (error as any).stack)
      // Don't show error toast as this is a non-critical feature
    } finally {
      setLoadingUnreadCounts(false)
    }
  }

  // Client-side search filtering (API filters are handled on server)
  useEffect(() => {
    let filtered = bookings

    if (searchTerm) {
      filtered = filtered.filter(booking => {
        const customer = getSafeBookingCustomer(booking)
        const customerName = getCustomerDisplayName(customer)
        return (
          booking._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (booking.bookingNumber && booking.bookingNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
          customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.phone.includes(searchTerm)
        )
      })
    }

    setFilteredBookings(filtered)
  }, [bookings, searchTerm])

  const openOrderCommunication = (orderId: string, orderNumber?: string) => {
    if (!orderId) return
    setSelectedCommunicationOrder({ orderId, orderNumber })
    setCommunicationDialogOpen(true)
  }

  const handleViewDetails = async (booking: Booking) => {
    try {
      const response = await getBooking(booking._id)
      setSelectedBooking(response.booking)
      setShowDetailDialog(true)
    } catch (error) {
      toast({
        title: t('common.error'),
        description: "Buchungsdetails konnten nicht geladen werden",
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
        description: "Buchungsstatus erfolgreich aktualisiert"
      })
      setUpdateStatusDialog(false)
      setDescription("")
      setNewStatus("")
      fetchBookings()
    } catch (error) {
      toast({
        title: t('common.error'),
        description: "Buchungsstatus konnte nicht aktualisiert werden",
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
        description: "Zahlungsstatus erfolgreich aktualisiert"
      })
      setUpdateBillingDialog(false)
      setNewBillingStatus("")
      fetchBookings()
    } catch (error) {
      toast({
        title: t('common.error'),
        description: "Zahlungsstatus konnte nicht aktualisiert werden",
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
        description: "Buchung erfolgreich storniert"
      })
      fetchBookings()
    } catch (error) {
      toast({
        title: t('common.error'),
        description: "Buchung konnte nicht storniert werden",
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
          description: "Zugeordnete Auftraege konnten nicht geladen werden",
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

  // Helper function to get total unread count for a booking
  const getBookingUnreadCount = (booking: Booking) => {
    let totalUnread = 0
    let hasCustomerMessages = false
    let hasStaffMessages = false

    // Check all items in the booking
    booking.items.forEach((item) => {
      if (item.orderId && unreadCounts[item.orderId]) {
        const unreadCount = unreadCounts[item.orderId].unread || 0
        totalUnread += unreadCount
        if (unreadCounts[item.orderId].senderType === 'customer') {
          hasCustomerMessages = true
        } else {
          hasStaffMessages = true
        }
      }
    })

    // Debug logging only if there are unread messages
    if (totalUnread > 0) {
      console.log(`BookingsManagement: Booking ${booking._id.slice(-8)} has ${totalUnread} unread messages (customer: ${hasCustomerMessages}, staff: ${hasStaffMessages})`)
    }

    return {
      total: totalUnread,
      hasCustomerMessages,
      hasStaffMessages
    }
  }

  const getFirstUnreadOrderForBooking = (booking: Booking) => {
    const unreadItem = booking.items.find((item) => item.orderId && (unreadCounts[item.orderId]?.unread || 0) > 0)
    if (!unreadItem?.orderId) return null

    const matchingOrder = expandedOrdersData[booking._id]?.find((order: any) => order.orderId === unreadItem.orderId)
    return {
      orderId: unreadItem.orderId,
      orderNumber: matchingOrder?.orderNumber,
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

  const getOrderTypeBadgeClass = (item: any) => {
    if (item?.type === 'repair' && item?.isComplaintFollowup) {
      return 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-900 dark:text-rose-200 dark:border-rose-700'
    }

    if (item?.type === 'repair') {
      return 'bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700'
    }

    return 'bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700'
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

  const getBookingStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Ausstehend'
      case 'payment-pending':
        return 'Zahlung ausstehend'
      case 'processing':
        return 'In Bearbeitung'
      case 'completed':
        return 'Abgeschlossen'
      case 'cancelled':
        return 'Storniert'
      default:
        return status
    }
  }

  const getBillingStatusLabel = (status: string) => {
    switch (status) {
      case 'unpaid':
        return 'Unbezahlt'
      case 'partially-paid':
        return 'Teilweise bezahlt'
      case 'paid':
        return 'Bezahlt'
      default:
        return status
    }
  }

  const getShippingStatusLabel = (status?: string) => {
    switch (status) {
      case 'pending':
        return 'Ausstehend'
      case 'label-created':
        return 'Label erstellt'
      case 'shipped':
        return 'Versendet'
      case 'in-transit':
        return 'Unterwegs'
      case 'out-for-delivery':
        return 'In Zustellung'
      case 'delivered':
        return 'Zugestellt'
      case 'failed':
        return 'Fehlgeschlagen'
      default:
        return status || 'Unbekannt'
    }
  }

  const getOrderProgressStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Ausstehend'
      case 'in-progress':
        return 'In Arbeit'
      case 'quality-check':
        return 'Qualitaetspruefung'
      case 'ready-for-pickup':
        return 'Abholbereit'
      case 'completed':
        return 'Abgeschlossen'
      case 'cancelled':
        return 'Storniert'
      default:
        return status
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="section" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="container">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--primary-blue)' }}></div>
            <p className="mt-4" style={{ color: 'var(--gray-500)', fontSize: '0.95rem' }}>Buchungen werden geladen...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="section bookings-management-section" style={{ background: 'var(--off-white)', minHeight: 'calc(100vh - 200px)', paddingTop: '20px', paddingBottom: '36px' }}>
      <div className="container bookings-container">
        <div className="section-title bookings-page-header" style={{ marginBottom: '20px' }}>
          <h1 className="bookings-page-title" style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--white)', marginBottom: '4px' }}>Buchungsverwaltung</h1>
          <p className="bookings-page-subtitle" style={{ color: 'rgba(255,255,255,0.88)', fontSize: '0.82rem' }}>Verwalte und ueberwache alle buchungsbezogenen Aufgaben</p>
          <div className="accent-line"></div>
        </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: '16px' }}>
        <div style={{ 
          background: 'var(--white)', 
          border: '1px solid var(--gray-200)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '12px',
          boxShadow: 'var(--shadow-sm)',
          transition: 'var(--transition)'
        }} className="hover:shadow-md">
          <div style={{ color: 'var(--gray-500)', fontSize: '0.74rem', fontWeight: '600', marginBottom: '4px' }}>Buchungen gesamt</div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--primary-blue)' }}>{bookings.length}</div>
        </div>
        <div style={{ 
          background: 'var(--white)', 
          border: '1px solid var(--gray-200)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '12px',
          boxShadow: 'var(--shadow-sm)',
          transition: 'var(--transition)'
        }} className="hover:shadow-md">
          <div style={{ color: 'var(--gray-500)', fontSize: '0.74rem', fontWeight: '600', marginBottom: '4px' }}>Ausstehend</div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--accent-yellow)' }}>{bookings.filter(b => b.status === 'pending').length}</div>
        </div>
        <div style={{ 
          background: 'var(--white)', 
          border: '1px solid var(--gray-200)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '12px',
          boxShadow: 'var(--shadow-sm)',
          transition: 'var(--transition)'
        }} className="hover:shadow-md">
          <div style={{ color: 'var(--gray-500)', fontSize: '0.74rem', fontWeight: '600', marginBottom: '4px' }}>Zahlung ausstehend</div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#ff9800' }}>{bookings.filter(b => b.status === 'payment-pending').length}</div>
        </div>
        <div style={{ 
          background: 'var(--white)', 
          border: '1px solid var(--gray-200)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '12px',
          boxShadow: 'var(--shadow-sm)',
          transition: 'var(--transition)'
        }} className="hover:shadow-md">
          <div style={{ color: 'var(--gray-500)', fontSize: '0.74rem', fontWeight: '600', marginBottom: '4px' }}>Gesamtumsatz</div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--success)' }}>{formatCurrency(bookings.reduce((sum, b) => sum + (b.finalCost || b.totalCost || 0), 0))}</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div style={{ 
        background: 'var(--white)', 
        border: '1px solid var(--gray-200)', 
        borderRadius: 'var(--radius-lg)', 
        padding: '14px',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '14px'
      }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--gray-800)', marginBottom: '10px' }}>Filter</h2>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <label style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '4px', display: 'block' }}>Suche</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: 'var(--gray-400)' }} />
              <Input
                placeholder="Suche nach Buchungs-ID, Kundenname, E-Mail oder Telefon..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                style={{
                  border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 8px 8px 34px',
                  fontSize: '0.82rem',
                  width: '100%'
                }}
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <label style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '4px', display: 'block' }}>Buchungsstatus</label>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="pending">Ausstehend</SelectItem>
                <SelectItem value="payment-pending">Zahlung ausstehend</SelectItem>
                <SelectItem value="processing">In Bearbeitung</SelectItem>
                <SelectItem value="completed">Abgeschlossen</SelectItem>
                <SelectItem value="cancelled">Storniert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-48">
            <label style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '4px', display: 'block' }}>Zahlungsstatus</label>
            <Select
              value={billingStatusFilter}
              onValueChange={(value) => {
                setBillingStatusFilter(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Zahlungsstatus</SelectItem>
                <SelectItem value="unpaid">Unbezahlt</SelectItem>
                <SelectItem value="partially-paid">Teilweise bezahlt</SelectItem>
                <SelectItem value="paid">Bezahlt</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div style={{ 
        background: 'var(--white)', 
        border: '1px solid var(--gray-200)', 
        borderRadius: 'var(--radius-lg)', 
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary-blue)', marginBottom: '2px' }}>Buchungsliste</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{filteredBookings.length} Buchungen gefunden</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              console.log('BookingsManagement: Manually refreshing unread counts')
              fetchUnreadCounts()
            }}
            disabled={loadingUnreadCounts}
            title="Nachrichtenanzahl aktualisieren"
            style={{
              border: '1px solid var(--gray-200)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--white)',
              color: 'var(--gray-700)',
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: '500'
            }}
          >
            <RefreshCw className={`h-4 w-4 ${loadingUnreadCounts ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div style={{ padding: '10px 12px' }}>
          {filteredBookings.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--gray-400)' }}>
              <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p style={{ fontSize: '0.95rem' }}>Keine Buchungen gefunden</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto bookings-list-table-wrap">
              <Table className="w-full min-w-full bookings-list-table">
                <TableHeader style={{ background: 'var(--primary-blue)', borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0' }}>
                  <TableRow>
                    <TableHead className="w-12 flex-shrink-0" style={{ color: 'var(--white)', fontWeight: '600', fontSize: '0.85rem' }}></TableHead>
                    <TableHead className="min-w-[100px]" style={{ color: 'var(--white)', fontWeight: '600', fontSize: '0.85rem' }}>Buchungs-ID</TableHead>
                    <TableHead className="min-w-[150px]" style={{ color: 'var(--white)', fontWeight: '600', fontSize: '0.85rem' }}>Kunde</TableHead>
                    <TableHead className="min-w-[90px]" style={{ color: 'var(--white)', fontWeight: '600', fontSize: '0.85rem' }}>Status</TableHead>
                    <TableHead className="min-w-[100px]" style={{ color: 'var(--white)', fontWeight: '600', fontSize: '0.85rem' }}>Zahlungsstatus</TableHead>
                    <TableHead className="min-w-[110px]" style={{ color: 'var(--white)', fontWeight: '600', fontSize: '0.85rem' }}>Versandstatus</TableHead>
                    <TableHead className="min-w-[100px]" style={{ color: 'var(--white)', fontWeight: '600', fontSize: '0.85rem' }}>Fortschritt</TableHead>
                    <TableHead className="min-w-[90px]" style={{ color: 'var(--white)', fontWeight: '600', fontSize: '0.85rem' }}>Gesamtkosten</TableHead>
                    <TableHead className="min-w-[70px] text-center" style={{ color: 'var(--white)', fontWeight: '600', fontSize: '0.85rem' }}>Orders</TableHead>
                    <TableHead className="min-w-[60px] text-center" style={{ color: 'var(--white)', fontWeight: '600', fontSize: '0.85rem' }}>Positionen</TableHead>
                    <TableHead className="min-w-[70px] text-center" style={{ color: 'var(--white)', fontWeight: '600', fontSize: '0.85rem' }}>Msgs</TableHead>
                    <TableHead className="min-w-[100px]" style={{ color: 'var(--white)', fontWeight: '600', fontSize: '0.85rem' }}>Erstellt</TableHead>
                    <TableHead className="text-right min-w-[120px] flex-shrink-0" style={{ color: 'var(--white)', fontWeight: '600', fontSize: '0.85rem' }}>Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => {
                    const customer = getSafeBookingCustomer(booking)
                    const customerDisplayName = getCustomerDisplayName(customer)
                    const customerInitial = (customer.firstName || customer.name || customer.email || 'U').charAt(0).toUpperCase()

                    return (
                    <React.Fragment key={booking._id}>
                    <TableRow
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleViewDetails(booking)}
                    >
                      <TableCell className="w-12">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpandBooking(booking._id)
                          }}
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
                        <div className="flex flex-col gap-1">
                          <span>#{booking._id.slice(-8).toUpperCase()}</span>
                          {(booking as any).hasComplaintOrders && (
                            <Badge className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] px-1.5 py-0 h-4 w-fit font-medium">
                              Reklamation
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={customer.avatar} />
                            <AvatarFallback>{customerInitial}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{customerDisplayName}</p>
                            <p className="text-xs text-foreground/60 truncate">{customer.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(booking.status)}>
                          {getBookingStatusLabel(booking.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getBillingStatusColor(booking.billingStatus)}>
                          {getBillingStatusLabel(booking.billingStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {booking.returnShipmentStatus ? (
                          <Badge className={
                            booking.returnShipmentStatus === 'delivered' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            booking.returnShipmentStatus === 'in-transit' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            booking.returnShipmentStatus === 'label-created' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            booking.returnShipmentStatus === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }>
                            <Truck className="h-3 w-3 mr-1" />
                            {getShippingStatusLabel(booking.returnShipmentStatus)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-foreground/50">Keine Ruecksendung</span>
                        )}
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
                      <TableCell className="text-center">
                        {(() => {
                          const unreadInfo = getBookingUnreadCount(booking)
                          if (unreadInfo.total > 0) {
                            const firstUnreadOrder = getFirstUnreadOrderForBooking(booking)
                            return (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  className={`
                                    relative inline-flex items-center justify-center
                                    w-8 h-8 rounded-full
                                    font-semibold text-xs
                                    shadow-md
                                    ring-2 ring-offset-2
                                    transition-all duration-200
                                    ${unreadInfo.hasCustomerMessages
                                      ? 'bg-red-500 dark:bg-red-600 text-white ring-red-200 dark:ring-red-800 hover:scale-110 hover:shadow-lg animate-pulse'
                                      : 'bg-orange-500 dark:bg-orange-600 text-white ring-orange-200 dark:ring-orange-800 hover:scale-110 hover:shadow-lg animate-pulse'
                                    }
                                  `}
                                  title={`${unreadInfo.total} total unread message${unreadInfo.total > 1 ? 's' : ''} from ${unreadInfo.hasCustomerMessages ? 'customer' : 'staff'}`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (firstUnreadOrder?.orderId) {
                                      openOrderCommunication(firstUnreadOrder.orderId, firstUnreadOrder.orderNumber)
                                    }
                                  }}
                                >
                                  {unreadInfo.total > 99 ? '99+' : unreadInfo.total}
                                </button>
                                <MessageSquare className="h-3 w-3 text-foreground/60 hidden sm:inline" />
                              </div>
                            )
                          }
                          return <span className="text-xs text-foreground/40">—</span>
                        })()}
                      </TableCell>
                      <TableCell className="text-sm text-foreground/60">
                        {formatDate(booking.createdAt)}
                      </TableCell>
                      <TableCell className="text-right sticky right-0 bg-background" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 z-50">
                            <DropdownMenuItem onClick={() => handleViewDetails(booking)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Details anzeigen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedBooking(booking)
                              setShowInvoiceDialog(true)
                            }}>
                              <FileText className="h-4 w-4 mr-2" />
                              Rechnung erstellen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedBooking(booking)
                              setShowReminderDialog(true)
                            }}>
                              <Bell className="h-4 w-4 mr-2" />
                              Erinnerung erstellen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedBooking(booking)
                              setShowComplaintDialog(true)
                            }}>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Reklamation erfassen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedBooking(booking)
                              setShowCreateShippingLabelDialog(true)
                            }}>
                              <Truck className="h-4 w-4 mr-2" />
                              Versandlabel erstellen
                            </DropdownMenuItem>
                            {(booking.orderIds?.length || 0) > 0 && (
                              <DropdownMenuItem onClick={() => {
                                window.location.href = `/admin/orders?bookingId=${booking._id}`
                              }}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Auftraege anzeigen
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleCancelBooking(booking._id)}
                              disabled={deleting === booking._id || booking.status === 'cancelled'}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Buchung stornieren
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
                        <TableCell colSpan={12}>
                          <div className="p-4 space-y-4">
                            {/* Booking Status Summary */}
                            <div className="bg-muted/50 p-3 rounded-lg border">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-foreground/60 uppercase">Buchungsstatus</span>
                                <Badge className={getStatusColor(booking.status)}>
                                  {getBookingStatusLabel(booking.status)}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                <div>
                                  <span className="text-foreground/60">Zahlungsstatus:</span>
                                  <Badge className={`${getBillingStatusColor(booking.billingStatus)} ml-2`}>
                                    {getBillingStatusLabel(booking.billingStatus)}
                                  </Badge>
                                </div>
                                <div className="text-right">
                                  <span className="text-foreground/60">Total: </span>
                                  <span className="font-semibold">{formatCurrency(booking.totalCost)}</span>
                                </div>
                              </div>
                              <div>
                                  <span className="text-xs text-foreground/60 mb-1 block">Gesamtfortschritt:</span>
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
                                <p className="text-sm text-foreground/60">Auftraege werden geladen...</p>
                              </div>
                            ) : expandedOrdersData[booking._id] && expandedOrdersData[booking._id].length > 0 ? (
                              <div className="space-y-4">
                                <h4 className="font-semibold text-sm mb-3">Zugeordnete Auftraege und Reparaturen</h4>
                                <div className="border rounded-lg overflow-hidden">
                                  <Table className="text-sm">
                                    <TableHeader>
                                      <TableRow className="bg-muted/50">
                                        <TableHead>Auftragsnummer</TableHead>
                                        <TableHead>Typ</TableHead>
                                        <TableHead>Geraet/Produkt</TableHead>
                                        <TableHead>Leistungen/Details</TableHead>
                                        <TableHead className="text-center">Fortschritt</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-center">Nachrichten</TableHead>
                                        <TableHead className="text-right">Kosten</TableHead>
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
                                            <Badge className={getOrderTypeBadgeClass(item)}>
                                              {item.type === 'repair'
                                                ? (item.isComplaintFollowup ? 'Reklamationsreparatur' : 'Reparatur')
                                                : 'Produkt'}
                                            </Badge>
                                          </TableCell>
                                          <TableCell>
                                            <div className="text-sm">
                                              {item.type === 'repair' ? (
                                                <span>{item.device || 'Geraetereparatur'}</span>
                                              ) : (
                                                <span>{item.products?.map((p: any) => p.name).join(', ') || 'Produktposition'}</span>
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
                                                <span className="text-xs text-foreground/50">Keine Details</span>
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
                                              {getOrderProgressStatusLabel(item.status || 'pending')}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="text-center">
                                            {item.orderId && unreadCounts[item.orderId] ? (
                                              <div className="flex items-center justify-center">
                                                <button
                                                  type="button"
                                                  className={`
                                                    relative inline-flex items-center justify-center
                                                    w-8 h-8 rounded-full
                                                    ${unreadCounts[item.orderId].senderType === 'customer'
                                                      ? 'bg-blue-500 dark:bg-blue-600'
                                                      : 'bg-orange-500 dark:bg-orange-600'
                                                    }
                                                    text-white font-semibold text-xs
                                                    shadow-lg
                                                    animate-pulse
                                                    hover:scale-110 transition-transform cursor-pointer
                                                  `}
                                                  title={`Open customer communication (${unreadCounts[item.orderId].unread} unread message${unreadCounts[item.orderId].unread > 1 ? 's' : ''})`}
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    openOrderCommunication(item.orderId, item.orderNumber)
                                                  }}
                                                >
                                                  {unreadCounts[item.orderId].unread > 99 ? '99+' : unreadCounts[item.orderId].unread}
                                                </button>
                                              </div>
                                            ) : (
                                              <span className="text-xs text-foreground/40">—</span>
                                            )}
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
                                <p className="text-sm text-foreground/60">Keine zugeordneten Auftraege gefunden</p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </React.Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {filteredBookings.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 6px', borderTop: '1px solid var(--gray-100)', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                  Zeige {((currentPage - 1) * itemsPerPage) + 1} bis {Math.min(currentPage * itemsPerPage, totalBookings)} von {totalBookings} Buchungen
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>Zeilen pro Seite:</label>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(parseInt(value))
                      setCurrentPage(1) // Reset to first page when changing items per page
                    }}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Zurueck
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.ceil(totalBookings / itemsPerPage) }, (_, i) => i + 1)
                      .filter(page => {
                        // Show first page, last page, current page, and pages around current
                        const totalPages = Math.ceil(totalBookings / itemsPerPage)
                        return (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                        )
                      })
                      .map((page, index, array) => {
                        // Add ellipsis between non-consecutive pages
                        const prevPage = array[index - 1]
                        const showEllipsis = prevPage && page - prevPage > 1

                        return (
                          <React.Fragment key={page}>
                            {showEllipsis && (
                              <span className="px-2 text-foreground/40">...</span>
                            )}
                            <Button
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              disabled={loading}
                              className="w-10"
                            >
                              {page}
                            </Button>
                          </React.Fragment>
                        )
                      })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalBookings / itemsPerPage), prev + 1))}
                    disabled={currentPage >= Math.ceil(totalBookings / itemsPerPage) || loading}
                  >
                    Weiter
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Dialog
            open={communicationDialogOpen && !!selectedCommunicationOrder}
            onOpenChange={(open) => {
              setCommunicationDialogOpen(open)
              if (!open) {
                setSelectedCommunicationOrder(null)
                fetchUnreadCounts()
              }
            }}
          >
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden p-0">
              <DialogHeader className="px-6 pt-6 pb-0">
                <DialogTitle className="sr-only">Kundenkommunikation</DialogTitle>
                <DialogDescription className="sr-only">
                  Kundenkommunikation fuer den ausgewaehlten Auftrag einsehen und verwalten.
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
                      {selectedCommunicationOrder.orderNumber && (
                        <Badge variant="outline" className="text-xs">
                          {selectedCommunicationOrder.orderNumber}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Kundenfeedback, Anfragen und Rueckfragen zentral verwalten.
                    </p>
                    <div className="rounded-lg border p-2 bg-background">
                      <CommunicationPanel
                        orderId={selectedCommunicationOrder.orderId}
                        inspectionId={selectedCommunicationOrder.orderId}
                      />
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
              title: "Erfolg",
              description: "Rechnung erfolgreich erstellt"
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
              title: "Erfolg",
              description: "Erinnerung erfolgreich erstellt"
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
              title: "Erfolg",
              description: "Reklamation erfolgreich erfasst"
            })
            setShowComplaintDialog(false)
            setSelectedBooking(null)
          }}
        />
      )}

      {/* Create Shipping Label Dialog */}
      {selectedBooking && (
        <CreateBookingShippingLabelDialog
          bookingId={selectedBooking._id}
          open={showCreateShippingLabelDialog}
          onOpenChange={(open) => {
            setShowCreateShippingLabelDialog(open)
            if (!open) {
              setSelectedBooking(null)
            }
          }}
          onSuccess={() => {
            toast({
              title: "Erfolg",
              description: "Versandlabel erfolgreich erstellt"
            })
            setShowCreateShippingLabelDialog(false)
            // Refresh booking details
            if (selectedBooking) {
              getBooking(selectedBooking._id).then(response => {
                setSelectedBooking(response.booking)
              }).catch(error => {
                console.error('Error refreshing booking:', error)
              })
            }
          }}
        />
      )}
      </div>
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
  const { t } = useTranslation()
  const location = useLocation()
  const customer = getSafeBookingCustomer(booking)
  const customerDisplayName = getCustomerDisplayName(customer)
  const [activeTab, setActiveTab] = useState("overview")
  const [updating, setUpdating] = useState(false)
  const [newStatus, setNewStatus] = useState(booking.status)
  const [newBillingStatus, setNewBillingStatus] = useState(booking.billingStatus)
  const [description, setDescription] = useState("")
  const [showReturnLabelDialog, setShowReturnLabelDialog] = useState(false)
  const [detailOrders, setDetailOrders] = useState<any[]>([])
  const [loadingRepairJobs, setLoadingRepairJobs] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    let isMounted = true

    const loadBookingOrders = async () => {
      try {
        setLoadingRepairJobs(true)
        const response = await getBookingOrders(booking._id)

        if (!isMounted) return
        setDetailOrders(response?.orders || [])
      } catch (error) {
        if (!isMounted) return
        // Fallback to booking.items in UI if dedicated orders endpoint has no entries yet.
        setDetailOrders([])
      } finally {
        if (isMounted) {
          setLoadingRepairJobs(false)
        }
      }
    }

    loadBookingOrders()

    return () => {
      isMounted = false
    }
  }, [booking._id])

  // Description: Navigate to the order details page for a specific order
  // Endpoint: None (client-side navigation)
  const handleViewOrder = (orderId: string) => {
    if (!orderId) {
      console.warn("No order ID provided for navigation")
      return
    }
    navigate(getOrderDetailsPath(orderId), {
      state: buildOrderDetailsState(location, {
        label: t('common.back'),
        restoreState: { reopenBookingDialog: booking._id },
      }),
    })
  }

  const handleStatusUpdate = async () => {
    try {
      setUpdating(true)
      await updateBookingStatus(booking._id, newStatus as any, description)
      toast({
        title: "Success",
        description: "Buchungsstatus aktualisiert"
      })
      setDescription("")
      onStatusUpdate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Status konnte nicht aktualisiert werden",
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
        description: "Zahlungsstatus aktualisiert"
      })
      onStatusUpdate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Zahlungsstatus konnte nicht aktualisiert werden",
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
    return new Date(dateString).toLocaleString('de-DE', {
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

  const getBookingStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Ausstehend'
      case 'payment-pending':
        return 'Zahlung ausstehend'
      case 'processing':
        return 'In Bearbeitung'
      case 'completed':
        return 'Abgeschlossen'
      case 'cancelled':
        return 'Storniert'
      default:
        return status
    }
  }

  const getBillingStatusLabel = (status: string) => {
    switch (status) {
      case 'unpaid':
        return 'Unbezahlt'
      case 'partially-paid':
        return 'Teilweise bezahlt'
      case 'paid':
        return 'Bezahlt'
      default:
        return status
    }
  }

  const getShippingStatusLabel = (status?: string) => {
    switch (status) {
      case 'pending':
        return 'Ausstehend'
      case 'label-created':
        return 'Label erstellt'
      case 'shipped':
        return 'Versendet'
      case 'in-transit':
        return 'Unterwegs'
      case 'out-for-delivery':
        return 'In Zustellung'
      case 'delivered':
        return 'Zugestellt'
      case 'failed':
        return 'Fehlgeschlagen'
      default:
        return status || 'Unbekannt'
    }
  }

  const getShippingStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'out-for-delivery':
      case 'in-transit':
      case 'shipped':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'label-created':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getOrderStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Ausstehend'
      case 'diagnostic-assessment': return 'Diagnosebewertung'
      case 'diagnosed': return 'Diagnose abgeschlossen'
      case 'awaiting-parts': return 'Wartet auf Teile'
      case 'in-progress': return 'Reparatur läuft'
      case 'paused': return 'Pausiert'
      case 'on-hold': return 'Angehalten'
      case 'quality-check': return 'Qualitätsprüfung'
      case 'ready-for-pickup': return 'Abholbereit'
      case 'completed': return 'Abgeschlossen'
      case 'cancelled': return 'Storniert'
      default: return status
    }
  }

  const getOrderStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border border-yellow-300'
      case 'diagnostic-assessment': return 'bg-purple-100 text-purple-800 border border-purple-300'
      case 'diagnosed': return 'bg-indigo-100 text-indigo-800 border border-indigo-300'
      case 'awaiting-parts': return 'bg-orange-100 text-orange-800 border border-orange-300'
      case 'in-progress': return 'bg-blue-100 text-blue-800 border border-blue-300'
      case 'paused': return 'bg-gray-100 text-gray-700 border border-gray-300'
      case 'on-hold': return 'bg-gray-100 text-gray-700 border border-gray-300'
      case 'quality-check': return 'bg-cyan-100 text-cyan-800 border border-cyan-300'
      case 'ready-for-pickup': return 'bg-teal-100 text-teal-800 border border-teal-300'
      case 'completed': return 'bg-green-100 text-green-800 border border-green-300'
      case 'cancelled': return 'bg-red-100 text-red-800 border border-red-300'
      default: return 'bg-gray-100 text-gray-700 border border-gray-300'
    }
  }

  const hasOutboundShippingInfo = Boolean(
    booking.trackingNumber ||
    booking.shippingLabelUrl ||
    booking.shippingCreatedAt ||
    booking.estimatedDelivery ||
    booking.actualDelivery ||
    booking.shippingStatusDescription ||
    (booking.shippingStatus && booking.shippingStatus !== 'pending')
  )

  const hasReturnShippingInfo = Boolean(
    booking.returnTrackingNumber ||
    booking.returnLabelUrl ||
    booking.returnQRCodeUrl ||
    booking.returnCreatedAt ||
    booking.returnReceivedAt ||
    booking.returnShipmentStatusDescription ||
    (booking.returnShipmentStatus && booking.returnShipmentStatus !== 'pending')
  )

  const hasAnyShippingInfo = hasOutboundShippingInfo || hasReturnShippingInfo
  const repairJobs = (detailOrders.length > 0 ? detailOrders : booking.items || []).filter((item: any) => item.type === 'repair')

  return (
    <DialogContent 
      className="bookings-detail-dialog max-w-3xl max-h-[90vh] overflow-y-auto"
      style={{
        background: 'var(--off-white, #f8f9fc)',
        border: '1px solid var(--gray-200, #d8dce6)',
        borderRadius: 'var(--radius-lg, 16px)',
        boxShadow: 'var(--shadow-xl, 0 16px 48px rgba(0,0,0,0.15))',
        fontFamily: 'var(--font-main, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)'
      }}
    >
      <DialogHeader className="bookings-detail-header" style={{ marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.22)' }}>
        <DialogTitle style={{ 
          fontSize: '1.15rem', 
          fontWeight: '700', 
          color: 'var(--white, #ffffff)',
          marginBottom: '2px',
          letterSpacing: '-0.5px'
        }}>
          Buchungsdetails
        </DialogTitle>
        <DialogDescription style={{ 
          fontSize: '0.78rem', 
          color: 'rgba(255,255,255,0.88)',
          fontWeight: '500'
        }}>
          Buchungs-ID: #{booking._id.slice(-8).toUpperCase()}
        </DialogDescription>
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList 
          className="grid w-full grid-cols-6"
          style={{
            background: 'var(--white, #ffffff)',
            border: '1px solid var(--gray-200, #d8dce6)',
            borderRadius: 'var(--radius-md, 10px)',
            padding: '2px',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))',
            gap: '2px'
          }}
        >
          <TabsTrigger 
            value="overview"
            style={{
              fontSize: '0.76rem',
              fontWeight: '600',
              borderRadius: 'var(--radius-sm, 6px)',
              transition: 'var(--transition, all 0.25s cubic-bezier(0.4, 0, 0.2, 1))'
            }}
          >
            Uebersicht
          </TabsTrigger>
          <TabsTrigger 
            value="repairs"
            style={{
              fontSize: '0.76rem',
              fontWeight: '600',
              borderRadius: 'var(--radius-sm, 6px)',
              transition: 'var(--transition, all 0.25s cubic-bezier(0.4, 0, 0.2, 1))'
            }}
          >
            Reparaturen
          </TabsTrigger>
          <TabsTrigger 
            value="items"
            style={{
              fontSize: '0.76rem',
              fontWeight: '600',
              borderRadius: 'var(--radius-sm, 6px)',
              transition: 'var(--transition, all 0.25s cubic-bezier(0.4, 0, 0.2, 1))'
            }}
          >
            Positionen
          </TabsTrigger>
          <TabsTrigger 
            value="shipping"
            style={{
              fontSize: '0.76rem',
              fontWeight: '600',
              borderRadius: 'var(--radius-sm, 6px)',
              transition: 'var(--transition, all 0.25s cubic-bezier(0.4, 0, 0.2, 1))'
            }}
          >
            Versand
          </TabsTrigger>
          <TabsTrigger 
            value="invoices"
            style={{
              fontSize: '0.76rem',
              fontWeight: '600',
              borderRadius: 'var(--radius-sm, 6px)',
              transition: 'var(--transition, all 0.25s cubic-bezier(0.4, 0, 0.2, 1))'
            }}
          >
            Rechnungen
          </TabsTrigger>
          <TabsTrigger 
            value="timeline"
            style={{
              fontSize: '0.76rem',
              fontWeight: '600',
              borderRadius: 'var(--radius-sm, 6px)',
              transition: 'var(--transition, all 0.25s cubic-bezier(0.4, 0, 0.2, 1))'
            }}
          >
            Verlauf
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Customer Info – full width card with billing + shipping address */}
          <div
            style={{
              background: 'var(--white, #ffffff)',
              border: '1px solid var(--gray-200, #d8dce6)',
              borderRadius: 'var(--radius-lg, 16px)',
              padding: '20px',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))',
            }}
          >
            {/* Header row */}
            <div className="flex items-center gap-2 mb-4">
              <div style={{ background: 'var(--primary-blue, #1a2a5e)', borderRadius: '8px', padding: '6px' }}>
                <User className="h-4 w-4" style={{ color: 'var(--white, #ffffff)' }} />
              </div>
              <h3 style={{ color: 'var(--primary-blue, #1a2a5e)', fontSize: '1rem', fontWeight: '700' }}>
                Kundeninformationen
              </h3>
              {booking.guestInfo?.isGuest && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
                  Gast
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Identity + contact */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11 flex-shrink-0" style={{ border: '2px solid var(--accent-yellow, #f5b800)' }}>
                    <AvatarImage src={customer.avatar} />
                    <AvatarFallback style={{ background: 'var(--primary-blue, #1a2a5e)', color: 'var(--white, #ffffff)', fontWeight: '700' }}>
                      {(customerDisplayName || customer.email || '?').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--gray-900, #111827)' }}>
                      {customerDisplayName}
                    </p>
                    {customer._id && (
                      <p className="text-xs truncate" style={{ color: 'var(--gray-400, #8892a8)' }}>
                        ID: {customer._id.slice(-8).toUpperCase()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                    <span className="truncate" style={{ color: 'var(--gray-700, #2d3748)' }}>{customer.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                    <span style={{ color: customer.phone ? 'var(--gray-700, #2d3748)' : 'var(--gray-400, #8892a8)' }}>
                      {customer.phone || 'Nicht verfügbar'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Billing address */}
              {(() => {
                const addr = booking.customerId?.invoiceAddress || booking.guestInfo?.billingAddress
                const hasAddr = addr && (addr.street || addr.city || addr.zipCode)
                return (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <CreditCard className="h-3.5 w-3.5" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--gray-500, #636e85)' }}>
                        Rechnungsadresse
                      </p>
                    </div>
                    {hasAddr ? (
                      <div className="space-y-0.5 text-sm" style={{ color: 'var(--gray-700, #2d3748)' }}>
                        {addr!.street && <p>{addr!.street}</p>}
                        {(addr!.zipCode || addr!.city) && (
                          <p>{[addr!.zipCode, addr!.city].filter(Boolean).join(' ')}</p>
                        )}
                        {addr!.state && <p>{addr!.state}</p>}
                        {addr!.country && <p style={{ color: 'var(--gray-500, #636e85)', fontSize: '0.8rem' }}>{addr!.country}</p>}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--gray-400, #8892a8)' }}>Nicht angegeben</p>
                    )}
                  </div>
                )
              })()}

              {/* Shipping/delivery address */}
              {(() => {
                const billingAddr = booking.customerId?.invoiceAddress || booking.guestInfo?.billingAddress
                const deliveryAddr = booking.customerId?.paymentAddress?.sameAsInvoice === false
                  ? booking.customerId.paymentAddress
                  : booking.guestInfo?.shippingAddress
                const hasAddr = deliveryAddr && (deliveryAddr.street || deliveryAddr.city || deliveryAddr.zipCode)
                const sameAsBilling = booking.customerId?.paymentAddress?.sameAsInvoice !== false && !booking.guestInfo?.shippingAddress

                return (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Home className="h-3.5 w-3.5" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--gray-500, #636e85)' }}>
                        Lieferadresse
                      </p>
                    </div>
                    {sameAsBilling && (billingAddr?.street || billingAddr?.city) ? (
                      <p className="text-sm italic" style={{ color: 'var(--gray-400, #8892a8)' }}>Identisch mit Rechnungsadresse</p>
                    ) : hasAddr ? (
                      <div className="space-y-0.5 text-sm" style={{ color: 'var(--gray-700, #2d3748)' }}>
                        {deliveryAddr!.street && <p>{deliveryAddr!.street}</p>}
                        {(deliveryAddr!.zipCode || deliveryAddr!.city) && (
                          <p>{[deliveryAddr!.zipCode, deliveryAddr!.city].filter(Boolean).join(' ')}</p>
                        )}
                        {deliveryAddr!.state && <p>{deliveryAddr!.state}</p>}
                        {deliveryAddr!.country && <p style={{ color: 'var(--gray-500, #636e85)', fontSize: '0.8rem' }}>{deliveryAddr!.country}</p>}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--gray-400, #8892a8)' }}>Nicht angegeben</p>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Status + Financial summary row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              style={{
                background: 'var(--white, #ffffff)',
                border: '1px solid var(--gray-200, #d8dce6)',
                borderRadius: 'var(--radius-lg, 16px)',
                padding: '20px',
                boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))',
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div style={{ background: 'var(--primary-blue, #1a2a5e)', borderRadius: '8px', padding: '6px' }}>
                  <Activity className="h-4 w-4" style={{ color: 'var(--white, #ffffff)' }} />
                </div>
                <h3 style={{ color: 'var(--primary-blue, #1a2a5e)', fontSize: '1rem', fontWeight: '700' }}>
                  Buchungsstatus
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--gray-500, #636e85)' }}>
                    Auftragsstatus
                  </p>
                  <Badge className={getStatusColor(booking.status)}>{getBookingStatusLabel(booking.status)}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--gray-500, #636e85)' }}>
                    Zahlungsstatus
                  </p>
                  <Badge className={getBillingStatusColor(booking.billingStatus)}>{getBillingStatusLabel(booking.billingStatus)}</Badge>
                </div>
                <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--gray-100, #eceef3)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--gray-500, #636e85)' }}>
                    Positionen
                  </p>
                  <span className="font-bold text-sm" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>{booking.items.length}</span>
                </div>
                {booking.overallProgress !== undefined && (
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--gray-500, #636e85)' }}>
                        Gesamtfortschritt
                      </p>
                      <span className="text-xs font-bold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>{booking.overallProgress}%</span>
                    </div>
                    <Progress value={booking.overallProgress} className="h-2" />
                  </div>
                )}
              </div>
            </div>

            {/* Financial summary */}
            <div
              style={{
                background: 'var(--white, #ffffff)',
                border: '1px solid var(--gray-200, #d8dce6)',
                borderRadius: 'var(--radius-lg, 16px)',
                padding: '20px',
                boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))',
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div style={{ background: 'var(--accent-yellow, #f5b800)', borderRadius: '8px', padding: '6px' }}>
                  <DollarSign className="h-4 w-4" style={{ color: 'var(--gray-900, #111827)' }} />
                </div>
                <h3 style={{ color: 'var(--primary-blue, #1a2a5e)', fontSize: '1rem', fontWeight: '700' }}>
                  Finanzen
                </h3>
              </div>
              <div className="space-y-2">
                {booking.subtotal !== undefined && booking.subtotal !== booking.totalCost && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--gray-500, #636e85)' }}>Zwischensumme</span>
                    <span style={{ color: 'var(--gray-700, #2d3748)', fontWeight: '500' }}>{formatCurrency(booking.subtotal || 0)}</span>
                  </div>
                )}
                {booking.discount !== undefined && booking.discount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--gray-500, #636e85)' }}>Rabatt</span>
                    <span style={{ color: '#e53e3e', fontWeight: '500' }}>-{formatCurrency(booking.discount)}</span>
                  </div>
                )}
                {booking.tax !== undefined && booking.tax > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--gray-500, #636e85)' }}>MwSt.</span>
                    <span style={{ color: 'var(--gray-700, #2d3748)', fontWeight: '500' }}>{formatCurrency(booking.tax)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2" style={{ borderTop: '2px solid var(--gray-200, #d8dce6)' }}>
                  <span className="font-semibold text-sm" style={{ color: 'var(--gray-700, #2d3748)' }}>Gesamtbetrag</span>
                  <span className="font-bold text-lg" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>{formatCurrency(booking.totalCost)}</span>
                </div>
                {booking.finalCost !== undefined && booking.finalCost !== booking.totalCost && (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm" style={{ color: 'var(--gray-700, #2d3748)' }}>Endbetrag</span>
                    <span className="font-bold text-lg" style={{ color: 'var(--success, #38a169)' }}>{formatCurrency(booking.finalCost)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator style={{ background: 'var(--gray-200, #d8dce6)', height: '1px' }} />

          {/* Status update controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              style={{
                background: 'var(--white, #ffffff)',
                border: '1px solid var(--gray-200, #d8dce6)',
                borderRadius: 'var(--radius-lg, 16px)',
                padding: '20px',
                boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))'
              }}
            >
              <label
                className="text-sm font-medium"
                style={{ color: 'var(--gray-700, #2d3748)', fontWeight: '600', fontSize: '0.9rem' }}
              >
                Buchungsstatus aktualisieren
              </label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger 
                  className="mt-2"
                  style={{
                    border: '1px solid var(--gray-200, #d8dce6)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    fontSize: '0.9rem'
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Ausstehend</SelectItem>
                  <SelectItem value="payment-pending">Zahlung ausstehend</SelectItem>
                  <SelectItem value="processing">In Bearbeitung</SelectItem>
                  <SelectItem value="completed">Abgeschlossen</SelectItem>
                  <SelectItem value="cancelled">Storniert</SelectItem>
                </SelectContent>
              </Select>
              {newStatus !== booking.status && (
                <>
                  <Textarea
                    placeholder="Beschreibung hinzufuegen (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-2"
                    rows={2}
                    style={{
                      border: '1px solid var(--gray-200, #d8dce6)',
                      borderRadius: 'var(--radius-sm, 6px)',
                      fontSize: '0.9rem'
                    }}
                  />
                  <Button
                    onClick={handleStatusUpdate}
                    disabled={updating}
                    className="w-full mt-2"
                    style={{
                      background: 'var(--primary-blue, #1a2a5e)',
                      color: 'var(--white, #ffffff)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm, 6px)',
                      fontWeight: '600',
                      fontSize: '0.9rem',
                      padding: '10px 20px',
                      transition: 'var(--transition, all 0.25s cubic-bezier(0.4, 0, 0.2, 1))'
                    }}
                  >
                    Status aktualisieren
                  </Button>
                </>
              )}
            </div>

            <div
              style={{
                background: 'var(--white, #ffffff)',
                border: '1px solid var(--gray-200, #d8dce6)',
                borderRadius: 'var(--radius-lg, 16px)',
                padding: '20px',
                boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))'
              }}
            >
              <label 
                className="text-sm font-medium"
                style={{ color: 'var(--gray-700, #2d3748)', fontWeight: '600', fontSize: '0.9rem' }}
              >
                Zahlungsstatus aktualisieren
              </label>
              <Select value={newBillingStatus} onValueChange={setNewBillingStatus}>
                <SelectTrigger 
                  className="mt-2"
                  style={{
                    border: '1px solid var(--gray-200, #d8dce6)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    fontSize: '0.9rem'
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unbezahlt</SelectItem>
                  <SelectItem value="partially-paid">Teilweise bezahlt</SelectItem>
                  <SelectItem value="paid">Bezahlt</SelectItem>
                </SelectContent>
              </Select>
              {newBillingStatus !== booking.billingStatus && (
                <Button
                  onClick={handleBillingUpdate}
                  disabled={updating}
                  className="w-full mt-8"
                  style={{
                    background: 'var(--accent-yellow, #f5b800)',
                    color: 'var(--gray-800, #1a202c)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm, 6px)',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    padding: '10px 20px',
                    transition: 'var(--transition, all 0.25s cubic-bezier(0.4, 0, 0.2, 1))'
                  }}
                >
                  Zahlung aktualisieren
                </Button>
              )}
            </div>
          </div>

          <Separator style={{ background: 'var(--gray-200, #d8dce6)', height: '1px' }} />

          {/* Dates */}
          <div
            style={{
              background: 'var(--white, #ffffff)',
              border: '1px solid var(--gray-200, #d8dce6)',
              borderRadius: 'var(--radius-lg, 16px)',
              padding: '16px',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))'
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--gray-500, #636e85)' }}>
                Zeitstempel
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm" style={{ color: 'var(--gray-700, #2d3748)' }}>
              <div>
                <span style={{ color: 'var(--gray-500, #636e85)' }}>Erstellt: </span>
                <span style={{ fontWeight: '600' }}>{formatDateTime(booking.createdAt)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--gray-500, #636e85)' }}>Aktualisiert: </span>
                <span style={{ fontWeight: '600' }}>{formatDateTime(booking.updatedAt)}</span>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="repairs" className="space-y-3 mt-4">
          {loadingRepairJobs ? (
            <div
              className="text-center py-12"
              style={{
                background: 'var(--white, #ffffff)',
                border: '1px solid var(--gray-200, #d8dce6)',
                borderRadius: 'var(--radius-lg, 16px)',
              }}
            >
              <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin" style={{ color: 'var(--gray-400, #8892a8)' }} />
              <p style={{ color: 'var(--gray-400, #8892a8)' }}>Reparaturaufträge werden geladen...</p>
            </div>
          ) : repairJobs.length > 0 ? (
            <div className="space-y-3">
              {repairJobs.map((item: any) => {
                const progress = item.progress ?? 0
                const statusLabel = getOrderStatusLabel(item.status || 'pending')
                const badgeClass = getOrderStatusBadgeClass(item.status || 'pending')

                return (
                  <div
                    key={item._id || item.orderId}
                    onClick={() => item.orderId && handleViewOrder(item.orderId)}
                    style={{
                      border: '1px solid var(--gray-200, #d8dce6)',
                      borderLeft: '4px solid var(--primary-blue, #1a2a5e)',
                      borderRadius: 'var(--radius-lg, 16px)',
                      background: 'var(--white, #ffffff)',
                      boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))',
                      cursor: item.orderId ? 'pointer' : 'default',
                      overflow: 'hidden',
                    }}
                    className="transition-shadow hover:shadow-md"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <div style={{ background: '#eef2ff', borderRadius: '6px', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Wrench className="h-3.5 w-3.5" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                          </div>
                          <h4 className="font-bold" style={{ color: 'var(--primary-blue, #1a2a5e)', fontSize: '1rem' }}>
                            {item.device || 'Gerät unbekannt'}
                          </h4>
                          <Badge className={badgeClass} style={{ fontSize: '0.75rem', fontWeight: '600' }}>
                            {statusLabel}
                          </Badge>
                          {item.isComplaintFollowup && (
                            <Badge className="bg-rose-100 text-rose-800 border border-rose-300" style={{ fontSize: '0.75rem' }}>
                              Reklamation
                            </Badge>
                          )}
                        </div>
                        {item.orderNumber && (
                          <p className="text-xs flex items-center gap-1" style={{ color: 'var(--gray-400, #8892a8)' }}>
                            <Hash className="h-3 w-3" />
                            Auftrag #{item.orderNumber}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-lg" style={{ color: 'var(--primary-blue, #1a2a5e)', lineHeight: 1.2 }}>
                          {formatCurrency(item.cost)}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--gray-400, #8892a8)' }}>Kosten</p>
                      </div>
                    </div>

                    {/* Services */}
                    {item.services && item.services.length > 0 && (
                      <div className="px-5 pb-3">
                        <div className="flex flex-wrap gap-1">
                          {item.services.map((s: any, idx: number) => (
                            <span
                              key={idx}
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: '#eef2ff', color: 'var(--primary-blue, #1a2a5e)', border: '1px solid #c7d2fe', fontWeight: '500' }}
                            >
                              {s.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Progress bar section */}
                    <div
                      className="px-5 py-3"
                      style={{ background: '#f8faff', borderTop: '1px solid var(--gray-100, #eceef3)' }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--gray-500, #636e85)' }}>
                            Fortschritt
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: 'var(--gray-600, #4a5568)' }}>{statusLabel}</span>
                          <span className="text-sm font-bold" style={{ color: progress === 100 ? '#38a169' : 'var(--primary-blue, #1a2a5e)', minWidth: '36px', textAlign: 'right' }}>
                            {progress}%
                          </span>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--gray-200, #d8dce6)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progress}%`,
                              background: progress === 100
                                ? '#38a169'
                                : progress >= 75
                                ? 'var(--primary-blue, #1a2a5e)'
                                : progress >= 40
                                ? 'var(--accent-yellow, #f5b800)'
                                : '#e53e3e',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    {item.orderId && (
                      <div
                        className="px-5 py-2 flex items-center justify-end gap-1"
                        style={{ borderTop: '1px solid var(--gray-100, #eceef3)' }}
                      >
                        <ExternalLink className="h-3 w-3" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                        <span className="text-xs font-semibold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                          Auftragsdetails öffnen
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div
              className="text-center py-12"
              style={{
                background: 'var(--white, #ffffff)',
                border: '1px solid var(--gray-200, #d8dce6)',
                borderRadius: 'var(--radius-lg, 16px)',
              }}
            >
              <Wrench className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--gray-300, #c5cad8)' }} />
              <p className="font-medium" style={{ color: 'var(--gray-400, #8892a8)' }}>Keine Reparaturen in dieser Buchung</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="items" className="space-y-4 mt-4">
          {booking.items && booking.items.filter(item => item.type === 'product').length > 0 ? (
            <div className="space-y-3">
              {booking.items.filter(item => item.type === 'product').map((item) => (
                <div 
                  key={item._id || item.orderId} 
                  style={{
                    border: '2px solid var(--gray-200, #d8dce6)',
                    borderLeft: '4px solid var(--primary-blue, #1a2a5e)',
                    padding: '20px',
                    borderRadius: 'var(--radius-lg, 16px)',
                    background: 'var(--white, #ffffff)',
                    boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))',
                    transition: 'var(--transition, all 0.25s cubic-bezier(0.4, 0, 0.2, 1))'
                  }}
                  className="hover:shadow-md"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold" style={{ color: 'var(--primary-blue, #1a2a5e)', fontSize: '1.1rem', fontWeight: '700' }}>
                      Produktposition
                    </h4>
                    <Badge className={getStatusColor(item.status || 'pending')}>
                      {getBookingStatusLabel(item.status || 'pending')}
                    </Badge>
                  </div>
                  {item.products && item.products.length > 0 ? (
                    <div className="space-y-2">
                      {item.products.map((product) => (
                        <div 
                          key={product._id || product.productId} 
                          className="flex justify-between items-center text-sm pb-2 border-b last:border-0"
                          style={{ borderColor: 'var(--gray-100, #eceef3)', color: 'var(--gray-700, #2d3748)' }}
                        >
                          <div>
                            <p className="font-medium" style={{ fontWeight: '600', color: 'var(--gray-800, #1a202c)' }}>
                              {product.name}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--gray-500, #636e85)' }}>
                              Menge: {product.quantity} × {formatCurrency(product.price)}
                            </p>
                          </div>
                          <p className="font-semibold" style={{ fontWeight: '700', color: 'var(--primary-blue, #1a2a5e)' }}>
                            {formatCurrency(product.totalPrice)}
                          </p>
                        </div>
                      ))}
                      <div 
                        className="flex justify-between items-center text-sm mt-2 pt-2 font-semibold"
                        style={{ 
                          borderTop: '2px solid var(--gray-200, #d8dce6)', 
                          color: 'var(--gray-800, #1a202c)',
                          fontWeight: '700'
                        }}
                      >
                        <span>Gesamt:</span>
                        <span style={{ color: 'var(--primary-blue, #1a2a5e)', fontSize: '1.1rem' }}>
                          {formatCurrency(item.cost)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--gray-400, #8892a8)' }}>Keine Produkte</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div 
              className="text-center py-8"
              style={{
                background: 'var(--white, #ffffff)',
                border: '1px solid var(--gray-200, #d8dce6)',
                borderRadius: 'var(--radius-lg, 16px)',
                padding: '40px'
              }}
            >
              <p style={{ color: 'var(--gray-400, #8892a8)' }}>Keine Produktpositionen in dieser Buchung</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="shipping" className="space-y-4 mt-4">
          {hasAnyShippingInfo ? (
            <div className="space-y-4">
              {hasOutboundShippingInfo && (
                <div
                  style={{
                    background: 'var(--white, #ffffff)',
                    border: '2px solid var(--gray-200, #d8dce6)',
                    borderLeft: '4px solid var(--primary-blue, #1a2a5e)',
                    borderRadius: 'var(--radius-lg, 16px)',
                    padding: '24px',
                    boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))'
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3
                      className="font-semibold text-lg flex items-center gap-2"
                      style={{ color: 'var(--primary-blue, #1a2a5e)', fontWeight: '700' }}
                    >
                      <Truck className="h-5 w-5" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                      Versandinformationen (Hinweg)
                    </h3>
                    {booking.shippingStatus && (
                      <Badge className={getShippingStatusBadgeClass(booking.shippingStatus)}>
                        {getShippingStatusLabel(booking.shippingStatus)}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-4">
                    {booking.trackingNumber && (
                      <div className="border-b pb-3" style={{ borderColor: 'var(--gray-200, #d8dce6)' }}>
                        <div className="flex items-start gap-3">
                          <Package className="h-5 w-5 mt-1 flex-shrink-0" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                          <div className="flex-1">
                            <p className="text-sm mb-1" style={{ color: 'var(--gray-500, #636e85)', fontWeight: '600' }}>Sendungsnummer</p>
                            <p className="font-mono font-semibold text-lg" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                              {booking.trackingNumber}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--gray-400, #8892a8)' }}>
                              Versanddienstleister: {booking.carrier || 'DHL'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {booking.shippingStatusDescription && (
                      <div className="border-b pb-3" style={{ borderColor: 'var(--gray-200, #d8dce6)' }}>
                        <p className="text-sm mb-1" style={{ color: 'var(--gray-500, #636e85)', fontWeight: '600' }}>Statusdetails</p>
                        <p className="text-sm" style={{ color: 'var(--gray-700, #2d3748)' }}>{booking.shippingStatusDescription}</p>
                        {booking.liveShippingTracking?.statusCodeRaw && (
                          <p className="text-xs mt-2" style={{ color: 'var(--gray-500, #636e85)' }}>
                            DHL Live-Statuscode: {booking.liveShippingTracking.statusCodeRaw}
                          </p>
                        )}
                        {booking.liveShippingTracking?.service && (
                          <p className="text-xs mt-1" style={{ color: 'var(--gray-500, #636e85)' }}>
                            Service: {booking.liveShippingTracking.service}
                          </p>
                        )}
                        {booking.liveShippingTracking?.shipmentId && (
                          <p className="text-xs mt-1" style={{ color: 'var(--gray-500, #636e85)' }}>
                            Shipment-ID: {booking.liveShippingTracking.shipmentId}
                          </p>
                        )}
                      </div>
                    )}

                    {booking.liveShippingTracking?.events && booking.liveShippingTracking.events.length > 0 && (
                      <div className="border-b pb-3" style={{ borderColor: 'var(--gray-200, #d8dce6)' }}>
                        <p className="text-sm mb-2" style={{ color: 'var(--gray-500, #636e85)', fontWeight: '600' }}>DHL Live-Tracking Events</p>
                        <div className="space-y-2 max-h-52 overflow-auto">
                          {booking.liveShippingTracking.events.slice(0, 10).map((event, idx) => (
                            <div
                              key={`${event.timestamp || 'no-time'}-${idx}`}
                              className="rounded-md p-2"
                              style={{ background: 'var(--gray-50, #f5f6f8)', border: '1px solid var(--gray-200, #d8dce6)' }}
                            >
                              <p className="text-xs" style={{ color: 'var(--gray-700, #2d3748)', fontWeight: '600' }}>
                                {event.description || event.status || 'Statusupdate'}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--gray-500, #636e85)' }}>
                                {event.timestamp ? formatDateTime(event.timestamp) : 'Zeit unbekannt'}
                                {event.location ? ` • ${event.location}` : ''}
                                {event.statusCode ? ` • ${event.statusCode}` : ''}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {booking.shippingLabelUrl && (
                      <div className="border-b pb-3" style={{ borderColor: 'var(--gray-200, #d8dce6)' }}>
                        <div className="flex items-start gap-3">
                          <FileText className="h-5 w-5 mt-1 flex-shrink-0" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                          <div className="flex-1">
                            <p className="text-sm mb-2" style={{ color: 'var(--gray-500, #636e85)', fontWeight: '600' }}>Versandlabel (PDF)</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadBookingShippingLabel(booking._id, `shipping-label-${booking.bookingNumber || booking._id}.pdf`)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Versandlabel herunterladen
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {(booking.shippingCreatedAt || booking.estimatedDelivery || booking.actualDelivery || booking.shippingCost) && (
                      <div>
                        <div className="flex items-start gap-3">
                          <Clock className="h-5 w-5 mt-1 flex-shrink-0" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                          <div className="flex-1">
                            <p className="text-sm mb-2" style={{ color: 'var(--gray-500, #636e85)', fontWeight: '600' }}>Versandverlauf (Hinweg)</p>
                            <div className="space-y-2 text-sm">
                              {booking.shippingCreatedAt && (
                                <div className="flex items-center gap-2">
                                  <span style={{ color: 'var(--gray-500, #636e85)' }}>Label erstellt:</span>
                                  <span className="font-semibold" style={{ color: 'var(--gray-700, #2d3748)' }}>{formatDateTime(booking.shippingCreatedAt)}</span>
                                </div>
                              )}
                              {booking.estimatedDelivery && (
                                <div className="flex items-center gap-2">
                                  <span style={{ color: 'var(--gray-500, #636e85)' }}>Voraussichtliche Zustellung:</span>
                                  <span className="font-semibold" style={{ color: 'var(--gray-700, #2d3748)' }}>{formatDateTime(booking.estimatedDelivery)}</span>
                                </div>
                              )}
                              {booking.actualDelivery && (
                                <div className="flex items-center gap-2">
                                  <span style={{ color: 'var(--gray-500, #636e85)' }}>Zugestellt am:</span>
                                  <span className="font-semibold" style={{ color: 'var(--gray-700, #2d3748)' }}>{formatDateTime(booking.actualDelivery)}</span>
                                </div>
                              )}
                              {typeof booking.shippingCost === 'number' && booking.shippingCost > 0 && (
                                <div className="flex items-center gap-2">
                                  <span style={{ color: 'var(--gray-500, #636e85)' }}>Versandkosten:</span>
                                  <span className="font-semibold" style={{ color: 'var(--gray-700, #2d3748)' }}>{formatCurrency(booking.shippingCost)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {hasReturnShippingInfo && (
                <div
                  style={{
                    background: 'var(--white, #ffffff)',
                    border: '2px solid var(--gray-200, #d8dce6)',
                    borderLeft: '4px solid var(--primary-blue, #1a2a5e)',
                    borderRadius: 'var(--radius-lg, 16px)',
                    padding: '24px',
                    boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))'
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3
                      className="font-semibold text-lg flex items-center gap-2"
                      style={{ color: 'var(--primary-blue, #1a2a5e)', fontWeight: '700' }}
                    >
                      <Truck className="h-5 w-5" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                      Ruecksendungsinformationen
                    </h3>
                    {booking.returnShipmentStatus && (
                      <Badge className={getShippingStatusBadgeClass(booking.returnShipmentStatus)}>
                        {getShippingStatusLabel(booking.returnShipmentStatus)}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-4">
                    {booking.returnTrackingNumber && (
                      <div className="border-b pb-3" style={{ borderColor: 'var(--gray-200, #d8dce6)' }}>
                        <div className="flex items-start gap-3">
                          <Package className="h-5 w-5 mt-1 flex-shrink-0" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                          <div className="flex-1">
                            <p className="text-sm mb-1" style={{ color: 'var(--gray-500, #636e85)', fontWeight: '600' }}>Sendungsnummer</p>
                            <p className="font-mono font-semibold text-lg" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                              {booking.returnTrackingNumber}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--gray-400, #8892a8)' }}>
                              Nutze diese Nummer, um die Ruecksendung bei DHL zu verfolgen
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {booking.returnShipmentStatusDescription && (
                      <div className="border-b pb-3" style={{ borderColor: 'var(--gray-200, #d8dce6)' }}>
                        <p className="text-sm mb-1" style={{ color: 'var(--gray-500, #636e85)', fontWeight: '600' }}>Statusdetails</p>
                        <p className="text-sm" style={{ color: 'var(--gray-700, #2d3748)' }}>{booking.returnShipmentStatusDescription}</p>
                      </div>
                    )}

                    {booking.returnLabelUrl && (
                      <div className="border-b pb-3" style={{ borderColor: 'var(--gray-200, #d8dce6)' }}>
                        <div className="flex items-start gap-3">
                          <FileText className="h-5 w-5 mt-1 flex-shrink-0" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                          <div className="flex-1">
                            <p className="text-sm mb-2" style={{ color: 'var(--gray-500, #636e85)', fontWeight: '600' }}>Ruecksende-Label (PDF)</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadBookingReturnLabel(booking._id, `return-label-${booking.bookingNumber || booking._id}.pdf`)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Ruecksende-Label herunterladen
                            </Button>
                            <p className="text-xs text-foreground/50 mt-2">
                              Dieses Label ausdrucken und am Ruecksendepaket anbringen
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {booking.returnQRCodeUrl && (
                      <div className="border-b pb-3" style={{ borderColor: 'var(--gray-200, #d8dce6)' }}>
                        <div className="flex items-start gap-3">
                          <QrCode className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-foreground/60 mb-2">QR-Code fuer label-freie Ruecksendung</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const link = document.createElement('a')
                                link.href = booking.returnQRCodeUrl!
                                link.download = `return-qr-${booking.bookingNumber || booking._id}.png`
                                link.click()
                              }}
                            >
                              <QrCode className="h-4 w-4 mr-2" />
                              QR-Code herunterladen
                            </Button>
                            <p className="text-xs mt-2" style={{ color: 'var(--gray-400, #8892a8)' }}>
                              Diesen QR-Code in einer DHL-Filiale fuer die label-freie Ruecksendung vorzeigen
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {(booking.returnCreatedAt || booking.returnReceivedAt) && (
                      <div>
                        <div className="flex items-start gap-3">
                          <Clock className="h-5 w-5 mt-1 flex-shrink-0" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                          <div className="flex-1">
                            <p className="text-sm mb-2" style={{ color: 'var(--gray-500, #636e85)', fontWeight: '600' }}>Ruecksendeverlauf</p>
                            <div className="space-y-2 text-sm">
                              {booking.returnCreatedAt && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--primary-blue, #1a2a5e)' }}></div>
                                  <span style={{ color: 'var(--gray-500, #636e85)' }}>Label erstellt:</span>
                                  <span className="font-semibold" style={{ color: 'var(--gray-700, #2d3748)' }}>{formatDateTime(booking.returnCreatedAt)}</span>
                                </div>
                              )}
                              {booking.returnReceivedAt && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--success, #38a169)' }}></div>
                                  <span style={{ color: 'var(--gray-500, #636e85)' }}>Paket eingegangen:</span>
                                  <span className="font-semibold" style={{ color: 'var(--gray-700, #2d3748)' }}>{formatDateTime(booking.returnReceivedAt)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {hasReturnShippingInfo && (
                <div
                  style={{
                    background: 'var(--white, #ffffff)',
                    border: '1px solid var(--gray-200, #d8dce6)',
                    borderRadius: 'var(--radius-lg, 16px)',
                    padding: '20px',
                    boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))'
                  }}
                >
                  <h4 className="font-semibold mb-2" style={{ color: 'var(--primary-blue, #1a2a5e)', fontSize: '1.05rem' }}>Ruecksendehinweise</h4>
                  <ol className="list-decimal list-inside space-y-1" style={{ color: 'var(--gray-600, #4a5568)', fontSize: '0.9rem' }}>
                    <li>Ruecksende-Label ausdrucken oder den QR-Code am Handy speichern</li>
                    <li>Artikel sicher in einem geeigneten Karton verpacken</li>
                    <li>Label aufkleben oder den QR-Code in einer DHL-Filiale vorzeigen</li>
                    <li>Paket bei DHL abgeben oder eine Abholung vereinbaren</li>
                    <li>Ruecksendung mit der oben stehenden Nummer verfolgen</li>
                  </ol>
                </div>
              )}
            </div>
          ) : (
            <div 
              className="text-center py-8"
              style={{
                background: 'var(--white, #ffffff)',
                border: '1px solid var(--gray-200, #d8dce6)',
                borderRadius: 'var(--radius-lg, 16px)',
                padding: '40px'
              }}
            >
              <Truck className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--gray-300, #b0b8c9)', opacity: '0.4' }} />
              <p style={{ color: 'var(--gray-600, #4a5568)' }}>Keine Ruecksendungsinformationen fuer diese Buchung verfuegbar</p>
              <p className="text-sm mt-2" style={{ color: 'var(--gray-400, #8892a8)' }}>Ruecksendedetails erscheinen hier, sobald sie erstellt wurden</p>
              <Button
                onClick={() => setShowReturnLabelDialog(true)}
                className="mt-4"
                style={{
                  background: 'var(--primary-blue, #1a2a5e)',
                  color: 'var(--white, #ffffff)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  fontWeight: '600',
                  padding: '10px 20px'
                }}
              >
                <Truck className="h-4 w-4 mr-2" />
                Ruecksende-Label erstellen
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4 mt-4">
          <InvoicesTabContent booking={booking} />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4 mt-4">
          {booking.timeline && booking.timeline.length > 0 ? (
            <div className="space-y-3">
              {booking.timeline.map((event) => (
                <div 
                  key={event._id || event.completedAt} 
                  className="flex gap-4"
                  style={{
                    border: '1px solid var(--gray-200, #d8dce6)',
                    borderLeft: '4px solid var(--accent-yellow, #f5b800)',
                    padding: '20px',
                    borderRadius: 'var(--radius-lg, 16px)',
                    background: 'var(--white, #ffffff)',
                    boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))',
                    transition: 'var(--transition, all 0.25s cubic-bezier(0.4, 0, 0.2, 1))'
                  }}
                >
                  <div className="flex-shrink-0">
                    <CheckCircle 
                      className="h-5 w-5 mt-1"
                      style={{ color: 'var(--success, #38a169)' }}
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold" style={{ color: 'var(--primary-blue, #1a2a5e)', fontSize: '1.05rem', fontWeight: '700' }}>
                      {event.status}
                    </h4>
                    <p className="text-sm mt-1" style={{ color: 'var(--gray-600, #4a5568)' }}>
                      {event.description}
                    </p>
                    {event.staffName && (
                      <p className="text-sm mt-2" style={{ color: 'var(--gray-500, #636e85)' }}>
                        <span style={{ fontWeight: '600' }}>Von:</span> {event.staffName}
                      </p>
                    )}
                    <p className="text-xs mt-2" style={{ color: 'var(--gray-400, #8892a8)', fontWeight: '500' }}>
                      {formatDateTime(event.completedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div 
              className="text-center py-8"
              style={{
                background: 'var(--white, #ffffff)',
                border: '1px solid var(--gray-200, #d8dce6)',
                borderRadius: 'var(--radius-lg, 16px)',
                padding: '40px'
              }}
            >
              <CheckCircle 
                className="h-12 w-12 mx-auto mb-4"
                style={{ color: 'var(--gray-300, #b0b8c9)', opacity: '0.4' }}
              />
              <p style={{ color: 'var(--gray-400, #8892a8)' }}>Keine Verlaufseintraege</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Return Label Dialog */}
      {showReturnLabelDialog && (
        <ReturnLabelDialog
          booking={booking}
          open={showReturnLabelDialog}
          onClose={() => setShowReturnLabelDialog(false)}
          onSuccess={() => {
            setShowReturnLabelDialog(false)
            onStatusUpdate()
          }}
        />
      )}
    </DialogContent>
  )
}

// Invoices Tab Content Component
// Description: Display invoices for a booking with reminder actions
function InvoicesTabContent({ booking }: { booking: Booking }) {
  const customer = getSafeBookingCustomer(booking)
  const customerDisplayName = getCustomerDisplayName(customer)
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
        title: "Fehler",
        description: "Rechnungen konnten nicht geladen werden",
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
        <p className="text-foreground/60">Fuer diese Buchung wurden noch keine Rechnungen erstellt</p>
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
                  <h4 className="font-semibold">Rechnung #{invoice.invoiceNumber}</h4>
                  <Badge className={getInvoiceStatusColor(invoice.status)}>
                    {invoice.status}
                  </Badge>
                </div>
                <p className="text-sm text-foreground/60">
                  Erstellt: {formatDate(invoice.createdAt)}
                </p>
                {invoice.dueDate && (
                  <p className="text-sm text-foreground/60">
                    Faellig: {formatDate(invoice.dueDate)}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{formatCurrency(invoice.total)}</p>
                {invoice.amountPaid > 0 && (
                  <p className="text-sm text-green-600">
                    Bezahlt: {formatCurrency(invoice.amountPaid)}
                  </p>
                )}
              </div>
            </div>

            <Separator className="my-3" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-foreground/60">
                <Mail className="h-4 w-4" />
                <span>{customer.email}</span>
              </div>
              <div className="flex gap-2">
                {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendReminder(invoice)}
                  >
                    <Bell className="h-4 w-4 mr-1" />
                    Erinnerung senden
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
                  PDF anzeigen
                </Button>
              </div>
            </div>

            {invoice.notes && (
              <div className="mt-3 p-2 bg-muted rounded text-sm">
                <p className="text-foreground/60">Notizen: {invoice.notes}</p>
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
              <DialogTitle>Zahlungserinnerung senden</DialogTitle>
              <DialogDescription>
                Erinnerung an {customerDisplayName} fuer Rechnung #{selectedInvoice.invoiceNumber} senden
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded">
                <p className="text-sm font-medium">Rechnungsdetails</p>
                <p className="text-sm text-foreground/60">Betrag: {formatCurrency(selectedInvoice.total)}</p>
                <p className="text-sm text-foreground/60">Status: {selectedInvoice.status}</p>
                {selectedInvoice.dueDate && (
                  <p className="text-sm text-foreground/60">Faelligkeitsdatum: {formatDate(selectedInvoice.dueDate)}</p>
                )}
              </div>
              <p className="text-sm text-foreground/60">
                Es wird eine Zahlungserinnerung per E-Mail mit Rechnungsdetails und Zahlungslink an den Kunden gesendet.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={async () => {
                try {
                  if (!customer._id) {
                    toast({
                      title: "Fehler",
                      description: "Kein verknuepfter Kunde fuer diese Buchung gefunden",
                      variant: "destructive"
                    })
                    return
                  }

                  await createReminder({
                    bookingId: booking._id,
                    customerId: customer._id,
                    type: 'payment',
                    title: `Zahlungserinnerung - Rechnung #${selectedInvoice.invoiceNumber}`,
                    message: `Dies ist eine Erinnerung, dass Rechnung #${selectedInvoice.invoiceNumber} ueber ${formatCurrency(selectedInvoice.total)} ${selectedInvoice.status === 'overdue' ? 'ueberfaellig' : 'zur Zahlung ausstehend'} ist. Bitte begleichen Sie den Betrag zeitnah.`,
                    scheduledDate: new Date().toISOString(),
                    priority: selectedInvoice.status === 'overdue' ? 'high' : 'medium',
                    notificationMethod: ['email', 'in-app']
                  })
                  toast({
                    title: "Erfolg",
                    description: "Zahlungserinnerung erfolgreich gesendet"
                  })
                  setReminderDialogOpen(false)
                } catch (error) {
                  toast({
                    title: "Fehler",
                    description: "Erinnerung konnte nicht gesendet werden",
                    variant: "destructive"
                  })
                }
              }}>
                <Bell className="h-4 w-4 mr-2" />
                Erinnerung senden
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
        title: "Fehler",
        description: "Rechnungsvorschau konnte nicht geladen werden",
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
        title: "Fehler",
        description: "Rechnung konnte nicht erstellt werden",
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
          <DialogTitle>Rechnung fuer Buchung erstellen</DialogTitle>
          <DialogDescription>Rechnungsdetails pruefen und bestaetigen</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : preview ? (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-muted/30">
              <h3 className="font-semibold mb-2">Kundeninformationen</h3>
              <p className="text-sm">{preview.customerName}</p>
              <p className="text-sm text-foreground/60">{preview.customerEmail}</p>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Rechnungspositionen</h3>
              <div className="space-y-2">
                {preview.items.map((item: any) => (
                  <div key={item._id || item.description} className="flex justify-between text-sm border-b pb-2 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-foreground/60">
                        Menge: {item.quantity} × {formatCurrency(item.unitPrice)}
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
                  <span>Zwischensumme:</span>
                  <span>{formatCurrency(preview.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Steuer:</span>
                  <span>{formatCurrency(preview.tax)}</span>
                </div>
                {preview.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Rabatt:</span>
                    <span>-{formatCurrency(preview.discount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Gesamt:</span>
                  <span>{formatCurrency(preview.total)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Notizen (optional)</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Weitere Notizen hinzufuegen..."
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
                  Rechnung sofort an den Kunden senden
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-foreground/60">
            Keine Vorschau verfuegbar
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleCreate} disabled={loading || !preview}>
            Rechnung erstellen
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
  const customer = getSafeBookingCustomer(booking)
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
        title: "Fehler",
        description: "Bitte alle Pflichtfelder ausfuellen",
        variant: "destructive"
      })
      return
    }

    if (!customer._id) {
      toast({
        title: "Fehler",
        description: "Kein verknuepfter Kunde fuer diese Buchung gefunden",
        variant: "destructive"
      })
      return
    }

    try {
      setLoading(true)
      await createReminder({
        bookingId: booking._id,
        customerId: customer._id,
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
        title: "Fehler",
        description: "Erinnerung konnte nicht erstellt werden",
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
          <DialogTitle>Erinnerung erstellen</DialogTitle>
          <DialogDescription>Erinnerung fuer diese Buchung planen</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Erinnerungstyp</label>
            <Select value={reminderType} onValueChange={setReminderType}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="payment">Zahlung</SelectItem>
                <SelectItem value="pickup">Abholung</SelectItem>
                <SelectItem value="followup">Nachverfolgung</SelectItem>
                <SelectItem value="feedback">Feedback</SelectItem>
                <SelectItem value="maintenance">Wartung</SelectItem>
                <SelectItem value="custom">Benutzerdefiniert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Titel *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titel der Erinnerung"
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Nachricht *</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nachricht der Erinnerung"
              rows={4}
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Geplantes Datum & Uhrzeit *</label>
            <Input
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Prioritaet</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Niedrig</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            Erinnerung erstellen
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
        title: "Fehler",
        description: "Bitte alle Pflichtfelder ausfuellen",
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
        title: "Fehler",
        description: "Reklamation konnte nicht erfasst werden",
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
          <DialogTitle>Reklamation erfassen</DialogTitle>
          <DialogDescription>Ein Problem zu dieser Buchung melden</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Kategorie</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quality">Qualitaet</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="delivery">Lieferung</SelectItem>
                <SelectItem value="billing">Abrechnung</SelectItem>
                <SelectItem value="communication">Kommunikation</SelectItem>
                <SelectItem value="other">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Betreff *</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Kurze Zusammenfassung des Problems"
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Beschreibung *</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detaillierte Beschreibung des Problems"
              rows={5}
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Prioritaet</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Niedrig</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
                <SelectItem value="urgent">Dringend</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            Reklamation erfassen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Return Label Creation Dialog Component
// Description: Dialog for creating return shipping labels via DHL integration
// Allows admins to generate return labels for bookings that don't have return shipping set up
function ReturnLabelDialog({
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
  const customer = getSafeBookingCustomer(booking)
  const customerDisplayName = getCustomerDisplayName(customer)
  const [loading, setLoading] = useState(false)
  const [creatingLabel, setCreatingLabel] = useState(false)
  const [labelData, setLabelData] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      // Initialize dialog when opened
      setLabelData(null)
    }
  }, [open])

  const handleCreateLabel = async () => {
    try {
      setCreatingLabel(true)
      console.log(`Creating return label for booking: ${booking._id}`)

      const response = await createReturnLabel(booking._id)

      console.log('Return label created successfully:', response)

      // Simulate updating the booking with return label data
      if (response.success) {
        // Update the booking object in memory with the new return label data
        if (booking && response.booking) {
          booking.returnTrackingNumber = response.booking.returnTrackingNumber
          booking.returnLabelUrl = response.booking.returnLabelUrl
          booking.returnQRCodeUrl = response.booking.returnQRCodeUrl
          booking.returnShipmentId = response.booking.returnShipmentId
          booking.returnShipmentStatus = response.booking.returnShipmentStatus as any
          booking.returnCreatedAt = response.booking.returnCreatedAt
        }

        toast({
          title: "Erfolg",
          description: "Ruecksende-Label erfolgreich erstellt"
        })

        onSuccess()
      } else {
        throw new Error(response.message || 'Ruecksende-Label konnte nicht erstellt werden')
      }
    } catch (error) {
      console.error('Error creating return label:', error)
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ruecksende-Label konnte nicht erstellt werden",
        variant: "destructive"
      })
    } finally {
      setCreatingLabel(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ruecksende-Label erstellen</DialogTitle>
          <DialogDescription>
            DHL-Ruecksende-Label fuer Buchung #{booking._id.slice(-8).toUpperCase()} erstellen
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div 
            style={{
              background: 'var(--white, #ffffff)',
              border: '2px solid var(--gray-200, #d8dce6)',
              borderLeft: '4px solid var(--primary-blue, #1a2a5e)',
              borderRadius: 'var(--radius-lg, 16px)',
              padding: '20px',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))'
            }}
          >
            <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>Buchungsinformationen</h3>
            <div className="space-y-2 text-sm" style={{ color: 'var(--gray-700, #2d3748)' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--gray-500, #636e85)' }}>Buchungs-ID:</span>
                <span className="font-mono font-semibold" style={{ color: 'var(--gray-800, #1a202c)' }}>{booking._id}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--gray-500, #636e85)' }}>Kunde:</span>
                <span className="font-semibold" style={{ color: 'var(--gray-800, #1a202c)' }}>
                  {customerDisplayName}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--gray-500, #636e85)' }}>E-Mail:</span>
                <span style={{ color: 'var(--gray-700, #2d3748)' }}>{customer.email}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--gray-500, #636e85)' }}>Telefon:</span>
                <span style={{ color: 'var(--gray-700, #2d3748)' }}>{customer.phone || 'Nicht verfuegbar'}</span>
              </div>
            </div>
          </div>

          <div 
            style={{
              background: 'var(--white, #ffffff)',
              border: '2px solid var(--gray-200, #d8dce6)',
              borderLeft: '4px solid var(--accent-yellow, #f5b800)',
              borderRadius: 'var(--radius-lg, 16px)',
              padding: '20px',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))'
            }}
          >
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--accent-yellow-hover, #e5ab00)' }}>
              <AlertCircle className="h-4 w-4" style={{ color: 'var(--accent-yellow-hover, #e5ab00)' }} />
              Wichtig
            </h3>
            <ul className="text-sm space-y-1 list-disc list-inside" style={{ color: 'var(--gray-600, #4a5568)' }}>
              <li>Es wird ein DHL-Ruecksende-Label fuer diese Buchung erstellt</li>
              <li>Eine Sendungsnummer wird erzeugt und dem Kunden angezeigt</li>
              <li>Der Kunde erhaelt eine E-Mail-Benachrichtigung mit dem Ruecksende-Label</li>
              <li>Das Ruecksende-Label kann gedruckt oder als QR-Code in DHL-Filialen gezeigt werden</li>
            </ul>
          </div>

          <div 
            style={{
              background: 'var(--white, #ffffff)',
              border: '1px solid var(--gray-200, #d8dce6)',
              borderRadius: 'var(--radius-lg, 16px)',
              padding: '20px',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))'
            }}
          >
            <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>Wie geht es weiter?</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm" style={{ color: 'var(--gray-600, #4a5568)' }}>
              <li>Ein Ruecksende-Label wird ueber die DHL-Integration erstellt</li>
              <li>Sendungsnummer und Label werden in der Buchung gespeichert</li>
              <li>Der Tab Versand wird mit den Ruecksendedaten aktualisiert</li>
              <li>Der Kunde erhaelt eine E-Mail mit den Download-Links</li>
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={creatingLabel}
            style={{
              border: '1px solid var(--gray-200, #d8dce6)',
              borderRadius: 'var(--radius-sm, 6px)',
              color: 'var(--gray-700, #2d3748)'
            }}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleCreateLabel}
            disabled={creatingLabel}
            className="gap-2"
            style={{
              background: 'var(--primary-blue, #1a2a5e)',
              color: 'var(--white, #ffffff)',
              borderRadius: 'var(--radius-sm, 6px)',
              fontWeight: '600',
              padding: '10px 20px'
            }}
          >
            {creatingLabel && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {creatingLabel ? "Wird erstellt..." : "Ruecksende-Label erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
