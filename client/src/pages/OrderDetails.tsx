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
import { getOrderById, Order, getOrderProgressTimeline } from "@/api/orders"
import { getConversations, getConversationMessages, sendMessage, startConversation } from "@/api/messages"
import { getAvailableStaff, assignStaffToOrder, StaffMember, getAdminOrderById, removeEPartFromOrder, addAddonToOrder, updateOrderAddon, removeAddonFromOrder, assignStaffToAddon } from "@/api/adminOrders"
import { getUserProfile, UserProfile } from "@/api/user"
import { getAddOnServices, AddOnService as AddOnServiceType, getServices } from "@/api/services"
import { getOrderWorkflows, getSuggestedWorkflowsForOrder, assignWorkflowToOrder } from "@/api/workflow"
import { getOrderServices, addServiceToOrder, updateOrderService, removeServiceFromOrder } from "@/api/orderServices"
import EPartSelectionDialog from "@/components/admin/EPartSelectionDialog"
import { RepairServiceDialog } from "@/components/inspection/RepairServiceDialog"
import { WorkflowExecutionView } from "@/components/workflow/WorkflowExecutionView"
import { InspectionResultsDisplay } from "@/components/inspection/InspectionResultsDisplay"
import { OrderProgressTimeline } from "@/components/OrderProgressTimeline"
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
  X
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
  const [progressTimeline, setProgressTimeline] = useState<any>(null)
  const [repairServices, setRepairServices] = useState<any[]>([])
  const [availableServices, setAvailableServices] = useState<any[]>([])
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<any>(null)
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

        setOrder((orderResponse as any).order)

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
          <InspectionResultsDisplay orderId={id!} />

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
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                {t('orderDetails.deviceInformation')}
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
                  <h3 className="text-xl font-semibold">{order.deviceBrand} {order.deviceModel}</h3>
                  <p className="text-muted-foreground">Repair Services</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {order.services && order.services.filter((s) => s && s._id).length > 0 ? (
                      order.services.filter((s) => s && s._id).map((service) => (
                        <Badge key={service._id} variant="outline">
                          Service #{service._id.substring(0, 8)}
                        </Badge>
                      ))
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
            </CardContent>
          </Card>

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
                            {service.notes && (
                              <p className="text-sm text-muted-foreground">{service.notes}</p>
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

          {/* Workflows - Only visible to admin/staff */}
          {(user?.role === 'admin' || user?.role === 'staff') && (
            <div className="space-y-4">
              {workflows.length > 0 ? (
                workflows.map((workflow: any) => (
                  <WorkflowExecutionView
                    key={workflow._id}
                    orderId={id!}
                    workflow={workflow}
                    onWorkflowUpdate={handleWorkflowUpdate}
                  />
                ))
              ) : (
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
                  </CardHeader>
                  <CardContent>
                    <div className="text-center text-muted-foreground py-8">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>{t('orderDetails.noWorkflowsAssigned')}</p>
                      <p className="text-sm">{t('orderDetails.clickAssignWorkflow')}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
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
    </div>
  )
}