import { useCallback, useEffect, useRef, useState } from "react"
import { SEO } from '@/components/SEO'
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react"
import { useParams, Link, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"

const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Wird geprüft',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  acknowledged: 'Anerkannt',
  denied: 'Angebot vorhanden',
  new_repair: 'Neue Reparatur',
  awaiting_payment: 'Wartet auf Zahlung',
  resolved: 'Gelöst',
  closed: 'Geschlossen',
}

const getComplaintStatusLabel = (status?: string) =>
  status ? COMPLAINT_STATUS_LABELS[status] || status : ''

// FIN-13: gespeicherter Steuersatz? 0 ist ein echter Satz; null/leer/nicht numerisch
// heisst "nicht gespeichert" (Number(null) waere sonst 0 %).
const hasStoredTaxRate = (value: unknown): boolean => {
  if (value === null || value === undefined || typeof value === 'boolean') return false
  if (typeof value === 'string' && value.trim() === '') return false
  const num = Number(value)
  return Number.isFinite(num) && num >= 0
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import { safeToNumber, formatEUR } from "@/lib/utils"
import { OrderDetailsNavigationState } from "@/lib/orderDetailsNavigation"
import "./OrderDetails.css"
import { createOrderComplaint, getOrderById, Order, getOrderProgressTimeline, addShopProductToOrder, removeShopProductFromOrder, updateShopProductQuantity, ShopProduct, buildRepricingConfirmation, isRepricingConfirmationOutdated, type OrderRepricingOptions, createOrderReturnLabel, downloadOrderReturnLabel, getCustomerInvoicesForOrder, downloadCustomerInvoicePdf, CustomerOrderInvoice, reconcileOrderInboundShipment, summarizeInvoicePayment, splitRefundPendingByScope, INVOICE_PAYMENT_TONE_CLASSES, getOrderInboundLabel, downloadOrderShippingLabel, getOrderHistory, type OrderHistoryEntry, type OrderMilestone } from "@/api/orders"
import { getComplaint, acknowledgeComplaint, denyComplaint, acceptComplaintOffer, rejectComplaintOffer, Complaint as ComplaintRecord } from "@/api/complaints"
import { startOrderTracking, endOrderTracking } from "@/api/timeTracking"
import { getAvailableStaff, assignStaffToOrder, StaffMember, getAdminOrderById, removeEPartFromOrder, addAddonToOrder, updateOrderAddon, removeAddonFromOrder, assignStaffToAddon, confirmUnlockCode, requestUnlockInfoUpdate, updateOrderDevice, updateOrderStatus, confirmPickup } from "@/api/adminOrders"
import { createInvoiceFromOrder, getInvoices, getInvoiceDetails, Invoice as FinancialInvoice } from "@/api/financial"
import { createOutboundShippingLabel, getOrderShipments, reconcileOrderShipment, reconcileBookingInboundLabel, type OrderShipmentsView, type ShipmentPartyView } from "@/api/shipping"
import { getUserProfile, UserProfile } from "@/api/user"
import { getAddOnServices, AddOnService as AddOnServiceType } from "@/api/services"
import { getOrderWorkflows, getSuggestedWorkflowsForOrder, assignWorkflowToOrder, deleteWorkflowFromOrder, startWorkflow, updateWorkflowStatus } from "@/api/workflow"
import { initializeRepairWorkflow, getRepairWorkflow } from "@/api/repairWorkflow"
import { getOrderServices, getAvailableServicesForOrder, addRepairServiceFromForm, updateRepairServiceFromForm, removeServiceFromOrder, getOrderServiceWarnings, ORDER_VALUE_NOT_RECONCILED, readOrderServiceErrorCode, readReconciliationDetails, describeRepricingConsequence, type OrderValueReconciliationDetails } from "@/api/orderServices"
import { searchDevices, SearchResult } from "@/api/devices"
import EPartSelectionDialog from "@/components/admin/EPartSelectionDialog"
import { ShopProductSelectionDialog } from "@/components/admin/ShopProductSelectionDialog"
import { RepairServiceDialog, type RepairServiceFormData } from "@/components/inspection/RepairServiceDialog"
import { DeviceInspectionForm } from "@/components/inspection/DeviceInspectionForm"
import { WorkflowExecutionView } from "@/components/workflow/WorkflowExecutionView"
import { WorkflowCard } from "@/components/admin/WorkflowCard"
import { WorkflowExecutionModal } from "@/components/admin/WorkflowExecutionModal"
import { RepairWorkflowProcessDialog } from "@/components/admin/RepairWorkflowProcessDialog"
import { InspectionResultsDisplay } from "@/components/inspection/InspectionResultsDisplay"
import { ConfirmUnlockDialog } from "@/components/inspection/ConfirmUnlockDialog"
import { UnlockPatternVisual } from "@/components/inspection/UnlockPatternVisual"
import { DeviceChangeDialog } from "@/components/admin/DeviceChangeDialog"
import { CommunicationPanel } from "@/components/inspection/CommunicationPanel"
import { generateInspectionReport, getInspection } from "@/api/deviceInspection"
import { getBooking, updateBookingShippingStatus, updateReturnStatus, downloadBookingShippingLabel, downloadBookingReturnLabel, createBookingShippingLabel, createBookingInboundLabel, downloadInboundLabel, printInboundLabel, type InboundLabelView } from "@/api/bookings"
import { getCustomerBookingPayments, getBookingPayments, type CustomerBookingPaymentOverview, type BookingPaymentOverview } from "@/api/bookingPayments"
import { BookingPaymentsDialog } from "@/components/admin/BookingPaymentsDialog"
import { OrderCancelDialog } from "@/components/admin/OrderCancelDialog"
import { describeReadyState, READY_NEUTRAL_LABEL } from "@/lib/returnMethod"
import { OrderHistoryPanel, OrderMilestoneList } from "@/components/order/OrderHistoryPanel"
import { getUnreadMessageCounts } from "@/api/inspectionCommunication"
import type { OrderHistoryEntry as AdminHistoryEntry, OrderHistoryLink } from "@/api/orders"
import { labelFilename } from "@/api/labelPdf"
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
  DialogBody,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
  MessageSquare,
  Camera,
  Send,
  Paperclip,
  Shield,
  Star,
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
  UserCheck,
  Play,
  Pause,
  AlertTriangle,
  Timer,
  Truck,
  Receipt,
  Printer,
  ArrowRight,
  RefreshCw,
  History,
  Inbox,
  Euro,
} from "lucide-react"

// Zusatzfelder der Versandrichtung, die der Server für Sperre/Abgleich liefert
// (DHLService.getOrderShipmentState). Fehlen sie (ältere Antwort), gilt "kein Abgleich".
type ReconcilableShipmentView = OrderShipmentsView['outbound'] & {
  reconciliationReason?: string
  lockStale?: boolean
  lockStartedAt?: string | null
  reconcileUrl?: string
}

// Bereiche der Personal-/Admin-Ansicht (ADMUX-7); Wert steht als ?bereich=… in der URL.
const ADMIN_ORDER_TABS = ['uebersicht', 'kommunikation', 'verlauf', 'rechnungen', 'versand'] as const
type AdminOrderTab = typeof ADMIN_ORDER_TABS[number]

