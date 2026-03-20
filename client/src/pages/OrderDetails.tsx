import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import { safeToNumber, formatPrice } from "@/lib/utils"
import "./OrderDetails.css"
import { getOrderById, Order, getOrderProgressTimeline, addShopProductToOrder, removeShopProductFromOrder, updateShopProductQuantity, ShopProduct } from "@/api/orders"
import { startOrderTracking, endOrderTracking } from "@/api/timeTracking"
import { getConversations, getConversationMessages, sendMessage, startConversation } from "@/api/messages"
import { getAvailableStaff, assignStaffToOrder, StaffMember, getAdminOrderById, removeEPartFromOrder, addAddonToOrder, updateOrderAddon, removeAddonFromOrder, assignStaffToAddon, confirmUnlockCode, updateOrderDevice, updateOrderStatus } from "@/api/adminOrders"
import { getUserProfile, UserProfile } from "@/api/user"
import { getAddOnServices, AddOnService as AddOnServiceType, getServices } from "@/api/services"
import { getOrderWorkflows, getSuggestedWorkflowsForOrder, assignWorkflowToOrder, deleteWorkflowFromOrder, startWorkflow, updateWorkflowStatus } from "@/api/workflow"
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
import { OrderProgressTimeline } from "@/components/OrderProgressTimeline"
import { ConfirmUnlockDialog } from "@/components/inspection/ConfirmUnlockDialog"
import { DeviceChangeDialog } from "@/components/admin/DeviceChangeDialog"
import { CommunicationPanel } from "@/components/inspection/CommunicationPanel"
import { generateInspectionReport } from "@/api/deviceInspection"
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
  Zap
} from "lucide-react"

