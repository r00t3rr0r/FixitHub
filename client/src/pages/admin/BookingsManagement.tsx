import React, { useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import "./BookingsManagement.css"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { reconcileBookingInboundLabel } from "@/api/shipping"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { formatEUR } from "@/lib/utils"
import { rememberListScroll, restoreListScroll } from "@/lib/listScrollMemory"
import {
  getAdminBookings,
  getBooking,
  updateBookingStatus,
  updateBookingBillingStatus,
  getBookingOrders,
  previewBookingInvoice,
  createBookingInvoice,
  getBookingInvoices,
  createReturnLabel,
  getReturnTracking,
  updateReturnStatus,
  downloadBookingShippingLabel,
  downloadBookingReturnLabel,
  bulkUpdateBookingShippingStatuses,
  getBookingInboundLabel,
  createBookingInboundLabel,
  downloadInboundLabel,
  printInboundLabel,
  type InboundLabelInfo
} from "@/api/bookings"
import { labelFilename } from "@/api/labelPdf"
import {
  createComplaint,
  getComplaintsByBooking
} from "@/api/complaints"
import {
  createReminder,
  getRemindersByBooking
} from "@/api/reminders"
import {
  getUnreadMessageCounts,
  markMessagesAsRead as markInspectionMessagesAsRead
} from "@/api/inspectionCommunication"
import { CommunicationPanel } from "@/components/inspection/CommunicationPanel"
import { CreateBookingShippingLabelDialog } from "@/components/admin/CreateBookingShippingLabelDialog"
import { BookingPaymentsDialog } from "@/components/admin/BookingPaymentsDialog"
import { getBookingPayments } from "@/api/bookingPayments"
import { ManualRepairOrderDialog } from "@/components/admin/ManualRepairOrderDialog"
import { BookingCancelDialog } from "@/components/admin/BookingCancelDialog"
import { OrderCancelDialog } from "@/components/admin/OrderCancelDialog"
import { buildOrderDetailsState, getOrderDetailsPath } from "@/lib/orderDetailsNavigation"
import { printInvoice } from "@/lib/invoicePrint"
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
  Home,
  Printer,
  AlertTriangle,
  Inbox
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
  DialogBody,
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
  zip?: string
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
  billingAddress?: AddressFields
  shippingAddress?: AddressFields
  orderIds?: Array<any>
  repairOrderIds?: Array<any>
  hasComplaintOrders?: boolean
  // ADMUX-5: Auftraege der Buchung aus der Admin-Listenprojektion (BookingService.getAllBookings).
  orders?: Array<{
    _id: string
    orderNumber?: string
    // 'product' = Shop-Auftrag (keine Reparatur); device = fertiges Etikett vom Server.
    type?: 'product' | 'repair'
    device?: string
    deviceBrand?: string
    deviceModel?: string
    deviceType?: string
    status?: string
    progress?: number
  }>
  // DHL-5: Einsendelabel ist ein Testlabel (Dummy-Modus, Sendungsnummer DHL-DUMMY-…).
  inboundLabelPlaceholder?: boolean
  returnShipmentStatusDescription?: string
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
  finalCost?: number
  invoiceOpenAmount?: number
  customerCreditOpenAmount?: number
  netOpenAmount?: number
  // Zahlungsstand vom Server (BookingService.buildPaymentBalanceMap / getBookingBalancesBulk).
  // null = der Server konnte ihn nicht berechnen ("unbekannt", Anzeige '–').
  paymentBalance?: null | {
    total?: number
    orderValue?: number
    invoicedTotal?: number
    allocated?: number
    received?: number
    unallocated?: number
    open?: number
    invoiceOpen?: number
    overpaid?: number
    refundPending?: number
    reference?: number
  }
  // DHL Returns information
  trackingNumber?: string
  carrier?: string
  // Richtung des gespeicherten Versandlabels. 'inbound' = Einsendung des Kunden an
  // McRepair (Hinweg), 'outbound' = Ruecksendung an den Kunden (Rueckweg). Wird vom
  // Server aus dem Buchungsverlauf abgeleitet (GET /api/bookings/:id); fehlt das Feld
  // (Listenantwort, Altbestand), gilt 'inbound'.
  shippingLabelDirection?: 'inbound' | 'outbound'
  // Sperre der Einsendelabel-Erstellung; bleibt nach unklarer DHL-Antwort bis zum Abgleich gesetzt.
  shippingLabelCreationInProgress?: boolean
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
  name: 'Unbekannter Kunde',
  email: '',
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
      name: `${booking.guestInfo.firstName || ''} ${booking.guestInfo.lastName || ''}`.trim() || 'Gast',
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

  return customer.name || customer.email || 'Unbekannter Kunde'
}

const hasAddressData = (addr?: AddressFields | null) => Boolean(
  addr && (addr.street || addr.city || addr.zipCode || addr.zip || addr.state || addr.country)
)

// Listenzustand in der URL (ADMUX-4): Suche, Filter, Seite, Zeilen pro Seite und aufgeklappte
// Buchungen bleiben erhalten, wenn man aus dem Auftragsdetail zurueckkehrt (backTarget enthaelt
// location.search) oder die Seite neu laedt. Fremde Parameter (highlightBookingId, openBookingId)
// bleiben unberuehrt.
const LIST_PARAM = {
  search: 'q',
  status: 'status',
  billing: 'zahlung',
  communication: 'komm',
  from: 'von',
  to: 'bis',
  page: 'seite',
  perPage: 'proSeite',
  expanded: 'offen',
} as const
const ALLOWED_PER_PAGE = [10, 20, 50, 100]
const LIST_SCROLL_KEY = 'adminBookingsListScroll'