export function OrderDetails() {
  const SPECIAL_REPAIR_WORKFLOW_NAME_MARKERS = [
    'reparatur-workflow',
    'standard repair process neu',
  ]

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
  const [selectedRepairWorkflow, setSelectedRepairWorkflow] = useState<any | null>(null)
  const [workflowExecutionModalOpen, setWorkflowExecutionModalOpen] = useState(false)
  const [repairWorkflowDialogOpen, setRepairWorkflowDialogOpen] = useState(false)
  const [workflowExecutionMode, setWorkflowExecutionMode] = useState<'start' | 'resume' | 'execute' | 'view'>('view')
  const [progressTimeline, setProgressTimeline] = useState<any>(null)
  const [progressTimelineError, setProgressTimelineError] = useState(false)
  const [repairServices, setRepairServices] = useState<any[]>([])
  const [availableServices, setAvailableServices] = useState<any[]>([])
  // Entfernen einer Reparaturposition mit Rückfrage und optionalem Grund (Auftragshistorie)
  const [serviceToDelete, setServiceToDelete] = useState<any | null>(null)
  const [deleteServiceReason, setDeleteServiceReason] = useState('')
  // 409 ORDER_VALUE_NOT_RECONCILED beim Entfernen: Meldung + Abweichung; der Dialog bietet
  // dann die ausdrückliche Bestätigung der Neuberechnung an.
  const [deleteServiceRepricing, setDeleteServiceRepricing] = useState<{ message: string; details: OrderValueReconciliationDetails | null } | null>(null)
  const [deletingService, setDeletingService] = useState(false)
  // 409 ORDER_VALUE_NOT_RECONCILED bei Zusatzleistungen und Shop-Produkten: dieselbe
  // Rückfrage wie bei Reparaturpositionen. retry wiederholt GENAU die abgelehnte Änderung mit
  // der Bestätigung der gezeigten Abweichung (buildRepricingConfirmation).
  const [pendingRepricing, setPendingRepricing] = useState<{
    title: string
    message: string
    details: OrderValueReconciliationDetails | null
    outdated: boolean
    retry: (confirmation: OrderRepricingOptions) => Promise<void>
  } | null>(null)
  const [confirmingRepricing, setConfirmingRepricing] = useState(false)
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
  const [creatingOrderInvoice, setCreatingOrderInvoice] = useState(false)
  const [creatingOrderShippingLabel, setCreatingOrderShippingLabel] = useState(false)
  const [downloadingOrderShippingLabel, setDownloadingOrderShippingLabel] = useState(false)
  const [creatingOrderReturnLabel, setCreatingOrderReturnLabel] = useState(false)
  const [downloadingOrderReturnLabel, setDownloadingOrderReturnLabel] = useState(false)
  // Versandstand getrennt nach Einsendung / Auslieferung (GET /api/orders/:id/shipments).
  const [orderShipments, setOrderShipments] = useState<OrderShipmentsView | null>(null)
  const [reconcilingOutbound, setReconcilingOutbound] = useState(false)
  const [reconcileTrackingNumber, setReconcileTrackingNumber] = useState('')
  const [reconcilingInbound, setReconcilingInbound] = useState(false)
  const [reconcileInboundTrackingNumber, setReconcileInboundTrackingNumber] = useState('')
  const [orderInvoices, setOrderInvoices] = useState<FinancialInvoice[]>([])
  const [loadingOrderInvoices, setLoadingOrderInvoices] = useState(false)
  // Customer-facing invoice list (owner-scoped endpoint, drafts excluded server-side).
  const [customerInvoices, setCustomerInvoices] = useState<CustomerOrderInvoice[]>([])
  const [loadingCustomerInvoices, setLoadingCustomerInvoices] = useState(false)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState('')
  const [invoiceDetailsDialogOpen, setInvoiceDetailsDialogOpen] = useState(false)
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState<FinancialInvoice | null>(null)
  const [invoiceDetailLoading, setInvoiceDetailLoading] = useState(false)
  const [invoiceDetailPayments, setInvoiceDetailPayments] = useState<any[]>([])
  const [invoiceDetailCreditNotes, setInvoiceDetailCreditNotes] = useState<Partial<FinancialInvoice>[]>([])
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false)
  const [inspectionRefreshKey, setInspectionRefreshKey] = useState(0)
  const [returnToInspectionAfterDeviceDialog, setReturnToInspectionAfterDeviceDialog] = useState(false)
  const [forceInspectionStepOne, setForceInspectionStepOne] = useState(false)
  const [generatingInspectionReport, setGeneratingInspectionReport] = useState(false)
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
  const [complaintActionLoading, setComplaintActionLoading] = useState<"ack" | "deny" | "">("")
  const [offerActionLoading, setOfferActionLoading] = useState<"accept" | "reject" | "">("")
  const [commFeedbackOpen, setCommFeedbackOpen] = useState(false)
  const [commQuickActionOpen, setCommQuickActionOpen] = useState(false)
  const [linkedBooking, setLinkedBooking] = useState<any | null>(null)
  const bookingTrackingRefreshRef = useRef<Record<string, number>>({})
  // Laden / leer / Fehler getrennt (CUSTUX-8): 'not-found' = 403/404, 'error' = alles andere.
  const [orderLoadError, setOrderLoadError] = useState<'' | 'not-found' | 'error'>('')
  const [profileLoadError, setProfileLoadError] = useState(false)
  const [orderReloadToken, setOrderReloadToken] = useState(0)
  const [customerInvoicesError, setCustomerInvoicesError] = useState(false)
  const [customerInvoicesReloadToken, setCustomerInvoicesReloadToken] = useState(0)
  const [shipmentsLoadError, setShipmentsLoadError] = useState(false)
  // Kundensicht: Zahlungsstand der Buchung (Kundenprojektion GET /api/bookings/:id/payments,
  // dieselben PaymentService-Zahlen wie das Team) und Einsendestatus (GET /api/orders/:id/inbound-label).
  const [customerPayments, setCustomerPayments] = useState<CustomerBookingPaymentOverview | null>(null)
  const [customerPaymentsState, setCustomerPaymentsState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [customerPaymentsReloadToken, setCustomerPaymentsReloadToken] = useState(0)
  const [customerInbound, setCustomerInbound] = useState<InboundLabelView | null>(null)
  const [customerInboundState, setCustomerInboundState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [customerInboundReloadToken, setCustomerInboundReloadToken] = useState(0)
  const [customerInboundBusy, setCustomerInboundBusy] = useState<'' | 'download' | 'print' | 'create'>('')
  // Offene Rückfragen/Aktionen/Angebote im Nachrichtenverlauf (vom CommunicationPanel gemeldet).
  const [threadPending, setThreadPending] = useState({ questions: 0, actions: 0, offers: 0 })
  const handleThreadPendingChange = useCallback((pending: { questions: number; actions: number; offers: number }) => {
    setThreadPending((previous) => (
      previous.questions === pending.questions && previous.actions === pending.actions && previous.offers === pending.offers
        ? previous
        : pending
    ))
  }, [])
  // Kundenverlauf (freigegebene Einträge aus GET /api/orders/:id/history), erst beim Aufklappen geladen.
  const [customerHistoryOpen, setCustomerHistoryOpen] = useState(false)
  const [customerHistory, setCustomerHistory] = useState<OrderHistoryEntry[] | null>(null)
  const [customerHistoryState, setCustomerHistoryState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [customerHistoryReloadToken, setCustomerHistoryReloadToken] = useState(0)
  // Personal/Admin (ADMUX-7): Zahlungsübersicht der Buchung (dieselbe Serverberechnung wie
  // "Zahlungen verwalten"), Zähler für die Bereichs-Tabs und der Zahlungsdialog.
  const [adminPayments, setAdminPayments] = useState<BookingPaymentOverview | null>(null)
  const [adminPaymentsState, setAdminPaymentsState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [adminPaymentsReloadToken, setAdminPaymentsReloadToken] = useState(0)
  const [bookingPaymentsDialogOpen, setBookingPaymentsDialogOpen] = useState(false)
  // HIST-14: Storno nur mit Grund über den gemeinsamen Dialog "Auftrag stornieren?" (Server verlangt den Grund).
  const [orderCancelDialogOpen, setOrderCancelDialogOpen] = useState(false)
  const [orderReopenDialogOpen, setOrderReopenDialogOpen] = useState(false)
  const [adminCommunicationCounts, setAdminCommunicationCounts] = useState<{ unread: number; awaitingReply: boolean } | null>(null)
  const [adminCommunicationReloadToken, setAdminCommunicationReloadToken] = useState(0)
  const [adminHistoryTotal, setAdminHistoryTotal] = useState<number | null>(null)
  const [orderInvoicesError, setOrderInvoicesError] = useState(false)
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
      workflowMode?: 'start' | 'resume' | 'execute' | 'view'
    } | null

    return state?.workflowMode
  })()

  const loadOrderInvoices = async (orderId: string, bookingId?: string | null) => {
    if (!orderId || user?.role !== 'admin') {
      setOrderInvoices([])
      return
    }

    try {
      setLoadingOrderInvoices(true)
      setOrderInvoicesError(false)
      const [orderInvoiceResponse, bookingInvoiceResponse] = await Promise.all([
        getInvoices({ orderId, limit: 50 }),
        bookingId ? getInvoices({ bookingId, limit: 50 }) : Promise.resolve(null),
      ])

      const orderInvoicesList = Array.isArray((orderInvoiceResponse as any)?.invoices)
        ? ((orderInvoiceResponse as any).invoices as FinancialInvoice[])
        : []

      const bookingInvoicesList = Array.isArray((bookingInvoiceResponse as any)?.invoices)
        ? ((bookingInvoiceResponse as any).invoices as FinancialInvoice[])
        : []

      const mergedInvoicesById = new Map<string, FinancialInvoice>()
      for (const invoice of [...bookingInvoicesList, ...orderInvoicesList]) {
        if (!invoice?._id) continue
        mergedInvoicesById.set(String(invoice._id), invoice)
      }

      const mergedInvoices = Array.from(mergedInvoicesById.values()).sort((a, b) => {
        const aDate = a?.createdAt ? new Date(a.createdAt).getTime() : 0
        const bDate = b?.createdAt ? new Date(b.createdAt).getTime() : 0
        return bDate - aDate
      })

      setOrderInvoices(mergedInvoices)
    } catch (error) {
      console.error('OrderDetails: Failed to load related invoices:', error)
      setOrderInvoices([])
      // Ladefehler ist nicht "noch keine Rechnung" (eigener Zustand mit "Erneut versuchen").
      setOrderInvoicesError(true)
    } finally {
      setLoadingOrderInvoices(false)
    }
  }

  const isSpecialRepairWorkflow = (workflow: any) => {
    const workflowName = String(
      workflow?.workflowName
      || workflow?.name
      || workflow?.workflowTemplateId?.name
      || ''
    )
      .trim()
      .toLowerCase()

    return SPECIAL_REPAIR_WORKFLOW_NAME_MARKERS.some((marker) => workflowName.includes(marker))
  }

  const openSpecialRepairWorkflowDialog = async () => {
    if (!id) return

    try {
      let repairWorkflowResponse = await getRepairWorkflow(id)
      let repairWorkflow =
        (repairWorkflowResponse as any)?.data?.workflow
        || (repairWorkflowResponse as any)?.workflow
        || null

      if (!repairWorkflow) {
        const initResponse = await initializeRepairWorkflow(id, order?.customerId?._id, customerInspection?._id)
        repairWorkflow =
          (initResponse as any)?.data?.workflow
          || (initResponse as any)?.workflow
          || null

        if (!repairWorkflow) {
          repairWorkflowResponse = await getRepairWorkflow(id)
          repairWorkflow =
            (repairWorkflowResponse as any)?.data?.workflow
            || (repairWorkflowResponse as any)?.workflow
            || null
        }
      }

      if (!repairWorkflow) {
        throw new Error('Reparatur-Workflow konnte nicht geladen werden')
      }

      setSelectedRepairWorkflow(repairWorkflow)
      setRepairWorkflowDialogOpen(true)
    } catch (error: any) {
      console.error('OrderDetails: Error opening special repair workflow dialog:', error)
      toast({
        title: 'Fehler',
        description: error?.message || 'Reparatur-Workflow konnte nicht geladen werden',
        variant: 'destructive',
      })
    }
  }

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!isAuthenticated) return

      try {
        console.log("Fetching user profile...")
        const response = await getUserProfile()
        setUser((response as any).user)
        setProfileLoadError(false)
        console.log("User profile loaded:", (response as any).user?.email, "Role:", (response as any).user?.role)
      } catch (error) {
        console.error("Error fetching user profile:", error)
        // Ohne Profil kann der Auftrag nicht geladen werden: Fehler mit "Erneut versuchen"
        // statt eines endlosen Ladezustands.
        setProfileLoadError(true)
        setLoading(false)
      }
    }

    fetchUserProfile()
  }, [isAuthenticated, orderReloadToken])

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
        setOrderLoadError(fetchedOrder ? '' : 'not-found')

        if (user.role === 'admin') {
            const bookingId = typeof fetchedOrder?.bookingId === 'string'
              ? fetchedOrder.bookingId
              : fetchedOrder?.bookingId?._id

            await loadOrderInvoices(fetchedOrder?._id || id, bookingId ? String(bookingId) : null)
        } else {
          setOrderInvoices([])
        }

        // Log unlock information if present
        console.log("Unlock Pattern:", fetchedOrder?.unlockPattern)
        console.log("Unlock Code:", fetchedOrder?.unlockCode ? "***" : "Not provided")
        console.log("No Lock:", fetchedOrder?.noLock)
        console.log("Device Brand:", fetchedOrder?.deviceBrand)
        console.log("Device Model:", fetchedOrder?.deviceModel)

      } catch (error) {
        console.error("Error fetching order details:", error)
        // 403/404 = nicht vorhanden oder kein Zugriff; alles andere ist ein Ladefehler
        // mit "Erneut versuchen" (nie als "existiert nicht" ausgeben).
        const status = Number((error as { status?: number } | null)?.status)
        setOrderLoadError(status === 403 || status === 404 ? 'not-found' : 'error')
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [id, user, toast, orderReloadToken])

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

  // Der Versandstand wird bei jedem neu geladenen Auftrag mitgeladen (auch nach
  // refreshOrder), damit Buttons und Anzeige nie einen veralteten Stand zeigen.
  useEffect(() => {
    if (!order?._id) {
      setOrderShipments(null)
      return
    }
    void loadOrderShipments(String(order._id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order])

  // Rechnungen (nur Admin) lädt fetchOrder direkt mit dem Auftrag - auch für Aufträge ohne
  // Buchung; ein zweiter Abruf beim Eintreffen der Buchung entfällt (gleiche Daten).

  // Invoices for the CUSTOMER. The admin list above uses the admin-only finance API;
  // customers get their own documents through the owner-scoped /api/invoices endpoint,
  // so no other customer's documents can ever be reached from here.
  useEffect(() => {
    const loadCustomerInvoices = async () => {
      if (!id || user?.role !== 'customer') {
        setCustomerInvoices([])
        return
      }

      const bookingId = typeof order?.bookingId === 'string'
        ? order.bookingId
        : (order as any)?.bookingId?._id

      try {
        setLoadingCustomerInvoices(true)
        setCustomerInvoicesError(false)
        const invoices = await getCustomerInvoicesForOrder(id, bookingId ? String(bookingId) : null)
        setCustomerInvoices(invoices)
      } catch (error) {
        console.error('OrderDetails: Failed to load customer invoices:', error)
        setCustomerInvoices([])
        // Fehler ist NICHT "noch keine Rechnung" - eigener Zustand mit "Erneut versuchen".
        setCustomerInvoicesError(true)
      } finally {
        setLoadingCustomerInvoices(false)
      }
    }

    loadCustomerInvoices()
  }, [id, user?.role, order?.bookingId, customerInvoicesReloadToken])

  // Zahlungsstand für den Kunden: Kundenprojektion der Buchungs-Zahlungsübersicht.
  // Beträge gelten für die GESAMTE Buchung (bei mehreren Geräten so beschriftet).
  const customerBookingIdForPayments = typeof order?.bookingId === 'string'
    ? order.bookingId
    : String((order as any)?.bookingId?._id || '')
  useEffect(() => {
    if (user?.role !== 'customer' || !customerBookingIdForPayments) {
      setCustomerPayments(null)
      setCustomerPaymentsState('idle')
      return
    }
    let cancelled = false
    setCustomerPaymentsState('loading')
    getCustomerBookingPayments(customerBookingIdForPayments)
      .then((overview) => {
        if (cancelled) return
        setCustomerPayments(overview)
        setCustomerPaymentsState('ready')
      })
      .catch((error) => {
        if (cancelled) return
        console.error('OrderDetails: Failed to load customer payment summary:', error)
        setCustomerPayments(null)
        setCustomerPaymentsState('error')
      })
    return () => { cancelled = true }
  }, [user?.role, customerBookingIdForPayments, customerPaymentsReloadToken])

  // Personal/Admin: Zahlungsübersicht der Buchung (GET /api/bookings/:id/payments, volle
  // Personalsicht). Die Beträge rechnet ausschließlich der Server (PaymentService).
  useEffect(() => {
    const privileged = user?.role === 'admin' || user?.role === 'staff'
    if (!privileged || !customerBookingIdForPayments) {
      setAdminPayments(null)
      setAdminPaymentsState('idle')
      return
    }
    let cancelled = false
    setAdminPaymentsState((previous) => (previous === 'ready' ? previous : 'loading'))
    getBookingPayments(customerBookingIdForPayments)
      .then((overview) => {
        if (cancelled) return
        setAdminPayments(overview)
        setAdminPaymentsState('ready')
      })
      .catch((error) => {
        if (cancelled) return
        console.error('OrderDetails: Failed to load booking payment overview:', error)
        setAdminPayments(null)
        setAdminPaymentsState('error')
      })
    return () => { cancelled = true }
  }, [user?.role, customerBookingIdForPayments, order?.updatedAt, adminPaymentsReloadToken])

  // Personal/Admin: Ungelesen / Antwort ausstehend für den Tab "Kommunikation" (gleiche
  // Regel wie das Postfach). Der Verlauf selbst wird erst im Tab geladen und als gelesen markiert.
  useEffect(() => {
    const privileged = user?.role === 'admin' || user?.role === 'staff'
    if (!privileged || !id) {
      setAdminCommunicationCounts(null)
      return
    }
    let cancelled = false
    getUnreadMessageCounts([id])
      .then((counts) => {
        if (cancelled) return
        const entry = counts?.[id] || {}
        setAdminCommunicationCounts({ unread: Number(entry.unread) || 0, awaitingReply: Boolean(entry.awaitingReply) })
      })
      .catch(() => {
        if (!cancelled) setAdminCommunicationCounts(null)
      })
    return () => { cancelled = true }
  }, [user?.role, id, adminCommunicationReloadToken])

  // Einsendestatus (Kunde -> McRepair) für den "Nächster Schritt" der Kundensicht.
  useEffect(() => {
    if (user?.role !== 'customer' || !order?._id) {
      setCustomerInbound(null)
      setCustomerInboundState('idle')
      return
    }
    let cancelled = false
    setCustomerInboundState((previous) => (previous === 'ready' ? previous : 'loading'))
    getOrderInboundLabel(String(order._id))
      .then((view) => {
        if (cancelled) return
        setCustomerInbound(view)
        setCustomerInboundState('ready')
      })
      .catch((error) => {
        if (cancelled) return
        console.error('OrderDetails: Failed to load inbound label state:', error)
        setCustomerInbound(null)
        setCustomerInboundState('error')
      })
    return () => { cancelled = true }
  }, [user?.role, order?._id, order?.updatedAt, customerInboundReloadToken])

  // Kundenverlauf: erst beim Aufklappen laden (freigegebene Einträge, deutsche Titel vom Server).
  useEffect(() => {
    if (!customerHistoryOpen || user?.role !== 'customer' || !order?._id) return
    let cancelled = false
    setCustomerHistoryState('loading')
    getOrderHistory(String(order._id), { limit: 100 })
      .then((response) => {
        if (cancelled) return
        setCustomerHistory(Array.isArray(response?.entries) ? response.entries : [])
        setCustomerHistoryState('ready')
      })
      .catch((error) => {
        if (cancelled) return
        console.error('OrderDetails: Failed to load customer history:', error)
        setCustomerHistoryState('error')
      })
    return () => { cancelled = true }
  }, [customerHistoryOpen, user?.role, order?._id, order?.updatedAt, customerHistoryReloadToken])

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

  // Fetch repair services for order
  useEffect(() => {
    const fetchRepairServices = async () => {
      if (!id || !user) return

      try {
        console.log("Fetching repair services for order:", id)

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

  // Auswählbare Services (nur Admin/Staff): der SERVER filtert vollständig nach dem
  // aktuellen Gerät des Auftrags (Marke, Modell, Gerätetyp) - keine erste Seite des
  // Gesamtkatalogs, kein Nachfiltern hier. Nach einem Gerätewechsel neu laden.
  useEffect(() => {
    if (!id || !user || (user.role !== 'admin' && user.role !== 'staff')) return
    let cancelled = false

    getAvailableServicesForOrder(id)
      .then((response) => {
        if (!cancelled) setAvailableServices(response.services || [])
      })
      .catch((error) => {
        console.error("Error fetching available services for order:", error)
        if (!cancelled) setAvailableServices([])
      })

    return () => {
      cancelled = true
    }
  }, [id, user, order?.deviceBrand, order?.deviceModel, order?.deviceType])

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
      if (!id || !user) {
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

  // Fetch repair workflow status for display in the order detail card
  const [activeRepairWorkflow, setActiveRepairWorkflow] = useState<any>(null)

  useEffect(() => {
    const fetchActiveRepairWorkflow = async () => {
      if (!id || !customerInspection) return
      try {
        const response = await getRepairWorkflow(id)
        const wf = (response as any)?.data?.workflow || (response as any)?.workflow || null
        setActiveRepairWorkflow(wf)
      } catch {
        setActiveRepairWorkflow(null)
      }
    }
    fetchActiveRepairWorkflow()
  }, [id, customerInspection, selectedRepairWorkflow])

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
        description: "Der ausgewählte Workflow konnte in diesem Auftrag nicht geladen werden.",
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

    if (isSpecialRepairWorkflow(matchedWorkflow)) {
      void openSpecialRepairWorkflowDialog()
      navigate(location.pathname, { replace: true })
      return
    }

    setSelectedWorkflowForExecution(matchedWorkflow)
    setWorkflowExecutionMode(safeMode)
    setWorkflowExecutionModalOpen(true)
    navigate(location.pathname, { replace: true })
  }, [location.pathname, navigate, requestedWorkflowId, requestedWorkflowMode, toast, workflows])

  // Fetch progress timeline for order. Neu laden, sobald sich Status oder Stand des
  // Auftrags ändern (Statusmenü, Workflow, refreshOrder), damit Meilensteine und
  // "Aktueller Schritt" nicht veralten. Antworten eines älteren Aufrufs werden verworfen.
  // Erst laden, wenn der Auftrag da ist (sonst ein überflüssiger zweiter Abruf beim Eintreffen).
  const progressTimelineOrderKey = order ? `${order.status || ''}|${(order as any)?.updatedAt || ''}` : null
  useEffect(() => {
    if (!id || progressTimelineOrderKey === null) return
    let cancelled = false
    const fetchProgressTimeline = async () => {
      try {
        const timelineResponse = await getOrderProgressTimeline(id)
        if (cancelled) return
        setProgressTimeline(timelineResponse)
        setProgressTimelineError(false)
      } catch (error: any) {
        if (cancelled) return
        console.error("OrderDetails: Error fetching progress timeline:", error)
        setProgressTimelineError(true)
        // Don't show error toast as timeline is not critical
      }
    }

    fetchProgressTimeline()
    return () => { cancelled = true }
  }, [id, progressTimelineOrderKey])

  // Beim Wechsel auf einen anderen Auftrag (Links im Kopf: Reklamation / Originalauftrag)
  // bleibt die Seite gemountet: offene Rückfragen des vorherigen Auftrags verwerfen und
  // den alten Zeitstrahl nicht als den des neuen Auftrags anzeigen.
  useEffect(() => {
    setThreadPending({ questions: 0, actions: 0, offers: 0 })
    setProgressTimeline(null)
    setProgressTimelineError(false)
  }, [id])

  const handleSubmitComplaint = async () => {
    if (!order) return

    if (!complaintReason.trim() || !complaintDescription.trim()) {
      toast({
        title: "Fehlende Angaben",
        description: "Bitte Reklamationsgrund und Beschreibung ausfüllen.",
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
        description: "Bitte einen Grund für die anerkannte Reklamation angeben.",
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
        description: "Bitte einen Grund für die abgelehnte Reklamation angeben.",
        variant: "destructive"
      })
      return
    }

    try {
      setComplaintActionLoading("deny")
      const response = await denyComplaint(complaintWorkflow._id, {
        technician_reason: technicianDenyReason.trim(),
      })

      if ((response as any)?.escalated) {
        toast({
          title: "Reklamation eskaliert",
          description: "Die Reklamation wurde an den Admin zur Prüfung weitergeleitet."
        })
      } else {
        toast({
          title: "Reklamation abgelehnt",
          description: "Die Reklamation wurde bestätigt und das Reparaturangebot wurde dem Kunden übermittelt."
        })
      }

      const refreshedComplaint = await getComplaint(complaintWorkflow._id)
      setComplaintWorkflow((refreshedComplaint as any)?.complaint || null)
      setComplaintActionDialog(null)
      setDenyReasonPreset("")
      setTechnicianDenyReason("")
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
        title: "Erfolg",
        description: "Der Mitarbeiter wurde zugewiesen."
      })
    } catch (error: any) {
      console.error("Staff assignment error:", error.message)
      toast({
        title: "Fehler",
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
      if (user?.role === 'admin') {
        const bookingId = typeof (orderResponse as any)?.order?.bookingId === 'string'
          ? (orderResponse as any).order.bookingId
          : (orderResponse as any)?.order?.bookingId?._id

        await loadOrderInvoices(id, bookingId ? String(bookingId) : null)
      }
    } catch (error) {
      console.error("Error refreshing order:", error)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!id || !order) return
    // Stornieren nur mit Grund (Server: 400 ohne Grund) - immer über den Storno-Dialog.
    if (newStatus === 'cancelled') {
      setStatusDropdownOpen(false)
      setOrderCancelDialogOpen(true)
      return
    }

    try {
      setUpdatingStatus(true)
      setStatusDropdownOpen(false)

      console.log('OrderDetails: Updating order status to:', newStatus)
      await updateOrderStatus(id, newStatus)

      toast({
        title: "Erfolg",
        description: `Der Auftragsstatus wurde auf „${translateOrderStatus(newStatus)}“ geändert.`
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
        title: "Fehler",
        description: error.message || "Der Auftragsstatus konnte nicht geändert werden.",
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

  const openInvoiceDetailsDialog = async (invoice: FinancialInvoice) => {
    setSelectedInvoiceDetails(invoice)
    setInvoiceDetailPayments([])
    setInvoiceDetailCreditNotes([])
    setInvoiceDetailLoading(true)
    setInvoiceDetailsDialogOpen(true)

    try {
      const result = await getInvoiceDetails(invoice._id)
      setInvoiceDetailPayments(result.payments || [])
      setInvoiceDetailCreditNotes(result.creditNotes || [])
      if (result.invoice) {
        // Der Zahlungsstand kommt im Detail als eigenes Feld `balance` (inkl. paymentState).
        setSelectedInvoiceDetails({
          ...(result.invoice as FinancialInvoice),
          balance: result.balance || (result.invoice as FinancialInvoice).balance || invoice.balance,
          paymentState: result.balance?.paymentState || (result.invoice as FinancialInvoice).paymentState || invoice.paymentState,
        } as FinancialInvoice)
      }
    } catch {
      // silently keep the invoice data already in state
    } finally {
      setInvoiceDetailLoading(false)
    }
  }

  const handleCreateOrderInvoice = async () => {
    if (!id || creatingOrderInvoice) return

    if (user?.role !== 'admin') {
      toast({
        title: 'Nicht erlaubt',
        description: 'Nur Administratoren können Rechnungen erstellen.',
        variant: 'destructive',
      })
      return
    }

    try {
      setCreatingOrderInvoice(true)
      const response = await createInvoiceFromOrder(id)
      const invoiceNumber = (response as any)?.invoice?.invoiceNumber

      toast({
        title: 'Rechnung erstellt',
        description: invoiceNumber
          ? `Rechnung ${invoiceNumber} wurde erfolgreich erstellt.`
          : 'Die Rechnung wurde erfolgreich erstellt.',
      })

      const bookingId = typeof order?.bookingId === 'string' ? order.bookingId : (order as any)?.bookingId?._id
      await loadOrderInvoices(id, bookingId ? String(bookingId) : null)
    } catch (error: any) {
      const isDuplicateInvoice = error?.status === 409 || error?.code === 'INVOICE_ALREADY_EXISTS'
      if (isDuplicateInvoice) {
        const existingInvoiceLabel = error?.existingInvoiceNumber
          ? `#${error.existingInvoiceNumber}`
          : 'die bestehende Rechnung'
        const redirectTarget = error?.redirectTo
          || (error?.existingInvoiceId
            ? `/admin/financial?tab=overview&highlightInvoiceId=${encodeURIComponent(error.existingInvoiceId)}`
            : '/admin/financial?tab=overview')

        toast({
          title: 'Rechnung bereits vorhanden',
          description: `Für diese Buchung existiert bereits ${existingInvoiceLabel}. Sie werden direkt weitergeleitet.`,
        })
        navigate(redirectTarget)
        return
      }

      toast({
        title: 'Rechnung konnte nicht erstellt werden',
        description: error?.message || 'Bitte prüfen Sie die Auftragsdaten und versuchen Sie es erneut.',
        variant: 'destructive',
      })
    } finally {
      setCreatingOrderInvoice(false)
    }
  }

  // --- Versand: zwei getrennte Richtungen -----------------------------------
  // Einsendung   = Kunde -> McRepair (Einsendelabel: an der Buchung bzw. per DHL-Retoure)
  // Auslieferung = McRepair -> Kunde ("An Kunden versenden": DHL Paket, Absender Shop,
  //                Empfänger Lieferadresse - beides bestimmt ausschließlich der Server)
  // Ob eine Aktion möglich ist, entscheidet ebenfalls der SERVER (orderShipments.*Action),
  // mit derselben Funktion, die die Label-Erstellung prüft. Die Buttons spiegeln nur das.
  const loadOrderShipments = async (orderId?: string) => {
    if (!orderId) return
    try {
      setOrderShipments(await getOrderShipments(orderId))
      setShipmentsLoadError(false)
    } catch (error) {
      console.error('OrderDetails: Failed to load shipment state:', error)
      setOrderShipments(null)
      setShipmentsLoadError(true)
    }
  }

  const handleCreateOutboundLabel = async () => {
    if (!id || !order || creatingOrderShippingLabel || !orderShipments?.outboundAction?.allowed) return

    try {
      setCreatingOrderShippingLabel(true)
      const response = await createOutboundShippingLabel(id)

      await refreshOrder()

      toast({
        title: response?.alreadyExists ? 'Versandlabel bereits vorhanden' : 'Versandlabel für den Kunden erstellt',
        description: response?.trackingNumber
          ? `Sendungsnummer: ${response.trackingNumber}. Das Gerät gilt erst nach Übergabe an DHL als versendet.`
          : 'Das Versandlabel wurde erstellt. Das Gerät gilt erst nach Übergabe an DHL als versendet.',
      })
    } catch (error: any) {
      // Auch nach einem Fehler neu laden: eine unklare DHL-Antwort setzt den Abgleich-Zustand.
      await loadOrderShipments(order._id)
      toast({
        title: 'Versandlabel konnte nicht erstellt werden',
        description: error?.message || 'Bitte prüfen Sie die Lieferadresse und die DHL-Integrationseinstellungen.',
        variant: 'destructive',
      })
    } finally {
      setCreatingOrderShippingLabel(false)
    }
  }

  const handleDownloadOrderShippingLabel = async () => {
    if (!order?._id || downloadingOrderShippingLabel) return

    try {
      setDownloadingOrderShippingLabel(true)
      // Gemeinsamer Label-Helfer (PDF-Prüfung, deutsche Fehlermeldungen, kein Logout bei 401/403).
      await downloadOrderShippingLabel(order._id, labelFilename('outbound', order.orderNumber || order._id))
    } catch (error: any) {
      toast({
        title: 'Versandlabel konnte nicht heruntergeladen werden',
        description: error?.message || 'Bitte versuchen Sie es erneut.',
        variant: 'destructive',
      })
    } finally {
      setDownloadingOrderShippingLabel(false)
    }
  }

  const handleCreateInboundLabel = async () => {
    const action = orderShipments?.inboundAction
    if (!order || creatingOrderReturnLabel || !action?.allowed) return

    try {
      setCreatingOrderReturnLabel(true)
      let trackingNumber = ''

      if (action.target === 'booking' && action.bookingId) {
        // Einsendelabel der Buchung: Absender Kunde, Empfänger McRepair (Adresse vom Server).
        const response = await createBookingShippingLabel(String(action.bookingId), {
          labelDirection: 'inbound',
          receiverFromConfiguration: true,
        })
        trackingNumber = response?.trackingNumber || ''
        try {
          const refreshedBooking = await getBooking(String(action.bookingId))
          setLinkedBooking((refreshedBooking as any)?.booking || null)
        } catch (bookingError) {
          console.error('OrderDetails: Failed to reload booking after inbound label:', bookingError)
        }
      } else {
        // Auftrag ohne Buchung: DHL-Retoure - der Kunde ist Absender, McRepair Empfänger.
        const response = await createOrderReturnLabel(order._id)
        if (!response?.success) {
          throw new Error(response?.error || response?.message || 'Einsendelabel konnte nicht erstellt werden.')
        }
        trackingNumber = response?.returnTrackingNumber || ''
      }

      // Re-read through the normal detail endpoint: the raw mongoose document in a label
      // response has a different services/shopProducts shape than the read layer returns.
      await refreshOrder()

      toast({
        title: 'Einsendelabel erstellt',
        description: trackingNumber
          ? `Sendungsnummer: ${trackingNumber} (Kunde → McRepair)`
          : 'Das Einsendelabel (Kunde → McRepair) wurde erstellt.',
      })
    } catch (error: any) {
      await loadOrderShipments(order._id)
      toast({
        title: 'Einsendelabel konnte nicht erstellt werden',
        description: error?.message || 'Bitte prüfen Sie die Kundenadresse und die DHL-Integrationseinstellungen.',
        variant: 'destructive',
      })
    } finally {
      setCreatingOrderReturnLabel(false)
    }
  }

  const handleDownloadInboundLabel = async () => {
    const inbound = orderShipments?.inboundLabels?.find((entry) => entry.hasLabel)
    if (!order || downloadingOrderReturnLabel || !inbound) return

    try {
      setDownloadingOrderReturnLabel(true)
      const bookingId = String(inbound.bookingId || linkedBooking?._id || '')
      const bookingRef = inbound.bookingNumber || linkedBooking?.bookingNumber || bookingId
      const placeholder = Boolean((inbound as { placeholder?: boolean }).placeholder)
      if (inbound.source === 'booking' && bookingId) {
        await downloadBookingShippingLabel(bookingId, labelFilename('inbound', bookingRef, placeholder))
      } else if (inbound.source === 'booking-retoure' && bookingId) {
        await downloadBookingReturnLabel(bookingId, labelFilename('inbound', bookingRef, placeholder))
      } else {
        await downloadOrderReturnLabel(order._id, labelFilename('inbound', order.orderNumber || order._id, placeholder))
      }
    } catch (error: any) {
      toast({
        title: 'Einsendelabel konnte nicht heruntergeladen werden',
        description: error?.message || 'Bitte versuchen Sie es erneut.',
        variant: 'destructive',
      })
    } finally {
      setDownloadingOrderReturnLabel(false)
    }
  }

  // Abgleich nach unklarer DHL-Antwort (nur Administratoren): erst im DHL-Geschäftskunden-
  // portal nach der Referenz suchen, dann hier das Ergebnis eintragen.
  const handleReconcileOutbound = async (resolution: 'not-created' | 'created') => {
    if (!order?._id || reconcilingOutbound) return
    const trackingNumber = reconcileTrackingNumber.replace(/\s+/g, '')
    if (resolution === 'created' && !trackingNumber) {
      toast({
        title: 'Sendungsnummer fehlt',
        description: 'Bitte die Sendungsnummer aus dem DHL-Geschäftskundenportal eintragen.',
        variant: 'destructive',
      })
      return
    }

    try {
      setReconcilingOutbound(true)
      const response = await reconcileOrderShipment(order._id, { resolution, trackingNumber: trackingNumber || undefined })
      setOrderShipments(response?.shipments || null)
      setReconcileTrackingNumber('')
      await refreshOrder()
      toast({
        title: 'Abgleich abgeschlossen',
        description: resolution === 'created'
          ? 'Die Sendungsnummer wurde übernommen. Das PDF-Label bitte im DHL-Geschäftskundenportal abrufen.'
          : 'Es wurde keine Sendung angelegt. Das Versandlabel kann jetzt neu erstellt werden.',
      })
    } catch (error: any) {
      toast({
        title: 'Abgleich fehlgeschlagen',
        description: error?.message || 'Bitte erneut versuchen.',
        variant: 'destructive',
      })
    } finally {
      setReconcilingOutbound(false)
    }
  }

  // Abgleich der Einsendung (Kunde -> McRepair) am Auftrag - gleiche Logik wie oben.
  const handleReconcileInbound = async (resolution: 'not-created' | 'created') => {
    if (!order?._id || reconcilingInbound) return
    const trackingNumber = reconcileInboundTrackingNumber.replace(/\s+/g, '')
    if (resolution === 'created' && !trackingNumber) {
      toast({
        title: 'Sendungsnummer fehlt',
        description: 'Bitte die Sendungsnummer aus dem DHL-Geschäftskundenportal eintragen.',
        variant: 'destructive',
      })
      return
    }

    try {
      setReconcilingInbound(true)
      const inboundView = orderShipments?.inbound as (ReconcilableShipmentView & { lockScope?: string }) | undefined
      const reconcileUrl = String(inboundView?.reconcileUrl || '')
      // DHL-4: liegt die Sperre an der BUCHUNG (Checkout-/Buchungs-Einsendelabel), schließt der
      // Abgleich an der Buchung ab (POST /api/bookings/:id/shipping/reconcile). Nur die Buchung
      // DIESES Auftrags wird akzeptiert.
      const bookingReconcileMatch = /^\/api\/bookings\/([a-f0-9]{24})\/shipping\/reconcile$/i.exec(reconcileUrl)
      const ownBookingId = String(linkedBooking?._id || customerBookingIdForPayments || '')
      if (inboundView?.lockScope === 'booking' || bookingReconcileMatch) {
        const bookingId = bookingReconcileMatch?.[1] || ownBookingId
        if (!bookingId || (ownBookingId && bookingId !== ownBookingId)) {
          throw new Error('Die Buchung dieses Auftrags konnte nicht eindeutig bestimmt werden. Bitte den Abgleich in der Buchungsverwaltung abschließen.')
        }
        await reconcileBookingInboundLabel(bookingId, { resolution, trackingNumber: trackingNumber || undefined })
        await loadOrderShipments(order._id)
        try {
          const refreshedBooking = await getBooking(bookingId)
          setLinkedBooking((refreshedBooking as any)?.booking || null)
        } catch (bookingError) {
          console.error('OrderDetails: Failed to reload booking after reconcile:', bookingError)
        }
      } else {
        const response = await reconcileOrderInboundShipment(order._id, { resolution, trackingNumber: trackingNumber || undefined }, reconcileUrl)
        if (response?.shipments) setOrderShipments(response.shipments)
      }
      setReconcileInboundTrackingNumber('')
      await refreshOrder()
      toast({
        title: 'Abgleich abgeschlossen',
        description: resolution === 'created'
          ? 'Die Sendungsnummer der Einsendung wurde übernommen. Das PDF-Label bitte im DHL-Geschäftskundenportal abrufen.'
          : 'Es wurde kein Einsendelabel angelegt. Das Einsendelabel kann jetzt neu erstellt werden.',
      })
    } catch (error: any) {
      await loadOrderShipments(order._id)
      toast({
        title: 'Abgleich fehlgeschlagen',
        description: error?.message || 'Bitte erneut versuchen.',
        variant: 'destructive',
      })
    } finally {
      setReconcilingInbound(false)
    }
  }

  const handleDownloadCustomerInvoicePdf = async (invoice: CustomerOrderInvoice) => {
    if (!invoice?._id || downloadingInvoiceId) return

    try {
      setDownloadingInvoiceId(String(invoice._id))
      const documentLabel = invoice.isCreditNote ? 'gutschrift' : 'rechnung'
      await downloadCustomerInvoicePdf(
        String(invoice._id),
        `${documentLabel}-${invoice.invoiceNumber || invoice._id}.pdf`
      )
    } catch (error: any) {
      toast({
        title: 'Rechnung konnte nicht heruntergeladen werden',
        description: error?.message || 'Bitte versuchen Sie es erneut.',
        variant: 'destructive',
      })
    } finally {
      setDownloadingInvoiceId('')
    }
  }

  const handleRemoveEPart = async (ePartId: string) => {
    if (!id) return

    try {
      await removeEPartFromOrder(id, ePartId)

      toast({
        title: "Erfolg",
        description: "Das Ersatzteil wurde entfernt."
      })

      // Refresh order data
      await refreshOrder()
    } catch (error: any) {
      console.error("Error removing EPart:", error)
      toast({
        title: "Fehler",
        description: error.message || "Das Ersatzteil konnte nicht entfernt werden.",
        variant: "destructive"
      })
    }
  }

  // Bietet bei 409 ORDER_VALUE_NOT_RECONCILED die Bestätigung der Neuberechnung an (true),
  // sonst false - der Aufrufer zeigt den Fehler dann wie bisher.
  const offerRepricingConfirmation = (
    error: any,
    title: string,
    retry: (confirmation: OrderRepricingOptions) => Promise<void>
  ) => {
    if (readOrderServiceErrorCode(error) !== ORDER_VALUE_NOT_RECONCILED) return false
    setPendingRepricing({
      title,
      message: error?.message || "Der gespeicherte Auftragswert passt nicht zu den Positionen.",
      details: readReconciliationDetails(error),
      outdated: isRepricingConfirmationOutdated(error),
      retry
    })
    return true
  }

  const confirmPendingRepricing = async () => {
    if (!pendingRepricing || confirmingRepricing) return
    const { retry, details, title } = pendingRepricing
    try {
      setConfirmingRepricing(true)
      await retry(buildRepricingConfirmation(details))
      setPendingRepricing(null)
    } catch (error: any) {
      console.error("Error confirming repricing:", error)
      // Hat sich der Auftrag inzwischen geändert, zeigt der Dialog die NEUE Abweichung.
      if (!offerRepricingConfirmation(error, title, retry)) {
        setPendingRepricing(null)
        toast({
          title: "Fehler",
          description: error?.message || "Die Änderung konnte nicht gespeichert werden.",
          variant: "destructive"
        })
      }
    } finally {
      setConfirmingRepricing(false)
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

      const submitAddon = async (repricing?: OrderRepricingOptions) => {
        await addAddonToOrder(id, addonData, repricing)

        toast({
          title: "Erfolg",
          description: "Zusatzservice wurde erfolgreich hinzugefügt."
        })

        // Reset form
        resetAddOnForm()
        setAddAddonDialogOpen(false)

        // Refresh order data
        await refreshOrder()
      }

      try {
        await submitAddon()
      } catch (error: any) {
        if (offerRepricingConfirmation(error, "Zusatzleistung hinzufügen", submitAddon)) return
        throw error
      }
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

      const addonId = editingAddon._id
      const submitAddonUpdate = async (repricing?: OrderRepricingOptions) => {
        await updateOrderAddon(id, addonId, updateData, repricing)

        toast({
          title: "Erfolg",
          description: "Die Zusatzleistung wurde aktualisiert."
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
      }

      try {
        await submitAddonUpdate()
      } catch (error: any) {
        if (offerRepricingConfirmation(error, "Zusatzleistung ändern", submitAddonUpdate)) return
        throw error
      }
    } catch (error: any) {
      console.error("Error updating add-on:", error)
      toast({
        title: "Fehler",
        description: error.message || "Der Zusatzservice konnte nicht aktualisiert werden.",
        variant: "destructive"
      })
    }
  }

  const handleRemoveAddon = async (addonId: string) => {
    if (!id) return

    const submitAddonRemoval = async (repricing?: OrderRepricingOptions) => {
      await removeAddonFromOrder(id, addonId, repricing)

      toast({
        title: "Erfolg",
        description: "Die Zusatzleistung wurde entfernt."
      })

      // Refresh order data
      await refreshOrder()
    }

    try {
      await submitAddonRemoval()
    } catch (error: any) {
      console.error("Error removing add-on:", error)
      if (offerRepricingConfirmation(error, "Zusatzleistung entfernen", submitAddonRemoval)) return
      toast({
        title: "Fehler",
        description: error.message || "Der Zusatzservice konnte nicht entfernt werden.",
        variant: "destructive"
      })
    }
  }

  const handleAssignStaffToAddon = async () => {
    if (!id || !selectedAddonForStaff || !addonStaffId) return

    try {
      await assignStaffToAddon(id, selectedAddonForStaff._id, addonStaffId)

      toast({
        title: "Erfolg",
        description: "Der Mitarbeiter wurde der Zusatzleistung zugewiesen."
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
        title: "Fehler",
        description: error.message || "Der Mitarbeiter konnte der Zusatzleistung nicht zugewiesen werden.",
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

    const submitShopProduct = async (repricing?: OrderRepricingOptions) => {
      await addShopProductToOrder(id, productId, quantity, repricing)

      toast({
        title: "Erfolg",
        description: "Das Produkt wurde dem Auftrag hinzugefügt."
      })

      // Refresh order data
      await refreshOrder()
    }

    try {
      await submitShopProduct()
    } catch (error: any) {
      console.error("Error adding shop product:", error)
      if (offerRepricingConfirmation(error, "Produkt hinzufügen", submitShopProduct)) {
        // Die Auswahl schließen, die Rückfrage übernimmt; der Auswahldialog zeigt die
        // Servermeldung (nicht gespeichert) als Hinweis.
        setShopProductDialogOpen(false)
      }
      throw error
    }
  }

  const handleRemoveShopProduct = async (productItemId: string) => {
    if (!id) return

    const submitShopProductRemoval = async (repricing?: OrderRepricingOptions) => {
      await removeShopProductFromOrder(id, productItemId, repricing)

      toast({
        title: "Erfolg",
        description: "Das Produkt wurde aus dem Auftrag entfernt."
      })

      // Refresh order data
      await refreshOrder()
    }

    try {
      await submitShopProductRemoval()
    } catch (error: any) {
      console.error("Error removing shop product:", error)
      if (offerRepricingConfirmation(error, "Produkt entfernen", submitShopProductRemoval)) return
      toast({
        title: "Fehler",
        description: error.message || "Das Produkt konnte nicht entfernt werden.",
        variant: "destructive"
      })
    }
  }

  const handleUpdateShopProductQuantity = async (productItemId: string, newQuantity: number) => {
    if (!id) return

    const submitShopProductQuantity = async (repricing?: OrderRepricingOptions) => {
      await updateShopProductQuantity(id, productItemId, newQuantity, repricing)

      toast({
        title: "Erfolg",
        description: "Die Menge wurde aktualisiert."
      })

      // Refresh order data
      await refreshOrder()
    }

    try {
      await submitShopProductQuantity()
    } catch (error: any) {
      console.error("Error updating product quantity:", error)
      if (offerRepricingConfirmation(error, "Produktmenge ändern", submitShopProductQuantity)) return
      toast({
        title: "Fehler",
        description: error.message || "Die Produktmenge konnte nicht geändert werden.",
        variant: "destructive"
      })
    }
  }

  // Repair Service Handlers
  // Nach jeder Änderung: Positionen und Auftrag (inkl. Server-Preisaufstellung) neu laden.
  const reloadRepairServicesAndOrder = async () => {
    if (!id) return
    try {
      const orderServicesResponse = await getOrderServices(id)
      setRepairServices((orderServicesResponse as any).services || [])
    } catch (error) {
      console.error("Error reloading repair services:", error)
    }
    await refreshOrder()
  }

  // Warnungen des Servers (z. B. "Rechnung konnte nicht angepasst werden") dürfen nie
  // hinter einer Erfolgsmeldung verschwinden: gibt es welche, erscheint NUR die Warnung.
  const notifyOrderServiceResult = (successText: string, response?: { warnings?: string[] } | null) => {
    const list = getOrderServiceWarnings(response)
    if (list.length > 0) {
      toast({
        title: "Gespeichert – bitte prüfen",
        description: list.join(' '),
        variant: "destructive"
      })
      return
    }
    toast({
      title: "Erfolg",
      description: successText
    })
  }

  // Fehler werden an RepairServiceDialog weitergereicht (throw): der Dialog bleibt
  // offen und zeigt die Serverfehlermeldung, statt sich trotz Fehler zu schließen.
  const handleAddRepairService = async (formData: RepairServiceFormData) => {
    if (!id) return

    console.log("Adding repair service:", formData)
    const response = await addRepairServiceFromForm(id, formData)

    await reloadRepairServicesAndOrder()
    notifyOrderServiceResult(
      formData.isManual ? "Die manuelle Reparaturposition wurde hinzugefügt." : "Die Reparaturleistung wurde hinzugefügt.",
      response
    )
  }

  const handleEditRepairService = async (formData: RepairServiceFormData) => {
    if (!id || !editingService) return

    console.log("Updating repair service:", editingService._id, formData)
    const response = await updateRepairServiceFromForm(id, editingService._id, formData, {
      // Nur das gespeicherte Kennzeichen: eine Katalogposition mit gelöschtem Service ist nicht manuell.
      isManualLine: editingService.isManual === true
    })

    setEditingService(null)
    setServiceDialogOpen(false)

    await reloadRepairServicesAndOrder()
    notifyOrderServiceResult("Die Reparaturleistung wurde aktualisiert.", response)
  }

  const handleDeleteRepairService = async (serviceId: string, reason?: string, options: OrderRepricingOptions = {}) => {
    if (!id) return false

    try {
      console.log("Removing repair service:", serviceId)
      // Bestätigung an die GEZEIGTE Abweichung gebunden (repricingBasis), wie bei Zusatzleistungen,
      // Shop-Produkten und Gerätewechsel - kein nackter confirmRepricing-Boolean.
      const repricing: OrderRepricingOptions = options.confirmRepricing === true
        ? { confirmRepricing: true, ...(options.repricingBasis ? { repricingBasis: options.repricingBasis } : {}) }
        : {}
      const response = await removeServiceFromOrder(id, serviceId, {
        reason: reason || '',
        ...repricing
      })

      await reloadRepairServicesAndOrder()
      notifyOrderServiceResult("Die Reparaturleistung wurde entfernt.", response)
      return true
    } catch (error: any) {
      console.error("Error removing repair service:", error)
      if (readOrderServiceErrorCode(error) === ORDER_VALUE_NOT_RECONCILED
        && (!options.confirmRepricing || isRepricingConfirmationOutdated(error))) {
        // Auftragswert passt nicht zu den Positionen: nicht still neu berechnen, sondern im
        // Dialog die Abweichung zeigen und die Bestätigung anbieten. Hat sich der Auftrag seit
        // der Anzeige geändert (confirmationOutdated), zeigt der Dialog die NEUE Abweichung.
        setDeleteServiceRepricing({
          message: error.message || "Der gespeicherte Auftragswert passt nicht zu den Positionen.",
          details: readReconciliationDetails(error)
        })
        return false
      }
      toast({
        title: "Fehler",
        description: error.message || "Die Reparaturposition konnte nicht entfernt werden.",
        variant: "destructive"
      })
      return false
    }
  }

  const confirmDeleteRepairService = async (confirmRepricing = false) => {
    if (!serviceToDelete?._id || deletingService) return
    try {
      setDeletingService(true)
      const removed = await handleDeleteRepairService(
        String(serviceToDelete._id),
        deleteServiceReason.trim(),
        confirmRepricing ? buildRepricingConfirmation(deleteServiceRepricing?.details) : {}
      )
      if (removed) {
        setServiceToDelete(null)
        setDeleteServiceReason('')
        setDeleteServiceRepricing(null)
      }
    } finally {
      setDeletingService(false)
    }
  }

  const openEditServiceDialog = (service: any) => {
    setEditingService(service)
    setServiceDialogOpen(true)
  }

  const handleSaveService = async (formData: RepairServiceFormData) => {
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
        title: "Fehler",
        description: "Die Gerätesuche ist fehlgeschlagen.",
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
        title: "Fehler",
        description: "Bitte Marke und Modell des Geräts angeben.",
        variant: "destructive"
      })
      return
    }

    try {
      setUpdatingDevice(true)
      console.log("OrderDetails: Updating device information", { newDeviceBrand, newDeviceModel, newDeviceType })

      await updateOrderDevice(id, newDeviceBrand, newDeviceModel, newDeviceType || undefined)

      toast({
        title: "Erfolg",
        description: "Die Gerätedaten wurden aktualisiert."
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
        title: "Fehler",
        description: error.message || "Die Geräteinformationen konnten nicht aktualisiert werden.",
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

      // Handle Repair Workflow separately
      if (workflowTemplateId === 'repair-workflow') {
        console.log("OrderDetails: Initializing repair workflow for order:", id)
        const response = await initializeRepairWorkflow(id, order?.customerId?._id, customerInspection?._id)
        const workflow = (response as any)?.data?.workflow || (response as any)?.workflow

        let currentRepairWorkflow = workflow
        if (!currentRepairWorkflow) {
          const currentWorkflowResponse = await getRepairWorkflow(id)
          currentRepairWorkflow = (currentWorkflowResponse as any)?.data?.workflow || (currentWorkflowResponse as any)?.workflow || null
        }

        toast({
          title: "Erfolg",
          description: "Reparatur-Workflow wurde zugewiesen.",
        })

        setSelectedRepairWorkflow(currentRepairWorkflow)
        setRepairWorkflowDialogOpen(true)

        setWorkflowDialogOpen(false)
        return
      }

      // Handle regular workflows
      const selectedWorkflowAssignee =
        workflowAssignedStaffId && workflowAssignedStaffId !== "__unassigned__"
          ? workflowAssignedStaffId
          : undefined

      await assignWorkflowToOrder(id, workflowTemplateId, selectedWorkflowAssignee)

      toast({
        title: "Erfolg",
        description: "Der Workflow wurde dem Auftrag zugewiesen."
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
        title: "Fehler",
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
        title: "Erfolg",
        description: "Der Workflow wurde vom Auftrag entfernt."
      })

      // Refresh workflows
      const workflowsResponse = await getOrderWorkflows(id)
      setWorkflows((workflowsResponse as any).workflows || [])

      // Refresh order
      await refreshOrder()
    } catch (error: any) {
      console.error("OrderDetails: Error deleting workflow:", error)
      toast({
        title: "Fehler",
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
      if (isSpecialRepairWorkflow(workflow)) {
        void openSpecialRepairWorkflowDialog()
        return
      }

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
        title: "Erfolg",
        description: "Der Workflow wurde gestartet. Die Schritte werden jetzt ausgeführt."
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
        title: "Fehler",
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
        title: "Erfolg",
        description: "Der Workflow wurde pausiert."
      })

      // Refresh workflows
      const workflowsResponse = await getOrderWorkflows(id)
      setWorkflows((workflowsResponse as any).workflows || [])

      // Refresh order
      await refreshOrder()
    } catch (error: any) {
      console.error("OrderDetails: Error pausing workflow:", error)
      toast({
        title: "Fehler",
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
      if (isSpecialRepairWorkflow(workflow)) {
        void openSpecialRepairWorkflowDialog()
        return
      }

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
        title: "Erfolg",
        description: "Der Workflow-Schritt wurde abgeschlossen."
      })
    } catch (error: any) {
      console.error("OrderDetails: Error refreshing workflows:", error)
      toast({
        title: "Fehler",
        description: error.message || "Failed to refresh workflow data",
        variant: "destructive"
      })
    }
  }

  const handleRepairWorkflowUpdated = async (updatedWorkflow: any) => {
    setSelectedRepairWorkflow(updatedWorkflow)

    if (!id) return

    try {
      const [workflowsResponse, refreshRepairResponse] = await Promise.all([
        getOrderWorkflows(id),
        getRepairWorkflow(id),
      ])

      setWorkflows((workflowsResponse as any).workflows || [])
      const refreshedRepairWorkflow = (refreshRepairResponse as any)?.data?.workflow || (refreshRepairResponse as any)?.workflow || updatedWorkflow
      setSelectedRepairWorkflow(refreshedRepairWorkflow)

      await refreshOrder()
    } catch (error: any) {
      console.error("OrderDetails: Error refreshing repair workflow state:", error)
      toast({
        title: "Fehler",
        description: error.message || "Failed to refresh repair workflow data",
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
        title: "Erfolg",
        description: "Der Workflow wurde fortgesetzt. Die Schritte werden jetzt ausgeführt."
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
        title: "Fehler",
        description: error.message || "Failed to resume workflow",
        variant: "destructive"
      })
    } finally {
      setWorkflowActionInProgress(null)
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
      // 'Offen' statt 'Ausstehend': sonst dasselbe Wort wie der Auftragsstatus 'Ausstehend'.
      case 'pending': return 'Offen'
      case 'refunded': return 'Erstattet'
      case 'partial': return 'Teilbezahlt'
      case 'unpaid': return 'Nicht bezahlt'
      case 'overdue': return 'Überfällig'
      default: return status
    }
  }

  const translateInvoiceStatus = (status?: string) => {
    const normalizedStatus = String(status || '').toLowerCase()
    const statusMap: Record<string, string> = {
      draft: 'Entwurf',
      pending_approval: 'Freigabe ausstehend',
      sent: 'Versendet',
      viewed: 'Gesehen',
      partially_paid: 'Teilbezahlt',
      paid: 'Bezahlt',
      overdue: 'Überfällig',
      cancelled: 'Storniert',
      credited: 'Gutgeschrieben',
    }

    return statusMap[normalizedStatus] || 'Unbekannt'
  }

  // Rechnungsdetails: Positionsart, Zahlungsstatus und Zahlungsart deutsch (nie der rohe
  // englische Enum-Wert aus Invoice.items[].type / Payment.status / Payment.paymentMethod).
  const translateInvoiceItemType = (type?: string) => {
    const map: Record<string, string> = {
      service: 'Reparaturleistung',
      addon: 'Zusatzleistung',
      product: 'Produkt',
      fee: 'Gebühr',
      discount: 'Rabatt',
    }
    return map[String(type || '').toLowerCase()] || 'Position'
  }

  const translatePaymentRecordStatus = (status?: string) => {
    const map: Record<string, string> = {
      pending: 'Ausstehend',
      processing: 'In Bearbeitung',
      completed: 'Eingegangen',
      failed: 'Fehlgeschlagen',
      refunded: 'Erstattet',
      disputed: 'Angefochten',
    }
    return map[String(status || '').toLowerCase()] || 'Unbekannt'
  }

  const translatePaymentMethodLabel = (method?: string) => {
    const map: Record<string, string> = {
      credit_card: 'Kreditkarte',
      debit_card: 'Debitkarte',
      paypal: 'PayPal',
      stripe: 'Kartenzahlung',
      bank_transfer: 'Überweisung',
      invoice: 'Rechnung',
      sepa: 'SEPA-Lastschrift',
      cash: 'Barzahlung',
      apple_pay: 'Apple Pay',
      google_pay: 'Google Pay',
    }
    return map[String(method || '').toLowerCase()] || 'Zahlung'
  }

  const getInvoiceStatusBadgeClass = (status?: string) => {
    const normalizedStatus = String(status || '').toLowerCase()

    if (normalizedStatus === 'paid') return 'bg-green-100 text-green-800 border border-green-300'
    if (normalizedStatus === 'partially_paid') return 'bg-amber-100 text-amber-800 border border-amber-300'
    if (normalizedStatus === 'overdue') return 'bg-red-100 text-red-800 border border-red-300'
    if (normalizedStatus === 'cancelled') return 'bg-zinc-100 text-zinc-700 border border-zinc-300'
    if (normalizedStatus === 'draft' || normalizedStatus === 'pending_approval') return 'bg-slate-100 text-slate-800 border border-slate-300'

    return 'bg-blue-100 text-blue-800 border border-blue-300'
  }

  const getInvoiceScopeLabel = (invoice: FinancialInvoice) => {
    const linkedBookingOrderCount = Array.isArray((linkedBooking as any)?.orderIds)
      ? (linkedBooking as any).orderIds.length
      : 0
    const invoiceRepairOrderCount = Array.isArray(invoice?.repairOrderIds)
      ? invoice.repairOrderIds.length
      : 0

    if (linkedBookingOrderCount > 0 && invoiceRepairOrderCount >= linkedBookingOrderCount) {
      return 'Gesamtrechnung'
    }

    if (invoiceRepairOrderCount > 0) {
      return 'Teilrechnung'
    }

    return 'Rechnung'
  }

  const formatInvoiceDate = (value?: string) => {
    if (!value) return '-'

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return '-'

    return parsed.toLocaleDateString('de-DE')
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
    setForceInspectionStepOne(false)
    setInspectionDialogOpen(false)
    setInspectionRefreshKey((current) => current + 1)
    refreshOrder()
  }

  const handleRetryOrderLoad = () => {
    setLoading(true)
    setProfileLoadError(false)
    setOrderLoadError('')
    setOrderReloadToken((current) => current + 1)
  }

  if (loading) {
    return (
      <div className="order-details-container">
        <div className="order-section-card order-loading-skeleton" role="status" aria-live="polite">
          <p className="order-loading-text">Auftrag wird geladen …</p>
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
    // Drei getrennte Zustände: Ladefehler (mit "Erneut versuchen") vs. nicht gefunden / kein Zugriff.
    const isLoadFailure = profileLoadError || orderLoadError === 'error'
    // handleBackNavigation ist erst nach dieser Rückgabe definiert (TDZ) - hier eigene Rücksprung-Logik.
    const goBackWithoutOrder = () => {
      if (backTarget?.pathname) {
        navigate(`${backTarget.pathname}${backTarget.search || ''}${backTarget.hash || ''}`, { state: backTarget.state })
        return
      }
      navigate(user?.role === 'admin' ? '/admin/orders' : user?.role === 'staff' ? '/staff/bookings' : '/bookings')
    }
    return (
      <div className="order-details-container">
        <div className="order-section-card">
          <div className="order-empty-state" role={isLoadFailure ? 'alert' : undefined}>
            {isLoadFailure
              ? <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-amber-500" aria-hidden="true" />
              : <Package className="h-20 w-20 mx-auto mb-4 opacity-30" aria-hidden="true" />}
            <h3>{isLoadFailure ? 'Auftrag konnte nicht geladen werden.' : 'Auftrag nicht gefunden oder kein Zugriff'}</h3>
            <p>
              {isLoadFailure
                ? 'Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.'
                : 'Dieser Auftrag existiert nicht oder ist Ihrem Konto nicht zugeordnet.'}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {isLoadFailure && (
                <button
                  type="button"
                  className="order-btn order-btn-primary"
                  onClick={handleRetryOrderLoad}
                >
                  <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                  Erneut versuchen
                </button>
              )}
              <button
                type="button"
                className={`order-btn ${isLoadFailure ? 'order-btn-secondary' : 'order-btn-primary'}`}
                onClick={goBackWithoutOrder}
              >
                <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
                {backTarget?.label || (user?.role === 'admin' ? t('orderDetails.backToOrders') : user?.role === 'staff' ? t('common.back') : t('common.back'))}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const guestInfo = order.guestInfo
  const customer = order.customerId ?? (guestInfo?.isGuest || guestInfo?.email ? {
    _id: '',
    name: `${guestInfo.firstName || ''} ${guestInfo.lastName || ''}`.trim() || guestInfo.email,
    email: guestInfo.email || 'unknown@customer.local',
    phone: guestInfo.phone || '',
    avatar: '',
    createdAt: '',
    address: guestInfo.billingAddress,
  } : {
    _id: '',
    name: 'Unknown customer',
    email: 'unknown@customer.local',
    phone: '',
    avatar: '',
    createdAt: '',
  })
  const customerInitials = customer.name
    ? customer.name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase()
    : 'U'
  const customerSinceText = customer.createdAt
    ? new Date(customer.createdAt).toLocaleDateString('de-DE')
    : '-'
  const isStaffOrAdmin = user?.role === 'admin' || user?.role === 'staff'
  const isCustomer = user?.role === 'customer'
  const isComplaintFollowupOrder = Boolean((order as any)?.isComplaintFollowup)
  const complaintWorkflowStatus = complaintWorkflow?.status || ''
  const canRunComplaintTechnicianActions = isComplaintFollowupOrder && isStaffOrAdmin && complaintWorkflowStatus === 'approved'
  const canRunComplaintAdminDenyReview = isComplaintFollowupOrder && user?.role === 'admin' && complaintWorkflowStatus === 'pending_approval'
  const fallbackBackPath = user?.role === 'admin' ? '/admin/orders' : user?.role === 'staff' ? '/staff/bookings' : '/bookings'
  const backButtonLabel = backTarget?.label || (isStaffOrAdmin ? t('orderDetails.backToOrders') : t('common.back'))
  const guestTrackingUrl = order.guestInfo?.isGuest && linkedBooking?.guestTrackingToken && order.guestInfo.email
    ? `/track-order/booking?token=${encodeURIComponent(linkedBooking.guestTrackingToken)}&email=${encodeURIComponent(order.guestInfo.email)}`
    : ''

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
  const complaintOrderId = order.complaintOrderId || ''
  const complaintOrderNumber = order.complaintOrderNumber || ''
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
  const staffCount = order.assignedStaff?.length || 0
  const serviceCount = (repairServices?.filter((s) => s && s._id).length || 0) + (order.addOns?.length || 0)
  const lastUpdate = order.updatedAt ? new Date(order.updatedAt).toLocaleString('de-DE') : '-'
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
      // gleiche Bezeichnungen wie server/utils/orderHistory.js KEY_META
      'Workflow Completed': 'Workflow abgeschlossen',
      'Workflow Step Reopened': 'Workflow-Schritt erneut geöffnet',
      'Repair Workflow Started': 'Reparatur gestartet',
      'Repair Workflow Paused': 'Reparatur pausiert',
      'Repair Workflow Resumed': 'Reparatur fortgesetzt',
      'Repair Workflow Incident': 'Zwischenfall gemeldet',
      'Repair Workflow Incident Resolved': 'Zwischenfall erledigt',
      'Repair Workflow Completed': 'Reparatur abgeschlossen',
      'Repair Workflow Reopened': 'Reparatur wieder aufgenommen',
      'Order Reopened': 'Stornierung aufgehoben',
      'Diagnostic Assessment': 'Diagnosebewertung',
      'Quality Check': 'Qualitätskontrolle',
      'Completed': 'Abgeschlossen',
      // Verlauf/Altbestand: neutral (der Rueckgabeweg galt evtl. damals anders) - HIST-17.
      'Ready for Pickup': READY_NEUTRAL_LABEL,
      'Shipping Label Created': 'Versandetikett erstellt',
      'Shipping Label Reconciliation Required': 'Abgleich des Versandlabels erforderlich',
      'Shipping Label Reconciled': 'Versandlabel abgeglichen',
      'Legacy Inbound Label Moved': 'Einsendelabel (Altbestand) getrennt',
      'Inbound Label Created': 'Einsendelabel erstellt',
      'Booking Inbound Label Created': 'Einsendelabel erstellt',
      'Inbound Label Reconciliation Required': 'Abgleich des Einsendelabels erforderlich',
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
      // Status-Enum (Statusmenue "Qualitätskontrolle"); stand bisher roh als "quality-check" im Kopf.
      'quality-check': 'Qualitätskontrolle',
      'completed': 'Abgeschlossen',
      'on-hold': 'Pausiert',
      'diagnosed': 'Diagnostiziert',
      'awaiting-parts': 'Wartet auf Teile',
      'ready-for-pickup': READY_NEUTRAL_LABEL,
      // Versandstatus-Enums: standen bisher roh in deutschen Verlaufszeilen.
      'label-created': 'Label erstellt',
      'shipped': 'Versendet',
      'in-transit': 'In Zustellung',
      'out-for-delivery': 'Heute in Zustellung',
      'delivered': 'Zugestellt',
      'failed': 'Fehlgeschlagen',
    }
    if (statusMap[status]) return statusMap[status]
    // Altbestand: 'Shipping Status: in-transit'. Praefix UND Enum uebersetzen -
    // neue Eintraege schreibt der Server bereits als 'Versandstatus: In Zustellung'.
    if (status.startsWith('Shipping Status:')) return `Versandstatus: ${translateOrderStatus(status.slice('Shipping Status:'.length).trim())}`
    // Handle dynamic return_exchange status
    if (status.startsWith('return_exchange_')) return `Rückgabe/Umtausch – ${status.replace('return_exchange_', '').replace('_', ' ')}`
    return status
  }

  // AKTUELLER Bereit-Zustand nach Rückgabeweg (Versand wird vorbereitet / Versandstatus / Abholung),
  // gleiche Regel wie der Server (lib/returnMethod). Verlaufszeilen bleiben neutral (translateOrderStatus).
  const readyStateView = describeReadyState(order.status, orderShipments)
  const currentOrderStatusLabel = readyStateView?.label ?? translateOrderStatus(order.status)

  const orderCreatedText = new Date(order.createdAt).toLocaleDateString('de-DE')
  const estimatedCompletionText = order.estimatedCompletion
    ? new Date(order.estimatedCompletion).toLocaleDateString('de-DE')
    : 'Wird aktualisiert'

  // --- Versand: Einsendung (Kunde -> McRepair) / Auslieferung (McRepair -> Kunde) ---
  // Beide Richtungen kommen getrennt vom Server (orderShipments), ebenso die Entscheidung,
  // ob "An Kunden versenden" bzw. "Einsendelabel erstellen" möglich ist - dieselbe
  // Funktion, die der POST-Endpunkt durchsetzt. Hier wird nur gerendert.
  const outboundShipment = orderShipments?.outbound
  const inboundShipment = orderShipments?.inbound
  const outboundAction = orderShipments?.outboundAction
  const inboundAction = orderShipments?.inboundAction
  const outboundLabelExists = Boolean(outboundShipment?.hasLabel || outboundShipment?.trackingNumber)
  const inboundLabelExists = Boolean(inboundShipment?.hasLabel || inboundShipment?.trackingNumber)
  const outboundReconciliationRequired = Boolean(outboundShipment?.reconciliationRequired)
  const outboundActionHint = !orderShipments
    ? 'Versandstand wird geladen…'
    : outboundAction?.reason || ''
  const inboundDownloadable = Boolean(orderShipments?.inboundLabels?.some((entry) => entry.hasLabel))

  // Sperre/Abgleich je Richtung, so wie der Server sie meldet: 'reconciliationRequired'
  // (unklare DHL-Antwort ODER verwaiste Sperre, lockStale) zeigt die Abgleich-Bedienung,
  // eine gerade laufende Erstellung (inProgress) einen Hinweis mit "Neu laden" - nie nur
  // einen dauerhaft deaktivierten Button ohne Erklärung.
  const renderShipmentLockPanel = (direction: 'inbound' | 'outbound') => {
    const shipment = (direction === 'outbound' ? outboundShipment : inboundShipment) as ReconcilableShipmentView | undefined
    if (!shipment) return null
    const directionLabel = direction === 'outbound' ? 'Auslieferung (McRepair → Kunde)' : 'Einsendung (Kunde → McRepair)'
    const labelName = direction === 'outbound' ? 'Versandlabel' : 'Einsendelabel'

    if (!shipment.reconciliationRequired) {
      if (!shipment.inProgress) return null
      return (
        <div className="sm:col-span-2 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3 space-y-1">
          <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
            {directionLabel}: {labelName} wird gerade bei DHL erstellt.
          </p>
          <p className="text-xs text-blue-900 dark:text-blue-200">
            Bitte nicht erneut erstellen. Bleibt die Erstellung hängen, bietet die Seite nach kurzer Zeit automatisch den Abgleich an.
          </p>
          <Button size="sm" variant="outline" onClick={() => void loadOrderShipments(order?._id)}>
            Versandstand neu laden
          </Button>
        </div>
      )
    }

    const busy = direction === 'outbound' ? reconcilingOutbound : reconcilingInbound
    const trackingValue = direction === 'outbound' ? reconcileTrackingNumber : reconcileInboundTrackingNumber
    const setTrackingValue = direction === 'outbound' ? setReconcileTrackingNumber : setReconcileInboundTrackingNumber
    const reconcile = direction === 'outbound' ? handleReconcileOutbound : handleReconcileInbound
    return (
      <div className="sm:col-span-2 rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
          <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
          {directionLabel} – Abgleich erforderlich: {shipment.lockStale
            ? 'Eine frühere Label-Erstellung wurde gestartet, aber nie abgeschlossen.'
            : 'DHL hat nicht eindeutig geantwortet.'}
        </p>
        <p className="text-xs text-amber-900 dark:text-amber-200">
          Ob bei DHL bereits ein {labelName} angelegt wurde, ist unklar. Bitte im DHL-Geschäftskundenportal
          {shipment.reference ? <> nach der Referenz „{shipment.reference}“</> : null} suchen und erst danach hier das Ergebnis eintragen – so entsteht kein zweites, bezahltes Label.
        </p>
        {user?.role === 'admin' ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={trackingValue}
              onChange={(event) => setTrackingValue(event.target.value)}
              placeholder="Sendungsnummer aus dem DHL-Portal"
              className="h-8 w-56 text-xs"
            />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void reconcile('created')}>
              Sendung existiert – übernehmen
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void reconcile('not-created')}>
              Bei DHL nicht angelegt
            </Button>
          </div>
        ) : (
          <p className="text-xs text-amber-900 dark:text-amber-200">Den Abgleich schließt ein Administrator ab.</p>
        )}
      </div>
    )
  }

  // --- Preisaufstellung (Brutto-first) --------------------------------------
  // SINGLE AUTHORITY: the server computes this once in
  // OrderService.buildOrderPricingSummary and ships it as order.pricing. This screen
  // RENDERS that - it does not own a second copy of the money formula. The inline
  // block below is only a fallback for payloads that predate order.pricing; it
  // follows the identical gross-first rule (every discount off the GROSS exactly
  // once, taxRate a PERCENT) so the two can never disagree while both exist.
  const orderPriceBreakdown = (() => {
    const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100
    const serverPricing = order.pricing

    if (serverPricing && Number.isFinite(Number(serverPricing.grossTotal))) {
      const positionsGross = round2(safeToNumber(serverPricing.positionsGross))
      const discount = round2(safeToNumber(serverPricing.discount))
      // Aufteilung des EINEN Rabatts, so wie der Server ihn gebildet hat. Fehlt sie
      // (ältere Antwort), wird der Gesamtrabatt als eine Zeile gezeigt.
      const hasSplit = serverPricing.groupDiscountAmount !== undefined || serverPricing.promoDiscountAmount !== undefined
      return {
        positionsGross,
        discount,
        groupDiscountPercent: safeToNumber(serverPricing.groupDiscountPercent),
        groupDiscountAmount: hasSplit ? round2(safeToNumber(serverPricing.groupDiscountAmount)) : discount,
        promoDiscountAmount: hasSplit ? round2(safeToNumber(serverPricing.promoDiscountAmount)) : 0,
        conditionsSource: String(serverPricing.conditionsSource || ''),
        dealerDiscountAmount: round2(safeToNumber(serverPricing.dealerDiscountAmount)),
        grossTotal: round2(safeToNumber(serverPricing.grossTotal)),
        netTotal: round2(safeToNumber(serverPricing.netTotal)),
        taxAmount: round2(safeToNumber(serverPricing.taxAmount)),
        // FIN-13: der Server liefert den GESPEICHERTEN Satz (auch 0 %) bzw. den Standardsatz
        // mit taxRateSource 'default' - hier nichts umdeuten.
        taxRate: hasStoredTaxRate(serverPricing.taxRate) ? Number(serverPricing.taxRate) : 19,
        taxRateSource: serverPricing.taxRateSource === 'default' || !hasStoredTaxRate(serverPricing.taxRate) ? 'default' : 'stored',
        hasPositions: positionsGross > 0,
        positionsReconcile: serverPricing.positionsReconcile !== false,
      }
    }

    // Fallback (older payload without order.pricing). The stored position prices are
    // GROSS LIST prices; the checkout discount is only taken off the aggregate
    // order.totalCost, and the Haendlerrabatt is not contained in totalCost at all.
    const servicesGross = (repairServices || []).reduce(
      (sum: number, service: any) => sum + safeToNumber(service?.price),
      0
    )
    const addOnsGross = (order.addOns || []).reduce(
      (sum: number, addOn: any) => sum + safeToNumber(addOn?.price),
      0
    )
    const shopProductsGross = ((order as any).shopProducts || []).reduce(
      (sum: number, product: any) => sum + safeToNumber(product?.priceAtOrder) * safeToNumber(product?.quantity),
      0
    )

    const positionsGross = round2(servicesGross + addOnsGross + shopProductsGross)
    const discount = round2(safeToNumber(order.discount))
    const dealerDiscountAmount = round2(safeToNumber(order.dealerDiscountAmount))
    const grossTotal = round2(round2(safeToNumber(order.totalCost)) - dealerDiscountAmount)
    // FIN-13: gespeicherte 0 bleibt 0; null/leer = nicht gespeichert (Standardsatz), nie 0 %.
    const taxRateStored = hasStoredTaxRate(order.taxRate)
    const taxRate = taxRateStored ? Number(order.taxRate) : 19
    const netTotal = round2(grossTotal / (1 + taxRate / 100))
    const taxAmount = round2(grossTotal - netTotal)

    return {
      positionsGross,
      discount,
      groupDiscountPercent: 0,
      groupDiscountAmount: discount,
      promoDiscountAmount: 0,
      conditionsSource: '',
      dealerDiscountAmount,
      grossTotal,
      netTotal,
      taxAmount,
      taxRate,
      taxRateSource: taxRateStored ? 'stored' : 'default',
      hasPositions: positionsGross > 0,
      positionsReconcile: Math.abs(positionsGross - discount - dealerDiscountAmount - grossTotal) <= 0.02,
    }
  })()

  // Der Steuersatz ist ein PROZENTWERT und kann gebrochen sein (7,5 %). Nicht auf
  // eine ganze Zahl runden - sonst steht '8 %' neben einem mit 7,5 % gerechneten Betrag.
  const formatTaxRate = (rate: number) =>
    new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(safeToNumber(rate))
  // FIN-13: "19 %" = am Auftrag gespeichert; "19 %, Standardsatz" = kein Satz gespeichert.
  const orderTaxRateLabel = `${formatTaxRate(orderPriceBreakdown.taxRate)} %${
    orderPriceBreakdown.taxRateSource === 'default' ? ', Standardsatz' : ''
  }`
  // Rabattzeilen der Preisübersicht (Kopf, Admin-Block und Kundenansicht lesen dieselbe
  // Liste): Aktionsrabatt (fester Betrag) und Kunden-/Händlerkondition (Prozent + EUR).
  // Die Summe der Zeilen ist immer pricing.discount (+ Händlerrabatt aus Altbestand).
  const orderDiscountLines = (() => {
    const lines: Array<{ key: string; label: string; amount: number }> = []
    if (orderPriceBreakdown.promoDiscountAmount > 0) {
      lines.push({
        key: 'promo',
        label: `Aktionsrabatt${order.appliedPromoCode ? ` (${order.appliedPromoCode})` : ''}`,
        amount: orderPriceBreakdown.promoDiscountAmount,
      })
    }
    if (orderPriceBreakdown.groupDiscountAmount > 0) {
      const sourceLabel = orderPriceBreakdown.conditionsSource === 'customer_group'
        ? 'Kundengruppenrabatt'
        : orderPriceBreakdown.conditionsSource === 'customer'
          ? 'Kundenrabatt'
          : orderPriceBreakdown.conditionsSource === 'settings_default'
            ? 'Standardrabatt'
            : 'Rabatt'
      const percent = orderPriceBreakdown.groupDiscountPercent
      lines.push({
        key: 'group',
        label: `${sourceLabel}${percent > 0 ? ` (${formatTaxRate(percent)} %)` : ''}${!percent && order.appliedPromoCode && orderPriceBreakdown.promoDiscountAmount === 0 ? ` (${order.appliedPromoCode})` : ''}`,
        amount: orderPriceBreakdown.groupDiscountAmount,
      })
    }
    if (orderPriceBreakdown.dealerDiscountAmount > 0) {
      lines.push({
        key: 'dealer',
        label: `Händlerrabatt${order.dealerDiscountPercent ? ` (${formatTaxRate(order.dealerDiscountPercent)} %)` : ''}`,
        amount: orderPriceBreakdown.dealerDiscountAmount,
      })
    }
    return lines
  })()
  const orderDiscountTotal = orderDiscountLines.reduce((sum, line) => sum + line.amount, 0)

  // Zahlungsstand aus den SERVER-Salden der Rechnungen (Admin: Finanzliste, Kunde:
  // eigene Rechnungen). Order.paymentStatus kennt kein "überzahlt" - eine offene
  // Erstattung ist nur am Rechnungssaldo sichtbar.
  const selectedInvoiceDetailsPayment = summarizeInvoicePayment(selectedInvoiceDetails)
  // Nur Rechnungen DIESES Auftrags zählen als seine Überzahlung; eine Buchungs-/Sammelrechnung
  // über mehrere Aufträge wird als Beleg-Betrag ausgewiesen (sonst zeigte jeder Auftrag der
  // Buchung den vollen Betrag der Buchungsrechnung als eigene Überzahlung).
  const orderRefundPendingScope = splitRefundPendingByScope(
    (isStaffOrAdmin ? orderInvoices : customerInvoices) as any[],
    String(order?._id || id || '')
  )
  const orderRefundPendingTotal = orderRefundPendingScope.orderAmount
  // Erfüllung (Auslieferung) und Zahlung sind getrennte Dimensionen: "Versendet" und
  // "Teilbezahlt" werden nebeneinander angezeigt.
  const outboundFulfilmentStatus = String(orderShipments?.outbound?.status || '').toLowerCase()
  const showOutboundFulfilmentBadge = ['label-created', 'shipped', 'in-transit', 'out-for-delivery', 'delivered'].includes(outboundFulfilmentStatus)
    && Boolean(orderShipments?.outbound?.trackingNumber || orderShipments?.outbound?.hasLabel)
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

    // HIST-1: Die ehrliche Meilenstein-Projektion liefert pro Stufe ein state-Feld.
    // Dann gilt ausschließlich die Stufe mit state === 'current' (dieselbe Quelle wie
    // die Meilensteinliste); ohne aktuelle Stufe wird nichts aus dem Index geraten,
    // das Label fällt auf den Auftragsstatus zurück.
    if (timelineStages.some((stage: any) => typeof stage?.state === 'string')) {
      return timelineStages.findIndex((stage: any) => stage?.state === 'current')
    }

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
    : currentOrderStatusLabel
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
      // Text nach Rückgabeweg (lib/returnMethod) - kein "abholbereit" für Versandaufträge.
      return {
        eyebrow: readyStateView?.label || READY_NEUTRAL_LABEL,
        steps: [
          readyStateView?.description || 'Ihre Reparatur ist abgeschlossen.',
          readyStateView?.method === 'pickup'
            ? 'Das Team stimmt bei Bedarf Uhrzeit und Übergabe mit Ihnen ab.'
            : readyStateView?.method === 'shipping'
              ? 'Bei Fragen zum Versand schreiben Sie uns im Nachrichtenbereich.'
              : 'Das Team stimmt bei Bedarf Übergabe oder Versanddetails mit Ihnen ab.',
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
        'Ihr Auftrag wurde aufgenommen. Senden Sie Ihr Gerät mit dem DHL-Einsendelabel an uns.',
        'Nach dem Eingang prüfen wir Ihr Gerät (Diagnosebewertung) und melden uns mit den nächsten Schritten.',
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
      (_, name, price) => `${name} zum Auftrag hinzugefügt (+${Number.isFinite(Number(price)) ? formatEUR(Number(price)) : `${price} €`})`
    )
    if (d !== desc) return d

    // X removed from order (-$Y)
    d = d.replace(
      /^(.+?) removed from order \(-\$(.+?)\)$/,
      (_, name, price) => `${name} vom Auftrag entfernt (-${Number.isFinite(Number(price)) ? formatEUR(Number(price)) : `${price} €`})`
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

  // Der frühere Verlaufs-Block (Meilensteine + Roh-Timeline im Kommunikationskasten) ist durch den
  // Bereich "Verlauf" ersetzt (GET /api/orders/:id/history, deutsche Titel vom Server).

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

      {/* IMEI */}
      {order.imei && order.imei.trim() ? (
        <div className="bg-white/50 dark:bg-gray-900/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-2">
            <Smartphone className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-xs text-amber-900 dark:text-amber-100 mb-1">
                {t('orderDetails.repairInfo.imeiLabel', 'IMEI')}
              </h4>
              <p className="text-xs text-gray-700 dark:text-gray-300 break-all">
                {order.imei}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-gray-400 dark:text-gray-600" />
            <div className="flex-1">
              <h4 className="font-semibold text-xs text-gray-600 dark:text-gray-400">
                {t('orderDetails.repairInfo.imeiLabel', 'IMEI')}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-600 italic mt-1">
                {t('orderDetails.repairInfo.notSpecified', 'Nicht angegeben')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Serial Number */}
      {order.serialNumber && order.serialNumber.trim() ? (
        <div className="bg-white/50 dark:bg-gray-900/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-xs text-amber-900 dark:text-amber-100 mb-1">
                {t('orderDetails.repairInfo.serialNumberLabel', 'Seriennummer')}
              </h4>
              <p className="text-xs text-gray-700 dark:text-gray-300 break-all">
                {order.serialNumber}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400 dark:text-gray-600" />
            <div className="flex-1">
              <h4 className="font-semibold text-xs text-gray-600 dark:text-gray-400">
                {t('orderDetails.repairInfo.serialNumberLabel', 'Seriennummer')}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-600 italic mt-1">
                {t('orderDetails.repairInfo.notSpecified', 'Nicht angegeben')}
              </p>
            </div>
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
            {/* HIST-9: die ursprüngliche Angabe des Kunden bleibt sichtbar, wenn das Gerät korrigiert
                wurde (Order.reportedDevice, nur in der Personal-Antwort). */}
            {isStaffOrAdmin && (() => {
              const reported = (order as { reportedDevice?: { brand?: string; model?: string; deviceType?: string; capturedAt?: string } }).reportedDevice
              if (!reported?.model) return null
              const reportedLabel = `${reported.brand || ''} ${reported.model}`.trim()
              const currentLabel = `${order.deviceBrand || ''} ${order.deviceModel || ''}`.trim()
              if (reportedLabel.toLowerCase() === currentLabel.toLowerCase()) return null
              return (
                <p className="admin-od-reported-device">
                  Vom Kunden gemeldet: <strong>{reportedLabel}</strong>
                  {reported.deviceType && reported.deviceType !== order.deviceType ? ` (${reported.deviceType})` : ''}
                </p>
              )
            })()}
            <p>Reparaturleistungen</p>
            <div className="services-tags">
              {/* Positionen aus /api/order-services (vollständige Objekte inkl. manueller
                  Positionen); order.services der Detailantwort enthält nur Namen. Angezeigt
                  wird der gespeicherte Standardpreis der Position, nicht der Katalogpreis. */}
              {repairServices && repairServices.filter((s) => s && s._id).length > 0 ? (
                repairServices.filter((s) => s && s._id).map((service) => {
                  const serviceName = service.serviceId?.name
                    || service.name
                    || service.serviceName
                    || `Service #${String(service._id).substring(0, 8)}`;
                  const servicePrice = service.price;

                  return (
                    <span key={service._id} className="service-tag">
                      {serviceName}
                      {safeToNumber(servicePrice) > 0 && <span className="ml-0.5 font-semibold">{formatEUR(servicePrice)}</span>}
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
                  : t('orderDetails.confirmUnlock', 'Entsperrdaten bestätigen')}
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
          startBlockedReason={order?.status === 'cancelled' ? 'Auftrag storniert – Inspektion gesperrt' : undefined}
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
            Gebuchte Reparaturleistungen und Technikernotizen zu diesem Auftrag.
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
                <h4>
                  {service.serviceId?.name || service.name || 'Reparaturposition'}
                  {service.isManual === true && (
                    <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-[10px] font-medium align-middle">Manuell</Badge>
                  )}
                </h4>
                {(service.serviceId?.description || service.description) && (() => {
                  const id = service._id || `service-${index}`;
                  const isExpanded = expandedServiceDescriptions.has(id);
                  const desc = String(service.serviceId?.description || service.description);
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
                <span className="service-price">{formatEUR(service.price)}</span>
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
                    onClick={() => {
                      if (!service._id) return
                      setDeleteServiceReason('')
                      setDeleteServiceRepricing(null)
                      setServiceToDelete(service)
                    }}
                    title="Reparaturposition entfernen"
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
            <p className="text-xs mt-1">{t('orderDetails.clickToAddService', 'Klicken Sie auf „Dienst hinzufügen“, um eine Reparaturleistung hinzuzufügen.')}</p>
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
            Optionale Zusatzleistungen zu diesem Reparaturauftrag.
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
                  <p className="text-xs text-muted-foreground mt-1">+{formatEUR(addOn.price)}</p>
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

  // Reconciles the GROSS LIST prices of the positions above with the discounted
  // order total: Zwischensumme (Brutto) - Rabatt = Gesamt (Brutto) = Netto + MwSt.
  // The discount is subtracted from the gross exactly once and never from the net.
  const renderOrderPriceBreakdown = () => (
    <div className="repair-info-subsection repair-info-subsection-pricing">
      <div className="repair-info-subsection-header">
        <div>
          <h4 className="font-medium text-sm flex items-center gap-1.5">
            <Receipt className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Preisübersicht
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Alle Positionen sind Bruttopreise. Ein gewährter Rabatt ist im Gesamtbetrag bereits enthalten.
          </p>
        </div>
      </div>

      <div className="repair-info-subsection-body mt-2 rounded-lg border bg-muted/20 p-3 text-sm">
        {orderPriceBreakdown.hasPositions && (
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground">Listenpreis (Brutto)</span>
            <span className="font-medium">{formatEUR(orderPriceBreakdown.positionsGross)}</span>
          </div>
        )}

        {orderDiscountLines.map((line) => (
          <div key={line.key} className="flex items-center justify-between py-1">
            <span className="text-muted-foreground">{line.label}</span>
            <span className="font-medium text-green-600">−{formatEUR(line.amount)}</span>
          </div>
        ))}

        <div className="flex items-center justify-between border-t pt-2 mt-1 py-1">
          <span className="font-semibold">Gesamtbetrag (Brutto)</span>
          <span className="font-semibold">{formatEUR(orderPriceBreakdown.grossTotal)}</span>
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="text-muted-foreground">davon Netto</span>
          <span>{formatEUR(orderPriceBreakdown.netTotal)}</span>
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="text-muted-foreground">
            davon MwSt. ({orderTaxRateLabel})
          </span>
          <span>{formatEUR(orderPriceBreakdown.taxAmount)}</span>
        </div>

        {isStaffOrAdmin && orderPriceBreakdown.hasPositions && !orderPriceBreakdown.positionsReconcile && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Hinweis: Die Summe der Positionen abzüglich der Rabatte weicht vom hinterlegten Auftragswert ab.
            Bitte den Auftragswert prüfen.
          </p>
        )}
      </div>
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
                        <span className="font-medium text-foreground">{formatEUR(shopProduct.priceAtOrder)}</span>
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
                        <span className="font-bold text-foreground">{formatEUR(totalPrice)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        Hinzugefügt: {new Date(shopProduct.addedAt).toLocaleDateString('de-DE')}
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
                          Menge: <span className="font-medium text-foreground">{ePart.quantity}</span>
                        </span>
                        {version && (
                          <span className="text-muted-foreground">
                            Preis: <span className="font-medium text-foreground">{formatEUR(version.sellingPrice)}</span>
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          Zugewiesen: <span className="font-medium text-foreground">
                            {new Date(ePart.assignedAt).toLocaleDateString('de-DE')}
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
                        Hinzugefügt: <span className="font-medium text-foreground">{new Date(entry.requestedAt).toLocaleString('de-DE')}</span>
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

  // Personal/Admin: Fortschritt mit EHRLICHEN Meilensteinen (HIST-1). Eine Stufe gilt nur als
  // erreicht, wenn der Server ein Ereignis dafür kennt; nie erfasste Stufen erscheinen als
  // "Übersprungen – nicht erfasst", unbekannte Zeitpunkte als "Zeitpunkt nicht erfasst".
  // Nichts wird aus der Position in der Liste abgeleitet. (Kunden: renderCustomerProgressCard.)
  const renderRepairProgressCard = () => {
    const progressValue = calculatedProgressValue
    return (
      <Card id="order-progress" className="order-section-card order-repair-progress-card">
        <CardHeader className="order-section-header">
          <CardTitle className="order-section-title">
            <Clock className="h-5 w-5" />
            {t('orderDetails.repairProgress')}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => openAdminTabAndFocus('verlauf', 'order-history')}>
            <History className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Verlauf ansehen
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${getStatusColor(order.status)} text-xs px-2 py-0.5`}>
                {currentOrderStatusLabel}
              </Badge>
              {currentStageLabel ? <span className="font-semibold">Aktueller Schritt: {currentStageLabel}</span> : null}
              {progressTimeline?.paused ? <span className="text-amber-800">· pausiert</span> : null}
            </div>
            <span className="font-semibold">{progressValue} %</span>
          </div>
          <Progress value={progressValue} className="h-2" aria-label={`Fortschritt ${progressValue} %`} />
          {timelineStages.length > 0 ? (
            <OrderMilestoneList milestones={progressTimeline} />
          ) : progressTimelineError ? (
            <p className="text-red-700">Fortschritt konnte nicht geladen werden.</p>
          ) : (
            <p className="text-muted-foreground" role="status">Meilensteine werden geladen …</p>
          )}
          {order.estimatedCompletion && order.status !== 'completed' ? (
            <p className="text-xs text-muted-foreground">
              {t('orderDetails.estimatedCompletion')}: {new Date(order.estimatedCompletion).toLocaleDateString('de-DE')}
            </p>
          ) : null}
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
          currentDevice={{ brand: order?.deviceBrand, model: order?.deviceModel }}
          orderTimeline={Array.isArray(order?.timeline) ? order.timeline : []}
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
          {/* Repair Workflow Card */}
          {activeRepairWorkflow && (
            <div className="mb-3">
              <div
                onClick={() => {
                  setSelectedRepairWorkflow(activeRepairWorkflow)
                  setRepairWorkflowDialogOpen(true)
                }}
                className={`cursor-pointer rounded-lg border p-4 transition-colors hover:shadow-sm ${
                  activeRepairWorkflow.status === 'in-progress'
                    ? 'border-blue-200 bg-blue-50/50 hover:border-blue-300'
                    : activeRepairWorkflow.status === 'paused'
                      ? 'border-amber-200 bg-amber-50/50 hover:border-amber-300'
                      : activeRepairWorkflow.status === 'incident'
                        ? 'border-red-200 bg-red-50/50 hover:border-red-300'
                        : activeRepairWorkflow.status === 'completed'
                          ? 'border-green-200 bg-green-50/50 hover:border-green-300'
                          : 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span className="text-sm font-semibold text-slate-900">Reparatur-Workflow</span>
                    </div>

                    {/* Status + Timer */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {activeRepairWorkflow.status === 'pending-confirmation' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          <Clock className="h-3 w-3" />
                          Warte auf Bestätigung
                        </span>
                      )}
                      {activeRepairWorkflow.status === 'in-progress' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                          <Play className="h-3 w-3" />
                          In Bearbeitung
                        </span>
                      )}
                      {activeRepairWorkflow.status === 'paused' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          <Pause className="h-3 w-3" />
                          Pausiert
                        </span>
                      )}
                      {activeRepairWorkflow.status === 'incident' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800">
                          <AlertTriangle className="h-3 w-3" />
                          Zwischenfall
                        </span>
                      )}
                      {activeRepairWorkflow.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800">
                          <CheckCircle className="h-3 w-3" />
                          Abgeschlossen
                        </span>
                      )}

                      {activeRepairWorkflow.timerData?.startedAt && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <Timer className="h-3 w-3" />
                          {(() => {
                            const startedAt = new Date(activeRepairWorkflow.timerData.startedAt).getTime()
                            const endTime = activeRepairWorkflow.timerData.completedAt
                              ? new Date(activeRepairWorkflow.timerData.completedAt).getTime()
                              : activeRepairWorkflow.timerData.pausedAt
                                ? new Date(activeRepairWorkflow.timerData.pausedAt).getTime()
                                : Date.now()
                            const totalMs = endTime - startedAt - (activeRepairWorkflow.timerData.totalPausedMs || 0)
                            const hrs = Math.floor(totalMs / 3600000)
                            const mins = Math.floor((totalMs % 3600000) / 60000)
                            return hrs > 0 ? `${hrs}h ${mins}min` : `${mins}min`
                          })()}
                        </span>
                      )}
                    </div>

                    {/* Timeline */}
                    {activeRepairWorkflow.timerData?.startedAt && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                          {new Date(activeRepairWorkflow.timerData.startedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {activeRepairWorkflow.timerData?.pauseHistory && activeRepairWorkflow.timerData.pauseHistory.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                            <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            {activeRepairWorkflow.timerData.pauseHistory.length}x pausiert
                          </span>
                        )}
                        {activeRepairWorkflow.incidents && activeRepairWorkflow.incidents.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                            <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                            {activeRepairWorkflow.incidents.length} Zwischenfall{activeRepairWorkflow.incidents.length > 1 ? 'fälle' : ''}
                          </span>
                        )}
                        {activeRepairWorkflow.timerData?.completedAt && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Fertig: {new Date(activeRepairWorkflow.timerData.completedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 text-xs h-7 px-2.5 border-slate-300"
                  >
                    Öffnen
                  </Button>
                </div>
              </div>
            </div>
          )}

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
          ) : !activeRepairWorkflow ? (
            <div className="text-center text-muted-foreground py-6">
              <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('orderDetails.noWorkflowsAssigned')}</p>
              <p className="text-xs mt-1">{t('orderDetails.clickAssignWorkflow')}</p>
            </div>
          ) : null}
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
      {renderOrderPriceBreakdown()}
    </div>
  )

  // ===================== KUNDENSICHT ===========================================
  // Oben "Auf einen Blick" (Status, Gesamt/Bezahlt/Offen, EIN nächster Schritt), darunter
  // ehrliche Meilensteine, links der Nachrichtenverlauf (derselbe Verlauf wie /messages),
  // rechts aufklappbare Abschnitte. Geldbeträge kommen ausschließlich vom Server
  // (order.pricing bzw. PaymentService über die Kundenprojektion) - hier wird nichts gerechnet.
  const customerBookingNumber = String(
    linkedBooking?.bookingNumber
    || customerPayments?.booking?.bookingNumber
    || customerInbound?.booking?.bookingNumber
    || ''
  )
  const customerOrderRef = order.orderNumber || order._id.slice(-6)

  type CustomerMoneyView = {
    state: 'loading' | 'unknown' | 'no-invoice' | 'known'
    gross: number
    received: number
    open: number
    overpaidTotal: number
    refundPending: number
    refundsInProgress: number
    bookingWide: boolean
    bookingGross: number
    deviceCount: number
  }

  const customerMoney: CustomerMoneyView = (() => {
    const gross = orderPriceBreakdown.grossTotal
    const base = {
      gross,
      received: 0,
      open: 0,
      overpaidTotal: 0,
      refundPending: 0,
      refundsInProgress: 0,
      bookingWide: false,
      bookingGross: gross,
      deviceCount: 1,
    }
    if (customerBookingIdForPayments) {
      if (customerPaymentsState === 'loading' || customerPaymentsState === 'idle') return { ...base, state: 'loading' }
      if (customerPaymentsState !== 'ready' || !customerPayments) return { ...base, state: 'unknown' }
      const summary = customerPayments.summary
      const deviceCount = Math.max(1, Number(customerPayments.orderCount) || 1)
      const bookingGross = safeToNumber(summary.referenceTotal)
      return {
        state: 'known',
        gross,
        received: safeToNumber(summary.receivedTotal),
        open: safeToNumber(summary.openOrderBalance),
        overpaidTotal: safeToNumber(summary.overpaidTotal),
        refundPending: safeToNumber(summary.refundPendingTotal),
        refundsInProgress: safeToNumber(summary.refundsInProgressTotal),
        bookingWide: deviceCount > 1 || Math.abs(bookingGross - gross) > 0.01,
        bookingGross,
        deviceCount,
      }
    }
    // Auftrag ohne Buchung: nur die Salden der Rechnungen dieses Auftrags - nie "0,00 €" erfinden.
    if (loadingCustomerInvoices) return { ...base, state: 'loading' }
    if (customerInvoicesError) return { ...base, state: 'unknown' }
    const ownInvoices = customerInvoices.filter((invoice) => !invoice.isCreditNote && !['cancelled', 'draft'].includes(String(invoice.status || '')))
    if (ownInvoices.length === 0) return { ...base, state: 'no-invoice' }
    const summaries = ownInvoices.map((invoice) => summarizeInvoicePayment(invoice)).filter((entry) => entry.known)
    if (summaries.length === 0) return { ...base, state: 'unknown' }
    const total = (pick: (entry: typeof summaries[number]) => number | null) =>
      Math.round(summaries.reduce((sum, entry) => sum + (pick(entry) ?? 0), 0) * 100) / 100
    const refundPending = total((entry) => entry.refundPending)
    return {
      ...base,
      state: 'known',
      received: total((entry) => entry.received),
      open: total((entry) => entry.open),
      overpaidTotal: refundPending,
      refundPending,
      refundsInProgress: total((entry) => entry.refundsInProgress),
    }
  })()

  // Stornierter Auftrag ohne bekannten Saldo: "Offen" (paymentStatus pending/unpaid) wäre irreführend,
  // "keine Zahlung offen" aber unbelegt (Rechnungen bleiben beim Storno bestehen) - daher neutral "Storniert".
  // Die Aussage "keine Zahlung offen" steht nur dort, wo die angezeigten Beträge sie belegen.
  const cancelledWithoutPayment = order?.status === 'cancelled' && ['pending', 'unpaid'].includes(String(order?.paymentStatus || ''))

  // Zahlungswort aus den Beträgen (CUSTUX-15); order.paymentStatus nur, wenn kein Saldo bekannt ist.
  const customerPaymentLabel = (() => {
    if (customerMoney.state === 'no-invoice') return order?.status === 'cancelled' ? 'Storniert' : 'Rechnung folgt'
    if (customerMoney.state !== 'known') return cancelledWithoutPayment ? 'Storniert' : translatePaymentStatus(order.paymentStatus)
    if (customerMoney.overpaidTotal > 0.009) return 'Überzahlt'
    if (customerMoney.open <= 0.009 && customerMoney.received > 0.009) return 'Bezahlt'
    if (customerMoney.open <= 0.009) return order?.status === 'cancelled' ? 'Storniert – keine Zahlung offen' : 'Ausgeglichen'
    if (customerMoney.received > 0.009) return 'Teilbezahlt'
    return 'Offen'
  })()

  const customerBookingScopeHint = customerMoney.state === 'known' && customerMoney.bookingWide
    ? `Bezahlt und Offen gelten für die gesamte Buchung${customerBookingNumber ? ` ${customerBookingNumber}` : ''} (${customerMoney.deviceCount} ${customerMoney.deviceCount === 1 ? 'Gerät' : 'Geräte'}, Gesamt ${formatEUR(customerMoney.bookingGross)}).`
    : ''

  // Offene Rechnung zum Bezahlen (Kundenprojektion der Buchung, sonst eigene Rechnungsliste).
  const customerInvoiceToPay = (() => {
    const bookingInvoices = (customerPayments?.invoices || [])
      .filter((invoice) => !invoice.isCreditNote
        && safeToNumber(invoice.openAmount) > 0.009
        && !['cancelled', 'credited', 'draft'].includes(String(invoice.status || '')))
      .sort((left, right) => {
        const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER
        const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER
        return leftDue - rightDue
      })
    if (bookingInvoices[0]) {
      return { id: String(bookingInvoices[0]._id), number: bookingInvoices[0].invoiceNumber || '', open: safeToNumber(bookingInvoices[0].openAmount) }
    }
    for (const invoice of customerInvoices) {
      if (invoice.isCreditNote) continue
      const payment = summarizeInvoicePayment(invoice)
      if (payment.known && (payment.open ?? 0) > 0.009) {
        return { id: String(invoice._id), number: invoice.invoiceNumber || '', open: payment.open ?? 0 }
      }
    }
    return null
  })()

  // Gleiches Deep-Link-Format wie CustomerBookings (buildInvoiceDeepLink):
  // CustomerInvoices reagiert nur, wenn highlightInvoiceId gesetzt ist, und oeffnet
  // dann openInvoiceId. URL fuer Reload/kopierten Link, state fuer die In-App-Navigation.
  const openCustomerInvoicePayment = (invoiceId: string) => {
    const encoded = encodeURIComponent(invoiceId)
    navigate(`/invoices?highlightInvoiceId=${encoded}&openInvoiceId=${encoded}`, {
      state: { highlightInvoiceId: invoiceId, openInvoiceId: invoiceId },
    })
  }

  // Einsendung (Kunde -> McRepair): Zustand aus GET /api/orders/:id/inbound-label.
  const customerInboundInfo = customerInbound?.inbound || null
  const customerInboundStatus = String(customerInboundInfo?.shippingStatus || '').toLowerCase()
  const customerInboundUnderway = ['shipped', 'in-transit', 'out-for-delivery'].includes(customerInboundStatus)
  const customerDeviceArrived = customerInboundStatus === 'delivered' || Boolean(customerInboundInfo?.deviceReceived)
  const customerAwaitingDevice = String(order.status || '').toLowerCase() === 'pending'
    && !customerDeviceArrived
    && !['not-needed', 'cancelled'].includes(String(customerInboundInfo?.state || ''))
  const customerInboundTrackingVisible = Boolean(customerInboundInfo?.trackingNumber) && !customerInboundInfo?.placeholder
  const isPlaceholderTracking = (trackingNumber?: string | null) => String(trackingNumber || '').toUpperCase().startsWith('DHL-DUMMY-')

  const scrollToCustomerMessages = () => {
    const target = document.getElementById('order-customer-messages')
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    target.focus({ preventScroll: true })
  }

  const handleCustomerInboundFile = async (mode: 'download' | 'print') => {
    if (!customerInboundInfo || customerInboundBusy) return
    try {
      setCustomerInboundBusy(mode)
      if (mode === 'download') {
        await downloadInboundLabel(customerInboundInfo)
      } else {
        await printInboundLabel(customerInboundInfo)
      }
    } catch (error: any) {
      toast({
        title: mode === 'download' ? 'Einsendelabel konnte nicht heruntergeladen werden' : 'Einsendelabel konnte nicht gedruckt werden',
        description: error?.message || 'Bitte versuchen Sie es erneut.',
        variant: 'destructive',
      })
    } finally {
      setCustomerInboundBusy('')
    }
  }

  const handleCustomerInboundCreate = async () => {
    const bookingId = customerInbound?.booking?._id
    if (!bookingId || customerInboundBusy) return
    try {
      setCustomerInboundBusy('create')
      const view = await createBookingInboundLabel(String(bookingId))
      setCustomerInbound(view)
      toast({
        title: view?.alreadyExists ? 'Einsendelabel bereits vorhanden' : 'DHL-Einsendelabel erstellt',
        description: view?.inbound?.message || 'Sie können das Einsendelabel jetzt herunterladen und drucken.',
      })
      void loadOrderShipments(String(order._id))
    } catch (error: any) {
      toast({
        title: 'Einsendelabel konnte nicht erstellt werden',
        description: error?.message || 'Bitte versuchen Sie es später erneut.',
        variant: 'destructive',
      })
      setCustomerInboundReloadToken((current) => current + 1)
    } finally {
      setCustomerInboundBusy('')
    }
  }

  type CustomerActionButton = {
    label: string
    onClick?: () => void
    href?: string
    disabled?: boolean
    icon?: ReactNode
  }
  type CustomerNextAction = {
    key: string
    title: string
    description: string
    tone: 'action' | 'waiting' | 'info'
    badge?: string
    primary?: CustomerActionButton
    secondary?: CustomerActionButton[]
  }

  // Priorität: (1) Rückfrage/Angebot beantworten, (2) Gerät einsenden (Label herunterladen /
  // erstellen), (3) bezahlen, (4) Rücksendung verfolgen, (5) Abholung.
  const customerNextActions: CustomerNextAction[] = (() => {
    const list: CustomerNextAction[] = []
    const status = String(order.status || '').toLowerCase()
    const iconClass = 'h-4 w-4'

    if (status === 'cancelled') {
      return [{
        key: 'cancelled',
        title: 'Auftrag storniert',
        description: 'Dieser Auftrag wird nicht weiter bearbeitet. Bei Fragen schreiben Sie uns im Nachrichtenbereich.',
        tone: 'info',
        primary: { label: 'Nachricht schreiben', onClick: scrollToCustomerMessages, icon: <MessageSquare className={iconClass} aria-hidden="true" /> },
      }]
    }

    const complaintOfferPending = isComplaintFollowupOrder && complaintWorkflow?.repairOffer?.status === 'pending'
    if (complaintOfferPending || threadPending.offers > 0) {
      list.push({
        key: 'offer',
        title: 'Angebot prüfen',
        description: 'Für Ihren Auftrag liegt ein Angebot vor. Bitte nehmen Sie es an oder lehnen Sie es ab.',
        tone: 'action',
        badge: 'Ihre Entscheidung erforderlich',
        primary: { label: 'Angebot prüfen', onClick: scrollToCustomerMessages, icon: <FileText className={iconClass} aria-hidden="true" /> },
      })
    }

    const openQuestions = threadPending.questions + threadPending.actions
    if (openQuestions > 0) {
      list.push({
        key: 'question',
        title: openQuestions === 1 ? 'Rückfrage beantworten' : `${openQuestions} Rückfragen beantworten`,
        description: 'Das Reparaturteam braucht eine Antwort von Ihnen, damit es weitergehen kann. Sie antworten direkt hier im Nachrichtenbereich.',
        tone: 'action',
        badge: 'Antwort erforderlich',
        primary: { label: 'Rückfrage beantworten', onClick: scrollToCustomerMessages, icon: <MessageSquare className={iconClass} aria-hidden="true" /> },
      })
    }

    if (customerAwaitingDevice) {
      if (customerInboundState === 'error') {
        list.push({
          key: 'inbound-error',
          title: 'Gerät an McRepair senden',
          description: 'Versandstand konnte nicht geladen werden.',
          tone: 'waiting',
          primary: { label: 'Erneut versuchen', onClick: () => setCustomerInboundReloadToken((current) => current + 1), icon: <RefreshCw className={iconClass} aria-hidden="true" /> },
        })
      } else if (customerInboundInfo) {
        const info = customerInboundInfo
        if (customerInboundUnderway) {
          list.push({
            key: 'inbound-underway',
            title: 'Ihr Gerät ist unterwegs zu uns',
            description: info.message || 'DHL hat Ihr Paket übernommen. Sobald es bei uns eingeht, prüfen wir Ihr Gerät.',
            tone: 'waiting',
            primary: customerInboundTrackingVisible
              ? { label: 'Sendung verfolgen', href: buildDhlTrackingUrl(info.trackingNumber), icon: <ExternalLink className={iconClass} aria-hidden="true" /> }
              : undefined,
          })
        } else if (info.state === 'ready') {
          list.push({
            key: 'inbound-ready',
            title: 'Gerät an McRepair senden',
            description: 'Laden Sie das DHL-Einsendelabel herunter, drucken Sie es aus, kleben Sie es auf das Paket und geben Sie es bei DHL ab.',
            tone: 'action',
            badge: info.placeholder ? 'Testlabel – nicht für den Versand verwenden' : undefined,
            primary: {
              label: customerInboundBusy === 'download'
                ? 'Einsendelabel wird geladen…'
                : info.placeholder ? 'Testlabel herunterladen (PDF)' : 'DHL-Einsendelabel herunterladen (PDF)',
              onClick: () => void handleCustomerInboundFile('download'),
              disabled: Boolean(customerInboundBusy),
              icon: <Download className={iconClass} aria-hidden="true" />,
            },
            secondary: [{
              label: customerInboundBusy === 'print' ? 'Druck wird vorbereitet…' : 'Drucken',
              onClick: () => void handleCustomerInboundFile('print'),
              disabled: Boolean(customerInboundBusy),
              icon: <Printer className={iconClass} aria-hidden="true" />,
            }],
          })
        } else if (info.state === 'creating') {
          list.push({
            key: 'inbound-creating',
            title: 'Einsendelabel wird erstellt…',
            description: info.message || 'Ihr DHL-Einsendelabel wird gerade erstellt. Bitte einen Moment Geduld.',
            tone: 'waiting',
            primary: { label: 'Status neu laden', onClick: () => setCustomerInboundReloadToken((current) => current + 1), icon: <RefreshCw className={iconClass} aria-hidden="true" /> },
          })
        } else if (info.canCreate) {
          list.push({
            key: 'inbound-create',
            title: 'Gerät an McRepair senden',
            description: info.message || 'Für Ihre Buchung liegt noch kein Einsendelabel vor. Sie können es hier selbst erstellen.',
            tone: 'action',
            primary: {
              label: customerInboundBusy === 'create' ? 'Einsendelabel wird erstellt…' : 'DHL-Einsendelabel erstellen',
              onClick: () => void handleCustomerInboundCreate(),
              disabled: Boolean(customerInboundBusy),
              icon: <Truck className={iconClass} aria-hidden="true" />,
            },
          })
        } else if (info.message) {
          list.push({
            key: 'inbound-info',
            title: 'Gerät an McRepair senden',
            description: info.message,
            tone: 'waiting',
          })
        }
      }
    }

    if (customerMoney.state === 'known' && customerMoney.open > 0.009) {
      if (customerInvoiceToPay) {
        const invoiceToPay = customerInvoiceToPay
        list.push({
          key: 'pay',
          title: `Rechnung ${invoiceToPay.number || ''} bezahlen`.replace(/\s+/g, ' ').trim(),
          description: `Offener Betrag der Rechnung: ${formatEUR(invoiceToPay.open)}. Sie bezahlen bequem unter „Rechnungen“.`,
          tone: 'action',
          primary: {
            label: `Rechnung bezahlen (${formatEUR(invoiceToPay.open)})`,
            onClick: () => openCustomerInvoicePayment(invoiceToPay.id),
            icon: <CreditCard className={iconClass} aria-hidden="true" />,
          },
        })
      } else {
        list.push({
          key: 'pay-later',
          title: 'Rechnung folgt – noch keine Zahlung nötig',
          description: `Offen: ${formatEUR(customerMoney.open)}. Sie erhalten die Rechnung, sobald die Reparatur abgerechnet wird.`,
          tone: 'info',
        })
      }
    }

    const outboundTracking = String(outboundShipment?.trackingNumber || '')
    const outboundStatus = String(outboundShipment?.status || '').toLowerCase()
    const outboundUnderway = Boolean(outboundTracking) && ['shipped', 'in-transit', 'out-for-delivery'].includes(outboundStatus)
    if (outboundUnderway) {
      list.push({
        key: 'outbound',
        title: 'Ihr Gerät ist unterwegs zu Ihnen',
        description: `Sendungsnummer ${outboundTracking}`,
        tone: 'waiting',
        primary: isPlaceholderTracking(outboundTracking)
          ? undefined
          : { label: 'Sendung verfolgen', href: buildDhlTrackingUrl(outboundTracking), icon: <ExternalLink className={iconClass} aria-hidden="true" /> },
      })
    }

    // Reparatur fertig: Abholung NUR bei Abholaufträgen; Versandaufträge zeigen "Versand an Sie wird
    // vorbereitet" bzw. den Versandstatus (lib/returnMethod). Keine Aussage über Zahlung.
    if (status === 'ready-for-pickup' && !order.pickupConfirmation?.confirmedAt && !outboundUnderway && readyStateView) {
      list.push({
        key: readyStateView.method === 'pickup' ? 'pickup' : 'ready',
        title: readyStateView.label,
        description: readyStateView.description,
        tone: readyStateView.phase === 'preparing' ? 'waiting' : 'info',
      })
    }

    return list
  })()

  const renderCustomerActionButton = (action: CustomerActionButton, variant: 'primary' | 'secondary', key?: string) => {
    const className = `customer-next-btn ${variant === 'primary' ? 'is-primary' : 'is-secondary'}`
    if (action.href) {
      return (
        <a key={key} href={action.href} target="_blank" rel="noreferrer" className={className}>
          {action.icon}
          <span>{action.label}</span>
        </a>
      )
    }
    return (
      <button key={key} type="button" className={className} onClick={action.onClick} disabled={action.disabled}>
        {action.icon}
        <span>{action.label}</span>
      </button>
    )
  }

  const renderCustomerMoneyFigures = () => {
    if (customerMoney.state === 'loading') {
      return <p className="customer-money-note" role="status">Zahlungsstand wird geladen …</p>
    }
    const overpaid = customerMoney.state === 'known' && customerMoney.overpaidTotal > 0.009
    // Mehrere Geraete in einer Buchung: Gesamt gilt fuer dieses Geraet, Bezahlt/Offen fuer die ganze
    // Buchung - das steht direkt am Betrag, nicht nur im Hinweis darunter.
    const bookingScope = customerMoney.state === 'known' && customerMoney.bookingWide
    return (
      <>
        <dl className="customer-money-grid">
          <div className="customer-money-item">
            <dt>{bookingScope ? 'Dieses Gerät (brutto)' : 'Gesamt (brutto)'}</dt>
            <dd>{formatEUR(customerMoney.gross)}</dd>
          </div>
          {customerMoney.state === 'known' ? (
            <>
              <div className="customer-money-item">
                <dt>{bookingScope ? 'Bezahlt (ganze Buchung)' : 'Bezahlt'}</dt>
                <dd>{formatEUR(customerMoney.received)}</dd>
              </div>
              {overpaid ? (
                <div className="customer-money-item is-overpaid">
                  <dt>{`${customerMoney.refundPending > 0.009 ? 'Überzahlt · Erstattung offen' : 'Überzahlt · Erstattung läuft'}${bookingScope ? ' (ganze Buchung)' : ''}`}</dt>
                  <dd>{formatEUR(customerMoney.refundPending > 0.009 ? customerMoney.refundPending : customerMoney.refundsInProgress)}</dd>
                </div>
              ) : (
                <div className={`customer-money-item ${customerMoney.open > 0.009 ? 'is-open' : 'is-settled'}`}>
                  <dt>{bookingScope ? 'Offen (ganze Buchung)' : 'Offen'}</dt>
                  <dd>{formatEUR(customerMoney.open)}</dd>
                </div>
              )}
            </>
          ) : (
            <div className="customer-money-item is-wide">
              <dt>Zahlungsstand</dt>
              <dd className="is-muted">
                {customerMoney.state === 'no-invoice' ? (order?.status === 'cancelled' ? 'Storniert – keine Rechnung' : 'Rechnung folgt – noch keine Zahlung nötig') : 'derzeit nicht verfügbar'}
              </dd>
            </div>
          )}
        </dl>
        {customerBookingScopeHint && <p className="customer-money-note">{customerBookingScopeHint}</p>}
        {customerMoney.state === 'unknown' && customerBookingIdForPayments && (
          <button
            type="button"
            className="customer-link-btn"
            onClick={() => setCustomerPaymentsReloadToken((current) => current + 1)}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Zahlungsstand erneut laden
          </button>
        )}
      </>
    )
  }

  const renderCustomerGlanceCard = () => {
    // Nur echte Schritte (tone 'action') zählen als "offene Schritte"; Warte- und
    // Info-Einträge (z. B. "Rechnung folgt", "Gerät ist unterwegs") sind Hinweise.
    // Gibt es keinen echten Schritt, rückt der erste Hinweis an die Stelle des
    // nächsten Schritts (z. B. Sendungsverfolgung), ohne als Aufgabe zu zählen.
    const actionableSteps = customerNextActions.filter((action) => action.tone === 'action')
    const primaryAction = actionableSteps[0] || customerNextActions[0]
    const moreActions = actionableSteps.filter((action) => action !== primaryAction)
    const hintActions = customerNextActions.filter((action) => action.tone !== 'action' && action !== primaryAction)
    return (
      <section id="order-customer-glance" className="customer-glance-card" aria-labelledby="order-customer-glance-title">
        <h2 id="order-customer-glance-title" className="customer-glance-heading">Auf einen Blick</h2>
        <div className="customer-glance-top">
          <div className="customer-glance-status">
            <span className="customer-glance-label">Reparaturstatus</span>
            <div className="customer-glance-status-line">
              <span className={`order-status-badge ${getStatusColor(order.status)} text-xs px-2.5 py-1`}>
                {getStatusIcon(order.status)}
                <span className="ml-1">{currentOrderStatusLabel}</span>
              </span>
              <span className="customer-glance-stage">
                Aktueller Schritt: <strong>{currentStageLabel}</strong>
              </span>
            </div>
            <span className="customer-glance-payment-word">
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
              Zahlungsstand: <strong>{customerMoney.state === 'loading' ? 'wird geladen …' : customerPaymentLabel}</strong>
            </span>
          </div>
          <div className="customer-glance-money" aria-label="Beträge">
            {renderCustomerMoneyFigures()}
          </div>
        </div>

        <div className={`customer-glance-next tone-${primaryAction?.tone || 'info'}`} aria-live="polite">
          <span className="customer-glance-next-eyebrow">
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            Nächster Schritt
          </span>
          {primaryAction ? (
            <div className="customer-glance-next-body">
              <div className="customer-glance-next-copy">
                <h3>{primaryAction.title}</h3>
                {primaryAction.badge && <span className="customer-glance-next-badge">{primaryAction.badge}</span>}
                <p>{primaryAction.description}</p>
              </div>
              {(primaryAction.primary || primaryAction.secondary?.length) && (
                <div className="customer-glance-next-actions">
                  {primaryAction.primary && renderCustomerActionButton(primaryAction.primary, 'primary')}
                  {(primaryAction.secondary || []).map((button, index) => renderCustomerActionButton(button, 'secondary', `secondary-${index}`))}
                </div>
              )}
            </div>
          ) : (
            <div className="customer-glance-next-body">
              <div className="customer-glance-next-copy">
                <h3>Aktuell ist nichts zu tun</h3>
                <p>
                  Wir melden uns, sobald es weitergeht.
                  {String(order.status || '').toLowerCase() !== 'pending' && customerNextStepInfo.steps[0]
                    ? ` ${customerNextStepInfo.steps[0]}`
                    : ''}
                </p>
              </div>
            </div>
          )}
          {moreActions.length > 0 && (
            <div className="customer-glance-more">
              <span className="customer-glance-more-title">Weitere offene Schritte ({moreActions.length})</span>
              <ul>
                {moreActions.map((action) => (
                  <li key={action.key}>
                    <div>
                      <strong>{action.title}</strong>
                      <span>{action.description}</span>
                    </div>
                    {action.primary && renderCustomerActionButton(action.primary, 'secondary')}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hintActions.length > 0 && (
            <div className="customer-glance-more is-hints">
              <span className="customer-glance-more-title">Hinweise</span>
              <ul>
                {hintActions.map((action) => (
                  <li key={action.key}>
                    <div>
                      <strong>{action.title}</strong>
                      <span>{action.description}</span>
                    </div>
                    {action.primary && renderCustomerActionButton(action.primary, 'secondary')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    )
  }

  // Ehrliche Meilensteine (HIST-1): reached / current / skipped / pending vom Server, nie aus
  // dem Index abgeleitet. Kunden sehen keine Mitarbeiternamen.
  const describeCustomerMilestone = (stage: OrderMilestone) => {
    const detail = stage.detail ? String(stage.detail) : ''
    switch (stage.state) {
      case 'reached': {
        const when = stage.timeKnown && stage.date ? `Erreicht am ${stage.date}` : (stage.note || 'Zeitpunkt nicht erfasst')
        return detail ? `${detail} · ${when}` : when
      }
      case 'current':
        return detail ? `Aktueller Schritt · ${detail}` : 'Aktueller Schritt'
      case 'skipped':
        return stage.note || 'Übersprungen – nicht erfasst'
      default:
        return 'Offen'
    }
  }

  const renderCustomerProgressCard = () => {
    const stages = (timelineStages as OrderMilestone[]).filter((stage) => stage && stage.id)
    const currentIndex = stages.findIndex((stage) => stage.state === 'current')
    const currentStage = currentIndex >= 0 ? stages[currentIndex] : null
    const hasServices = (repairServices || []).some((service) => service && service._id) || (order.addOns || []).length > 0
    return (
      <Card id="order-progress" className="order-section-card customer-order-section-card customer-milestones-card">
        <CardHeader className="order-section-header customer-section-header-row">
          <CardTitle className="order-section-title">
            <Clock className="h-5 w-5" aria-hidden="true" />
            Reparaturfortschritt
          </CardTitle>
          {stages.length > 0 && (
            <p className="customer-milestones-summary">
              {currentStage
                ? <>Schritt {currentIndex + 1} von {stages.length}: <strong>{translateOrderStatus(currentStage.label)}</strong></>
                : progressTimeline?.cancelled ? 'Auftrag storniert' : <>Stand: <strong>{currentStageLabel}</strong></>}
              {progressTimeline?.paused ? ' · pausiert' : ''}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          {stages.length > 0 ? (
            <ol className="customer-milestones">
              {stages.map((stage) => (
                <li
                  key={stage.id}
                  className={`customer-milestone is-${stage.state}`}
                  aria-current={stage.state === 'current' ? 'step' : undefined}
                >
                  <span className="customer-milestone-dot" aria-hidden="true">
                    {stage.state === 'reached' ? '✓' : stage.state === 'current' ? '●' : stage.state === 'skipped' ? '–' : '○'}
                  </span>
                  <span className="customer-milestone-copy">
                    <span className="customer-milestone-label">{translateOrderStatus(stage.label)}</span>
                    <span className="customer-milestone-meta">{describeCustomerMilestone(stage)}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : progressTimelineError ? (
            <p className="customer-section-state is-error">Der Fortschritt konnte nicht geladen werden. Aktueller Status: {currentOrderStatusLabel}.</p>
          ) : (
            <p className="customer-section-state" role="status">Fortschritt wird geladen …</p>
          )}
          <div className="customer-progress-actions">
            <button type="button" className="customer-link-btn" onClick={openRepairDetailsPopup}>
              <Wrench className="h-4 w-4" aria-hidden="true" />
              Reparaturdetails ansehen
            </button>
            {customerInspection && (
              <button type="button" className="customer-link-btn" onClick={openDiagnosisPopup}>
                <FileText className="h-4 w-4" aria-hidden="true" />
                Diagnose ansehen
              </button>
            )}
            {hasServices && (
              <button type="button" className="customer-link-btn" onClick={openRepairServicesPopup}>
                <Package className="h-4 w-4" aria-hidden="true" />
                Geplante Leistungen ansehen
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderCustomerSectionToggle = (title: string, icon: ReactNode, summary: ReactNode) => (
    <CollapsibleTrigger asChild>
      <button type="button" className="customer-section-toggle">
        <span className="customer-section-toggle-title">
          {icon}
          {title}
        </span>
        <span className="customer-section-toggle-summary">{summary}</span>
        <ChevronDown className="customer-section-toggle-chevron h-4 w-4" aria-hidden="true" />
      </button>
    </CollapsibleTrigger>
  )

  const customerPaymentsToggleSummary = (() => {
    if (customerMoney.state === 'loading') return 'wird geladen …'
    if (customerMoney.state === 'unknown') return 'Zahlungsstand nicht verfügbar'
    if (customerMoney.state === 'no-invoice') return order?.status === 'cancelled' ? 'Storniert' : 'Rechnung folgt'
    if (customerMoney.overpaidTotal > 0.009) return `Überzahlt · Erstattung offen ${formatEUR(customerMoney.refundPending)}`
    if (customerMoney.open > 0.009) return `Offen ${formatEUR(customerMoney.open)}`
    return customerPaymentLabel
  })()

  const renderCustomerPaymentsSection = () => {
    const movements = customerPayments?.payments || []
    return (
      <Card id="order-customer-payments" className="order-section-card customer-order-section-card">
        <Collapsible>
          {renderCustomerSectionToggle(
            'Zahlungen & Rechnungen',
            <Receipt className="h-5 w-5" aria-hidden="true" />,
            <span className={customerMoney.state === 'known' && customerMoney.open > 0.009 ? 'is-open' : ''}>{customerPaymentsToggleSummary}</span>
          )}
          <CollapsibleContent className="customer-section-body">
            {customerMoney.state === 'known' && customerMoney.bookingWide && (
              <div className="customer-subsection">
                <h4>Buchung {customerBookingNumber || ''} · {customerMoney.deviceCount} {customerMoney.deviceCount === 1 ? 'Gerät' : 'Geräte'}</h4>
                <div className="customer-summary-list">
                  <div className="customer-summary-row"><span>Gesamt Buchung (brutto)</span><strong>{formatEUR(customerMoney.bookingGross)}</strong></div>
                  <div className="customer-summary-row"><span>Bezahlt</span><strong>{formatEUR(customerMoney.received)}</strong></div>
                  <div className="customer-summary-row"><span>Offen</span><strong>{formatEUR(customerMoney.open)}</strong></div>
                  {customerMoney.overpaidTotal > 0.009 && (
                    <div className="customer-summary-row"><span>Überzahlt · Erstattung offen</span><strong className="text-violet-700">{formatEUR(customerMoney.refundPending)}</strong></div>
                  )}
                </div>
              </div>
            )}

            <div className="customer-subsection">
              <h4>Rechnungen</h4>
              {loadingCustomerInvoices ? (
                <p className="customer-section-state" role="status">Rechnungen werden geladen …</p>
              ) : customerInvoicesError ? (
                <div className="customer-section-state is-error">
                  <span>Rechnungen konnten nicht geladen werden.</span>
                  <button type="button" className="customer-link-btn" onClick={() => setCustomerInvoicesReloadToken((current) => current + 1)}>
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Erneut versuchen
                  </button>
                </div>
              ) : customerInvoices.length > 0 ? (
                <ul className="customer-document-list">
                  {customerInvoices.map((invoice) => {
                    const payment = summarizeInvoicePayment(invoice)
                    const canPay = !invoice.isCreditNote && payment.known && (payment.open ?? 0) > 0.009
                    return (
                      <li key={invoice._id} className="customer-document-row">
                        <div className="min-w-0">
                          <p className="customer-document-title">
                            {invoice.isCreditNote ? 'Gutschrift' : 'Rechnung'} {invoice.invoiceNumber || invoice._id}
                          </p>
                          <p className="customer-document-meta">
                            {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('de-DE') : 'Ohne Datum'}
                            {typeof invoice.total === 'number' ? ` · ${formatEUR(invoice.total)}` : ''}
                          </p>
                          {payment.known && (
                            <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${INVOICE_PAYMENT_TONE_CLASSES[payment.tone]}`}>
                              {payment.label}
                            </span>
                          )}
                        </div>
                        <div className="customer-document-actions">
                          {canPay && (
                            <button type="button" className="customer-next-btn is-primary is-small" onClick={() => openCustomerInvoicePayment(String(invoice._id))}>
                              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Bezahlen</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="customer-next-btn is-secondary is-small"
                            onClick={() => void handleDownloadCustomerInvoicePdf(invoice)}
                            disabled={downloadingInvoiceId === String(invoice._id)}
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{downloadingInvoiceId === String(invoice._id) ? 'PDF wird geladen…' : 'PDF herunterladen'}</span>
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="customer-section-state">Noch keine Rechnung zu diesem Auftrag.</p>
              )}
            </div>

            {customerBookingIdForPayments && (
              <div className="customer-subsection">
                <h4>Zahlungseingänge</h4>
                {customerPaymentsState === 'loading' || customerPaymentsState === 'idle' ? (
                  <p className="customer-section-state" role="status">Zahlungen werden geladen …</p>
                ) : customerPaymentsState === 'error' ? (
                  <div className="customer-section-state is-error">
                    <span>Zahlungen konnten nicht geladen werden.</span>
                    <button type="button" className="customer-link-btn" onClick={() => setCustomerPaymentsReloadToken((current) => current + 1)}>
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      Erneut versuchen
                    </button>
                  </div>
                ) : movements.length === 0 ? (
                  <p className="customer-section-state">Noch keine Zahlung eingegangen.</p>
                ) : (
                  <ul className="customer-document-list">
                    {movements.map((payment) => (
                      <li key={payment._id} className="customer-document-row">
                        <div className="min-w-0">
                          <p className="customer-document-title">
                            {translatePaymentMethodLabel(payment.paymentMethod)} · {formatEUR(payment.effectiveAmount)}
                          </p>
                          <p className="customer-document-meta">
                            {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('de-DE') : 'Ohne Datum'}
                            {payment.refundedAmount > 0.009 ? ` · davon erstattet ${formatEUR(payment.refundedAmount)}` : ''}
                          </p>
                          <p className="customer-document-meta">
                            {payment.allocations.length > 0
                              ? payment.allocations.map((allocation) => `Rechnung ${allocation.invoiceNumber || '–'}: ${formatEUR(allocation.allocatedAmount)}`).join(' · ')
                              : 'Vorauszahlung (noch keiner Rechnung zugeordnet)'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </Card>
    )
  }

  const renderCustomerPriceSection = () => (
    <Card id="order-customer-price" className="order-section-card customer-order-section-card">
      <Collapsible>
        {renderCustomerSectionToggle(
          'Preisaufstellung',
          <Euro className="h-5 w-5" aria-hidden="true" />,
          `Gesamt ${formatEUR(orderPriceBreakdown.grossTotal)}`
        )}
        <CollapsibleContent className="customer-section-body">
          <div className="customer-summary-list">
            {orderPriceBreakdown.hasPositions && orderDiscountLines.length > 0 && (
              <div className="customer-summary-row">
                <span>Listenpreis (Brutto)</span>
                <strong>{formatEUR(orderPriceBreakdown.positionsGross)}</strong>
              </div>
            )}
            {orderDiscountLines.map((line) => (
              <div key={line.key} className="customer-summary-row">
                <span>{line.label}</span>
                <strong className="text-green-700">−{formatEUR(line.amount)}</strong>
              </div>
            ))}
            <div className="customer-summary-row">
              <span>Gesamtbetrag (Brutto)</span>
              <strong>{formatEUR(orderPriceBreakdown.grossTotal)}</strong>
            </div>
            <div className="customer-summary-row">
              <span>davon Netto</span>
              <strong>{formatEUR(orderPriceBreakdown.netTotal)}</strong>
            </div>
            <div className="customer-summary-row">
              <span>davon MwSt. ({orderTaxRateLabel})</span>
              <strong>{formatEUR(orderPriceBreakdown.taxAmount)}</strong>
            </div>
          </div>
          <button type="button" className="customer-link-btn" onClick={openRepairDetailsPopup}>
            <Wrench className="h-4 w-4" aria-hidden="true" />
            Leistungen im Detail ansehen
          </button>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )

  const renderCustomerShippingCard = () => {
    const outboundTracking = String(outboundShipment?.trackingNumber || '')
    const showInboundBlock = Boolean(customerInboundInfo && !['not-needed'].includes(String(customerInboundInfo.state)))
      || Boolean(inboundShipment?.trackingNumber || inboundShipment?.status || inboundDownloadable)
    const showOutboundBlock = Boolean(outboundTracking || outboundShipment?.hasLabel || outboundReconciliationRequired)
    return (
      <Card id="order-customer-shipping" className="order-section-card customer-order-section-card">
        <CardHeader className="order-section-header customer-section-header-row">
          <CardTitle className="order-section-title">
            <Truck className="h-5 w-5" aria-hidden="true" />
            Versand
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          {shipmentsLoadError && (
            <div className="customer-section-state is-error">
              <span>Versandstand konnte nicht geladen werden.</span>
              <button type="button" className="customer-link-btn" onClick={() => void loadOrderShipments(String(order._id))}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Erneut versuchen
              </button>
            </div>
          )}

          {showInboundBlock && (
            <div className="customer-summary-logistics-block">
              <div className="customer-summary-logistics-title">Einsendung (Sie → McRepair)</div>
              {customerInboundInfo ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {customerInboundStatus && (
                      <Badge className={`customer-shipping-status-badge ${getShipmentStatusMeta(customerInboundStatus).className}`}>
                        {getShipmentStatusMeta(customerInboundStatus).label}
                      </Badge>
                    )}
                    {customerInboundInfo.placeholder && (
                      <span className="customer-testlabel-badge">Testlabel – nicht für den Versand verwenden</span>
                    )}
                  </div>
                  {customerInboundInfo.message && (
                    <p className="customer-shipping-status-description">{customerInboundInfo.message}</p>
                  )}
                  {customerInboundInfo.trackingNumber && (
                    <div className="customer-summary-tracking">
                      <span>Sendungsnummer Einsendung</span>
                      <strong>{customerInboundInfo.trackingNumber}</strong>
                      {customerInboundTrackingVisible && (
                        <a href={buildDhlTrackingUrl(customerInboundInfo.trackingNumber)} target="_blank" rel="noreferrer" className="customer-summary-tracking-link">
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          DHL-Sendung verfolgen
                        </a>
                      )}
                    </div>
                  )}
                  {customerInboundInfo.state === 'ready' && customerInboundInfo.downloadUrl && (
                    <div className="customer-document-actions">
                      <button
                        type="button"
                        className="customer-next-btn is-secondary is-small"
                        onClick={() => void handleCustomerInboundFile('download')}
                        disabled={Boolean(customerInboundBusy)}
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{customerInboundBusy === 'download' ? 'Einsendelabel wird geladen…' : customerInboundInfo.placeholder ? 'Testlabel herunterladen' : 'Einsendelabel herunterladen'}</span>
                      </button>
                      <button
                        type="button"
                        className="customer-next-btn is-secondary is-small"
                        onClick={() => void handleCustomerInboundFile('print')}
                        disabled={Boolean(customerInboundBusy)}
                      >
                        <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{customerInboundBusy === 'print' ? 'Druck wird vorbereitet…' : 'Drucken'}</span>
                      </button>
                    </div>
                  )}
                  {customerInboundInfo.state !== 'ready' && customerInboundInfo.canCreate && (
                    <div className="customer-document-actions">
                      <button
                        type="button"
                        className="customer-next-btn is-primary is-small"
                        onClick={() => void handleCustomerInboundCreate()}
                        disabled={Boolean(customerInboundBusy)}
                      >
                        <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{customerInboundBusy === 'create' ? 'Einsendelabel wird erstellt…' : 'DHL-Einsendelabel erstellen'}</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {inboundShipment?.status && (
                    <Badge className={`customer-shipping-status-badge ${getShipmentStatusMeta(String(inboundShipment.status).toLowerCase()).className}`}>
                      {getShipmentStatusMeta(String(inboundShipment.status).toLowerCase()).label}
                    </Badge>
                  )}
                  {inboundShipment?.statusDescription && (
                    <p className="customer-shipping-status-description">{inboundShipment.statusDescription}</p>
                  )}
                  {inboundShipment?.trackingNumber && (
                    <div className="customer-summary-tracking">
                      <span>Sendungsnummer Einsendung</span>
                      <strong>{inboundShipment.trackingNumber}</strong>
                      {!isPlaceholderTracking(inboundShipment.trackingNumber) && (
                        <a href={buildDhlTrackingUrl(inboundShipment.trackingNumber)} target="_blank" rel="noreferrer" className="customer-summary-tracking-link">
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          DHL-Sendung verfolgen
                        </a>
                      )}
                    </div>
                  )}
                  {inboundDownloadable && (
                    <div className="customer-document-actions">
                      <button
                        type="button"
                        onClick={handleDownloadInboundLabel}
                        disabled={downloadingOrderReturnLabel}
                        className="customer-next-btn is-secondary is-small"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{downloadingOrderReturnLabel ? 'Einsendelabel wird geladen…' : 'Einsendelabel herunterladen'}</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {showOutboundBlock && (
            <div className="customer-summary-logistics-block">
              <div className="customer-summary-logistics-title">Auslieferung (McRepair → Sie)</div>
              {outboundShipment?.status && (
                <Badge className={`customer-shipping-status-badge ${getShipmentStatusMeta(String(outboundShipment.status).toLowerCase()).className}`}>
                  {getShipmentStatusMeta(String(outboundShipment.status).toLowerCase()).label}
                </Badge>
              )}
              {outboundShipment?.statusDescription && (
                <p className="customer-shipping-status-description">{outboundShipment.statusDescription}</p>
              )}
              {outboundTracking && (
                <div className="customer-summary-tracking">
                  <span>Sendungsnummer Auslieferung</span>
                  <strong>{outboundTracking}</strong>
                  {!isPlaceholderTracking(outboundTracking) && (
                    <a href={buildDhlTrackingUrl(outboundTracking)} target="_blank" rel="noreferrer" className="customer-summary-tracking-link">
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      Sendung verfolgen
                    </a>
                  )}
                </div>
              )}
              {outboundShipment?.hasLabel && (
                <div className="customer-document-actions">
                  <button
                    type="button"
                    onClick={handleDownloadOrderShippingLabel}
                    disabled={downloadingOrderShippingLabel}
                    className="customer-next-btn is-secondary is-small"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{downloadingOrderShippingLabel ? 'Versandlabel wird geladen…' : 'Versandlabel herunterladen'}</span>
                  </button>
                </div>
              )}
              {String(outboundShipment?.status || '') === 'label-created' && (
                <div className="customer-summary-shipping-note is-pending">
                  Das Versandlabel ist erstellt. Als versendet gilt das Gerät erst, wenn DHL das Paket übernommen hat.
                </div>
              )}
            </div>
          )}

          {order.shippingAddress ? (
            <div className="customer-subsection">
              <h4>Lieferadresse</h4>
              <div className="customer-summary-address">
                {String((order.shippingAddress as any).deliveryType || '') === 'packstation' ? (
                  <>
                    <p>Packstation {(order.shippingAddress as any).packstationNumber}</p>
                    <p>Postnummer {(order.shippingAddress as any).postNumber}</p>
                  </>
                ) : (
                  <p>{order.shippingAddress.street}</p>
                )}
                <p>{order.shippingAddress.zipCode} {order.shippingAddress.city}</p>
                <p>{order.shippingAddress.country}</p>
              </div>
            </div>
          ) : null}

          {!showInboundBlock && !showOutboundBlock && !order.shippingAddress && !shipmentsLoadError && (
            <p className="customer-section-state">Noch keine Versanddaten zu diesem Auftrag.</p>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderCustomerOrderFactsCard = () => (
    <Card id="order-customer-summary" className="order-section-card customer-order-section-card">
      <CardHeader className="order-section-header customer-section-header-row">
        <CardTitle className="order-section-title">
          <FileText className="h-5 w-5" aria-hidden="true" />
          Auftragsdaten &amp; Kontakt
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        <div className="customer-summary-list">
          <div className="customer-summary-row"><span>Auftrag</span><strong>{customerOrderRef}</strong></div>
          {customerBookingNumber && (
            <div className="customer-summary-row"><span>Buchung</span><strong>{customerBookingNumber}</strong></div>
          )}
          <div className="customer-summary-row"><span>Erstellt am</span><strong>{orderCreatedText}</strong></div>
          <div className="customer-summary-row"><span>Letzte Aktualisierung</span><strong>{lastUpdate}</strong></div>
          <div className="customer-summary-row"><span>Voraussichtliche Fertigstellung</span><strong>{estimatedCompletionText}</strong></div>
        </div>
        <div className="customer-summary-contact-list">
          <div>
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{customer.email}</span>
          </div>
          <div>
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{customer.phone || 'Keine Telefonnummer hinterlegt'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderCustomerHistorySection = () => (
    <Card id="order-customer-history" className="order-section-card customer-order-section-card">
      <Collapsible open={customerHistoryOpen} onOpenChange={setCustomerHistoryOpen}>
        {renderCustomerSectionToggle('Verlauf', <History className="h-5 w-5" aria-hidden="true" />, 'Alle Ereignisse')}
        <CollapsibleContent className="customer-section-body">
          {customerHistoryState === 'loading' || customerHistoryState === 'idle' ? (
            <p className="customer-section-state" role="status">Verlauf wird geladen …</p>
          ) : customerHistoryState === 'error' ? (
            <div className="customer-section-state is-error">
              <span>Verlauf konnte nicht geladen werden.</span>
              <button type="button" className="customer-link-btn" onClick={() => setCustomerHistoryReloadToken((current) => current + 1)}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Erneut versuchen
              </button>
            </div>
          ) : !customerHistory || customerHistory.length === 0 ? (
            <p className="customer-section-state">Noch keine Einträge im Verlauf.</p>
          ) : (
            <ol className="customer-history-list">
              {customerHistory.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.title}</strong>
                  {entry.description && entry.description !== entry.title && <span>{entry.description}</span>}
                  <time dateTime={entry.at || undefined}>
                    {entry.at && entry.timeKnown !== false
                      ? new Date(entry.at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : (entry.timeNote || 'Zeitpunkt nicht erfasst')}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )

  const renderCustomerMessagesCard = () => (
    <Card id="order-customer-messages" tabIndex={-1} className="order-section-card customer-order-messages-card">
      <CardHeader className="order-section-header customer-section-header-row">
        <CardTitle className="order-section-title">
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
          Nachrichten zum Auftrag
        </CardTitle>
        {id && (
          <Link to={`/messages?thread=order:${encodeURIComponent(id)}`} className="customer-link-btn">
            <Inbox className="h-4 w-4" aria-hidden="true" />
            Im Postfach öffnen
          </Link>
        )}
      </CardHeader>
      <CardContent className="pt-2 space-y-3">
        <p className="order-section-description">
          Schreiben Sie direkt an das Reparaturteam und beantworten Sie Rückfragen hier. Derselbe Verlauf erscheint unter „Nachrichten“.
        </p>
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
                      {formatEUR(safeToNumber(complaintWorkflow.repairOffer.amount))}
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
                    {formatEUR(safeToNumber(complaintWorkflow.repairOffer.amount))} &bull;{' '}
                    {complaintWorkflow.repairOffer.status === 'accepted' && complaintWorkflow.repairOffer.acceptedAt
                      ? new Date(complaintWorkflow.repairOffer.acceptedAt).toLocaleDateString('de-DE')
                      : complaintWorkflow.repairOffer.rejectedAt
                      ? new Date(complaintWorkflow.repairOffer.rejectedAt).toLocaleDateString('de-DE')
                      : ''}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
        {id && (
          // Derselbe Verlauf wie /messages (COMMS-12); keine Auftrags-ID als inspectionId (COMMS-13).
          <CommunicationPanel
            orderId={id}
            entityType="order"
            onThreadChange={handleThreadPendingChange}
          />
        )}
      </CardContent>
    </Card>
  )

  const renderCustomerLayout = () => (
    <div className="customer-order-flow">
      {renderCustomerGlanceCard()}
      {renderCustomerProgressCard()}

      {/* >= 1100 px: links Nachrichten, rechts Abschnitte; darunter eine Spalte in der
          Reihenfolge Nachrichten, Zahlungen, Preise, Versand, Auftragsdaten, Verlauf. */}
      <div className="customer-order-columns">
        <div className="customer-order-col customer-order-col-messages">
          {renderCustomerMessagesCard()}
        </div>
        <div className="customer-order-col customer-order-col-side">
          {renderCustomerPaymentsSection()}
          {renderCustomerPriceSection()}
          {renderCustomerShippingCard()}
          {renderCustomerOrderFactsCard()}
          {renderCustomerHistorySection()}
        </div>
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

          <div className="order-dialog-body customer-repair-details-popup-body">
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

          <div className="order-dialog-body customer-diagnosis-popup-body">
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

          <div className="order-dialog-body customer-repair-services-popup-body">
            <section className="customer-repair-services-popup-section">
              <h4>Reparaturdienste</h4>
              {repairServices && repairServices.filter((s) => s && s._id).length > 0 ? (
                <div className="customer-repair-services-popup-list">
                  {repairServices.filter((s) => s && s._id).map((service, index) => (
                    <div key={service._id || `popup-service-${index}`} className="customer-repair-services-popup-item">
                      <div>
                        <p className="title">{service.serviceId?.name || service.name || 'Reparaturdienst'}</p>
                        {(service.serviceId?.description || service.description) && (
                          <p className="description">{service.serviceId?.description || service.description}</p>
                        )}
                        {service.notes && (
                          <p className="notes">Hinweis: {service.notes}</p>
                        )}
                      </div>
                      <div className="meta">
                        <Badge variant="outline" className="text-xs">
                          {formatEUR(safeToNumber(service.price))}
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
                          {formatEUR(safeToNumber(addOn.price))}
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

  // ══ PERSONAL/ADMIN: Kurzübersicht + Bereiche (ADMUX-7, HIST-18, COMMS-12/13, DHL-4/5/8) ══
  // Kein zweites Auftragsdetail: dieselben render*-Blöcke, nur in klar benannte Bereiche
  // gruppiert. Der aktive Bereich steht in der URL (?bereich=…), damit Postfach,
  // Benachrichtigungen und "Zurück" denselben Bereich wieder öffnen.
  const adminTabFromLocation = (() => {
    const requested = String(new URLSearchParams(location.search).get('bereich') || '').toLowerCase()
    if ((ADMIN_ORDER_TABS as readonly string[]).includes(requested)) return requested as AdminOrderTab
    if (location.hash === '#order-communication' || location.hash === '#order-customer-messages') return 'kommunikation'
    if (location.hash === '#order-history') return 'verlauf'
    return 'uebersicht'
  })()
  const adminTab: AdminOrderTab = adminTabFromLocation

  const setAdminTab = (next: AdminOrderTab) => {
    const params = new URLSearchParams(location.search)
    params.set('bereich', next)
    navigate(
      { pathname: location.pathname, search: `?${params.toString()}` },
      // Nur das Rücksprungziel mitnehmen (kein erneutes Öffnen eines Workflows o. Ä.).
      { replace: true, state: backTarget ? { backTarget } : undefined }
    )
  }

  const openAdminTabAndFocus = (next: AdminOrderTab, elementId?: string) => {
    setAdminTab(next)
    if (!elementId) return
    window.setTimeout(() => {
      const element = document.getElementById(elementId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        if (typeof (element as HTMLElement).focus === 'function') (element as HTMLElement).focus({ preventScroll: true })
      }
    }, 60)
  }

  // Zahlungsstand: Beträge ausschließlich vom Server (Buchungs-Zahlungsübersicht bzw. Saldo
  // der eigenen Rechnungen bei Aufträgen ohne Buchung). Nichts wird hier nachgerechnet,
  // außer der Summe der serverseitigen Rechnungssalden.
  const adminBookingOrderCount = Array.isArray((linkedBooking as any)?.orderIds) ? (linkedBooking as any).orderIds.length : 0
  const adminMoney = (() => {
    if (adminPayments) {
      const summary = (adminPayments.summary || {}) as Partial<BookingPaymentOverview['summary']>
      const balance = adminPayments.balance
      const bookingTotal = safeToNumber(balance?.total ?? summary.referenceTotal ?? summary.orderValue)
      return {
        scope: 'booking' as const,
        bookingTotal,
        received: safeToNumber(balance?.received ?? summary.receivedTotal),
        open: safeToNumber(balance?.open ?? summary.openOrderBalance),
        refundPending: safeToNumber(balance?.refundPending ?? summary.refundPendingTotal),
        notInvoiced: safeToNumber(summary.notInvoicedTotal),
      }
    }
    if (!customerBookingIdForPayments && user?.role === 'admin' && orderInvoices.length > 0) {
      const summaries = orderInvoices.map((invoice) => summarizeInvoicePayment(invoice as any)).filter((entry) => entry.known)
      if (!summaries.length) return null
      return {
        scope: 'order' as const,
        bookingTotal: orderPriceBreakdown.grossTotal,
        received: summaries.reduce((sum, entry) => sum + safeToNumber(entry.received), 0),
        open: summaries.reduce((sum, entry) => sum + safeToNumber(entry.open), 0),
        refundPending: summaries.reduce((sum, entry) => sum + safeToNumber(entry.refundPending), 0),
        notInvoiced: 0,
      }
    }
    return null
  })()
  const adminMoneyWord = !adminMoney
    ? null
    : adminMoney.refundPending > 0.009
      ? { label: 'Überzahlt · Erstattung offen', tone: 'overpaid' as const }
      : adminMoney.open <= 0.009 && adminMoney.received > 0.009
        ? { label: 'Bezahlt', tone: 'paid' as const }
        : adminMoney.received > 0.009
          ? { label: 'Teilbezahlt', tone: 'partial' as const }
          // 'Offen' nur, wenn laut denselben angezeigten Zahlen wirklich etwas offen ist.
          : adminMoney.open > 0.009
            ? { label: 'Offen', tone: 'open' as const }
            : order?.status === 'cancelled'
              ? { label: 'Storniert – keine Zahlung offen', tone: 'neutral' as const }
              : adminMoney.notInvoiced > 0.009
                ? { label: 'Noch nicht berechnet', tone: 'neutral' as const }
                : { label: 'Nichts offen', tone: 'neutral' as const }
  const adminMoneyIsBookingWide = Boolean(
    adminMoney?.scope === 'booking'
    && (adminBookingOrderCount > 1 || Math.abs(safeToNumber(adminMoney?.bookingTotal) - orderPriceBreakdown.grossTotal) > 0.009)
  )
  const adminBookingNumber = String(linkedBooking?.bookingNumber || adminPayments?.booking?.bookingNumber || '')

  const inboundIsPlaceholder = Boolean(
    (inboundShipment as { placeholder?: boolean } | undefined)?.placeholder
    || orderShipments?.inboundLabels?.some((entry) => Boolean((entry as { placeholder?: boolean }).placeholder) || isPlaceholderTracking(entry.trackingNumber))
    || isPlaceholderTracking(inboundShipment?.trackingNumber)
  )
  const outboundIsPlaceholder = isPlaceholderTracking(outboundShipment?.trackingNumber)

  const describeShipmentChip = (direction: 'inbound' | 'outbound') => {
    const shipment = direction === 'inbound' ? inboundShipment : outboundShipment
    if (!orderShipments) return { text: shipmentsLoadError ? 'nicht verfügbar' : 'wird geladen …', tone: 'muted' }
    if (shipment?.reconciliationRequired) return { text: 'Abgleich erforderlich', tone: 'warn' }
    if (shipment?.inProgress) return { text: 'Label wird erstellt …', tone: 'info' }
    const exists = direction === 'inbound' ? inboundLabelExists : outboundLabelExists
    if (!exists) return { text: direction === 'inbound' ? 'Noch kein Einsendelabel' : 'Noch nicht versendet', tone: 'muted' }
    const placeholder = direction === 'inbound' ? inboundIsPlaceholder : outboundIsPlaceholder
    const label = shipment?.status ? getShipmentStatusMeta(shipment.status).label : 'Label erstellt'
    return { text: placeholder ? `${label} (Testlabel)` : label, tone: placeholder ? 'warn' : 'ok' }
  }

  const adminInspectionStatus = String(customerInspection?.status || '').toLowerCase()
  // Stornierter Auftrag: keine Inspektion starten/fortsetzen (Server lehnt mit 409 ab);
  // ein fertiger Prüfbericht bleibt lesbar. Wieder öffnen nur per 'Stornierung aufheben' (Admin).
  const adminInspectionAction: { label: string; open: boolean; blocked?: boolean } = adminInspectionStatus === 'completed' && customerInspection
    ? { label: 'Prüfbericht ansehen', open: false }
    : order?.status === 'cancelled'
      ? { label: 'Storniert – Inspektion gesperrt', open: false, blocked: true }
      : !customerInspection
        ? { label: 'Inspektion starten', open: true }
        : { label: 'Inspektion fortsetzen', open: true }

  const PAYMENT_METHOD_LABELS_DE: Record<string, string> = {
    cash: 'Bar',
    bank_transfer: 'Überweisung',
    sepa: 'SEPA-Lastschrift',
    credit_card: 'Kreditkarte',
    debit_card: 'Debitkarte',
    paypal: 'PayPal',
    invoice: 'Rechnung',
  }
  const formatDateTimeDe = (value?: string | null) => {
    if (!value) return '–'
    const date = new Date(value)
    return Number.isNaN(date.getTime())
      ? '–'
      : date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const handleAdminHistoryLink = (link: OrderHistoryLink, _entry: AdminHistoryEntry) => {
    switch (link.kind) {
      case 'invoice': {
        if (user?.role !== 'admin') {
          openAdminTabAndFocus('rechnungen', 'admin-od-invoices')
          return
        }
        const invoice = orderInvoices.find((entry) => String(entry._id) === String(link.id))
        void openInvoiceDetailsDialog(invoice || ({ _id: link.id } as FinancialInvoice))
        return
      }
      case 'payment':
        openAdminTabAndFocus('rechnungen', 'admin-od-payments')
        return
      case 'inspection':
        if (link.href) navigate(link.href)
        return
      case 'communication':
        openAdminTabAndFocus('kommunikation', 'admin-od-communication')
        return
      case 'tracking':
        openAdminTabAndFocus('versand', 'admin-od-shipping')
        return
      case 'revision':
        openAdminTabAndFocus('uebersicht', 'order-repair-info')
        return
      default:
        if (link.href) navigate(link.href)
    }
  }

  const renderAdminStatusMenu = () => (
              <DropdownMenu open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${getStatusButtonClasses(order.status)} text-xs px-3 py-1.5 cursor-pointer font-semibold flex items-center gap-1.5 rounded-md`}
                    disabled={updatingStatus}
                  >
                    {getStatusIcon(order.status)}
                    <span>{currentOrderStatusLabel}</span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {order.status === 'cancelled' ? (
                    <>
                      <DropdownMenuLabel className="text-xs font-semibold">Auftrag ist storniert</DropdownMenuLabel>
                      <p className="px-2 pb-2 text-[11px] leading-snug text-slate-600">
                        Ein stornierter Auftrag wird nicht weiterbearbeitet. Wieder öffnen nur mit Begründung.
                      </p>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => { setStatusDropdownOpen(false); setOrderReopenDialogOpen(true) }}
                        disabled={updatingStatus || user?.role !== 'admin'}
                        className="text-xs cursor-pointer"
                      >
                        <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
                        {user?.role === 'admin' ? 'Stornierung aufheben …' : 'Stornierung aufheben (nur Admin)'}
                      </DropdownMenuItem>
                    </>
                  ) : (<>
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
                    {READY_NEUTRAL_LABEL}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange('completed')} disabled={updatingStatus || order.status === 'completed'} className="text-xs cursor-pointer">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Abgeschlossen
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setOrderCancelDialogOpen(true)} disabled={updatingStatus || order.status === 'cancelled'} className="text-xs cursor-pointer text-destructive">
                    <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                    Storniert
                  </DropdownMenuItem>
                  </>)}
                </DropdownMenuContent>
              </DropdownMenu>
  )

  const renderAdminHeader = () => {
    const inboundChip = describeShipmentChip('inbound')
    const outboundChip = describeShipmentChip('outbound')
    const customerLabel = customer?.name || order.guestInfo?.email || 'Unbekannter Kunde'
    const isGuestOrder = Boolean(order.guestInfo?.isGuest)
    return (
      <header className="order-details-header admin-od-header" aria-labelledby="admin-od-title">
        <div className="admin-od-header-top">
          <div className="admin-od-identity">
            {(isComplaintFollowupOrder || order.hasComplaint) && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge className="bg-rose-100 text-rose-800 border border-rose-300" variant="outline">
                  {isComplaintFollowupOrder ? 'Reklamationsauftrag' : 'Reklamation vorhanden'}
                </Badge>
                {isComplaintFollowupOrder ? (
                  <>
                    <span className="admin-od-on-dark-muted">Basiert auf Auftrag:</span>
                    {originalComplaintOrderId ? (
                      <Link to={`/orders/${originalComplaintOrderId}`} className="font-medium underline admin-od-on-dark-link">
                        {originalComplaintOrderNumber || originalComplaintOrderId}
                      </Link>
                    ) : <span className="font-medium">Nicht verknüpft</span>}
                  </>
                ) : (
                  <>
                    <span className="admin-od-on-dark-muted">Reklamationsauftrag:</span>
                    {complaintOrderId ? (
                      <Link to={`/orders/${complaintOrderId}`} className="font-medium underline admin-od-on-dark-link">
                        {complaintOrderNumber || complaintOrderId}
                      </Link>
                    ) : <span className="font-medium">Noch nicht erstellt</span>}
                  </>
                )}
              </div>
            )}
            <h1 id="admin-od-title" className="admin-od-title">
              <Package className="h-6 w-6 shrink-0" aria-hidden="true" />
              <span>Auftrag {order.orderNumber || order._id.slice(-6)}</span>
              <span className="admin-od-title-device">· {order.deviceBrand} {order.deviceModel}</span>
            </h1>
            <p className="admin-od-identity-meta">
              <span>Kunde: <strong>{customerLabel}</strong>{isGuestOrder ? ' (Gast)' : ''}</span>
              {customer?.email ? <span><Mail className="inline h-3.5 w-3.5 mr-1" aria-hidden="true" />{customer.email}</span> : null}
              {customer?.phone ? <span><Phone className="inline h-3.5 w-3.5 mr-1" aria-hidden="true" />{customer.phone}</span> : null}
              {adminBookingNumber ? <span>Buchung {adminBookingNumber}</span> : null}
              <span>Erstellt am {orderCreatedText}</span>
            </p>
          </div>

          <div className="admin-od-actions" aria-label="Hauptaktionen">
            <Button
              size="sm"
              className="admin-od-action-primary"
              disabled={adminInspectionAction.blocked}
              title={adminInspectionAction.blocked ? 'Auftrag storniert – Inspektion gesperrt. Zum Fortsetzen muss ein Admin die Stornierung aufheben.' : undefined}
              onClick={() => {
                if (adminInspectionAction.blocked) return
                if (adminInspectionAction.open) {
                  setInspectionDialogOpen(true)
                } else {
                  openAdminTabAndFocus('uebersicht', 'order-device-inspection')
                }
              }}
            >
              <FileText className="h-4 w-4 mr-1.5" aria-hidden="true" />
              {adminInspectionAction.label}
            </Button>
            <Button size="sm" className="admin-od-action-secondary" onClick={() => openAdminTabAndFocus('kommunikation', 'admin-od-communication')}>
              <MessageSquare className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Nachricht an Kunden
            </Button>
            {user?.role === 'admin' && (
              <Button
                size="sm"
                className="admin-od-action-secondary"
                onClick={handleCreateOrderInvoice}
                disabled={creatingOrderInvoice}
              >
                <Receipt className="h-4 w-4 mr-1.5" aria-hidden="true" />
                {creatingOrderInvoice ? 'Rechnung wird erstellt…' : 'Rechnung erstellen'}
              </Button>
            )}
            {order.status === 'ready-for-pickup' && !order.pickupConfirmation && (
              <Button
                size="sm"
                onClick={handleConfirmPickup}
                disabled={confirmingPickup}
                className="bg-green-600 hover:bg-green-700 text-white border-0"
              >
                <PackageCheck className="h-4 w-4 mr-1.5" aria-hidden="true" />
                {confirmingPickup ? 'Wird bestätigt…' : 'Abholung bestätigen'}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="admin-od-action-more" aria-label="Weitere Aktionen">
                  Weitere Aktionen
                  <ChevronDown className="h-3.5 w-3.5 ml-1" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs">Versand</DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={creatingOrderReturnLabel || !inboundAction?.allowed}
                  onClick={() => void handleCreateInboundLabel()}
                  className="text-sm"
                >
                  <Send className="h-4 w-4 mr-2" aria-hidden="true" />
                  {inboundLabelExists ? 'Einsendelabel bereits erstellt' : 'DHL-Einsendelabel erstellen (Kunde → McRepair)'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={creatingOrderShippingLabel || !outboundAction?.allowed}
                  onClick={() => void handleCreateOutboundLabel()}
                  className="text-sm"
                >
                  <Truck className="h-4 w-4 mr-2" aria-hidden="true" />
                  {outboundLabelExists ? 'Versandlabel bereits erstellt' : 'An Kunden versenden (McRepair → Kunde)'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openAdminTabAndFocus('versand', 'admin-od-shipping')} className="text-sm">
                  <Package className="h-4 w-4 mr-2" aria-hidden="true" />
                  Versand-Details ansehen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">Kommunikation</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    setCommFeedbackOpen(true)
                    openAdminTabAndFocus('kommunikation', 'admin-od-communication')
                  }}
                  className="text-sm"
                >
                  <HelpCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                  Rückfrage an Kunden stellen
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setCommQuickActionOpen(true)
                    openAdminTabAndFocus('kommunikation', 'admin-od-communication')
                  }}
                  className="text-sm"
                >
                  <Zap className="h-4 w-4 mr-2" aria-hidden="true" />
                  Aktion vom Kunden anfordern
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/messages?thread=order:${order._id}`)} className="text-sm">
                  <Inbox className="h-4 w-4 mr-2" aria-hidden="true" />
                  Im Postfach öffnen
                </DropdownMenuItem>
                {guestTrackingUrl && (
                  <DropdownMenuItem onClick={() => window.open(guestTrackingUrl, '_blank', 'noopener,noreferrer')} className="text-sm">
                    <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
                    Gast-Tracking-Seite öffnen
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="admin-od-status-row">
          <div className="admin-od-status-item">
            <span className="admin-od-status-label">Reparaturstatus</span>
            {renderAdminStatusMenu()}
          </div>
          <button
            type="button"
            className="admin-od-status-item admin-od-status-item--button"
            onClick={() => openAdminTabAndFocus('rechnungen', 'admin-od-finance')}
            aria-label="Zahlungsstand – Rechnungen & Zahlungen öffnen"
          >
            <span className="admin-od-status-label">Zahlung</span>
            {adminMoney && adminMoneyWord ? (
              <span className="admin-od-status-value">
                <span className={`admin-od-pill is-${adminMoneyWord.tone}`}>
                  <CreditCard className="h-3.5 w-3.5" aria-hidden="true" /> {adminMoneyWord.label}
                </span>
                <span className="admin-od-money">
                  <span className="admin-od-money-part">Gesamt (brutto) <strong>{formatEUR(orderPriceBreakdown.grossTotal)}</strong></span>
                  {' · '}<span className="admin-od-money-part">Bezahlt <strong>{formatEUR(adminMoney.received)}</strong></span>
                  {' · '}{adminMoney.refundPending > 0.009
                    ? <span className="admin-od-money-part">Erstattung offen <strong>{formatEUR(adminMoney.refundPending)}</strong></span>
                    : <span className="admin-od-money-part">Offen <strong>{formatEUR(adminMoney.open)}</strong></span>}
                </span>
                {adminMoneyIsBookingWide && (
                  <span className="admin-od-money-note">
                    Bezahlt/Offen gelten für die gesamte Buchung{adminBookingNumber ? ` ${adminBookingNumber}` : ''}
                    {adminBookingOrderCount > 1 ? ` (${adminBookingOrderCount} Geräte, ` : ' ('}Gesamt {formatEUR(adminMoney.bookingTotal)})
                  </span>
                )}
              </span>
            ) : (
              <span className="admin-od-status-value">
                <span className={`admin-od-pill is-neutral ${cancelledWithoutPayment ? '' : getPaymentStatusColor(order.paymentStatus)}`}>
                  <CreditCard className="h-3.5 w-3.5" aria-hidden="true" /> {cancelledWithoutPayment ? 'Storniert' : translatePaymentStatus(order.paymentStatus)}
                </span>
                <span className="admin-od-money">
                  Gesamt (brutto) <strong>{formatEUR(orderPriceBreakdown.grossTotal)}</strong>
                  {adminPaymentsState === 'loading' ? ' · Zahlungsstand wird geladen …' : adminPaymentsState === 'error' ? ' · Zahlungsstand nicht verfügbar' : ''}
                </span>
              </span>
            )}
          </button>
          <button
            type="button"
            className="admin-od-status-item admin-od-status-item--button"
            onClick={() => openAdminTabAndFocus('versand', 'admin-od-shipping')}
            aria-label="Einsendung – Versand öffnen"
          >
            <span className="admin-od-status-label">Einsendung (Kunde → McRepair)</span>
            <span className={`admin-od-pill is-${inboundChip.tone}`}><Send className="h-3.5 w-3.5" aria-hidden="true" /> {inboundChip.text}</span>
          </button>
          <button
            type="button"
            className="admin-od-status-item admin-od-status-item--button"
            onClick={() => openAdminTabAndFocus('versand', 'admin-od-shipping')}
            aria-label="Auslieferung – Versand öffnen"
          >
            <span className="admin-od-status-label">Auslieferung (McRepair → Kunde)</span>
            <span className={`admin-od-pill is-${outboundChip.tone}`}><Truck className="h-3.5 w-3.5" aria-hidden="true" /> {outboundChip.text}</span>
          </button>
        </div>

        {(canRunComplaintTechnicianActions || (isComplaintFollowupOrder && complaintWorkflowStatus === 'pending_approval' && latestDenyEscalationLog) || order.pickupConfirmation?.confirmedAt || orderRefundPendingTotal > 0.009 || orderRefundPendingScope.bookingLevel.length > 0) && (
          <div className="admin-od-header-notes">
              {canRunComplaintTechnicianActions && (
                <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 dark:border-rose-800 dark:bg-rose-950/30">
                  <span className="text-xs font-semibold text-rose-800 dark:text-rose-200">Reklamation entscheiden</span>
                  <Button
                    size="sm"
                    onClick={() => setComplaintActionDialog('ack')}
                    disabled={complaintActionLoading !== ''}
                    className="h-7 bg-green-600 px-2 text-xs text-white hover:bg-green-700"
                  >
                    <CheckCircle className="mr-1 h-3.5 w-3.5" />
                    Anerkennen
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setComplaintActionDialog('deny')}
                    disabled={complaintActionLoading !== ''}
                    className="h-7 border-rose-300 px-2 text-xs text-rose-700 hover:bg-rose-100 dark:border-rose-700 dark:text-rose-200 dark:hover:bg-rose-900/40"
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Ablehnen
                  </Button>
                </div>
              )}
              {isComplaintFollowupOrder && complaintWorkflowStatus === 'pending_approval' && latestDenyEscalationLog && (
                <div className="flex max-w-xl flex-col gap-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  <span className="font-semibold">Reklamation abgelehnt · Admin-Freigabe ausstehend</span>
                  <span>
                    {escalationActorName ? `Von ${escalationActorName}` : 'Durch den Techniker'}
                    {escalationCreatedAt ? ` am ${new Date(escalationCreatedAt).toLocaleString('de-DE')}` : ''}
                    {complaintWorkflow?.technicianReason ? `: ${complaintWorkflow.technicianReason}` : ''}
                  </span>
                </div>
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
              {orderRefundPendingTotal > 0.009 && (
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${INVOICE_PAYMENT_TONE_CLASSES.overpaid}`}>
                  Überzahlt · Erstattung offen {formatEUR(orderRefundPendingTotal)}
                </span>
              )}
              {orderRefundPendingScope.bookingLevel.map((entry) => (
                <span
                  key={`refund-badge-${entry.invoiceId}`}
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${INVOICE_PAYMENT_TONE_CLASSES.overpaid}`}
                  title="Die Rechnung umfasst mehrere Aufträge der Buchung; der Betrag gilt für die ganze Rechnung."
                >
                  Rechnung {entry.invoiceNumber || '–'} (mehrere Aufträge) überzahlt · Erstattung offen {formatEUR(entry.amount)}
                </span>
              ))}
          </div>
        )}

        <p className="admin-od-header-meta">
          Fortschritt {calculatedProgressValue} % · Leistungen: {serviceCount} · Zugewiesen: {staffCount ? `${staffCount} Mitarbeiter` : 'niemand'} · Zuletzt aktualisiert {lastUpdate}
        </p>
      </header>
    )
  }

  const renderAdminCustomerCard = () => (
    <Card id="order-customer" className="order-section-card">
      <CardHeader className="order-section-header">
        <CardTitle className="order-section-title">
          <User className="h-5 w-5" />
          Kunde
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="flex items-start gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={customer.avatar} />
            <AvatarFallback className="text-xs">{customerInitials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="font-semibold">{customer.name}{order.guestInfo?.isGuest ? ' (Gast)' : ''}</p>
            <p className="flex items-center gap-1 break-all"><Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{customer.email || '–'}</p>
            <p className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{customer.phone || '–'}</p>
            {!order.guestInfo?.isGuest && <p className="text-muted-foreground">{t('orderDetails.customerSince')} {customerSinceText}</p>}
          </div>
        </div>
        {customer.address && (
          <div className="mt-3 pt-3 border-t">
            <p className="font-medium flex items-center gap-1"><Home className="h-3.5 w-3.5" aria-hidden="true" />{t('orderDetails.address')}</p>
            <div className="text-muted-foreground mt-1 space-y-0.5">
              <p>{customer.address.street}</p>
              <p>{customer.address.zipCode} {customer.address.city}{customer.address.state ? `, ${customer.address.state}` : ''}</p>
              <p>{customer.address.country}</p>
            </div>
          </div>
        )}
        {customer.paymentMethods && customer.paymentMethods.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="font-medium flex items-center gap-1 mb-1"><CreditCard className="h-3.5 w-3.5" aria-hidden="true" />{t('orderDetails.paymentMethods')}</p>
            <div className="space-y-1">
              {customer.paymentMethods.slice(0, 2).map((method) => (
                <div key={`${method.type}-${method.last4}`} className="flex items-center justify-between">
                  <span>{PAYMENT_METHOD_LABELS_DE[method.type] || method.type} endet auf {method.last4}</span>
                  {method.isDefault && <Badge variant="secondary" className="text-xs px-1.5 py-0.5">{t('orderDetails.default', 'Standard')}</Badge>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const renderAdminCommunicationTab = () => (
    <div id="admin-od-communication" tabIndex={-1} className="admin-od-tab-panel space-y-3 focus:outline-none">
      <div className="admin-od-tab-intro">
        <div>
          <h2 className="admin-od-tab-title">Kommunikation</h2>
          <p className="admin-od-tab-description">
            Vollständiger Verlauf mit dem Kunden und interne Notizen des Teams. Wählen Sie über dem Eingabefeld,
            ob Sie dem Kunden schreiben („An Kunden“, mit E-Mail-Benachrichtigung) oder eine interne Notiz speichern
            („Intern – nur für das Team“).
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate(`/messages?thread=order:${order._id}`)}>
          <Inbox className="h-4 w-4 mr-1.5" aria-hidden="true" />
          Im Postfach öffnen
        </Button>
      </div>
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
                {formatEUR(safeToNumber(complaintWorkflow.repairOffer.amount))}
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
              {formatEUR(safeToNumber(complaintWorkflow.repairOffer.amount))} &bull;{' '}
              {complaintWorkflow.repairOffer.status === 'accepted' && complaintWorkflow.repairOffer.acceptedAt
                ? new Date(complaintWorkflow.repairOffer.acceptedAt).toLocaleDateString('de-DE')
                : complaintWorkflow.repairOffer.rejectedAt
                ? new Date(complaintWorkflow.repairOffer.rejectedAt).toLocaleDateString('de-DE')
                : ''}
            </p>
          </div>
        </div>
      )}


      {id && (
        <div className="admin-od-communication-panel">
          <CommunicationPanel
            orderId={id}
            variant="full"
            layout="inline"
            hideTitle
            feedbackOpen={commFeedbackOpen}
            onFeedbackOpenChange={setCommFeedbackOpen}
            quickActionOpen={commQuickActionOpen}
            onQuickActionOpenChange={setCommQuickActionOpen}
            onRead={() => setAdminCommunicationReloadToken((value) => value + 1)}
            onSent={() => setAdminCommunicationReloadToken((value) => value + 1)}
          />
        </div>
      )}
    </div>
  )

  const renderAdminFinanceTab = () => {
    const staffInvoices = Array.isArray(adminPayments?.invoices) ? adminPayments!.invoices : []
    const payments = Array.isArray(adminPayments?.payments) ? adminPayments!.payments : []
    const bookingIdForDialog = customerBookingIdForPayments
    return (
      <div className="admin-od-tab-panel space-y-4">
        <Card id="admin-od-finance" tabIndex={-1} className="order-section-card focus:outline-none">
          <CardHeader className="order-section-header">
            <CardTitle className="order-section-title">
              <Euro className="h-5 w-5" />
              Zahlungsstand
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              {user?.role === 'admin' && (
                <Button size="sm" onClick={handleCreateOrderInvoice} disabled={creatingOrderInvoice}>
                  <Receipt className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  {creatingOrderInvoice ? 'Rechnung wird erstellt…' : 'Rechnung erstellen'}
                </Button>
              )}
              {user?.role === 'admin' && bookingIdForDialog && (
                <Button size="sm" variant="outline" onClick={() => setBookingPaymentsDialogOpen(true)}>
                  <CreditCard className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  Zahlungen verwalten
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-3 space-y-3">
            <dl className="admin-od-money-grid">
              <div><dt>Gesamt (brutto) – dieser Auftrag</dt><dd>{formatEUR(orderPriceBreakdown.grossTotal)}</dd></div>
              {adminMoney ? (
                <>
                  <div><dt>Bezahlt</dt><dd>{formatEUR(adminMoney.received)}</dd></div>
                  <div><dt>Offen</dt><dd className={adminMoney.open > 0.009 ? 'text-red-700' : ''}>{formatEUR(adminMoney.open)}</dd></div>
                  {adminMoney.refundPending > 0.009 && (
                    <div><dt>Überzahlt · Erstattung offen</dt><dd className="text-violet-700">{formatEUR(adminMoney.refundPending)}</dd></div>
                  )}
                  {adminMoney.notInvoiced > 0.009 && (
                    <div><dt>Noch nicht berechnet</dt><dd>{formatEUR(adminMoney.notInvoiced)}</dd></div>
                  )}
                </>
              ) : null}
              {orderDiscountTotal > 0 && (
                <div><dt>Rabatt (im Gesamt enthalten)</dt><dd className="text-green-700">−{formatEUR(orderDiscountTotal)}</dd></div>
              )}
              <div><dt>Netto</dt><dd>{formatEUR(orderPriceBreakdown.netTotal)}</dd></div>
              <div><dt>MwSt. ({orderTaxRateLabel})</dt><dd>{formatEUR(orderPriceBreakdown.taxAmount)}</dd></div>
            </dl>
            {adminMoneyIsBookingWide && adminMoney && (
              <p className="text-xs text-muted-foreground">
                Bezahlt und Offen gelten für die gesamte Buchung{adminBookingNumber ? ` ${adminBookingNumber}` : ''}
                {adminBookingOrderCount > 1 ? ` (${adminBookingOrderCount} Geräte, ` : ' ('}Gesamt {formatEUR(adminMoney.bookingTotal)}).
              </p>
            )}
            {!adminMoney && (
              adminPaymentsState === 'loading' ? (
                <p className="text-muted-foreground" role="status">Zahlungsstand wird geladen …</p>
              ) : adminPaymentsState === 'error' ? (
                <p className="text-red-700">
                  Zahlungsstand konnte nicht geladen werden.{' '}
                  <Button size="sm" variant="outline" onClick={() => setAdminPaymentsReloadToken((value) => value + 1)}>Erneut versuchen</Button>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  {customerBookingIdForPayments ? 'Zahlungsstand nicht verfügbar.' : 'Kein Zahlungsstand: Für diesen Auftrag ohne Buchung gibt es noch keine Rechnung.'}
                </p>
              )
            )}
          </CardContent>
        </Card>

        <Card id="admin-od-invoices" tabIndex={-1} className="order-section-card focus:outline-none">
          <CardHeader className="order-section-header">
            <CardTitle className="order-section-title">
              <FileText className="h-5 w-5" />
              Rechnungen &amp; Gutschriften
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            {user?.role === 'admin' ? (
              loadingOrderInvoices ? (
                <p className="text-muted-foreground" role="status">Rechnungen werden geladen …</p>
              ) : orderInvoicesError ? (
                <p className="text-red-700">
                  Rechnungen konnten nicht geladen werden.{' '}
                  <Button size="sm" variant="outline" onClick={() => void loadOrderInvoices(String(order._id), customerBookingIdForPayments || null)}>Erneut versuchen</Button>
                </p>
              ) : orderInvoices.length > 0 ? (
                <ul className="space-y-2">
                  {orderInvoices.map((invoice) => {
                    const payment = summarizeInvoicePayment(invoice as any)
                    return (
                      <li key={invoice._id}>
                        <button
                          type="button"
                          onClick={() => void openInvoiceDetailsDialog(invoice)}
                          className="admin-od-invoice-row"
                        >
                          <span className="min-w-0 space-y-1">
                            <span className="flex items-center gap-1.5 font-semibold text-[#1a2a5e]">
                              <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                              {(invoice as any).isCreditNote ? 'Gutschrift' : 'Rechnung'} {invoice.invoiceNumber || invoice._id}
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs font-medium">{getInvoiceScopeLabel(invoice)}</Badge>
                              <Badge className={`text-xs font-medium ${getInvoiceStatusBadgeClass(invoice.status)}`}>{translateInvoiceStatus(invoice.status)}</Badge>
                              {payment.known && <Badge className={`text-xs font-medium ${INVOICE_PAYMENT_TONE_CLASSES[payment.tone]}`}>{payment.label}</Badge>}
                              <span>Datum: {formatInvoiceDate(invoice.createdAt)}</span>
                            </span>
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            <strong>{formatEUR((invoice as any).total)}</strong>
                            <span className="text-xs text-[#1a2a5e] underline">Details ansehen</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-muted-foreground">Noch keine Rechnung für diesen Auftrag bzw. die zugehörige Buchung erstellt.</p>
              )
            ) : staffInvoices.length > 0 ? (
              <ul className="space-y-2">
                {staffInvoices.map((invoice) => (
                  <li key={invoice._id} className="admin-od-invoice-row is-static">
                    <span className="font-semibold text-[#1a2a5e]">{invoice.isCreditNote ? 'Gutschrift' : 'Rechnung'} {invoice.invoiceNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {translateInvoiceStatus(invoice.status)} · Gesamt {formatEUR(invoice.total)}
                      {!invoice.isCreditNote ? ` · Offen ${formatEUR(invoice.openAmount)}` : ''}
                    </span>
                  </li>
                ))}
                <li className="text-xs text-muted-foreground">Rechnungsdetails und PDFs sind für Administratoren freigegeben.</li>
              </ul>
            ) : adminPaymentsState === 'loading' ? (
              <p className="text-muted-foreground" role="status">Rechnungen werden geladen …</p>
            ) : (
              <p className="text-muted-foreground">Noch keine Rechnung zu dieser Buchung. Rechnungsdetails sind für Administratoren freigegeben.</p>
            )}
          </CardContent>
        </Card>

        <Card id="admin-od-payments" tabIndex={-1} className="order-section-card focus:outline-none">
          <CardHeader className="order-section-header">
            <CardTitle className="order-section-title">
              <CreditCard className="h-5 w-5" />
              Zahlungseingänge{adminBookingNumber ? ` der Buchung ${adminBookingNumber}` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            {!customerBookingIdForPayments ? (
              <p className="text-muted-foreground">Zahlungen werden je Buchung erfasst; dieser Auftrag hat keine Buchung. Zahlungen der Rechnungen siehe „Details ansehen“.</p>
            ) : adminPaymentsState === 'loading' && !adminPayments ? (
              <p className="text-muted-foreground" role="status">Zahlungen werden geladen …</p>
            ) : adminPaymentsState === 'error' ? (
              <p className="text-red-700">
                Zahlungen konnten nicht geladen werden.{' '}
                <Button size="sm" variant="outline" onClick={() => setAdminPaymentsReloadToken((value) => value + 1)}>Erneut versuchen</Button>
              </p>
            ) : payments.length === 0 ? (
              <p className="text-muted-foreground">Noch keine Zahlung eingegangen.</p>
            ) : (
              <ul className="divide-y">
                {payments.map((payment) => (
                  <li key={payment._id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                    <span className="min-w-0 space-y-0.5">
                      <span className="block font-medium">{PAYMENT_METHOD_LABELS_DE[payment.paymentMethod] || payment.paymentMethod} · {formatDateTimeDe(payment.paymentDate)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {payment.allocations?.length
                          ? payment.allocations.map((allocation) => `Rechnung ${allocation.invoiceNumber}: ${formatEUR(allocation.allocatedAmount)}`).join(' · ')
                          : 'Vorauszahlung (noch keiner Rechnung zugeordnet)'}
                        {payment.status && payment.status !== 'completed' ? ` · Status: ${payment.status === 'refunded' ? 'erstattet' : payment.status === 'pending' ? 'ausstehend' : payment.status}` : ''}
                      </span>
                    </span>
                    <span className="text-right">
                      <strong className="block">{formatEUR(payment.amount)}</strong>
                      {safeToNumber(payment.refundAmount) > 0.009 && (
                        <span className="block text-xs text-violet-700">davon erstattet {formatEUR(safeToNumber(payment.refundAmount))}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderAdminShippingTab = () => {
    const inboundSourceLabel = (() => {
      switch (inboundShipment?.source) {
        case 'booking':
          return `Einsendelabel der Buchung${adminBookingNumber ? ` ${adminBookingNumber}` : ''} (ein Paket für alle Geräte der Buchung)`
        case 'booking-retoure':
          return `DHL-Retoure der Buchung${adminBookingNumber ? ` ${adminBookingNumber}` : ''}`
        case 'order':
          return 'DHL-Retoure am Auftrag'
        default:
          return ''
      }
    })()
    // K11: Absender/Empfänger je Richtung - vom Server aus denselben Quellen wie die
    // Label-Erstellung (Shop: DHL-Integration; Kunde: Liefer- bzw. Rechnungsadresse).
    // Fehlt etwas, wird es benannt, nie geraten.
    const ADDRESS_FIELDS = ['Straße', 'Hausnummer', 'PLZ', 'Ort', 'Lieferadresse', 'Packstationsnummer (3 Ziffern)', 'Postnummer (6 bis 10 Ziffern)', 'aktive DHL-Integration']
    const renderParty = (party: ShipmentPartyView | undefined, slot: string, roleLabel: 'Absender' | 'Empfänger') => {
      const who = party?.role === 'shop' ? 'McRepair' : 'Kunde'
      const missing = Array.isArray(party?.missing) ? party.missing : []
      const addressMissing = missing.some((field) => ADDRESS_FIELDS.includes(field))
      const country = String(party?.country || '').trim()
      const streetLine = party?.deliveryType === 'packstation'
        ? [party.packstationNumber ? `Packstation ${party.packstationNumber}` : '', party.postNumber ? `Postnummer ${party.postNumber}` : ''].filter(Boolean).join(' · ')
        : [party?.street, party?.house].filter(Boolean).join(' ')
      const cityLine = [party?.postalCode, party?.city].filter(Boolean).join(' ')
      return (
        <div className="admin-od-party" data-party={slot}>
          <span className="admin-od-party-role">{roleLabel}</span>
          <div className="admin-od-party-body">
            <span className="admin-od-party-name">
              <span className="admin-od-party-who">{who}</span>
              {party?.name ? ` ${party.name}` : ''}
            </span>
            {streetLine ? <span>{streetLine}</span> : null}
            {cityLine ? <span>{cityLine}</span> : null}
            {country && !['DE', 'DEU', 'Deutschland'].includes(country) ? <span>{country}</span> : null}
            {!party ? (
              <span className="admin-od-party-missing" role="note">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Adresse fehlt – bitte prüfen
              </span>
            ) : missing.length > 0 ? (
              <span className="admin-od-party-missing" role="note">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {addressMissing ? 'Adresse fehlt – bitte prüfen' : 'Angabe fehlt – bitte prüfen'} (fehlt: {missing.join(', ')})
                {party.role === 'shop' ? ' – Systemkonfiguration → Integrationen → DHL' : ''}
              </span>
            ) : null}
            {party?.sourceLabel ? <span className="admin-od-party-source">Quelle: {party.sourceLabel}</span> : null}
          </div>
        </div>
      )
    }
    const renderShipmentParties = (direction: 'inbound' | 'outbound') => {
      if (!orderShipments) return null
      const parties = orderShipments.parties?.[direction]
      if (!parties) {
        return <p className="text-xs text-muted-foreground" data-party={`${direction}-unavailable`}>Absender und Empfänger konnten nicht geladen werden.</p>
      }
      const labelExists = direction === 'outbound' ? outboundLabelExists : inboundLabelExists
      return (
        <div className="admin-od-parties" role="group" aria-label={`Absender und Empfänger – ${direction === 'outbound' ? 'Auslieferung (McRepair → Kunde)' : 'Einsendung (Kunde → McRepair)'}`}>
          {renderParty(parties.sender, `${direction}-sender`, 'Absender')}
          {renderParty(parties.recipient, `${direction}-recipient`, 'Empfänger')}
          {labelExists ? (
            <p className="admin-od-party-note">Anschriften aus den aktuellen Stammdaten – maßgeblich ist das bereits erstellte Label.</p>
          ) : null}
        </div>
      )
    }
    return (
      <div id="admin-od-shipping" tabIndex={-1} className="admin-od-tab-panel space-y-3 focus:outline-none">
        {(inboundIsPlaceholder || outboundIsPlaceholder) && (
          <div className="admin-od-banner is-warn" role="note">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>Testmodus – Dummy-Label (kein echtes DHL-Label).</strong>{' '}
              Dieses Label darf nicht für den Versand verwendet werden. Echte Labels entstehen erst mit dem
              Buchungslabel-Modus „live“ (Systemkonfiguration → Integrationen → DHL).
            </span>
          </div>
        )}
        {shipmentsLoadError && (
          <div className="admin-od-banner is-error" role="alert">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Versandstand konnte nicht geladen werden.</span>
            <Button size="sm" variant="outline" onClick={() => void loadOrderShipments(String(order._id))}>Erneut versuchen</Button>
          </div>
        )}
        <div className="admin-od-shipping-grid">
          <section className="admin-od-shipping-card" aria-labelledby="admin-od-inbound-title">
            <h2 id="admin-od-inbound-title" className="admin-od-shipping-title">
              <Send className="h-5 w-5" aria-hidden="true" />
              Einsendung <span className="admin-od-direction">Kunde → McRepair</span>
            </h2>
            {renderShipmentParties('inbound')}
            <dl className="admin-od-shipping-facts">
              <div><dt>Status</dt><dd>{describeShipmentChip('inbound').text}</dd></div>
              {inboundSourceLabel ? <div><dt>Label</dt><dd>{inboundSourceLabel}</dd></div> : null}
              {inboundShipment?.trackingNumber ? (
                <div>
                  <dt>Sendungsnummer</dt>
                  <dd>
                    {inboundIsPlaceholder ? (
                      <span>{inboundShipment.trackingNumber} <Badge variant="outline" className="ml-1 border-amber-400 text-amber-800">Testlabel</Badge></span>
                    ) : (
                      <a href={buildDhlTrackingUrl(inboundShipment.trackingNumber)} target="_blank" rel="noreferrer" className="underline">
                        {inboundShipment.trackingNumber}
                      </a>
                    )}
                  </dd>
                </div>
              ) : null}
              {inboundShipment?.statusDescription ? <div><dt>DHL-Status</dt><dd>{inboundShipment.statusDescription}</dd></div> : null}
            </dl>
            <div className="flex flex-wrap gap-2">
              {inboundDownloadable ? (
                <Button size="sm" variant="outline" onClick={() => void handleDownloadInboundLabel()} disabled={downloadingOrderReturnLabel}>
                  <Download className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  {downloadingOrderReturnLabel
                    ? 'Einsendelabel wird heruntergeladen…'
                    : inboundIsPlaceholder ? 'Testlabel herunterladen (PDF)' : 'Einsendelabel herunterladen (PDF)'}
                </Button>
              ) : null}
              {!inboundLabelExists && (
                <Button
                  size="sm"
                  onClick={() => void handleCreateInboundLabel()}
                  disabled={creatingOrderReturnLabel || !inboundAction?.allowed}
                  className="admin-od-action-primary"
                >
                  <Send className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  {creatingOrderReturnLabel ? 'Einsendelabel wird erstellt…' : 'DHL-Einsendelabel erstellen'}
                </Button>
              )}
            </div>
            {inboundAction?.reason ? <p className="text-xs text-muted-foreground">{inboundAction.reason}</p> : null}
            {(inboundShipment as { lockScope?: string } | undefined)?.lockScope === 'booking' && (
              <p className="text-xs text-muted-foreground">
                Die Sperre liegt an der Buchung{adminBookingNumber ? ` ${adminBookingNumber}` : ''}: Sie gilt für alle Geräte dieser Buchung; der Abgleich wird an der Buchung gespeichert.
              </p>
            )}
            {renderShipmentLockPanel('inbound')}
            {orderShipments?.legacy?.inboundInOutboundSlot && (
              <p className="text-xs text-amber-800">
                <AlertTriangle className="inline h-3 w-3 mr-1" aria-hidden="true" />
                Altbestand: Ein Einsendelabel steht im Versandfeld des Auftrags. Es wird hier als Einsendung gezeigt.
              </p>
            )}
          </section>

          <section className="admin-od-shipping-card" aria-labelledby="admin-od-outbound-title">
            <h2 id="admin-od-outbound-title" className="admin-od-shipping-title">
              <Truck className="h-5 w-5" aria-hidden="true" />
              Auslieferung <span className="admin-od-direction">McRepair → Kunde</span>
            </h2>
            {renderShipmentParties('outbound')}
            <dl className="admin-od-shipping-facts">
              <div><dt>Status</dt><dd>{describeShipmentChip('outbound').text}</dd></div>
              {outboundShipment?.trackingNumber ? (
                <div>
                  <dt>Sendungsnummer</dt>
                  <dd>
                    {outboundIsPlaceholder ? (
                      <span>{outboundShipment.trackingNumber} <Badge variant="outline" className="ml-1 border-amber-400 text-amber-800">Testlabel</Badge></span>
                    ) : (
                      <a href={buildDhlTrackingUrl(outboundShipment.trackingNumber)} target="_blank" rel="noreferrer" className="underline">
                        {outboundShipment.trackingNumber}
                      </a>
                    )}
                  </dd>
                </div>
              ) : null}
              {outboundShipment?.statusDescription ? <div><dt>DHL-Status</dt><dd>{outboundShipment.statusDescription}</dd></div> : null}
              {outboundShipment?.actualDelivery ? <div><dt>Zugestellt am</dt><dd>{formatDateTimeDe(outboundShipment.actualDelivery)}</dd></div> : null}
            </dl>
            <div className="flex flex-wrap gap-2">
              {outboundShipment?.hasLabel ? (
                <Button size="sm" variant="outline" onClick={() => void handleDownloadOrderShippingLabel()} disabled={downloadingOrderShippingLabel}>
                  <Download className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  {downloadingOrderShippingLabel ? 'Versandlabel wird heruntergeladen…' : 'Versandlabel herunterladen (PDF)'}
                </Button>
              ) : null}
              {!outboundLabelExists && (
                <Button
                  size="sm"
                  onClick={() => void handleCreateOutboundLabel()}
                  disabled={creatingOrderShippingLabel || !outboundAction?.allowed}
                  className="admin-od-action-secondary"
                >
                  <Truck className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  {creatingOrderShippingLabel ? 'Versandlabel wird erstellt…' : 'An Kunden versenden'}
                </Button>
              )}
            </div>
            {outboundActionHint ? <p className="text-xs text-muted-foreground">{outboundActionHint}</p> : null}
            {!outboundShipment?.hasLabel && outboundShipment?.trackingNumber ? (
              <p className="text-xs text-muted-foreground">
                Auslieferung angelegt (Sendungsnummer {outboundShipment.trackingNumber}), das PDF-Label bitte im DHL-Geschäftskundenportal abrufen.
              </p>
            ) : null}
            {renderShipmentLockPanel('outbound')}
            {orderShipments?.legacy?.bookingOutboundLabel && (
              <p className="text-xs text-amber-800">
                <AlertTriangle className="inline h-3 w-3 mr-1" aria-hidden="true" />
                An der Buchung existiert bereits ein älteres Rückweg-Label (Sendungsnummer {orderShipments.legacy.bookingOutboundLabel.trackingNumber}). Bitte prüfen, ob dieses Gerät damit schon verschickt wurde.
              </p>
            )}
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className={`order-details-container ${isStaffOrAdmin ? 'admin-order-workspace' : 'customer-order-workspace'}`}>
      <SEO
        title="Auftragsdetails – McRepair.de Kundenportal"
        description="Detailansicht Ihres Reparaturauftrags: Status, Fotos, Nachrichten und Rechnung – alles in Ihrem McRepair.de Kundenportal."
        canonical="/orders"
        noindex={true}
      />
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
      {isStaffOrAdmin ? renderAdminHeader() : (
      <div className="order-details-header">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="order-header-title-block">
            {order.isComplaintFollowup && (
              <p style={{ color: '#dc2626', fontWeight: 700, margin: 0 }}>
                Reklamationsauftrag
              </p>
            )}
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
                  <p>
                    Auftrag {customerOrderRef}
                    {customerBookingNumber ? <> · Buchung {customerBookingNumber}</> : null}
                    {' '}· Erstellt am {orderCreatedText}
                  </p>
                </div>
              </div>
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
                  <span className="font-medium">Nicht verknüpft</span>
                )}
              </div>
            )}
            {!isComplaintFollowupOrder && order.hasComplaint && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge className="bg-rose-100 text-rose-800 border border-rose-300" variant="outline">
                  Reklamation vorhanden
                </Badge>
                <span className="text-muted-foreground">Reklamationsauftrag:</span>
                {complaintOrderId ? (
                  <Link
                    to={`/orders/${complaintOrderId}`}
                    className="font-medium text-blue-600 underline"
                  >
                    {complaintOrderNumber || complaintOrderId}
                  </Link>
                ) : (
                  <span className="font-medium">Noch nicht erstellt</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap order-header-meta-block">
              <span className={`order-status-badge ${getStatusColor(order.status)} text-xs px-3 py-1`}>
                {getStatusIcon(order.status)}
                <span className="ml-1">{currentOrderStatusLabel}</span>
              </span>
            {isComplaintFollowupOrder && complaintWorkflowStatus === 'pending_approval' && latestDenyEscalationLog && (
              <div className="flex max-w-xl flex-col gap-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <span className="font-semibold">Reklamation abgelehnt · Admin-Freigabe ausstehend</span>
                <span>
                  {escalationActorName ? `Von ${escalationActorName}` : 'Durch den Techniker'}
                  {escalationCreatedAt ? ` am ${new Date(escalationCreatedAt).toLocaleString('de-DE')}` : ''}
                  {complaintWorkflow?.technicianReason ? `: ${complaintWorkflow.technicianReason}` : ''}
                </span>
              </div>
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
            {showOutboundFulfilmentBadge && (
              <span
                className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
                title="Auslieferung an den Kunden (McRepair → Kunde)"
              >
                <Truck className="h-3 w-3 mr-1" />
                Auslieferung: {getShipmentStatusMeta(outboundFulfilmentStatus).label}
              </span>
            )}
            {!isStaffOrAdmin && (order.hasComplaint || order.complaintId) && (
              order.complaintId ? (
                <Link to={`/my-complaints/${order.complaintId}`}>
                  <Badge
                    variant="outline"
                    className="cursor-pointer border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50"
                  >
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Reklamation angefragt{order.complaintStatus ? ` · ${getComplaintStatusLabel(order.complaintStatus)}` : ''}
                  </Badge>
                </Link>
              ) : (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Reklamation angefragt
                </Badge>
              )
            )}
            {!isStaffOrAdmin && order.status === 'completed' && !order.hasComplaint && !order.complaintId && (
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

      </div>
      )}

      {!isStaffOrAdmin ? (
        renderCustomerLayout()
      ) : (
        <Tabs value={adminTab} onValueChange={(value) => setAdminTab(value as AdminOrderTab)} className="admin-od-tabs">
          <TabsList className="admin-od-tablist" aria-label="Bereiche des Auftrags">
            <TabsTrigger value="uebersicht" className="admin-od-tab">Übersicht</TabsTrigger>
            <TabsTrigger value="kommunikation" className="admin-od-tab">
              Kommunikation
              {adminCommunicationCounts && adminCommunicationCounts.unread > 0 ? (
                <span className="admin-od-tab-badge is-alert">{adminCommunicationCounts.unread} ungelesen</span>
              ) : adminCommunicationCounts?.awaitingReply ? (
                <span className="admin-od-tab-badge is-alert">Antwort ausstehend</span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="verlauf" className="admin-od-tab">
              Verlauf
              {adminHistoryTotal !== null ? <span className="admin-od-tab-badge">{adminHistoryTotal}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="rechnungen" className="admin-od-tab">
              Rechnungen &amp; Zahlungen
              {adminMoney && adminMoney.refundPending > 0.009 ? (
                <span className="admin-od-tab-badge is-alert">Erstattung offen</span>
              ) : adminMoney && adminMoney.open > 0.009 ? (
                <span className="admin-od-tab-badge">Offen {formatEUR(adminMoney.open)}</span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="versand" className="admin-od-tab">
              Versand
              {(inboundShipment?.reconciliationRequired || outboundShipment?.reconciliationRequired) ? (
                <span className="admin-od-tab-badge is-alert">Abgleich nötig</span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="uebersicht" className="admin-od-tab-content">
            <div className="admin-od-overview">
              <div className="admin-od-overview-main">
              {renderDeviceInformationCard()}

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

                {renderOrderPriceBreakdown()}
                  </div>
                </CardContent>
              </Card>

              {renderEPartsCard()}
              {renderWorkflowsCard()}
              </div>
              <div className="admin-od-overview-side">
              {renderRepairProgressCard()}
              {renderDeviceInspectionCard()}

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
                      {availableStaff.map((staff) => {
                        const isSelected = selectedStaff.includes(staff._id)

                        return (
                          <div
                            key={staff._id}
                            className={`flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${isSelected ? 'bg-muted/60 border-primary/50' : ''}`}
                            onClick={() => handleStaffToggle(staff._id, !isSelected)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                handleStaffToggle(staff._id, !isSelected)
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                          >
                            <Checkbox
                              id={staff._id}
                              checked={isSelected}
                              onClick={(event) => event.stopPropagation()}
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
                                      <span>Aktive Aufträge: {staff.currentWorkload.assignedOrders}/{staff.currentWorkload.capacity}</span>
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        staff.currentWorkload.utilizationRate > 80 ? 'bg-red-100 text-red-800' :
                                        staff.currentWorkload.utilizationRate > 60 ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-green-100 text-green-800'
                                      }`}>
                                        {staff.currentWorkload.utilizationRate} % ausgelastet
                                      </span>
                                    </div>
                                    {staff.currentWorkload.assignedTasks !== undefined && (
                                      <div>Aktive Aufgaben: {staff.currentWorkload.assignedTasks}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleStaffAssignment}
                        disabled={selectedStaff.length === 0 || assigningStaff}
                        size="sm"
                      >
                        {assigningStaff ? t('orderDetails.assigning', 'Wird zugewiesen …') : t('orderDetails.assignStaff')}
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
                              <span className="font-medium text-foreground/70">{translateOrderStatus(String(lastEntry.status || ''))}:</span>{' '}
                              <span className="break-words">{lastEntry.description ? translateOrderDescription(lastEntry.description) : ''}</span>
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


              {renderAdminCustomerCard()}
              </div>
            </div>
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
          </TabsContent>

          <TabsContent value="kommunikation" className="admin-od-tab-content">
            {adminTab === 'kommunikation' ? renderAdminCommunicationTab() : null}
          </TabsContent>

          <TabsContent value="verlauf" className="admin-od-tab-content">
            <div id="order-history" className="admin-od-tab-panel">
              <div className="admin-od-tab-intro">
                <div>
                  <h2 className="admin-od-tab-title">Verlauf</h2>
                  <p className="admin-od-tab-description">
                    Alle Änderungen am Auftrag mit Zeitpunkt, Person, Quelle und Grund. Über den Filter grenzen Sie die
                    Einträge ein; Verknüpfungen öffnen die zugehörige Rechnung, Zahlung, Prüfung oder Sendung.
                  </p>
                </div>
              </div>
              <OrderHistoryPanel
                orderId={String(order._id)}
                refreshToken={order.updatedAt}
                onOpenLink={handleAdminHistoryLink}
                onTotalChange={setAdminHistoryTotal}
              />
            </div>
          </TabsContent>

          <TabsContent value="rechnungen" className="admin-od-tab-content">
            {renderAdminFinanceTab()}
          </TabsContent>

          <TabsContent value="versand" className="admin-od-tab-content">
            {renderAdminShippingTab()}
          </TabsContent>
        </Tabs>
      )}

      {isStaffOrAdmin && (
        <OrderCancelDialog
          open={orderCancelDialogOpen}
          onOpenChange={setOrderCancelDialogOpen}
          orderId={String(order._id)}
          orderNumber={order.orderNumber}
          onCancelled={() => { void refreshOrder() }}
        />
      )}
      {isStaffOrAdmin && user?.role === 'admin' && order.status === 'cancelled' && (
        <OrderCancelDialog
          mode="reopen"
          open={orderReopenDialogOpen}
          onOpenChange={setOrderReopenDialogOpen}
          orderId={String(order._id)}
          orderNumber={order.orderNumber}
          onCancelled={() => { void refreshOrder() }}
        />
      )}

      {isStaffOrAdmin && customerBookingIdForPayments && user?.role === 'admin' && (
        <BookingPaymentsDialog
          open={bookingPaymentsDialogOpen}
          onOpenChange={setBookingPaymentsDialogOpen}
          bookingId={customerBookingIdForPayments}
          bookingNumber={adminBookingNumber || undefined}
          onChanged={() => {
            setAdminPaymentsReloadToken((value) => value + 1)
            void loadOrderInvoices(String(order._id), customerBookingIdForPayments || null)
          }}
        />
      )}

      <Dialog open={invoiceDetailsDialogOpen} onOpenChange={(open) => {
        setInvoiceDetailsDialogOpen(open)
        if (!open) {
          setSelectedInvoiceDetails(null)
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="bg-[#1a2a5e] px-6 py-4 rounded-t-lg border-b border-[#0f1d45]">
            <DialogTitle className="flex items-center gap-2 text-xl" style={{ color: '#f5c800' }}>
              <FileText className="h-5 w-5" />
              Rechnungsdetails
              {selectedInvoiceDetails?.invoiceNumber && (
                <span className="text-base font-normal text-[#c8d0e7]">· {selectedInvoiceDetails.invoiceNumber}</span>
              )}
            </DialogTitle>
            <DialogDescription className="text-[#c8d0e7]">
              Vollständige Detailansicht inklusive Zahlungen und zugehöriger Gutschriften.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4">
            {invoiceDetailLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Lade Rechnungsdetails…
              </div>
            ) : selectedInvoiceDetails ? (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rechnungsnummer</div>
                    <div className="mt-1 font-semibold text-[#1a2a5e]">{selectedInvoiceDetails.invoiceNumber}</div>
                  </div>
                  <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px] font-medium leading-none">
                        {translateInvoiceStatus(selectedInvoiceDetails.status)}
                      </Badge>
                      {selectedInvoiceDetailsPayment.known && (
                        <Badge className={`text-[10px] font-medium leading-none ${INVOICE_PAYMENT_TONE_CLASSES[selectedInvoiceDetailsPayment.tone]}`}>
                          {selectedInvoiceDetailsPayment.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Gesamt</div>
                    <div className="mt-1 font-semibold text-[#1a2a5e]">{formatEUR(selectedInvoiceDetails.total)}</div>
                  </div>
                  <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Offen</div>
                    {selectedInvoiceDetailsPayment.known ? (
                      <>
                        <div className={`mt-1 font-semibold ${(selectedInvoiceDetailsPayment.open ?? 0) > 0 ? 'text-red-700' : 'text-[#1a2a5e]'}`}>
                          {formatEUR(selectedInvoiceDetailsPayment.open ?? 0)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">Eingegangen: {formatEUR(selectedInvoiceDetailsPayment.received ?? 0)}</div>
                        {(selectedInvoiceDetailsPayment.refundPending ?? 0) > 0 && (
                          <div className="text-[11px] font-medium text-violet-700">Überzahlt · Erstattung offen {formatEUR(selectedInvoiceDetailsPayment.refundPending ?? 0)}</div>
                        )}
                      </>
                    ) : (
                      <div className="mt-1 text-xs text-muted-foreground">{invoiceDetailLoading ? 'Wird geladen…' : 'Zahlungsstand nicht verfügbar'}</div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-md border border-[#d8dce6] bg-white p-3">
                    <div className="mb-2 text-sm font-semibold text-[#1a2a5e]">Kunde</div>
                    <div className="space-y-1 text-sm">
                      <div>{selectedInvoiceDetails.customerName || '-'}</div>
                      <div className="text-muted-foreground">{selectedInvoiceDetails.customerEmail || '-'}</div>
                    </div>
                  </div>

                  <div className="rounded-md border border-[#d8dce6] bg-white p-3">
                    <div className="mb-2 text-sm font-semibold text-[#1a2a5e]">Rechnung</div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div>Erstellt: {selectedInvoiceDetails.createdAt ? new Date(selectedInvoiceDetails.createdAt).toLocaleDateString('de-DE') : '-'}</div>
                      <div>Fällig: {selectedInvoiceDetails.dueDate ? new Date(selectedInvoiceDetails.dueDate).toLocaleDateString('de-DE') : '-'}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="mb-2 text-sm font-semibold text-[#1a2a5e]">Positionen</div>
                  {selectedInvoiceDetails.items && selectedInvoiceDetails.items.length > 0 ? (
                    <div className="space-y-2 text-sm">
                      {selectedInvoiceDetails.items.map((item) => (
                        <div key={item._id} className="flex items-center justify-between gap-3 border-b border-[#e5e7eb] pb-2 last:border-b-0 last:pb-0">
                          <div>
                            <div className="font-medium text-slate-800">{item.description}</div>
                            <div className="text-xs text-muted-foreground">{translateInvoiceItemType(item.type)} • {item.quantity}×</div>
                          </div>
                          <div className="font-medium text-slate-800">{formatEUR(item.total || 0)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Keine Positionen vorhanden.</div>
                  )}
                </div>

                <div className="rounded-md border border-[#d8dce6] bg-white p-3">
                  <div className="mb-2 text-sm font-semibold text-[#1a2a5e]">Zahlungen</div>
                  {invoiceDetailPayments.length > 0 ? (
                    <div className="space-y-2 text-sm">
                      {invoiceDetailPayments.map((payment) => (
                        <div key={payment._id} className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <div>
                            <div className="font-medium text-slate-800">{translatePaymentMethodLabel(payment.paymentMethod)}</div>
                            <div className="text-xs text-muted-foreground">{translatePaymentRecordStatus(payment.status)}</div>
                          </div>
                          <div className="font-semibold text-slate-800">{formatEUR(Number(payment.amount || 0))}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Noch keine Zahlungen verzeichnet.</div>
                  )}
                </div>

                {invoiceDetailCreditNotes.length > 0 && (
                  <div className="rounded-md border border-[#d8dce6] bg-white p-3">
                    <div className="mb-2 text-sm font-semibold text-[#1a2a5e]">Gutschriften</div>
                    <div className="space-y-2 text-sm">
                      {invoiceDetailCreditNotes.map((note) => (
                        <div key={String(note._id)} className="flex items-center justify-between gap-3 rounded border border-violet-200 bg-violet-50 px-3 py-2">
                          <div>
                            <div className="font-medium text-violet-800">{note.invoiceNumber || 'Gutschrift'}</div>
                            <div className="text-xs text-violet-700">{translateInvoiceStatus(note.status)}</div>
                          </div>
                          <div className="font-semibold text-violet-800">{formatEUR(Number(note.total || 0))}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">Keine Rechnungsdetails verfügbar.</div>
            )}
          </div>

          <DialogFooter className="bg-[#f8f9fc] border-t border-[#d8dce6] px-6 py-3 flex-wrap gap-2 rounded-b-lg">
            <Button className="bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800] border border-[#1a2a5e]" onClick={() => setInvoiceDetailsDialogOpen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={complaintDialogOpen} onOpenChange={setComplaintDialogOpen}>
        <DialogContent className="w-[calc(100vw-12px)] sm:max-w-lg max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reklamation anmelden</DialogTitle>
            <DialogDescription>
              Bitte gib den Grund und eine kurze Beschreibung an. Diese Reklamation wird an das Admin-Team weitergeleitet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="order-complaint-reason">Reklamationsgrund</Label>
              <Input
                id="order-complaint-reason"
                value={complaintReason}
                onChange={(e) => setComplaintReason(e.target.value)}
                placeholder="z. B. Display flackert wieder"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order-complaint-description">Beschreibung</Label>
              <Textarea
                id="order-complaint-description"
                value={complaintDescription}
                onChange={(e) => setComplaintDescription(e.target.value)}
                placeholder="Beschreibung des Problems"
                rows={5}
              />
            </div>
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
            <DialogDescription>Bitte Grund auswählen oder individuell angeben.</DialogDescription>
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
                <SelectItem value="none">Bitte auswählen</SelectItem>
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
              <span>{user?.role === 'admin' ? 'Reklamation ablehnen bestätigen' : 'Reklamation ablehnen'}</span>
              <Badge className="bg-rose-100 text-rose-800 border border-rose-300 text-xs font-normal flex-shrink-0" variant="outline">Reparaturangebot erforderlich</Badge>
            </DialogTitle>
            <DialogDescription>
              {user?.role === 'admin'
                ? 'Bitte Ablehnungsgrund und Reparaturangebot prüfen. Nach Bestätigung wird das Angebot an den Kunden gesendet.'
                : 'Bitte den Ablehnungsgrund angeben. Danach wird die Reklamation zur Admin-Prüfung eskaliert.'}
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
                <p className="text-amber-800">Betrag: {formatEUR(Number(escalationOfferAmount))}</p>
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
                  <SelectItem value="none">Bitte auswählen...</SelectItem>
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
                : 'Ablehnen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Device Inspection Dialog */}
      {id && order && isStaffOrAdmin && (
        <Dialog
          open={inspectionDialogOpen}
          onOpenChange={(open) => {
            setInspectionDialogOpen(open)
            if (!open) {
              setForceInspectionStepOne(false)
            }
          }}
        >
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
                  {generatingInspectionReport ? "Wird erstellt …" : "Prüfbericht"}
                </Button>
              </div>
            </DialogHeader>

            <div className="inspection-dialog-main min-h-0 flex-1">
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
                    ? repairServices
                      .map((service: any) => service?.serviceId?.name || service?.name || service?.serviceName || service?.title || 'Service')
                      .join(', ')
                    : 'Nicht verfügbar'}
                </span>
                <span className="inspection-dialog-context-chip">
                  <strong>Summe:</strong> {formatEUR(orderPriceBreakdown.grossTotal)}
                </span>
              </div>

              <div className="inspection-dialog-form-column">
                <DeviceInspectionForm
                  key={`inspection-form-${id}-${inspectionRefreshKey}-${forceInspectionStepOne ? 'step1' : 'default'}`}
                  orderId={id}
                  customerId={(order as any)?.customerId?._id || null}
                  deviceType={order.deviceType}
                  deviceBrand={(order as any)?.deviceBrand || ''}
                  deviceModel={(order as any)?.deviceModel || ''}
                  initialImei={(order as any)?.imei || ''}
                  initialSerialNumber={(order as any)?.serialNumber || ''}
                  reportedDeviceImage={getDeviceModelPreviewImage(order) || undefined}
                  bookedRepairs={(repairServices || []).map((service: any) => ({
                    name: service?.serviceId?.name || service?.name || service?.serviceName || service?.title || 'Reparaturservice',
                    price: safeToNumber(service?.finalPrice ?? service?.totalPrice ?? service?.price),
                    quantity: Number(service?.quantity || 1),
                  }))}
                  orderTotalCost={orderPriceBreakdown.grossTotal}
                  forceStartAtStepOne={forceInspectionStepOne}
                  onRequestDeviceChange={() => {
                    setReturnToInspectionAfterDeviceDialog(true)
                    setInspectionDialogOpen(false)
                    setDeviceChangeDialogOpen(true)
                  }}
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
                              <span className="text-xs font-semibold text-slate-600">{formatEUR(safeToNumber(addon.price))}</span>
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
                            {addon.name} - {formatEUR(safeToNumber(addon.price))}
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
                      <span className="rounded-full border bg-slate-50 px-2.5 py-1">{formatEUR(safeToNumber(selectedAddonService.price))}</span>
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
                  <p className="text-lg font-bold text-slate-900">{formatEUR(addonPreviewPrice)}</p>
                  <p className="text-xs text-slate-600">Listenpreis (Brutto) · Auftragswert aktuell: {formatEUR(orderPriceBreakdown.grossTotal)}</p>
                  {orderPriceBreakdown.groupDiscountPercent > 0 && (
                    <p className="text-xs text-slate-600">Der Kundenrabatt ({formatTaxRate(orderPriceBreakdown.groupDiscountPercent)} %) wird automatisch auf Auftragsebene abgezogen.</p>
                  )}
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
            <DialogTitle>Zusatzleistung bearbeiten</DialogTitle>
            <DialogDescription>
              Die Angaben der Zusatzleistung aktualisieren
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={customAddonName}
                onChange={(e) => setCustomAddonName(e.target.value)}
                placeholder="Name der Zusatzleistung"
              />
            </div>

            <div>
              <Label htmlFor="edit-description">Beschreibung</Label>
              <Textarea
                id="edit-description"
                value={customAddonDescription}
                onChange={(e) => setCustomAddonDescription(e.target.value)}
                placeholder="Beschreibung"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-price">Preis (€)</Label>
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
                <Label htmlFor="edit-time">Geschätzte Dauer</Label>
                <Input
                  id="edit-time"
                  value={customAddonTime}
                  onChange={(e) => setCustomAddonTime(e.target.value)}
                  placeholder="z. B. 30 Minuten"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditAddonDialogOpen(false)
              setEditingAddon(null)
              setCustomAddonName("")
              setCustomAddonPrice("")
              setCustomAddonDescription("")
              setCustomAddonTime("")
            }}>
              Abbrechen
            </Button>
            <Button onClick={handleEditAddon}>
              Zusatzleistung aktualisieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Staff to Add-On Dialog */}
      <Dialog open={assignAddonStaffDialogOpen} onOpenChange={setAssignAddonStaffDialogOpen}>
        <DialogContent className="order-dialog-content sm:max-w-[400px]">
          <DialogHeader className="order-dialog-header">
            <DialogTitle>Mitarbeiter der Zusatzleistung zuweisen</DialogTitle>
            <DialogDescription>
              Mitarbeiter auswählen, der diese Zusatzleistung übernimmt
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {selectedAddonForStaff && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="font-medium">{selectedAddonForStaff.name}</p>
                <p className="text-sm text-muted-foreground">{selectedAddonForStaff.description}</p>
              </div>
            )}

            <div>
              <Label htmlFor="staff-select">Mitarbeiter</Label>
              <Select value={addonStaffId} onValueChange={setAddonStaffId}>
                <SelectTrigger id="staff-select">
                  <SelectValue placeholder="Mitarbeiter auswählen …" />
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
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAssignAddonStaffDialogOpen(false)
              setSelectedAddonForStaff(null)
              setAddonStaffId("")
            }}>
              Abbrechen
            </Button>
            <Button onClick={handleAssignStaffToAddon} disabled={!addonStaffId}>
              Mitarbeiter zuweisen
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
                Personal für diesen Workflow
              </Label>
              <Select value={workflowAssignedStaffId} onValueChange={setWorkflowAssignedStaffId}>
                <SelectTrigger id="workflow-assignee" className="mt-2">
                  <SelectValue placeholder="Personal wählen (optional)" />
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
              <Card className={`transition-colors ${
                activeRepairWorkflow && activeRepairWorkflow.status !== 'pending-confirmation'
                  ? 'border-emerald-300 bg-emerald-50/70'
                  : 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-400 hover:bg-emerald-50/70'
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <CardTitle className="text-base text-slate-900">Reparatur-Workflow</CardTitle>
                      <CardDescription className="mt-1">
                        {activeRepairWorkflow && activeRepairWorkflow.status !== 'pending-confirmation'
                          ? 'Aktiver Reparatur-Workflow für diesen Auftrag'
                          : 'Reparatur-Ausführungs-Workflow für diese Inspektion'}
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (activeRepairWorkflow) {
                          setSelectedRepairWorkflow(activeRepairWorkflow)
                          setRepairWorkflowDialogOpen(true)
                        } else {
                          handleAssignWorkflow('repair-workflow')
                        }
                      }}
                      disabled={assigningWorkflow}
                      className={`flex-shrink-0 gap-1 ${
                        activeRepairWorkflow
                          ? 'bg-[#1a2a5e] hover:bg-[#2a3f7e]'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      {assigningWorkflow ? (
                        <span className="inline-block animate-spin">⏳</span>
                      ) : activeRepairWorkflow ? (
                        <Wrench className="h-3.5 w-3.5" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      {activeRepairWorkflow ? 'Öffnen' : 'Zuweisen'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {activeRepairWorkflow && activeRepairWorkflow.status !== 'pending-confirmation' ? (
                    <div className="space-y-3">
                      {/* Status badge + elapsed time */}
                      <div className="flex flex-wrap items-center gap-2">
                        {activeRepairWorkflow.status === 'in-progress' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
                            <Play className="h-3 w-3" />
                            In Bearbeitung
                          </span>
                        )}
                        {activeRepairWorkflow.status === 'paused' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                            <Pause className="h-3 w-3" />
                            Pausiert
                          </span>
                        )}
                        {activeRepairWorkflow.status === 'incident' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">
                            <AlertTriangle className="h-3 w-3" />
                            Zwischenfall
                          </span>
                        )}
                        {activeRepairWorkflow.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
                            <CheckCircle className="h-3 w-3" />
                            Abgeschlossen
                          </span>
                        )}

                        {activeRepairWorkflow.timerData?.startedAt && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                            <Timer className="h-3 w-3" />
                            {(() => {
                              const startedAt = new Date(activeRepairWorkflow.timerData.startedAt).getTime()
                              const endTime = activeRepairWorkflow.timerData.completedAt
                                ? new Date(activeRepairWorkflow.timerData.completedAt).getTime()
                                : activeRepairWorkflow.timerData.pausedAt
                                  ? new Date(activeRepairWorkflow.timerData.pausedAt).getTime()
                                  : Date.now()
                              const totalMs = endTime - startedAt - (activeRepairWorkflow.timerData.totalPausedMs || 0)
                              const hrs = Math.floor(totalMs / 3600000)
                              const mins = Math.floor((totalMs % 3600000) / 60000)
                              return hrs > 0 ? `${hrs}h ${mins}min` : `${mins}min`
                            })()}
                          </span>
                        )}
                      </div>

                      {/* Timeline / progress summary */}
                      <div className="space-y-1.5">
                        {activeRepairWorkflow.timerData?.startedAt && (
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                            Gestartet: {new Date(activeRepairWorkflow.timerData.startedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        {activeRepairWorkflow.timerData?.pauseHistory && activeRepairWorkflow.timerData.pauseHistory.length > 0 && (
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            {activeRepairWorkflow.timerData.pauseHistory.length}x pausiert (gesamt: {Math.round((activeRepairWorkflow.timerData.totalPausedMs || 0) / 60000)}min)
                          </div>
                        )}
                        {activeRepairWorkflow.incidents && activeRepairWorkflow.incidents.length > 0 && (
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                            {activeRepairWorkflow.incidents.length} Zwischenfall{activeRepairWorkflow.incidents.length > 1 ? 'fälle' : ''}
                          </div>
                        )}
                        {activeRepairWorkflow.timerData?.completedAt && (
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Abgeschlossen: {new Date(activeRepairWorkflow.timerData.completedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800">
                        <Wrench className="h-3.5 w-3.5" />
                        Reparatur
                      </span>
                      {activeRepairWorkflow?.status === 'pending-confirmation' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                          <Clock className="h-3 w-3" />
                          Warte auf Bestätigung
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
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
          discountPercent={safeToNumber(order.pricing?.groupDiscountPercent)}
        />
      )}

      {/* Reparaturposition entfernen: Rückfrage mit optionalem Grund für die Auftragshistorie */}
      <Dialog
        open={Boolean(serviceToDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingService) {
            setServiceToDelete(null)
            setDeleteServiceReason('')
            setDeleteServiceRepricing(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reparaturposition entfernen?</DialogTitle>
            <DialogDescription>
              „{serviceToDelete?.serviceId?.name || serviceToDelete?.name || 'Reparaturposition'}“
              {serviceToDelete ? ` (${formatEUR(safeToNumber(serviceToDelete.price))} Standardpreis brutto)` : ''} wird aus dem Auftrag entfernt.
              Der Auftragswert und eine offene Rechnung werden vom Server neu berechnet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="delete-service-reason" className="text-sm font-medium">
              Grund der Änderung <span className="font-normal text-muted-foreground">(optional, wird in der Auftragshistorie gespeichert)</span>
            </label>
            <Textarea
              id="delete-service-reason"
              value={deleteServiceReason}
              onChange={(event) => setDeleteServiceReason(event.target.value)}
              rows={3}
              placeholder="z. B. Kunde hat die Reparatur abgelehnt"
            />
          </div>
          {deleteServiceRepricing && (
            <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">Nicht entfernt</p>
              <p>{deleteServiceRepricing.message}</p>
              {deleteServiceRepricing.details && (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                  <dt>Gespeicherter Auftragswert</dt>
                  <dd className="text-right font-semibold">{formatEUR(deleteServiceRepricing.details.storedTotal)}</dd>
                  <dt>Positionen (Standardpreise brutto)</dt>
                  <dd className="text-right">{formatEUR(deleteServiceRepricing.details.positionsGross)}</dd>
                  <dt>Rabatt</dt>
                  <dd className="text-right">−{formatEUR(deleteServiceRepricing.details.discount)}</dd>
                  <dt>Positionen abzüglich Rabatt</dt>
                  <dd className="text-right">{formatEUR(deleteServiceRepricing.details.expectedTotal)}</dd>
                  <dt>Abweichung</dt>
                  <dd className="text-right font-semibold">
                    {deleteServiceRepricing.details.difference > 0 ? '+' : deleteServiceRepricing.details.difference < 0 ? '−' : ''}
                    {formatEUR(Math.abs(deleteServiceRepricing.details.difference))}
                  </dd>
                </dl>
              )}
              <p className="text-xs">{describeRepricingConsequence(deleteServiceRepricing.details)}</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={deletingService}
              onClick={() => {
                setServiceToDelete(null)
                setDeleteServiceReason('')
                setDeleteServiceRepricing(null)
              }}
            >
              Abbrechen
            </Button>
            {deleteServiceRepricing ? (
              <Button
                variant="destructive"
                disabled={deletingService}
                onClick={() => void confirmDeleteRepairService(true)}
              >
                {deletingService ? 'Wird entfernt…' : 'Neuberechnung bestätigen'}
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={deletingService}
                onClick={() => void confirmDeleteRepairService()}
              >
                {deletingService ? 'Wird entfernt…' : 'Position entfernen'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Neuberechnung bestätigen (Zusatzleistungen, Shop-Produkte): gleiche Rückfrage wie bei Reparaturpositionen */}
      <Dialog
        open={Boolean(pendingRepricing)}
        onOpenChange={(open) => {
          if (!open && !confirmingRepricing) setPendingRepricing(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingRepricing?.title || 'Änderung'}: Neuberechnung bestätigen?</DialogTitle>
            <DialogDescription>
              Die Änderung wurde noch nicht gespeichert. Der gespeicherte Auftragswert passt nicht zu den Positionen.
            </DialogDescription>
          </DialogHeader>
          {pendingRepricing && (
            <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">
                {pendingRepricing.outdated ? 'Der Auftrag wurde inzwischen geändert – bitte die neue Abweichung prüfen' : 'Nicht gespeichert'}
              </p>
              <p>{pendingRepricing.message}</p>
              {pendingRepricing.details && (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                  <dt>Gespeicherter Auftragswert</dt>
                  <dd className="text-right font-semibold">{formatEUR(pendingRepricing.details.storedTotal)}</dd>
                  <dt>Positionen (Standardpreise brutto)</dt>
                  <dd className="text-right">{formatEUR(pendingRepricing.details.positionsGross)}</dd>
                  <dt>Rabatt</dt>
                  <dd className="text-right">−{formatEUR(pendingRepricing.details.discount)}</dd>
                  <dt>Positionen abzüglich Rabatt</dt>
                  <dd className="text-right">{formatEUR(pendingRepricing.details.expectedTotal)}</dd>
                  <dt>Abweichung</dt>
                  <dd className="text-right font-semibold">
                    {pendingRepricing.details.difference > 0 ? '+' : pendingRepricing.details.difference < 0 ? '−' : ''}
                    {formatEUR(Math.abs(pendingRepricing.details.difference))}
                  </dd>
                </dl>
              )}
              <p className="text-xs">{describeRepricingConsequence(pendingRepricing.details)}</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={confirmingRepricing}
              onClick={() => setPendingRepricing(null)}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={confirmingRepricing}
              onClick={() => void confirmPendingRepricing()}
            >
              {confirmingRepricing ? 'Wird gespeichert…' : 'Neuberechnung bestätigen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shop Product Selection Dialog */}
      {id && (
        <ShopProductSelectionDialog
          open={shopProductDialogOpen}
          onClose={() => setShopProductDialogOpen(false)}
          onAddProduct={handleAddShopProduct}
          orderId={id}
          currentOrderTotal={orderPriceBreakdown.grossTotal}
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

      {/* Repair Workflow Process Dialog */}
      {selectedRepairWorkflow && id && (
        <RepairWorkflowProcessDialog
          open={repairWorkflowDialogOpen}
          onOpenChange={(open) => {
            setRepairWorkflowDialogOpen(open)
            if (!open) {
              setSelectedRepairWorkflow(null)
            }
          }}
          orderId={id}
          workflow={selectedRepairWorkflow}
          order={order}
          inspection={customerInspection}
          onWorkflowUpdated={handleRepairWorkflowUpdated}
          shipments={orderShipments}
        />
      )}

      {/* Device Change Dialog */}
      {id && order && (
        <DeviceChangeDialog
          open={deviceChangeDialogOpen}
          onOpenChange={(open) => {
            setDeviceChangeDialogOpen(open)

            if (!open && returnToInspectionAfterDeviceDialog) {
              setForceInspectionStepOne(true)
              setInspectionRefreshKey((current) => current + 1)
              setInspectionDialogOpen(true)
              setReturnToInspectionAfterDeviceDialog(false)
            }
          }}
          orderId={id}
          source={returnToInspectionAfterDeviceDialog ? 'Inspektion Schritt 1' : 'Gerätekarte'}
          currentDevice={{
            brand: order.deviceBrand,
            model: order.deviceModel,
            type: order.deviceType,
          }}
          // Positionen aus /api/order-services: order.services der Detailantwort enthält nur
          // Namen (ohne _id), damit wäre die Liste im Dialog immer leer.
          currentServices={(Array.isArray(repairServices) ? repairServices : [])
            .filter((service: any) => service && service._id)
            .map((service: any) => {
              const serviceName =
                service.serviceId?.name
                || service.name
                || service.serviceName
                || `Service #${String(service._id).substring(0, 8)}`

              return {
                id: String(service._id),
                name: serviceName || 'Reparaturservice',
                price: Number(service.price) || 0,
              }
            })}
          onDeviceChanged={(updatedOrder) => {
            // Die Rohantwort von /change-device hat nicht die Form der Detailansicht
            // (u. a. Positionen, Preisaufstellung, Versandstand) - daher neu laden statt
            // sie einzusetzen. Die Meldung zeigt der Dialog selbst (auch beim Abbrechen
            // nach bereits gespeichertem Wechsel darf hier kein "Erfolg" erscheinen).
            console.log('[OrderDetails] Device change saved, reloading order:', updatedOrder?._id)
            void reloadRepairServicesAndOrder()
          }}
          // Wechsel bereits bei "Neu berechnen" gespeichert, Dialog ohne Bestätigung
          // geschlossen (Abbrechen, X, Escape, Klick daneben): gespeicherten Stand neu laden.
          onRefreshRequested={() => {
            void reloadRepairServicesAndOrder()
          }}
        />
      )}
    </div>
  )
}