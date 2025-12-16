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
import { getOrderById, Order, getOrderProgressTimeline, addShopProductToOrder, removeShopProductFromOrder, updateShopProductQuantity, ShopProduct } from "@/api/orders"
import { getConversations, getConversationMessages, sendMessage, startConversation } from "@/api/messages"
import { getAvailableStaff, assignStaffToOrder, StaffMember, getAdminOrderById, removeEPartFromOrder, addAddonToOrder, updateOrderAddon, removeAddonFromOrder, assignStaffToAddon, confirmUnlockCode, updateOrderDevice } from "@/api/adminOrders"
import { getUserProfile, UserProfile } from "@/api/user"
import { getAddOnServices, AddOnService as AddOnServiceType, getServices } from "@/api/services"
import { getOrderWorkflows, getSuggestedWorkflowsForOrder, assignWorkflowToOrder, deleteWorkflowFromOrder, startWorkflow, updateWorkflowStatus } from "@/api/workflow"
import { getOrderServices, addServiceToOrder, updateOrderService, removeServiceFromOrder } from "@/api/orderServices"
import { searchDevices, SearchResult } from "@/api/devices"
import EPartSelectionDialog from "@/components/admin/EPartSelectionDialog"
import { ShopProductSelectionDialog } from "@/components/admin/ShopProductSelectionDialog"
import { RepairServiceDialog } from "@/components/inspection/RepairServiceDialog"
import { WorkflowExecutionView } from "@/components/workflow/WorkflowExecutionView"
import { WorkflowCard } from "@/components/admin/WorkflowCard"
import { WorkflowExecutionModal } from "@/components/admin/WorkflowExecutionModal"
import { InspectionResultsDisplay } from "@/components/inspection/InspectionResultsDisplay"
import { OrderProgressTimeline } from "@/components/OrderProgressTimeline"
import { UnlockInformationDisplay } from "@/components/inspection/UnlockInformationDisplay"
import { ConfirmUnlockDialog } from "@/components/inspection/ConfirmUnlockDialog"
import { DeviceChangeDialog } from "@/components/admin/DeviceChangeDialog"
import { TrackingPanel } from "@/components/admin/TrackingPanel"
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
  ArrowLeft,
  Package,
  ShoppingCart,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  DollarSign,
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
  Edit,
  X,
  Lock,
  HelpCircle,
  FileText,
  Droplets,
  Info
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
        if (user?.role === 'admin' || user?.role === 'staff') {
          console.log("Using admin API to fetch order details")
          orderResponse = await getAdminOrderById(id)
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
      try {
        const response = await getAvailableStaff()
        setAvailableStaff((response as any).staff || [])
      } catch (error) {
        console.error("Error fetching available staff:", error)
      }
    }

    fetchAvailableStaff()
  }, [])

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
      if (!id || !user || (user.role !== 'admin' && user.role !== 'staff')) return

      try {
        console.log("Fetching repair services for order:", id)

        // Fetch available services
        const servicesResponse = await getServices()
        setAvailableServices((servicesResponse as any).services || [])

        // Fetch repair services for this order
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
        return 'bg-green-500 text-white'
      case 'in-progress':
        return 'bg-blue-500 text-white'
      case 'quality-check':
        return 'bg-yellow-500 text-black'
      case 'ready-for-pickup':
        return 'bg-purple-500 text-white'
      case 'pending':
        return 'bg-gray-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
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
        return 'bg-green-500 text-white'
      case 'pending':
        return 'bg-yellow-500 text-black'
      case 'refunded':
        return 'bg-red-500 text-white'
      case 'partial':
        return 'bg-orange-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  // Helper function to get device image or fallback
  const getDeviceImage = (order: Order) => {
    if (order.photos && order.photos.length > 0) {
      return order.photos[0]
    }
    return null
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-8 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-20 bg-muted rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Order not found</h3>
            <p className="text-muted-foreground mb-4">
              The order you're looking for doesn't exist
            </p>
            <Button asChild>
              <Link to="/orders">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('orderDetails.backToOrders')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link to="/orders">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('orderDetails.backToOrders')}
        </Link>
      </Button>

      {/* Order Header */}
      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10">
        <CardHeader>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Package className="h-6 w-6" />
                Order #{order.orderNumber || order._id.slice(-6)}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {order.deviceBrand} {order.deviceModel} • Created {new Date(order.createdAt).toLocaleDateString()}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <Badge className={`${getStatusColor(order.status)} text-lg px-4 py-2`}>
                {getStatusIcon(order.status)}
                <span className="ml-2">{order.status.replace('-', ' ')}</span>
              </Badge>
              <Badge className={`${getPaymentStatusColor(order.paymentStatus)} text-sm px-3 py-1`}>
                <CreditCard className="h-3 w-3 mr-1" />
                {order.paymentStatus}
              </Badge>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">${order.totalCost}</p>
                <p className="text-sm text-muted-foreground">Total Cost</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Overall Progress Timeline */}
      {progressTimeline && (
        <OrderProgressTimeline
          stages={progressTimeline.stages}
          currentStage={progressTimeline.currentStage}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Additional Repair Information */}
          {(order.errorDescription || order.waterDamage || order.previousRepairAttempts || order.itemCondition) && (
            <Card className="border-2 border-amber-300 dark:border-amber-700">
              <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  Additional Repair Information
                </CardTitle>
                <CardDescription>
                  {t('orderDetails.repairInfo.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Error Description */}
                  {order.errorDescription && (
                    <div className="bg-white/50 dark:bg-gray-900/30 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-100 mb-2">
                            {t('orderDetails.repairInfo.errorDescriptionLabel')}
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {order.errorDescription}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Water Damage */}
                  {order.waterDamage && (
                    <div className="bg-white/50 dark:bg-gray-900/30 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Droplets className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-100">
                            {t('orderDetails.repairInfo.waterDamageLabel')}
                          </h4>
                        </div>
                        <Badge
                          variant={order.waterDamage === 'yes' ? 'destructive' : order.waterDamage === 'no' ? 'default' : 'secondary'}
                          className={
                            order.waterDamage === 'yes'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300'
                              : order.waterDamage === 'no'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                          }
                        >
                          {t(`orderDetails.repairInfo.waterDamage.${order.waterDamage}`)}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Previous Repair Attempts */}
                  {order.previousRepairAttempts && (
                    <div className="bg-white/50 dark:bg-gray-900/30 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-100">
                              {t('orderDetails.repairInfo.previousRepairLabel')}
                            </h4>
                          </div>
                          <Badge
                            variant={order.previousRepairAttempts === 'yes' ? 'secondary' : 'default'}
                            className={
                              order.previousRepairAttempts === 'yes'
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300'
                                : order.previousRepairAttempts === 'no'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }
                          >
                            {t(`orderDetails.repairInfo.previousRepair.${order.previousRepairAttempts}`)}
                          </Badge>
                        </div>
                        {order.previousRepairAttempts === 'yes' && order.previousRepairDetails && (
                          <div className="ml-8 pl-4 border-l-2 border-amber-400">
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                              {order.previousRepairDetails}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Item Condition */}
                  {order.itemCondition && (
                    <div className="bg-white/50 dark:bg-gray-900/30 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Package className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-100">
                            {t('orderDetails.repairInfo.itemConditionLabel')}
                          </h4>
                        </div>
                        <Badge
                          variant="secondary"
                          className={
                            order.itemCondition === 'original'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300'
                              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300'
                          }
                        >
                          {t(`orderDetails.repairInfo.itemCondition.${order.itemCondition}`)}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Information Notice */}
                  <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
                        {t('orderDetails.repairInfo.infoNotice')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('orderDetails.customerInformation')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={order.customerId.avatar} />
                  <AvatarFallback className="text-lg">
                    {order.customerId.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{order.customerId.name}</h3>
                  <p className="text-muted-foreground flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4" />
                    {order.customerId.email}
                  </p>
                  <p className="text-muted-foreground flex items-center gap-2 mt-1">
                    <Phone className="h-4 w-4" />
                    {order.customerId.phone}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('orderDetails.customerSince')} {new Date(order.customerId.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Address Information */}
              {order.customerId.address && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    {t('orderDetails.address')}
                  </h4>
                  <div className="text-sm text-muted-foreground">
                    <p>{order.customerId.address.street}</p>
                    <p>{order.customerId.address.city}, {order.customerId.address.state} {order.customerId.address.zipCode}</p>
                    <p>{order.customerId.address.country}</p>
                  </div>
                </div>
              )}

              {/* Payment Methods */}
              {order.customerId.paymentMethods && order.customerId.paymentMethods.length > 0 && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {t('orderDetails.paymentMethods')}
                  </h4>
                  <div className="space-y-2">
                    {order.customerId.paymentMethods.map((method) => (
                      <div key={`${method.type}-${method.last4}`} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{method.type} ending in {method.last4}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {method.expiryMonth}/{method.expiryYear}
                          </span>
                          {method.isDefault && (
                            <Badge variant="secondary" className="text-xs">{t('orderDetails.default')}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Device Inspection Section - visible to all roles when inspection is completed */}
          <InspectionResultsDisplay orderId={id!} userRole={user?.role} />

          {/* Assigned Staff - Only visible to admin/staff */}
          {(user?.role === 'admin' || user?.role === 'staff') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('orderDetails.assignedStaff')}
                </div>
                <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <UserPlus className="h-4 w-4 mr-2" />
                      {t('orderDetails.assignStaff')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>{t('orderDetails.assignStaffToOrder')}</DialogTitle>
                      <DialogDescription>
                        {t('orderDetails.selectStaffMembers')}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 max-h-64 overflow-y-auto">
                      {availableStaff.map((staff) => (
                        <div key={staff._id} className="flex items-center space-x-3">
                          <Checkbox
                            id={staff._id}
                            checked={selectedStaff.includes(staff._id)}
                            onCheckedChange={(checked) => handleStaffToggle(staff._id, checked as boolean)}
                          />
                          <div className="flex items-center gap-3 flex-1">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={staff.avatar} />
                              <AvatarFallback>
                                {staff.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{staff.name}</p>
                              <p className="text-sm text-muted-foreground">{staff.email}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {staff.specializations.slice(0, 2).map((spec) => (
                                  <Badge key={spec} variant="secondary" className="text-xs">
                                    {spec}
                                  </Badge>
                                ))}
                                {staff.specializations.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{staff.specializations.length - 2} {t('orderDetails.more')}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleStaffAssignment}
                        disabled={selectedStaff.length === 0 || assigningStaff}
                      >
                        {assigningStaff ? t('orderDetails.assigning') : t('orderDetails.assignStaff')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.assignedStaff && order.assignedStaff.length > 0 ? (
                <div className="space-y-3">
                  {order.assignedStaff.map((staff) => (
                    <div key={staff._id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={staff.avatar} />
                        <AvatarFallback>
                          {staff.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{staff.name}</p>
                        <p className="text-sm text-muted-foreground">{t('orderDetails.repairTechnician')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t('orderDetails.noStaffAssigned')}</p>
                  <p className="text-sm">{t('orderDetails.clickAssignStaff')}</p>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Device Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  {t('orderDetails.deviceInformation')}
                </div>
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
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {t('common.edit')}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {getDeviceImage(order) ? (
                  <img
                    src={getDeviceImage(order)}
                    alt={`${order.deviceBrand} ${order.deviceModel}`}
                    className="w-24 h-24 rounded-lg object-cover border-2 border-primary/20"
                    onError={(e) => {
                      // Replace with fallback on error
                      e.currentTarget.style.display = 'none'
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement
                      if (fallback) fallback.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div className="w-24 h-24 rounded-lg border-2 border-primary/20 bg-primary/10 flex items-center justify-center" style={{ display: getDeviceImage(order) ? 'none' : 'flex' }}>
                  <Smartphone className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-semibold">{order.deviceBrand} {order.deviceModel}</h3>
                    {(user?.role === 'admin' || user?.role === 'staff') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeviceChangeDialogOpen(true)}
                        className="text-xs gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        Change Device
                      </Button>
                    )}
                  </div>
                  <p className="text-muted-foreground">Repair Services</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {order.services && order.services.filter((s) => s && s._id).length > 0 ? (
                      order.services.filter((s) => s && s._id).map((service) => {
                        // Get service name from populated serviceId object or fallback to ID
                        const serviceName = typeof service.serviceId === 'object'
                          ? service.serviceId?.name
                          : service.serviceName || `Service #${String(service._id).substring(0, 8)}`;
                        const servicePrice = typeof service.serviceId === 'object'
                          ? service.serviceId?.price || service.price
                          : service.price;

                        return (
                          <Badge key={service._id} variant="outline" className="text-xs">
                            {serviceName}
                            {servicePrice && <span className="ml-1 font-semibold">${servicePrice.toFixed(2)}</span>}
                          </Badge>
                        );
                      })
                    ) : (
                      <Badge variant="outline">{t('orderDetails.noServicesSelected')}</Badge>
                    )}
                  </div>
                </div>
              </div>

              {order.customerNotes && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">{t('orderDetails.yourNotes')}:</h4>
                  <p className="text-sm text-muted-foreground">{order.customerNotes}</p>
                </div>
              )}

              {/* Unlock Information Display - Integrated into Device Information Section */}
              {(order?.unlockPattern?.length > 0 || order?.unlockCode || order?.noLock) && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    {t('orderDetails.deviceLockInformation', 'Device Lock Information')}
                  </h4>

                  <div className="space-y-3">
                    {/* Unlock Pattern Display */}
                    {order.unlockPattern && order.unlockPattern.length > 0 && (
                      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                          {t('orderDetails.unlockPattern', 'Unlock Pattern')}
                        </p>
                        <div className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
                          {order.unlockPattern.join(' → ')}
                        </div>
                        <span className="text-xs text-slate-500">({order.unlockPattern.length} {t('orderDetails.dots', 'dots')})</span>
                      </div>
                    )}

                    {/* Unlock Code Display */}
                    {order.unlockCode && (
                      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                          {t('orderDetails.unlockCode', 'Unlock Code')}
                        </p>
                        <input
                          type="password"
                          value={order.unlockCode}
                          readOnly
                          className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-sm"
                        />
                      </div>
                    )}

                    {/* No Lock Display */}
                    {order.noLock && (
                      <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2">
                          <X className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <p className="text-sm font-medium text-green-700 dark:text-green-300">
                            {t('orderDetails.unlockNoLock', 'Device has no lock')}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Confirmation Status */}
                    {order.unlockConfirmation && order.unlockConfirmation.confirmationStatus && (
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                          {t('orderDetails.confirmationStatus', 'Confirmation Status')}
                        </p>
                        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-2">
                            {order.unlockConfirmation.confirmationStatus === 'verified' && (
                              <Badge className="bg-green-100 border-green-300 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {t('orderDetails.unlockVerified', 'Verified')}
                              </Badge>
                            )}
                            {order.unlockConfirmation.confirmationStatus === 'incorrect' && (
                              <Badge className="bg-red-100 border-red-300 text-red-800">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {t('orderDetails.unlockIncorrect', 'Incorrect')}
                              </Badge>
                            )}
                            {order.unlockConfirmation.confirmationStatus === 'unable-to-verify' && (
                              <Badge variant="outline" className="bg-gray-50 border-gray-300 text-gray-800">
                                <HelpCircle className="h-3 w-3 mr-1" />
                                {t('orderDetails.unlockUnableToVerify', 'Unable to Verify')}
                              </Badge>
                            )}
                          </div>
                          <p>
                            <span className="font-medium">
                              {t('orderDetails.confirmedBy', 'Confirmed by:')}
                            </span>{' '}
                            {order.unlockConfirmation.confirmedByName}
                          </p>
                          {order.unlockConfirmation.notes && (
                            <p>
                              <span className="font-medium">
                                {t('orderDetails.notes', 'Notes:')}
                              </span>{' '}
                              {order.unlockConfirmation.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Confirm Button for Staff/Admin - Only show if not confirmed or can re-confirm */}
                    {(user?.role === 'admin' || user?.role === 'staff') && (
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUnlockConfirmDialogOpen(true)}
                          className="w-full text-xs"
                        >
                          {order.unlockConfirmation
                            ? t('orderDetails.updateConfirmation', 'Update Confirmation')
                            : t('orderDetails.confirmUnlock', 'Confirm Unlock Information')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipping & Tracking Section - Only for Admin and Staff */}
          {(user?.role === 'admin' || user?.role === 'staff') && (
            <TrackingPanel
              orderId={id || ''}
              orderData={order}
              onUpdate={refreshOrder}
            />
          )}

          {/* Device Change Dialog */}
          <Dialog open={deviceChangeDialogOpen} onOpenChange={setDeviceChangeDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
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

          {/* Unlock Information Display - Prominently display device unlock details */}
          {(order?.unlockPattern?.length > 0 || order?.unlockCode || order?.noLock) && (
            <>
              <UnlockInformationDisplay
                unlockPattern={order?.unlockPattern}
                unlockCode={order?.unlockCode}
                noLock={order?.noLock}
                unlockConfirmation={order?.unlockConfirmation}
                onConfirmClick={() => setUnlockConfirmDialogOpen(true)}
                canConfirm={user?.role === 'admin' || user?.role === 'staff'}
              />
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
            </>
          )}

          {/* Repair Services - Only visible to admin/staff */}
          {(user?.role === 'admin' || user?.role === 'staff') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    {t('orderDetails.repairServices')}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingService(null)
                      setServiceDialogOpen(true)
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('orderDetails.addService')}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {repairServices && repairServices.filter((s) => s && s._id).length > 0 ? (
                  <div className="space-y-4">
                    {repairServices.filter((s) => s && s._id).map((service, index) => (
                      <div key={service._id || `service-${index}`} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex-1">
                            <h4 className="font-medium">{service.serviceId?.name || 'Service'}</h4>
                            {service.serviceId?.description && (
                              <p className="text-sm text-muted-foreground mt-1">{service.serviceId.description}</p>
                            )}
                            {service.notes && (
                              <p className="text-sm text-muted-foreground italic">{service.notes}</p>
                            )}
                            {service.estimatedTime && (
                              <p className="text-xs text-muted-foreground mt-1">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {service.estimatedTime} min
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium">${service.price}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditServiceDialog(service)}
                              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => service._id && handleDeleteRepairService(service._id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Wrench className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>{t('orderDetails.noRepairServices')}</p>
                    <p className="text-sm">{t('orderDetails.clickAddService')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Add-On Services */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {t('orderDetails.addOnServices')}
                </div>
                {(user?.role === 'admin' || user?.role === 'staff') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddAddonDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('orderDetails.addAddOn')}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.addOns && order.addOns.length > 0 ? (
                <div className="space-y-4">
                  {order.addOns.map((addOn) => (
                    <div key={addOn._id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-3 h-3 rounded-full ${
                          addOn.status === 'completed' ? 'bg-green-500' :
                          addOn.status === 'in-progress' ? 'bg-blue-500' :
                          'bg-gray-500'
                        }`} />
                        <div className="flex-1">
                          <h4 className="font-medium">{addOn.name}</h4>
                          <p className="text-sm text-muted-foreground">{addOn.description}</p>
                          {addOn.estimatedTime && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {addOn.estimatedTime}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <Badge className={getStatusColor(addOn.status)}>
                            {addOn.status}
                          </Badge>
                          <p className="text-sm text-muted-foreground mt-1">+${addOn.price}</p>
                        </div>
                        {(user?.role === 'admin' || user?.role === 'staff') && (
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditAddonDialog(addOn)}
                              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openAssignAddonStaffDialog(addOn)}
                              className="text-green-500 hover:text-green-700 hover:bg-green-50"
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveAddon(addOn._id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{t('orderDetails.noAddOnServices')}</p>
                  {(user?.role === 'admin' || user?.role === 'staff') && (
                    <p className="text-sm">{t('orderDetails.clickAddAddOn')}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* EParts - Only visible to admin/staff */}
          {(user?.role === 'admin' || user?.role === 'staff') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    {t('orderDetails.electronicParts')}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEPartDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('orderDetails.addEPart')}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(order as any).eParts && (order as any).eParts.length > 0 ? (
                  <div className="space-y-4">
                    {(order as any).eParts.map((ePart: any) => {
                      const version = ePart.partId?.versions?.find((v: any) => v._id === ePart.versionId);

                      return (
                        <div key={ePart._id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-medium">{ePart.partId?.itemName || 'Unknown Part'}</h4>
                              {version && (
                                <Badge className={getVersionTypeColor(version.versionType)}>
                                  {version.versionType.toUpperCase()}
                                </Badge>
                              )}
                              <Badge variant="outline" className={
                                ePart.status === 'used' ? 'bg-green-50 text-green-700' :
                                ePart.status === 'allocated' ? 'bg-blue-50 text-blue-700' :
                                'bg-gray-50 text-gray-700'
                              }>
                                {ePart.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {ePart.partId?.itemDescription || 'No description available'}
                            </p>
                            <div className="flex gap-4 mt-2 text-sm">
                              <span className="text-muted-foreground">
                                SKU: <span className="font-medium text-foreground">{ePart.partId?.sku || 'N/A'}</span>
                              </span>
                              <span className="text-muted-foreground">
                                Quantity: <span className="font-medium text-foreground">{ePart.quantity}</span>
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
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Wrench className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>{t('orderDetails.noElectronicParts')}</p>
                    <p className="text-sm">{t('orderDetails.clickAddEPart')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Shop Products - Only visible to admin/staff */}
          {(user?.role === 'admin' || user?.role === 'staff') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Shop Products
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShopProductDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(order as any).shopProducts && (order as any).shopProducts.length > 0 ? (
                  <div className="space-y-4">
                    {(order as any).shopProducts.map((shopProduct: any) => {
                      const product = shopProduct.productId;
                      const totalPrice = shopProduct.priceAtOrder * shopProduct.quantity;

                      return (
                        <div key={shopProduct._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                          <div className="flex items-start gap-4 flex-1">
                            {product?.images && product.images.length > 0 && (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="w-16 h-16 object-cover rounded-md"
                              />
                            )}
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-3">
                                <h4 className="font-medium">{product?.name || 'Unknown Product'}</h4>
                                <Badge variant="outline">
                                  {product?.category}
                                </Badge>
                              </div>
                              <div className="flex gap-6 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <span>Brand:</span>
                                  <span className="font-medium text-foreground">{product?.brand || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span>Price:</span>
                                  <span className="font-medium text-foreground">${shopProduct.priceAtOrder?.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span>Quantity:</span>
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
                                    className="w-20 h-8"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span>Total:</span>
                                  <span className="font-bold text-foreground">${totalPrice.toFixed(2)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>
                                  Added: {new Date(shopProduct.addedAt).toLocaleDateString()}
                                </span>
                                {shopProduct.addedBy && (
                                  <span>
                                    By: {shopProduct.addedBy.name}
                                  </span>
                                )}
                                {product?.stock !== undefined && (
                                  <Badge variant={product.stock > 10 ? 'default' : product.stock > 0 ? 'secondary' : 'destructive'}>
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
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No shop products added</p>
                    <p className="text-sm">Click "Add Product" to add products from the shop to this order</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Workflows - Only visible to admin/staff */}
          {(user?.role === 'admin' || user?.role === 'staff') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    {t('orderDetails.workflows')}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWorkflowDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('orderDetails.assignWorkflow')}
                  </Button>
                </CardTitle>
                {workflows.length > 0 && (
                  <CardDescription>
                    {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} assigned to this order
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {workflows.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
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
                  <div className="text-center text-muted-foreground py-8">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>{t('orderDetails.noWorkflowsAssigned')}</p>
                    <p className="text-sm">{t('orderDetails.clickAssignWorkflow')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Progress Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {t('orderDetails.repairProgress')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{t('orderDetails.overallProgress')}</span>
                  <span className="text-sm text-muted-foreground">{order.progress}%</span>
                </div>
                <Progress value={order.progress} className="h-3" />
                {order.estimatedCompletion && order.status !== 'completed' && (
                  <p className="text-sm text-muted-foreground">
                    {t('orderDetails.estimatedCompletion')}: {new Date(order.estimatedCompletion).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">{t('orderDetails.repairTimeline')}</h4>
                <div className="space-y-3">
                  {[
                    { step: "Order Received", completed: true, date: order.createdAt },
                    { step: "Diagnostic Assessment", completed: order.progress >= 25, date: order.createdAt },
                    { step: "Repair in Progress", completed: order.progress >= 50, date: null },
                    { step: "Quality Check", completed: order.progress >= 75, date: null },
                    { step: "Ready for Pickup", completed: order.progress >= 100, date: null }
                  ].map((step) => (
                    <div key={step.step} className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        step.completed
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-300 bg-background'
                      }`}>
                        {step.completed && <CheckCircle className="h-3 w-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${step.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {step.step}
                        </p>
                        {step.date && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(step.date).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {t('orderDetails.orderSummary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {order.services && order.services.filter((s) => s && s._id).length > 0 ? (
                  order.services.filter((s) => s && s._id).map((service) => (
                    <div key={service._id} className="flex justify-between text-sm">
                      <span>Service #{service._id.substring(0, 8)}</span>
                      <span>${service.price}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between text-sm">
                    <span>No services</span>
                    <span>$0</span>
                  </div>
                )}
                {order.addOns && order.addOns.map((addOn) => (
                  <div key={addOn._id} className="flex justify-between text-sm">
                    <span>{addOn.name}</span>
                    <span>${addOn.price}</span>
                  </div>
                ))}
                {(order as any).shopProducts && (order as any).shopProducts.map((shopProduct: any) => (
                  <div key={shopProduct._id} className="flex justify-between text-sm">
                    <span>{shopProduct.productId?.name || 'Product'} x{shopProduct.quantity}</span>
                    <span>${(shopProduct.priceAtOrder * shopProduct.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span>${order.totalCost}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Payment Status</span>
                <Badge className={getPaymentStatusColor(order.paymentStatus)}>
                  {order.paymentStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline">
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
              <Button className="w-full" variant="outline">
                <Camera className="h-4 w-4 mr-2" />
                Upload Photos
              </Button>
              <Button className="w-full" variant="outline">
                <Star className="h-4 w-4 mr-2" />
                Rate Service
              </Button>
            </CardContent>
          </Card>

          {/* Communication */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-64 overflow-y-auto space-y-3">
                {messages.map((message) => (
                  <div key={message._id} className={`flex gap-2 ${
                    message.senderRole === 'customer' ? 'justify-end' : 'justify-start'
                  }`}>
                    <div className={`max-w-xs p-3 rounded-lg ${
                      message.senderRole === 'customer'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}>
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="min-h-[60px]"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
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
                      {addon.name} - ${addon.price}
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
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
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
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