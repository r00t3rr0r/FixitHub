import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import "./RepairRequestsManagement.css"
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
  Phone,
  Calendar,
  FileCheck,
  AlertCircle,
  Info,
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
  DialogClose,
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
import { CommunicationPanel } from "@/components/inspection/CommunicationPanel"
import { ContactMessagesPanel } from "@/components/admin/ContactMessagesPanel"

type RepairRequestsManagementView = "repair-requests" | "contact-messages"

interface RepairRequestsManagementProps {
  view?: RepairRequestsManagementView
}

export function RepairRequestsManagement({ view = "repair-requests" }: RepairRequestsManagementProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()

  const [requests, setRequests] = useState<RepairRequest[]>([])
  const [filteredRequests, setFilteredRequests] = useState<RepairRequest[]>([])
  const [statistics, setStatistics] = useState<RepairRequestStats | null>(null)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [services, setServices] = useState<RepairService[]>([])
  const [loading, setLoading] = useState(view === "repair-requests")
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
  const detailsDialogHeaderClass = "relative -mx-6 -mt-6 mb-2 rounded-t-lg bg-[#1a2a5e] px-6 py-3 text-white"
  const isDetailsDialogClosingRef = useRef(false)

  useEffect(() => {
    if (view !== "repair-requests") return
    fetchData()
  }, [view])

  useEffect(() => {
    if (view !== "repair-requests") return
    filterRequests()
  }, [requests, searchTerm, statusFilter, priorityFilter, view])

  useEffect(() => {
    if (!selectedRequest) return
    setSelectedStaffId(selectedRequest.assignedStaffId?._id || "")
    setEstimatedCost(
      typeof selectedRequest.estimatedCost === "number" && selectedRequest.estimatedCost > 0
        ? String(selectedRequest.estimatedCost)
        : ""
    )
  }, [selectedRequest?._id])

  useEffect(() => {
    const requestId = searchParams.get("requestId")
    if (!requestId || requests.length === 0) return
    if (isDetailsDialogClosingRef.current) return

    const request = requests.find((req) => req._id === requestId)
    if (!request) return
    if (showDetailsDialog && selectedRequest?._id === requestId) return

    setSelectedRequest(request)
    setShowDetailsDialog(true)
  }, [searchParams, requests, selectedRequest?._id, showDetailsDialog])

  useEffect(() => {
    const requestId = searchParams.get("requestId")
    if (!requestId) {
      isDetailsDialogClosingRef.current = false
    }
  }, [searchParams])

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

  const getStatusLabel = (status: RepairRequest["status"]) => {
    switch (status) {
      case "pending":
        return "Ausstehend"
      case "reviewing":
        return "In Prüfung"
      case "approved":
        return "Genehmigt"
      case "rejected":
        return "Abgelehnt"
      case "converted":
        return "Umgewandelt"
      default:
        return status
    }
  }

  const getPriorityLabel = (priority: RepairRequest["priority"]) => {
    switch (priority) {
      case "urgent":
        return "Dringend"
      case "high":
        return "Hoch"
      case "medium":
        return "Mittel"
      case "low":
        return "Niedrig"
      default:
        return priority
    }
  }

  const updateRequestInState = (requestId: string, updater: (request: RepairRequest) => RepairRequest) => {
    setRequests((prev) => prev.map((request) => (request._id === requestId ? updater(request) : request)))
    setSelectedRequest((prev) => {
      if (!prev || prev._id !== requestId) return prev
      return updater(prev)
    })
  }

  const handleStatusUpdate = async (requestId: string, newStatus: string) => {
    try {
      setActionLoading(true)
      await updateRepairRequestStatus(requestId, newStatus)

      updateRequestInState(requestId, (request) => ({ ...request, status: newStatus as any }))

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

      updateRequestInState(requestId, (request) => ({ ...request, priority: newPriority as any }))

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

      updateRequestInState(selectedRequest._id, (request) => ({ ...request, estimatedCost: cost }))

      toast({
        title: "Success",
        description: "Estimated cost updated successfully"
      })

      setEstimatedCost(String(cost))
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

      updateRequestInState(selectedRequest._id, (request) => ({
        ...request,
        assignedStaffId: staffMember
          ? {
              _id: staffMember._id,
              firstName: staffMember.firstName,
              lastName: staffMember.lastName,
              email: staffMember.email,
            }
          : undefined,
        assignedStaffName: staffMember ? `${staffMember.firstName} ${staffMember.lastName}` : undefined,
      }))

      toast({
        title: "Success",
        description: "Staff assigned successfully"
      })

      setShowAssignDialog(false)
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

      const updatedRequest = (response as any).request as RepairRequest
      updateRequestInState(selectedRequest._id, () => updatedRequest)

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

      const updatedRequest = (response as any).request as RepairRequest
      updateRequestInState(selectedRequest._id, () => updatedRequest)

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
      updateRequestInState(selectedRequest._id, (request) => ({
        ...request,
        status: 'converted',
        convertedToOrderId: (response as any).order
      }))

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
    setSelectedStaffId(request.assignedStaffId?._id || "")
    setEstimatedCost(request.estimatedCost ? String(request.estimatedCost) : "")
    setShowDetailsDialog(true)
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      nextParams.set("requestId", request._id)
      return nextParams
    }, { replace: true })
  }

  const handleDetailsDialogOpenChange = (open: boolean) => {
    if (open) {
      isDetailsDialogClosingRef.current = false
      setShowDetailsDialog(true)
      return
    }

    isDetailsDialogClosingRef.current = true
    setShowDetailsDialog(open)

    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      nextParams.delete("requestId")
      return nextParams
    }, { replace: true })
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
      <div className="repair-requests-management">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p style={{color: 'var(--gray-500)', fontSize: '1.1rem', fontWeight: 500}}>Lade Reparaturanfragen...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="repair-requests-management">
      {view === "contact-messages" ? (
        <ContactMessagesPanel />
      ) : (
        <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="repair-requests-header">
        <h1>
          <FileText className="h-6 w-6" />
          Reparaturanfragen
        </h1>
        <p>
          Kundenanfragen verwalten und in Aufträge umwandeln
        </p>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="stats-grid">
          <div className="stat-card stat-total">
            <div className="stat-card-header">
              <div className="stat-card-title">Gesamt</div>
              <div className="stat-card-icon">
                <FileText className="h-5 w-5" />
              </div>
            </div>
            <div className="stat-card-value">{statistics.total}</div>
          </div>

          <div className="stat-card stat-pending">
            <div className="stat-card-header">
              <div className="stat-card-title">Ausstehend</div>
              <div className="stat-card-icon">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="stat-card-value">{statistics.byStatus.pending}</div>
          </div>

          <div className="stat-card stat-reviewing">
            <div className="stat-card-header">
              <div className="stat-card-title">In Prüfung</div>
              <div className="stat-card-icon">
                <Eye className="h-5 w-5" />
              </div>
            </div>
            <div className="stat-card-value">{statistics.byStatus.reviewing}</div>
          </div>

          <div className="stat-card stat-converted">
            <div className="stat-card-header">
              <div className="stat-card-title">Umgewandelt</div>
              <div className="stat-card-icon">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <div className="stat-card-value">{statistics.byStatus.converted}</div>
          </div>

          <div className="stat-card stat-priority">
            <div className="stat-card-header">
              <div className="stat-card-title">Hohe Priorität</div>
              <div className="stat-card-icon">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <div className="stat-card-value">{statistics.highPriority}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-card">
        <div className="filter-container">
          <div className="search-wrapper">
            <Search />
            <input
              type="text"
              placeholder="Suche nach Anfragenummer, Kunde oder Gerät..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="filter-row">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="pending">Ausstehend</SelectItem>
                <SelectItem value="reviewing">In Prüfung</SelectItem>
                <SelectItem value="approved">Genehmigt</SelectItem>
                <SelectItem value="rejected">Abgelehnt</SelectItem>
                <SelectItem value="converted">Umgewandelt</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Priorität" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Prioritäten</SelectItem>
                <SelectItem value="low">Niedrig</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
                <SelectItem value="urgent">Dringend</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="requests-table-card">
        <div className="requests-table-header">
          <h2 className="requests-table-title">Reparaturanfragen ({filteredRequests.length})</h2>
          <p className="requests-table-description">
            Alle Reparaturanfragen von Kunden
          </p>
        </div>
        <div className="requests-table-content">
          <div className="requests-table-wrapper">
            <table className="requests-table">
              <thead>
                <tr>
                  <th>Anfrage #</th>
                  <th>Kunde</th>
                  <th>Gerät</th>
                  <th>Problem</th>
                  <th>Status</th>
                  <th>Priorität</th>
                  <th>Zugewiesen an</th>
                  <th>Gesch. Kosten</th>
                  <th>Datum</th>
                  <th style={{textAlign: 'right'}}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="empty-state">
                      <FileText />
                      <p>Keine Reparaturanfragen gefunden</p>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((request) => (
                    <tr
                      key={request._id}
                      onClick={() => openDetailsDialog(request)}
                      style={{cursor: 'pointer'}}
                    >
                      <td>
                        <div className="request-number">
                          <span>{request.requestNumber}</span>
                          {unreadCounts[request._id] > 0 && (
                            <span className="unread-badge">
                              {unreadCounts[request._id]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="customer-info">
                          <div className="customer-avatar">
                            {request.customerName.charAt(0).toUpperCase()}
                          </div>
                          <div className="customer-details">
                            <div className="customer-name">{request.customerName}</div>
                            <div className="customer-email">{request.customerEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="device-info">
                          <div className="device-brand">{request.deviceBrand}</div>
                          <div className="device-model">{request.deviceModel}</div>
                        </div>
                      </td>
                      <td>
                        <div className="issue-description">{request.issueDescription}</div>
                      </td>
                      <td>
                        <span className={`status-badge status-${request.status}`}>
                          {request.status === 'pending' ? 'Ausstehend' :
                           request.status === 'reviewing' ? 'In Prüfung' :
                           request.status === 'approved' ? 'Genehmigt' :
                           request.status === 'rejected' ? 'Abgelehnt' :
                           request.status === 'converted' ? 'Umgewandelt' : request.status}
                        </span>
                      </td>
                      <td>
                        <span className={`priority-badge priority-${request.priority}`}>
                          {request.priority === 'urgent' ? 'Dringend' :
                           request.priority === 'high' ? 'Hoch' :
                           request.priority === 'medium' ? 'Mittel' :
                           request.priority === 'low' ? 'Niedrig' : request.priority}
                        </span>
                      </td>
                      <td>
                        {request.assignedStaffName ? (
                          <span className="assigned-staff">{request.assignedStaffName}</span>
                        ) : (
                          <span className="unassigned">Nicht zugewiesen</span>
                        )}
                      </td>
                      <td>
                        {request.estimatedCost > 0 ? (
                          <span className="estimated-cost">€{request.estimatedCost}</span>
                        ) : (
                          <span className="cost-not-set">Nicht festgelegt</span>
                        )}
                      </td>
                      <td>
                        <span className="request-date">
                          {new Date(request.createdAt).toLocaleDateString('de-DE')}
                        </span>
                      </td>
                      <td style={{textAlign: 'right'}}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="actions-button">
                              Aktionen
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openDetailsDialog(request); }}>
                              <Eye className="mr-2 h-4 w-4" />
                              Details anzeigen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openMessageDialog(request); }}>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Nachricht senden
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openAssignDialog(request); }}>
                              <UserPlus className="mr-2 h-4 w-4" />
                              Mitarbeiter zuweisen
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {request.status !== 'converted' && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openConvertDialog(request); }}>
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                In Auftrag umwandeln
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); openDeleteDialog(request); }}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={handleDetailsDialogOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto text-sm [&>button]:hidden">
          <DialogHeader className={detailsDialogHeaderClass}>
            <DialogTitle className="text-base font-semibold" style={{ color: "#f5b800" }}>
              Anfrage Details – {selectedRequest?.requestNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-white/80">
              Vollständige Informationen zu dieser Reparaturanfrage
            </DialogDescription>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-3 top-2.5 h-6 w-6 text-[#f5b800] hover:bg-white/10 hover:text-[#ffd54f]"
                aria-label="Dialog schließen"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-3 [&_label]:text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border rounded-md p-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs flex-1">
                  <div>
                    <Label className="text-muted-foreground">Kunde</Label>
                    <p className="text-sm font-medium">{selectedRequest.customerName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Gerät</Label>
                    <p className="text-sm font-medium">{selectedRequest.deviceBrand} {selectedRequest.deviceModel}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Erstellt am</Label>
                    <p className="text-sm font-medium">{new Date(selectedRequest.createdAt).toLocaleDateString('de-DE')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`status-badge status-${selectedRequest.status}`}>
                    {getStatusLabel(selectedRequest.status)}
                  </Badge>
                  <Badge className={`priority-badge priority-${selectedRequest.priority}`}>
                    {getPriorityLabel(selectedRequest.priority)}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Kundendaten</Label>
                  <div className="border rounded-md p-3 space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Name:</span> {selectedRequest.customerName}</p>
                    <p><span className="text-muted-foreground">E-Mail:</span> {selectedRequest.customerEmail}</p>
                    <p><span className="text-muted-foreground">Telefon:</span> {selectedRequest.customerPhone || 'Nicht angegeben'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Geräteinformationen</Label>
                  <div className="border rounded-md p-3 space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Typ:</span> {selectedRequest.deviceType}</p>
                    <p><span className="text-muted-foreground">Marke:</span> {selectedRequest.deviceBrand}</p>
                    <p><span className="text-muted-foreground">Modell:</span> {selectedRequest.deviceModel}</p>
                    {selectedRequest.modelNumber && (
                      <p><span className="text-muted-foreground">Modellnummer:</span> {selectedRequest.modelNumber}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Problembeschreibung</Label>
                <div className="border rounded-md p-3 space-y-3 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Beschreibung</Label>
                    <p className="mt-1 whitespace-pre-wrap">{selectedRequest.issueDescription}</p>
                  </div>
                  {selectedRequest.issueOccurredDate && (
                    <div>
                      <Label className="text-muted-foreground">Zeitpunkt</Label>
                      <p className="mt-1">{selectedRequest.issueOccurredDate}</p>
                    </div>
                  )}
                </div>
              </div>

              {(selectedRequest.waterDamage || selectedRequest.previousRepairDetails || selectedRequest.itemCondition) && (
                <div className="space-y-2">
                  <Label>Erweiterte Angaben</Label>
                  <div className="border rounded-md p-3 space-y-3 text-sm">
                    <div className="flex flex-wrap gap-3">
                      {selectedRequest.waterDamage && (
                        <div className="space-y-1">
                          <Label className="text-muted-foreground">Wasserschaden</Label>
                          <div>
                            <Badge variant={selectedRequest.waterDamage === 'yes' ? 'destructive' : 'secondary'}>
                              {selectedRequest.waterDamage === 'yes' ? 'Ja' : selectedRequest.waterDamage === 'no' ? 'Nein' : 'Nicht sicher'}
                            </Badge>
                          </div>
                        </div>
                      )}
                      {selectedRequest.itemCondition && (
                        <div className="space-y-1">
                          <Label className="text-muted-foreground">Gerätezustand</Label>
                          <div>
                            <Badge variant="outline">
                              {selectedRequest.itemCondition === 'original' ? 'Original' : selectedRequest.itemCondition === 'refurbished' ? 'Generalüberholt' : 'Nicht sicher'}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                    {selectedRequest.previousRepairDetails && (
                      <div>
                        <Label className="text-muted-foreground">Vorherige Reparaturversuche</Label>
                        <p className="mt-1 whitespace-pre-wrap">{selectedRequest.previousRepairDetails}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Schnell bearbeiten</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border rounded-md p-3">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={selectedRequest.status}
                      onValueChange={(value) => handleStatusUpdate(selectedRequest._id, value)}
                      disabled={actionLoading}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Ausstehend</SelectItem>
                        <SelectItem value="reviewing">In Prüfung</SelectItem>
                        <SelectItem value="approved">Genehmigt</SelectItem>
                        <SelectItem value="rejected">Abgelehnt</SelectItem>
                        <SelectItem value="converted">Umgewandelt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Priorität</Label>
                    <Select
                      value={selectedRequest.priority}
                      onValueChange={(value) => handlePriorityUpdate(selectedRequest._id, value)}
                      disabled={actionLoading}
                    >
                      <SelectTrigger className="h-8 text-xs">
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

                  <div className="space-y-1.5">
                    <Label>Mitarbeiter</Label>
                    <div className="flex gap-2">
                      <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder="Techniker wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {staff.map((member) => (
                            <SelectItem key={member._id} value={member._id}>
                              {member.firstName} {member.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={handleAssignStaff}
                        disabled={actionLoading || !selectedStaffId}
                        className="h-8 px-2.5 text-xs"
                      >
                        {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Zuweisen"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Geschätzte Kosten (EUR)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Betrag"
                        value={estimatedCost}
                        onChange={(e) => setEstimatedCost(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Button size="sm" onClick={handleCostUpdate} disabled={actionLoading || !estimatedCost} className="h-8 px-2.5 text-xs">
                        {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Speichern"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {selectedRequest.images && selectedRequest.images.length > 0 && (
                <div className="space-y-2">
                  <Label>Gerätebilder</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {selectedRequest.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Gerät ${idx + 1}`}
                        className="w-full h-24 object-cover rounded border"
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Kommunikation</Label>
                <div className="border rounded-md p-3">
                  <CommunicationPanel
                    orderId={selectedRequest._id}
                    entityType="repair-request"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Interne Notizen</Label>
                <div className="border rounded-md p-3 space-y-3">
                  <Textarea
                    placeholder="Interne Notiz hinzufügen..."
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                  <Button size="sm" className="h-8 px-2.5 text-xs" onClick={handleAddNote} disabled={actionLoading || !adminNote.trim()}>
                    Notiz speichern
                  </Button>

                  {selectedRequest.adminNotes && selectedRequest.adminNotes.length > 0 ? (
                    <div className="space-y-2.5">
                      {selectedRequest.adminNotes.map((note, idx) => (
                        <div key={idx} className="rounded-md border p-2">
                          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{note.staffName}</span>
                            <span>{new Date(note.createdAt).toLocaleString('de-DE')}</span>
                          </div>
                          <p className="text-xs">{note.note}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Noch keine internen Notizen vorhanden.</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Vorgangsübersicht</Label>
                <div className="border rounded-md p-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <p><span className="text-muted-foreground">Anfrage erstellt:</span> {new Date(selectedRequest.createdAt).toLocaleString('de-DE')}</p>
                  <p><span className="text-muted-foreground">Zuletzt aktualisiert:</span> {new Date(selectedRequest.updatedAt).toLocaleString('de-DE')}</p>
                  {selectedRequest.reviewDeadline && (
                    <p><span className="text-muted-foreground">Review-Deadline:</span> {new Date(selectedRequest.reviewDeadline).toLocaleString('de-DE')}</p>
                  )}
                  {selectedRequest.convertedAt && (
                    <p><span className="text-muted-foreground">Umgewandelt am:</span> {new Date(selectedRequest.convertedAt).toLocaleString('de-DE')}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="overflow-hidden">
          <DialogHeader className="mcrepair-dialog-header">
            <DialogTitle className="mcrepair-dialog-title">Nachricht senden</DialogTitle>
            <DialogDescription className="mcrepair-dialog-description">
              Kommunikation mit {selectedRequest?.customerName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {/* Previous Messages */}
            {selectedRequest && selectedRequest.messages && selectedRequest.messages.length > 0 && (
              <ScrollArea className="h-[180px] border rounded-lg p-3">
                <div className="space-y-2">
                  {selectedRequest.messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg ${
                        msg.senderRole === 'customer'
                          ? 'bg-white border border-gray-200 shadow-sm'
                          : 'bg-gray-50 dark:bg-gray-900/20'
                      }`}
                    >
                      <div className="flex justify-between mb-0.5 text-xs">
                        <span className="font-medium">{msg.senderName}</span>
                        <span className="text-muted-foreground">
                          {new Date(msg.sentAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs">{msg.message}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Ihre Nachricht</Label>
              <Textarea
                placeholder="Nachricht eingeben..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={4}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessageDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSendMessage} disabled={actionLoading || !newMessage.trim()}>
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Senden...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Senden
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Staff Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="overflow-hidden">
          <DialogHeader className="mcrepair-dialog-header">
            <DialogTitle className="mcrepair-dialog-title">Mitarbeiter zuweisen</DialogTitle>
            <DialogDescription className="mcrepair-dialog-description">
              Techniker für diese Reparaturanfrage bestimmen
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Mitarbeiter auswählen</Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Mitarbeiter wählen" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((member) => (
                    <SelectItem key={member._id} value={member._id}>
                      {member.firstName} {member.lastName} – {member.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRequest?.assignedStaffName && (
              <p className="text-xs text-muted-foreground">
                Aktuell zugewiesen: {selectedRequest.assignedStaffName}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAssignStaff} disabled={actionLoading || !selectedStaffId}>
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Zuweisen...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Zuweisen
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Order Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="max-w-2xl overflow-hidden">
          <DialogHeader className="mcrepair-dialog-header">
            <DialogTitle className="mcrepair-dialog-title">In Auftrag umwandeln</DialogTitle>
            <DialogDescription className="mcrepair-dialog-description">
              Dienste auswählen und Auftrag aus dieser Anfrage erstellen
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="border-gray-200 bg-white shadow-sm">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm">
                Ein neuer Reparaturauftrag wird erstellt und die Anfrage als konvertiert markiert.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label className="text-xs">Dienste auswählen</Label>
              <ScrollArea className="h-[260px] border rounded-lg p-3">
                <div className="space-y-1">
                  {services.map((service) => (
                    <div key={service._id} className="flex items-start space-x-2 p-2 hover:bg-muted rounded-md">
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
                        <label htmlFor={service._id} className="text-xs font-medium cursor-pointer">
                          {service.name}
                        </label>
                        <p className="text-xs text-muted-foreground">{service.description}</p>
                        <p className="text-xs font-semibold mt-0.5">€{service.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {selectedServices.length > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between text-xs">
                  <span>Ausgewählte Dienste:</span>
                  <span className="font-bold">{selectedServices.length}</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span>Gesch. Kosten:</span>
                  <span className="font-bold">
                    €{services
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
              Abbrechen
            </Button>
            <Button
              onClick={handleConvertToOrder}
              disabled={actionLoading || selectedServices.length === 0}
              style={{background: '#1a2a5e', color: '#fff'}}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Konvertiere...
                </>
              ) : (
                <>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  In Auftrag umwandeln
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="overflow-hidden">
          <AlertDialogHeader className="mcrepair-dialog-header">
            <AlertDialogTitle className="mcrepair-dialog-title">Reparaturanfrage löschen</AlertDialogTitle>
            <AlertDialogDescription className="mcrepair-dialog-description">
              Diese Aktion kann nicht rückgängig gemacht werden. Anfrage #{selectedRequest?.requestNumber}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRequest}
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Löschen...
                </>
              ) : (
                "Löschen"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </div>
      )}
    </div>
  )
}
