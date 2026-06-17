import { useEffect, useRef, useState } from "react"
import type { MouseEvent as ReactMouseEvent } from "react"
import { useParams, Link, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import { safeToNumber, formatPrice } from "@/lib/utils"
import { OrderDetailsNavigationState } from "@/lib/orderDetailsNavigation"
import "./OrderDetails.css"
import { createOrderComplaint, getOrderById, Order, getOrderProgressTimeline, addShopProductToOrder, removeShopProductFromOrder, updateShopProductQuantity, ShopProduct } from "@/api/orders"
import { getComplaint, acknowledgeComplaint, denyComplaint, acceptComplaintOffer, rejectComplaintOffer, convertAcceptedOfferToBooking, Complaint as ComplaintRecord } from "@/api/complaints"
import { startOrderTracking, endOrderTracking } from "@/api/timeTracking"
import { getAvailableStaff, assignStaffToOrder, StaffMember, getAdminOrderById, removeEPartFromOrder, addAddonToOrder, updateOrderAddon, removeAddonFromOrder, assignStaffToAddon, confirmUnlockCode, requestUnlockInfoUpdate, updateOrderDevice, updateOrderStatus, confirmPickup } from "@/api/adminOrders"
import { getUserProfile, UserProfile } from "@/api/user"
import { getAddOnServices, AddOnService as AddOnServiceType, getServices } from "@/api/services"
import { getOrderWorkflows, getSuggestedWorkflowsForOrder, assignWorkflowToOrder, deleteWorkflowFromOrder, startWorkflow, updateWorkflowStatus } from "@/api/workflow"
import { initializeRepairWorkflow, getRepairWorkflow } from "@/api/repairWorkflow"
import { getOrderServices, addServiceToOrder, updateOrderService, removeServiceFromOrder } from "@/api/orderServices"
import { searchDevices, SearchResult } from "@/api/devices"
import EPartSelectionDialog from "@/components/admin/EPartSelectionDialog"
import { ShopProductSelectionDialog } from "@/components/admin/ShopProductSelectionDialog"
import { RepairServiceDialog } from "@/components/inspection/RepairServiceDialog"
import { DeviceInspectionForm } from "@/components/inspection/DeviceInspectionForm"
import { WorkflowExecutionView } from "@/components/workflow/WorkflowExecutionView"
import { WorkflowCard } from "@/components/admin/WorkflowCard"
import { WorkflowExecutionModal } from "@/components/admin/WorkflowExecutionModal"
import { InspectionResultsDisplay } from "@/components/inspection/InspectionResultsDisplay"
import { ConfirmUnlockDialog } from "@/components/inspection/ConfirmUnlockDialog"
import { UnlockPatternVisual } from "@/components/inspection/UnlockPatternVisual"
import { DeviceChangeDialog } from "@/components/admin/DeviceChangeDialog"
import { CommunicationPanel } from "@/components/inspection/CommunicationPanel"
import { generateInspectionReport, getInspection } from "@/api/deviceInspection"
import { getBooking, updateBookingShippingStatus, updateReturnStatus, downloadBookingShippingLabel, downloadBookingReturnLabel } from "@/api/bookings"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  ArrowLeft,
  Package,
  ShoppingCart,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  MessageSquare,
  Camera,
  Send,
  Paperclip,
  Shield,
  Star,
  MapPin,
  Phone,
  Mail,
  Smartphone,
  User,
  CreditCard,
  Home,
  Users,
  UserPlus,
  Wrench,
  Trash2,
  Plus,
  PlusCircle,
  Edit,
  X,
  Lock,
  HelpCircle,
  FileText,
  Droplets,
  Info,
  ChevronDown,
  Download,
  Zap,
  ExternalLink,
  Workflow,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  UserCheck
} from "lucide-react"

