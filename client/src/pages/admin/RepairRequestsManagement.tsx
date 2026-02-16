import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/useToast"
import {
  getRepairRequests,
  getRepairRequestStatistics,
  updateRepairRequestStatus,
  updateRepairRequestPriority,
  updateRepairRequestEstimatedCost,
  assignStaffToRepairRequest,
  addRepairRequestMessage,
  addAdminNote,
  convertRepairRequestToOrder,
  deleteRepairRequest,
  RepairRequest,
  RepairRequestStats
} from "@/api/repairRequests"
import { getStaffMembers, StaffMember } from "@/api/staff"
import { getRepairServices, RepairService } from "@/api/services"
import { getUnreadMessageCount } from "@/api/repairRequestCommunication"
import {
  FileText,
  Search,
  Filter,
  Eye,
  MessageSquare,
  UserPlus,
  DollarSign,
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  Package,
  ArrowUpCircle,
  Send,
  ShoppingCart,
  X,
  Loader2,
  User,
  Mail,
  Phone,
  Calendar,
  FileCheck,
  AlertCircle,
  Info
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { RepairRequestMessagesPanel } from "@/components/repair-request/RepairRequestMessagesPanel"

export function RepairRequestsManagement() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [requests, setRequests] = useState<RepairRequest[]>([])
  const [filteredRequests, setFilteredRequests] = useState<RepairRequest[]>([])
  const [statistics, setStatistics] = useState<RepairRequestStats | null>(null)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [services, setServices] = useState<RepairService[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  // Dialog states
  const [selectedRequest, setSelectedRequest] = useState<RepairRequest | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showMessageDialog, setShowMessageDialog] = useState(false)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showConvertDialog, setShowConvertDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Form states
  const [newMessage, setNewMessage] = useState("")
  const [selectedStaffId, setSelectedStaffId] = useState("")
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [estimatedCost, setEstimatedCost] = useState("")
  const [adminNote, setAdminNote] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    filterRequests()
  }, [requests, searchTerm, statusFilter, priorityFilter])

  const fetchData = async () => {
    try {
      setLoading(true)
      console.log("Fetching repair requests data...")

      const [requestsResponse, statsResponse, staffResponse, servicesResponse] = await Promise.all([
        getRepairRequests(),
        getRepairRequestStatistics(),
        getStaffMembers({}),
        getRepairServices()
      ])

      const requestsData = (requestsResponse as any).requests || []
      setRequests(requestsData)
      setStatistics((statsResponse as any).statistics || null)
      setStaff((staffResponse as any).staff || [])
      setServices((servicesResponse as any).services || [])

      // Fetch unread counts for all requests
      const counts: Record<string, number> = {}
      for (const request of requestsData) {
        try {
          const count = await getUnreadMessageCount(request._id)
          counts[request._id] = count
        } catch (error) {
          console.error(`Error fetching unread count for request ${request._id}:`, error)
          counts[request._id] = 0
        }
      }
      setUnreadCounts(counts)

      console.log("Data loaded successfully")
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error",
        description: "Failed to load repair requests",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const filterRequests = () => {
    let filtered = requests

    if (searchTerm) {
      filtered = filtered.filter(req =>
        req.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.deviceBrand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.deviceModel.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(req => req.status === statusFilter)
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter(req => req.priority === priorityFilter)
    }

    setFilteredRequests(filtered)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500 text-white'
      case 'reviewing':
        return 'bg-blue-500 text-white'
      case 'approved':
        return 'bg-green-500 text-white'
      case 'rejected':
        return 'bg-red-500 text-white'
      case 'converted':
        return 'bg-purple-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-600 text-white'
      case 'high':
        return 'bg-orange-500 text-white'
      case 'medium':
        return 'bg-yellow-500 text-white'
      case 'low':
        return 'bg-gray-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const handleStatusUpdate = async (requestId: string, newStatus: string) => {
    try {
      setActionLoading(true)
      await updateRepairRequestStatus(requestId, newStatus)

      setRequests(requests.map(req =>
        req._id === requestId ? { ...req, status: newStatus as any } : req
      ))

      toast({
        title: "Success",
        description: "Status updated successfully"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive"
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handlePriorityUpdate = async (requestId: string, newPriority: string) => {
    try {
      setActionLoading(true)
      await updateRepairRequestPriority(requestId, newPriority)

      setRequests(requests.map(req =>
        req._id === requestId ? { ...req, priority: newPriority as any } : req
      ))

      toast({
        title: "Success",
        description: "Priority updated successfully"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update priority",
        variant: "destructive"
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCostUpdate = async () => {
    if (!selectedRequest || !estimatedCost) return

    try {
      setActionLoading(true)
      const cost = parseFloat(estimatedCost)

      if (isNaN(cost) || cost < 0) {
        throw new Error("Invalid cost amount")
      }

      await updateRepairRequestEstimatedCost(selectedRequest._id, cost)

      setRequests(requests.map(req =>
        req._id === selectedRequest._id ? { ...req, estimatedCost: cost } : req
      ))

      toast({
        title: "Success",
        description: "Estimated cost updated successfully"
      })

      setEstimatedCost("")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update cost",
        variant: "destructive"
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleAssignStaff = async () => {
    if (!selectedRequest || !selectedStaffId) return

    try {
      setActionLoading(true)
      await assignStaffToRepairRequest(selectedRequest._id, selectedStaffId)

      const staffMember = staff.find(s => s._id === selectedStaffId)

      setRequests(requests.map(req =>
        req._id === selectedRequest._id
          ? {
              ...req,
              assignedStaffId: staffMember ? {
                _id: staffMember._id,
                firstName: staffMember.firstName,
                lastName: staffMember.lastName,
                email: staffMember.email
              } : undefined,
              assignedStaffName: staffMember ? `${staffMember.firstName} ${staffMember.lastName}` : undefined
            }
          : req
      ))

      toast({
        title: "Success",
        description: "Staff assigned successfully"
      })

      setShowAssignDialog(false)
      setSelectedStaffId("")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to assign staff",
        variant: "destructive"
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!selectedRequest || !newMessage.trim()) return

    try {
      setActionLoading(true)
      const response = await addRepairRequestMessage(selectedRequest._id, newMessage)

      setRequests(requests.map(req =>
        req._id === selectedRequest._id ? (response as any).request : req
      ))

      toast({
        title: "Success",
        description: "Message sent successfully"
      })

      setNewMessage("")
      setShowMessageDialog(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive"
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddNote = async () => {
    if (!selectedRequest || !adminNote.trim()) return

    try {
      setActionLoading(true)
      const response = await addAdminNote(selectedRequest._id, adminNote)

      setRequests(requests.map(req =>
        req._id === selectedRequest._id ? (response as any).request : req
      ))

      toast({
        title: "Success",
        description: "Admin note added successfully"
      })

      setAdminNote("")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add note",
        variant: "destructive"
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleConvertToOrder = async () => {
    if (!selectedRequest || selectedServices.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one service",
        variant: "destructive"
      })
      return
    }

    try {
      setActionLoading(true)
      const response = await convertRepairRequestToOrder(selectedRequest._id, {
        services: selectedServices,
        totalCost: selectedRequest.estimatedCost
      })

      // Update the request status to converted
      setRequests(requests.map(req =>
        req._id === selectedRequest._id
          ? {
              ...req,
              status: 'converted',
              convertedToOrderId: (response as any).order
            }
          : req
      ))

      toast({
        title: "Success",
        description: "Repair request converted to order successfully"
      })

      setShowConvertDialog(false)
      setSelectedServices([])

      // Navigate to the order
      if ((response as any).order?._id) {
        navigate(`/admin/orders`)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to convert to order",
        variant: "destructive"
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteRequest = async () => {
    if (!selectedRequest) return

    try {
      setActionLoading(true)
      await deleteRepairRequest(selectedRequest._id)

      setRequests(requests.filter(req => req._id !== selectedRequest._id))

      toast({
        title: "Success",
        description: "Repair request deleted successfully"
      })

      setShowDeleteDialog(false)
      setSelectedRequest(null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete request",
        variant: "destructive"
      })
    } finally {
      setActionLoading(false)
    }
  }

  const openDetailsDialog = (request: RepairRequest) => {
    setSelectedRequest(request)
    setShowDetailsDialog(true)
  }

  const openMessageDialog = (request: RepairRequest) => {
    setSelectedRequest(request)
    setShowMessageDialog(true)
  }

  const openAssignDialog = (request: RepairRequest) => {
    setSelectedRequest(request)
    setShowAssignDialog(true)
  }

  const openConvertDialog = (request: RepairRequest) => {
    setSelectedRequest(request)
    setShowConvertDialog(true)
  }

  const openDeleteDialog = (request: RepairRequest) => {
    setSelectedRequest(request)
    setShowDeleteDialog(true)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Repair Requests Management
        </h1>
        <p className="text-muted-foreground">
          Manage customer repair service requests and convert them to orders
        </p>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Total Requests
              </CardTitle>
              <FileText className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {statistics.total}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                Pending
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                {statistics.byStatus.pending}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Reviewing
              </CardTitle>
              <Eye className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {statistics.byStatus.reviewing}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                Converted
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {statistics.byStatus.converted}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
                High Priority
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                {statistics.highPriority}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by request number, customer, or device..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Repair Requests ({filteredRequests.length})</CardTitle>
          <CardDescription>
            All repair service requests from customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Est. Cost</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No repair requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((request) => (
                    <TableRow
                      key={request._id}
                      onClick={() => openDetailsDialog(request)}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{request.requestNumber}</span>
                          {unreadCounts[request._id] > 0 && (
                            <Badge variant="destructive" className="h-6 w-6 flex items-center justify-center p-0 text-xs">
                              {unreadCounts[request._id]}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={request.customerId?.avatar} />
                            <AvatarFallback>
                              {request.customerName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{request.customerName}</div>
                            <div className="text-xs text-muted-foreground">{request.customerEmail}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{request.deviceBrand}</div>
                          <div className="text-muted-foreground">{request.deviceModel}</div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="text-sm truncate">{request.issueDescription}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(request.status)}>
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(request.priority)}>
                          {request.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {request.assignedStaffName ? (
                          <div className="text-sm">{request.assignedStaffName}</div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {request.estimatedCost > 0 ? (
                          <span className="font-medium">${request.estimatedCost}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetailsDialog(request)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openMessageDialog(request)}>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Send Message
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openAssignDialog(request)}>
                              <UserPlus className="mr-2 h-4 w-4" />
                              Assign Staff
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {request.status !== 'converted' && (
                              <DropdownMenuItem onClick={() => openConvertDialog(request)}>
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                Convert to Order
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(request)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Details - {selectedRequest?.requestNumber}</DialogTitle>
            <DialogDescription>
              Complete information about this repair request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {/* Customer Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">{selectedRequest.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{selectedRequest.customerEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="font-medium">{selectedRequest.customerPhone}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Device Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Device Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium">{selectedRequest.deviceType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Brand:</span>
                    <span className="font-medium">{selectedRequest.deviceBrand}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model:</span>
                    <span className="font-medium">{selectedRequest.deviceModel}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Issue Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Issue Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Description:</Label>
                    <p className="mt-1 whitespace-pre-wrap">{selectedRequest.issueDescription}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">When Occurred:</Label>
                    <p className="mt-1">{selectedRequest.issueOccurredDate}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Repair Attempts:</Label>
                    <p className="mt-1 whitespace-pre-wrap">{selectedRequest.repairAttempts}</p>
                  </div>
                  {selectedRequest.additionalInfo && (
                    <div>
                      <Label className="text-muted-foreground">Additional Info:</Label>
                      <p className="mt-1 whitespace-pre-wrap">{selectedRequest.additionalInfo}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Images */}
              {selectedRequest.images && selectedRequest.images.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Device Images</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      {selectedRequest.images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`Device ${idx + 1}`}
                          className="w-full h-32 object-cover rounded-lg border"
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Status and Priority Updates */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Status & Priority</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={selectedRequest.status}
                        onValueChange={(value) => handleStatusUpdate(selectedRequest._id, value)}
                        disabled={actionLoading}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="reviewing">Reviewing</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="converted">Converted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={selectedRequest.priority}
                        onValueChange={(value) => handlePriorityUpdate(selectedRequest._id, value)}
                        disabled={actionLoading}
                      >
                        <SelectTrigger>
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

                  <div className="space-y-2">
                    <Label>Estimated Cost ($)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Enter cost"
                        value={estimatedCost}
                        onChange={(e) => setEstimatedCost(e.target.value)}
                      />
                      <Button onClick={handleCostUpdate} disabled={actionLoading || !estimatedCost}>
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Current: ${selectedRequest.estimatedCost || 0}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Admin Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Admin Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Add internal note..."
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      rows={3}
                    />
                    <Button onClick={handleAddNote} disabled={actionLoading || !adminNote.trim()}>
                      Add Note
                    </Button>
                  </div>

                  {selectedRequest.adminNotes && selectedRequest.adminNotes.length > 0 && (
                    <div className="space-y-2">
                      {selectedRequest.adminNotes.map((note, idx) => (
                        <div key={idx} className="p-3 bg-muted rounded-lg text-sm">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium">{note.staffName}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(note.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap">{note.note}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Communication & Messaging Panel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Communication</CardTitle>
                </CardHeader>
                <CardContent>
                  <RepairRequestMessagesPanel
                    requestId={selectedRequest._id}
                    userRole="admin"
                    isReadOnly={false}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Message to Customer</DialogTitle>
            <DialogDescription>
              Communicate with {selectedRequest?.customerName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Previous Messages */}
            {selectedRequest && selectedRequest.messages && selectedRequest.messages.length > 0 && (
              <ScrollArea className="h-[200px] border rounded-lg p-4">
                <div className="space-y-3">
                  {selectedRequest.messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        msg.senderRole === 'customer'
                          ? 'bg-blue-50 dark:bg-blue-950/20'
                          : 'bg-gray-50 dark:bg-gray-900/20'
                      }`}
                    >
                      <div className="flex justify-between mb-1 text-xs">
                        <span className="font-medium">{msg.senderName}</span>
                        <span className="text-muted-foreground">
                          {new Date(msg.sentAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="space-y-2">
              <Label>Your Message</Label>
              <Textarea
                placeholder="Type your message here..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={5}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessageDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendMessage} disabled={actionLoading || !newMessage.trim()}>
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Message
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Staff Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Staff Member</DialogTitle>
            <DialogDescription>
              Assign a technician to review this request
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Staff Member</Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((member) => (
                    <SelectItem key={member._id} value={member._id}>
                      {member.firstName} {member.lastName} - {member.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRequest?.assignedStaffName && (
              <p className="text-sm text-muted-foreground">
                Currently assigned to: {selectedRequest.assignedStaffName}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignStaff} disabled={actionLoading || !selectedStaffId}>
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Assign
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Order Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Convert to Order</DialogTitle>
            <DialogDescription>
              Select services to create an order from this repair request
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm">
                This will create a new repair order and mark the request as converted.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Label>Select Services</Label>
              <ScrollArea className="h-[300px] border rounded-lg p-4">
                <div className="space-y-2">
                  {services.map((service) => (
                    <div key={service._id} className="flex items-start space-x-3 p-3 hover:bg-muted rounded-lg">
                      <Checkbox
                        id={service._id}
                        checked={selectedServices.includes(service._id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedServices([...selectedServices, service._id])
                          } else {
                            setSelectedServices(selectedServices.filter(id => id !== service._id))
                          }
                        }}
                      />
                      <div className="flex-1">
                        <label htmlFor={service._id} className="text-sm font-medium cursor-pointer">
                          {service.name}
                        </label>
                        <p className="text-xs text-muted-foreground">{service.description}</p>
                        <p className="text-xs font-semibold mt-1">${service.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {selectedServices.length > 0 && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Selected services:</span>
                  <span className="font-bold">{selectedServices.length}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Estimated cost:</span>
                  <span className="font-bold">
                    ${services
                      .filter(s => selectedServices.includes(s._id))
                      .reduce((sum, s) => sum + s.price, 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConvertToOrder}
              disabled={actionLoading || selectedServices.length === 0}
              className="bg-gradient-to-r from-purple-500 to-indigo-500"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Convert to Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Repair Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this repair request? This action cannot be undone.
              Request #{selectedRequest?.requestNumber}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRequest}
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