export function OrderDetails() {
  const { id } = useParams<{ id: string }>()
  const { isAuthenticated } = useAuth()
  const { t } = useTranslation()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
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
  const [assigningWorkflow, setAssigningWorkflow] = useState(false)
  const [deletingWorkflowId, setDeletingWorkflowId] = useState<string | null>(null)
  const [workflowActionInProgress, setWorkflowActionInProgress] = useState<{
    workflowId: string
    action: 'start' | 'pause' | 'resume'
  } | null>(null)
  const [selectedWorkflowForExecution, setSelectedWorkflowForExecution] = useState<any | null>(null)
  const [workflowExecutionModalOpen, setWorkflowExecutionModalOpen] = useState(false)
  const [workflowExecutionMode, setWorkflowExecutionMode] = useState<'start' | 'resume' | 'execute' | 'view'>('view')
  const [progressTimeline, setProgressTimeline] = useState<any>(null)
  const [repairServices, setRepairServices] = useState<any[]>([])
  const [availableServices, setAvailableServices] = useState<any[]>([])
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false)
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
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false)
  const [inspectionRefreshKey, setInspectionRefreshKey] = useState(0)
  const [generatingInspectionReport, setGeneratingInspectionReport] = useState(false)
  const { toast } = useToast()

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

        // Try to find existing conversation for this order
        try {
          const conversationsResponse = await getConversations()
          const conversations = (conversationsResponse as any).conversations || []

          // Find conversation for this order
          const orderConversation = conversations.find((conv: any) =>
            conv.orderId === id || conv.orderId._id === id
          )

          if (orderConversation) {
            console.log("Found existing conversation:", orderConversation._id)
            setConversationId(orderConversation._id)

            // Fetch messages for this conversation
            const messagesResponse = await getConversationMessages(orderConversation._id)
            setMessages((messagesResponse as any).messages || [])
          } else {
            console.log("No conversation found for order:", id)
            setMessages([])
            setConversationId(null)
          }
        } catch (error) {
          console.log("No conversations found or error fetching conversations:", error)
          setMessages([])
          setConversationId(null)
        }
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
    return () => {
      document.body.classList.remove('order-details-page')
    }
  }, [])

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

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !id) return

    try {
      setSending(true)

      let currentConversationId = conversationId

      // If no conversation exists, create one first
      if (!currentConversationId) {
        console.log("Creating new conversation for order:", id)
        const conversationResponse = await startConversation(id, newMessage)
        currentConversationId = (conversationResponse as any).conversation._id
        setConversationId(currentConversationId)

        // Fetch the message that was created with the conversation
        const messagesResponse = await getConversationMessages(currentConversationId)
        setMessages((messagesResponse as any).messages || [])
        setNewMessage("")

        toast({
          title: "Message sent",
          description: "Your message has been sent to the repair team"
        })
      } else {
        // Send message to existing conversation
        const response = await sendMessage(currentConversationId, newMessage)
        setMessages([...messages, (response as any).message])
        setNewMessage("")

        toast({
          title: "Message sent",
          description: "Your message has been sent to the repair team"
        })
      }
    } catch (error: any) {
      console.error("Error sending message:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive"
      })
    } finally {
      setSending(false)
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

      // Refresh order data
      await refreshOrder()
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
      let addonData;

      if (selectedAddonService) {
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
            title: "Error",
            description: "Please provide add-on name and price",
            variant: "destructive"
          })
          return
        }

        addonData = {
          name: customAddonName,
          description: customAddonDescription,
          price: parseFloat(customAddonPrice),
          estimatedTime: customAddonTime,
          status: 'pending'
        }
      }

      await addAddonToOrder(id, addonData)

      toast({
        title: "Success",
        description: "Add-on service added successfully"
      })

      // Reset form
      setSelectedAddonService(null)
      setCustomAddonName("")
      setCustomAddonPrice("")
      setCustomAddonDescription("")
      setCustomAddonTime("")
      setAddAddonDialogOpen(false)

      // Refresh order data
      await refreshOrder()
    } catch (error: any) {
      console.error("Error adding add-on:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to add add-on service",
        variant: "destructive"
      })
    }
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

      setServiceDialogOpen(false)

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

      await assignWorkflowToOrder(id, workflowTemplateId)

      toast({
        title: "Success",
        description: "Workflow assigned to order successfully"
      })

      setWorkflowDialogOpen(false)

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
      setWorkflows((workflowsResponse as any).workflows || [])

      // Refresh order to get updated progress
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'diagnostic-assessment':
        return <Smartphone className="h-4 w-4" />
      case 'in-progress':
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

  // Helper function to get device image or fallback
  const getDeviceImage = (order: Order) => {
    if (order.photos && order.photos.length > 0) {
      return order.photos[0]
    }
    return null
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
            <Link to="/bookings" className="order-btn order-btn-primary mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('orderDetails.backToBookings')}
            </Link>
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
  const backLinkPath = user?.role === 'admin' ? '/admin/orders' : user?.role === 'staff' ? '/staff/bookings' : '/bookings'
  const backLinkLabel = isStaffOrAdmin ? 'Back to Order Queue' : t('orderDetails.backToBookings')
  const staffCount = order.assignedStaff?.length || 0
  const serviceCount = (repairServices?.filter((s) => s && s._id).length || 0) + (order.addOns?.length || 0)
  const lastUpdate = order.updatedAt ? new Date(order.updatedAt).toLocaleString() : '-'

  const scrollToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const renderDeviceInformationCard = () => (
    <Card id="order-device-info" className="order-section-card">
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
      <CardContent className="space-y-4 pt-3">
        <div className="device-info-card">
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
          <div className="details flex-1">
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

        {order.customerNotes && (
          <div className="bg-muted/50 p-2 rounded-lg">
            <h4 className="font-medium text-xs">{t('orderDetails.notes', 'Notes:')}</h4>
            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{order.customerNotes}</p>
          </div>
        )}

        <div id="order-device-lock" className="space-y-2 border-t pt-3">
          <h4 className="font-medium text-sm flex items-center gap-1.5">
            <Lock className="h-4 w-4 text-blue-600" />
            {t('orderDetails.deviceLockInformation', 'Device Lock Information')}
          </h4>

          {order.unlockPattern && order.unlockPattern.length > 0 && (
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-0.5">
                {t('orderDetails.unlockPattern', 'Unlock Pattern')}
              </p>
              <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                {order.unlockPattern.join(' → ')}
              </div>
              <span className="text-xs text-slate-500">({order.unlockPattern.length} {t('orderDetails.dots', 'dots')})</span>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUnlockConfirmDialogOpen(true)}
              className="w-full text-xs px-2 h-8"
            >
              {order.unlockConfirmation
                ? t('orderDetails.updateConfirmation', 'Update Confirmation')
                : t('orderDetails.confirmUnlock', 'Confirm Unlock Information')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const renderDeviceInspectionCard = () => (
    <Card id="order-device-inspection" className="order-section-card">
      <CardHeader className="order-section-header">
        <CardTitle className="order-section-title">
          <FileText className="h-5 w-5" />
          {t('orderDetails.deviceInspection', 'Device Inspection')}
        </CardTitle>
        <p className="order-section-description">
          {t('orderDetails.deviceInspectionInlineHint', 'Start, continue, or review the inspection directly from device details.')}
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
                {service.serviceId?.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{service.serviceId.description}</p>
                )}
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
            onClick={() => setAddAddonDialogOpen(true)}
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
            Shop Products
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Products added from shop inventory for this specific repair order.
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
            Add Product
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
                      <h4 className="font-medium text-sm">{product?.name || 'Unknown Product'}</h4>
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {product?.category}
                      </Badge>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <span>Brand:</span>
                        <span className="font-medium text-foreground">{product?.brand || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Price:</span>
                        <span className="font-medium text-foreground">${shopProduct.priceAtOrder?.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Qty:</span>
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
                        <span>Total:</span>
                        <span className="font-bold text-foreground">${totalPrice.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        Added: {new Date(shopProduct.addedAt).toLocaleDateString()}
                      </span>
                      {shopProduct.addedBy && (
                        <span>
                          By: {shopProduct.addedBy.name}
                        </span>
                      )}
                      {product?.stock !== undefined && (
                        <Badge variant={product.stock > 10 ? 'default' : product.stock > 0 ? 'secondary' : 'destructive'} className="text-xs px-1.5 py-0">
                          Stock: {product.stock}
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
          <p className="text-sm">No shop products added</p>
          {(user?.role === 'admin' || user?.role === 'staff') && (
            <p className="text-xs mt-1">Click "Add Product" to add products from the shop to this order</p>
          )}
        </div>
      )}
    </div>
  )

  const renderEPartsCard = () => {
    if (!isStaffOrAdmin) {
      return null
    }

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
          {(order as any).eParts && (order as any).eParts.length > 0 ? (
            <div className="space-y-2">
              {(order as any).eParts.map((ePart: any) => {
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
    const progressValue = Math.max(0, Math.min(100, safeToNumber(order.progress)))
    const progressLabel =
      progressValue >= 100 ? 'Completed' :
      progressValue >= 75 ? 'Quality Check' :
      progressValue >= 50 ? 'Repair in Progress' :
      progressValue >= 25 ? 'Diagnostic Assessment' :
      'Order Received'

    const progressSteps = progressTimeline?.stages?.length
      ? progressTimeline.stages.map((stage: any, index: number) => ({
          key: stage.name || `stage-${index}`,
          label: stage.name || `Stage ${index + 1}`,
          completed: Boolean(stage.completed) || index < (progressTimeline.currentStage ?? 0),
          active: index === (progressTimeline.currentStage ?? 0),
        }))
      : [
          { key: 'received', label: 'Order Received', completed: true, active: progressValue < 25 },
          { key: 'diagnostic', label: 'Diagnostic Assessment', completed: progressValue >= 25, active: progressValue >= 25 && progressValue < 50 },
          { key: 'repair', label: 'Repair in Progress', completed: progressValue >= 50, active: progressValue >= 50 && progressValue < 75 },
          { key: 'quality', label: 'Quality Check', completed: progressValue >= 75, active: progressValue >= 75 && progressValue < 100 },
          { key: 'pickup', label: 'Ready for Pickup', completed: progressValue >= 100, active: progressValue >= 100 },
        ]

    return (
      <Card id="order-progress" className="order-section-card order-repair-progress-card">
        <CardHeader className="order-section-header">
          <CardTitle className="order-section-title">
            <Clock className="h-5 w-5" />
            {t('orderDetails.repairProgress')}
          </CardTitle>
          <p className="order-section-description">
            Clear overview of the current order status and remaining repair steps.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Status</p>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <Badge className={`${getStatusColor(order.status)} text-xs px-2 py-0.5`}>
                  {order.status.replace('-', ' ')}
                </Badge>
                <span className="text-sm font-semibold">{progressLabel}</span>
              </div>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Completion</p>
              <p className="text-2xl font-bold text-foreground">{progressValue}%</p>
            </div>
          </div>

          <div className="space-y-2">
            <Progress value={progressValue} className="h-3" />
            <div className="flex flex-col gap-1 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
              <span>{t('orderDetails.currentProgress')}</span>
              {order.estimatedCompletion && order.status !== 'completed' ? (
                <span>
                  {t('orderDetails.estimatedCompletion')}: {new Date(order.estimatedCompletion).toLocaleDateString()}
                </span>
              ) : (
                <span>Updated: {lastUpdate}</span>
              )}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-5">
            {progressSteps.map((step: any) => (
              <div
                key={step.key}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  step.completed
                    ? 'border-green-200 bg-green-50 text-green-900'
                    : step.active
                    ? 'border-blue-200 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                    step.completed
                      ? 'bg-green-500 text-white'
                      : step.active
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {step.completed ? '✓' : step.active ? '•' : '○'}
                  </span>
                  <span className="font-medium leading-tight">{step.label}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
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

  return (
    <div className={`order-details-container ${isStaffOrAdmin ? 'admin-order-workspace' : ''}`}>
      {/* Back Button */}
      <Link to={backLinkPath} className="order-back-button">
        <ArrowLeft className="h-4 w-4" />
        {backLinkLabel}
      </Link>

      {/* Order Header */}
      <div className="order-details-header">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="order-header-title-block">
            <h1>
              <Package className="h-7 w-7" />
              Order #{order.orderNumber || order._id.slice(-6)}
            </h1>
            <p>
              {order.deviceBrand} {order.deviceModel} • {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap order-header-meta-block">
            {isStaffOrAdmin ? (
              <DropdownMenu open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`${getStatusColor(order.status)} text-xs px-3 py-1 cursor-pointer border-none flex items-center gap-1`}
                    disabled={updatingStatus}
                  >
                    {getStatusIcon(order.status)}
                    <span>{order.status.replace('-', ' ')}</span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs font-semibold">Change Order Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleStatusChange('pending')} disabled={updatingStatus || order.status === 'pending'} className="text-xs cursor-pointer">
                    <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                    Pending
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange('in-progress')} disabled={updatingStatus || order.status === 'in-progress'} className="text-xs cursor-pointer">
                    <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    In Progress
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange('quality-check')} disabled={updatingStatus || order.status === 'quality-check'} className="text-xs cursor-pointer">
                    <span className="inline-block w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                    Quality Check
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange('ready-for-pickup')} disabled={updatingStatus || order.status === 'ready-for-pickup'} className="text-xs cursor-pointer">
                    <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                    Ready for Pickup
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange('completed')} disabled={updatingStatus || order.status === 'completed'} className="text-xs cursor-pointer">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Completed
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleStatusChange('cancelled')} disabled={updatingStatus || order.status === 'cancelled'} className="text-xs cursor-pointer text-destructive">
                    <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                    Cancelled
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className={`order-status-badge ${getStatusColor(order.status)} text-xs px-3 py-1`}>
                {getStatusIcon(order.status)}
                <span className="ml-1">{order.status.replace('-', ' ')}</span>
              </span>
            )}
            <span className={`payment-status-badge ${getPaymentStatusColor(order.paymentStatus)}`}>
              <CreditCard className="h-3 w-3 mr-1" />
              {order.paymentStatus}
            </span>
            <div className="order-total-cost">
              <div className="amount">${safeToNumber(order.totalCost).toFixed(2)}</div>
              <div className="label">Total</div>
            </div>
          </div>
        </div>

        {isStaffOrAdmin && (
          <div className="order-admin-kpi-grid">
            <div className="order-admin-kpi-card">
              <span>Progress</span>
              <strong>{order.progress}%</strong>
            </div>
            <div className="order-admin-kpi-card">
              <span>Status</span>
              <strong>{order.status.replace('-', ' ')}</strong>
            </div>
            <div className="order-admin-kpi-card">
              <span>Assigned Staff</span>
              <strong>{staffCount}</strong>
            </div>
            <div className="order-admin-kpi-card">
              <span>Services</span>
              <strong>{serviceCount}</strong>
            </div>
            <div className="order-admin-kpi-card">
              <span>Last Update</span>
              <strong>{lastUpdate}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Overall Progress Timeline */}
      {progressTimeline && (
        <div className="order-section-card">
          <OrderProgressTimeline
            stages={progressTimeline.stages}
            currentStage={progressTimeline.currentStage}
          />
        </div>
      )}

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
                Additional Repair Information
              </CardTitle>
              <p className="order-section-description">
                {t('orderDetails.repairInfo.description') || 'Customer-provided information about the device and repair requirements'}
              </p>
            </CardHeader>
            <CardContent className="pt-3 space-y-3">
              <div>
                {/* Error Description */}
                {order.errorDescription && order.errorDescription.trim() ? (
                  <div className="bg-white/50 dark:bg-gray-900/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-xs text-amber-900 dark:text-amber-100 mb-1">
                          {t('orderDetails.repairInfo.errorDescriptionLabel') || 'Error Description'}
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
                          {t('orderDetails.repairInfo.errorDescriptionLabel') || 'Error Description'}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-600 italic mt-1">
                          {t('orderDetails.repairInfo.noInformationProvided') || 'No error description provided'}
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
                          {t('orderDetails.repairInfo.waterDamageLabel') || 'Water Damage'}
                        </h4>
                      </div>
                      <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 text-xs px-2 py-0.5">
                        {t('orderDetails.repairInfo.notSpecified') || 'Not specified'}
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
                            {t('orderDetails.repairInfo.previousRepairLabel') || 'Previous Repair Attempts'}
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
                          {t('orderDetails.repairInfo.previousRepairLabel') || 'Previous Repair Attempts'}
                        </h4>
                      </div>
                      <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 text-xs px-2 py-0.5">
                        {t('orderDetails.repairInfo.notSpecified') || 'Not specified'}
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
                          {t('orderDetails.repairInfo.itemConditionLabel') || 'Item Condition'}
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
                          {t('orderDetails.repairInfo.itemConditionLabel') || 'Item Condition'}
                        </h4>
                      </div>
                      <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 text-xs px-2 py-0.5">
                        {t('orderDetails.repairInfo.notSpecified') || 'Not specified'}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Information Notice */}
                <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-900 dark:text-blue-100 leading-relaxed">
                      {t('orderDetails.repairInfo.infoNotice') || 'This information helps our technicians better assess and repair your device. Additional details may be requested during the inspection process.'}
                    </p>
                  </div>
                </div>

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
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {isStaffOrAdmin ? (
                <>
                  <Button className="w-full text-xs h-8" variant="outline" size="sm" onClick={() => setStatusDropdownOpen(true)}>
                    <Clock className="h-3 w-3 mr-1" />
                    Update Status
                  </Button>
                  <Button className="w-full text-xs h-8" variant="outline" size="sm" onClick={() => scrollToSection('order-staff')}>
                    <Users className="h-3 w-3 mr-1" />
                    Manage Staff
                  </Button>
                  <Button
                    className="w-full text-xs h-8"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingService(null)
                      setServiceDialogOpen(true)
                    }}
                  >
                    <PlusCircle className="h-3 w-3 mr-1" />
                    Add Repair Service
                  </Button>
                  <Button className="w-full text-xs h-8" variant="outline" size="sm" onClick={() => scrollToSection('order-quick-actions-communication')}>
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Open Messages
                  </Button>
                </>
              ) : (
                <>
                  <Button className="w-full text-xs h-8" variant="outline" size="sm">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Send Message
                  </Button>
                  <Button className="w-full text-xs h-8" variant="outline" size="sm">
                    <Camera className="h-3 w-3 mr-1" />
                    Upload Photos
                  </Button>
                  <Button className="w-full text-xs h-8" variant="outline" size="sm">
                    <Star className="h-3 w-3 mr-1" />
                    Rate Service
                  </Button>
                </>
              )}

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

              <div id="order-quick-actions-communication" className="border-t pt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    <h4 className="font-medium text-sm">Customer Communication</h4>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Manage customer feedback, requests, and quick follow-ups in one place.
                </p>
                {id && (
                  <div className="rounded-lg border p-2 bg-background">
                    <CommunicationPanel
                      orderId={id}
                      inspectionId={order?._id}
                    />
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
                  {order.assignedStaff.map((staff) => (
                    <div key={staff._id} className="flex items-center gap-2 p-2 border rounded-lg">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={staff.avatar} />
                        <AvatarFallback className="text-xs">
                          {staff.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{staff.name}</p>
                        <p className="text-xs text-muted-foreground">{t('orderDetails.repairTechnician')}</p>
                      </div>
                    </div>
                  ))}
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
          {/* Device Change Dialog */}
          <Dialog open={deviceChangeDialogOpen} onOpenChange={setDeviceChangeDialogOpen}>
            <DialogContent className="order-dialog-content max-w-md">
              <DialogHeader className="order-dialog-header">
                <DialogTitle>{t('orderDetails.changeDevice') || 'Change Device Information'}</DialogTitle>
                <DialogDescription>
                  {t('orderDetails.changeDeviceDescription') || 'Search and select a device or manually enter device information'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Device Search with Autocomplete */}
                <div className="relative">
                  <Label htmlFor="device-search">{t('orderDetails.searchDevice') || 'Search Device'}</Label>
                  <Input
                    id="device-search"
                    placeholder="e.g., iPhone 14 Pro, Galaxy S23..."
                    value={deviceSearchQuery}
                    onChange={(e) => handleDeviceSearch(e.target.value)}
                    onFocus={() => deviceSearchResults.length > 0 && setShowDeviceResults(true)}
                  />

                  {/* Search Results Dropdown */}
                  {showDeviceResults && deviceSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
                      {deviceSearchResults.map((device) => (
                        <button
                          key={device._id}
                          onClick={() => handleSelectDeviceForChange(device)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b last:border-b-0 transition-colors"
                        >
                          <div className="font-medium">{device.displayName}</div>
                          <div className="text-sm text-gray-500">{device.deviceType}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Or Manual Entry Section */}
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 mb-3">Or enter device details manually:</p>

                  <div>
                    <Label htmlFor="device-brand">{t('orderDetails.deviceBrand') || 'Device Brand'}</Label>
                    <Input
                      id="device-brand"
                      placeholder="e.g., Apple, Samsung, Google"
                      value={newDeviceBrand}
                      onChange={(e) => setNewDeviceBrand(e.target.value)}
                    />
                  </div>

                  <div className="mt-3">
                    <Label htmlFor="device-model">{t('orderDetails.deviceModel') || 'Device Model'}</Label>
                    <Input
                      id="device-model"
                      placeholder="e.g., iPhone 14 Pro, Galaxy S23"
                      value={newDeviceModel}
                      onChange={(e) => setNewDeviceModel(e.target.value)}
                    />
                  </div>

                  <div className="mt-3">
                    <Label htmlFor="device-type">{t('orderDetails.deviceType') || 'Device Type'}</Label>
                    <Select value={newDeviceType} onValueChange={setNewDeviceType}>
                      <SelectTrigger id="device-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Smartphone">Smartphone</SelectItem>
                        <SelectItem value="Tablet">Tablet</SelectItem>
                        <SelectItem value="Laptop">Laptop</SelectItem>
                        <SelectItem value="Watch">Watch</SelectItem>
                        <SelectItem value="Headphones">Headphones</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedDeviceForChange && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-sm font-medium text-blue-900">
                      Selected: {selectedDeviceForChange.displayName}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      {selectedDeviceForChange.deviceType}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setDeviceChangeDialogOpen(false)
                  setDeviceSearchQuery("")
                  setDeviceSearchResults([])
                  setShowDeviceResults(false)
                  setSelectedDeviceForChange(null)
                }}>
                  {t('common.cancel') || 'Cancel'}
                </Button>
                <Button onClick={handleDeviceChange} disabled={updatingDevice}>
                  {updatingDevice ? t('common.saving') || 'Saving...' : t('common.save') || 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {(order?.unlockPattern?.length > 0 || order?.unlockCode || order?.noLock || order?.unlockConfirmation?.confirmationStatus) && (
            <ConfirmUnlockDialog
              isOpen={unlockConfirmDialogOpen}
              onOpenChange={setUnlockConfirmDialogOpen}
              onConfirm={handleConfirmUnlock}
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

      {/* Device Inspection Dialog */}
      {id && order && isStaffOrAdmin && (
        <Dialog open={inspectionDialogOpen} onOpenChange={setInspectionDialogOpen}>
          <DialogContent className="order-dialog-content inspection-dialog-content w-[96vw] max-w-[1180px]">
            <DialogHeader className="order-dialog-header inspection-dialog-header">
              <div className="inspection-dialog-title-row">
                <div>
                  <DialogTitle className="inspection-dialog-title">Device Inspection</DialogTitle>
                  <DialogDescription className="inspection-dialog-description">
                    {order.orderNumber ? `Order ${order.orderNumber}` : "Complete the device inspection directly from order details"}
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

            <div className="inspection-dialog-grid">
              <div className="inspection-dialog-form-column">
                <DeviceInspectionForm
                  orderId={id}
                  customerId={(order as any)?.customerId?._id || null}
                  deviceType={order.deviceType}
                  deviceBrand={(order as any)?.deviceBrand || ''}
                  deviceModel={(order as any)?.deviceModel || ''}
                  onComplete={handleInspectionComplete}
                />
              </div>

              <div className="inspection-dialog-side-column">
                <Card className="order-section-card inspection-dialog-order-card">
                  <CardHeader className="order-section-header">
                    <CardTitle className="order-section-title">
                      <FileText className="h-4 w-4" />
                      Order Snapshot
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="inspection-dialog-order-content">
                    <div className="inspection-dialog-meta-item">
                      <span className="inspection-dialog-meta-label">Order</span>
                      <span className="inspection-dialog-meta-value">{order.orderNumber || "-"}</span>
                    </div>
                    <div className="inspection-dialog-meta-item">
                      <span className="inspection-dialog-meta-label">Device</span>
                      <span className="inspection-dialog-meta-value">{order.deviceBrand} {order.deviceModel}</span>
                    </div>
                    <div className="inspection-dialog-meta-item">
                      <span className="inspection-dialog-meta-label">Type</span>
                      <span className="inspection-dialog-meta-value">{order.deviceType || "-"}</span>
                    </div>
                    <div className="inspection-dialog-meta-item">
                      <span className="inspection-dialog-meta-label">Customer</span>
                      <span className="inspection-dialog-meta-value">{(order as any)?.customerId?.name || "Guest"}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="order-section-card inspection-dialog-communication-card">
                  <CardHeader className="order-section-header">
                    <CardTitle className="order-section-title">
                      <MessageSquare className="h-4 w-4" />
                      Customer Communication
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="inspection-dialog-communication-content">
                    <CommunicationPanel orderId={id} inspectionId={order?._id} />
                  </CardContent>
                </Card>
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
          onSuccess={refreshOrder}
        />
      )}

      {/* Add Add-On Dialog */}
      <Dialog open={addAddonDialogOpen} onOpenChange={setAddAddonDialogOpen}>
        <DialogContent className="order-dialog-content sm:max-w-[500px]">
          <DialogHeader className="order-dialog-header">
            <DialogTitle>Add Add-On Service</DialogTitle>
            <DialogDescription>
              Select an existing add-on service or create a custom one
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="addon-service">Select Add-On Service (Optional)</Label>
              <Select
                value={selectedAddonService?._id || ""}
                onValueChange={(value) => {
                  const addon = availableAddons.find(a => a._id === value)
                  setSelectedAddonService(addon || null)
                  if (addon) {
                    setCustomAddonName("")
                    setCustomAddonPrice("")
                    setCustomAddonDescription("")
                    setCustomAddonTime("")
                  }
                }}
              >
                <SelectTrigger id="addon-service">
                  <SelectValue placeholder="Choose an add-on service..." />
                </SelectTrigger>
                <SelectContent>
                  {availableAddons.map((addon) => (
                    <SelectItem key={addon._id} value={addon._id}>
                      {addon.name} - ${safeToNumber(addon.price).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              OR
            </div>

            <div>
              <Label htmlFor="custom-name">Custom Add-On Name</Label>
              <Input
                id="custom-name"
                value={customAddonName}
                onChange={(e) => {
                  setCustomAddonName(e.target.value)
                  setSelectedAddonService(null)
                }}
                placeholder="Enter add-on name"
                disabled={!!selectedAddonService}
              />
            </div>

            <div>
              <Label htmlFor="custom-description">Description (Optional)</Label>
              <Textarea
                id="custom-description"
                value={customAddonDescription}
                onChange={(e) => setCustomAddonDescription(e.target.value)}
                placeholder="Enter description"
                disabled={!!selectedAddonService}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="custom-price">Price ($)</Label>
                <Input
                  id="custom-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={customAddonPrice}
                  onChange={(e) => {
                    setCustomAddonPrice(e.target.value)
                    setSelectedAddonService(null)
                  }}
                  placeholder="0.00"
                  disabled={!!selectedAddonService}
                />
              </div>
              <div>
                <Label htmlFor="custom-time">Estimated Time (Optional)</Label>
                <Input
                  id="custom-time"
                  value={customAddonTime}
                  onChange={(e) => setCustomAddonTime(e.target.value)}
                  placeholder="e.g., 30 minutes"
                  disabled={!!selectedAddonService}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddAddonDialogOpen(false)
              setSelectedAddonService(null)
              setCustomAddonName("")
              setCustomAddonPrice("")
              setCustomAddonDescription("")
              setCustomAddonTime("")
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddAddon} disabled={!selectedAddonService && (!customAddonName || !customAddonPrice)}>
              Add Add-On
            </Button>
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
      <Dialog open={workflowDialogOpen} onOpenChange={setWorkflowDialogOpen}>
        <DialogContent className="order-dialog-content sm:max-w-[600px]">
          <DialogHeader className="order-dialog-header">
            <DialogTitle>Assign Workflow to Order</DialogTitle>
            <DialogDescription>
              Select a workflow template that matches this order's device type and services
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {suggestedWorkflows.length > 0 ? (
              suggestedWorkflows.map((workflow: any) => (
                <Card key={workflow._id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">{workflow.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {workflow.description}
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAssignWorkflow(workflow._id)}
                        disabled={assigningWorkflow}
                      >
                        Assign
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        {workflow.steps?.length || 0} steps
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {workflow.estimatedTotalTime || 0} min
                      </span>
                      {workflow.deviceTypes && workflow.deviceTypes.length > 0 && (
                        <span>
                          Devices: {workflow.deviceTypes.join(', ')}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No suggested workflows available</p>
                <p className="text-sm">Create workflows in the admin panel that match this order's device type and services</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkflowDialogOpen(false)}>
              Cancel
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