export function OrderDetails() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { t } = useTranslation()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string[]>([])
  const [assigningStaff, setAssigningStaff] = useState(false)
  const [staffDialogOpen, setStaffDialogOpen] = useState(false)
  const [ePartDialogOpen, setEPartDialogOpen] = useState(false)
  const [addAddonDialogOpen, setAddAddonDialogOpen] = useState(false)
  const [editAddonDialogOpen, setEditAddonDialogOpen] = useState(false)
  const [assignAddonStaffDialogOpen, setAssignAddonStaffDialogOpen] = useState(false)
  const [availableAddons, setAvailableAddons] = useState<AddOnServiceType[]>([])
  const [selectedAddonService, setSelectedAddonService] = useState<AddOnServiceType | null>(null)
  const [addonInputMode, setAddonInputMode] = useState<'catalog' | 'custom'>('catalog')
  const [addonSearchTerm, setAddonSearchTerm] = useState("")
  const [showAddonSuggestions, setShowAddonSuggestions] = useState(false)
  const [submittingAddon, setSubmittingAddon] = useState(false)
  const [customAddonName, setCustomAddonName] = useState("")
  const [customAddonPrice, setCustomAddonPrice] = useState("")
  const [customAddonDescription, setCustomAddonDescription] = useState("")
  const [customAddonTime, setCustomAddonTime] = useState("")
  const [editingAddon, setEditingAddon] = useState<any>(null)
  const [selectedAddonForStaff, setSelectedAddonForStaff] = useState<any>(null)
  const [addonStaffId, setAddonStaffId] = useState("")
  const [workflows, setWorkflows] = useState<any[]>([])
  const [suggestedWorkflows, setSuggestedWorkflows] = useState<any[]>([])
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false)
  const [workflowAssignedStaffId, setWorkflowAssignedStaffId] = useState<string>("__unassigned__")
  const [assigningWorkflow, setAssigningWorkflow] = useState(false)
  const [deletingWorkflowId, setDeletingWorkflowId] = useState<string | null>(null)
  const [workflowActionInProgress, setWorkflowActionInProgress] = useState<{
    workflowId: string
    action: 'start' | 'pause' | 'resume'
  } | null>(null)
  const [selectedWorkflowForExecution, setSelectedWorkflowForExecution] = useState<any | null>(null)
  const [workflowExecutionModalOpen, setWorkflowExecutionModalOpen] = useState(false)
  const [workflowExecutionMode, setWorkflowExecutionMode] = useState<'start' | 'resume' | 'execute' | 'view'>('view')
  const [repairWorkflow, setRepairWorkflow] = useState<any>(null)
  const [repairWorkflowDialogOpen, setRepairWorkflowDialogOpen] = useState(false)
  const [startingRepairWorkflow, setStartingRepairWorkflow] = useState(false)
  const [progressTimeline, setProgressTimeline] = useState<any>(null)
  const [repairServices, setRepairServices] = useState<any[]>([])
  const [availableServices, setAvailableServices] = useState<any[]>([])
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false)
  const [expandedServiceDescriptions, setExpandedServiceDescriptions] = useState<Set<string>>(new Set())
  const [editingService, setEditingService] = useState<any>(null)
  const [unlockConfirmDialogOpen, setUnlockConfirmDialogOpen] = useState(false)
  const [confirmingUnlock, setConfirmingUnlock] = useState(false)
  const [shopProductDialogOpen, setShopProductDialogOpen] = useState(false)
  const [deviceChangeDialogOpen, setDeviceChangeDialogOpen] = useState(false)
  const [newDeviceBrand, setNewDeviceBrand] = useState("")
  const [newDeviceModel, setNewDeviceModel] = useState("")
  const [newDeviceType, setNewDeviceType] = useState("")
  const [updatingDevice, setUpdatingDevice] = useState(false)
  const [deviceSearchQuery, setDeviceSearchQuery] = useState("")
  const [deviceSearchResults, setDeviceSearchResults] = useState<SearchResult[]>([])
  const [showDeviceResults, setShowDeviceResults] = useState(false)
  const [selectedDeviceForChange, setSelectedDeviceForChange] = useState<SearchResult | null>(null)
  const [resolvedDeviceImage, setResolvedDeviceImage] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [confirmingPickup, setConfirmingPickup] = useState(false)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false)
  const [inspectionRefreshKey, setInspectionRefreshKey] = useState(0)
  const [generatingInspectionReport, setGeneratingInspectionReport] = useState(false)
  const [deviceHistoryOpen, setDeviceHistoryOpen] = useState(false)
  const [customerInspection, setCustomerInspection] = useState<any>(null)
  const [customerInspectionLoading, setCustomerInspectionLoading] = useState(false)
  const [diagnosisPopupOpen, setDiagnosisPopupOpen] = useState(false)
  const [customerPhotoViewerOpen, setCustomerPhotoViewerOpen] = useState(false)
  const [customerPhotoIndex, setCustomerPhotoIndex] = useState(0)
  const [customerPhotoZoom, setCustomerPhotoZoom] = useState(1)
  const [customerPhotoLensActive, setCustomerPhotoLensActive] = useState(false)
  const [customerPhotoLensPosition, setCustomerPhotoLensPosition] = useState({ x: 50, y: 50 })
  const [repairDetailsPopupOpen, setRepairDetailsPopupOpen] = useState(false)
  const [repairServicesPopupOpen, setRepairServicesPopupOpen] = useState(false)
  const [complaintDialogOpen, setComplaintDialogOpen] = useState(false)
  const [complaintReason, setComplaintReason] = useState("")
  const [complaintDescription, setComplaintDescription] = useState("")
  const [submittingComplaint, setSubmittingComplaint] = useState(false)
  const [complaintWorkflow, setComplaintWorkflow] = useState<ComplaintRecord | null>(null)
  const [complaintActionDialog, setComplaintActionDialog] = useState<"ack" | "deny" | null>(null)
  const [ackReasonPreset, setAckReasonPreset] = useState("")
  const [denyReasonPreset, setDenyReasonPreset] = useState("")
  const [technicianAckReason, setTechnicianAckReason] = useState("")
  const [technicianDenyReason, setTechnicianDenyReason] = useState("")
  const [denyOfferAmount, setDenyOfferAmount] = useState("")
  const [denyOfferDescription, setDenyOfferDescription] = useState("")
  const [complaintActionLoading, setComplaintActionLoading] = useState<"ack" | "deny" | "">("")
  const [offerActionLoading, setOfferActionLoading] = useState<"accept" | "reject" | "">("")
  const [convertOfferBookingLoading, setConvertOfferBookingLoading] = useState(false)
  const [commFeedbackOpen, setCommFeedbackOpen] = useState(false)
  const [commQuickActionOpen, setCommQuickActionOpen] = useState(false)
  const [linkedBooking, setLinkedBooking] = useState<any | null>(null)
  const bookingTrackingRefreshRef = useRef<Record<string, number>>({})
  const { toast } = useToast()

  const ACK_REASON_OPTIONS = [
    "fehlerhaftes Ersatzteil",
    "Techniker hat Fehler gemacht und Teil zerstört",
    "Techniker hat Fehler gemacht und falsche Diagnose/Reparatur gemacht",
    "Techniker/Qualitätsmanagement hat nicht richtig getestet",
  ]

  const DENY_REASON_OPTIONS = [
    "kein Defekt feststellbar",
    "Defekt hat nichts mit unserer Reparatur zu tun / eigenständiger Defekt",
  ]

  const orderDetailsState = (location.state as OrderDetailsNavigationState | null) || null
  const backTarget = orderDetailsState?.backTarget

  const requestedWorkflowId = (() => {
    const state = orderDetailsState as {
      openWorkflowId?: string
      workflowMode?: 'start' | 'resume' | 'execute' | 'view'
    } | null

    return state?.openWorkflowId ? String(state.openWorkflowId) : ""
  })()

  const requestedWorkflowMode = (() => {
    const state = orderDetailsState as {
      openWorkflowId?: string
      workflowMode?: 'start' | 'resume' | 'execute' | 'view'
    } | null

    return state?.workflowMode
  })()

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!isAuthenticated) return

      try {
        console.log("Fetching user profile...")
        const response = await getUserProfile()
        setUser((response as any).user)
        console.log("User profile loaded:", (response as any).user?.email, "Role:", (response as any).user?.role)
      } catch (error) {
        console.error("Error fetching user profile:", error)
      }
    }

    fetchUserProfile()
  }, [isAuthenticated])

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!id) return

      // Wait for user to be loaded from auth context
      if (!user) {
        console.log("Waiting for user to be loaded...")
        return
      }

      try {
        console.log("Fetching order details:", id, "User role:", user.role)

        // Use admin API if user is admin or staff, otherwise use customer API
        let orderResponse;
        const isStaffOrAdmin = user?.role === 'admin' || user?.role === 'staff';

        if (isStaffOrAdmin) {
          console.log("Using admin API to fetch order details")
          orderResponse = await getAdminOrderById(id)

          // Automatically start time tracking for staff when they open the order
          try {
            console.log("Starting automatic time tracking for order:", id)
            await startOrderTracking(id)
          } catch (trackingError) {
            console.error("Failed to start time tracking:", trackingError)
            // Don't throw error, just log it - time tracking failure shouldn't prevent viewing order
          }
        } else {
          console.log("Using customer API to fetch order details")
          orderResponse = await getOrderById(id)
        }

        const fetchedOrder = (orderResponse as any).order
        setOrder(fetchedOrder)

        // Log unlock information if present
        console.log("Unlock Pattern:", fetchedOrder?.unlockPattern)
        console.log("Unlock Code:", fetchedOrder?.unlockCode ? "***" : "Not provided")
        console.log("No Lock:", fetchedOrder?.noLock)
        console.log("Device Brand:", fetchedOrder?.deviceBrand)
        console.log("Device Model:", fetchedOrder?.deviceModel)

      } catch (error) {
        console.error("Error fetching order details:", error)
        toast({
          title: "Error",
          description: "Failed to load order details",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [id, user, toast])

  useEffect(() => {
    const loadComplaintWorkflow = async () => {
      if (!order) {
        setComplaintWorkflow(null)
        return
      }

      const sourceComplaint = (order as any)?.sourceComplaintId
      const sourceComplaintId = typeof sourceComplaint === 'string' ? sourceComplaint : sourceComplaint?._id
      const isComplaintFollowupOrder = Boolean((order as any)?.isComplaintFollowup)

      if (!isComplaintFollowupOrder || !sourceComplaintId) {
        setComplaintWorkflow(null)
        return
      }

      try {
        const response = await getComplaint(String(sourceComplaintId))
        setComplaintWorkflow((response as any)?.complaint || null)
      } catch (error) {
        console.error('OrderDetails: Failed to load complaint workflow for follow-up order:', error)
        setComplaintWorkflow(null)
      }
    }

    loadComplaintWorkflow()
  }, [order])

  useEffect(() => {
    const loadLinkedBooking = async () => {
      const bookingId = typeof order?.bookingId === 'string' ? order.bookingId : (order as any)?.bookingId?._id

      if (!bookingId) {
        setLinkedBooking(null)
        return
      }

      try {
        const response = await getBooking(String(bookingId))
        let bookingData = (response as any)?.booking || null
        const now = Date.now()
        const lastRefreshAt = bookingTrackingRefreshRef.current[String(bookingId)] || 0
        const shouldRefreshTracking = now - lastRefreshAt > 60_000

        if (shouldRefreshTracking && bookingData?.trackingNumber) {
          try {
            const trackingRefresh = await updateBookingShippingStatus(String(bookingId))
            bookingData = (trackingRefresh as any)?.booking || bookingData
          } catch (trackingError) {
            console.error('OrderDetails: Failed to refresh linked booking shipping status:', trackingError)
          }
        }

        if (shouldRefreshTracking && bookingData?.returnTrackingNumber) {
          try {
            const returnRefresh = await updateReturnStatus(String(bookingId))
            bookingData = (returnRefresh as any)?.booking || bookingData
          } catch (returnTrackingError) {
            console.error('OrderDetails: Failed to refresh linked booking return status:', returnTrackingError)
          }
        }

        if (shouldRefreshTracking && (bookingData?.trackingNumber || bookingData?.returnTrackingNumber)) {
          bookingTrackingRefreshRef.current[String(bookingId)] = now
        }

        setLinkedBooking(bookingData)
      } catch (error) {
        console.error('OrderDetails: Failed to load linked booking:', error)
        setLinkedBooking(null)
      }
    }

    loadLinkedBooking()
  }, [order?.bookingId])

  useEffect(() => {
    const fetchAvailableStaff = async () => {
      if (user?.role === 'admin' || user?.role === 'staff') {
        try {
          const response = await getAvailableStaff()
          setAvailableStaff((response as any).staff || [])
        } catch (error) {
          console.error("Error fetching available staff:", error)
        }
      }
    }

    fetchAvailableStaff()
  }, [user])

  useEffect(() => {
    const fetchAvailableAddons = async () => {
      if (user?.role === 'admin' || user?.role === 'staff') {
        try {
          const response = await getAddOnServices()
          setAvailableAddons((response as any).addOns || [])
        } catch (error) {
          console.error("Error fetching available add-ons:", error)
        }
      }
    }

    fetchAvailableAddons()
  }, [user])

  // Fetch available repair services and repair services for order
  useEffect(() => {
    const fetchRepairServices = async () => {
      if (!id || !user) return

      try {
        console.log("Fetching repair services for order:", id)

        // Fetch available services (only for admin/staff)
        if (user.role === 'admin' || user.role === 'staff') {
          const servicesResponse = await getServices()
          setAvailableServices((servicesResponse as any).services || [])
        }

        // Fetch repair services for this order (for all users)
        const orderServicesResponse = await getOrderServices(id)
        setRepairServices((orderServicesResponse as any).services || [])

        console.log("Repair services loaded:", (orderServicesResponse as any).services)
      } catch (error) {
        console.error("Error fetching repair services:", error)
      }
    }

    fetchRepairServices()
  }, [id, user])

  // Fetch workflows for order
  useEffect(() => {
    const fetchWorkflows = async () => {
      if (!id || !user || (user.role !== 'admin' && user.role !== 'staff')) return

      try {
        console.log("OrderDetails: Fetching workflows for order:", id)
        const [workflowsResponse, suggestedResponse] = await Promise.all([
          getOrderWorkflows(id),
          getSuggestedWorkflowsForOrder(id)
        ])

        console.log("OrderDetails: Workflows received:", workflowsResponse)
        console.log("OrderDetails: Suggested workflows received:", suggestedResponse)

        setWorkflows((workflowsResponse as any).workflows || [])
        setSuggestedWorkflows((suggestedResponse as any).workflows || [])
      } catch (error: any) {
        console.error("OrderDetails: Error fetching workflows:", error)
        // Don't show error toast as workflows might not be critical
      }
    }

    fetchWorkflows()
  }, [id, user])

  useEffect(() => {
    const fetchCustomerInspection = async () => {
      if (!id || !user || user.role === 'admin' || user.role === 'staff') {
        return
      }

      try {
        setCustomerInspectionLoading(true)
        const response = await getInspection(id)
        setCustomerInspection((response as any)?.inspection || null)
      } catch (error) {
        console.error('OrderDetails: Error loading customer inspection summary:', error)
        setCustomerInspection(null)
      } finally {
        setCustomerInspectionLoading(false)
      }
    }

    fetchCustomerInspection()
  }, [id, user, inspectionRefreshKey])

  // Cleanup: End time tracking when leaving the page
  useEffect(() => {
    const isStaffOrAdmin = user?.role === 'admin' || user?.role === 'staff';

    return () => {
      if (id && isStaffOrAdmin) {
        // End time tracking when component unmounts (user leaves the page)
        console.log("Ending automatic time tracking for order:", id)
        endOrderTracking(id).catch((error) => {
          console.error("Failed to end time tracking:", error)
        })
      }
    }
  }, [id, user])

  useEffect(() => {
    document.body.classList.add('order-details-page')
    const isStaffOrAdminUser = user?.role === 'admin' || user?.role === 'staff'
    if (isStaffOrAdminUser) {
      document.body.classList.add('order-details-admin')
    } else {
      document.body.classList.remove('order-details-admin')
    }
    return () => {
      document.body.classList.remove('order-details-page')
      document.body.classList.remove('order-details-admin')
    }
  }, [user?.role])

  useEffect(() => {
    if (!requestedWorkflowId) return

    const matchedWorkflow = workflows.find((workflow: any) => String(workflow?._id) === requestedWorkflowId)
    if (!matchedWorkflow) {
      if (workflows.length === 0) return

      toast({
        title: "Workflow nicht gefunden",
        description: "Der ausgewaehlte Workflow konnte in diesem Auftrag nicht geladen werden.",
        variant: "destructive",
      })
      navigate(location.pathname, { replace: true })
      return
    }

    const workflowStatus = String(matchedWorkflow?.status || "").toLowerCase()
    const safeMode = requestedWorkflowMode
      || (workflowStatus === 'not-started'
        ? 'start'
        : workflowStatus === 'on-hold'
          ? 'resume'
          : workflowStatus === 'in-progress'
            ? 'execute'
            : 'view')

    setSelectedWorkflowForExecution(matchedWorkflow)
    setWorkflowExecutionMode(safeMode)
    setWorkflowExecutionModalOpen(true)
    navigate(location.pathname, { replace: true })
  }, [location.pathname, navigate, requestedWorkflowId, requestedWorkflowMode, toast, workflows])

  // Fetch progress timeline for order
  useEffect(() => {
    const fetchProgressTimeline = async () => {
      if (!id) return

      try {
        console.log("OrderDetails: Fetching progress timeline for order:", id)
        const timelineResponse = await getOrderProgressTimeline(id)
        console.log("OrderDetails: Progress timeline received:", timelineResponse)

        setProgressTimeline(timelineResponse)
      } catch (error: any) {
        console.error("OrderDetails: Error fetching progress timeline:", error)
        // Don't show error toast as timeline is not critical
      }
    }

    fetchProgressTimeline()
  }, [id])

  const handleSubmitComplaint = async () => {
    if (!order) return

    if (!complaintReason.trim() || !complaintDescription.trim()) {
      toast({
        title: "Fehlende Angaben",
        description: "Bitte Reklamationsgrund und Beschreibung ausfuellen.",
        variant: "destructive"
      })
      return
    }

    try {
      setSubmittingComplaint(true)
      await createOrderComplaint(order._id, {
        reason: complaintReason.trim(),
        description: complaintDescription.trim()
      })

      toast({
        title: "Reklamation eingereicht",
        description: "Deine Reklamation wurde erfolgreich eingereicht."
      })

      setComplaintDialogOpen(false)
      setComplaintReason("")
      setComplaintDescription("")

      const refreshed = await getOrderById(order._id)
      setOrder((refreshed as any).order)
    } catch (error: any) {
      toast({
        title: "Reklamation fehlgeschlagen",
        description: error?.message || "Die Reklamation konnte nicht eingereicht werden.",
        variant: "destructive"
      })
    } finally {
      setSubmittingComplaint(false)
    }
  }

  const handleAcknowledgeComplaintFromOrder = async () => {
    if (!complaintWorkflow) return

    if (!technicianAckReason.trim()) {
      toast({
        title: "Fehlende Angaben",
        description: "Bitte einen Grund fuer die anerkannte Reklamation angeben.",
        variant: "destructive"
      })
      return
    }

    try {
      setComplaintActionLoading("ack")
      await acknowledgeComplaint(complaintWorkflow._id, {
        technician_reason: technicianAckReason.trim(),
      })

      toast({
        title: "Reklamation anerkannt",
        description: "Die Reklamation wurde durch den Techniker anerkannt."
      })

      const refreshedComplaint = await getComplaint(complaintWorkflow._id)
      setComplaintWorkflow((refreshedComplaint as any)?.complaint || null)
      setComplaintActionDialog(null)
      setAckReasonPreset("")
      setTechnicianAckReason("")
    } catch (error: any) {
      toast({
        title: "Aktion fehlgeschlagen",
        description: error?.message || "Die Reklamation konnte nicht anerkannt werden.",
        variant: "destructive"
      })
    } finally {
      setComplaintActionLoading("")
    }
  }

  const handleDenyComplaintFromOrder = async () => {
    if (!complaintWorkflow) return

    if (!technicianDenyReason.trim()) {
      toast({
        title: "Fehlende Angaben",
        description: "Bitte einen Grund fuer die abgelehnte Reklamation angeben.",
        variant: "destructive"
      })
      return
    }

    try {
      setComplaintActionLoading("deny")
      const response = await denyComplaint(complaintWorkflow._id, {
        technician_reason: technicianDenyReason.trim(),
        offer_amount: denyOfferAmount ? parseFloat(denyOfferAmount) : 0,
        offer_description: denyOfferDescription.trim() || 'Neues Reparaturangebot nach Reklamationspruefung',
      })

      if ((response as any)?.escalated) {
        toast({
          title: "Reklamation eskaliert",
          description: "Die Reklamation wurde an den Admin zur Pruefung weitergeleitet."
        })
      } else {
        toast({
          title: "Reklamation abgelehnt",
          description: "Die Reklamation wurde bestaetigt und das Reparaturangebot wurde dem Kunden uebermittelt."
        })
      }

      const refreshedComplaint = await getComplaint(complaintWorkflow._id)
      setComplaintWorkflow((refreshedComplaint as any)?.complaint || null)
      setComplaintActionDialog(null)
      setDenyReasonPreset("")
      setTechnicianDenyReason("")
      setDenyOfferAmount("")
      setDenyOfferDescription("")
    } catch (error: any) {
      toast({
        title: "Aktion fehlgeschlagen",
        description: error?.message || "Die Reklamation konnte nicht abgelehnt werden.",
        variant: "destructive"
      })
    } finally {
      setComplaintActionLoading("")
    }
  }

  const handleStaffAssignment = async () => {
    if (!id || selectedStaff.length === 0) return

    try {
      setAssigningStaff(true)
      await assignStaffToOrder(id, selectedStaff)

      // Update the order with assigned staff
      if (order) {
        const assignedStaffMembers = availableStaff
          .filter(staff => selectedStaff.includes(staff._id))
          .map(staff => ({
            _id: staff._id,
            name: staff.name,
            avatar: staff.avatar
          }))

        setOrder({
          ...order,
          assignedStaff: assignedStaffMembers
        } as Order)
      }

      setStaffDialogOpen(false)
      setSelectedStaff([])

      toast({
        title: "Success!",
        description: "Staff assigned successfully"
      })
    } catch (error: any) {
      console.error("Staff assignment error:", error.message)
      toast({
        title: "Error",
        description: error.message || "Failed to assign staff",
        variant: "destructive"
      })
    } finally {
      setAssigningStaff(false)
    }
  }

  const handleStaffToggle = (staffId: string, checked: boolean) => {
    setSelectedStaff(prev =>
      checked
        ? [...prev, staffId]
        : prev.filter(id => id !== staffId)
    )
  }

  const refreshOrder = async () => {
    if (!id) return

    try {
      let orderResponse
      if (user?.role === 'admin' || user?.role === 'staff') {
        orderResponse = await getAdminOrderById(id)
      } else {
        orderResponse = await getOrderById(id)
      }
      setOrder((orderResponse as any).order)
    } catch (error) {
      console.error("Error refreshing order:", error)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!id || !order) return

    try {
      setUpdatingStatus(true)
      setStatusDropdownOpen(false)

      console.log('OrderDetails: Updating order status to:', newStatus)
      await updateOrderStatus(id, newStatus)

      toast({
        title: "Success",
        description: `Order status updated to ${newStatus.replace('-', ' ')}`
      })

      // Refresh order data without turning a successful status update into a hard error.
      try {
        await refreshOrder()
      } catch (refreshError) {
        console.warn('OrderDetails: Status updated but refresh failed:', refreshError)
        toast({
          title: "Hinweis",
          description: "Status wurde gespeichert. Die Ansicht wird jetzt neu geladen.",
        })
      }
    } catch (error: any) {
      console.error("OrderDetails: Error updating order status:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update order status",
        variant: "destructive"
      })
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleConfirmPickup = async () => {
    if (!id || !order || confirmingPickup) return
    try {
      setConfirmingPickup(true)
      await confirmPickup(id)
      toast({ title: 'Abholung bestätigt', description: 'Auftrag wurde als Abgeschlossen markiert.' })
      await refreshOrder()
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Abholung konnte nicht bestätigt werden.', variant: 'destructive' })
    } finally {
      setConfirmingPickup(false)
    }
  }

  const handleRemoveEPart = async (ePartId: string) => {
    if (!id) return

    try {
      await removeEPartFromOrder(id, ePartId)

      toast({
        title: "Success",
        description: "EPart removed successfully"
      })

      // Refresh order data
      await refreshOrder()
    } catch (error: any) {
      console.error("Error removing EPart:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove EPart",
        variant: "destructive"
      })
    }
  }

  const handleAddAddon = async () => {
    if (!id) return

    try {
      setSubmittingAddon(true)
      let addonData;

      if (addonInputMode === 'catalog' && selectedAddonService) {
        // Use selected add-on service
        addonData = {
          name: selectedAddonService.name,
          description: selectedAddonService.description,
          price: selectedAddonService.price,
          estimatedTime: selectedAddonService.estimatedTime,
          status: 'pending'
        }
      } else {
        // Use custom add-on data
        if (!customAddonName || !customAddonPrice) {
          toast({
            title: "Fehler",
            description: "Bitte geben Sie Name und Preis für den Zusatzservice an.",
            variant: "destructive"
          })
          return
        }

        const parsedCustomPrice = parseFloat(customAddonPrice)
        if (Number.isNaN(parsedCustomPrice) || parsedCustomPrice <= 0) {
          toast({
            title: "Fehler",
            description: "Der Preis muss größer als 0 sein.",
            variant: "destructive"
          })
          return
        }

        addonData = {
          name: customAddonName,
          description: customAddonDescription,
          price: parsedCustomPrice,
          estimatedTime: customAddonTime,
          status: 'pending'
        }
      }

      await addAddonToOrder(id, addonData)

      toast({
        title: "Erfolg",
        description: "Zusatzservice wurde erfolgreich hinzugefügt."
      })

      // Reset form
      resetAddOnForm()
      setAddAddonDialogOpen(false)

      // Refresh order data
      await refreshOrder()
    } catch (error: any) {
      console.error("Error adding add-on:", error)
      toast({
        title: "Fehler",
        description: error.message || "Zusatzservice konnte nicht hinzugefügt werden.",
        variant: "destructive"
      })
    } finally {
      setSubmittingAddon(false)
    }
  }

  const resetAddOnForm = () => {
    setSelectedAddonService(null)
    setAddonInputMode('catalog')
    setAddonSearchTerm("")
    setShowAddonSuggestions(false)
    setCustomAddonName("")
    setCustomAddonPrice("")
    setCustomAddonDescription("")
    setCustomAddonTime("")
  }

  const handleEditAddon = async () => {
    if (!id || !editingAddon) return

    try {
      const updateData: any = {}

      if (customAddonName && customAddonName !== editingAddon.name) {
        updateData.name = customAddonName
      }
      if (customAddonDescription !== editingAddon.description) {
        updateData.description = customAddonDescription
      }
      if (customAddonPrice && parseFloat(customAddonPrice) !== editingAddon.price) {
        updateData.price = parseFloat(customAddonPrice)
      }
      if (customAddonTime && customAddonTime !== editingAddon.estimatedTime) {
        updateData.estimatedTime = customAddonTime
      }

      await updateOrderAddon(id, editingAddon._id, updateData)

      toast({
        title: "Success",
        description: "Add-on service updated successfully"
      })

      // Reset form
      setEditingAddon(null)
      setCustomAddonName("")
      setCustomAddonPrice("")
      setCustomAddonDescription("")
      setCustomAddonTime("")
      setEditAddonDialogOpen(false)

      // Refresh order data
      await refreshOrder()
    } catch (error: any) {
      console.error("Error updating add-on:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update add-on service",
        variant: "destructive"
      })
    }
  }

  const handleRemoveAddon = async (addonId: string) => {
    if (!id) return

    try {
      await removeAddonFromOrder(id, addonId)

      toast({
        title: "Success",
        description: "Add-on service removed successfully"
      })

      // Refresh order data
      await refreshOrder()
    } catch (error: any) {
      console.error("Error removing add-on:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove add-on service",
        variant: "destructive"
      })
    }
  }

  const handleAssignStaffToAddon = async () => {
    if (!id || !selectedAddonForStaff || !addonStaffId) return

    try {
      await assignStaffToAddon(id, selectedAddonForStaff._id, addonStaffId)

      toast({
        title: "Success",
        description: "Staff assigned to add-on service successfully"
      })

      // Reset form
      setSelectedAddonForStaff(null)
      setAddonStaffId("")
      setAssignAddonStaffDialogOpen(false)

      // Refresh order data
      await refreshOrder()
    } catch (error: any) {
      console.error("Error assigning staff to add-on:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to assign staff to add-on service",
        variant: "destructive"
      })
    }
  }

  const openEditAddonDialog = (addon: any) => {
    setEditingAddon(addon)
    setCustomAddonName(addon.name)
    setCustomAddonPrice(addon.price.toString())
    setCustomAddonDescription(addon.description || "")
    setCustomAddonTime(addon.estimatedTime || "")
    setEditAddonDialogOpen(true)
  }

  // Shop Product Handlers
  const handleAddShopProduct = async (productId: string, quantity: number) => {
    if (!id) return

    try {
      await addShopProductToOrder(id, productId, quantity)

      toast({
        title: "Success",
        description: "Product added to order successfully"
      })

      // Refresh order data
      await refreshOrder()
    } catch (error: any) {
      console.error("Error adding shop product:", error)
      throw error
    }
  }

  const handleRemoveShopProduct = async (productItemId: string) => {
    if (!id) return

    try {
      await removeShopProductFromOrder(id, productItemId)

      toast({
        title: "Success",
        description: "Product removed from order successfully"
      })

      // Refresh order data
      await refreshOrder()
    } catch (error: any) {
      console.error("Error removing shop product:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove product",
        variant: "destructive"
      })
    }
  }

  const handleUpdateShopProductQuantity = async (productItemId: string, newQuantity: number) => {
    if (!id) return

    try {
      await updateShopProductQuantity(id, productItemId, newQuantity)

      toast({
        title: "Success",
        description: "Product quantity updated successfully"
      })

      // Refresh order data
      await refreshOrder()
    } catch (error: any) {
      console.error("Error updating product quantity:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update product quantity",
        variant: "destructive"
      })
    }
  }

  // Repair Service Handlers
  const handleAddRepairService = async (formData: any) => {
    if (!id) return

    try {
      console.log("Adding repair service:", formData)
      await addServiceToOrder(id, formData.serviceId, {
        price: formData.price,
        estimatedTime: formData.estimatedTime,
        notes: formData.notes
      })

      toast({
        title: "Success",
        description: "Repair service added successfully"
      })

      // Refresh repair services
      const orderServicesResponse = await getOrderServices(id)
      setRepairServices((orderServicesResponse as any).services || [])

      // Refresh order data
      await refreshOrder()
    } catch (error: any) {
      console.error("Error adding repair service:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to add repair service",
        variant: "destructive"
      })
    }
  }

  const handleEditRepairService = async (formData: any) => {
    if (!id || !editingService) return

    try {
      console.log("Updating repair service:", editingService._id, formData)
      await updateOrderService(id, editingService._id, {
        price: formData.price,
        estimatedTime: formData.estimatedTime,
        notes: formData.notes
      })

      toast({
        title: "Success",
        description: "Repair service updated successfully"
      })

      setEditingService(null)
      setServiceDialogOpen(false)

      // Refresh repair services
      const orderServicesResponse = await getOrderServices(id)
      setRepairServices((orderServicesResponse as any).services || [])

      // Refresh order data
      await refreshOrder()
    } catch (error: any) {
      console.error("Error updating repair service:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update repair service",
        variant: "destructive"
      })
    }
  }

  const handleDeleteRepairService = async (serviceId: string) => {
    if (!id) return

    try {
      console.log("Removing repair service:", serviceId)
      await removeServiceFromOrder(id, serviceId)

      toast({
        title: "Success",
        description: "Repair service removed successfully"
      })

      // Refresh repair services
      const orderServicesResponse = await getOrderServices(id)
      setRepairServices((orderServicesResponse as any).services || [])

      // Refresh order data
      await refreshOrder()
    } catch (error: any) {
      console.error("Error removing repair service:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove repair service",
        variant: "destructive"
      })
    }
  }

  const openEditServiceDialog = (service: any) => {
    setEditingService(service)
    setServiceDialogOpen(true)
  }

  const handleSaveService = async (formData: any) => {
    if (editingService) {
      await handleEditRepairService(formData)
    } else {
      await handleAddRepairService(formData)
    }
  }

  const openAssignAddonStaffDialog = (addon: any) => {
    setSelectedAddonForStaff(addon)
    setAssignAddonStaffDialogOpen(true)
  }

  const handleConfirmUnlock = async (confirmationStatus: 'verified' | 'incorrect' | 'unable-to-verify', notes: string, requestFromCustomer: boolean = false) => {
    if (!id || !user) return

    try {
      setConfirmingUnlock(true)
      console.log("OrderDetails: Confirming unlock status:", confirmationStatus, "Request from customer:", requestFromCustomer)

      await confirmUnlockCode(id, confirmationStatus, notes)

      // Refresh order to show confirmation
      await refreshOrder()

      // If staff selected to request from customer, send automated message
      if (requestFromCustomer && confirmationStatus === 'unable-to-verify') {
        try {
          // Create a message requesting unlock information
          const customerName = order?.customerId?.name || 'Customer'
          const messageContent = `Hello ${customerName},\n\nWe need to verify the device unlock information for your order. Could you please provide the:\n- Unlock pattern/PIN\n- Unlock code\n- Or confirm if your device has no lock\n\nThis information is required to proceed with the repair.\n\nThank you!`

          // Try to send message if conversation exists
          // This would integrate with the messaging system
          console.log("OrderDetails: Message would be sent to customer:", messageContent)
        } catch (err) {
          console.error("Could not send automated message:", err)
          // Don't fail - the confirmation was still recorded
        }
      }
    } catch (error: any) {
      console.error("OrderDetails: Error confirming unlock:", error)
      throw error
    } finally {
      setConfirmingUnlock(false)
    }
  }

  const handleRequestUnlockUpdate = async (notes: string = '') => {
    if (!id || !user) return
    try {
      setConfirmingUnlock(true)
      await requestUnlockInfoUpdate(id, notes)
      await refreshOrder()
    } catch (error: any) {
      console.error("OrderDetails: Error requesting unlock update:", error)
      throw error
    } finally {
      setConfirmingUnlock(false)
    }
  }

  // Handle device search
  const handleDeviceSearch = async (query: string) => {
    setDeviceSearchQuery(query)

    if (query.length < 2) {
      setDeviceSearchResults([])
      setShowDeviceResults(false)
      return
    }

    try {
      console.log("OrderDetails: Searching devices with query:", query)
      const response = await searchDevices(query)
      setDeviceSearchResults((response as any).devices || [])
      setShowDeviceResults(true)
    } catch (error: any) {
      console.error("OrderDetails: Error searching devices:", error)
      toast({
        title: "Error",
        description: "Failed to search devices",
        variant: "destructive"
      })
    }
  }

  // Handle device selection from search
  const handleSelectDeviceForChange = (device: SearchResult) => {
    console.log("OrderDetails: Device selected for change:", device)
    setSelectedDeviceForChange(device)
    setNewDeviceBrand(device.manufacturer || device.displayName?.split(" ")[0] || "")
    setNewDeviceModel(device.displayName || device.name || "")
    setNewDeviceType(device.deviceType || "Smartphone")
    setDeviceSearchQuery(device.displayName || "")
    setShowDeviceResults(false)
  }

  const handleDeviceChange = async () => {
    if (!id || !newDeviceBrand.trim() || !newDeviceModel.trim()) {
      toast({
        title: "Error",
        description: "Device brand and model are required",
        variant: "destructive"
      })
      return
    }

    try {
      setUpdatingDevice(true)
      console.log("OrderDetails: Updating device information", { newDeviceBrand, newDeviceModel, newDeviceType })

      await updateOrderDevice(id, newDeviceBrand, newDeviceModel, newDeviceType || undefined)

      toast({
        title: "Success",
        description: "Device information updated successfully"
      })

      // Clear form and close dialog
      setNewDeviceBrand("")
      setNewDeviceModel("")
      setNewDeviceType("")
      setDeviceSearchQuery("")
      setDeviceSearchResults([])
      setSelectedDeviceForChange(null)
      setShowDeviceResults(false)
      setDeviceChangeDialogOpen(false)

      // Refresh order to show updated device information
      await refreshOrder()
    } catch (error: any) {
      console.error("OrderDetails: Error updating device:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update device information",
        variant: "destructive"
      })
    } finally {
      setUpdatingDevice(false)
    }
  }

  const handleAssignWorkflow = async (workflowTemplateId: string) => {
    if (!id) return

    try {
      setAssigningWorkflow(true)
      console.log("OrderDetails: Assigning workflow:", workflowTemplateId)

      const selectedWorkflowAssignee =
        workflowAssignedStaffId && workflowAssignedStaffId !== "__unassigned__"
          ? workflowAssignedStaffId
          : undefined

      await assignWorkflowToOrder(id, workflowTemplateId, selectedWorkflowAssignee)

      toast({
        title: "Success",
        description: "Workflow assigned to order successfully"
      })

      setWorkflowDialogOpen(false)
      setWorkflowAssignedStaffId("__unassigned__")

      // Refresh workflows
      const workflowsResponse = await getOrderWorkflows(id)
      setWorkflows((workflowsResponse as any).workflows || [])

      // Refresh order
      await refreshOrder()
    } catch (error: any) {
      console.error("OrderDetails: Error assigning workflow:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to assign workflow",
        variant: "destructive"
      })
    } finally {
      setAssigningWorkflow(false)
    }
  }

  const handleWorkflowUpdate = async () => {
    if (!id) return

    try {
      console.log("OrderDetails: Refreshing workflows after update")
      const workflowsResponse = await getOrderWorkflows(id)
      setWorkflows((workflowsResponse as any).workflows || [])

      // Refresh order to get updated progress
      await refreshOrder()
    } catch (error: any) {
      console.error("OrderDetails: Error refreshing workflows:", error)
    }
  }

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!id) return

    try {
      setDeletingWorkflowId(workflowId)
      console.log("OrderDetails: Deleting workflow:", workflowId)

      await deleteWorkflowFromOrder(id, workflowId)

      toast({
        title: "Success",
        description: "Workflow removed from order successfully"
      })

      // Refresh workflows
      const workflowsResponse = await getOrderWorkflows(id)
      setWorkflows((workflowsResponse as any).workflows || [])

      // Refresh order
      await refreshOrder()
    } catch (error: any) {
      console.error("OrderDetails: Error deleting workflow:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete workflow",
        variant: "destructive"
      })
    } finally {
      setDeletingWorkflowId(null)
    }
  }

  const handleStartWorkflow = (workflowId: string) => {
    const workflow = workflows.find((w: any) => w._id === workflowId)
    if (workflow) {
      setSelectedWorkflowForExecution(workflow)
      setWorkflowExecutionMode('start')
      setWorkflowExecutionModalOpen(true)
    }
  }

  const handleConfirmStartWorkflow = async () => {
    if (!id || !selectedWorkflowForExecution) return

    try {
      setWorkflowActionInProgress({ workflowId: selectedWorkflowForExecution._id, action: 'start' })
      console.log("OrderDetails: Starting workflow:", selectedWorkflowForExecution._id)

      await startWorkflow(id, selectedWorkflowForExecution._id)

      toast({
        title: "Success",
        description: "Workflow started successfully. Now executing steps..."
      })

      // Refresh workflows
      const workflowsResponse = await getOrderWorkflows(id)
      const updatedWorkflows = (workflowsResponse as any).workflows || []
      setWorkflows(updatedWorkflows)

      // Update selected workflow with the latest data
      const updatedWorkflow = updatedWorkflows.find((w: any) => w._id === selectedWorkflowForExecution._id)
      if (updatedWorkflow) {
        setSelectedWorkflowForExecution(updatedWorkflow)
        // Switch to execute mode to show the step execution panel
        setWorkflowExecutionMode('execute')
      }

      // Refresh order
      await refreshOrder()
    } catch (error: any) {
      console.error("OrderDetails: Error starting workflow:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to start workflow",
        variant: "destructive"
      })
    } finally {
      setWorkflowActionInProgress(null)
    }
  }

  const handlePauseWorkflow = async (workflowId: string) => {
    if (!id) return

    try {
      setWorkflowActionInProgress({ workflowId, action: 'pause' })
      console.log("OrderDetails: Pausing workflow:", workflowId)

      await updateWorkflowStatus(id, workflowId, 'on-hold')

      toast({
        title: "Success",
        description: "Workflow paused successfully"
      })

      // Refresh workflows
      const workflowsResponse = await getOrderWorkflows(id)
      setWorkflows((workflowsResponse as any).workflows || [])

      // Refresh order
      await refreshOrder()
    } catch (error: any) {
      console.error("OrderDetails: Error pausing workflow:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to pause workflow",
        variant: "destructive"
      })
    } finally {
      setWorkflowActionInProgress(null)
    }
  }

  const handleResumeWorkflow = (workflowId: string) => {
    const workflow = workflows.find((w: any) => w._id === workflowId)
    if (workflow) {
      setSelectedWorkflowForExecution(workflow)
      setWorkflowExecutionMode('resume')
      setWorkflowExecutionModalOpen(true)
    }
  }

  const handleWorkflowStepComplete = async () => {
    if (!id) return

    try {
      console.log("OrderDetails: Refreshing workflows after step completion")
      // Refresh workflows to get updated step status
      const workflowsResponse = await getOrderWorkflows(id)
      const updatedWorkflows = (workflowsResponse as any).workflows || []
      setWorkflows(updatedWorkflows)

      // Keep the modal in sync with the latest workflow data so it reflects
      // the new step/workflow status (e.g. last step completed → workflow 'completed')
      if (selectedWorkflowForExecution) {
        const refreshedWorkflow = updatedWorkflows.find((w: any) => w._id === selectedWorkflowForExecution._id)
        if (refreshedWorkflow) {
          setSelectedWorkflowForExecution(refreshedWorkflow)
        }
      }

      // Refresh order to get updated progress and status
      await refreshOrder()

      toast({
        title: "Success",
        description: "Workflow step completed successfully"
      })
    } catch (error: any) {
      console.error("OrderDetails: Error refreshing workflows:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to refresh workflow data",
        variant: "destructive"
      })
    }
  }

  const handleConfirmResumeWorkflow = async () => {
    if (!id || !selectedWorkflowForExecution) return

    try {
      setWorkflowActionInProgress({ workflowId: selectedWorkflowForExecution._id, action: 'resume' })
      console.log("OrderDetails: Resuming workflow:", selectedWorkflowForExecution._id)

      await updateWorkflowStatus(id, selectedWorkflowForExecution._id, 'in-progress')

      toast({
        title: "Success",
        description: "Workflow resumed successfully. Now executing steps..."
      })

      // Refresh workflows
      const workflowsResponse = await getOrderWorkflows(id)
      const updatedWorkflows = (workflowsResponse as any).workflows || []
      setWorkflows(updatedWorkflows)

      // Update selected workflow with the latest data
      const updatedWorkflow = updatedWorkflows.find((w: any) => w._id === selectedWorkflowForExecution._id)
      if (updatedWorkflow) {
        setSelectedWorkflowForExecution(updatedWorkflow)
        // Switch to execute mode to show the step execution panel
        setWorkflowExecutionMode('execute')
      }

      // Refresh order
      await refreshOrder()
    } catch (error: any) {
      console.error("OrderDetails: Error resuming workflow:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to resume workflow",
        variant: "destructive"
      })
    } finally {
      setWorkflowActionInProgress(null)
    }
  }

  const handleStartRepairWorkflow = async () => {
    if (!id) return

    try {
      setStartingRepairWorkflow(true)
      console.log("OrderDetails: Initializing repair workflow for order:", id)

      const response = await initializeRepairWorkflow(id, order?.customerId?._id, customerInspection?._id)
      const workflow = (response as any)?.workflow

      setRepairWorkflow(workflow)
      toast({
        title: "Erfolg",
        description: "Reparatur-Workflow wurde initialisiert. Navigiere zur Reparaturseite.",
      })

      // Redirect to repair workflow page
      if (workflow?._id && order?.orderNumber) {
        navigate(`/repair/workflow/${order.orderNumber}`, {
          state: { workflowId: workflow._id }
        })
      }
    } catch (error: any) {
      console.error("OrderDetails: Error starting repair workflow:", error)
      toast({
        title: "Fehler",
        description: error.message || "Reparatur-Workflow konnte nicht gestartet werden",
        variant: "destructive"
      })
    } finally {
      setStartingRepairWorkflow(false)
    }
  }

  const getVersionTypeColor = (versionType: string) => {
    switch (versionType) {
      case 'original':
        return 'bg-blue-500'
      case 'cheap':
        return 'bg-green-500'
      case 'efficient':
        return 'bg-purple-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'status-completed'
      case 'diagnostic-assessment':
        return 'status-in-progress'
      case 'in-progress':
        return 'status-in-progress'
      case 'paused':
        return 'status-paused'
      case 'quality-check':
        return 'status-quality-check'
      case 'ready-for-pickup':
        return 'status-ready-for-pickup'
      case 'pending':
        return 'status-pending'
      case 'cancelled':
        return 'status-cancelled'
      default:
        return 'status-pending'
    }
  }

  const getStatusButtonClasses = (status: string) => {
    switch (status) {
      case 'completed':           return 'bg-emerald-100 text-emerald-900 border border-emerald-400 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-600'
      case 'in-progress':
      case 'diagnostic-assessment': return 'bg-blue-100 text-blue-900 border border-blue-400 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-600'
      case 'paused':              return 'bg-slate-200 text-slate-800 border border-slate-400 hover:bg-slate-300 dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-500'
      case 'quality-check':       return 'bg-purple-100 text-purple-900 border border-purple-400 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-600'
      case 'ready-for-pickup':    return 'bg-orange-100 text-orange-900 border border-orange-400 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-600'
      case 'cancelled':           return 'bg-red-100 text-red-900 border border-red-400 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-600'
      default:                    return 'bg-yellow-100 text-yellow-900 border border-yellow-400 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-200 dark:border-yellow-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'diagnostic-assessment':
        return <Smartphone className="h-4 w-4" />
      case 'in-progress':
        return <Clock className="h-4 w-4" />
      case 'paused':
        return <Clock className="h-4 w-4" />
      case 'quality-check':
        return <AlertCircle className="h-4 w-4" />
      case 'ready-for-pickup':
        return <Package className="h-4 w-4" />
      default:
        return <Package className="h-4 w-4" />
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'payment-paid'
      case 'pending':
        return 'payment-pending'
      case 'refunded':
        return 'payment-refunded'
      case 'partial':
        return 'payment-pending'
      default:
        return 'payment-pending'
    }
  }

  const translatePaymentStatus = (status: string) => {
    switch (status) {
      case 'paid': return 'Bezahlt'
      case 'pending': return 'Ausstehend'
      case 'refunded': return 'Erstattet'
      case 'partial': return 'Teilweise bezahlt'
      case 'unpaid': return 'Nicht bezahlt'
      case 'overdue': return 'Überfällig'
      default: return status
    }
  }

  useEffect(() => {
    let isCancelled = false

    const pickImageUrl = (value: unknown): string | null => {
      return typeof value === 'string' && value.trim() ? value.trim() : null
    }

    const normalize = (value: string = '') => value.toLowerCase().replace(/\s+/g, ' ').trim()
    const normalizeCompact = (value: string = '') => normalize(value).replace(/[^a-z0-9]/g, '')

    const resolveDeviceImage = async () => {
      if (!order) {
        setResolvedDeviceImage(null)
        return
      }

      const orderAny = order as any
      // Only use model images managed in the devices catalog.
      const directCandidates: unknown[] = [
        orderAny.deviceModelId?.image,
        orderAny.deviceModelId?.images?.[0]?.url,
        orderAny.deviceModelId?.images?.[0]?.base64,
        orderAny.deviceModel?.image,
        orderAny.deviceModel?.images?.[0]?.url,
        orderAny.deviceModel?.images?.[0]?.base64,
      ]

      const directImage = directCandidates
        .map((candidate) => pickImageUrl(candidate))
        .find((candidate): candidate is string => Boolean(candidate))

      if (directImage) {
        if (!isCancelled) {
          setResolvedDeviceImage(directImage)
        }
        return
      }

      const brand = normalize(order.deviceBrand)
      const model = normalize(order.deviceModel)
      const compactModel = normalizeCompact(order.deviceModel)
      if (!model) {
        if (!isCancelled) {
          setResolvedDeviceImage(null)
        }
        return
      }

      try {
        const queryCandidates = [
          `${order.deviceBrand || ''} ${order.deviceModel || ''}`.trim(),
          order.deviceModel || '',
          (order.deviceModel || '').replace(/([a-zA-Z])([0-9])/g, '$1 $2').trim(),
          (order.deviceModel || '').replace(/\s+/g, '').trim(),
        ]
          .map((candidate) => candidate.trim())
          .filter((candidate, index, all) => candidate.length > 0 && all.indexOf(candidate) === index)

        let devices: SearchResult[] = []
        for (const query of queryCandidates) {
          const response = await searchDevices(query)
          const foundDevices: SearchResult[] = ((response as any)?.devices || []) as SearchResult[]
          if (foundDevices.length > 0) {
            devices = foundDevices
            break
          }
        }

        const exactBrandAndModel = devices.find((device) => {
          const name = normalize(device.name)
          const compactName = normalizeCompact(device.name)
          const manufacturer = normalize(device.manufacturer)
          return Boolean(device.image) && (name === model || (compactModel && compactName === compactModel)) && (!brand || manufacturer === brand)
        })

        const sameModel = devices.find((device) => {
          const name = normalize(device.name)
          const compactName = normalizeCompact(device.name)
          return Boolean(device.image) && (name === model || (compactModel && compactName === compactModel))
        })

        const fuzzyMatch = devices.find((device) => {
          const name = normalize(device.name)
          const displayName = normalize(device.displayName)
          const compactName = normalizeCompact(device.name)
          const compactDisplayName = normalizeCompact(device.displayName)
          return Boolean(device.image) && (
            displayName.includes(model) ||
            model.includes(name) ||
            (compactModel ? compactDisplayName.includes(compactModel) || compactModel.includes(compactName) : false)
          )
        })

        const bestMatch = exactBrandAndModel || sameModel || fuzzyMatch || devices.find((device) => Boolean(device.image))
        if (!isCancelled) {
          setResolvedDeviceImage(bestMatch?.image || null)
        }
      } catch (error) {
        console.error('OrderDetails: Failed to resolve catalog device image:', error)
        if (!isCancelled) {
          setResolvedDeviceImage(null)
        }
      }
    }

    resolveDeviceImage()

    return () => {
      isCancelled = true
    }
  }, [order?._id, order?.deviceBrand, order?.deviceModel])

  // Helper function to get device image or fallback
  const getDeviceImage = (order: Order) => {
    const orderAny = order as any
    const firstAvailableModelImage = [
      resolvedDeviceImage,
      orderAny.deviceImage,
      orderAny.deviceModelImage,
      orderAny.device?.image,
      orderAny.deviceModel?.image,
      orderAny.deviceModel?.images?.[0]?.url,
      orderAny.deviceModel?.images?.[0]?.base64,
      orderAny.deviceModelId?.image,
      orderAny.deviceModelId?.images?.[0]?.url,
      orderAny.deviceModelId?.images?.[0]?.base64,
    ].find((value) => typeof value === 'string' && value.trim())

    if (typeof firstAvailableModelImage === 'string') {
      return firstAvailableModelImage
    }

    if (order.photos && order.photos.length > 0) {
      return order.photos[0]
    }
    return null
  }

  const getDeviceModelPreviewImage = (order: Order) => {
    const orderAny = order as any
    const modelImageCandidates: unknown[] = [
      resolvedDeviceImage,
      orderAny.deviceModelImage,
      orderAny.deviceImage,
      orderAny.deviceModelId?.image,
      orderAny.deviceModelId?.images?.[0]?.url,
      orderAny.deviceModelId?.images?.[0]?.base64,
      orderAny.deviceModel?.image,
      orderAny.deviceModel?.images?.[0]?.url,
      orderAny.deviceModel?.images?.[0]?.base64,
    ]

    const modelImage = modelImageCandidates.find((value) => typeof value === 'string' && value.trim())
    return typeof modelImage === 'string' ? modelImage : null
  }

  const getCustomerUploadedPhotos = (order: Order): string[] => {
    if (!Array.isArray(order.photos)) {
      return []
    }
    return order.photos.filter((photo) => typeof photo === 'string' && photo.trim().length > 0)
  }

  const openCustomerPhotoViewer = (index: number) => {
    setCustomerPhotoIndex(index)
    setCustomerPhotoZoom(1)
    setCustomerPhotoLensActive(false)
    setCustomerPhotoLensPosition({ x: 50, y: 50 })
    setCustomerPhotoViewerOpen(true)
  }

  const showCustomerPhotoAt = (index: number, total: number) => {
    if (total <= 0) return
    const normalized = ((index % total) + total) % total
    setCustomerPhotoIndex(normalized)
    setCustomerPhotoZoom(1)
    setCustomerPhotoLensActive(false)
    setCustomerPhotoLensPosition({ x: 50, y: 50 })
  }

  const handleCustomerPhotoLensMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 100
    const y = ((event.clientY - bounds.top) / bounds.height) * 100
    setCustomerPhotoLensPosition({
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y)),
    })
  }

  const handleGenerateInspectionReport = async () => {
    if (!id) return

    try {
      setGeneratingInspectionReport(true)
      const result = await generateInspectionReport(id)

      if (result.reportUrl) {
        const link = document.createElement("a")
        link.href = result.reportUrl
        link.download = `inspection-report-${id}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }

      toast({
        title: t('common.success') || "Success",
        description: t('deviceInspection.downloadPdf') || "Inspection report downloaded"
      })
    } catch (error: any) {
      toast({
        title: t('common.error') || "Error",
        description: error?.message || "Failed to generate inspection report",
        variant: "destructive"
      })
    } finally {
      setGeneratingInspectionReport(false)
    }
  }

  const handleInspectionComplete = () => {
    setInspectionDialogOpen(false)
    setInspectionRefreshKey((current) => current + 1)
    refreshOrder()
  }

  if (loading) {
    return (
      <div className="order-details-container">
        <div className="order-section-card animate-pulse">
          <div className="h-7 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-3">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="order-details-container">
        <div className="order-section-card">
          <div className="order-empty-state">
            <Package className="h-20 w-20 mx-auto mb-4 opacity-30" />
            <h3>Order not found</h3>
            <p>The order you're looking for doesn't exist</p>
            <button
              type="button"
              className="order-btn order-btn-primary mt-4"
              onClick={() => handleBackNavigation()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {backButtonLabel}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const customer = order.customerId ?? {
    _id: '',
    name: 'Unknown customer',
    email: 'unknown@customer.local',
    phone: '',
    avatar: '',
    createdAt: '',
  }
  const customerInitials = customer.name
    ? customer.name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase()
    : 'U'
  const customerSinceText = customer.createdAt
    ? new Date(customer.createdAt).toLocaleDateString()
    : '-'
  const isStaffOrAdmin = user?.role === 'admin' || user?.role === 'staff'
  const isCustomer = user?.role === 'customer'
  const isComplaintFollowupOrder = Boolean((order as any)?.isComplaintFollowup)
  const complaintWorkflowStatus = complaintWorkflow?.status || ''
  const canRunComplaintTechnicianActions = isComplaintFollowupOrder && user?.role === 'staff' && complaintWorkflowStatus === 'approved'
  const canRunComplaintAdminDenyReview = isComplaintFollowupOrder && user?.role === 'admin' && complaintWorkflowStatus === 'pending_approval'
  const fallbackBackPath = user?.role === 'admin' ? '/admin/orders' : user?.role === 'staff' ? '/staff/bookings' : '/bookings'
  const backButtonLabel = backTarget?.label || (isStaffOrAdmin ? t('orderDetails.backToOrders') : t('common.back'))

  const handleBackNavigation = () => {
    if (backTarget?.pathname) {
      navigate(`${backTarget.pathname}${backTarget.search || ''}${backTarget.hash || ''}`, {
        state: backTarget.state,
      })
      return
    }

    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate(fallbackBackPath)
  }

  const handleAcceptRepairOffer = async () => {
    if (!complaintWorkflow?._id) return
    try {
      setOfferActionLoading('accept')
      await acceptComplaintOffer(complaintWorkflow._id)
      toast({ title: 'Angebot angenommen', description: 'Das Reparaturangebot wurde angenommen. Der Auftrag wird fortgesetzt.' })
      const refreshed = await getComplaint(complaintWorkflow._id)
      setComplaintWorkflow((refreshed as any)?.complaint || null)
    } catch (err: any) {
      toast({ title: 'Fehler', description: err?.message || 'Das Angebot konnte nicht angenommen werden.', variant: 'destructive' })
    } finally {
      setOfferActionLoading('')
    }
  }

  const handleRejectRepairOffer = async () => {
    if (!complaintWorkflow?._id) return
    try {
      setOfferActionLoading('reject')
      await rejectComplaintOffer(complaintWorkflow._id)
      toast({ title: 'Angebot abgelehnt', description: 'Das Reparaturangebot wurde abgelehnt.' })
      const refreshed = await getComplaint(complaintWorkflow._id)
      setComplaintWorkflow((refreshed as any)?.complaint || null)
    } catch (err: any) {
      toast({ title: 'Fehler', description: err?.message || 'Das Angebot konnte nicht abgelehnt werden.', variant: 'destructive' })
    } finally {
      setOfferActionLoading('')
    }
  }

  const handleConvertAcceptedOfferToBooking = async () => {
    if (!complaintWorkflow?._id) return

    try {
      setConvertOfferBookingLoading(true)
      const response = await convertAcceptedOfferToBooking(complaintWorkflow._id)

      const refreshed = await getComplaint(complaintWorkflow._id)
      setComplaintWorkflow((refreshed as any)?.complaint || null)

      if (response?.converted) {
        toast({
          title: 'Buchung erstellt',
          description: response?.bookingNumber
            ? `Neue Buchung ${response.bookingNumber} wurde erstellt.`
            : 'Neue Buchung mit Auftrag wurde erstellt.',
        })
      } else {
        toast({
          title: 'Bereits umgewandelt',
          description: 'Der Auftrag ist bereits einer Buchung zugeordnet.',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Fehler',
        description: err?.message || 'Die Umwandlung in eine Buchung ist fehlgeschlagen.',
        variant: 'destructive',
      })
    } finally {
      setConvertOfferBookingLoading(false)
    }
  }
  const originalComplaintOrderId = (() => {
    const workflowOrder = (complaintWorkflow as any)?.orderId
    if (!workflowOrder) return (order as any)?.parentOrderId || ''
    return typeof workflowOrder === 'string' ? workflowOrder : (workflowOrder?._id || '')
  })()
  const originalComplaintOrderNumber = (() => {
    const workflowOrder = (complaintWorkflow as any)?.orderId
    if (!workflowOrder) return ''
    return typeof workflowOrder === 'string' ? '' : (workflowOrder?.orderNumber || '')
  })()
  const latestDenyEscalationLog = (() => {
    const logs = complaintWorkflow?.complaintLogs || []
    for (let i = logs.length - 1; i >= 0; i -= 1) {
      if (logs[i]?.action === 'technician_denied_escalated') {
        return logs[i]
      }
    }
    return null
  })()
  const escalationActorName = (latestDenyEscalationLog as any)?.actorName || ''
  const escalationCreatedAt = (latestDenyEscalationLog as any)?.createdAt
  const escalationOfferAmount = (latestDenyEscalationLog as any)?.metadata?.offerAmount
  const escalationOfferDescription = (latestDenyEscalationLog as any)?.metadata?.offerDescription || ''
  const latestOfferConversionLog = (() => {
    const logs = complaintWorkflow?.complaintLogs || []
    for (let i = logs.length - 1; i >= 0; i -= 1) {
      if (logs[i]?.action === 'offer_converted_to_booking') {
        return logs[i]
      }
    }
    return null
  })()
  const convertedBookingId = (latestOfferConversionLog as any)?.metadata?.bookingId
  const convertedBookingNumber = (latestOfferConversionLog as any)?.metadata?.bookingNumber
  const convertedOrderId = (latestOfferConversionLog as any)?.metadata?.orderId
  const convertedOrderNumber = (latestOfferConversionLog as any)?.metadata?.orderNumber
  const hasConvertedAcceptedOffer = Boolean(convertedBookingId && convertedOrderId)
  const bookingOverviewPath = user?.role === 'admin' ? '/admin/bookings' : user?.role === 'staff' ? '/staff/bookings' : '/bookings'
  const staffCount = order.assignedStaff?.length || 0
  const serviceCount = (repairServices?.filter((s) => s && s._id).length || 0) + (order.addOns?.length || 0)
  const lastUpdate = order.updatedAt ? new Date(order.updatedAt).toLocaleString() : '-'
  const normalizedAddonSearch = addonSearchTerm.trim().toLowerCase()
  const filteredAvailableAddons = availableAddons.filter((addon) => {
    if (!normalizedAddonSearch) return true
    const searchable = `${addon.name} ${addon.description || ''}`.toLowerCase()
    return searchable.includes(normalizedAddonSearch)
  })
  const addonSearchResults = normalizedAddonSearch
    ? filteredAvailableAddons.slice(0, 8)
    : []
  const addonPreviewName = addonInputMode === 'catalog' ? (selectedAddonService?.name || '') : customAddonName.trim()
  const addonPreviewPrice = addonInputMode === 'catalog'
    ? safeToNumber(selectedAddonService?.price)
    : safeToNumber(customAddonPrice)
  const addonPreviewTime = addonInputMode === 'catalog'
    ? selectedAddonService?.estimatedTime
    : customAddonTime
  const orderTotalBeforeAddon = safeToNumber((order as any)?.totalCost)
  const orderTotalAfterAddon = orderTotalBeforeAddon + addonPreviewPrice
  const canSubmitAddon = addonInputMode === 'catalog'
    ? Boolean(selectedAddonService)
    : Boolean(customAddonName.trim() && safeToNumber(customAddonPrice) > 0)

  const translateOrderStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
      'Order Received': 'Auftrag erhalten',
      'Booking Created': 'Buchung erstellt',
      'Order Status Updated': 'Auftragsstatus aktualisiert',
      'Repair in Progress': 'Reparatur in Bearbeitung',
      'Add-on Service Added': 'Zusatzservice hinzugefügt',
      'Add-on Service Removed': 'Zusatzservice entfernt',
      'Add-on Service Updated': 'Zusatzservice aktualisiert',
      'Add-on Staff Assigned': 'Mitarbeiter für Zusatzservice zugewiesen',
      'Device Changed': 'Gerät Änderungen',
      'Device Change': 'Gerät Änderungen',
      'Device change': 'Gerät Änderungen',
      'EPart Assigned': 'Ersatzteil zugewiesen',
      'EPart Removed': 'Ersatzteil entfernt',
      'EPart Status Updated': 'Ersatzteilstatus aktualisiert',
      'Staff Assigned': 'Mitarbeiter zugewiesen',
      'Workflow Assigned': 'Workflow zugewiesen',
      'Workflow Navigation': 'Workflow-Navigation',
      'Workflow Removed': 'Workflow entfernt',
      'Workflow Started': 'Workflow gestartet',
      'Workflow Step Completed': 'Workflow-Schritt abgeschlossen',
      'Workflow Step Skipped': 'Workflow-Schritt übersprungen',
      'Workflow Task Assigned': 'Workflow-Aufgabe zugewiesen',
      'Workflow Paused': 'Workflow pausiert',
      'Workflow Resumed': 'Workflow fortgesetzt',
      'Workflow Status Updated': 'Workflow-Status aktualisiert',
      'Diagnostic Assessment': 'Diagnosebewertung',
      'Quality Check': 'Qualitätskontrolle',
      'Completed': 'Abgeschlossen',
      'Ready for Pickup': 'Abholbereit',
      'Shipping Label Created': 'Versandetikett erstellt',
      'Return Label Created': 'Rückgabeetikett erstellt',
      'Return Status Updated': 'Rückgabestatus aktualisiert',
      'cancelled': 'Storniert',
      'items_received': 'Artikel erhalten',
      'payment_updated': 'Zahlung aktualisiert',
      'invoice_uploaded': 'Rechnung hochgeladen',
      'return_exchange_requested': 'Rückgabe/Umtausch angefordert',
      'pending': 'Ausstehend',
      'diagnostic-assessment': 'Diagnosebewertung',
      'in-progress': 'In Bearbeitung',
      'paused': 'Pausiert',
      'completed': 'Abgeschlossen',
      'on-hold': 'Pausiert',
      'diagnosed': 'Diagnostiziert',
      'awaiting-parts': 'Wartet auf Teile',
      'ready-for-pickup': 'Abholbereit',
    }
    if (statusMap[status]) return statusMap[status]
    // Handle dynamic shipping status prefix
    if (status.startsWith('Shipping Status:')) return `Versandstatus:${status.slice('Shipping Status:'.length)}`
    // Handle dynamic return_exchange status
    if (status.startsWith('return_exchange_')) return `Rückgabe/Umtausch – ${status.replace('return_exchange_', '').replace('_', ' ')}`
    return status
  }

  const orderCreatedText = new Date(order.createdAt).toLocaleDateString('de-DE')
  const estimatedCompletionText = order.estimatedCompletion
    ? new Date(order.estimatedCompletion).toLocaleDateString('de-DE')
    : 'Wird aktualisiert'
  const bookingShippingStatus = String(linkedBooking?.shippingStatus || '').toLowerCase()
  const bookingReturnStatus = String(linkedBooking?.returnShipmentStatus || '').toLowerCase()
  const bookingShippingStatusDescription = String(linkedBooking?.shippingStatusDescription || '').trim()
  const bookingReturnStatusDescription = String(linkedBooking?.returnShipmentStatusDescription || '').trim()
  const buildDhlTrackingUrl = (trackingNumber: string) => `https://www.dhl.com/de-de/home/tracking/tracking-parcel.html?submit=1&tracking-id=${encodeURIComponent(trackingNumber)}`
  const getShipmentStatusMeta = (status: string) => {
    switch (String(status || '').toLowerCase()) {
      case 'label-created':
        return { label: 'Label erstellt', className: 'is-created' }
      case 'shipped':
        return { label: 'Versendet', className: 'is-shipped' }
      case 'in-transit':
        return { label: 'In Zustellung', className: 'is-transit' }
      case 'out-for-delivery':
        return { label: 'Heute in Zustellung', className: 'is-transit' }
      case 'delivered':
        return { label: 'Zugestellt', className: 'is-delivered' }
      case 'failed':
        return { label: 'Fehlgeschlagen', className: 'is-failed' }
      case 'pending':
        return { label: 'In Vorbereitung', className: 'is-pending' }
      default:
        return { label: translateOrderStatus(status || 'pending'), className: 'is-pending' }
    }
  }
  const timelineStages = Array.isArray(progressTimeline?.stages) ? progressTimeline.stages : []
  const timelineCurrentStageIndex = (() => {
    if (!timelineStages.length) return -1

    const currentStage = progressTimeline?.currentStage

    if (typeof currentStage === 'number' && Number.isFinite(currentStage)) {
      return Math.max(0, Math.min(timelineStages.length - 1, currentStage))
    }

    if (typeof currentStage === 'string' && currentStage.trim()) {
      const directIdMatch = timelineStages.findIndex((stage: any) => String(stage?.id || '') === currentStage)
      if (directIdMatch >= 0) return directIdMatch

      const normalizedCurrentStage = currentStage.trim().toLowerCase()
      const semanticMatch = timelineStages.findIndex((stage: any) => {
        const candidateValues = [stage?.id, stage?.name, stage?.label]
        return candidateValues.some((candidate) => String(candidate || '').trim().toLowerCase() === normalizedCurrentStage)
      })
      if (semanticMatch >= 0) return semanticMatch
    }

    const inProgressIndex = timelineStages.findIndex((stage: any) => stage?.status === 'in-progress')
    if (inProgressIndex >= 0) return inProgressIndex

    const statusBasedStageId = (() => {
      const normalizedOrderStatus = String(order.status || '').toLowerCase()
      if (normalizedOrderStatus === 'diagnostic-assessment') return 'diagnostic'
      if (normalizedOrderStatus === 'in-progress' || normalizedOrderStatus === 'paused') return 'repair'
      if (normalizedOrderStatus === 'quality-check') return 'quality-check'
      if (normalizedOrderStatus === 'completed' || normalizedOrderStatus === 'ready-for-pickup') return 'pickup'
      if (normalizedOrderStatus !== 'pending') return 'diagnostic'
      return 'order-received'
    })()

    const statusBasedIndex = timelineStages.findIndex((stage: any) => String(stage?.id || '') === statusBasedStageId)
    if (statusBasedIndex >= 0) return statusBasedIndex

    const firstPendingIndex = timelineStages.findIndex((stage: any) => stage?.status !== 'completed')
    return firstPendingIndex >= 0 ? firstPendingIndex : timelineStages.length - 1
  })()
  const timelineCurrentStageId = timelineCurrentStageIndex >= 0
    ? String(timelineStages[timelineCurrentStageIndex]?.id || '')
    : String(progressTimeline?.currentStage || '')
  const activeTimelineStage = timelineCurrentStageIndex >= 0
    ? timelineStages[timelineCurrentStageIndex]
    : null
  const currentStageLabel = activeTimelineStage
    ? translateOrderStatus(activeTimelineStage.label || activeTimelineStage.name || 'Aktiver Schritt')
    : translateOrderStatus(order.status)
  const rawOrderProgress = Math.max(0, Math.min(100, safeToNumber(order.progress)))
  const isRepairStageActive = (() => {
    const normalizedOrderStatus = String(order.status || '').toLowerCase()
    const normalizedStageId = String(activeTimelineStage?.id || '').toLowerCase()
    return normalizedOrderStatus === 'in-progress'
      || normalizedOrderStatus === 'paused'
      || normalizedStageId === 'repair'
  })()
  const timelineProgressValue = timelineStages.length > 1 && timelineCurrentStageIndex >= 0
    ? Math.round((timelineCurrentStageIndex / (timelineStages.length - 1)) * 100)
    : timelineStages.length === 1
      ? 100
      : null
  const statusBasedProgressValue = (() => {
    const normalizedStatus = String(order.status || '').toLowerCase()
    switch (normalizedStatus) {
      case 'pending':
        return 0
      case 'diagnostic-assessment':
        return 25
      case 'in-progress':
      case 'paused':
        return 50
      case 'quality-check':
        return 75
      case 'ready-for-pickup':
      case 'completed':
        return 100
      default:
        return null
    }
  })()
  const repairStageProgressValue = isRepairStageActive
    ? Math.max(50, Math.min(75, Math.round(50 + (rawOrderProgress / 100) * 25)))
    : null
  const calculatedProgressValue = repairStageProgressValue ?? timelineProgressValue ?? statusBasedProgressValue ?? rawOrderProgress
  const customerNextStepInfo = (() => {
    const normalizedStatus = String(order.status || '').toLowerCase()
    const normalizedStage = String(
      activeTimelineStage?.id || activeTimelineStage?.name || activeTimelineStage?.label || ''
    ).toLowerCase()

    if (normalizedStatus === 'completed') {
      return {
        eyebrow: 'Auftrag abgeschlossen',
        steps: [
          'Ihr Auftrag ist vollständig abgeschlossen und dokumentiert.',
          'Im Nachrichtenbereich erhalten Sie bei Bedarf Unterstützung zu Rückfragen oder Nacharbeiten.',
        ],
      }
    }

    if (normalizedStatus === 'ready-for-pickup') {
      return {
        eyebrow: 'Rückgabe organisiert',
        steps: [
          'Ihr Gerät ist bereit zur Abholung oder zum Versand.',
          'Das Team stimmt bei Bedarf Uhrzeit, Übergabe oder Versanddetails mit Ihnen ab.',
        ],
      }
    }

    if (normalizedStatus === 'awaiting-parts') {
      return {
        eyebrow: 'Wartet auf Teile',
        steps: [
          'Es werden aktuell benötigte Ersatzteile organisiert oder geprüft.',
          'Sobald alle Teile verfügbar sind, startet automatisch der nächste Reparaturschritt.',
        ],
      }
    }

    if (normalizedStatus === 'paused' || normalizedStatus === 'on-hold') {
      return {
        eyebrow: 'Auftrag pausiert',
        steps: [
          'Der Auftrag ist vorübergehend angehalten.',
          'Im nächsten Schritt erhalten Sie eine Rückfrage oder Freigabeanforderung, damit die Reparatur fortgesetzt werden kann.',
        ],
      }
    }

    if (normalizedStatus === 'cancelled') {
      return {
        eyebrow: 'Auftrag storniert',
        steps: [
          'Dieser Auftrag wurde storniert und wird nicht weiter bearbeitet.',
          'Bei Unklarheiten können Sie direkt über den Nachrichtenbereich Kontakt aufnehmen.',
        ],
      }
    }

    if (normalizedStatus === 'quality-check' || normalizedStage.includes('quality')) {
      return {
        eyebrow: 'Qualitätskontrolle läuft',
        steps: [
          'Ihr Gerät wird final geprüft und getestet.',
          'Danach wird der Auftrag abgeschlossen oder zur Rückgabe freigegeben.',
        ],
      }
    }

    if (normalizedStatus === 'diagnosed' || normalizedStatus === 'diagnostic-assessment' || normalizedStage.includes('diagnos')) {
      return {
        eyebrow: 'Diagnose abgeschlossen',
        steps: [
          'Die Fehleranalyse ist erfolgt und die nächsten Reparaturmaßnahmen stehen fest.',
          'Als Nächstes startet die eigentliche Reparatur oder die Teilebeschaffung.',
        ],
      }
    }

    if (normalizedStatus === 'in-progress' || normalizedStage.includes('repair')) {
      return {
        eyebrow: 'Reparatur in Bearbeitung',
        steps: [
          'Ihr Gerät wird derzeit aktiv repariert.',
          'Im nächsten Schritt folgt die Qualitätskontrolle, sobald alle Arbeiten abgeschlossen sind.',
        ],
      }
    }

    return {
      eyebrow: 'Auftrag vorbereitet',
      steps: [
        'Ihr Auftrag wurde aufgenommen und für die Bearbeitung vorbereitet.',
        'Als Nächstes beginnt die technische Diagnose und danach die Reparaturplanung.',
      ],
    }
  })()

  const translateOrderDescription = (desc: string): string => {
    if (!desc) return desc

    // Static exact matches
    const exact: Record<string, string> = {
      'Order placed by customer': 'Auftrag vom Kunden erteilt',
      'Orders consolidated into booking': 'Aufträge in Buchung zusammengefasst',
      'Booking status automatically updated based on order progress': 'Buchungsstatus automatisch anhand des Auftragsfortschritts aktualisiert',
      'Booking cancelled': 'Buchung storniert',
      'Order cancelled': 'Auftrag storniert',
      'Device inspection has been initiated by technician': 'Geräteinspektion wurde vom Techniker eingeleitet',
      'Not provided': 'Nicht angegeben',
    }
    if (exact[desc]) return exact[desc]

    let d = desc

    // Workflow status change: Workflow "X" status changed from A to B[ - Reason: R]
    d = d.replace(
      /^Workflow "(.+?)" status changed from (.+?) to (.+?)( - Reason: (.+))?$/,
      (_, wf, from, to, _unused, reason) =>
        `Workflow „${wf}" Statusänderung von ${translateOrderStatus(from)} zu ${translateOrderStatus(to)}${reason ? ` – Grund: ${reason}` : ''}`
    )
    if (d !== desc) return d

    // Order status changed … due to workflow activity
    d = d.replace(
      /^Order status changed from (.+?) to (.+?) due to workflow (?:being paused|status update)$/,
      (_, from, to) => `Auftragsstatus geändert von ${translateOrderStatus(from)} zu ${translateOrderStatus(to)} – Workflow-Status aktualisiert`
    )
    if (d !== desc) return d

    // Order status updated to "Repair in Progress" and assigned to X upon workflow initiation
    d = d.replace(
      /^Order status updated to "Repair in Progress" and assigned to (.+?) upon workflow initiation$/,
      (_, name) => `Auftragsstatus auf „Reparatur in Bearbeitung" gesetzt und ${name} bei Workflow-Start zugewiesen`
    )
    if (d !== desc) return d

    // Step "X" completed in workflow "Y" (actual N min[ vs estimated M min])
    d = d.replace(
      /^Step "(.+?)" completed in workflow "(.+?)"\s*\(actual (\d+) min(?: vs estimated (\d+) min)?\)$/,
      (_, step, wf, actual, estimated) =>
        estimated
          ? `Schritt „${step}" in Workflow „${wf}" abgeschlossen (tatsächlich ${actual} Min. vs. geschätzt ${estimated} Min.)`
          : `Schritt „${step}" in Workflow „${wf}" abgeschlossen (tatsächlich ${actual} Min.)`
    )
    if (d !== desc) return d

    // Step "X" completed in workflow "Y" (no timing)
    d = d.replace(
      /^Step "(.+?)" completed in workflow "(.+?)"$/,
      (_, step, wf) => `Schritt „${step}" in Workflow „${wf}" abgeschlossen`
    )
    if (d !== desc) return d

    // Step "X" in workflow "Y" assigned to: Z
    d = d.replace(
      /^Step "(.+?)" in workflow "(.+?)" assigned to: (.+)$/,
      (_, step, wf, who) => `Schritt „${step}" in Workflow „${wf}" zugewiesen an: ${who}`
    )
    if (d !== desc) return d

    // Step "X" skipped in workflow "Y". Reason: R
    d = d.replace(
      /^Step "(.+?)" skipped in workflow "(.+?)"\. Reason: (.+)$/,
      (_, step, wf, reason) => `Schritt „${step}" in Workflow „${wf}" übersprungen. Grund: ${reason === 'Not provided' ? 'Nicht angegeben' : reason}`
    )
    if (d !== desc) return d

    // Navigated back to step "X" in workflow "Y"
    d = d.replace(
      /^Navigated back to step "(.+?)" in workflow "(.+?)"$/,
      (_, step, wf) => `Zurück zu Schritt „${step}" in Workflow „${wf}" navigiert`
    )
    if (d !== desc) return d

    // Workflow "X" started by Y
    d = d.replace(
      /^Workflow "(.+?)" started by (.+)$/,
      (_, wf, who) => `Workflow „${wf}" gestartet von ${who}`
    )
    if (d !== desc) return d

    // Workflow "X" assigned to order
    d = d.replace(
      /^Workflow "(.+?)" assigned to order(?: and (.+))?$/,
      (_, wf, assignee) => assignee
        ? `Workflow „${wf}" dem Auftrag zugewiesen (Personal: ${assignee})`
        : `Workflow „${wf}" dem Auftrag zugewiesen`
    )
    if (d !== desc) return d

    // Workflow "X" removed from order
    d = d.replace(
      /^Workflow "(.+?)" removed from order$/,
      (_, wf) => `Workflow „${wf}" vom Auftrag entfernt`
    )
    if (d !== desc) return d

    // Assigned to: X
    d = d.replace(/^Assigned to: (.+)$/, (_, who) => `Zugewiesen an: ${who}`)
    if (d !== desc) return d

    // X assigned to Y (staff to addon)
    d = d.replace(/^(.+?) assigned to (.+)$/, (_, who, what) => `${who} ${what} zugewiesen`)
    if (d !== desc) return d

    // Device changed from A B to C D
    d = d.replace(
      /^Device changed from (.+?) to (.+)$/,
      (_, from, to) => `Gerät geändert von ${from} zu ${to}`
    )
    if (d !== desc) return d

    // Device Changed from A B to C D (capitalized variant)
    d = d.replace(
      /^Device Changed from (.+?) to (.+)$/,
      (_, from, to) => `Gerät geändert von ${from} zu ${to}`
    )
    if (d !== desc) return d

    // Device change from A B to C D (alternate wording)
    d = d.replace(
      /^Device change from (.+?) to (.+)$/,
      (_, from, to) => `Gerät geändert von ${from} zu ${to}`
    )
    if (d !== desc) return d

    // X added to order (+$Y)
    d = d.replace(
      /^(.+?) added to order \(\+\$(.+?)\)$/,
      (_, name, price) => `${name} zum Auftrag hinzugefügt (+${price} €)`
    )
    if (d !== desc) return d

    // X removed from order (-$Y)
    d = d.replace(
      /^(.+?) removed from order \(-\$(.+?)\)$/,
      (_, name, price) => `${name} vom Auftrag entfernt (-${price} €)`
    )
    if (d !== desc) return d

    // X (type) xN assigned to order
    d = d.replace(
      /^(.+?) \((.+?)\) x(\d+) assigned to order$/,
      (_, part, type, qty) => `${part} (${type}) ×${qty} dem Auftrag zugewiesen`
    )
    if (d !== desc) return d

    // X (type) xN removed from order
    d = d.replace(
      /^(.+?) \((.+?)\) x(\d+) removed from order$/,
      (_, part, type, qty) => `${part} (${type}) ×${qty} vom Auftrag entfernt`
    )
    if (d !== desc) return d

    // X status changed from A to B
    d = d.replace(
      /^(.+?) status changed from (.+?) to (.+)$/,
      (_, item, from, to) => `${item} Statusänderung von ${translateOrderStatus(from)} zu ${translateOrderStatus(to)}`
    )
    if (d !== desc) return d

    // Status changed from A to B
    d = d.replace(
      /^Status changed from (.+?) to (.+)$/,
      (_, from, to) => `Statusänderung von ${translateOrderStatus(from)} zu ${translateOrderStatus(to)}`
    )
    if (d !== desc) return d

    // Status updated to X
    d = d.replace(
      /^Status updated to (.+)$/,
      (_, to) => `Status aktualisiert auf ${translateOrderStatus(to)}`
    )
    if (d !== desc) return d

    // Billing status updated to X
    d = d.replace(
      /^Billing status updated to (.+)$/,
      (_, to) => `Rechnungsstatus aktualisiert auf ${to}`
    )
    if (d !== desc) return d

    // Order status changed to X
    d = d.replace(
      /^Order status changed to (.+)$/,
      (_, to) => `Auftragsstatus geändert auf ${translateOrderStatus(to)}`
    )
    if (d !== desc) return d

    // Payment status changed to X
    d = d.replace(
      /^Payment status changed to (.+)$/,
      (_, to) => `Zahlungsstatus geändert auf ${to}`
    )
    if (d !== desc) return d

    // Received N units of X
    d = d.replace(
      /^Received (\d+) units of (.+)$/,
      (_, qty, part) => `${qty} Einheiten von ${part} erhalten`
    )
    if (d !== desc) return d

    // Return/Exchange Y
    d = d.replace(
      /^Return\/Exchange (.+)$/,
      (_, status) => `Rückgabe/Umtausch ${status}`
    )
    if (d !== desc) return d

    // Return or Exchange requested: R
    d = d.replace(
      /^(Return|Exchange) requested: (.+)$/,
      (_, type, reason) => `${type === 'Return' ? 'Rückgabe' : 'Umtausch'} angefordert: ${reason}`
    )
    if (d !== desc) return d

    // Invoice file "X" uploaded
    d = d.replace(
      /^Invoice file "(.+?)" uploaded$/,
      (_, file) => `Rechnungsdatei „${file}" hochgeladen`
    )
    if (d !== desc) return d

    // DHL Parcel shipping label created. Tracking number: X
    d = d.replace(
      /^DHL Parcel shipping label created\. Tracking number: (.+)$/,
      (_, tracking) => `DHL-Versandetikett erstellt. Sendungsnummer: ${tracking}`
    )
    if (d !== desc) return d

    // Return shipment status: X
    d = d.replace(
      /^Return shipment status: (.+)$/,
      (_, status) => `Status der Rücksendung: ${status}`
    )
    if (d !== desc) return d

    // DHL return label generated (Tracking: X)
    d = d.replace(
      /^DHL return label generated \(Tracking: (.+?)\)$/,
      (_, tracking) => `DHL-Rücksendeetikett erstellt (Sendungsnummer: ${tracking})`
    )
    if (d !== desc) return d

    // X updated (addon name updated – short form)
    d = d.replace(/^(.+?) updated$/, (_, name) => `${name} aktualisiert`)
    if (d !== desc) return d

    return d
  }

  const progressHistoryEntries = Array.isArray(progressTimeline?.stages)
    ? progressTimeline.stages.map((stage: any, index: number) => {
        const isActiveStage = index === timelineCurrentStageIndex || stage.status === 'in-progress'

        return {
          id: `progress-${stage.id || index}`,
          title: translateOrderStatus(stage.label || stage.name || `Schritt ${index + 1}`),
          description:
            stage.status === 'completed'
              ? 'Meilenstein abgeschlossen'
              : isActiveStage
                ? 'Aktueller Prozessschritt'
                : 'Ausstehender Prozessschritt',
          meta: stage.date || 'Noch kein Zeitstempel vorhanden',
          statusLabel:
            stage.status === 'completed'
              ? 'Abgeschlossen'
              : isActiveStage
                ? 'Aktiv'
                : 'Offen',
          tone:
            stage.status === 'completed'
              ? 'completed'
              : isActiveStage
                ? 'active'
                : 'pending',
        }
      })
    : []
  const orderHistoryEntries = Array.isArray(order.timeline)
    ? [...order.timeline]
        .filter((entry) => entry && (entry.status || entry.description || entry.completedAt))
        .sort((left, right) => {
          const leftTime = left?.completedAt ? new Date(left.completedAt).getTime() : 0
          const rightTime = right?.completedAt ? new Date(right.completedAt).getTime() : 0
          return rightTime - leftTime
        })
        .map((entry, index) => ({
          id: entry._id || `history-${index}`,
          title: entry.status ? translateOrderStatus(entry.status) : 'Statusänderung',
          description: entry.description ? translateOrderDescription(entry.description) : 'Kein Beschreibungstext verfügbar',
          meta: [
            entry.completedAt ? new Date(entry.completedAt).toLocaleString('de-DE') : 'Noch kein Zeitstempel vorhanden',
            entry.staffName || '',
          ].filter(Boolean).join(' • '),
          statusLabel: entry.staffName ? 'Historie' : 'System',
          tone: 'history',
        }))
    : []
  const hasDeviceHistoryTimeline = isStaffOrAdmin && (progressHistoryEntries.length > 0 || orderHistoryEntries.length > 0)

  const staffLastActions = (() => {
    const timeline = Array.isArray(order?.timeline) ? order.timeline : []
    const toId = (v: unknown): string => {
      if (!v) return ''
      if (typeof v === 'string') return v
      if (typeof v === 'number') return String(v)

      if (typeof v === 'object') {
        const raw = v as any
        if (raw._id) {
          try { return String(raw._id) } catch { return '' }
        }
        if (raw.id) {
          try { return String(raw.id) } catch { return '' }
        }
        if (raw.staffId) {
          const nestedStaffId = toId(raw.staffId)
          if (nestedStaffId) return nestedStaffId
        }
      }

      try { return String(v) } catch { return '' }
    }
    const lastActiveEntry = [...timeline]
      .filter(e => e.staffId && e.staffId !== 'system')
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]
    const lastActiveUserId = lastActiveEntry ? toId(lastActiveEntry.staffId) : ''

    const byStaff = (staffUserId: string) =>
      timeline
        .filter(e => e.staffId && toId(e.staffId) === staffUserId)
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())

    return { toId, lastActiveUserId, byStaff }
  })()

  const scrollToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const openDiagnosisPopup = () => {
    setDiagnosisPopupOpen(true)
  }

  const openRepairDetailsPopup = () => {
    setRepairDetailsPopupOpen(true)
  }

  const openRepairServicesPopup = () => {
    setRepairServicesPopupOpen(true)
  }

  const renderAdditionalRepairInfo = () => (
    <div className="space-y-3">
      {/* Error Description */}
      {order.errorDescription && order.errorDescription.trim() ? (
        <div className="bg-white/50 dark:bg-gray-900/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-xs text-amber-900 dark:text-amber-100 mb-1">
                {t('orderDetails.repairInfo.errorDescriptionLabel') || 'Fehlerbeschreibung'}
              </h4>
              <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {order.errorDescription}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-gray-400 dark:text-gray-600" />
            <div className="flex-1">
              <h4 className="font-semibold text-xs text-gray-600 dark:text-gray-400">
                {t('orderDetails.repairInfo.errorDescriptionLabel') || 'Fehlerbeschreibung'}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-600 italic mt-1">
                {t('orderDetails.repairInfo.noInformationProvided') || 'Keine Fehlerbeschreibung vorhanden'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Water Damage */}
      {order.waterDamage && order.waterDamage.trim() ? (
        <div className="bg-white/50 dark:bg-gray-900/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h4 className="font-semibold text-xs text-amber-900 dark:text-amber-100">
                {t('orderDetails.repairInfo.waterDamageLabel') || 'Water Damage'}
              </h4>
            </div>
            <Badge
              variant={order.waterDamage === 'yes' ? 'destructive' : order.waterDamage === 'no' ? 'default' : 'secondary'}
              className={`text-xs px-2 py-0.5 ${
                order.waterDamage === 'yes'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300'
                  : order.waterDamage === 'no'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              {t(`orderDetails.repairInfo.waterDamage.${order.waterDamage}`) || order.waterDamage.charAt(0).toUpperCase() + order.waterDamage.slice(1)}
            </Badge>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-gray-400 dark:text-gray-600" />
              <h4 className="font-semibold text-xs text-gray-600 dark:text-gray-400">
                {t('orderDetails.repairInfo.waterDamageLabel') || 'Wasserschaden'}
              </h4>
            </div>
            <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 text-xs px-2 py-0.5">
              {t('orderDetails.repairInfo.notSpecified') || 'Nicht angegeben'}
            </Badge>
          </div>
        </div>
      )}

      {/* Previous Repair Attempts */}
      {order.previousRepairAttempts && order.previousRepairAttempts.trim() ? (
        <div className="bg-white/50 dark:bg-gray-900/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h4 className="font-semibold text-xs text-amber-900 dark:text-amber-100">
                  {t('orderDetails.repairInfo.previousRepairLabel') || 'Vorherige Reparaturversuche'}
                </h4>
              </div>
              <Badge
                variant={order.previousRepairAttempts === 'yes' ? 'secondary' : 'default'}
                className={`text-xs px-2 py-0.5 ${
                  order.previousRepairAttempts === 'yes'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300'
                    : order.previousRepairAttempts === 'no'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                {t(`orderDetails.repairInfo.previousRepair.${order.previousRepairAttempts}`) || order.previousRepairAttempts.charAt(0).toUpperCase() + order.previousRepairAttempts.slice(1)}
              </Badge>
            </div>
            {order.previousRepairAttempts === 'yes' && order.previousRepairDetails && order.previousRepairDetails.trim() && (
              <div className="ml-6 pl-3 border-l-2 border-amber-400">
                <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {order.previousRepairDetails}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-gray-400 dark:text-gray-600" />
              <h4 className="font-semibold text-xs text-gray-600 dark:text-gray-400">
                {t('orderDetails.repairInfo.previousRepairLabel') || 'Vorherige Reparaturversuche'}
              </h4>
            </div>
            <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 text-xs px-2 py-0.5">
              {t('orderDetails.repairInfo.notSpecified') || 'Nicht angegeben'}
            </Badge>
          </div>
        </div>
      )}

      {/* Item Condition */}
      {order.itemCondition && order.itemCondition.trim() ? (
        <div className="bg-white/50 dark:bg-gray-900/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h4 className="font-semibold text-xs text-amber-900 dark:text-amber-100">
                  {t('orderDetails.repairInfo.itemConditionLabel') || 'Gerätezustand'}
              </h4>
            </div>
            <Badge
              variant="secondary"
              className={`text-xs px-2 py-0.5 ${
                order.itemCondition === 'original'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300'
                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300'
              }`}
            >
              {t(`orderDetails.repairInfo.itemCondition.${order.itemCondition}`) || order.itemCondition.charAt(0).toUpperCase() + order.itemCondition.slice(1)}
            </Badge>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-400 dark:text-gray-600" />
              <h4 className="font-semibold text-xs text-gray-600 dark:text-gray-400">
                {t('orderDetails.repairInfo.itemConditionLabel') || 'Gerätezustand'}
              </h4>
            </div>
            <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 text-xs px-2 py-0.5">
              {t('orderDetails.repairInfo.notSpecified') || 'Nicht angegeben'}
            </Badge>
          </div>
        </div>
      )}
    </div>
  )

  const renderDeviceInformationCard = () => (
    <Card id="order-device-info" className={`order-section-card ${!isStaffOrAdmin ? 'customer-device-card-shell' : ''}`}>
      <CardHeader className="order-section-header">
        <CardTitle className="order-section-title">
          <Camera className="h-5 w-5" />
          {t('orderDetails.deviceInformation')}
        </CardTitle>
        {(user?.role === 'admin' || user?.role === 'staff') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNewDeviceBrand(order?.deviceBrand || "")
              setNewDeviceModel(order?.deviceModel || "")
              setNewDeviceType(order?.deviceType || "Smartphone")
              setDeviceChangeDialogOpen(true)
            }}
            className="text-xs px-2 h-8"
          >
            <Edit className="h-3 w-3 mr-1" />
            {t('common.edit')}
          </Button>
        )}
      </CardHeader>
      <CardContent className={`space-y-4 pt-3 ${!isStaffOrAdmin ? 'customer-device-card-content' : ''}`}>
        <div className={`device-info-card ${!isStaffOrAdmin ? 'customer-device-info-card' : ''}`}>
          {getDeviceImage(order) ? (
            <img
              src={getDeviceImage(order)}
              alt={`${order.deviceBrand} ${order.deviceModel}`}
              className="device-image"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const fallback = e.currentTarget.nextElementSibling as HTMLElement
                if (fallback) fallback.style.display = 'flex'
              }}
            />
          ) : null}
          <div className="device-placeholder" style={{ display: getDeviceImage(order) ? 'none' : 'flex' }}>
            <Smartphone className="h-10 w-10" />
          </div>
          <div className={`details flex-1 ${!isStaffOrAdmin ? 'customer-device-details' : ''}`}>
            <h3>{order.deviceBrand} {order.deviceModel}</h3>
            <p>Repair Services</p>
            <div className="services-tags">
              {order.services && order.services.filter((s) => s && s._id).length > 0 ? (
                order.services.filter((s) => s && s._id).map((service) => {
                  const serviceName = typeof service.serviceId === 'object'
                    ? service.serviceId?.name
                    : service.serviceName || `Service #${String(service._id).substring(0, 8)}`;
                  const servicePrice = typeof service.serviceId === 'object'
                    ? service.serviceId?.price || service.price
                    : service.price;

                  return (
                    <span key={service._id} className="service-tag">
                      {serviceName}
                      {servicePrice && <span className="ml-0.5 font-semibold">${servicePrice.toFixed(2)}</span>}
                    </span>
                  );
                })
              ) : (
                <span className="service-tag">{t('orderDetails.noServicesSelected')}</span>
              )}
            </div>
          </div>
        </div>

        {getCustomerUploadedPhotos(order).length > 0 && (
          <div className="customer-device-section bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {t('orderDetails.customerUploadedPhotos', 'Hochgeladene Fotos')}
              </p>
              <Badge variant="outline" className="text-[11px] px-1.5 py-0">
                {getCustomerUploadedPhotos(order).length}
              </Badge>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {getCustomerUploadedPhotos(order).map((photo, idx) => (
                <button
                  key={`${photo}-${idx}`}
                  type="button"
                  onClick={() => openCustomerPhotoViewer(idx)}
                  className="group relative aspect-square overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label={t('orderDetails.viewPhoto', 'Foto vergrößern')}
                >
                  <img
                    src={photo}
                    alt={`${order.deviceBrand} ${order.deviceModel} ${t('orderDetails.photo', 'Foto')} ${idx + 1}`}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                    <ZoomIn className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {order.customerNotes && (
          <div className={`customer-device-section bg-muted/50 p-3 rounded-lg ${!isStaffOrAdmin ? 'customer-device-notes-card' : ''}`}>
            <h4 className="font-medium text-xs">{t('orderDetails.notes', 'Notes:')}</h4>
            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{order.customerNotes}</p>
          </div>
        )}

        <div id="order-device-lock" className={`customer-device-section space-y-2 border-t pt-3 ${!isStaffOrAdmin ? 'customer-device-lock-card' : ''}`}>
          <h4 className="font-medium text-sm flex items-center gap-1.5">
            <Lock className="h-4 w-4 text-blue-600" />
            {t('orderDetails.deviceLockInformation', 'Device Lock Information')}
          </h4>

          {order.unlockPattern && order.unlockPattern.length > 0 && (
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                {t('orderDetails.unlockPattern', 'Unlock Pattern')}
              </p>
              <div className="flex flex-col items-center gap-1">
                <UnlockPatternVisual pattern={order.unlockPattern} size={140} />
                <span className="text-xs text-slate-500">({order.unlockPattern.length} {t('orderDetails.dots', 'dots')})</span>
              </div>
            </div>
          )}

          {order.unlockCode && (
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-0.5">
                {t('orderDetails.unlockCode', 'Unlock Code')}
              </p>
              <input
                type="password"
                value={order.unlockCode}
                readOnly
                className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-xs"
              />
            </div>
          )}

          {order.noLock && (
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <X className="h-3 w-3 text-green-600 dark:text-green-400" />
                <p className="text-xs font-medium text-green-700 dark:text-green-300">
                  {t('orderDetails.unlockNoLock', 'Device has no lock')}
                </p>
              </div>
            </div>
          )}

          {order.unlockConfirmation && order.unlockConfirmation.confirmationStatus && (
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                {t('orderDetails.confirmationStatus', 'Confirmation Status')}
              </p>
              <div className="space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  {order.unlockConfirmation.confirmationStatus === 'verified' && (
                    <Badge className="bg-green-100 border-green-300 text-green-800 text-xs px-1.5 py-0">
                      <CheckCircle className="h-3 w-3 mr-0.5" />
                      {t('orderDetails.unlockVerified', 'Verified')}
                    </Badge>
                  )}
                  {order.unlockConfirmation.confirmationStatus === 'incorrect' && (
                    <Badge className="bg-red-100 border-red-300 text-red-800 text-xs px-1.5 py-0">
                      <AlertCircle className="h-3 w-3 mr-0.5" />
                      {t('orderDetails.unlockIncorrect', 'Incorrect')}
                    </Badge>
                  )}
                  {order.unlockConfirmation.confirmationStatus === 'unable-to-verify' && (
                    <Badge variant="outline" className="bg-gray-50 border-gray-300 text-gray-800 text-xs px-1.5 py-0">
                      <HelpCircle className="h-3 w-3 mr-0.5" />
                      {t('orderDetails.unlockUnableToVerify', 'Unable to Verify')}
                    </Badge>
                  )}
                </div>
                <p className="text-xs">
                  <span className="font-medium">{t('orderDetails.confirmedBy', 'Confirmed by:')}</span>{' '}
                  {order.unlockConfirmation.confirmedByName}
                </p>
                {order.unlockConfirmation.notes && (
                  <p className="text-xs">
                    <span className="font-medium">{t('orderDetails.notes', 'Notes:')}</span>{' '}
                    {order.unlockConfirmation.notes}
                  </p>
                )}
              </div>
            </div>
          )}

          {!order.unlockPattern?.length && !order.unlockCode && !order.noLock && !order.unlockConfirmation?.confirmationStatus && (
            <div className="bg-muted/50 p-2 rounded-lg text-xs text-muted-foreground">
              {t('orderDetails.repairInfo.noInformationProvided') || 'No information provided'}
            </div>
          )}

          {(user?.role === 'admin' || user?.role === 'staff') && (order.unlockPattern?.length || order.unlockCode || order.noLock || order.unlockConfirmation) && (
            <button
              type="button"
              onClick={() => setUnlockConfirmDialogOpen(true)}
              className="unlock-confirm-btn"
            >
              <span className="unlock-confirm-btn-icon-wrap">
                {order.unlockConfirmation?.confirmationStatus === 'verified' ? (
                  <CheckCircle className="h-3.5 w-3.5" />
                ) : order.unlockConfirmation?.confirmationStatus === 'incorrect' ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="unlock-confirm-btn-label">
                {order.unlockConfirmation
                  ? t('orderDetails.updateConfirmation', 'Update Confirmation')
                  : t('orderDetails.confirmUnlock', 'Confirm Unlock Information')}
              </span>
              <ChevronDown className="unlock-confirm-btn-arrow" style={{ transform: 'rotate(-90deg)' }} />
            </button>
          )}

          <div className="border-t pt-3 mt-1 space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              {t('orderDetails.repairInfo.title') || 'Zusätzliche Reparaturinformationen'}
            </h4>
            {renderAdditionalRepairInfo()}
          </div>



        </div>
      </CardContent>

      <Dialog open={customerPhotoViewerOpen} onOpenChange={setCustomerPhotoViewerOpen}>
        <DialogContent className="order-dialog-content sm:max-w-[860px]">
          <DialogHeader className="order-dialog-header">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {t('orderDetails.customerUploadedPhotos', 'Hochgeladene Fotos')}
            </DialogTitle>
            <DialogDescription>
              {t('orderDetails.photoViewerHint', 'Bewegen Sie den Mauszeiger über das Bild für die Lupenfunktion oder nutzen Sie die Zoom-Tasten.')}
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const customerPhotos = getCustomerUploadedPhotos(order)
            const total = customerPhotos.length
            if (total === 0) {
              return null
            }
            const safeIndex = Math.min(customerPhotoIndex, total - 1)
            const activePhoto = customerPhotos[safeIndex]

            return (
              <div className="space-y-3">
                <div
                  className="relative mx-auto flex max-h-[60vh] w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
                  onMouseEnter={() => setCustomerPhotoLensActive(true)}
                  onMouseLeave={() => setCustomerPhotoLensActive(false)}
                  onMouseMove={handleCustomerPhotoLensMove}
                  style={{ cursor: customerPhotoLensActive ? 'zoom-in' : 'default' }}
                >
                  <img
                    src={activePhoto}
                    alt={`${order.deviceBrand} ${order.deviceModel} ${t('orderDetails.photo', 'Foto')} ${safeIndex + 1}`}
                    className="max-h-[60vh] w-auto select-none object-contain transition-transform duration-150"
                    style={{
                      transform: `scale(${customerPhotoZoom})`,
                      transformOrigin: `${customerPhotoLensPosition.x}% ${customerPhotoLensPosition.y}%`,
                    }}
                    draggable={false}
                  />

                  {customerPhotoLensActive && customerPhotoZoom === 1 && (
                    <div
                      className="pointer-events-none absolute hidden h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg sm:block"
                      style={{
                        left: `${customerPhotoLensPosition.x}%`,
                        top: `${customerPhotoLensPosition.y}%`,
                        backgroundImage: `url(${activePhoto})`,
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '300% 300%',
                        backgroundPosition: `${customerPhotoLensPosition.x}% ${customerPhotoLensPosition.y}%`,
                      }}
                    />
                  )}

                  {total > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => showCustomerPhotoAt(safeIndex - 1, total)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                        aria-label={t('orderDetails.previousPhoto', 'Vorheriges Foto')}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => showCustomerPhotoAt(safeIndex + 1, total)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                        aria-label={t('orderDetails.nextPhoto', 'Nächstes Foto')}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}

                  <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-1">
                    <button
                      type="button"
                      onClick={() => setCustomerPhotoZoom((z) => Math.max(1, Math.round((z - 0.5) * 10) / 10))}
                      className="rounded p-1 text-white transition-colors hover:bg-white/20 disabled:opacity-40"
                      disabled={customerPhotoZoom <= 1}
                      aria-label={t('orderDetails.zoomOut', 'Verkleinern')}
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-[3rem] text-center text-xs font-medium text-white">
                      {Math.round(customerPhotoZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomerPhotoZoom((z) => Math.min(4, Math.round((z + 0.5) * 10) / 10))}
                      className="rounded p-1 text-white transition-colors hover:bg-white/20 disabled:opacity-40"
                      disabled={customerPhotoZoom >= 4}
                      aria-label={t('orderDetails.zoomIn', 'Vergrößern')}
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {total > 1 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {customerPhotos.map((photo, idx) => (
                      <button
                        key={`thumb-${photo}-${idx}`}
                        type="button"
                        onClick={() => showCustomerPhotoAt(idx, total)}
                        className={`h-14 w-14 overflow-hidden rounded-md border-2 transition-colors ${idx === safeIndex ? 'border-blue-500' : 'border-transparent hover:border-slate-300'}`}
                        aria-label={`${t('orderDetails.photo', 'Foto')} ${idx + 1}`}
                      >
                        <img src={photo} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-center text-xs text-muted-foreground">
                  {t('orderDetails.photo', 'Foto')} {safeIndex + 1} / {total}
                </p>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  )

  const renderDeviceInspectionCard = () => (
    <Card id="order-device-inspection" className="order-section-card">
      <CardHeader className="order-section-header">
        <CardTitle className="order-section-title">
          <FileText className="h-5 w-5" />
          Geräteinspektion
        </CardTitle>
        <p className="order-section-description">
          Inspektion starten, fortsetzen oder Ergebnisse direkt einsehen.
        </p>
      </CardHeader>
      <CardContent className="pt-3">
        <InspectionResultsDisplay
          key={`inspection-${id}-${inspectionRefreshKey}`}
          orderId={id!}
          userRole={user?.role}
          onStartInspection={() => setInspectionDialogOpen(true)}
        />
      </CardContent>
    </Card>
  )

  const renderRepairServicesSection = () => (
    <div className="repair-info-subsection repair-info-subsection-services">
      <div className="repair-info-subsection-header flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium text-sm flex items-center gap-1.5">
            <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            {t('orderDetails.repairServices')}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selected repair work and technician notes for this order.
          </p>
        </div>
        {(user?.role === 'admin' || user?.role === 'staff') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingService(null)
              setServiceDialogOpen(true)
            }}
            className="text-xs px-2 h-8"
          >
            <PlusCircle className="h-3 w-3 mr-1" />
            {t('orderDetails.addService')}
          </Button>
        )}
      </div>

      {repairServices && repairServices.filter((s) => s && s._id).length > 0 ? (
        <div className="repair-info-subsection-body space-y-2">
          {repairServices.filter((s) => s && s._id).map((service, index) => (
            <div key={service._id || `service-${index}`} className="service-list-item">
              <div className="service-info flex-1">
                <h4>{service.serviceId?.name || 'Service'}</h4>
                {service.serviceId?.description && (() => {
                  const id = service._id || `service-${index}`;
                  const isExpanded = expandedServiceDescriptions.has(id);
                  const desc = service.serviceId.description;
                  const isLong = desc.length > 80;
                  return (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <span>{isExpanded || !isLong ? desc : desc.slice(0, 80) + '…'}</span>
                      {isLong && (
                        <button
                          onClick={() => setExpandedServiceDescriptions(prev => {
                            const next = new Set(prev);
                            isExpanded ? next.delete(id) : next.add(id);
                            return next;
                          })}
                          className="ml-1 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-medium"
                        >
                          {isExpanded ? t('common.showLess', 'Weniger') : t('common.showMore', 'Mehr')}
                        </button>
                      )}
                    </div>
                  );
                })()}
                {service.notes && (
                  <p className="text-xs text-muted-foreground italic mt-1">{service.notes}</p>
                )}
              </div>
              <div className="service-meta">
                {service.estimatedTime && (
                  <span>
                    <Clock className="h-3 w-3 inline mr-0.5" />
                    {safeToNumber(service.estimatedTime)} min
                  </span>
                )}
                <span className="service-price">${safeToNumber(service.price).toFixed(2)}</span>
              </div>
              {(user?.role === 'admin' || user?.role === 'staff') && (
                <div className="service-actions">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingService(service)
                      setServiceDialogOpen(true)
                    }}
                    className="order-btn-icon text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => service._id && handleDeleteRepairService(service._id)}
                    className="order-btn-icon text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="repair-info-empty-state bg-gray-50 dark:bg-gray-900/20 rounded-lg p-3 border border-gray-200 dark:border-gray-800 text-center text-muted-foreground">
          <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('orderDetails.noRepairServices')}</p>
          {(user?.role === 'admin' || user?.role === 'staff') && (
            <p className="text-xs mt-1">{t('orderDetails.clickToAddService')}</p>
          )}
        </div>
      )}
    </div>
  )

  const renderAddOnServicesSection = () => (
    <div className="repair-info-subsection repair-info-subsection-addons">
      <div className="repair-info-subsection-header flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium text-sm flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            {t('orderDetails.addOnServices')}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Additional optional services associated with this repair order.
          </p>
        </div>
        {(user?.role === 'admin' || user?.role === 'staff') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetAddOnForm()
              setAddAddonDialogOpen(true)
            }}
            className="text-xs px-2 h-8"
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('orderDetails.addAddOn')}
          </Button>
        )}
      </div>

      {order.addOns && order.addOns.length > 0 ? (
        <div className="repair-info-subsection-body space-y-2">
          {order.addOns.map((addOn) => (
            <div key={addOn._id} className="repair-info-addon-item flex items-center justify-between p-3 border rounded-lg bg-white/50 dark:bg-gray-900/20">
              <div className="flex items-center gap-2 flex-1">
                <div className={`w-2 h-2 rounded-full ${
                  addOn.status === 'completed' ? 'bg-green-500' :
                  addOn.status === 'in-progress' ? 'bg-blue-500' :
                  'bg-gray-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm">{addOn.name}</h4>
                  <p className="text-xs text-muted-foreground">{addOn.description}</p>
                  {addOn.estimatedTime && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3 inline mr-0.5" />
                      {safeToNumber(addOn.estimatedTime)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <div className="text-right">
                  <Badge className={`${getStatusColor(addOn.status)} text-xs px-2 py-0.5`}>
                    {addOn.status}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">+${safeToNumber(addOn.price).toFixed(2)}</p>
                </div>
                {(user?.role === 'admin' || user?.role === 'staff') && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditAddonDialog(addOn)}
                      className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 h-8 w-8"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openAssignAddonStaffDialog(addOn)}
                      className="text-green-500 hover:text-green-700 hover:bg-green-50 h-8 w-8"
                    >
                      <UserPlus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAddon(addOn._id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="repair-info-empty-state bg-gray-50 dark:bg-gray-900/20 rounded-lg p-3 border border-gray-200 dark:border-gray-800 text-center text-muted-foreground">
          <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('orderDetails.noAddOnServices')}</p>
          {(user?.role === 'admin' || user?.role === 'staff') && (
            <p className="text-xs mt-1">{t('orderDetails.clickAddAddOn')}</p>
          )}
        </div>
      )}
    </div>
  )

  const renderShopProductsSection = () => (
    <div className="repair-info-subsection repair-info-subsection-shop-products">
      <div className="repair-info-subsection-header flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium text-sm flex items-center gap-1.5">
            <ShoppingCart className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Shop-Produkte
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Produkte aus dem Shop-Bestand, die diesem Reparaturauftrag hinzugefügt wurden.
          </p>
        </div>
        {(user?.role === 'admin' || user?.role === 'staff') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShopProductDialogOpen(true)}
            className="text-xs px-2 h-8"
          >
            <Plus className="h-3 w-3 mr-1" />
            Produkt hinzufügen
          </Button>
        )}
      </div>

      {(order as any).shopProducts && (order as any).shopProducts.length > 0 ? (
        <div className="repair-info-subsection-body space-y-2">
          {(order as any).shopProducts.map((shopProduct: any) => {
            const product = shopProduct.productId;
            const totalPrice = shopProduct.priceAtOrder * shopProduct.quantity;

            return (
              <div key={shopProduct._id} className="repair-info-addon-item flex items-center justify-between p-3 border rounded-lg bg-white/50 dark:bg-gray-900/20">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {product?.images && product.images.length > 0 && (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-14 h-14 object-cover rounded-md flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm">{product?.name || 'Unbekanntes Produkt'}</h4>
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {product?.category}
                      </Badge>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <span>Marke:</span>
                        <span className="font-medium text-foreground">{product?.brand || 'k. A.'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Preis:</span>
                        <span className="font-medium text-foreground">${shopProduct.priceAtOrder?.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Menge:</span>
                        <Input
                          type="number"
                          min="1"
                          max={product?.stock || 999}
                          value={shopProduct.quantity}
                          onChange={(e) => {
                            const newQty = parseInt(e.target.value) || 1;
                            if (newQty > 0) {
                              handleUpdateShopProductQuantity(shopProduct._id, newQty);
                            }
                          }}
                          className="w-16 h-7 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Gesamt:</span>
                        <span className="font-bold text-foreground">${totalPrice.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        Hinzugefügt: {new Date(shopProduct.addedAt).toLocaleDateString()}
                      </span>
                      {shopProduct.addedBy && (
                        <span>
                          Von: {shopProduct.addedBy.name}
                        </span>
                      )}
                      {product?.stock !== undefined && (
                        <Badge variant={product.stock > 10 ? 'default' : product.stock > 0 ? 'secondary' : 'destructive'} className="text-xs px-1.5 py-0">
                          Bestand: {product.stock}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveShopProduct(shopProduct._id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 ml-2 flex-shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="repair-info-empty-state bg-gray-50 dark:bg-gray-900/20 rounded-lg p-3 border border-gray-200 dark:border-gray-800 text-center text-muted-foreground">
          <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Keine Shop-Produkte hinzugefügt</p>
          {(user?.role === 'admin' || user?.role === 'staff') && (
            <p className="text-xs mt-1">Klicken Sie auf „Produkt hinzufügen“, um Produkte aus dem Shop diesem Auftrag hinzuzufügen</p>
          )}
        </div>
      )}
    </div>
  )

  const renderEPartsCard = () => {
    if (!isStaffOrAdmin) {
      return null
    }

    const assignedEParts = (order as any).eParts || []
    const needListEntries = (order as any).ePartNeedListEntries || []
    const hasAnyEPartData = assignedEParts.length > 0 || needListEntries.length > 0

    return (
      <Card id="order-eparts" className="order-section-card">
        <CardHeader className="order-section-header">
          <CardTitle className="order-section-title">
            <Wrench className="h-5 w-5" />
            {t('orderDetails.electronicParts')}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEPartDialogOpen(true)}
            className="text-xs px-2 h-8"
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('orderDetails.addEPart')}
          </Button>
        </CardHeader>
        <CardContent className="pt-3">
          {hasAnyEPartData ? (
            <div className="space-y-2">
              {assignedEParts.map((ePart: any) => {
                const version = ePart.partId?.versions?.find((v: any) => v._id === ePart.versionId)

                return (
                  <div key={ePart._id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">{ePart.partId?.itemName || 'Unknown Part'}</h4>
                        {version && (
                          <Badge className={`${getVersionTypeColor(version.versionType)} text-xs px-2 py-0.5`}>
                            {version.versionType.toUpperCase()}
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-xs px-2 py-0.5 ${
                          ePart.status === 'used' ? 'bg-green-50 text-green-700' :
                          ePart.status === 'allocated' ? 'bg-blue-50 text-blue-700' :
                          'bg-gray-50 text-gray-700'
                        }`}>
                          {ePart.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ePart.partId?.itemDescription || 'No description available'}
                      </p>
                      <div className="flex gap-3 mt-1 text-xs flex-wrap">
                        <span className="text-muted-foreground">
                          SKU: <span className="font-medium text-foreground">{ePart.partId?.sku || 'N/A'}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Qty: <span className="font-medium text-foreground">{ePart.quantity}</span>
                        </span>
                        {version && (
                          <span className="text-muted-foreground">
                            Price: <span className="font-medium text-foreground">${version.sellingPrice?.toFixed(2) || '0.00'}</span>
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          Assigned: <span className="font-medium text-foreground">
                            {new Date(ePart.assignedAt).toLocaleDateString()}
                          </span>
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveEPart(ePart._id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 ml-2"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )
              })}

              {needListEntries.map((entry: any) => {
                const resolvedNeedListStatus = entry.needListId?.status || entry.needListStatus
                const requestedByName = entry.requestedBy?.name || 'Mitarbeiter'

                return (
                  <div key={entry._id} className="p-3 border rounded-lg border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-medium text-sm">{entry.partId?.itemName || 'Unknown Part'}</h4>
                      <Badge variant="outline" className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800">
                        Bedarfsliste
                      </Badge>
                      {resolvedNeedListStatus && (
                        <Badge variant="outline" className="text-xs px-2 py-0.5">
                          {resolvedNeedListStatus}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {entry.partId?.itemDescription || 'No description available'}
                    </p>
                    <div className="flex gap-3 mt-1 text-xs flex-wrap">
                      <span className="text-muted-foreground">
                        SKU: <span className="font-medium text-foreground">{entry.partId?.sku || 'N/A'}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Qty: <span className="font-medium text-foreground">{entry.quantity}</span>
                      </span>
                      <span className="text-muted-foreground inline-flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Liste:{' '}
                        <Link
                          to="/admin/epart-orders"
                          className="font-medium text-amber-700 dark:text-amber-400 hover:underline inline-flex items-center gap-0.5"
                          title="Zur Bedarfslisten-Übersicht"
                        >
                          {entry.needListId?.name || entry.needListName}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      </span>
                      <span className="text-muted-foreground inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Hinzugefuegt: <span className="font-medium text-foreground">{new Date(entry.requestedAt).toLocaleString()}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Durch: <span className="font-medium text-foreground">{requestedByName}</span>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-6">
              <Wrench className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('orderDetails.noElectronicParts')}</p>
              <p className="text-xs mt-1">{t('orderDetails.clickAddEPart')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderRepairProgressCard = () => {
    const progressValue = calculatedProgressValue
    const progressLabel = currentStageLabel || (
      progressValue >= 100 ? 'Abgeschlossen' :
      progressValue >= 75 ? 'Qualitätskontrolle' :
      progressValue >= 50 ? 'Reparatur in Bearbeitung' :
      progressValue >= 25 ? 'Diagnosebewertung' :
      'Auftrag erhalten'
    )

    const progressSteps = progressTimeline?.stages?.length
      ? progressTimeline.stages.map((stage: any, index: number) => ({
          key: stage.id || stage.name || `stage-${index}`,
          label: translateOrderStatus(stage.label || stage.name || `Schritt ${index + 1}`),
          completed: Boolean(stage.completed) || stage.status === 'completed' || (timelineCurrentStageIndex >= 0 && index < timelineCurrentStageIndex),
          active: (timelineCurrentStageIndex >= 0 && index === timelineCurrentStageIndex) || stage.status === 'in-progress',
        }))
      : [
          { key: 'received', label: 'Auftrag erhalten', completed: true, active: progressValue < 25 },
          { key: 'diagnostic', label: 'Diagnosebewertung', completed: progressValue >= 25, active: progressValue >= 25 && progressValue < 50 },
          { key: 'repair', label: 'Reparatur in Bearbeitung', completed: progressValue >= 50, active: progressValue >= 50 && progressValue < 75 },
          { key: 'quality', label: 'Qualitätskontrolle', completed: progressValue >= 75, active: progressValue >= 75 && progressValue < 100 },
          { key: 'pickup', label: 'Abgeschlossen', completed: progressValue >= 100, active: progressValue >= 100 },
        ]

    const resolvedActiveStepIndex = progressSteps.findIndex((step: any) => step.active)
    const firstPendingIndex = progressSteps.findIndex((step: any) => !step.completed)
    const activeStepIndex = resolvedActiveStepIndex >= 0
      ? resolvedActiveStepIndex
      : firstPendingIndex >= 0
        ? firstPendingIndex
        : Math.max(progressSteps.length - 1, 0)

    return (
      <Card id="order-progress" className="order-section-card order-repair-progress-card">
        <CardHeader className="order-section-header">
          <CardTitle className="order-section-title">
            <Clock className="h-5 w-5" />
            {t('orderDetails.repairProgress')}
          </CardTitle>
          <p className="order-section-description">
            Übersicht über den aktuellen Auftragsstatus und die verbleibenden Reparaturschritte.
          </p>
        </CardHeader>
          <CardContent className={`space-y-4 pt-3 ${!isStaffOrAdmin ? 'customer-progress-card-content' : ''}`}>
            <div className={`flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between ${!isStaffOrAdmin ? 'customer-progress-hero' : ''}`}>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Aktueller Status</p>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <Badge className={`${getStatusColor(order.status)} text-xs px-2 py-0.5`}>
                  {translateOrderStatus(order.status)}
                </Badge>
                <span className="text-sm font-semibold">{progressLabel}</span>
              </div>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Fertigstellung</p>
              <p className="text-2xl font-bold text-foreground">{progressValue}%</p>
            </div>
          </div>

          <div className={`space-y-2 ${!isStaffOrAdmin ? 'customer-progress-bar-wrap' : ''}`}>
            <Progress value={progressValue} className="h-3" />
            <div className="flex flex-col gap-1 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
              <span>{t('orderDetails.currentProgress')}</span>
              {order.estimatedCompletion && order.status !== 'completed' ? (
                <span>
                  {t('orderDetails.estimatedCompletion')}: {new Date(order.estimatedCompletion).toLocaleDateString()}
                </span>
              ) : (
                <span>Aktualisiert: {lastUpdate}</span>
              )}
            </div>
          </div>

          <div className={`grid gap-2 md:grid-cols-5 ${!isStaffOrAdmin ? 'customer-progress-steps-grid' : ''}`}>
            {progressSteps.map((step: any, index: number) => {
              const distanceFromActive = Math.abs(index - activeStepIndex)
              const normalizedStepLabel = String(step?.label || '').toLowerCase()
              const isDiagnosticStep = normalizedStepLabel.includes('diagnose')
              const isRepairInProgressStep = normalizedStepLabel.includes('reparatur in bearbeitung')
                || normalizedStepLabel.includes('repair in progress')
                || step.key === 'repair'
              const isOrderReceivedStep = normalizedStepLabel.includes('auftrag erhalten') || step.key === 'received'
              const isFirstStep = index === 0
              const hasReachedStep = isFirstStep || Boolean(step.active || step.completed)
              const isInspectionJumpEnabled = !isStaffOrAdmin && isDiagnosticStep
              const isRepairPopupEnabled = !isStaffOrAdmin && isRepairInProgressStep
              const isRepairDetailsJumpEnabled = !isStaffOrAdmin && isOrderReceivedStep
              const progressStepAction = hasReachedStep && isInspectionJumpEnabled
                ? openDiagnosisPopup
                : hasReachedStep && isRepairPopupEnabled
                  ? openRepairServicesPopup
                : hasReachedStep && isRepairDetailsJumpEnabled
                  ? openRepairDetailsPopup
                  : null
              const progressiveTone = step.active
                ? 'active'
                : step.completed
                  ? 'completed'
                  : distanceFromActive === 1
                    ? 'near'
                    : index > activeStepIndex
                      ? 'future'
                      : 'base'

              return (
              <div
                key={step.key}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  step.completed || step.active
                    ? 'border-[#e5ab00] bg-[#f5b800] text-slate-900'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
                } ${!isStaffOrAdmin ? `customer-progress-step-card customer-progress-step--${progressiveTone}` : ''} ${progressStepAction ? 'customer-progress-step--interactive' : ''}`}
                onClick={progressStepAction || undefined}
                role={progressStepAction ? 'button' : undefined}
                tabIndex={progressStepAction ? 0 : undefined}
                onKeyDown={progressStepAction ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    progressStepAction()
                  }
                } : undefined}
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                    step.completed || step.active
                      ? 'bg-[#1a2a5e] text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {step.completed ? '✓' : step.active ? '•' : '○'}
                  </span>
                  <span className="font-medium leading-tight">{step.label}</span>
                </div>
              </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderCustomerInspectionSummaryContent = () => {
    if (customerInspectionLoading) {
      return (
        <div className="customer-inspection-empty-state">
          <Clock className="h-4 w-4 animate-spin" />
          <span>Diagnosebewertung wird geladen…</span>
        </div>
      )
    }

    if (customerInspection) {
      return (
        <InspectionResultsDisplay
          key={`customer-inspection-${id}-${inspectionRefreshKey}`}
          orderId={id!}
          userRole={user?.role || 'customer'}
        />
      )
    }

    return (
      <div className="customer-inspection-empty-state">
        <AlertCircle className="h-4 w-4" />
        <div>
          <strong>Noch keine Diagnosebewertung verfügbar</strong>
          <p>
            Die Diagnose wird durch unser Team erstellt. Sobald Ergebnisse vorliegen, erscheint hier automatisch eine verständliche Zusammenfassung.
          </p>
        </div>
      </div>
    )
  }

  const renderWorkflowsCard = () => {
    if (!isStaffOrAdmin) {
      return null
    }

    return (
      <Card id="order-workflows" className="order-section-card">
        <CardHeader className="order-section-header">
          <CardTitle className="order-section-title">
            <CheckCircle className="h-5 w-5" />
            {t('orderDetails.workflows')}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWorkflowDialogOpen(true)}
            className="text-xs px-2 h-8"
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('orderDetails.assignWorkflow')}
          </Button>
        </CardHeader>
        {workflows.length > 0 && (
          <CardDescription className="text-xs mt-1 px-4">
            {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} assigned to this order
          </CardDescription>
        )}
        <CardContent className="pt-3">
          {workflows.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-1 lg:grid-cols-2">
              {workflows.map((workflow: any) => (
                <WorkflowCard
                  key={workflow._id}
                  workflow={workflow}
                  orderId={id!}
                  onDelete={handleDeleteWorkflow}
                  onStart={handleStartWorkflow}
                  onPause={handlePauseWorkflow}
                  onResume={handleResumeWorkflow}
                  isDeleting={deletingWorkflowId === workflow._id}
                  isActionInProgress={
                    workflowActionInProgress?.workflowId === workflow._id
                  }
                  actionInProgressType={workflowActionInProgress?.action}
                />
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-6">
              <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('orderDetails.noWorkflowsAssigned')}</p>
              <p className="text-xs mt-1">{t('orderDetails.clickAssignWorkflow')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderCustomerRepairDetailsContent = () => (
    <div className="space-y-4 pt-1">
      <div className="customer-repair-issue-card">
        <div className="customer-repair-issue-header">
          <AlertCircle className="h-4 w-4" />
          <span>Gemeldetes Problem</span>
        </div>
        <p>
          {order.errorDescription && order.errorDescription.trim()
            ? order.errorDescription
            : 'Es wurde noch keine detaillierte Fehlerbeschreibung hinterlegt.'}
        </p>
      </div>

      <div className="customer-repair-meta-grid">
        <div className="customer-repair-meta-card">
          <div className="customer-repair-meta-label">
            <Droplets className="h-4 w-4" />
            Wasserschaden
          </div>
          <strong>
            {order.waterDamage
              ? t(`orderDetails.repairInfo.waterDamage.${order.waterDamage}`) || order.waterDamage
              : 'Nicht angegeben'}
          </strong>
        </div>
        <div className="customer-repair-meta-card">
          <div className="customer-repair-meta-label">
            <Wrench className="h-4 w-4" />
            Frühere Reparaturen
          </div>
          <strong>
            {order.previousRepairAttempts
              ? t(`orderDetails.repairInfo.previousRepair.${order.previousRepairAttempts}`) || order.previousRepairAttempts
              : 'Nicht angegeben'}
          </strong>
          {order.previousRepairAttempts === 'yes' && order.previousRepairDetails && (
            <p>{order.previousRepairDetails}</p>
          )}
        </div>
        <div className="customer-repair-meta-card">
          <div className="customer-repair-meta-label">
            <Package className="h-4 w-4" />
            Gerätezustand
          </div>
          <strong>
            {order.itemCondition
              ? t(`orderDetails.repairInfo.itemCondition.${order.itemCondition}`) || order.itemCondition
              : 'Nicht angegeben'}
          </strong>
        </div>
      </div>

      <div className="customer-repair-note">
        <Info className="h-4 w-4" />
        <p>
          Diese Angaben helfen dem Reparaturteam bei der Einschätzung Ihres Geräts. Falls Rückfragen entstehen, erhalten Sie sie direkt im Nachrichtenbereich dieser Seite.
        </p>
      </div>

      {renderRepairServicesSection()}
      {renderAddOnServicesSection()}
      {renderShopProductsSection()}
    </div>
  )

  const renderCustomerSummaryCard = () => (
    <Card id="order-customer-summary" className="order-section-card customer-order-summary-card">
      <CardHeader className="order-section-header">
        <CardTitle className="order-section-title">
          <FileText className="h-5 w-5" />
          Auftragsübersicht
        </CardTitle>
        <p className="order-section-description">
          Kompakte Zusammenfassung der wichtigsten Auftrags-, Zahlungs- und Versanddaten.
        </p>
      </CardHeader>
      <CardContent className="pt-3 space-y-4">
        <div className="customer-summary-list">
          <div className="customer-summary-row">
            <span>Auftragsnummer</span>
            <strong>{order.orderNumber || order._id.slice(-6)}</strong>
          </div>
          <div className="customer-summary-row">
            <span>Status</span>
            <strong>{translateOrderStatus(order.status)}</strong>
          </div>
          <div className="customer-summary-row">
            <span>Aktiver Schritt</span>
            <strong>{currentStageLabel}</strong>
          </div>
          <div className="customer-summary-row">
            <span>Erstellt am</span>
            <strong>{orderCreatedText}</strong>
          </div>
          <div className="customer-summary-row">
            <span>Letzte Aktualisierung</span>
            <strong>{lastUpdate}</strong>
          </div>
          <div className="customer-summary-row">
            <span>Voraussichtliche Fertigstellung</span>
            <strong>{estimatedCompletionText}</strong>
          </div>
          <div className="customer-summary-row">
            <span>Zahlung</span>
            <strong>{translatePaymentStatus(order.paymentStatus)}</strong>
          </div>
          <div className="customer-summary-row">
            <span>Gesamtbetrag</span>
            <strong>{formatPrice(safeToNumber(order.totalCost))}</strong>
          </div>
        </div>

        {(order.shippingAddress || linkedBooking?.trackingNumber || linkedBooking?.shippingLabelUrl || linkedBooking?.returnLabelUrl || linkedBooking?.shippingStatus || linkedBooking?.returnShipmentStatus) && (
          <div className="customer-summary-subcard">
            <div className="customer-summary-subcard-title">
              <MapPin className="h-4 w-4" />
              Versand & Rücksendung
            </div>
            {order.shippingAddress && (
              <div className="customer-summary-address">
                <p>{order.shippingAddress.street}</p>
                <p>{order.shippingAddress.zipCode} {order.shippingAddress.city}</p>
                <p>{order.shippingAddress.country}</p>
              </div>
            )}
            {(linkedBooking?.trackingNumber || linkedBooking?.shippingLabelUrl || linkedBooking?.shippingStatus) && (
              <div className="customer-summary-logistics-block">
                <div className="customer-summary-logistics-title">Hinsendung zur Buchung</div>
                {linkedBooking?.shippingStatus && (
                  <Badge className={`customer-shipping-status-badge ${getShipmentStatusMeta(bookingShippingStatus).className}`}>
                    {getShipmentStatusMeta(bookingShippingStatus).label}
                  </Badge>
                )}
                {bookingShippingStatusDescription && (
                  <p className="customer-shipping-status-description">{bookingShippingStatusDescription}</p>
                )}
                {linkedBooking?.trackingNumber && (
                  <div className="customer-summary-tracking">
                    <span>Buchungstracking</span>
                    <strong>{linkedBooking.trackingNumber}</strong>
                    {linkedBooking.carrier && <p>{linkedBooking.carrier}</p>}
                    <a
                      href={buildDhlTrackingUrl(linkedBooking.trackingNumber)}
                      target="_blank"
                      rel="noreferrer"
                      className="customer-summary-tracking-link"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      DHL-Sendung verfolgen
                    </a>
                  </div>
                )}

                {!linkedBooking?.shippingLabelUrl && linkedBooking?.shippingStatus && (
                  <div className={`customer-summary-shipping-note ${bookingShippingStatus === 'failed' ? 'is-error' : 'is-pending'}`}>
                    {bookingShippingStatus === 'failed'
                      ? 'Das DHL-Versandlabel für die Buchung konnte noch nicht erstellt werden. Das Team prüft die Versanddaten.'
                      : bookingShippingStatus === 'label-created'
                        ? 'Das DHL-Versandlabel für die Buchung wurde erstellt und wird in Kürze hier zum Download bereitgestellt.'
                        : 'Für die Buchung wird ein DHL-Versandlabel vorbereitet. Sobald es vorliegt, erscheint es hier zum Download.'}
                  </div>
                )}
              </div>
            )}
            {(linkedBooking?.returnLabelUrl || linkedBooking?.returnShipmentStatus) && (
              <div className="customer-summary-logistics-block">
                <div className="customer-summary-logistics-title">Rücksendung</div>
                {linkedBooking?.returnShipmentStatus && (
                  <Badge className={`customer-shipping-status-badge ${getShipmentStatusMeta(bookingReturnStatus).className}`}>
                    {getShipmentStatusMeta(bookingReturnStatus).label}
                  </Badge>
                )}
                {bookingReturnStatusDescription && (
                  <p className="customer-shipping-status-description">{bookingReturnStatusDescription}</p>
                )}
                {linkedBooking?.returnLabelUrl && (
                  <div className="customer-summary-shipping-label">
                    <span>Rücksendeetikett</span>
                    <button
                      onClick={() => downloadBookingReturnLabel(linkedBooking._id, `ruecksendeetikett-${linkedBooking.bookingNumber || linkedBooking._id}.pdf`)}
                      className="customer-summary-label-download"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Rücksendelabel herunterladen
                    </button>
                  </div>
                )}
                {!linkedBooking?.returnLabelUrl && linkedBooking?.returnShipmentStatus && (
                  <div className={`customer-summary-shipping-note ${bookingReturnStatus === 'failed' ? 'is-error' : 'is-pending'}`}>
                    {bookingReturnStatus === 'failed'
                      ? 'Das Rücksendelabel konnte noch nicht bereitgestellt werden. Bitte nutzen Sie vorerst den Nachrichtenbereich.'
                      : bookingReturnStatus === 'label-created'
                        ? 'Das Rücksendelabel wurde erzeugt und wird in Kürze hier zum Download angezeigt.'
                        : 'Wenn eine Rücksendung erforderlich ist, wird das passende DHL-Rücksendeetikett hier eingeblendet.'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="customer-summary-subcard">
          <div className="customer-summary-subcard-title">
            <User className="h-4 w-4" />
            Kontaktdaten
          </div>
          <div className="customer-summary-contact-list">
            <div>
              <Mail className="h-3.5 w-3.5" />
              <span>{customer.email}</span>
            </div>
            <div>
              <Phone className="h-3.5 w-3.5" />
              <span>{customer.phone || 'Keine Telefonnummer hinterlegt'}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderCustomerSupportCard = () => (
    <Card id="order-customer-support" className="order-section-card customer-order-support-card">
      <CardHeader className="order-section-header">
        <CardTitle className="order-section-title">
          <Zap className="h-5 w-5" />
          Nächste Schritte
        </CardTitle>
        <p className="order-section-description">
          Relevante Hinweise und direkte Sprungziele für den weiteren Ablauf Ihres Auftrags.
        </p>
      </CardHeader>
      <CardContent className="pt-3 space-y-4">
        <div className="customer-next-step-panel">
          <span className="customer-next-step-eyebrow">{customerNextStepInfo.eyebrow}</span>
          <ul className="customer-next-step-list">
            {customerNextStepInfo.steps.map((stepText, index) => (
              <li key={`next-step-${index}`}>{stepText}</li>
            ))}
          </ul>
        </div>

        <div className="customer-support-note">
          <Shield className="h-4 w-4" />
          <p>
            Rückfragen, Freigaben oder zusätzliche Informationen laufen gesammelt über diesen Auftrag. So bleibt die Kommunikation nachvollziehbar und schnell auffindbar.
          </p>
        </div>
      </CardContent>
    </Card>
  )

  const renderCustomerMessagesCard = () => (
    <Card id="order-customer-messages" className="order-section-card customer-order-messages-card">
      <CardHeader className="order-section-header">
        <CardTitle className="order-section-title">
          <MessageSquare className="h-5 w-5" />
          Nachrichten zum Auftrag
        </CardTitle>
        <p className="order-section-description">
          Schreiben Sie direkt an das Reparaturteam. Antworten bleiben dem Auftrag zugeordnet und sind jederzeit nachvollziehbar.
        </p>
      </CardHeader>
      <CardContent className="pt-2 space-y-3">
        {/* Repair offer card – shown directly from complaint data so the customer always sees it */}
        {isComplaintFollowupOrder && complaintWorkflow?.repairOffer && complaintWorkflow.repairOffer.status !== 'none' && (
          <>
            {complaintWorkflow.repairOffer.status === 'pending' ? (
              <div className="rounded-lg border-2 border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0 h-8 w-8 rounded-full bg-rose-100 dark:bg-rose-900 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">Neues Reparaturangebot</p>
                      <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-xs">Ihre Entscheidung erforderlich</Badge>
                    </div>
                    <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed whitespace-pre-wrap">
                      {complaintWorkflow.repairOffer.description}
                    </p>
                    {complaintWorkflow.repairOffer.createdAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Erstellt am {new Date(complaintWorkflow.repairOffer.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-lg font-bold text-rose-900 dark:text-rose-100">
                      {complaintWorkflow.repairOffer.amount.toFixed(2)} €
                    </p>
                    <p className="text-xs text-muted-foreground">Angebotspreis</p>
                  </div>
                </div>
                {isCustomer && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                      onClick={handleAcceptRepairOffer}
                      disabled={offerActionLoading !== ''}
                    >
                      {offerActionLoading === 'accept' ? 'Wird bearbeitet...' : '✓ Angebot annehmen'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-rose-300 text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900 text-xs"
                      onClick={handleRejectRepairOffer}
                      disabled={offerActionLoading !== ''}
                    >
                      {offerActionLoading === 'reject' ? 'Wird bearbeitet...' : '✕ Angebot ablehnen'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className={`rounded-lg border p-3 flex items-center gap-3 ${
                complaintWorkflow.repairOffer.status === 'accepted'
                  ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                  : 'bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-700'
              }`}>
                <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  complaintWorkflow.repairOffer.status === 'accepted' ? 'bg-green-100' : 'bg-slate-200'
                }`}>
                  <FileText className={`h-3.5 w-3.5 ${
                    complaintWorkflow.repairOffer.status === 'accepted' ? 'text-green-700' : 'text-slate-500'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${
                    complaintWorkflow.repairOffer.status === 'accepted' ? 'text-green-800 dark:text-green-300' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {complaintWorkflow.repairOffer.status === 'accepted'
                      ? 'Reparaturangebot angenommen'
                      : 'Reparaturangebot abgelehnt'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {complaintWorkflow.repairOffer.amount.toFixed(2)} € &bull;{' '}
                    {complaintWorkflow.repairOffer.status === 'accepted' && complaintWorkflow.repairOffer.acceptedAt
                      ? new Date(complaintWorkflow.repairOffer.acceptedAt).toLocaleDateString('de-DE')
                      : complaintWorkflow.repairOffer.rejectedAt
                      ? new Date(complaintWorkflow.repairOffer.rejectedAt).toLocaleDateString('de-DE')
                      : ''}
                  </p>
                  {complaintWorkflow.repairOffer.status === 'accepted' && !hasConvertedAcceptedOffer && (
                    <Button
                      size="sm"
                      className="mt-2 h-8 text-xs"
                      onClick={handleConvertAcceptedOfferToBooking}
                      disabled={convertOfferBookingLoading}
                    >
                      {convertOfferBookingLoading ? 'Wird umgewandelt...' : 'In neue Buchung mit Auftrag umwandeln'}
                    </Button>
                  )}
                  {complaintWorkflow.repairOffer.status === 'accepted' && hasConvertedAcceptedOffer && (
                    <div className="mt-2 rounded-md border border-green-300 bg-green-100/60 px-3 py-2 text-xs text-green-900 dark:text-green-200 dark:bg-green-900/30 dark:border-green-800 space-y-1">
                      <p className="font-medium">In neue Buchung mit Auftrag umgewandelt.</p>
                      <div className="flex flex-wrap gap-3">
                        <Link to={bookingOverviewPath} className="underline underline-offset-2 hover:no-underline">
                          Buchung {convertedBookingNumber || convertedBookingId}
                        </Link>
                        <Link to={`/orders/${convertedOrderId}`} className="underline underline-offset-2 hover:no-underline">
                          Auftrag {convertedOrderNumber || convertedOrderId}
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        {id && (
          <CommunicationPanel
            orderId={id}
            inspectionId={order?._id}
            entityType="order"
          />
        )}
      </CardContent>
    </Card>
  )

  const renderCustomerLayout = () => (
    <div className="customer-order-flow">
      {renderRepairProgressCard()}

      <div className="customer-order-secondary">
        {renderCustomerMessagesCard()}
        {renderCustomerSupportCard()}
        {renderCustomerSummaryCard()}
      </div>

      <Dialog open={repairDetailsPopupOpen} onOpenChange={setRepairDetailsPopupOpen}>
        <DialogContent className="order-dialog-content customer-repair-details-popup-dialog w-[calc(100vw-12px)] sm:max-w-3xl max-h-[92dvh] overflow-y-auto">
          <DialogHeader className="order-dialog-header">
            <DialogTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Reparaturdetails
            </DialogTitle>
            <DialogDescription className="text-xs">
              Alle kundenrelevanten Informationen zu Fehlerbild, Leistungsumfang und optionalen Zusatzleistungen auf einen Blick.
            </DialogDescription>
          </DialogHeader>

          <div className="customer-repair-details-popup-body">
            {renderCustomerRepairDetailsContent()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={diagnosisPopupOpen} onOpenChange={setDiagnosisPopupOpen}>
        <DialogContent className="order-dialog-content customer-diagnosis-popup-dialog w-[calc(100vw-12px)] sm:max-w-2xl max-h-[92dvh] overflow-y-auto">
          <DialogHeader className="order-dialog-header">
            <DialogTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Diagnosebewertung
            </DialogTitle>
            <DialogDescription className="text-xs">
              Übersicht der technischen Diagnose und aller bisher erfassten Prüfergebnisse.
            </DialogDescription>
          </DialogHeader>

          <div className="customer-diagnosis-popup-body">
            {renderCustomerInspectionSummaryContent()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={repairServicesPopupOpen} onOpenChange={setRepairServicesPopupOpen}>
        <DialogContent className="order-dialog-content customer-repair-services-dialog w-[calc(100vw-12px)] sm:max-w-2xl max-h-[92dvh] overflow-y-auto">
          <DialogHeader className="order-dialog-header">
            <DialogTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Reparatur in Bearbeitung
            </DialogTitle>
            <DialogDescription className="text-xs">
              Hier sehen Sie die aktuell geplanten Reparaturdienste und Zusatzdienste für diesen Auftrag.
            </DialogDescription>
          </DialogHeader>

          <div className="customer-repair-services-popup-body">
            <section className="customer-repair-services-popup-section">
              <h4>Reparaturdienste</h4>
              {repairServices && repairServices.filter((s) => s && s._id).length > 0 ? (
                <div className="customer-repair-services-popup-list">
                  {repairServices.filter((s) => s && s._id).map((service, index) => (
                    <div key={service._id || `popup-service-${index}`} className="customer-repair-services-popup-item">
                      <div>
                        <p className="title">{service.serviceId?.name || 'Reparaturdienst'}</p>
                        {service.serviceId?.description && (
                          <p className="description">{service.serviceId.description}</p>
                        )}
                        {service.notes && (
                          <p className="notes">Hinweis: {service.notes}</p>
                        )}
                      </div>
                      <div className="meta">
                        <Badge variant="outline" className="text-xs">
                          {formatPrice(safeToNumber(service.price))}
                        </Badge>
                        {service.estimatedTime && (
                          <Badge variant="secondary" className="text-xs">
                            {safeToNumber(service.estimatedTime)} min
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="customer-repair-services-popup-empty">
                  Noch keine Reparaturdienste hinterlegt.
                </div>
              )}
            </section>

            <section className="customer-repair-services-popup-section">
              <h4>Zusatzdienste</h4>
              {order.addOns && order.addOns.length > 0 ? (
                <div className="customer-repair-services-popup-list">
                  {order.addOns.map((addOn) => (
                    <div key={addOn._id} className="customer-repair-services-popup-item">
                      <div>
                        <p className="title">{addOn.name}</p>
                        {addOn.description && <p className="description">{addOn.description}</p>}
                      </div>
                      <div className="meta">
                        <Badge variant="outline" className="text-xs">
                          {formatPrice(safeToNumber(addOn.price))}
                        </Badge>
                        {addOn.estimatedTime && (
                          <Badge variant="secondary" className="text-xs">
                            {safeToNumber(addOn.estimatedTime)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="customer-repair-services-popup-empty">
                  Keine Zusatzdienste für diesen Auftrag ausgewählt.
                </div>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )

  return (
    <div className={`order-details-container ${isStaffOrAdmin ? 'admin-order-workspace' : 'customer-order-workspace'}`}>
      {/* Back Button */}
      <button
        type="button"
        className="order-back-button"
        onClick={handleBackNavigation}
      >
        <ArrowLeft className="h-4 w-4" />
        {backButtonLabel}
      </button>

      {/* Order Header */}
      <div className="order-details-header">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="order-header-title-block">
            {isStaffOrAdmin ? (
              <>
                <h1>
                  <Package className="h-7 w-7" />
                  Order #{order.orderNumber || order._id.slice(-6)}
                </h1>
                <p>
                  {order.deviceBrand} {order.deviceModel} • {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </>
            ) : (
              <div className="customer-dashboard-device-head">
                {getDeviceModelPreviewImage(order) ? (
                  <img
                    src={getDeviceModelPreviewImage(order) as string}
                    alt={`${order.deviceBrand} ${order.deviceModel}`}
                    className="customer-dashboard-device-image"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement
                      if (fallback) fallback.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div className="customer-dashboard-device-placeholder" style={{ display: getDeviceModelPreviewImage(order) ? 'none' : 'flex' }}>
                  <Smartphone className="h-6 w-6" />
                </div>
                <div className="customer-dashboard-device-copy">
                  <h2>{order.deviceBrand} {order.deviceModel}</h2>
                  <p>Auftrag #{order.orderNumber || order._id.slice(-6)} • Erstellt am {orderCreatedText}</p>
                </div>
              </div>
            )}
            {isComplaintFollowupOrder && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge className="bg-rose-100 text-rose-800 border border-rose-300" variant="outline">
                  Reklamationsauftrag
                </Badge>
                <span className="text-muted-foreground">Basiert auf Auftrag:</span>
                {originalComplaintOrderId ? (
                  <Link
                    to={`/orders/${originalComplaintOrderId}`}
                    className="font-medium text-blue-600 underline"
                  >
                    {originalComplaintOrderNumber || originalComplaintOrderId}
                  </Link>
                ) : (
                  <span className="font-medium">Nicht verknuepft</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap order-header-meta-block">
            {isStaffOrAdmin ? (
              <DropdownMenu open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${getStatusButtonClasses(order.status)} text-xs px-3 py-1.5 cursor-pointer font-semibold flex items-center gap-1.5 rounded-md`}
                    disabled={updatingStatus}
                  >
                    {getStatusIcon(order.status)}
                    <span>{translateOrderStatus(order.status)}</span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs font-semibold">Auftragsstatus ändern</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleStatusChange('pending')} disabled={updatingStatus || order.status === 'pending'} className="text-xs cursor-pointer">
                    <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                    Ausstehend
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange('in-progress')} disabled={updatingStatus || order.status === 'in-progress'} className="text-xs cursor-pointer">
                    <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    In Bearbeitung
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange('paused')} disabled={updatingStatus || order.status === 'paused'} className="text-xs cursor-pointer">
                    <span className="inline-block w-2 h-2 bg-slate-500 rounded-full mr-2"></span>
                    Pausiert
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange('quality-check')} disabled={updatingStatus || order.status === 'quality-check'} className="text-xs cursor-pointer">
                    <span className="inline-block w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                    Qualitätskontrolle
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange('ready-for-pickup')} disabled={updatingStatus || order.status === 'ready-for-pickup'} className="text-xs cursor-pointer">
                    <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                    Abholbereit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange('completed')} disabled={updatingStatus || order.status === 'completed'} className="text-xs cursor-pointer">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Abgeschlossen
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleStatusChange('cancelled')} disabled={updatingStatus || order.status === 'cancelled'} className="text-xs cursor-pointer text-destructive">
                    <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                    Storniert
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className={`order-status-badge ${getStatusColor(order.status)} text-xs px-3 py-1`}>
                {getStatusIcon(order.status)}
                <span className="ml-1">{translateOrderStatus(order.status)}</span>
              </span>
            )}
            {isStaffOrAdmin && order.status === 'ready-for-pickup' && !order.pickupConfirmation && (
              <Button
                size="sm"
                onClick={handleConfirmPickup}
                disabled={confirmingPickup}
                className="text-xs bg-green-600 hover:bg-green-700 text-white border-0 shadow-sm gap-1.5 font-medium"
              >
                <PackageCheck className="h-3.5 w-3.5" />
                {confirmingPickup ? 'Wird bestätigt…' : 'Abholung bestätigen'}
              </Button>
            )}
            {order.pickupConfirmation?.confirmedAt && (
              <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md px-2.5 py-1">
                <UserCheck className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Abgeholt{' '}
                  {new Date(order.pickupConfirmation.confirmedAt).toLocaleString('de-DE', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                  {order.pickupConfirmation.confirmedByName && (
                    <> · {order.pickupConfirmation.confirmedByName}</>
                  )}
                </span>
              </div>
            )}
            <span className={`payment-status-badge ${getPaymentStatusColor(order.paymentStatus)}`}>
              <CreditCard className="h-3 w-3 mr-1" />
              {translatePaymentStatus(order.paymentStatus)}
            </span>
            {isStaffOrAdmin && (
              <div className="order-total-cost">
                <div className="amount">{safeToNumber(order.totalCost).toFixed(2)} €</div>
                <div className="label">Gesamt</div>
              </div>
            )}
            {!isStaffOrAdmin && order.status === 'completed' && !order.hasComplaint && (
              <Button
                size="sm"
                onClick={() => setComplaintDialogOpen(true)}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white border-0 shadow-sm gap-1.5 font-medium"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                Reklamation anmelden
              </Button>
            )}
          </div>
        </div>

        {isStaffOrAdmin && (
          <div className="order-admin-kpi-grid">
            <div className="order-admin-kpi-card">
              <span>Fortschritt</span>
              <strong>{calculatedProgressValue}%</strong>
            </div>
            <div className="order-admin-kpi-card">
              <span>Status</span>
              <strong>{translateOrderStatus(order.status)}</strong>
            </div>
            <div className="order-admin-kpi-card">
              <span>Zugewiesenes Personal</span>
              <strong>{staffCount}</strong>
            </div>
            <div className="order-admin-kpi-card">
              <span>Leistungen</span>
              <strong>{serviceCount}</strong>
            </div>
            <div className="order-admin-kpi-card">
              <span>Letzte Aktualisierung</span>
              <strong>{lastUpdate}</strong>
            </div>
          </div>
        )}
      </div>

      {!isStaffOrAdmin ? (
        renderCustomerLayout()
      ) : (
        <>
          <div className="order-grid">
            {/* Main Content */}
            <div className="order-main-content space-y-4">
              <div className={`order-nested-block order-nested-top-grid ${isStaffOrAdmin ? 'is-admin-nested' : ''}`}>
              {renderDeviceInformationCard()}
              {renderDeviceInspectionCard()}
              {renderEPartsCard()}
              {renderRepairProgressCard()}
              {renderWorkflowsCard()}

              {/* Additional Repair Information - Always visible */}
              <Card id="order-repair-info" className="order-section-card border-2 border-amber-300 dark:border-amber-700 order-card-repair-info">
                <CardHeader className="order-section-header bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40">
                  <CardTitle className="order-section-title">
                    <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    {t('orderDetails.servicesAndProducts.title') || 'Reparaturleistungen & Produkte'}
                  </CardTitle>
                  <p className="order-section-description">
                    {t('orderDetails.servicesAndProducts.description') || 'Gebuchte Reparaturdienste, Zusatzleistungen und Produkte für diesen Auftrag'}
                  </p>
                </CardHeader>
                <CardContent className="pt-3 space-y-3">
                  <div>

                {renderRepairServicesSection()}

                {renderAddOnServicesSection()}

                {renderShopProductsSection()}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card id="order-quick-actions" className="order-section-card order-quick-actions-card">
                <CardHeader className="order-section-header">
                  <CardTitle className="order-section-title">
                    <Zap className="h-5 w-5" />
                    Schnellaktionen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  {isStaffOrAdmin ? (
                    <>
                    </>
                  ) : null}

                  <div className="border-t pt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600" />
                      <h4 className="font-medium text-sm">{t('orderDetails.customerInformation')}</h4>
                    </div>

                    <div className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={customer.avatar} />
                          <AvatarFallback className="text-xs">
                            {customerInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{customer.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 break-all">
                            <Mail className="h-3 w-3" />
                            {customer.email}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" />
                            {customer.phone || '-'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('orderDetails.customerSince')} {customerSinceText}
                          </p>
                        </div>
                      </div>

                      {customer.address && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-medium flex items-center gap-1">
                            <Home className="h-3 w-3" />
                            {t('orderDetails.address')}
                          </p>
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            <p>{customer.address.street}</p>
                            <p>{customer.address.city}, {customer.address.state} {customer.address.zipCode}</p>
                            <p>{customer.address.country}</p>
                          </div>
                        </div>
                      )}

                      {customer.paymentMethods && customer.paymentMethods.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-medium flex items-center gap-1 mb-1">
                            <CreditCard className="h-3 w-3" />
                            {t('orderDetails.paymentMethods')}
                          </p>
                          <div className="space-y-1">
                            {customer.paymentMethods.slice(0, 2).map((method) => (
                              <div key={`${method.type}-${method.last4}`} className="flex items-center justify-between text-xs">
                                <span className="capitalize">{method.type} ending in {method.last4}</span>
                                {method.isDefault && (
                                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5">{t('orderDetails.default')}</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div id="order-quick-actions-communication" className="border-t pt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1a2a5e]/10">
                        <MessageSquare className="h-4 w-4 text-[#1a2a5e]" />
                      </span>
                      <h4 className="font-semibold text-sm text-[#1a2a5e]">Kundenkommunikation</h4>
                    </div>
                    {isStaffOrAdmin && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-[#f5b800] text-[#1a2a5e] hover:bg-[#e5ab00] font-semibold border-0"
                          onClick={() => setCommFeedbackOpen(true)}
                        >
                          <HelpCircle className="h-4 w-4 mr-1.5" />
                          Rückmeldung
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-[#f5b800] text-[#1a2a5e] hover:bg-[#e5ab00] font-semibold border-0"
                          onClick={() => setCommQuickActionOpen(true)}
                        >
                          <Zap className="h-4 w-4 mr-1.5" />
                          Aktion
                        </Button>
                      </div>
                    )}

                    {/* Repair Offer Card — shown when complaint is denied and offer is pending */}
                    {isComplaintFollowupOrder && complaintWorkflow?.repairOffer && complaintWorkflow.repairOffer.status === 'pending' && (
                      <div className="rounded-lg border-2 border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800 p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex-shrink-0 h-8 w-8 rounded-full bg-rose-100 dark:bg-rose-900 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">Neues Reparaturangebot</p>
                              <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-xs">Ihre Entscheidung erforderlich</Badge>
                            </div>
                            <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed whitespace-pre-wrap">
                              {complaintWorkflow.repairOffer.description}
                            </p>
                            {complaintWorkflow.repairOffer.createdAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Erstellt am {new Date(complaintWorkflow.repairOffer.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="text-lg font-bold text-rose-900 dark:text-rose-100">
                              {complaintWorkflow.repairOffer.amount.toFixed(2)} €
                            </p>
                            <p className="text-xs text-muted-foreground">Angebotspreis</p>
                          </div>
                        </div>

                        {isCustomer && (
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                              onClick={handleAcceptRepairOffer}
                              disabled={offerActionLoading !== ''}
                            >
                              {offerActionLoading === 'accept' ? 'Wird bearbeitet...' : '✓ Angebot annehmen'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 border-rose-300 text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900 text-xs"
                              onClick={handleRejectRepairOffer}
                              disabled={offerActionLoading !== ''}
                            >
                              {offerActionLoading === 'reject' ? 'Wird bearbeitet...' : '✕ Angebot ablehnen'}
                            </Button>
                          </div>
                        )}

                        {!isCustomer && (
                          <p className="text-xs text-muted-foreground italic">Warte auf Kundenentscheidung.</p>
                        )}
                      </div>
                    )}

                    {/* Offer decided — show result */}
                    {isComplaintFollowupOrder && complaintWorkflow?.repairOffer && complaintWorkflow.repairOffer.status !== 'pending' && complaintWorkflow.repairOffer.status !== 'none' && (
                      <div className={`rounded-lg border p-3 flex items-center gap-3 ${
                        complaintWorkflow.repairOffer.status === 'accepted'
                          ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                          : 'bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-700'
                      }`}>
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          complaintWorkflow.repairOffer.status === 'accepted' ? 'bg-green-100' : 'bg-slate-200'
                        }`}>
                          <FileText className={`h-3.5 w-3.5 ${
                            complaintWorkflow.repairOffer.status === 'accepted' ? 'text-green-700' : 'text-slate-500'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${
                            complaintWorkflow.repairOffer.status === 'accepted' ? 'text-green-800 dark:text-green-300' : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {complaintWorkflow.repairOffer.status === 'accepted'
                              ? 'Reparaturangebot angenommen'
                              : 'Reparaturangebot abgelehnt'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {complaintWorkflow.repairOffer.amount.toFixed(2)} € &bull;{' '}
                            {complaintWorkflow.repairOffer.status === 'accepted' && complaintWorkflow.repairOffer.acceptedAt
                              ? new Date(complaintWorkflow.repairOffer.acceptedAt).toLocaleDateString('de-DE')
                              : complaintWorkflow.repairOffer.rejectedAt
                              ? new Date(complaintWorkflow.repairOffer.rejectedAt).toLocaleDateString('de-DE')
                              : ''}
                          </p>
                          {complaintWorkflow.repairOffer.status === 'accepted' && !hasConvertedAcceptedOffer && (
                            <Button
                              size="sm"
                              className="mt-2 h-8 text-xs"
                              onClick={handleConvertAcceptedOfferToBooking}
                              disabled={convertOfferBookingLoading}
                            >
                              {convertOfferBookingLoading ? 'Wird umgewandelt...' : 'In neue Buchung mit Auftrag umwandeln'}
                            </Button>
                          )}
                          {complaintWorkflow.repairOffer.status === 'accepted' && hasConvertedAcceptedOffer && (
                            <div className="mt-2 rounded-md border border-green-300 bg-green-100/60 px-3 py-2 text-xs text-green-900 dark:text-green-200 dark:bg-green-900/30 dark:border-green-800 space-y-1">
                              <p className="font-medium">In neue Buchung mit Auftrag umgewandelt.</p>
                              <div className="flex flex-wrap gap-3">
                                <Link to={bookingOverviewPath} className="underline underline-offset-2 hover:no-underline">
                                  Buchung {convertedBookingNumber || convertedBookingId}
                                </Link>
                                <Link to={`/orders/${convertedOrderId}`} className="underline underline-offset-2 hover:no-underline">
                                  Auftrag {convertedOrderNumber || convertedOrderId}
                                </Link>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {id && (
                      <CommunicationPanel
                        orderId={id}
                        inspectionId={order?._id}
                        variant="compact"
                        feedbackOpen={commFeedbackOpen}
                        onFeedbackOpenChange={setCommFeedbackOpen}
                        quickActionOpen={commQuickActionOpen}
                        onQuickActionOpenChange={setCommQuickActionOpen}
                      />
                    )}

                    {hasDeviceHistoryTimeline && (
                      <div className="border-t pt-3">
                        <Collapsible open={deviceHistoryOpen} onOpenChange={setDeviceHistoryOpen}>
                          <div className="device-history-collapsible">
                            <CollapsibleTrigger asChild>
                              <button type="button" className="device-history-trigger">
                                <div className="device-history-trigger-copy">
                                  <span className="device-history-trigger-title">Auftragsverlauf &amp; Historie</span>
                                  <span className="device-history-trigger-summary">
                                    {progressHistoryEntries.length} Meilensteine • {orderHistoryEntries.length} Historieneinträge
                                  </span>
                                </div>
                                <ChevronDown className={`device-history-trigger-icon ${deviceHistoryOpen ? 'is-open' : ''}`} />
                              </button>
                            </CollapsibleTrigger>

                            <CollapsibleContent className="device-history-content">
                              <div className="device-history-section">
                                <div className="device-history-section-heading">
                                  <Calendar className="h-3.5 w-3.5" />
                                  <span>Fortschritt</span>
                                </div>
                                {progressHistoryEntries.length > 0 ? (
                                  <div className="device-history-list">
                                    {progressHistoryEntries.map((entry) => (
                                      <div key={entry.id} className="device-history-item">
                                        <div className={`device-history-marker is-${entry.tone}`} />
                                        <div className="device-history-item-body">
                                          <div className="device-history-item-head">
                                            <p className="device-history-item-title">{entry.title}</p>
                                            <span className={`device-history-badge is-${entry.tone}`}>{entry.statusLabel}</span>
                                          </div>
                                          <p className="device-history-item-description">{entry.description}</p>
                                          <p className="device-history-item-meta">{entry.meta}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="device-history-empty-state">Keine Fortschrittsmeilensteine verfügbar.</div>
                                )}
                              </div>

                              <div className="device-history-section">
                                <div className="device-history-section-heading">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>Historie</span>
                                </div>
                                {orderHistoryEntries.length > 0 ? (
                                  <div className="device-history-list">
                                    {orderHistoryEntries.map((entry) => (
                                      <div key={entry.id} className="device-history-item">
                                        <div className={`device-history-marker is-${entry.tone}`} />
                                        <div className="device-history-item-body">
                                          <div className="device-history-item-head">
                                            <p className="device-history-item-title">{entry.title}</p>
                                            <span className={`device-history-badge is-${entry.tone}`}>{entry.statusLabel}</span>
                                          </div>
                                          <p className="device-history-item-description">{entry.description}</p>
                                          <p className="device-history-item-meta">{entry.meta}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="device-history-empty-state">Keine Historieneinträge vorhanden.</div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Assigned Staff - Only visible to admin/staff */}
              {isStaffOrAdmin && (
              <Card id="order-staff" className="order-section-card">
            <CardHeader className="order-section-header">
              <CardTitle className="order-section-title">
                <Users className="h-5 w-5" />
                {t('orderDetails.assignedStaff')}
              </CardTitle>
              <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs px-2 h-8">
                      <UserPlus className="h-3 w-3 mr-1" />
                      {t('orderDetails.assignStaff')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="order-dialog-content sm:max-w-md">
                    <DialogHeader className="order-dialog-header">
                      <DialogTitle className="text-base">{t('orderDetails.assignStaffToOrder')}</DialogTitle>
                      <DialogDescription className="text-xs">
                        {t('orderDetails.selectStaffMembers')}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {availableStaff.map((staff) => (
                        <div key={staff._id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                          <Checkbox
                            id={staff._id}
                            checked={selectedStaff.includes(staff._id)}
                            onCheckedChange={(checked) => handleStaffToggle(staff._id, checked as boolean)}
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <Avatar className="w-7 h-7">
                              <AvatarImage src={staff.avatar} />
                              <AvatarFallback className="text-xs">
                                {staff.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{staff.name}</p>
                              <p className="text-xs text-muted-foreground">{staff.email}</p>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {staff.specializations.slice(0, 2).map((spec) => (
                                  <Badge key={spec} variant="secondary" className="text-xs px-1.5 py-0">
                                    {spec}
                                  </Badge>
                                ))}
                                {staff.specializations.length > 2 && (
                                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                    +{staff.specializations.length - 2} {t('orderDetails.more')}
                                  </Badge>
                                )}
                              </div>
                              {staff.currentWorkload && (
                                <div className="mt-2 text-xs text-muted-foreground space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span>Active Orders: {staff.currentWorkload.assignedOrders}/{staff.currentWorkload.capacity}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      staff.currentWorkload.utilizationRate > 80 ? 'bg-red-100 text-red-800' :
                                      staff.currentWorkload.utilizationRate > 60 ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-green-100 text-green-800'
                                    }`}>
                                      {staff.currentWorkload.utilizationRate}% utilized
                                    </span>
                                  </div>
                                  {staff.currentWorkload.assignedTasks !== undefined && (
                                    <div>Active Tasks: {staff.currentWorkload.assignedTasks}</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleStaffAssignment}
                        disabled={selectedStaff.length === 0 || assigningStaff}
                        size="sm"
                      >
                        {assigningStaff ? t('orderDetails.assigning') : t('orderDetails.assignStaff')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent className="pt-3">
              {order.assignedStaff && order.assignedStaff.length > 0 ? (
                <div className="space-y-2">
                  {order.assignedStaff.map((staff) => {
                    const staffUserId = staffLastActions.toId((staff as any).staffId) || staffLastActions.toId(staff._id)
                    const isLastActive = !!(staffLastActions.lastActiveUserId && staffUserId && staffLastActions.lastActiveUserId === staffUserId)
                    const lastEntry = staffLastActions.byStaff(staffUserId)[0]
                    const normalizeWorkflowStaffId = (value: any) => {
                      if (!value) return ''

                      try {
                        return staffLastActions.toId(value)
                      } catch {
                        return ''
                      }
                    }
                    const assignedWorkflowLabels = workflows
                      .filter((workflow: any) => {
                        const workflowStaffIds = [
                          workflow?.assignedStaffId?._id,
                          workflow?.assignedStaffId,
                          ...(Array.isArray(workflow?.assignedStaff)
                            ? workflow.assignedStaff.map((assignment: any) => assignment?.staffId?._id || assignment?.staffId)
                            : []),
                        ]
                          .filter(Boolean)
                          .map((value: any) => normalizeWorkflowStaffId(value))
                          .filter(Boolean)

                        return staffUserId && workflowStaffIds.includes(String(staffUserId))
                      })
                      .map((workflow: any) => workflow?.workflowName || 'Workflow')
                    return (
                      <div
                        key={staff._id}
                        className={`flex items-start gap-2 p-2 border rounded-lg transition-colors ${isLastActive ? 'border-primary bg-primary/5' : ''}`}
                      >
                        <div className="relative flex-shrink-0">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={staff.avatar} />
                            <AvatarFallback className="text-xs">
                              {staff.name.split(' ').map((n: string) => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          {isLastActive && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary border-2 border-background" title="Zuletzt aktiv" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-medium text-sm">{staff.name}</p>
                            {isLastActive && (
                              <span className="text-xs text-primary font-medium">• Zuletzt aktiv</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{t('orderDetails.repairTechnician')}</p>
                          {lastEntry ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground/70">{lastEntry.status}:</span>{' '}
                              <span className="truncate">{lastEntry.description}</span>
                              <span className="ml-1 opacity-60">
                                · {new Date(lastEntry.completedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground/60 italic">Noch keine Aktivität</p>
                          )}
                          <div className="mt-1 text-xs text-muted-foreground">
                            {assignedWorkflowLabels.length > 0 ? (
                              <>
                                <span className="font-medium text-foreground/70">Workflows:</span>{' '}
                                {assignedWorkflowLabels.join(', ')}
                              </>
                            ) : (
                              <span className="italic text-muted-foreground/60">Kein Workflow direkt zugewiesen</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('orderDetails.noStaffAssigned')}</p>
                  <p className="text-xs mt-1">{t('orderDetails.clickAssignStaff')}</p>
                </div>
              )}
            </CardContent>
              </Card>
              )}

              </div>

              <div className={`order-nested-block order-nested-ops-grid ${isStaffOrAdmin ? 'is-admin-nested' : ''}`}>
              {(order?.unlockPattern?.length > 0 || order?.unlockCode || order?.noLock || order?.unlockConfirmation?.confirmationStatus) && (
                <ConfirmUnlockDialog
                  isOpen={unlockConfirmDialogOpen}
                  onOpenChange={setUnlockConfirmDialogOpen}
                  onConfirm={handleConfirmUnlock}
                  onRequestUnlockUpdate={handleRequestUnlockUpdate}
                  unlockPattern={order?.unlockPattern}
                  unlockCode={order?.unlockCode}
                  noLock={order?.noLock}
                  isLoading={confirmingUnlock}
                  orderId={id}
                />
              )}

              </div>
            </div>
          </div>
        </>
      )}

      <Dialog open={complaintDialogOpen} onOpenChange={setComplaintDialogOpen}>
        <DialogContent className="w-[calc(100vw-12px)] sm:max-w-lg max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reklamation anmelden</DialogTitle>
            <DialogDescription>
              Bitte gib den Grund und eine kurze Beschreibung an. Diese Reklamation wird an das Admin-Team weitergeleitet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              value={complaintReason}
              onChange={(e) => setComplaintReason(e.target.value)}
              placeholder="Reklamationsgrund"
            />
            <Textarea
              value={complaintDescription}
              onChange={(e) => setComplaintDescription(e.target.value)}
              placeholder="Beschreibung des Problems"
              rows={5}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setComplaintDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmitComplaint} disabled={submittingComplaint}>
              {submittingComplaint ? 'Wird gesendet...' : 'Reklamation senden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={complaintActionDialog === 'ack'} onOpenChange={(open) => !open && setComplaintActionDialog(null)}>
        <DialogContent className="w-[calc(100vw-12px)] sm:max-w-lg max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Techniker: Anerkennen</DialogTitle>
            <DialogDescription>Bitte Grund auswaehlen oder individuell angeben.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select
              value={ackReasonPreset || 'none'}
              onValueChange={(value) => {
                const selected = value === 'none' ? '' : value
                setAckReasonPreset(selected)
                if (selected) setTechnicianAckReason(selected)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Schnellauswahl Grund" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Bitte auswaehlen</SelectItem>
                {ACK_REASON_OPTIONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={technicianAckReason}
              onChange={(e) => setTechnicianAckReason(e.target.value)}
              rows={4}
              placeholder="technician_reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComplaintActionDialog(null)}>Abbrechen</Button>
            <Button onClick={handleAcknowledgeComplaintFromOrder} disabled={!technicianAckReason.trim() || complaintActionLoading === 'ack'}>
              {complaintActionLoading === 'ack' ? 'Bitte warten...' : 'Anerkennen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={complaintActionDialog === 'deny'} onOpenChange={(open) => !open && setComplaintActionDialog(null)}>
        <DialogContent className="w-[calc(100vw-12px)] sm:max-w-xl max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:text-base">
              <span>{user?.role === 'admin' ? 'Reklamation ablehnen bestaetigen' : 'Reklamation ablehnen'}</span>
              <Badge className="bg-rose-100 text-rose-800 border border-rose-300 text-xs font-normal flex-shrink-0" variant="outline">Reparaturangebot erforderlich</Badge>
            </DialogTitle>
            <DialogDescription>
              {user?.role === 'admin'
                ? 'Bitte Ablehnungsgrund und Reparaturangebot pruefen. Nach Bestaetigung wird das Angebot an den Kunden gesendet.'
                : 'Bitte den Ablehnungsgrund angeben und ein Reparaturangebot konfigurieren. Danach wird die Reklamation zur Admin-Pruefung eskaliert.'}
            </DialogDescription>
          </DialogHeader>

          {user?.role === 'admin' && complaintWorkflowStatus === 'pending_approval' && latestDenyEscalationLog && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
              <p className="font-medium">
                Vom Techniker eskaliert
                {escalationActorName ? ` von ${escalationActorName}` : ''}
                {escalationCreatedAt ? ` am ${new Date(escalationCreatedAt).toLocaleString('de-DE')}` : ''}
              </p>
              {!!escalationOfferDescription && (
                <p className="text-amber-800 line-clamp-2">Angebot: {escalationOfferDescription}</p>
              )}
              {escalationOfferAmount != null && !Number.isNaN(Number(escalationOfferAmount)) && (
                <p className="text-amber-800">Betrag: {Number(escalationOfferAmount).toFixed(2)} EUR</p>
              )}
            </div>
          )}

          <div className="space-y-5 py-1">
            {/* Section 1: Ablehnungsgrund */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-5 w-1 rounded bg-rose-400" />
                <p className="text-sm font-semibold">1. Ablehnungsgrund</p>
              </div>
              <Select
                value={denyReasonPreset || 'none'}
                onValueChange={(value) => {
                  const selected = value === 'none' ? '' : value
                  setDenyReasonPreset(selected)
                  if (selected) setTechnicianDenyReason(selected)
                }}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Schnellauswahl Ablehnungsgrund" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bitte auswaehlen...</SelectItem>
                  {DENY_REASON_OPTIONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={technicianDenyReason}
                onChange={(e) => setTechnicianDenyReason(e.target.value)}
                rows={3}
                placeholder="Ablehnungsgrund (Freitext)..."
                className="text-sm resize-none"
              />
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-muted-foreground/30" />

            {/* Section 2: Reparaturangebot */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-5 w-1 rounded bg-blue-400" />
                <p className="text-sm font-semibold">2. Reparaturangebot konfigurieren</p>
              </div>

              {/* Device info summary (read-only context) */}
              {((order as any)?.deviceBrand || (order as any)?.deviceModel) && (
                <div className="rounded-md bg-muted/50 border px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                  <span className="font-medium text-foreground">{(order as any)?.deviceBrand} {(order as any)?.deviceModel}</span>
                  {((order as any)?.services || []).filter((s: any) => s?._id).length > 0 && (
                    <span className="text-muted-foreground">&bull; {((order as any)?.services || []).filter((s: any) => s?._id).length} Leistung(en)</span>
                  )}
                </div>
              )}

              {/* Offer amount */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Angebotspreis (EUR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">€</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={denyOfferAmount}
                    onChange={(e) => setDenyOfferAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-7 text-sm"
                  />
                </div>
                {denyOfferAmount && !isNaN(parseFloat(denyOfferAmount)) && (
                  <p className="text-xs text-muted-foreground">Urspruenglicher Auftragswert: {safeToNumber((order as any)?.totalCost).toFixed(2)} EUR</p>
                )}
              </div>

              {/* Offer description */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Angebotsbeschreibung</label>
                <Textarea
                  value={denyOfferDescription}
                  onChange={(e) => setDenyOfferDescription(e.target.value)}
                  rows={5}
                  placeholder="Beschreibung des Reparaturangebots..."
                  className="text-sm resize-none"
                />
                <p className="text-xs text-muted-foreground">Vorausgefuellt anhand der Auftragsdaten. Bitte bei Bedarf anpassen.</p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setComplaintActionDialog(null)} disabled={complaintActionLoading === 'deny'}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDenyComplaintFromOrder}
              disabled={!technicianDenyReason.trim() || complaintActionLoading === 'deny'}
            >
              {complaintActionLoading === 'deny'
                ? 'Wird verarbeitet...'
                : user?.role === 'admin'
                ? 'Ablehnung bestaetigen & Angebot senden'
                : 'Ablehnen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Device Inspection Dialog */}
      {id && order && isStaffOrAdmin && (
        <Dialog open={inspectionDialogOpen} onOpenChange={setInspectionDialogOpen}>
          <DialogContent className="order-dialog-content inspection-dialog-content w-[96vw] max-w-[1180px]">
            <DialogHeader className="order-dialog-header inspection-dialog-header">
              <div className="inspection-dialog-title-row">
                <div>
                  <DialogTitle className="inspection-dialog-title">Geräteinspektion</DialogTitle>
                  <DialogDescription className="inspection-dialog-description">
                    {order.orderNumber ? `Auftrag ${order.orderNumber}` : "Führen Sie die Geräteinspektion direkt in den Auftragsdetails durch"}
                  </DialogDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateInspectionReport}
                  disabled={generatingInspectionReport}
                  className="inspection-dialog-report-button"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  {generatingInspectionReport ? "Generating..." : "Report"}
                </Button>
              </div>
            </DialogHeader>

            <div className="inspection-dialog-main">
              <div className="inspection-dialog-guidance" aria-label="Empfohlener Inspektionsablauf">
                <p className="inspection-dialog-guidance-title">Empfohlener Ablauf</p>
                <ol className="inspection-dialog-guidance-list">
                  <li>Gemeldetes Modell prüfen und Geräteidentifikation bestätigen.</li>
                  <li>Zubehör erfassen und die äußere Inspektion abschließen.</li>
                  <li>Funktionstests durchführen und mit der Reparaturzusammenfassung abschließen.</li>
                </ol>
              </div>

              <div className="inspection-dialog-context" aria-label="Inspektionskontext">
                <span className="inspection-dialog-context-chip">
                  <strong>Gerät:</strong> {order.deviceBrand} {order.deviceModel}
                </span>
                <span className="inspection-dialog-context-chip">
                  <strong>Typ:</strong> {order.deviceType || "-"}
                </span>
                <span className="inspection-dialog-context-chip">
                  <strong>Kunde:</strong> {(order as any)?.customerId?.name || "Gast"}
                </span>
                <span className="inspection-dialog-context-chip">
                  <strong>Gebuchte Reparatur:</strong>{' '}
                  {(repairServices && repairServices.length > 0)
                    ? repairServices.map((service: any) => service?.name || service?.serviceName || 'Service').join(', ')
                    : 'Nicht verfuegbar'}
                </span>
                <span className="inspection-dialog-context-chip">
                  <strong>Summe:</strong> {safeToNumber((order as any)?.totalCost).toFixed(2)} EUR
                </span>
              </div>

              <div className="inspection-dialog-form-column">
                <DeviceInspectionForm
                  orderId={id}
                  customerId={(order as any)?.customerId?._id || null}
                  deviceType={order.deviceType}
                  deviceBrand={(order as any)?.deviceBrand || ''}
                  deviceModel={(order as any)?.deviceModel || ''}
                  bookedRepairs={(repairServices || []).map((service: any) => ({
                    name: service?.name || service?.serviceName || 'Reparaturservice',
                    price: safeToNumber(service?.finalPrice ?? service?.totalPrice ?? service?.price),
                    quantity: Number(service?.quantity || 1),
                  }))}
                  orderTotalCost={safeToNumber((order as any)?.totalCost)}
                  onComplete={handleInspectionComplete}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* EPart Selection Dialog */}
      {id && (user?.role === 'admin' || user?.role === 'staff') && (
        <EPartSelectionDialog
          open={ePartDialogOpen}
          onOpenChange={setEPartDialogOpen}
          orderId={id}
          orderNumber={order?.orderNumber}
          onSuccess={refreshOrder}
        />
      )}

      {/* Add Add-On Dialog */}
      <Dialog open={addAddonDialogOpen} onOpenChange={setAddAddonDialogOpen}>
        <DialogContent className="order-dialog-content order-addon-dialog w-[96vw] max-w-[760px] max-h-[88vh]">
          <DialogHeader className="order-dialog-header">
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4 flex-shrink-0" />
              Zusatzservice hinzufügen
            </DialogTitle>
            <DialogDescription>
              Wählen Sie eine Vorlage oder erstellen Sie einen individuellen Zusatzservice für diesen Auftrag.
            </DialogDescription>
          </DialogHeader>
          <div className="order-dialog-body space-y-4 pb-2">
            <div className="order-dialog-segmented-toggle">
              <button
                type="button"
                className={`order-dialog-segmented-button ${addonInputMode === 'catalog' ? 'is-active' : ''}`}
                onClick={() => setAddonInputMode('catalog')}
              >
                Vorlage wählen
              </button>
              <button
                type="button"
                className={`order-dialog-segmented-button ${addonInputMode === 'custom' ? 'is-active' : ''}`}
                onClick={() => {
                  setAddonInputMode('custom')
                  setSelectedAddonService(null)
                }}
              >
                Individuell erstellen
              </button>
            </div>

            {addonInputMode === 'catalog' ? (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-[0.7rem] font-bold uppercase tracking-wide text-[#1a2a5e]">
                  1 · Zusatzservice auswählen
                </p>
                <div className="space-y-2 relative">
                  <Label htmlFor="addon-search">Vorlage suchen</Label>
                  <Input
                    id="addon-search"
                    value={addonSearchTerm}
                    onChange={(e) => {
                      setAddonSearchTerm(e.target.value)
                      setShowAddonSuggestions(true)
                      if (selectedAddonService) {
                        setSelectedAddonService(null)
                      }
                    }}
                    onFocus={() => setShowAddonSuggestions(true)}
                    onBlur={() => {
                      // Delay hide to allow click selection on suggestion items.
                      setTimeout(() => setShowAddonSuggestions(false), 120)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && showAddonSuggestions && addonSearchResults.length > 0) {
                        e.preventDefault()
                        const topResult = addonSearchResults[0]
                        setSelectedAddonService(topResult)
                        setAddonSearchTerm(topResult.name)
                        setShowAddonSuggestions(false)
                      }
                    }}
                    placeholder="Nach Name oder Beschreibung suchen"
                  />
                  {showAddonSuggestions && normalizedAddonSearch && (
                    <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                      {addonSearchResults.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Keine Treffer gefunden
                        </div>
                      ) : (
                        addonSearchResults.map((addon) => (
                          <button
                            key={addon._id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setSelectedAddonService(addon)
                              setAddonSearchTerm(addon.name)
                              setShowAddonSuggestions(false)
                            }}
                            className="w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-900">{addon.name}</p>
                              <span className="text-xs font-semibold text-slate-600">{safeToNumber(addon.price).toFixed(2)} €</span>
                            </div>
                            {addon.description && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{addon.description}</p>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {normalizedAddonSearch && (
                    <p className="text-xs text-muted-foreground">
                      {filteredAvailableAddons.length} Treffer
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="addon-service">Zusatzservice auswählen</Label>
                  <Select
                    value={selectedAddonService?._id || ""}
                    onValueChange={(value) => {
                      const addon = availableAddons.find((a) => a._id === value)
                      setSelectedAddonService(addon || null)
                    }}
                  >
                    <SelectTrigger id="addon-service">
                      <SelectValue placeholder="Zusatzservice auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredAvailableAddons.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground">Keine Zusatzservice-Vorlagen gefunden</div>
                      ) : (
                        filteredAvailableAddons.map((addon) => (
                          <SelectItem key={addon._id} value={addon._id}>
                            {addon.name} - {safeToNumber(addon.price).toFixed(2)} €
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedAddonService && (
                  <div className="rounded-md border bg-white p-3">
                    <p className="text-sm font-semibold text-slate-900">{selectedAddonService.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedAddonService.description || 'Keine Beschreibung vorhanden.'}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border bg-slate-50 px-2.5 py-1">{safeToNumber(selectedAddonService.price).toFixed(2)} €</span>
                      {selectedAddonService.estimatedTime && (
                        <span className="rounded-full border bg-slate-50 px-2.5 py-1">{selectedAddonService.estimatedTime}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-[0.7rem] font-bold uppercase tracking-wide text-[#1a2a5e]">
                  1 · Zusatzservice beschreiben
                </p>
                <div>
                  <Label htmlFor="custom-name">Name des Zusatzservices</Label>
                  <Input
                    id="custom-name"
                    value={customAddonName}
                    onChange={(e) => setCustomAddonName(e.target.value)}
                    placeholder="Name eingeben"
                  />
                </div>

                <div>
                  <Label htmlFor="custom-description">Beschreibung (optional)</Label>
                  <Textarea
                    id="custom-description"
                    value={customAddonDescription}
                    onChange={(e) => setCustomAddonDescription(e.target.value)}
                    placeholder="Beschreibung eingeben"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="custom-price">Preis (€)</Label>
                    <Input
                      id="custom-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={customAddonPrice}
                      onChange={(e) => setCustomAddonPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="custom-time">Geschätzte Zeit (optional)</Label>
                    <Input
                      id="custom-time"
                      value={customAddonTime}
                      onChange={(e) => setCustomAddonTime(e.target.value)}
                      placeholder="z. B. 30 Minuten"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {['15 Minuten', '30 Minuten', '45 Minuten', '60 Minuten'].map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomAddonTime(preset)}
                    >
                      {preset}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCustomAddonTime('')}
                  >
                    Zeit leeren
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Vorschau</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{addonPreviewName || 'Kein Zusatzservice ausgewählt'}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {addonPreviewTime || 'Keine Zeitangabe'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-900">{addonPreviewPrice.toFixed(2)} €</p>
                  <p className="text-xs text-slate-600">Auftragsgesamt nach Hinzufügen: {orderTotalAfterAddon.toFixed(2)} €</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => {
              resetAddOnForm()
              setAddAddonDialogOpen(false)
            }}>
              Abbrechen
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={resetAddOnForm}
                disabled={submittingAddon}
              >
                Formular zurücksetzen
              </Button>
              <Button onClick={handleAddAddon} disabled={!canSubmitAddon || submittingAddon}>
                {submittingAddon ? 'Fügt hinzu...' : 'Zusatzservice hinzufügen'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Add-On Dialog */}
      <Dialog open={editAddonDialogOpen} onOpenChange={setEditAddonDialogOpen}>
        <DialogContent className="order-dialog-content sm:max-w-[500px]">
          <DialogHeader className="order-dialog-header">
            <DialogTitle>Edit Add-On Service</DialogTitle>
            <DialogDescription>
              Update the add-on service details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={customAddonName}
                onChange={(e) => setCustomAddonName(e.target.value)}
                placeholder="Enter add-on name"
              />
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={customAddonDescription}
                onChange={(e) => setCustomAddonDescription(e.target.value)}
                placeholder="Enter description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-price">Price ($)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={customAddonPrice}
                  onChange={(e) => setCustomAddonPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="edit-time">Estimated Time</Label>
                <Input
                  id="edit-time"
                  value={customAddonTime}
                  onChange={(e) => setCustomAddonTime(e.target.value)}
                  placeholder="e.g., 30 minutes"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditAddonDialogOpen(false)
              setEditingAddon(null)
              setCustomAddonName("")
              setCustomAddonPrice("")
              setCustomAddonDescription("")
              setCustomAddonTime("")
            }}>
              Cancel
            </Button>
            <Button onClick={handleEditAddon}>
              Update Add-On
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Staff to Add-On Dialog */}
      <Dialog open={assignAddonStaffDialogOpen} onOpenChange={setAssignAddonStaffDialogOpen}>
        <DialogContent className="order-dialog-content sm:max-w-[400px]">
          <DialogHeader className="order-dialog-header">
            <DialogTitle>Assign Staff to Add-On</DialogTitle>
            <DialogDescription>
              Select a staff member to handle this add-on service
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedAddonForStaff && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="font-medium">{selectedAddonForStaff.name}</p>
                <p className="text-sm text-muted-foreground">{selectedAddonForStaff.description}</p>
              </div>
            )}

            <div>
              <Label htmlFor="staff-select">Staff Member</Label>
              <Select value={addonStaffId} onValueChange={setAddonStaffId}>
                <SelectTrigger id="staff-select">
                  <SelectValue placeholder="Select a staff member..." />
                </SelectTrigger>
                <SelectContent>
                  {availableStaff.map((staff) => (
                    <SelectItem key={staff._id} value={staff._id}>
                      <div className="flex items-center gap-2">
                        <span>{staff.name}</span>
                        {staff.specializations.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ({staff.specializations.slice(0, 2).join(', ')})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAssignAddonStaffDialogOpen(false)
              setSelectedAddonForStaff(null)
              setAddonStaffId("")
            }}>
              Cancel
            </Button>
            <Button onClick={handleAssignStaffToAddon} disabled={!addonStaffId}>
              Assign Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workflow Assignment Dialog */}
      <Dialog
        open={workflowDialogOpen}
        onOpenChange={(open) => {
          setWorkflowDialogOpen(open)
          if (!open) {
            setWorkflowAssignedStaffId("__unassigned__")
          }
        }}
      >
        <DialogContent className="order-dialog-content sm:max-w-[600px]">
          <DialogHeader className="order-dialog-header">
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="h-4 w-4 flex-shrink-0" />
              Workflow zuweisen
            </DialogTitle>
            <DialogDescription>
              Wählen Sie eine passende Workflow-Vorlage für den Gerätetyp und die Services dieses Auftrags.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[420px] overflow-y-auto py-1">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <Label htmlFor="workflow-assignee" className="text-xs font-medium text-slate-700">
                Personal fuer diesen Workflow
              </Label>
              <Select value={workflowAssignedStaffId} onValueChange={setWorkflowAssignedStaffId}>
                <SelectTrigger id="workflow-assignee" className="mt-2">
                  <SelectValue placeholder="Personal waehlen (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Kein Personal zuweisen</SelectItem>
                  {availableStaff.map((staff) => (
                    <SelectItem key={staff._id} value={staff._id}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {customerInspection && (
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <CardTitle className="text-base text-slate-900">Reparatur-Workflow</CardTitle>
                      <CardDescription className="mt-1">
                        Starten Sie den Reparatur-Ausführungs-Workflow für diese Inspektion
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleStartRepairWorkflow}
                      disabled={startingRepairWorkflow}
                      className="flex-shrink-0 gap-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {startingRepairWorkflow ? (
                        <span className="inline-block animate-spin">⏳</span>
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Starten
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            )}

            {suggestedWorkflows.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-3">
                  Verfügbare Workflows
                </p>
              </div>
            )}
            {suggestedWorkflows.length > 0 ? (
              suggestedWorkflows.map((workflow: any) => (
                <Card
                  key={workflow._id}
                  className="border-slate-200 transition-colors hover:border-[#1a2a5e] hover:bg-[#1a2a5e]/[0.03]"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <CardTitle className="text-base text-slate-900">{workflow.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {workflow.description}
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAssignWorkflow(workflow._id)}
                        disabled={assigningWorkflow}
                        className="flex-shrink-0 gap-1"
                      >
                        {assigningWorkflow ? (
                          <span className="inline-block animate-spin">⏳</span>
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        Zuweisen
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700">
                        <CheckCircle className="h-3.5 w-3.5 text-[#1a2a5e]" />
                        {workflow.steps?.length || 0} Schritte
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700">
                        <Clock className="h-3.5 w-3.5 text-[#1a2a5e]" />
                        {workflow.estimatedTotalTime || 0} Min.
                      </span>
                      {workflow.deviceTypes && workflow.deviceTypes.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700">
                          <Smartphone className="h-3.5 w-3.5 text-[#1a2a5e]" />
                          {workflow.deviceTypes.join(', ')}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 py-10 text-center">
                <Workflow className="mb-2 h-10 w-10 text-slate-300" />
                <p className="text-sm font-semibold text-slate-700">Keine passenden Workflows verfügbar</p>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  Legen Sie im Admin-Bereich Workflows an, die zum Gerätetyp und den Services dieses Auftrags passen.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkflowDialogOpen(false)}>
              Abbrechen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repair Service Dialog */}
      {id && order && (
        <RepairServiceDialog
          isOpen={serviceDialogOpen}
          onClose={() => {
            setServiceDialogOpen(false)
            setEditingService(null)
          }}
          service={editingService}
          mode={editingService ? 'edit' : 'add'}
          availableServices={availableServices}
          onSave={handleSaveService}
        />
      )}

      {/* Shop Product Selection Dialog */}
      {id && (
        <ShopProductSelectionDialog
          open={shopProductDialogOpen}
          onClose={() => setShopProductDialogOpen(false)}
          onAddProduct={handleAddShopProduct}
          orderId={id}
          currentOrderTotal={safeToNumber((order as any)?.totalCost)}
        />
      )}

      {/* Workflow Execution Modal */}
      {selectedWorkflowForExecution && (
        <WorkflowExecutionModal
          open={workflowExecutionModalOpen}
          onOpenChange={(open) => {
            setWorkflowExecutionModalOpen(open)
            if (!open) {
              setSelectedWorkflowForExecution(null)
            }
          }}
          workflow={selectedWorkflowForExecution}
          orderId={id}
          workflowId={selectedWorkflowForExecution._id}
          onConfirmStart={handleConfirmStartWorkflow}
          onConfirmResume={handleConfirmResumeWorkflow}
          onStepComplete={handleWorkflowStepComplete}
          isLoading={workflowActionInProgress !== null}
          mode={workflowExecutionMode}
        />
      )}

      {/* Device Change Dialog */}
      {id && order && (
        <DeviceChangeDialog
          open={deviceChangeDialogOpen}
          onOpenChange={setDeviceChangeDialogOpen}
          orderId={id}
          currentDevice={{
            brand: order.deviceBrand,
            model: order.deviceModel,
            type: order.deviceType,
          }}
          currentServices={(Array.isArray((order as any).services) ? (order as any).services : [])
            .filter((service: any) => service && service._id)
            .map((service: any) => {
              const serviceName =
                typeof service.serviceId === 'object'
                  ? service.serviceId?.name
                  : service.serviceName || `Service #${String(service._id).substring(0, 8)}`

              return {
                id: String(service._id),
                name: serviceName || 'Reparaturservice',
                price: Number(service.price) || 0,
              }
            })}
          onDeviceChanged={(updatedOrder) => {
            console.log('[OrderDetails] Device changed, updating order:', updatedOrder)
            setOrder(updatedOrder)
            toast({
              title: "Success",
              description: "Device has been changed successfully",
            })
          }}
        />
      )}
    </div>
  )
}