const readPositiveInt = (value: string | null, fallback: number) => {
  const parsed = parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function BookingsManagement() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [bookings, setBookings] = useState<ExpandedBooking[]>([])
  const [filteredBookings, setFilteredBookings] = useState<ExpandedBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get(LIST_PARAM.search) || "")
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get(LIST_PARAM.search) || "")
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get(LIST_PARAM.status) || "all")
  const [billingStatusFilter, setBillingStatusFilter] = useState(() => searchParams.get(LIST_PARAM.billing) || "all")
  const [communicationFilter, setCommunicationFilter] = useState(() => searchParams.get(LIST_PARAM.communication) || "all")
  const [dateFrom, setDateFrom] = useState(() => searchParams.get(LIST_PARAM.from) || "")
  const [dateTo, setDateTo] = useState(() => searchParams.get(LIST_PARAM.to) || "")
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [updateStatusDialog, setUpdateStatusDialog] = useState(false)
  const [updateBillingDialog, setUpdateBillingDialog] = useState(false)
  const [newStatus, setNewStatus] = useState("")
  const [newBillingStatus, setNewBillingStatus] = useState("")
  const [description, setDescription] = useState("")
  const [updating, setUpdating] = useState(false)
  // Storno mit Pflichtgrund (ORD-1): Buchung (BookingCancelDialog) bzw. einzelner Auftrag (OrderCancelDialog).
  const [cancelBookingTarget, setCancelBookingTarget] = useState<{ id: string; number?: string } | null>(null)
  const [cancelOrderTarget, setCancelOrderTarget] = useState<{ bookingId: string; orderId: string; orderNumber?: string } | null>(null)
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set())
  const [expandedOrdersData, setExpandedOrdersData] = useState<Record<string, any[]>>({})
  const [loadingOrders, setLoadingOrders] = useState<Set<string>>(new Set())
  const [calculatedProgress, setCalculatedProgress] = useState<Record<string, number>>({})
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false)
  const [showReminderDialog, setShowReminderDialog] = useState(false)
  const [showComplaintDialog, setShowComplaintDialog] = useState(false)
  const [showCreateShippingLabelDialog, setShowCreateShippingLabelDialog] = useState(false)
  const [showPaymentsDialog, setShowPaymentsDialog] = useState(false)
  const [showManualRepairDialog, setShowManualRepairDialog] = useState(false)
  const [quickPayBookingId, setQuickPayBookingId] = useState<string | null>(null)
  const [detailInitialTab, setDetailInitialTab] = useState<"overview" | "invoices">("overview")
  const [detailInvoiceStatusFocus, setDetailInvoiceStatusFocus] = useState<string | null>(null)

  // Pagination state (aus der URL wiederhergestellt)
  const [currentPage, setCurrentPage] = useState(() => readPositiveInt(searchParams.get(LIST_PARAM.page), 1))
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const value = readPositiveInt(searchParams.get(LIST_PARAM.perPage), 20)
    return ALLOWED_PER_PAGE.includes(value) ? value : 20
  })
  const [totalBookings, setTotalBookings] = useState(0)
  // DHL-5: konfigurierter Buchungslabel-Modus vom Server ('dummy' | 'live'; leer = unbekannt).
  const [labelMode, setLabelMode] = useState<'' | 'dummy' | 'live'>('')
  // Aufgeklappte Buchungen aus der URL, die nach dem Laden wieder geoeffnet werden.
  const pendingExpandIdsRef = useRef<string[]>(
    String(searchParams.get(LIST_PARAM.expanded) || '').split(',').map((id) => id.trim()).filter((id) => /^[a-f0-9]{24}$/i.test(id))
  )
  const scrollRestoredRef = useRef(false)

  // Unread message counts state
  const [unreadCounts, setUnreadCounts] = useState<Record<string, { unread: number; senderType?: string }>>({})
  const [loadingUnreadCounts, setLoadingUnreadCounts] = useState(false)
  const [loadingBulkShippingUpdate, setLoadingBulkShippingUpdate] = useState(false)
  // Track order IDs that were optimistically marked as read so periodic fetches don't restore their badges
  const locallyReadOrderIds = useRef<Set<string>>(new Set())
  const communicationDialogOpenRef = useRef(false)
  const [communicationDialogOpen, setCommunicationDialogOpen] = useState(false)
  const [selectedCommunicationOrder, setSelectedCommunicationOrder] = useState<{ orderId: string; orderNumber?: string } | null>(null)
  const [activeHighlightedBookingId, setActiveHighlightedBookingId] = useState<string | null>(null)
  const [orderSearchMatches, setOrderSearchMatches] = useState<Record<string, string[]>>({})
  const [autoExpandedBookingIds, setAutoExpandedBookingIds] = useState<Set<string>>(new Set())

  const { toast } = useToast()
  const highlightBookingIdFromQuery = useMemo(() => {
    const searchParams = new URLSearchParams(location.search)
    // bookingId: aeltere Admin-Hinweise "Einsendelabel fehlt" verlinkten ?bookingId=… (heute openBookingId).
    return searchParams.get("highlightBookingId") || searchParams.get("bookingId")
  }, [location.search])

  useEffect(() => {
    // Unveraenderte Suche (z. B. beim Wiederherstellen aus der URL) setzt die Seite NICHT zurueck.
    if (searchTerm === debouncedSearch) return
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Listenzustand -> URL (replace, kein neuer Verlaufseintrag).
  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    const put = (key: string, value: string, defaultValue: string) => {
      if (value && value !== defaultValue) next.set(key, value)
      else next.delete(key)
    }
    put(LIST_PARAM.search, debouncedSearch.trim(), '')
    put(LIST_PARAM.status, statusFilter, 'all')
    put(LIST_PARAM.billing, billingStatusFilter, 'all')
    put(LIST_PARAM.communication, communicationFilter, 'all')
    put(LIST_PARAM.from, dateFrom, '')
    put(LIST_PARAM.to, dateTo, '')
    put(LIST_PARAM.page, String(currentPage), '1')
    put(LIST_PARAM.perPage, String(itemsPerPage), '20')
    // Solange die aus der URL gemerkten Buchungen noch nicht wieder aufgeklappt sind, bleibt der
    // Parameter stehen (sonst ueberholt das Entfernen beim ersten Rendern das spaetere Setzen).
    if (pendingExpandIdsRef.current.length === 0) {
      put(LIST_PARAM.expanded, Array.from(expandedBookings).slice(0, 10).join(','), '')
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [debouncedSearch, statusFilter, billingStatusFilter, communicationFilter, dateFrom, dateTo, currentPage, itemsPerPage, expandedBookings])

  useEffect(() => {
    const normalizedSearch = String(debouncedSearch || '').trim().toLowerCase().replace(/^#/, '')
    if (!normalizedSearch) {
      setOrderSearchMatches({})
      setExpandedBookings((prev) => {
        if (autoExpandedBookingIds.size === 0) {
          return prev
        }
        const next = new Set(prev)
        autoExpandedBookingIds.forEach((bookingId) => next.delete(bookingId))
        return next
      })
      setAutoExpandedBookingIds(new Set())
      return
    }

    let isCancelled = false

    const loadOrdersAndHighlightMatches = async () => {
      let mergedOrdersData: Record<string, any[]> = expandedOrdersData
      let mergedCalculatedProgress: Record<string, number> = calculatedProgress

      const bookingsNeedingOrders = filteredBookings.filter(
        (booking) => !Array.isArray(mergedOrdersData[booking._id])
      )

      if (bookingsNeedingOrders.length > 0) {
        const fetchedOrders = await Promise.all(
          bookingsNeedingOrders.map(async (booking) => {
            try {
              const response = await getBookingOrders(booking._id)
              const orders = response.orders || []
              const totalProgress = orders.reduce((sum: number, order: any) => sum + (order.progress || 0), 0)
              const averageProgress = orders.length > 0 ? Math.round(totalProgress / orders.length) : 0

              return {
                bookingId: booking._id,
                orders,
                averageProgress,
              }
            } catch (error) {
              console.error(`BookingsManagement: Error loading orders for booking ${booking._id}`, error)
              return null
            }
          })
        )

        if (isCancelled) {
          return
        }

        const successfulFetches = fetchedOrders.filter(Boolean) as Array<{
          bookingId: string
          orders: any[]
          averageProgress: number
        }>

        if (successfulFetches.length > 0) {
          mergedOrdersData = { ...expandedOrdersData }
          mergedCalculatedProgress = { ...calculatedProgress }

          successfulFetches.forEach(({ bookingId, orders, averageProgress }) => {
            mergedOrdersData[bookingId] = orders
            mergedCalculatedProgress[bookingId] = averageProgress
          })

          setExpandedOrdersData(mergedOrdersData)
          setCalculatedProgress(mergedCalculatedProgress)
        }
      }

      const nextMatches: Record<string, string[]> = {}
      const bookingsToExpand = new Set<string>()

      filteredBookings.forEach((booking) => {
        const bookingOrders = mergedOrdersData[booking._id] || []
        const matchingOrderIds = bookingOrders
          .filter((order: any) =>
            String(order.orderNumber || '')
              .trim()
              .toLowerCase()
              .replace(/^#/, '')
              .includes(normalizedSearch)
          )
          .map((order: any) => String(order.orderId || order._id || ''))
          .filter(Boolean)

        if (matchingOrderIds.length > 0) {
          nextMatches[booking._id] = matchingOrderIds
          bookingsToExpand.add(booking._id)
        }
      })

      if (isCancelled) {
        return
      }

      setOrderSearchMatches(nextMatches)

      if (bookingsToExpand.size > 0) {
        setExpandedBookings((prev) => {
          const next = new Set(prev)
          bookingsToExpand.forEach((bookingId) => next.add(bookingId))
          return next
        })
        setAutoExpandedBookingIds((prev) => {
          const next = new Set(prev)
          bookingsToExpand.forEach((bookingId) => next.add(bookingId))
          return next
        })
      }
    }

    void loadOrdersAndHighlightMatches()

    return () => {
      isCancelled = true
    }
  }, [debouncedSearch, filteredBookings])

  useEffect(() => {
    console.log('BookingsManagement: useEffect - Fetching bookings (pagination/filter changed)')
    fetchBookings()
  }, [currentPage, itemsPerPage, statusFilter, billingStatusFilter, communicationFilter, debouncedSearch, dateFrom, dateTo])

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
    const openByOrderId = (location.state as { openBookingByOrderId?: string } | null)?.openBookingByOrderId
    if (!openByOrderId || filteredBookings.length === 0) {
      return
    }

    const match = filteredBookings.find((b) =>
      Array.isArray(b.orderIds) && b.orderIds.some((o: string | { _id: string }) =>
        (typeof o === 'string' ? o : o._id) === openByOrderId
      )
    )
    if (!match) return

    const openDialog = async () => {
      try {
        setStatusFilter('all')
        setBillingStatusFilter('all')
        setCommunicationFilter('all')
        setSearchTerm('')
        setDebouncedSearch('')
        setDateFrom('')
        setDateTo('')
        setCurrentPage(1)
        setActiveHighlightedBookingId(match._id)
        await new Promise((r) => window.setTimeout(r, 400))
        const response = await getBooking(match._id)
        setSelectedBooking(response.booking)
        setShowDetailDialog(true)
      } catch (error) {
        console.error('BookingsManagement: Error opening booking by orderId:', error)
      }
    }

    openDialog()
  }, [location.state, filteredBookings])

  useEffect(() => {
    if (!highlightBookingIdFromQuery) {
      return
    }

    // Start from a neutral list state so the highlighted booking can be shown - but only on the
    // first entry (e.g. from the dashboard). When the URL already carries list params, the admin
    // filtered/paged after the highlight and is returning from a detail page: keep that state.
    const currentParams = new URLSearchParams(location.search)
    // (Dashboard/Finanzen link only highlightBookingId/openBookingId, never list params.)
    const hasListParams = Object.values(LIST_PARAM).some((key) => currentParams.has(key))
    if (hasListParams) {
      return
    }
    setSearchTerm("")
    setStatusFilter("all")
    setBillingStatusFilter("all")
    setCommunicationFilter("all")
    setCurrentPage(1)
    setActiveHighlightedBookingId(highlightBookingIdFromQuery)
  }, [highlightBookingIdFromQuery])

  useEffect(() => {
    if (!activeHighlightedBookingId || filteredBookings.length === 0) {
      return
    }

    const highlightedBooking = filteredBookings.find((booking) => booking._id === activeHighlightedBookingId)
    if (!highlightedBooking) {
      return
    }

    const rowSelector = `[data-booking-row-id="${activeHighlightedBookingId}"]`
    const timer = window.setTimeout(() => {
      const row = document.querySelector<HTMLElement>(rowSelector)
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }, 50)

    return () => window.clearTimeout(timer)
  }, [activeHighlightedBookingId, filteredBookings])

  useEffect(() => {
    if (!activeHighlightedBookingId) {
      return
    }

    const timer = window.setTimeout(() => {
      setActiveHighlightedBookingId(null)
    }, 6000)

    return () => window.clearTimeout(timer)
  }, [activeHighlightedBookingId])

  // Fetch unread counts when bookings change and set up periodic refresh
  useEffect(() => {
    console.log(`BookingsManagement: useEffect - Bookings changed, length: ${bookings.length}`)
    if (bookings.length > 0) {
      console.log('BookingsManagement: Bookings available, fetching unread counts')
      fetchUnreadCounts()

      // Set up periodic refresh every 10 seconds, skip while chat dialog is open
      const intervalId = setInterval(() => {
        if (communicationDialogOpenRef.current) return
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

      if (communicationFilter !== "all") {
        filters.communication = communicationFilter
      }

      if (debouncedSearch) {
        filters.search = debouncedSearch
      }

      if (dateFrom) {
        filters.startDate = dateFrom
      }

      if (dateTo) {
        filters.endDate = dateTo
      }

      const response = await getAdminBookings(filters)

      const bookingsData = (response as any).bookings || []
      const total = (response as any).total || 0

      setBookings(bookingsData)
      setTotalBookings(total)
      const responseLabelMode = (response as any).labelMode
      setLabelMode(responseLabelMode === 'dummy' || responseLabelMode === 'live' ? responseLabelMode : '')
      setFilteredBookings(bookingsData)
      setLoadError(null)
    } catch (error) {
      console.error("Error fetching bookings:", error)
      setLoadError("Buchungen konnten nicht geladen werden.")
      toast({
        title: t('common.error'),
        description: "Buchungen konnten nicht geladen werden",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Nach dem Laden: aus der URL gemerkte Buchungen wieder aufklappen und die Scrollposition
  // wiederherstellen (Rueckkehr aus dem Auftragsdetail).
  useEffect(() => {
    if (loading || bookings.length === 0) return
    const pending = pendingExpandIdsRef.current
    if (pending.length > 0) {
      pendingExpandIdsRef.current = []
      pending
        .filter((id) => bookings.some((booking) => booking._id === id) && !expandedBookings.has(id))
        .forEach((id) => { void toggleExpandBooking(id) })
    }
    if (!scrollRestoredRef.current) {
      scrollRestoredRef.current = true
      restoreListScroll(LIST_SCROLL_KEY, location.search)
    }
  }, [loading, bookings])

  // Merkt Scrollposition + URL, bevor ein Auftrag geoeffnet wird.
  const rememberListPosition = () => rememberListScroll(LIST_SCROLL_KEY, location.search)

  const orderDetailsState = () => buildOrderDetailsState(location, { label: 'Zurück zu den Buchungen' })

  const handleBulkShippingUpdate = async () => {
    try {
      setLoadingBulkShippingUpdate(true)
      const result = await bulkUpdateBookingShippingStatuses()
      toast({
        title: 'Versandstatus aktualisiert',
        description: `${result.updated} Sendung(en) aktualisiert, ${result.skipped} unverändert${result.errors > 0 ? `, ${result.errors} Fehler` : ''}.`,
        variant: result.errors > 0 ? 'destructive' : 'default',
      })
      fetchBookings()
    } catch (error: any) {
      toast({
        title: 'Fehler beim Aktualisieren',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoadingBulkShippingUpdate(false)
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

      // Remove entries for orders the user already opened (optimistically marked as read).
      // If the server no longer reports unread for a locally-read order, it's confirmed read —
      // remove from local set so future new messages show up again.
      const filtered: typeof countsToSet = {}
      for (const [id, val] of Object.entries(countsToSet)) {
        if (locallyReadOrderIds.current.has(id)) {
          // Server still reports unread — keep suppressing the badge (markAsRead may not have propagated yet)
        } else {
          filtered[id] = val
        }
      }
      // Clean up local set for orders the server no longer reports as unread
      for (const id of locallyReadOrderIds.current) {
        if (!(id in countsToSet)) {
          locallyReadOrderIds.current.delete(id)
        }
      }

      console.log('BookingsManagement: Setting unread counts state:', filtered)
      setUnreadCounts(filtered)

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

  // Search and date filtering are handled server-side; just mirror bookings into filteredBookings
  useEffect(() => {
    setFilteredBookings(bookings)
  }, [bookings])

  const openOrderCommunication = (orderId: string, orderNumber?: string) => {
    if (!orderId) return
    // Mark as read on the server immediately — don't wait for CommunicationPanel to mount and load
    markInspectionMessagesAsRead(orderId).catch((err) =>
      console.error('BookingsManagement: Error marking messages as read:', err)
    )
    // Optimistically clear the unread count for this order so the badge disappears immediately
    locallyReadOrderIds.current.add(orderId)
    setUnreadCounts((prev) => {
      if (!prev[orderId]) return prev
      const updated = { ...prev }
      delete updated[orderId]
      return updated
    })
    communicationDialogOpenRef.current = true
    setSelectedCommunicationOrder({ orderId, orderNumber })
    setCommunicationDialogOpen(true)
  }

  const handleViewDetails = async (
    booking: Booking,
    options?: {
      initialTab?: "overview" | "invoices"
      invoiceStatusFocus?: string | null
    }
  ) => {
    setDetailInitialTab(options?.initialTab || "overview")
    setDetailInvoiceStatusFocus(options?.invoiceStatusFocus || null)

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

  // Buchungs-Storno nur über den Dialog mit Pflichtgrund (Server: 400 ohne Grund, 409 bei offenen Aufträgen).
  const handleCancelBooking = (bookingId: string, bookingNumber?: string) => {
    setCancelBookingTarget({ id: bookingId, number: bookingNumber })
  }

  // Nach einem Auftrags-Storno die aufgeklappten Aufträge der Buchung und die Liste neu laden.
  const refreshBookingOrders = async (bookingId: string) => {
    try {
      const response = await getBookingOrders(bookingId)
      setExpandedOrdersData(prev => ({ ...prev, [bookingId]: response.orders || [] }))
    } catch (error) {
      console.error("Error reloading booking orders:", error)
    }
    fetchBookings()
  }

  const handleQuickSetPaid = async (booking: Booking) => {
    if (quickPayBookingId) return

    const effectivePaymentStatus = getEffectivePaymentStatus(booking)
    if (effectivePaymentStatus === 'paid') {
      return
    }

    try {
      setQuickPayBookingId(booking._id)
      await updateBookingBillingStatus(booking._id, 'paid', 'paid')
      toast({
        title: t('common.success'),
        description: 'Zahlungsstatus auf Bezahlt gesetzt'
      })
      await fetchBookings()
    } catch (error) {
      toast({
        title: t('common.error'),
        description: 'Zahlungsstatus konnte nicht auf Bezahlt gesetzt werden',
        variant: 'destructive'
      })
    } finally {
      setQuickPayBookingId(null)
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
          description: "Zugeordnete Aufträge konnten nicht geladen werden",
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
    const projectedOrder = booking.orders?.find((order) => String(order._id) === String(unreadItem.orderId))
    return {
      orderId: unreadItem.orderId,
      orderNumber: matchingOrder?.orderNumber || projectedOrder?.orderNumber,
    }
  }

  // Spalte "Geraete / Auftraege": je Auftrag Geraet + Auftragsnummer (Link ins Detail).
  // Quelle: Admin-Listenprojektion (booking.orders); Altantworten ohne orders -> booking.items.
  const getBookingDeviceLines = (booking: Booking) => {
    const fromOrders = (booking.orders || []).map((order) => {
      const isProduct = order.type === 'product' || order.deviceType === 'Shop Products'
      const productItem = isProduct
        ? (booking.items || []).find((item) => String(item.orderId || '') === String(order._id))
        : null
      const productNames = productItem?.products?.map((product) => product.name).filter(Boolean).join(', ')
      return {
        key: String(order._id),
        orderId: String(order._id),
        orderNumber: order.orderNumber || '',
        isProduct,
        device: isProduct
          ? (order.device || productNames || 'Shop-Artikel')
          : (order.device || [order.deviceBrand, order.deviceModel].filter(Boolean).join(' ') || 'Gerät'),
      }
    })
    if (fromOrders.length > 0) return fromOrders
    return (booking.items || []).map((item, index) => ({
      key: String(item.orderId || item._id || index),
      orderId: item.orderId ? String(item.orderId) : '',
      orderNumber: '',
      isProduct: item.type !== 'repair',
      device: item.type === 'repair'
        ? (item.device || 'Gerätereparatur')
        : (item.products?.map((product) => product.name).join(', ') || 'Produkt'),
    }))
  }

  // Spalte "Einsendung" (Kunde -> McRepair): Einsendelabel im Buchungsplatz oder DHL-Retoure.
  const getInboundListSummary = (booking: Booking) => {
    const placeholder = Boolean(booking.inboundLabelPlaceholder)
    if (booking.shippingLabelCreationInProgress) {
      return { label: 'Abgleich nötig', className: 'bg-amber-100 text-amber-900', placeholder, title: 'Ergebnis der DHL-Labelerstellung unklar oder Erstellung läuft – in den Details (Versand) prüfen.' }
    }
    const hasRetoure = Boolean(booking.returnTrackingNumber || (booking.returnShipmentStatus && booking.returnShipmentStatus !== 'pending'))
    const status = hasRetoure ? booking.returnShipmentStatus : (booking.trackingNumber ? (booking.shippingStatus || 'label-created') : '')
    if (!hasRetoure && !booking.trackingNumber) {
      return { label: 'Kein Label', className: 'bg-gray-100 text-gray-700', placeholder, title: 'Für diese Buchung ist noch kein Einsendelabel hinterlegt.' }
    }
    switch (status) {
      case 'delivered':
        return { label: 'Eingegangen', className: 'bg-green-100 text-green-800', placeholder, title: 'Paket laut DHL bei McRepair zugestellt.' }
      case 'in-transit':
      case 'shipped':
      case 'out-for-delivery':
        return { label: 'Unterwegs', className: 'bg-blue-100 text-blue-800', placeholder, title: 'Paket ist unterwegs zu McRepair.' }
      case 'failed':
        return { label: 'Fehlgeschlagen', className: 'bg-red-100 text-red-800', placeholder, title: 'Die Sendung meldet einen Fehler.' }
      default:
        return { label: 'Label erstellt', className: 'bg-yellow-100 text-yellow-800', placeholder, title: hasRetoure ? 'DHL-Retoure erstellt.' : 'DHL-Einsendelabel erstellt.' }
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
      case 'draft':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200'
      case 'sent':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'viewed':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
      case 'overdue':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
      case 'partially_paid':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
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
      case 'draft':
        return 'Vorlage'
      case 'sent':
        return 'Gesendet'
      case 'viewed':
        return 'Angesehen'
      case 'partially_paid':
        return 'Teilweise Bezahlt'
      case 'overdue':
        return 'Überfällig'
      case 'unpaid':
        return 'Offen'
      case 'partially-paid':
        return 'Teilbezahlt'
      case 'paid':
        return 'Bezahlt'
      default:
        return status
    }
  }

  const getEffectivePaymentStatus = (booking: Booking) => {
    const invoiceStatuses = ['draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue']
    const candidate = String(booking.paymentStatus || '')
    return invoiceStatuses.includes(candidate) ? candidate : booking.billingStatus
  }

  const getOrderProgressStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Ausstehend'
      case 'diagnostic-assessment':
        return 'Diagnosebewertung'
      case 'in-progress':
        return 'In Arbeit'
      case 'paused':
        return 'Pausiert'
      case 'quality-check':
        return 'Qualitätsprüfung'
      case 'ready-for-pickup':
        return 'Reparatur abgeschlossen'
      case 'completed':
        return 'Abgeschlossen'
      case 'cancelled':
        return 'Storniert'
      default:
        return status
    }
  }

  // Gemeinsame, NaN-sichere Formatierung (lib/utils formatEUR) statt einer lokalen Kopie.
  const formatCurrency = (value: unknown) => formatEUR(value)

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

  // Offener Betrag der Liste: ausschließlich der vom Server berechnete Zahlungsstand
  // (booking.paymentBalance: open / overpaid / received). Hier wird nicht mehr
  // "Gesamt - bezahlt" nachgerechnet. Eine Überzahlung ist eine offene ERSTATTUNG an den
  // Kunden, keine Gutschrift auf den Beleg.
  // "Gesamt (brutto)" der Buchung: derselbe Bezugswert wie der offene Betrag (paymentBalance.reference),
  // sonst totalCost. finalCost ist kein Schemafeld (nur Altdaten) und ueberschreibt den Wert nicht.
  const getBookingGrossTotal = (booking: Booking) => {
    const reference = Number(booking.paymentBalance?.reference ?? booking.paymentBalance?.total)
    if (booking.paymentBalance && Number.isFinite(reference)) return reference
    return Number(booking.totalCost || 0)
  }

  const getBookingOpenAmountInfo = (booking: Booking) => {
    const balance = booking.paymentBalance
    // Ausdrücklich unbekannt (Saldenberechnung auf dem Server fehlgeschlagen): nichts erfinden.
    if (balance === null) {
      return { amount: 0, type: 'unknown' as const, received: 0 }
    }
    if (balance && typeof balance === 'object') {
      const overpaid = Number(balance.refundPending ?? balance.overpaid ?? 0)
      const open = Number(balance.open ?? 0)
      const received = Number(balance.received ?? 0)
      if (Number.isFinite(overpaid) && overpaid > 0.009) {
        return { amount: overpaid, type: 'refund' as const, received }
      }
      if (Number.isFinite(open) && open > 0.009) {
        return { amount: open, type: received > 0.009 ? 'partial' as const : 'open' as const, received }
      }
      return { amount: 0, type: 'settled' as const, received }
    }

    // Ältere Antwort ohne paymentBalance: Rechnungssalden des Servers, sonst "unbekannt"
    // (kein erfundener Betrag). Ein negativer Saldo ist hier offenes GUTSCHRIFTS-Guthaben
    // (customerCreditOpenAmount) - keine Überzahlung mit offener Erstattung.
    if (booking.netOpenAmount !== undefined && booking.netOpenAmount !== null && Number.isFinite(Number(booking.netOpenAmount))) {
      const netOpen = Number(booking.netOpenAmount || 0)
      if (netOpen > 0.009) return { amount: netOpen, type: 'open' as const, received: 0 }
      if (netOpen < -0.009) return { amount: Math.abs(netOpen), type: 'credit' as const, received: 0 }
      return { amount: 0, type: 'settled' as const, received: 0 }
    }

    return { amount: 0, type: 'unknown' as const, received: 0 }
  }

  if (loading && filteredBookings.length === 0) {
    return (
      <div className="section" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="container">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--primary-blue)' }}></div>
            <p className="mt-4" style={{ color: 'var(--gray-500)', fontSize: '0.95rem' }}>Buchungen werden geladen …</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="section bookings-management-section" style={{ background: 'var(--off-white)', minHeight: 'calc(100vh - 200px)', paddingTop: '20px', paddingBottom: '36px' }}>
      <div className="container bookings-container">
        <div className="section-title bookings-page-header" style={{ marginBottom: '20px' }}>
          <div className="bookings-page-heading-row">
            <div>
              <h1 className="bookings-page-title" style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--white)', marginBottom: '4px' }}>Buchungen</h1>
              <p className="bookings-page-subtitle" style={{ color: 'rgba(255,255,255,0.88)', fontSize: '0.875rem' }}>Kundenbuchungen (BKG-…) mit ihren Reparaturaufträgen – Status, Zahlung, Einsendung und Nachrichten auf einen Blick</p>
            </div>
            <Button type="button" className="manual-repair-trigger" onClick={() => setShowManualRepairDialog(true)}>
              <Wrench className="h-4 w-4" /> Reparaturauftrag anlegen
            </Button>
          </div>
          <div className="accent-line"></div>
        </div>

      {/* Stats Cards */}
      {/* Kompakte Kennzahlen (eine Zeile je Kachel), damit die Liste bei 1366x768 frueher beginnt */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2" style={{ marginBottom: '10px' }}>
        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--gray-200)',
          borderRadius: 'var(--radius-lg)',
          padding: '8px 12px',
          boxShadow: 'var(--shadow-sm)',
          transition: 'var(--transition)'
        }} className="booking-kpi-tile hover:shadow-md">
          <div style={{ color: 'var(--gray-500)', fontSize: '0.75rem', fontWeight: '600', marginBottom: '4px' }}>Buchungen gesamt (Filter)</div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--primary-blue)' }}>{totalBookings}</div>
        </div>
        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--gray-200)',
          borderRadius: 'var(--radius-lg)',
          padding: '8px 12px',
          boxShadow: 'var(--shadow-sm)',
          transition: 'var(--transition)'
        }} className="booking-kpi-tile hover:shadow-md">
          <div style={{ color: 'var(--gray-500)', fontSize: '0.74rem', fontWeight: '600', marginBottom: '4px' }}>Ausstehend (diese Seite)</div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--accent-yellow)' }}>{bookings.filter(b => b.status === 'pending').length}</div>
        </div>
        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--gray-200)',
          borderRadius: 'var(--radius-lg)',
          padding: '8px 12px',
          boxShadow: 'var(--shadow-sm)',
          transition: 'var(--transition)'
        }} className="booking-kpi-tile hover:shadow-md">
          <div style={{ color: 'var(--gray-500)', fontSize: '0.74rem', fontWeight: '600', marginBottom: '4px' }}>Zahlung ausstehend (diese Seite)</div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#ff9800' }}>{bookings.filter(b => b.status === 'payment-pending').length}</div>
        </div>
        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--gray-200)',
          borderRadius: 'var(--radius-lg)',
          padding: '8px 12px',
          boxShadow: 'var(--shadow-sm)',
          transition: 'var(--transition)'
        }} className="booking-kpi-tile hover:shadow-md">
          <div style={{ color: 'var(--gray-500)', fontSize: '0.74rem', fontWeight: '600', marginBottom: '4px' }}>Buchungswert dieser Seite (brutto)</div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--success)' }}>{formatCurrency(bookings.reduce((sum, b) => sum + getBookingGrossTotal(b), 0))}</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--gray-200)',
        borderRadius: 'var(--radius-lg)',
        padding: '10px 14px',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '10px'
      }}>
        <h2 className="sr-only">Filter</h2>
        <div className="flex flex-col md:flex-row gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '4px', display: 'block' }}>Suche</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: 'var(--gray-400)' }} />
              <Input
                placeholder="Buchungs-ID, Auftragsnummer, Kundenname, E-Mail oder Telefon..."
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
                <SelectItem value="unpaid">Offen</SelectItem>
                <SelectItem value="partially-paid">Teilbezahlt</SelectItem>
                <SelectItem value="paid">Bezahlt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-52">
            <label style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '4px', display: 'block' }}>Kommunikation</label>
            <Select
              value={communicationFilter}
              onValueChange={(value) => {
                setCommunicationFilter(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Buchungen</SelectItem>
                <SelectItem value="unread-customer-response">Ungelesene Kundenrückmeldungen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-40">
            <label style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '4px', display: 'block' }}>
              <Calendar className="inline-block h-3 w-3 mr-1" />
              Von
            </label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setCurrentPage(1)
              }}
              style={{
                border: '1px solid var(--gray-200)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px',
                fontSize: '0.82rem',
                width: '100%'
              }}
            />
          </div>
          <div className="w-full md:w-40">
            <label style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '4px', display: 'block' }}>
              <Calendar className="inline-block h-3 w-3 mr-1" />
              Bis
            </label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setCurrentPage(1)
              }}
              style={{
                border: '1px solid var(--gray-200)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px',
                fontSize: '0.82rem',
                width: '100%'
              }}
            />
          </div>
          {(searchTerm || statusFilter !== 'all' || billingStatusFilter !== 'all' || communicationFilter !== 'all' || dateFrom || dateTo) && (
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('')
                  setDebouncedSearch('')
                  setStatusFilter('all')
                  setBillingStatusFilter('all')
                  setCommunicationFilter('all')
                  setDateFrom('')
                  setDateTo('')
                  setCurrentPage(1)
                }}
                style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}
              >
                <X className="h-3 w-3 mr-1" />
                Filter zurücksetzen
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* DHL-5: Banner nach dem KONFIGURIERTEN Buchungslabel-Modus (GET /api/bookings -> labelMode).
          Im Live-Modus mit alten Testlabels auf der Seite nur ein Hinweis auf diese Testlabels. */}
      {labelMode === 'dummy' ? (
        <div className="booking-dummy-banner" role="status">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Dummy-Modus aktiv – Labels sind Testlabels.</span>{' '}
            Neue Einsendelabels sind keine echten DHL-Labels und dürfen nicht für den Versand verwendet werden.
            Umschalten: Systemkonfiguration → Integrationen → DHL → Buchungslabel-Modus „Live“.
          </p>
        </div>
      ) : filteredBookings.some((booking) => booking.inboundLabelPlaceholder) ? (
        <div className="booking-dummy-banner" role="status">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Auf dieser Seite gibt es Testlabels (kein echtes DHL-Label).</span>{' '}
            Buchungen mit dem Hinweis „Testlabel“ stammen aus dem Dummy-Modus; das PDF darf nicht für den Versand verwendet werden.
          </p>
        </div>
      ) : null}

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
            <p style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
              {loading ? 'Wird geladen …' : `${totalBookings} Buchung${totalBookings === 1 ? '' : 'en'} gefunden`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchUnreadCounts()}
              disabled={loadingUnreadCounts}
              title="Nachrichtenanzahl aktualisieren"
              aria-label="Nachrichtenanzahl aktualisieren"
            >
              <RefreshCw className={`h-4 w-4 ${loadingUnreadCounts ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkShippingUpdate}
              disabled={loadingBulkShippingUpdate}
              title="Versandstatus aller aktiven Sendungen über die DHL-Schnittstelle prüfen und aktualisieren"
              className="gap-1.5"
            >
              <Truck className={`h-4 w-4 ${loadingBulkShippingUpdate ? 'animate-pulse' : ''}`} />
              Versandstatus prüfen
            </Button>
          </div>
        </div>
        <div style={{ padding: '10px 12px' }}>
          {loadError && filteredBookings.length === 0 ? (
            <div className="text-center py-8" role="alert">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 text-red-500" aria-hidden="true" />
              <p style={{ fontSize: '0.95rem', color: 'var(--gray-700)' }}>{loadError}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchBookings()}>
                <RefreshCw className="h-4 w-4 mr-1" /> Erneut versuchen
              </Button>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--gray-500)' }}>
              <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p style={{ fontSize: '0.95rem' }}>
                {(debouncedSearch || statusFilter !== 'all' || billingStatusFilter !== 'all' || communicationFilter !== 'all' || dateFrom || dateTo)
                  ? 'Keine Buchungen für diese Filter gefunden.'
                  : 'Noch keine Buchungen vorhanden.'}
              </p>
            </div>
          ) : (
            <div className="w-full bookings-list-table-wrap">
              <Table className="w-full bookings-list-table">
                <TableHeader style={{ background: 'var(--primary-blue)' }}>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="booking-col-toggle"><span className="sr-only">Aufträge aufklappen</span></TableHead>
                    <TableHead>Buchung</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Geräte / Aufträge</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Zahlung</TableHead>
                    <TableHead className="hidden xl:table-cell" title="DHL-Einsendelabel bzw. DHL-Retoure: Kunde → McRepair">Einsendung</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => {
                    const customer = getSafeBookingCustomer(booking)
                    const customerDisplayName = getCustomerDisplayName(customer)
                    const isGuestBooking = !booking.customerId && Boolean(booking.guestInfo?.isGuest || booking.guestInfo?.email)
                    const openAmountInfo = getBookingOpenAmountInfo(booking)
                    const unreadInfo = getBookingUnreadCount(booking)
                    const firstUnreadOrder = unreadInfo.total > 0 ? getFirstUnreadOrderForBooking(booking) : null
                    const deviceLines = getBookingDeviceLines(booking)
                    const inbound = getInboundListSummary(booking)
                    const progress = getBookingProgress(booking._id, booking.overallProgress || 0)
                    const isExpanded = expandedBookings.has(booking._id)
                    const effectivePaymentStatus = getEffectivePaymentStatus(booking)

                    return (
                    <React.Fragment key={booking._id}>
                    <TableRow
                      data-booking-row-id={booking._id}
                      className={`hover:bg-muted/50 ${activeHighlightedBookingId === booking._id ? 'booking-row-highlight' : ''}`}
                    >
                      <TableCell className="booking-col-toggle">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => toggleExpandBooking(booking._id)}
                          disabled={loadingOrders.has(booking._id)}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Aufträge der Buchung zuklappen' : 'Aufträge der Buchung anzeigen'}
                          title={isExpanded ? 'Aufträge zuklappen' : 'Aufträge und Leistungen anzeigen'}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold whitespace-nowrap">{booking.bookingNumber || `#${booking._id.slice(-8).toUpperCase()}`}</span>
                          <span className="booking-meta">{formatDate(booking.createdAt)}</span>
                          {booking.hasComplaintOrders && (
                            <Badge className="bg-rose-100 text-rose-800 border border-rose-300 text-xs px-1.5 py-0 w-fit font-medium">
                              Reklamation
                            </Badge>
                          )}
                          {unreadInfo.total > 0 && firstUnreadOrder?.orderId && (
                            <button
                              type="button"
                              className={`booking-unread-chip ${unreadInfo.hasCustomerMessages ? '' : 'is-staff'}`}
                              onClick={() => openOrderCommunication(firstUnreadOrder.orderId, firstUnreadOrder.orderNumber)}
                              title="Kundenkommunikation öffnen"
                            >
                              <MessageSquare className="h-3 w-3" aria-hidden="true" />
                              {unreadInfo.total > 99 ? '99+' : unreadInfo.total} {unreadInfo.total === 1 ? 'neue Nachricht' : 'neue Nachrichten'}
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="booking-cell-customer">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" title={customerDisplayName}>{customerDisplayName}</p>
                          {customer.email && <p className="booking-meta truncate" title={customer.email}>{customer.email}</p>}
                          {isGuestBooking && (
                            <Badge variant="outline" className="mt-1 text-xs px-1.5 py-0 w-fit">Gast</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="booking-cell-devices">
                        <div className="flex flex-col gap-1">
                          {deviceLines.slice(0, 2).map((line) => (
                            <div key={line.key} className="booking-device-line text-sm">
                              <span className="min-w-0">{line.device}</span>
                              {line.orderId ? (
                                <Link
                                  to={getOrderDetailsPath(line.orderId)}
                                  state={orderDetailsState()}
                                  onClick={rememberListPosition}
                                  className="booking-order-link text-xs"
                                  title={`Reparaturauftrag ${line.orderNumber || ''} öffnen`}
                                >
                                  {line.orderNumber || 'Auftrag öffnen'}
                                </Link>
                              ) : null}
                            </div>
                          ))}
                          {deviceLines.length > 2 && (
                            <button type="button" className="booking-meta text-left underline underline-offset-2 w-fit" onClick={() => { if (!isExpanded) void toggleExpandBooking(booking._id) }}>
                              + {deviceLines.length - 2} weitere
                            </button>
                          )}
                          {deviceLines.length === 0 && <span className="booking-meta">Keine Aufträge</span>}
                          <span className="booking-meta">
                            {booking.items.length} Position{booking.items.length === 1 ? '' : 'en'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge className={`${getStatusColor(booking.status)} w-fit`}>
                            {getBookingStatusLabel(booking.status)}
                          </Badge>
                          <span className="booking-meta whitespace-nowrap">Fortschritt {progress} %</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            className="booking-payment-status-anchor w-fit"
                            onClick={() => {
                              void handleViewDetails(booking, {
                                initialTab: "invoices",
                                invoiceStatusFocus: effectivePaymentStatus
                              })
                            }}
                            title="Rechnungen und Zahlungen dieser Buchung öffnen"
                          >
                            <Badge className={getBillingStatusColor(effectivePaymentStatus)}>
                              {getBillingStatusLabel(effectivePaymentStatus)}
                            </Badge>
                          </button>
                          {openAmountInfo.type === 'unknown' ? (
                            <span className="booking-meta" title="Der Zahlungsstand konnte nicht ermittelt werden.">Zahlungsstand unbekannt</span>
                          ) : openAmountInfo.type === 'credit' ? (
                            <span className="text-sm font-semibold whitespace-nowrap" style={{ color: '#475569' }} title="Offenes Gutschriftsguthaben des Kunden.">
                              Gutschrift {formatCurrency(openAmountInfo.amount)}
                            </span>
                          ) : openAmountInfo.type === 'settled' ? (
                            <span className="booking-meta whitespace-nowrap">Ausgeglichen</span>
                          ) : openAmountInfo.type === 'refund' ? (
                            <span className="text-sm font-semibold" style={{ color: '#6d28d9' }} title="Der Kunde hat mehr gezahlt als gefordert – der Betrag ist zu erstatten.">
                              Überzahlt · Erstattung offen {formatCurrency(openAmountInfo.amount)}
                            </span>
                          ) : (
                            <span className="text-sm font-semibold whitespace-nowrap" style={{ color: '#dc2626' }}>
                              {formatCurrency(openAmountInfo.amount)} offen
                            </span>
                          )}
                          <span className="booking-meta whitespace-nowrap">Gesamt {formatCurrency(getBookingGrossTotal(booking))}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <div className="flex flex-col gap-1">
                          <Badge className={`${inbound.className} w-fit`} title={inbound.title}>
                            <Truck className="h-3 w-3 mr-1" aria-hidden="true" />
                            {inbound.label}
                          </Badge>
                          {inbound.placeholder && (
                            <Badge variant="outline" className="w-fit border-amber-400 bg-amber-50 text-amber-800 text-xs" title="Dummy-Modus: kein echtes DHL-Label">
                              Testlabel
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="booking-row-action h-8 px-2 border-slate-300 text-[#1a2a5e]"
                            onClick={() => handleViewDetails(booking)}
                            title="Buchungsdetails öffnen (Übersicht, Versand, Rechnungen, Verlauf)"
                          >
                            Details
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Weitere Aktionen" title="Weitere Aktionen">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64 z-50">
                              <DropdownMenuItem onClick={() => handleViewDetails(booking)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Details ansehen
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { if (!isExpanded) void toggleExpandBooking(booking._id) }}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Aufträge der Buchung anzeigen
                              </DropdownMenuItem>
                              {deviceLines.some((line) => line.orderId && !line.isProduct) && (
                                <DropdownMenuItem onClick={() => {
                                  const first = firstUnreadOrder || deviceLines.find((line) => line.orderId && !line.isProduct)
                                  if (first?.orderId) openOrderCommunication(first.orderId, first.orderNumber)
                                }}>
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  Kundenkommunikation öffnen
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={async () => {
                                try {
                                  const response = await getBooking(booking._id)
                                  setSelectedBooking(response?.booking || booking)
                                } catch (error) {
                                  console.error('BookingsManagement: Failed to load full booking for invoice dialog:', error)
                                  setSelectedBooking(booking)
                                }
                                setShowInvoiceDialog(true)
                              }}>
                                <FileText className="h-4 w-4 mr-2" />
                                Rechnung erstellen
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedBooking(booking)
                                setShowPaymentsDialog(true)
                              }}>
                                <CreditCard className="h-4 w-4 mr-2" />
                                Zahlungen
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
                                Einsendelabel erstellen (Kunde → McRepair)
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleCancelBooking(booking._id, booking.bookingNumber)}
                                disabled={booking.status === 'cancelled' || cancelBookingTarget?.id === booking._id}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Buchung stornieren
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Buchungsdetail-Dialog */}
                        <Dialog open={selectedBooking?._id === booking._id && showDetailDialog} onOpenChange={(open) => {
                          if (!open) {
                            setShowDetailDialog(false)
                            setSelectedBooking(null)
                            setDetailInitialTab("overview")
                            setDetailInvoiceStatusFocus(null)
                          }
                        }}>
                          {selectedBooking?._id === booking._id && (
                            <BookingDetailDialog
                              booking={selectedBooking}
                              navigate={navigate}
                              initialTab={detailInitialTab}
                              invoiceStatusFocus={detailInvoiceStatusFocus}
                              onStatusUpdate={() => {
                                setSelectedBooking(null)
                                setShowDetailDialog(false)
                                setDetailInitialTab("overview")
                                setDetailInvoiceStatusFocus(null)
                                fetchBookings()
                              }}
                              onChanged={() => {
                                // Dialog bleibt offen (z. B. nach "DHL-Einsendelabel erstellen"):
                                // Liste und Buchung neu laden, damit Download/Druck sofort sichtbar sind.
                                fetchBookings()
                                getBooking(booking._id)
                                  .then((response) => {
                                    if (response?.booking) {
                                      setSelectedBooking((current) => (current && current._id === booking._id ? response.booking : current))
                                    }
                                  })
                                  .catch((error) => console.error('BookingsManagement: Failed to refresh booking:', error))
                              }}
                            />
                          )}
                        </Dialog>
                      </TableCell>
                    </TableRow>

                    {/* Aufgeklappt: Auftraege der Buchung als umbrechende Zeilen (keine 1400px-Untertabelle) */}
                    {isExpanded && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={8} className="p-0">
                          <div className="p-3 space-y-3">
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                              <span><span className="booking-meta">Buchungsstatus </span>{getBookingStatusLabel(booking.status)}</span>
                              <span><span className="booking-meta">Zahlung </span>{getBillingStatusLabel(effectivePaymentStatus)}</span>
                              <span><span className="booking-meta">Gesamt (brutto) </span><span className="font-semibold">{formatCurrency(getBookingGrossTotal(booking))}</span></span>
                              <span><span className="booking-meta">Gesamtfortschritt </span>{progress} %</span>
                              <span className="xl:hidden"><span className="booking-meta">Einsendung </span>{inbound.label}{inbound.placeholder ? ' (Testlabel)' : ''}</span>
                            </div>

                            {loadingOrders.has(booking._id) ? (
                              <p className="text-sm text-foreground/60 py-2">Aufträge werden geladen …</p>
                            ) : expandedOrdersData[booking._id] && expandedOrdersData[booking._id].length > 0 ? (
                              <div className="booking-orders-list" aria-label="Zugeordnete Aufträge">
                                {expandedOrdersData[booking._id].map((item: any) => {
                                  const itemOrderId = String(item.orderId || item._id || '')
                                  const isOrderSearchMatch = (orderSearchMatches[booking._id] || []).includes(itemOrderId)
                                  const itemUnread = item.orderId ? unreadCounts[item.orderId] : undefined

                                  return (
                                    <div key={itemOrderId || item.orderNumber} className={`booking-order-row ${isOrderSearchMatch ? 'booking-order-search-match' : ''}`}>
                                      <div className="flex flex-col gap-1">
                                        <span className="font-semibold text-sm">{item.orderNumber || 'Auftrag'}</span>
                                        <Badge className={`${getOrderTypeBadgeClass(item)} w-fit`}>
                                          {item.type === 'repair'
                                            ? (item.isComplaintFollowup ? 'Reklamationsreparatur' : 'Reparatur')
                                            : 'Produkt'}
                                        </Badge>
                                      </div>
                                      <div className="text-sm min-w-0">
                                        <p className="font-medium">
                                          {item.type === 'repair'
                                            ? (item.device || 'Gerätereparatur')
                                            : (item.products?.map((p: any) => p.name).join(', ') || 'Produktposition')}
                                        </p>
                                        {item.type === 'repair' && item.services && item.services.length > 0 ? (
                                          <ul className="mt-0.5 space-y-0.5">
                                            {item.services.map((service: any, sidx: number) => (
                                              <li key={sidx} className="booking-meta">
                                                {service.name}{service.price ? ` (${formatEUR(service.price)})` : ''}
                                              </li>
                                            ))}
                                          </ul>
                                        ) : item.type === 'product' && item.products && item.products.length > 0 ? (
                                          <ul className="mt-0.5 space-y-0.5">
                                            {item.products.map((product: any, pidx: number) => (
                                              <li key={pidx} className="booking-meta">{product.name} × {product.quantity}</li>
                                            ))}
                                          </ul>
                                        ) : null}
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        <Badge className={`${getOrderStatusColor(item.status || 'pending')} w-fit`}>
                                          {getOrderProgressStatusLabel(item.status || 'pending')}
                                        </Badge>
                                        <span className="booking-meta">Fortschritt {item.progress || 0} % · {formatCurrency(Number(item.cost || 0))}</span>
                                        {itemUnread && itemUnread.unread > 0 && (
                                          <button
                                            type="button"
                                            className={`booking-unread-chip ${itemUnread.senderType === 'customer' ? '' : 'is-staff'}`}
                                            onClick={() => openOrderCommunication(item.orderId, item.orderNumber)}
                                          >
                                            <MessageSquare className="h-3 w-3" aria-hidden="true" />
                                            {itemUnread.unread > 99 ? '99+' : itemUnread.unread} {itemUnread.unread === 1 ? 'neue Nachricht' : 'neue Nachrichten'}
                                          </button>
                                        )}
                                      </div>
                                      <div className="flex flex-col items-start gap-1.5">
                                        {item.orderId && (
                                          <Link
                                            to={getOrderDetailsPath(item.orderId)}
                                            state={orderDetailsState()}
                                            onClick={rememberListPosition}
                                            className="booking-order-link text-sm"
                                          >
                                            Details ansehen
                                          </Link>
                                        )}
                                        {item.orderId && (
                                          <button
                                            type="button"
                                            className="text-xs text-foreground/70 underline underline-offset-2"
                                            onClick={() => openOrderCommunication(item.orderId, item.orderNumber)}
                                          >
                                            Nachrichten
                                          </button>
                                        )}
                                        {item.orderId && !['cancelled', 'completed'].includes(String(item.status || 'pending')) && (
                                          <button
                                            type="button"
                                            className="text-xs text-red-700 underline underline-offset-2"
                                            onClick={() => setCancelOrderTarget({ bookingId: booking._id, orderId: String(item.orderId), orderNumber: item.orderNumber })}
                                          >
                                            Auftrag stornieren
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-foreground/60 py-2">Keine zugeordneten Aufträge gefunden.</p>
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
                    Zurück
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
              communicationDialogOpenRef.current = open
              setCommunicationDialogOpen(open)
              if (!open) {
                setSelectedCommunicationOrder(null)
                // Delay refetch so the backend markAsRead has time to complete.
                // Do NOT clear locallyReadOrderIds here — let fetchUnreadCounts handle
                // cleanup when the server confirms 0 unread for that order.
                setTimeout(() => fetchUnreadCounts(), 2000)
              }
            }}
          >
            {/* ADMUX-3: EIN Dialog (Rückfrage/Aktion sind Composer-Modi im Panel), feste Kopfzeile,
                Verlauf scrollt, Eingabe bleibt unten sichtbar. COMMS-13: keine Auftrags-ID als inspectionId. */}
            {/* Feste Hoehe (Chatfenster): nur so ist die Hoehe "definit" und der Verlauf schrumpft,
                waehrend die Eingabe unten sichtbar bleibt (mit reinem max-h wuerde der Body scrollen). */}
            <DialogContent className="max-w-4xl h-[min(780px,calc(100dvh-2rem))] gap-0 p-0 overflow-clip">
              <DialogHeader className="border-b px-6 py-4 pr-12 text-left">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4 text-[#1a2a5e]" aria-hidden="true" />
                  Kundenkommunikation{selectedCommunicationOrder?.orderNumber ? ` · ${selectedCommunicationOrder.orderNumber}` : ''}
                </DialogTitle>
                <DialogDescription>
                  Nachrichten an den Kunden erscheinen im Kundenkonto und werden per E-Mail angekündigt. Interne Notizen sieht nur das Team.
                </DialogDescription>
                {selectedCommunicationOrder && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
                    <Link
                      to={getOrderDetailsPath(selectedCommunicationOrder.orderId)}
                      state={orderDetailsState()}
                      onClick={rememberListPosition}
                      className="inline-flex items-center gap-1 font-semibold text-[#1a2a5e] underline underline-offset-2"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Im Auftrag öffnen
                    </Link>
                    <Link
                      to={`/messages?thread=order:${selectedCommunicationOrder.orderId}`}
                      onClick={rememberListPosition}
                      className="inline-flex items-center gap-1 font-semibold text-[#1a2a5e] underline underline-offset-2"
                    >
                      <Inbox className="h-3.5 w-3.5" aria-hidden="true" /> Im Postfach öffnen
                    </Link>
                  </div>
                )}
              </DialogHeader>

              {selectedCommunicationOrder && (
                <DialogBody className="flex flex-col px-6 py-4">
                  <CommunicationPanel
                    orderId={selectedCommunicationOrder.orderId}
                    entityType="order"
                    layout="fill"
                    hideTitle
                    onSent={() => fetchUnreadCounts()}
                  />
                </DialogBody>
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
      <ManualRepairOrderDialog
        open={showManualRepairDialog}
        onOpenChange={setShowManualRepairDialog}
        onCreated={fetchBookings}
      />

      {cancelBookingTarget && (
        <BookingCancelDialog
          open={Boolean(cancelBookingTarget)}
          onOpenChange={(open) => { if (!open) setCancelBookingTarget(null) }}
          bookingId={cancelBookingTarget.id}
          bookingNumber={cancelBookingTarget.number}
          onCancelled={fetchBookings}
        />
      )}

      {cancelOrderTarget && (
        <OrderCancelDialog
          open={Boolean(cancelOrderTarget)}
          onOpenChange={(open) => { if (!open) setCancelOrderTarget(null) }}
          orderId={cancelOrderTarget.orderId}
          orderNumber={cancelOrderTarget.orderNumber}
          onCancelled={() => { void refreshBookingOrders(cancelOrderTarget.bookingId) }}
        />
      )}

      {selectedBooking && (
        <BookingPaymentsDialog
          bookingId={selectedBooking._id}
          bookingNumber={selectedBooking.bookingNumber}
          open={showPaymentsDialog}
          onOpenChange={(open) => {
            setShowPaymentsDialog(open)
            if (!open) {
              setSelectedBooking(null)
            }
          }}
          onChanged={fetchBookings}
        />
      )}

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
            // Der Dialog meldet den Erfolg selbst ("Einsendelabel erstellt") - kein zweiter,
            // widersprüchlicher Toast. Liste neu laden, damit die Spalte "Einsendung" stimmt.
            setShowCreateShippingLabelDialog(false)
            fetchBookings()
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
  initialTab,
  invoiceStatusFocus,
  onStatusUpdate,
  onChanged
}: {
  booking: Booking;
  navigate: any;
  initialTab?: "overview" | "invoices";
  invoiceStatusFocus?: string | null;
  onStatusUpdate: () => void;
  // Nur neu laden, Dialog offen lassen (Label-Aktionen im Versand-Tab).
  onChanged?: () => void
}) {
  const refreshKeepOpen = onChanged || onStatusUpdate
  const { t } = useTranslation()
  const location = useLocation()
  const customer = getSafeBookingCustomer(booking)
  const customerDisplayName = getCustomerDisplayName(customer)
  const [activeTab, setActiveTab] = useState<string>(initialTab || "overview")
  const [updating, setUpdating] = useState(false)
  const [newStatus, setNewStatus] = useState(booking.status)
  const [newBillingStatus, setNewBillingStatus] = useState(booking.billingStatus)
  const [description, setDescription] = useState("")
  const [showReturnLabelDialog, setShowReturnLabelDialog] = useState(false)
  const [showBookingCancelDialog, setShowBookingCancelDialog] = useState(false)
  const [detailOrders, setDetailOrders] = useState<any[]>([])
  const [loadingRepairJobs, setLoadingRepairJobs] = useState(true)
  const { toast } = useToast()
  const { user: currentUser } = useAuth()
  const [reconcileTracking, setReconcileTracking] = useState('')
  const [reconcilingInbound, setReconcilingInbound] = useState(false)
  // Einsendestatus aus dem DHL-Lesemodell (GET /api/bookings/:id/inbound-label): Zustand,
  // Sendungsnummer, Download-Adresse, Testlabel-Kennzeichen.
  const [inboundInfo, setInboundInfo] = useState<InboundLabelInfo | null>(null)
  const [inboundLoadState, setInboundLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [inboundReloadToken, setInboundReloadToken] = useState(0)
  const [labelBusy, setLabelBusy] = useState<string | null>(null)

  useEffect(() => {
    if (activeTab !== 'shipping') return
    let cancelled = false
    setInboundLoadState('loading')
    getBookingInboundLabel(booking._id)
      .then((view) => {
        if (cancelled) return
        setInboundInfo(view?.inbound || null)
        setInboundLoadState('ready')
      })
      .catch(() => {
        if (cancelled) return
        setInboundLoadState('error')
      })
    return () => { cancelled = true }
  }, [booking._id, activeTab, inboundReloadToken])

  // DHL-2: jeder Label-Download mit try/catch und deutscher Meldung (Helfer werfen deutsche Fehler).
  const runLabelAction = async (key: string, action: () => Promise<void>) => {
    if (labelBusy) return
    try {
      setLabelBusy(key)
      await action()
    } catch (error: any) {
      toast({
        title: 'Label konnte nicht geladen werden',
        description: error?.message || 'Bitte erneut versuchen.',
        variant: 'destructive'
      })
    } finally {
      setLabelBusy(null)
    }
  }

  const handleCreateInboundLabel = async () => {
    if (labelBusy) return
    try {
      setLabelBusy('create-inbound')
      const view = await createBookingInboundLabel(booking._id)
      setInboundInfo(view?.inbound || null)
      toast({
        title: view?.alreadyExists ? 'Einsendelabel war bereits vorhanden' : 'DHL-Einsendelabel erstellt',
        description: view?.inbound?.placeholder
          ? 'Hinweis: Testlabel (Dummy-Modus) – nicht für den Versand verwenden.'
          : (view?.inbound?.message || 'Das Einsendelabel steht zum Download bereit.')
      })
      refreshKeepOpen()
    } catch (error: any) {
      toast({
        title: 'Einsendelabel konnte nicht erstellt werden',
        description: error?.message || 'Bitte erneut versuchen.',
        variant: 'destructive'
      })
      setInboundReloadToken((value) => value + 1)
    } finally {
      setLabelBusy(null)
    }
  }

  // Abgleich nach unklarer DHL-Antwort beim Einsendelabel (nur Administratoren).
  const handleReconcileInbound = async (resolution: 'not-created' | 'created') => {
    if (reconcilingInbound) return
    try {
      setReconcilingInbound(true)
      await reconcileBookingInboundLabel(booking._id, { resolution, trackingNumber: reconcileTracking.trim() || undefined })
      setReconcileTracking('')
      toast({ title: 'Abgleich abgeschlossen', description: resolution === 'created' ? 'Die Sendungsnummer wurde übernommen.' : 'Das Einsendelabel kann neu erstellt werden.' })
      setInboundReloadToken((value) => value + 1)
      refreshKeepOpen()
    } catch (error: any) {
      toast({ title: 'Abgleich fehlgeschlagen', description: error?.message || 'Bitte erneut versuchen.', variant: 'destructive' })
    } finally {
      setReconcilingInbound(false)
    }
  }

  useEffect(() => {
    setActiveTab(initialTab || "overview")
  }, [booking._id, initialTab])

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
    // "Storniert" nur über den Storno-Dialog mit Pflichtgrund (gleiche Serverregel wie im Aktionsmenü).
    if (newStatus === 'cancelled') {
      setShowBookingCancelDialog(true)
      return
    }
    try {
      setUpdating(true)
      await updateBookingStatus(booking._id, newStatus as any, description)
      toast({
        title: "Erfolg",
        description: "Buchungsstatus aktualisiert"
      })
      setDescription("")
      onStatusUpdate()
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error?.message || "Status konnte nicht aktualisiert werden",
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
        title: "Erfolg",
        description: "Zahlungsstatus aktualisiert"
      })
      onStatusUpdate()
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Zahlungsstatus konnte nicht aktualisiert werden",
        variant: "destructive"
      })
    } finally {
      setUpdating(false)
    }
  }

  // Gemeinsame, NaN-sichere Formatierung (lib/utils formatEUR) statt einer lokalen Kopie.
  const formatCurrency = (value: unknown) => formatEUR(value)

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
      case 'draft':
        return 'bg-slate-100 text-slate-800'
      case 'sent':
        return 'bg-blue-100 text-blue-800'
      case 'viewed':
        return 'bg-indigo-100 text-indigo-800'
      case 'overdue':
        return 'bg-rose-100 text-rose-800'
      case 'partially_paid':
        return 'bg-orange-100 text-orange-800'
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
      case 'draft':
        return 'Vorlage'
      case 'sent':
        return 'Gesendet'
      case 'viewed':
        return 'Angesehen'
      case 'partially_paid':
        return 'Teilweise Bezahlt'
      case 'overdue':
        return 'Überfällig'
      case 'unpaid':
        return 'Offen'
      case 'partially-paid':
        return 'Teilbezahlt'
      case 'paid':
        return 'Bezahlt'
      default:
        return status
    }
  }

  // Der Verlaufseintrag speichert einen technischen Marker ('Shipping Label Created')
  // oder einen rohen Enum-Wert ('paid', 'cancelled'). Beides wird hier uebersetzt;
  // unbekannte Werte bleiben unveraendert, damit nichts verschluckt wird.
  const getTimelineStatusLabel = (status: string) => {
    const timelineLabels: Record<string, string> = {
      'Booking Created': 'Buchung angelegt',
      'Shipping Label Prepared': 'Versandlabel vorbereitet',
      'Shipping Label Created': 'Versandlabel erstellt',
      'Shipping Label Reconciliation Required': 'Abgleich des Versandlabels erforderlich',
      'Shipping Status Updated': 'Versandstatus aktualisiert',
      'Return Status Updated': 'Retourenstatus aktualisiert',
      'Order Status Updated': 'Auftragsstatus aktualisiert',
      'Status Updated': 'Status aktualisiert',
    }
    if (timelineLabels[status]) return timelineLabels[status]

    const bookingLabel = getBookingStatusLabel(status)
    if (bookingLabel !== status) return bookingLabel

    return getBillingStatusLabel(status)
  }

  const effectivePaymentStatus = (() => {
    const invoiceStatuses = ['draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue']
    const candidate = String(booking.paymentStatus || '')
    return invoiceStatuses.includes(candidate) ? candidate : booking.billingStatus
  })()

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
      case 'ready-for-pickup': return 'Reparatur abgeschlossen'
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

  // Ein reiner Statustext (z. B. "Einsendelabel konnte nicht automatisch erstellt werden" nach
  // einem fehlgeschlagenen Automatiklauf) ist KEIN Label - der Fehler steht in der Einsendung-Karte
  // (lastError) und der Block "DHL-Einsendelabel" bliebe sonst leer.
  const hasOutboundShippingInfo = Boolean(
    booking.trackingNumber ||
    booking.shippingLabelUrl ||
    booking.shippingCreatedAt ||
    booking.estimatedDelivery ||
    booking.actualDelivery ||
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

  // booking.trackingNumber ist das EINSENDELABEL der Buchung (Kunde -> McRepair). Nur
  // Altbestand kann dort ein frueher an der Buchung erzeugtes Rueckweg-Label tragen; die
  // Richtung liefert der Server aus dem Verlaufseintrag (Vorgabe: Einsendung). Die
  // Variablennamen 'outbound*' sind historisch und bezeichnen diesen Buchungs-Block.
  // Die Auslieferung (McRepair -> Kunde) liegt je Auftrag und wird separat angezeigt.
  const isOutboundShippingLabel = booking.shippingLabelDirection === 'outbound'
  // DHL-3: Existiert bereits ein Einsendelabel (Buchungsplatz, Kunde -> McRepair) oder laeuft die
  // Erstellung, wird KEINE DHL-Retoure angeboten - der Server lehnt sie mit 409 ab und ein zweites
  // Label waere doppelt bezahlt. Ausnahme: der Buchungsplatz traegt ein altes Rueckweg-Label.
  const inboundLabelExists = Boolean(
    booking.shippingLabelCreationInProgress ||
    (!isOutboundShippingLabel && (booking.trackingNumber || booking.shippingLabelUrl)) ||
    (inboundInfo && ['ready', 'registered', 'creating', 'review'].includes(inboundInfo.state))
  )
  const canOfferRetoure = !hasReturnShippingInfo && !inboundLabelExists
  // DHL-6: Standard ist das DHL-Einsendelabel (Parcel DE, Karte "Einsendung" oben). Die DHL-Retoure
  // wird in BEIDEN Zweigen gleich und nur als nachrangige Alternative (outline) angeboten.
  const retoureIsAlternative = Boolean(inboundInfo?.canCreate)
  const retoureOffer = canOfferRetoure ? (
    <div className="rounded-md border bg-white p-3 text-sm space-y-2" style={{ color: 'var(--gray-600, #4a5568)' }}>
      <p>
        {retoureIsAlternative
          ? 'Standard ist das DHL-Einsendelabel (oben unter „Einsendung“). Nur wenn das nicht möglich ist, kann stattdessen eine DHL-Retoure (Kunde → McRepair) erstellt werden – nie beides.'
          : 'Für diese Buchung ist noch kein Einsendelabel (Kunde → McRepair) vorhanden. Sie können eine DHL-Retoure (Kunde → McRepair) erstellen.'}
      </p>
      <Button variant="outline" size="sm" onClick={() => setShowReturnLabelDialog(true)}>
        <Truck className="h-4 w-4 mr-2" aria-hidden="true" />
        {retoureIsAlternative ? 'Alternative: DHL-Retoure erstellen (Kunde → McRepair)' : 'DHL-Retoure erstellen (Kunde → McRepair)'}
      </Button>
    </div>
  ) : null
  const inboundIsPlaceholder = Boolean(inboundInfo?.placeholder || booking.inboundLabelPlaceholder || String(booking.trackingNumber || '').startsWith('DHL-DUMMY-'))
  const inboundFileReference = booking.bookingNumber || booking._id
  const outboundShippingTitle = isOutboundShippingLabel
    ? 'Rückweg-Label an den Kunden (McRepair → Kunde, Altbestand)'
    : 'DHL-Einsendelabel (Kunde → McRepair)'
  const outboundShippingHistoryTitle = isOutboundShippingLabel
    ? 'Versandverlauf (McRepair → Kunde)'
    : 'Versandverlauf (Kunde → McRepair)'
  const outboundShippingHint = isOutboundShippingLabel
    ? 'Sendung von McRepair an den Kunden (älteres Buchungslabel)'
    : 'Sendung des Kunden an McRepair'
  const repairJobs = (detailOrders.length > 0 ? detailOrders : booking.items || []).filter((item: any) => item.type === 'repair')

  const bookingItemsForFinance = Array.isArray(booking.items) ? booking.items : []
  const detailedFinanceOrders = Array.isArray(detailOrders) && detailOrders.length > 0
    ? detailOrders.filter((item: any) => item && typeof item.cost === 'number')
    : bookingItemsForFinance

  const financialAdjustments = detailedFinanceOrders
    .map((item: any) => {
      const baselineCostRaw =
        item.bookingItemCost !== undefined && item.bookingItemCost !== null
          ? Number(item.bookingItemCost)
          : Number(item.cost || 0)
      const currentCost = Number(item.cost || 0)
      const baselineCost = Number.isFinite(baselineCostRaw) ? baselineCostRaw : 0
      const delta = currentCost - baselineCost

      return {
        orderId: String(item.orderId || item._id || ''),
        orderNumber: item.orderNumber || String(item.orderId || item._id || '').slice(-8).toUpperCase(),
        label: item.device || item.type || 'Order',
        baselineCost,
        currentCost,
        delta,
        hasDeviceChangeHistory: Boolean(item.hasDeviceChangeHistory),
      }
    })
    .filter((entry) => Math.abs(entry.delta) > 0.009)

  const baselineTotalFromOrders = detailedFinanceOrders.reduce((sum: number, item: any) => {
    const value = item.bookingItemCost !== undefined && item.bookingItemCost !== null
      ? Number(item.bookingItemCost)
      : Number(item.cost || 0)
    return sum + (Number.isFinite(value) ? value : 0)
  }, 0)

  const currentTotalFromOrders = detailedFinanceOrders.reduce((sum: number, item: any) => {
    const value = Number(item.cost || 0)
    return sum + (Number.isFinite(value) ? value : 0)
  }, 0)

  const financeBaselineTotal = detailedFinanceOrders.length > 0 ? baselineTotalFromOrders : Number(booking.totalCost || 0)
  const financeCurrentTotal = detailedFinanceOrders.length > 0 ? currentTotalFromOrders : Number(booking.totalCost || 0)
  const financeDeltaTotal = financeCurrentTotal - financeBaselineTotal
  const financeCreditAmount = financeDeltaTotal < 0 ? Math.abs(financeDeltaTotal) : 0
  const financeOutstandingAmount = financeDeltaTotal > 0 ? financeDeltaTotal : 0
  const deviceChangeRelatedCount = financialAdjustments.filter((entry) => entry.hasDeviceChangeHistory).length

  const financeBillingStatusConfig = (() => {
    switch (booking.billingStatus) {
      case 'paid':
        return {
          label: 'Bezahlt',
          border: '#86efac',
          background: '#ecfdf5',
          text: '#065f46',
          creditHint: 'Als Rückzahlung oder Kundenguthaben verbuchen.',
          outstandingHint: 'Als Nachbelastung nach bereits erfolgter Zahlung ausweisen.'
        }
      case 'partially-paid':
        return {
          label: 'Teilbezahlt',
          border: '#fdba74',
          background: '#fff7ed',
          text: '#9a3412',
          creditHint: 'Mit dem offenen Restbetrag verrechnen.',
          outstandingHint: 'Zum verbleibenden Restbetrag addieren.'
        }
      case 'unpaid':
        return {
          label: 'Offen',
          border: '#fcd34d',
          background: '#fffbeb',
          text: '#92400e',
          creditHint: 'Reduziert den noch offenen Rechnungsbetrag.',
          outstandingHint: 'Erhöht den bei Abrechnung fälligen Betrag.'
        }
      default:
        return {
          label: 'Unbekannt',
          border: '#d1d5db',
          background: '#f9fafb',
          text: '#374151',
          creditHint: 'Als Gutschrift in der Buchhaltung prüfen.',
          outstandingHint: 'Als offenen Teilbetrag in der Buchhaltung prüfen.'
        }
    }
  })()

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
          color: '#f5c800',
          marginBottom: '2px',
          letterSpacing: '-0.5px'
        }}>
          Buchungsdetails
        </DialogTitle>
        <DialogDescription style={{ 
          fontSize: '0.78rem', 
          color: '#c8d0e7',
          fontWeight: '500'
        }}>
          Buchung {booking.bookingNumber || `#${booking._id.slice(-8).toUpperCase()}`} · {customerDisplayName}
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
            Übersicht
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
            {t('bookings.timeline')}
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
            <div className="flex items-center gap-2" style={{ background: 'linear-gradient(180deg, #1a2a5e 0%, #0f1d45 100%)', padding: '10px 16px', borderRadius: '16px 16px 0 0', margin: '-20px -20px 16px -20px', borderBottom: '1px solid #0f1d45' }}>
              <div style={{ background: 'rgba(245,200,0,0.18)', borderRadius: '8px', padding: '6px' }}>
                <User className="h-4 w-4" style={{ color: '#f5c800' }} />
              </div>
              <h3 style={{ color: '#f5c800', fontSize: '1rem', fontWeight: '700' }}>
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
                const firstOrder = Array.isArray(booking.orderIds)
                  ? booking.orderIds.find((order) => order && typeof order === 'object')
                  : undefined
                const addr = booking.customerId?.invoiceAddress
                  || booking.billingAddress
                  || booking.guestInfo?.billingAddress
                  || firstOrder?.billingAddress
                  || firstOrder?.guestInfo?.billingAddress
                const hasAddr = hasAddressData(addr)
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
                        {(addr!.zipCode || addr!.zip || addr!.city) && (
                          <p>{[addr!.zipCode || addr!.zip, addr!.city].filter(Boolean).join(' ')}</p>
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
                const firstOrder = Array.isArray(booking.orderIds)
                  ? booking.orderIds.find((order) => order && typeof order === 'object')
                  : undefined
                const billingAddr = booking.customerId?.invoiceAddress
                  || booking.billingAddress
                  || booking.guestInfo?.billingAddress
                  || firstOrder?.billingAddress
                  || firstOrder?.guestInfo?.billingAddress
                const customerPaymentAddr = booking.customerId?.paymentAddress
                const deliveryAddr = customerPaymentAddr?.sameAsInvoice === false
                  ? customerPaymentAddr
                  : booking.shippingAddress
                    || booking.guestInfo?.shippingAddress
                    || firstOrder?.shippingAddress
                    || firstOrder?.guestInfo?.shippingAddress
                const hasAddr = hasAddressData(deliveryAddr)
                const sameAsBilling = customerPaymentAddr?.sameAsInvoice !== false && !hasAddressData(deliveryAddr)

                return (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Home className="h-3.5 w-3.5" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--gray-500, #636e85)' }}>
                        Lieferadresse
                      </p>
                    </div>
                    {sameAsBilling && hasAddressData(billingAddr) ? (
                      <p className="text-sm italic" style={{ color: 'var(--gray-400, #8892a8)' }}>Identisch mit Rechnungsadresse</p>
                    ) : hasAddr ? (
                      <div className="space-y-0.5 text-sm" style={{ color: 'var(--gray-700, #2d3748)' }}>
                        {deliveryAddr!.street && <p>{deliveryAddr!.street}</p>}
                        {(deliveryAddr!.zipCode || deliveryAddr!.zip || deliveryAddr!.city) && (
                          <p>{[deliveryAddr!.zipCode || deliveryAddr!.zip, deliveryAddr!.city].filter(Boolean).join(' ')}</p>
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
              <div className="flex items-center gap-2" style={{ background: 'linear-gradient(180deg, #1a2a5e 0%, #0f1d45 100%)', padding: '10px 16px', borderRadius: '16px 16px 0 0', margin: '-20px -20px 16px -20px', borderBottom: '1px solid #0f1d45' }}>
                <div style={{ background: 'rgba(245,200,0,0.18)', borderRadius: '8px', padding: '6px' }}>
                  <Activity className="h-4 w-4" style={{ color: '#f5c800' }} />
                </div>
                <h3 style={{ color: '#f5c800', fontSize: '1rem', fontWeight: '700' }}>
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
                  <Badge className={getBillingStatusColor(effectivePaymentStatus)}>{getBillingStatusLabel(effectivePaymentStatus)}</Badge>
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
              <div className="flex items-center gap-2" style={{ background: 'linear-gradient(180deg, #1a2a5e 0%, #0f1d45 100%)', padding: '10px 16px', borderRadius: '16px 16px 0 0', margin: '-20px -20px 16px -20px', borderBottom: '1px solid #0f1d45' }}>
                <div style={{ background: 'rgba(245,200,0,0.18)', borderRadius: '8px', padding: '6px' }}>
                  <DollarSign className="h-4 w-4" style={{ color: '#f5c800' }} />
                </div>
                <h3 style={{ color: '#f5c800', fontSize: '1rem', fontWeight: '700' }}>
                  Finanzen
                </h3>
              </div>
              <div className="space-y-2">
                {/*
                  Alle gespeicherten Preise (Auftrag, Buchung) sind Bruttobeträge (MwSt. inklusive).
                  "MwSt." ist daher im Gesamtbetrag bereits ENTHALTEN und darf nicht addiert werden.
                  Reihenfolge: Zwischensumme (Brutto, vor Rabatt) -> Rabatt -> Nettobetrag -> davon MwSt. -> Gesamtbetrag (Brutto).
                */}
                {booking.subtotal !== undefined && booking.subtotal !== booking.totalCost && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--gray-500, #636e85)' }}>Zwischensumme (Brutto, vor Rabatt)</span>
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
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: 'var(--gray-500, #636e85)' }}>Nettobetrag</span>
                      <span style={{ color: 'var(--gray-700, #2d3748)', fontWeight: '500' }}>{formatCurrency(Math.max(0, (booking.totalCost || 0) - booking.tax))}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: 'var(--gray-500, #636e85)' }}>davon MwSt. (im Gesamtbetrag enthalten)</span>
                      <span style={{ color: 'var(--gray-700, #2d3748)', fontWeight: '500' }}>{formatCurrency(booking.tax)}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between pt-2" style={{ borderTop: '2px solid var(--gray-200, #d8dce6)' }}>
                  <span className="font-semibold text-sm" style={{ color: 'var(--gray-700, #2d3748)' }}>Gesamtbetrag (Brutto)</span>
                  <span className="font-bold text-lg" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>{formatCurrency(booking.totalCost)}</span>
                </div>
                {booking.finalCost !== undefined && booking.finalCost !== booking.totalCost && (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm" style={{ color: 'var(--gray-700, #2d3748)' }} title="Gespeicherter Endbetrag aus älteren Daten – maßgeblich ist der Gesamtbetrag oben">Endbetrag (Altdaten)</span>
                    <span className="font-bold text-lg" style={{ color: 'var(--success, #38a169)' }}>{formatCurrency(booking.finalCost)}</span>
                  </div>
                )}

                {financialAdjustments.length > 0 && (
                  <div
                    className="mt-3 pt-3 space-y-2"
                    style={{ borderTop: '1px dashed var(--gray-200, #d8dce6)' }}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--gray-500, #636e85)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Änderungen seit Buchung
                      </span>
                      <span style={{ color: 'var(--gray-500, #636e85)' }}>
                        {financialAdjustments.length} Position(en)
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                      {financialAdjustments.map((entry) => (
                        <div key={`${entry.orderId}-${entry.orderNumber}`} className="flex items-start justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold truncate" style={{ color: 'var(--gray-700, #2d3748)' }}>
                              #{entry.orderNumber} - {entry.label}
                            </p>
                            <p style={{ color: 'var(--gray-500, #636e85)' }}>
                              {formatCurrency(entry.baselineCost)} {'->'} {formatCurrency(entry.currentCost)}
                              {entry.hasDeviceChangeHistory ? ' • Geräte-/Servicewechsel' : ''}
                            </p>
                          </div>
                          <span
                            className="font-semibold shrink-0"
                            style={{ color: entry.delta > 0 ? '#b45309' : '#047857' }}
                          >
                            {entry.delta > 0 ? '+' : '-'}{formatCurrency(Math.abs(entry.delta))}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-md px-2.5 py-2 text-xs" style={{ background: 'var(--off-white, #f8f9fc)', border: '1px solid var(--gray-200, #d8dce6)' }}>
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--gray-500, #636e85)' }}>Ursprünglicher Buchungswert</span>
                        <span className="font-semibold" style={{ color: 'var(--gray-700, #2d3748)' }}>{formatCurrency(financeBaselineTotal)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span style={{ color: 'var(--gray-500, #636e85)' }}>Aktueller Auftragswert</span>
                        <span className="font-semibold" style={{ color: 'var(--gray-700, #2d3748)' }}>{formatCurrency(financeCurrentTotal)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 pt-1.5" style={{ borderTop: '1px solid var(--gray-200, #d8dce6)' }}>
                        <span className="font-semibold" style={{ color: 'var(--gray-700, #2d3748)' }}>Saldo Änderung</span>
                        <span className="font-bold" style={{ color: financeDeltaTotal > 0 ? '#b45309' : financeDeltaTotal < 0 ? '#047857' : 'var(--gray-700, #2d3748)' }}>
                          {financeDeltaTotal > 0 ? '+' : financeDeltaTotal < 0 ? '-' : ''}{formatCurrency(Math.abs(financeDeltaTotal))}
                        </span>
                      </div>
                    </div>

                    {(financeCreditAmount > 0 || financeOutstandingAmount > 0) && (
                      <div className="rounded-md px-2.5 py-2 text-xs" style={{
                        border: `1px solid ${financeBillingStatusConfig.border}`,
                        background: financeBillingStatusConfig.background
                      }}>
                        <p className="mb-1" style={{ color: '#6b7280', fontWeight: 600 }}>
                          Zahlungsstatus-Logik: {financeBillingStatusConfig.label}
                        </p>
                        {financeCreditAmount > 0 ? (
                          <p style={{ color: financeBillingStatusConfig.text, fontWeight: 600 }}>
                            Gutschrift ersichtlich: {formatCurrency(financeCreditAmount)}
                            {' '}{financeBillingStatusConfig.creditHint}
                          </p>
                        ) : (
                          <p style={{ color: financeBillingStatusConfig.text, fontWeight: 600 }}>
                            Ausstehender Teilbetrag ersichtlich: {formatCurrency(financeOutstandingAmount)}
                            {' '}{financeBillingStatusConfig.outstandingHint}
                          </p>
                        )}
                        {deviceChangeRelatedCount > 0 && (
                          <p className="mt-1" style={{ color: '#6b7280' }}>
                            Davon betreffen {deviceChangeRelatedCount} Position(en) dokumentierte Gerätewechsel.
                          </p>
                        )}
                      </div>
                    )}
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
                  {newStatus !== 'cancelled' && <Textarea
                    placeholder="Beschreibung hinzufügen (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-2"
                    rows={2}
                    style={{
                      border: '1px solid var(--gray-200, #d8dce6)',
                      borderRadius: 'var(--radius-sm, 6px)',
                      fontSize: '0.9rem'
                    }}
                  />}
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
                    {newStatus === 'cancelled' ? 'Buchung stornieren …' : 'Status aktualisieren'}
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
                  <SelectItem value="unpaid">Offen</SelectItem>
                  <SelectItem value="partially-paid">Teilbezahlt</SelectItem>
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
                  <div className="flex items-center justify-between" style={{ background: 'linear-gradient(180deg, #1a2a5e 0%, #0f1d45 100%)', padding: '10px 16px', borderRadius: '16px 16px 0 0', margin: '-20px -20px 16px -20px', borderBottom: '1px solid #0f1d45' }}>
                    <h4 className="font-semibold" style={{ color: '#f5c800', fontSize: '1.1rem', fontWeight: '700' }}>
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
          {/* Einsendung (Kunde -> McRepair) laut DHL-Lesemodell - getrennt von der Auslieferung */}
          {inboundIsPlaceholder && (
            <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900" role="status">
              <p className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Testmodus – Dummy-Label (kein echtes DHL-Label)
              </p>
              <p className="text-xs mt-1">
                Dieses Einsendelabel ist ein Testlabel und darf nicht für den Versand verwendet werden. Umschalten unter Systemkonfiguration → Integrationen → DHL → Buchungslabel-Modus „Live“.
              </p>
            </div>
          )}
          <div className="rounded-lg border bg-white p-4 space-y-2" style={{ borderLeft: '4px solid var(--primary-blue, #1a2a5e)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-base flex items-center gap-2" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                <Package className="h-4 w-4" aria-hidden="true" />
                Einsendung (Kunde → McRepair)
              </h3>
              <div className="flex flex-wrap gap-1">
                {inboundIsPlaceholder && (
                  <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-800">Testlabel</Badge>
                )}
                {inboundInfo?.deviceReceived && (
                  <Badge className="bg-green-100 text-green-800">Gerät eingegangen</Badge>
                )}
              </div>
            </div>
            {inboundLoadState === 'loading' && <p className="text-sm text-muted-foreground">Einsendestatus wird geladen …</p>}
            {inboundLoadState === 'error' && (
              <div className="flex flex-wrap items-center gap-2 text-sm" role="alert">
                <span className="text-destructive">Der Einsendestatus konnte nicht geladen werden.</span>
                <Button size="sm" variant="outline" onClick={() => setInboundReloadToken((value) => value + 1)}>Erneut versuchen</Button>
              </div>
            )}
            {inboundLoadState === 'ready' && inboundInfo && (
              <>
                <p className="text-sm" style={{ color: 'var(--gray-700, #2d3748)' }}>{inboundInfo.message}</p>
                {inboundInfo.trackingNumber && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Sendungsnummer </span>
                    <span className="font-mono font-semibold">{inboundInfo.trackingNumber}</span>
                    {inboundInfo.source === 'booking-retoure' ? ' · DHL-Retoure' : ''}
                  </p>
                )}
                {inboundInfo.lastError && (
                  <p className="text-xs text-red-700">Letzter Fehler: {inboundInfo.lastError}</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {inboundInfo.state === 'ready' && inboundInfo.downloadUrl && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={labelBusy !== null}
                        className="border-slate-300 text-[#1a2a5e]"
                        onClick={() => void runLabelAction('inbound-download', () => downloadInboundLabel(inboundInfo))}
                      >
                        <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                        {inboundIsPlaceholder ? 'Testlabel herunterladen' : 'Einsendelabel herunterladen'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={labelBusy !== null}
                        className="border-slate-300 text-[#1a2a5e]"
                        onClick={() => void runLabelAction('inbound-print', () => printInboundLabel(inboundInfo))}
                      >
                        <Printer className="h-4 w-4 mr-2" aria-hidden="true" />
                        Drucken
                      </Button>
                    </>
                  )}
                  {inboundInfo.canCreate && !inboundLabelExists && (
                    <Button size="sm" disabled={labelBusy !== null} onClick={() => void handleCreateInboundLabel()}>
                      <Truck className="h-4 w-4 mr-2" aria-hidden="true" />
                      {labelBusy === 'create-inbound' ? 'Wird erstellt …' : 'DHL-Einsendelabel erstellen'}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          {booking.shippingLabelCreationInProgress && (
            <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Einsendelabel: Ergebnis der DHL-Labelerstellung unklar oder Erstellung läuft
              </p>
              <p className="text-xs text-amber-900 dark:text-amber-200">
                Bitte im DHL-Geschäftskundenportal prüfen, ob die Sendung angelegt wurde, bevor erneut ein Label erstellt wird – sonst entsteht ein zweites, bezahltes Label.
              </p>
              {currentUser?.role === 'admin' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={reconcileTracking}
                    onChange={(event) => setReconcileTracking(event.target.value)}
                    placeholder="Sendungsnummer aus dem DHL-Portal"
                    className="h-8 w-56 text-xs"
                  />
                  <Button size="sm" variant="outline" disabled={reconcilingInbound} onClick={() => void handleReconcileInbound('created')}>
                    Sendung existiert – übernehmen
                  </Button>
                  <Button size="sm" variant="outline" disabled={reconcilingInbound} onClick={() => void handleReconcileInbound('not-created')}>
                    Bei DHL nicht angelegt
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-amber-900 dark:text-amber-200">Den Abgleich schließt ein Administrator ab.</p>
              )}
            </div>
          )}
          {/* Auslieferung (McRepair -> Kunde) je Gerät - getrennt vom Einsendelabel der Buchung.
              Ein fertiges Gerät wird einzeln versendet und markiert die anderen nicht mit. */}
          {repairJobs.length > 0 && (
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
              <h3 className="font-semibold text-base flex items-center gap-2 mb-1" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                <Truck className="h-4 w-4" />
                Auslieferung an den Kunden (McRepair → Kunde)
              </h3>
              <p className="text-xs mb-3" style={{ color: 'var(--gray-500, #636e85)' }}>
                Wird je Auftrag über „An Kunden versenden“ erstellt. Ein erstelltes Label bedeutet noch nicht, dass das Paket an DHL übergeben wurde.
              </p>
              <div className="space-y-2">
                {repairJobs.map((job: any, index: number) => (
                  <div key={job.orderId || job._id || index} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                    <span className="font-medium">{job.orderNumber || job.device || 'Auftrag'}</span>
                    {job.outboundShipment ? (
                      <span>
                        Sendungsnummer <span className="font-mono">{job.outboundShipment.trackingNumber}</span>
                        {job.outboundShipment.status ? ` · ${getShippingStatusLabel(job.outboundShipment.status)}` : ''}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--gray-500, #636e85)' }}>Noch kein Versandlabel</span>
                    )}
                    {job.orderId && (
                      <Button size="sm" variant="outline" onClick={() => navigate(`/orders/${job.orderId}`)}>
                        Zum Auftrag
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
                  <div className="flex items-center justify-between" style={{ background: 'linear-gradient(180deg, #1a2a5e 0%, #0f1d45 100%)', padding: '12px 18px', borderRadius: '16px 16px 0 0', margin: '-24px -24px 16px -24px', borderBottom: '1px solid #0f1d45' }}>
                    <h3
                      className="font-semibold text-lg flex items-center gap-2"
                      style={{ color: '#f5c800', fontWeight: '700' }}
                    >
                      <Truck className="h-5 w-5" style={{ color: '#f5c800' }} />
                      {outboundShippingTitle}
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
                            <p className="text-xs mt-1" style={{ color: 'var(--gray-400, #8892a8)' }}>
                              {outboundShippingHint}
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
                            <p className="text-sm mb-2" style={{ color: 'var(--gray-500, #636e85)', fontWeight: '600' }}>
                              {isOutboundShippingLabel ? 'Versandlabel an Kunden (PDF)' : 'DHL-Einsendelabel (PDF)'}
                              {inboundIsPlaceholder && !isOutboundShippingLabel ? ' – Testlabel' : ''}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={labelBusy !== null}
                              onClick={() => void runLabelAction('booking-shipping-label', () => downloadBookingShippingLabel(
                                booking._id,
                                labelFilename(isOutboundShippingLabel ? 'outbound' : 'inbound', inboundFileReference, inboundIsPlaceholder && !isOutboundShippingLabel)
                              ))}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              {isOutboundShippingLabel ? 'Versandlabel herunterladen' : (inboundIsPlaceholder ? 'Testlabel herunterladen' : 'Einsendelabel herunterladen')}
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
                            <p className="text-sm mb-2" style={{ color: 'var(--gray-500, #636e85)', fontWeight: '600' }}>{outboundShippingHistoryTitle}</p>
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

              {!hasReturnShippingInfo && inboundLabelExists && (
                <p className="text-xs rounded-md border bg-white p-3" style={{ color: 'var(--gray-600, #4a5568)' }}>
                  Keine DHL-Retoure nötig: Für diese Buchung existiert bereits ein DHL-Einsendelabel (Kunde → McRepair). Ein zweites Label würde doppelt berechnet und wird vom Server abgelehnt.
                </p>
              )}

              {/* DHL-Retoure: der KUNDE ist Absender, McRepair Empfänger - also eine Einsendung,
                  kein Versand an den Kunden. Nur anbieten, solange weder Retoure noch Einsendelabel
                  existiert (DHL-3); gleiche Darstellung wie im leeren Zweig. */}
              {retoureOffer}

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
                  <div className="flex items-center justify-between" style={{ background: 'linear-gradient(180deg, #1a2a5e 0%, #0f1d45 100%)', padding: '12px 18px', borderRadius: '16px 16px 0 0', margin: '-24px -24px 16px -24px', borderBottom: '1px solid #0f1d45' }}>
                    <h3
                      className="font-semibold text-lg flex items-center gap-2"
                      style={{ color: '#f5c800', fontWeight: '700' }}
                    >
                      <Truck className="h-5 w-5" style={{ color: '#f5c800' }} />
                      DHL-Retoure (Kunde → McRepair)
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
                              Nutze diese Nummer, um die Einsendung des Kunden (DHL-Retoure, Kunde → McRepair) bei DHL zu verfolgen
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
                            <p className="text-sm mb-2" style={{ color: 'var(--gray-500, #636e85)', fontWeight: '600' }}>Retouren-Label (PDF, Kunde → McRepair)</p>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={labelBusy !== null}
                              onClick={() => void runLabelAction('booking-return-label', () => downloadBookingReturnLabel(
                                booking._id,
                                labelFilename('inbound', inboundFileReference, String(booking.returnTrackingNumber || '').startsWith('DHL-DUMMY-'))
                              ))}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Retouren-Label herunterladen
                            </Button>
                            <p className="text-xs text-foreground/50 mt-2">
                              Der Kunde druckt dieses Label aus und bringt es am Paket an McRepair an
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
                            <p className="text-sm text-foreground/60 mb-2">QR-Code für label-freie Einsendung (DHL-Retoure)</p>
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
                              Diesen QR-Code in einer DHL-Filiale für die label-freie Einsendung an McRepair vorzeigen
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
                            <p className="text-sm mb-2" style={{ color: 'var(--gray-500, #636e85)', fontWeight: '600' }}>Sendungsverlauf der Retoure (Kunde → McRepair)</p>
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
                  <h4 className="font-semibold" style={{ background: 'linear-gradient(180deg, #1a2a5e 0%, #0f1d45 100%)', color: '#f5c800', fontSize: '1.05rem', padding: '10px 16px', borderRadius: '16px 16px 0 0', margin: '-20px -20px 12px -20px', borderBottom: '1px solid #0f1d45', fontWeight: 700 }}>Hinweise für den Kunden (Einsendung per DHL-Retoure)</h4>
                  <ol className="list-decimal list-inside space-y-1" style={{ color: 'var(--gray-600, #4a5568)', fontSize: '0.9rem' }}>
                    <li>Retouren-Label ausdrucken oder den QR-Code am Handy speichern</li>
                    <li>Artikel sicher in einem geeigneten Karton verpacken</li>
                    <li>Label aufkleben oder den QR-Code in einer DHL-Filiale vorzeigen</li>
                    <li>Paket bei DHL abgeben oder eine Abholung vereinbaren</li>
                    <li>Einsendung mit der oben stehenden Nummer verfolgen</li>
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
              <p style={{ color: 'var(--gray-600, #4a5568)' }}>Für diese Buchung ist noch kein Einsendelabel (Kunde → McRepair) vorhanden</p>
              <p className="text-sm mt-2" style={{ color: 'var(--gray-500, #636e85)' }}>Einsendelabel und DHL-Retoure erscheinen hier, sobald sie erstellt wurden</p>
              {canOfferRetoure ? (
                <div className="mt-4 text-left">{retoureOffer}</div>
              ) : (
                <p className="text-xs mt-3" style={{ color: 'var(--gray-500, #636e85)' }}>
                  Eine DHL-Retoure wird nicht angeboten, solange die Erstellung des Einsendelabels läuft oder ein Einsendelabel existiert.
                </p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4 mt-4">
          <InvoicesTabContent
            booking={booking}
            navigate={navigate}
            highlightStatus={activeTab === 'invoices' ? invoiceStatusFocus : null}
          />
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
                      {getTimelineStatusLabel(event.status)}
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
              <p style={{ color: 'var(--gray-400, #8892a8)' }}>Keine Verlaufseinträge</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <BookingCancelDialog
        open={showBookingCancelDialog}
        onOpenChange={setShowBookingCancelDialog}
        bookingId={booking._id}
        bookingNumber={booking.bookingNumber}
        onCancelled={() => {
          setDescription("")
          onStatusUpdate()
        }}
      />

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
function InvoicesTabContent({ booking, navigate, highlightStatus }: { booking: Booking; navigate: any; highlightStatus?: string | null }) {
  const customer = getSafeBookingCustomer(booking)
  const customerDisplayName = getCustomerDisplayName(customer)
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [highlightedInvoiceId, setHighlightedInvoiceId] = useState<string | null>(null)
  const [showPaymentsDialog, setShowPaymentsDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadInvoices()
  }, [booking._id])

  const loadInvoices = async () => {
    try {
      setLoading(true)
      // Zahlungsstand je Beleg aus der Zahlungsübersicht der Buchung (dieselbe
      // Serverberechnung wie im Zahlungen-Dialog). Scheitert sie, bleiben die Belege
      // ohne Zahlungsstand sichtbar - es wird kein Betrag erfunden.
      const [response, paymentOverview] = await Promise.all([
        getBookingInvoices(booking._id),
        getBookingPayments(booking._id).catch((error) => {
          console.error('Error loading booking payment overview:', error)
          return null
        }),
      ])
      const balanceById = new Map<string, any>(
        (Array.isArray((paymentOverview as any)?.invoices) ? (paymentOverview as any).invoices : [])
          .map((entry: any) => [String(entry._id), entry])
      )
      setInvoices((response.invoices || []).map((invoice: any) => {
        const entry = balanceById.get(String(invoice._id))
        return entry ? { ...invoice, paymentOverview: entry } : invoice
      }))
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

  useEffect(() => {
    if (!highlightStatus || invoices.length === 0) {
      return
    }

    const normalizedStatus = String(highlightStatus)
    const statusCandidates = (() => {
      switch (normalizedStatus) {
        case 'unpaid':
          return ['draft', 'sent', 'viewed', 'overdue', 'pending']
        case 'partially-paid':
          return ['partially_paid']
        case 'paid':
          return ['paid']
        default:
          return [normalizedStatus]
      }
    })()

    const targetInvoice = invoices.find((invoice) => statusCandidates.includes(String(invoice.status)))
    if (!targetInvoice?._id) {
      return
    }

    setHighlightedInvoiceId(targetInvoice._id)

    const timer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(`[data-invoice-id="${targetInvoice._id}"]`)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 40)

    const clearTimer = window.setTimeout(() => {
      setHighlightedInvoiceId(null)
    }, 4500)

    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(clearTimer)
    }
  }, [highlightStatus, invoices])

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

  // Gemeinsame, NaN-sichere Formatierung (lib/utils formatEUR) statt einer lokalen Kopie.
  const formatCurrency = (value: unknown) => formatEUR(value)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Belegstatus (Lebenslauf des Dokuments) - nie den rohen englischen Wert anzeigen.
  const getInvoiceStatusLabel = (status?: string) => {
    const labels: Record<string, string> = {
      draft: 'Entwurf',
      pending_approval: 'Freigabe ausstehend',
      sent: 'Versendet',
      viewed: 'Gesehen',
      partially_paid: 'Teilbezahlt',
      paid: 'Bezahlt',
      overdue: 'Überfällig',
      cancelled: 'Storniert',
      credited: 'Gutgeschrieben',
      pending: 'Ausstehend',
    }
    return labels[String(status || '')] || 'Unbekannt'
  }

  // Zahlungsstand (getrennt vom Belegstatus) aus der Serverberechnung.
  const getInvoicePaymentInfo = (invoice: any): { label: string; className: string } | null => {
    const entry = invoice?.paymentOverview
    if (!entry || invoice?.isCreditNote) return null
    const refundPending = Number(entry.refundPending ?? entry.overpaidAmount ?? 0)
    const open = Number(entry.openAmount ?? 0)
    const state = String(entry.paymentState || '')
    if (state === 'overpaid' || refundPending > 0.009) {
      return { label: `Überzahlt · Erstattung offen ${formatCurrency(refundPending)}`, className: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200' }
    }
    if (state === 'paid') return { label: 'Bezahlt', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' }
    if (state === 'credited') return { label: 'Gutgeschrieben', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' }
    if (state === 'partially_paid') return { label: `Teilbezahlt · offen ${formatCurrency(open)}`, className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' }
    return { label: `Offen ${formatCurrency(open)}`, className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' }
  }

  const paymentsHeader = (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">Rechnungen</h3>
      <Button variant="outline" size="sm" onClick={() => setShowPaymentsDialog(true)}>
        <CreditCard className="h-4 w-4 mr-2" />
        Zahlungen
      </Button>
    </div>
  )

  const paymentsDialog = (
    <BookingPaymentsDialog
      bookingId={booking._id}
      bookingNumber={booking.bookingNumber}
      open={showPaymentsDialog}
      onOpenChange={setShowPaymentsDialog}
      onChanged={loadInvoices}
    />
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (invoices.length === 0) {
    return (
      <div className="space-y-3">
        {paymentsHeader}
        <div className="text-center py-8">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="text-foreground/60">Für diese Buchung wurden noch keine Rechnungen erstellt</p>
        </div>
        {paymentsDialog}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {paymentsHeader}
        {invoices.map((invoice) => (
          <div
            key={invoice._id}
            data-invoice-id={invoice._id}
            className={`border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer ${highlightedInvoiceId === invoice._id ? 'invoice-card-highlight' : ''}`}
            onClick={() => navigate(`/admin/financial?tab=overview&highlightInvoiceId=${invoice._id}`)}
            title="Zur Finanzverwaltung und dieser Rechnung wechseln"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h4 className="font-semibold">{invoice.isCreditNote ? 'Gutschrift' : 'Rechnung'} #{invoice.invoiceNumber}</h4>
                  <Badge className={getInvoiceStatusColor(invoice.status)}>
                    {getInvoiceStatusLabel(invoice.status)}
                  </Badge>
                  {(() => {
                    const payment = getInvoicePaymentInfo(invoice)
                    return payment ? (
                      <Badge className={payment.className}>{payment.label}</Badge>
                    ) : null
                  })()}
                </div>
                <p className="text-sm text-foreground/60">
                  Erstellt: {formatDate(invoice.createdAt)}
                </p>
                {invoice.dueDate && (
                  <p className="text-sm text-foreground/60">
                    Fällig: {formatDate(invoice.dueDate)}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{formatCurrency(invoice.total)}</p>
                {invoice.paymentOverview && !invoice.isCreditNote && (
                  <>
                    {Number(invoice.paymentOverview.received ?? invoice.paymentOverview.allocated ?? 0) > 0 && (
                      <p className="text-sm text-green-600">
                        Eingegangen: {formatCurrency(Number(invoice.paymentOverview.received ?? invoice.paymentOverview.allocated ?? 0))}
                      </p>
                    )}
                    {Number(invoice.paymentOverview.openAmount || 0) > 0 && (
                      <p className="text-sm text-red-600">
                        Offen: {formatCurrency(Number(invoice.paymentOverview.openAmount || 0))}
                      </p>
                    )}
                  </>
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
                    onClick={(event) => {
                      event.stopPropagation()
                      handleSendReminder(invoice)
                    }}
                  >
                    <Bell className="h-4 w-4 mr-1" />
                    Erinnerung senden
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation()
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

      {paymentsDialog}

      {/* Reminder Dialog for Invoice */}
      {selectedInvoice && (
        <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Zahlungserinnerung senden</DialogTitle>
              <DialogDescription>
                Erinnerung an {customerDisplayName} für Rechnung #{selectedInvoice.invoiceNumber} senden
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded">
                <p className="text-sm font-medium">Rechnungsdetails</p>
                <p className="text-sm text-foreground/60">Betrag: {formatCurrency(selectedInvoice.total)}</p>
                <p className="text-sm text-foreground/60">Status: {getInvoiceStatusLabel(selectedInvoice.status)}</p>
                {selectedInvoice.dueDate && (
                  <p className="text-sm text-foreground/60">Fälligkeitsdatum: {formatDate(selectedInvoice.dueDate)}</p>
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
                      description: "Kein verknüpfter Kunde für diese Buchung gefunden",
                      variant: "destructive"
                    })
                    return
                  }

                  await createReminder({
                    bookingId: booking._id,
                    customerId: customer._id,
                    type: 'payment',
                    title: `Zahlungserinnerung - Rechnung #${selectedInvoice.invoiceNumber}`,
                    message: `Dies ist eine Erinnerung, dass Rechnung #${selectedInvoice.invoiceNumber} über ${formatCurrency(selectedInvoice.total)} ${selectedInvoice.status === 'overdue' ? 'überfällig' : 'zur Zahlung ausstehend'} ist. Bitte begleichen Sie den Betrag zeitnah.`,
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
  const [sendImmediately, setSendImmediately] = useState(true)
  const [invoiceMode, setInvoiceMode] = useState<'booking' | 'order'>('booking')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const navigate = useNavigate()
  const { toast } = useToast()

  const bookingOrders = useMemo(() => {
    if (!Array.isArray(booking.orderIds)) {
      return []
    }
    return booking.orderIds.filter((order) => order && typeof order === 'object' && '_id' in order) as Array<any>
  }, [booking.orderIds])

  const firstOrder = bookingOrders[0]
  const allOrdersCompleted = useMemo(
    () => bookingOrders.length > 0 && bookingOrders.every((order) => order.status === 'completed'),
    [bookingOrders]
  )
  const completedOrders = useMemo(
    () => bookingOrders.filter((order) => order.status === 'completed'),
    [bookingOrders]
  )
  const canCreateAnyInvoice = allOrdersCompleted || completedOrders.length > 0
  const canCreatePartialInvoice = completedOrders.length > 0

  const bookingBillingAddress =
    booking.customerId?.invoiceAddress ||
    booking.billingAddress ||
    booking.guestInfo?.billingAddress ||
    firstOrder?.billingAddress ||
    firstOrder?.guestInfo?.billingAddress

  const customerPaymentAddress = booking.customerId?.paymentAddress
  const bookingShippingAddress =
    customerPaymentAddress?.sameAsInvoice === false
      ? customerPaymentAddress
      : booking.shippingAddress ||
        booking.guestInfo?.shippingAddress ||
        firstOrder?.shippingAddress ||
        firstOrder?.guestInfo?.shippingAddress

  const resolvedBillingAddress = hasAddressData(preview?.billingAddress)
    ? preview.billingAddress
    : bookingBillingAddress

  const resolvedShippingAddress = hasAddressData(preview?.shippingAddress)
    ? preview.shippingAddress
    : bookingShippingAddress

  const shippingSameAsBilling =
    !hasAddressData(resolvedShippingAddress) && hasAddressData(resolvedBillingAddress)

  useEffect(() => {
    if (!open) {
      return
    }

    const firstCompletedOrderId = completedOrders[0]?._id || ''
    setInvoiceMode(allOrdersCompleted ? 'booking' : (firstCompletedOrderId ? 'order' : 'booking'))
    setSelectedOrderId(firstCompletedOrderId)
    setPreview(null)
    setNotes('')
    setSendImmediately(true)
  }, [open, booking._id, allOrdersCompleted, completedOrders])

  useEffect(() => {
    if (open && booking) {
      loadPreview()
    }
  }, [open, booking, invoiceMode, selectedOrderId])

  const handleInvoiceAlreadyExistsError = (error: unknown) => {
    const typedError = error as {
      status?: number;
      code?: string;
      existingInvoiceId?: string;
      existingInvoiceNumber?: string;
      redirectTo?: string;
    };

    const isDuplicateInvoiceError = typedError?.status === 409
      || typedError?.code === 'INVOICE_ALREADY_EXISTS';

    if (!isDuplicateInvoiceError) {
      return false;
    }

    const invoiceLabel = typedError.existingInvoiceNumber
      ? `#${typedError.existingInvoiceNumber}`
      : 'der vorhandenen Rechnung';

    toast({
      title: 'Rechnung bereits vorhanden',
      description: `Es existiert bereits eine Rechnung (${invoiceLabel}). Sie werden jetzt direkt weitergeleitet.`,
    })

    const redirectTarget = typedError.redirectTo
      || (typedError.existingInvoiceId
        ? `/admin/financial?tab=overview&highlightInvoiceId=${encodeURIComponent(typedError.existingInvoiceId)}`
        : '/admin/financial?tab=overview');

    onClose()
    navigate(redirectTarget)
    return true;
  }

  const loadPreview = async () => {
    if (!canCreateAnyInvoice) {
      setPreview(null)
      return
    }

    if (invoiceMode === 'booking' && !allOrdersCompleted) {
      setPreview(null)
      return
    }

    if (invoiceMode === 'order' && !selectedOrderId) {
      setPreview(null)
      return
    }

    try {
      setLoading(true)
      const response = await previewBookingInvoice(
        booking._id,
        invoiceMode === 'order'
          ? { invoiceMode: 'order', orderId: selectedOrderId }
          : { invoiceMode: 'booking' }
      )
      setPreview(response.invoicePreview)
    } catch (error) {
      if (handleInvoiceAlreadyExistsError(error)) {
        return
      }

      const message = error instanceof Error ? error.message : 'Rechnungsvorschau konnte nicht geladen werden'
      toast({
        title: "Fehler",
        description: message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!canCreateAnyInvoice) {
      toast({
        title: 'Rechnung nicht möglich',
        description: 'Es ist noch kein abgeschlossener Auftrag für die Rechnungserstellung verfügbar.',
        variant: 'destructive'
      })
      return
    }

    if (invoiceMode === 'booking' && !allOrdersCompleted) {
      toast({
        title: 'Gesamtrechnung nicht möglich',
        description: 'Eine Gesamtrechnung ist erst möglich, wenn alle Aufträge abgeschlossen sind.',
        variant: 'destructive'
      })
      return
    }

    if (invoiceMode === 'order' && !selectedOrderId) {
      toast({
        title: 'Teil-Rechnung nicht möglich',
        description: 'Bitte wählen Sie einen abgeschlossenen Auftrag aus.',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)
      const response = await createBookingInvoice(booking._id, {
        notes,
        sendImmediately,
        invoiceMode,
        orderId: invoiceMode === 'order' ? selectedOrderId : undefined,
      })
      // FIN-3: Rechnung erstellt, Versand fehlgeschlagen -> 201 + warning. Nie still als Erfolg zeigen.
      if (response?.warning) {
        toast({
          title: 'Rechnung erstellt, aber nicht versendet',
          description: String(response.warning),
          variant: 'destructive'
        })
      } else if (sendImmediately && response?.sent) {
        toast({
          title: 'Rechnung erstellt und versendet',
          description: `Rechnung ${response?.invoice?.invoiceNumber || ''} wurde per E-Mail mit PDF versendet (vom Mailserver angenommen).`.replace('  ', ' ')
        })
      }
      await printInvoice(response?.invoice)
      onSuccess()
    } catch (error) {
      if (handleInvoiceAlreadyExistsError(error)) {
        return
      }

      const message = error instanceof Error ? error.message : 'Rechnung konnte nicht erstellt werden'
      toast({
        title: "Fehler",
        description: message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Gemeinsame, NaN-sichere Formatierung (lib/utils formatEUR) statt einer lokalen Kopie.
  const formatCurrency = (value: unknown) => formatEUR(value)

  const renderAddressBlock = (title: string, address?: AddressFields | null, fallback?: string) => {
    const hasAddress = hasAddressData(address)

    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-[#1a2a5e] px-4 py-2">
          <h3 className="font-semibold text-[#f5b800] text-sm">{title}</h3>
        </div>
        <div className="p-4 bg-white dark:bg-muted/10">
          {hasAddress ? (
            <div className="space-y-0.5 text-sm text-foreground/80">
              {address?.street && <p>{address.street}</p>}
              {(address?.zipCode || address?.zip || address?.city) && (
                <p>{[address?.zipCode || address?.zip, address?.city].filter(Boolean).join(' ')}</p>
              )}
              {address?.state && <p>{address.state}</p>}
              {address?.country && <p>{address.country}</p>}
            </div>
          ) : (
            <p className="text-sm text-foreground/50">{fallback || 'Nicht angegeben'}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="bg-[#1a2a5e] px-6 py-4 flex-shrink-0">
          <DialogTitle className="text-[#f5b800] text-lg font-bold">
            Rechnung für Buchung erstellen
          </DialogTitle>
          <DialogDescription className="text-white/70 text-sm">
            Rechnungsdetails prüfen und bestätigen
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f5b800]"></div>
            </div>
          ) : !canCreateAnyInvoice ? (
            <div className="text-center py-8">
              <p className="text-sm font-medium text-[#1a2a5e]">Rechnungserstellung noch nicht verfügbar</p>
              <p className="text-sm text-foreground/60 mt-1">
                Für diese Buchung ist noch kein Auftrag mit dem Status „Abgeschlossen“ vorhanden.
              </p>
            </div>
          ) : canCreateAnyInvoice ? (
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-[#1a2a5e] px-4 py-2">
                  <h3 className="font-semibold text-[#f5b800] text-sm">Rechnungsmodus</h3>
                </div>
                <div className="p-4 bg-white dark:bg-muted/10 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => allOrdersCompleted && setInvoiceMode('booking')}
                      className={`rounded-lg border px-4 py-3 text-left transition-colors ${invoiceMode === 'booking' ? 'border-[#f5b800] bg-[#f5b800]/10' : 'border-border'} ${!allOrdersCompleted ? 'opacity-60 cursor-not-allowed' : 'hover:border-[#f5b800]'}`}
                      disabled={!allOrdersCompleted}
                    >
                      <p className="text-sm font-semibold text-[#1a2a5e]">Gesamtrechnung</p>
                      <p className="text-xs text-foreground/60 mt-1">Nur verfügbar, wenn alle zugehörigen Aufträge abgeschlossen sind.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => canCreatePartialInvoice && setInvoiceMode('order')}
                      className={`rounded-lg border px-4 py-3 text-left transition-colors ${invoiceMode === 'order' ? 'border-[#f5b800] bg-[#f5b800]/10' : 'border-border'} ${!canCreatePartialInvoice ? 'opacity-60 cursor-not-allowed' : 'hover:border-[#f5b800]'}`}
                      disabled={!canCreatePartialInvoice}
                    >
                      <p className="text-sm font-semibold text-[#1a2a5e]">Teil-Rechnung</p>
                      <p className="text-xs text-foreground/60 mt-1">Erstellt eine Rechnung nur für einen bereits abgeschlossenen Auftrag.</p>
                    </button>
                  </div>

                  {!allOrdersCompleted && canCreatePartialInvoice && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                      Nicht alle Aufträge sind abgeschlossen. Eine Gesamtrechnung bleibt gesperrt, Teil-Rechnungen für abgeschlossene Aufträge sind möglich.
                    </p>
                  )}

                  {invoiceMode === 'order' && (
                    <div>
                      <label className="text-sm font-medium text-[#1a2a5e]">Abgeschlossenen Auftrag wählen</label>
                      <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                        <SelectTrigger className="mt-2 border-[#1a2a5e]/20 focus:ring-[#f5b800]">
                          <SelectValue placeholder="Auftrag auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {completedOrders.map((order) => (
                            <SelectItem key={order._id} value={order._id}>
                              {(order.orderNumber || order._id)} - {[order.deviceBrand, order.deviceModel].filter(Boolean).join(' ') || 'Gerät'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              {!preview ? (
                <div className="text-center py-8 text-foreground/60 border rounded-lg bg-white dark:bg-muted/10">
                  Vorschau wird geladen oder ist für die aktuelle Auswahl nicht verfügbar.
                </div>
              ) : (
                <>

                  {/* Kundeninformationen */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-[#1a2a5e] px-4 py-2">
                      <h3 className="font-semibold text-[#f5b800] text-sm">Kundeninformationen</h3>
                    </div>
                    <div className="p-4 bg-white dark:bg-muted/10">
                      <p className="text-sm font-medium">{preview.customerName}</p>
                      <p className="text-sm text-foreground/60">{preview.customerEmail}</p>
                    </div>
                  </div>

                  {/* Adressen */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderAddressBlock('Rechnungsadresse', resolvedBillingAddress)}
                    {shippingSameAsBilling
                      ? renderAddressBlock('Lieferadresse', resolvedBillingAddress, 'Identisch mit Rechnungsadresse')
                      : renderAddressBlock('Lieferadresse', resolvedShippingAddress, 'Nicht angegeben')}
                  </div>

                  {/* Rechnungspositionen */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-[#1a2a5e] px-4 py-2">
                      <h3 className="font-semibold text-[#f5b800] text-sm">Rechnungspositionen</h3>
                    </div>
                    <div className="p-4 bg-white dark:bg-muted/10 space-y-2">
                      {(preview?.items || []).map((item: any) => (
                        <div key={item._id || item.description} className="flex justify-between text-sm border-b pb-2 last:border-0">
                          <div className="flex-1">
                            <p className="font-medium text-[#1a2a5e]">{item.description}</p>
                            <p className="text-xs text-foreground/60">
                              Menge: {item.quantity} × {formatCurrency(item.unitPrice)}
                            </p>
                          </div>
                          <p className="font-semibold text-[#1a2a5e]">{formatCurrency(item.total)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Zusammenfassung */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-[#1a2a5e] px-4 py-2">
                      <h3 className="font-semibold text-[#f5b800] text-sm">Rechnungszusammenfassung</h3>
                    </div>
                    <div className="p-4 bg-white dark:bg-muted/10 space-y-2">
                      {(preview?.discount || 0) > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Rabatt (bereits in Netto/MwSt. unten berücksichtigt):</span>
                          <span>-{formatCurrency(preview?.discount || 0)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-foreground/70">Nettobetrag (nach Rabatt):</span>
                        <span className="font-medium">{formatCurrency(preview?.subtotal || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-foreground/70">Enthaltene MwSt.:</span>
                        <span className="font-medium">{formatCurrency(preview?.tax || 0)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-base font-bold text-[#1a2a5e]">
                        <span>Gesamtbetrag (Brutto) = Netto + MwSt.:</span>
                        <span>{formatCurrency(preview?.total || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notizen & Optionen */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-[#1a2a5e] px-4 py-2">
                      <h3 className="font-semibold text-[#f5b800] text-sm">Optionen</h3>
                    </div>
                    <div className="p-4 bg-white dark:bg-muted/10 space-y-3">
                      <div>
                        <label className="text-sm font-medium text-[#1a2a5e]">Notizen (optional)</label>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Weitere Notizen hinzufügen..."
                          rows={3}
                          className="mt-2 border-[#1a2a5e]/20 focus-visible:ring-[#f5b800]"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="sendImmediately"
                          checked={sendImmediately}
                          onChange={(e) => setSendImmediately(e.target.checked)}
                          className="rounded accent-[#f5b800]"
                        />
                        <label htmlFor="sendImmediately" className="text-sm text-[#1a2a5e] font-medium cursor-pointer">
                          Rechnung sofort an den Kunden senden
                        </label>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-foreground/60">
              Keine Vorschau verfügbar
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-gray-50 dark:bg-muted/20 flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white"
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading || !preview || !canCreateAnyInvoice}
            className="bg-[#f5b800] text-[#1a2a5e] font-bold hover:bg-[#e5ab00] disabled:opacity-50 disabled:cursor-not-allowed"
          >
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
        description: "Bitte alle Pflichtfelder ausfüllen",
        variant: "destructive"
      })
      return
    }

    if (!customer._id) {
      toast({
        title: "Fehler",
        description: "Kein verknüpfter Kunde für diese Buchung gefunden",
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
          <DialogDescription>Erinnerung für diese Buchung planen</DialogDescription>
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
            <label className="text-sm font-medium">Priorität</label>
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
        description: "Bitte alle Pflichtfelder ausfüllen",
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
                <SelectItem value="quality">Qualität</SelectItem>
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
            <label className="text-sm font-medium">Priorität</label>
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
          description: "Retouren-Label (Kunde → McRepair) erfolgreich erstellt"
        })

        onSuccess()
      } else {
        throw new Error(response.message || 'Retouren-Label konnte nicht erstellt werden')
      }
    } catch (error) {
      console.error('Error creating return label:', error)
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Retouren-Label konnte nicht erstellt werden",
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
          <DialogTitle>Retouren-Label erstellen (Kunde → McRepair)</DialogTitle>
          <DialogDescription>
            DHL-Retouren-Label (Einsendung Kunde → McRepair) für Buchung #{booking._id.slice(-8).toUpperCase()} erstellen
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
                <span style={{ color: 'var(--gray-700, #2d3748)' }}>{customer.phone || 'Nicht verfügbar'}</span>
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
              <li>Es wird ein DHL-Retouren-Label für diese Buchung erstellt: Absender ist der Kunde, Empfänger McRepair</li>
              <li>Eine Sendungsnummer wird erzeugt und dem Kunden angezeigt</li>
              <li>Der Kunde erhält eine E-Mail-Benachrichtigung mit dem Retouren-Label</li>
              <li>Das Retouren-Label kann gedruckt oder als QR-Code in DHL-Filialen gezeigt werden</li>
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
              <li>Ein Retouren-Label wird über die DHL-Integration erstellt</li>
              <li>Sendungsnummer und Label werden in der Buchung gespeichert</li>
              <li>Der Tab Versand wird mit den Retourendaten aktualisiert</li>
              <li>Der Kunde erhält eine E-Mail mit den Download-Links</li>
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
            {creatingLabel ? "Wird erstellt..." : "Retouren-Label erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
