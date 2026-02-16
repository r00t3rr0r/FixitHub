import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import { RepairRequestMessagesPanel } from "@/components/repair-request/RepairRequestMessagesPanel"
import {
  getMyRepairRequests,
  getRepairRequestById,
  RepairRequest
} from "@/api/repairRequests"
import {
  Search,
  Filter,
  Eye,
  Clock,
  CheckCircle,
  AlertTriangle,
  X,
  Loader2,
  AlertCircle,
  ArrowRight,
  FileText,
  Calendar,
  DollarSign
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
import { ScrollArea } from "@/components/ui/scroll-area"

interface ExtendedRepairRequest extends RepairRequest {
  unreadMessages?: number
}

export function CustomerRepairRequests() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { user } = useAuth()

  // State management
  const [requests, setRequests] = useState<ExtendedRepairRequest[]>([])
  const [filteredRequests, setFilteredRequests] = useState<ExtendedRepairRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Dialog states
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ExtendedRepairRequest | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  // Fetch customer's repair requests
  useEffect(() => {
    const fetchRequests = async () => {
      try {
        console.log("CustomerRepairRequests: Fetching customer's repair requests...")
        setLoading(true)
        const response = await getMyRepairRequests()
        const requestsData = (response as any).requests || []
        console.log("CustomerRepairRequests: Requests loaded successfully", requestsData)
        setRequests(requestsData)
        setFilteredRequests(requestsData)
      } catch (error) {
        console.error("CustomerRepairRequests: Error fetching repair requests:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load repair requests"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchRequests()
  }, [toast])

  // Apply filters
  useEffect(() => {
    let filtered = requests

    // Filter by search term (search by device, request number, or issue description)
    if (searchTerm) {
      filtered = filtered.filter(request =>
        request.deviceBrand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.deviceModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.issueDescription.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(request => request.status === statusFilter)
    }

    setFilteredRequests(filtered)
  }, [requests, searchTerm, statusFilter])

  // Open details dialog
  const openDetailsDialog = async (request: ExtendedRepairRequest) => {
    try {
      console.log("CustomerRepairRequests: Opening details for request:", request._id)
      setSelectedRequest(request)
      setDetailsLoading(true)
      setShowDetailsDialog(true)

      // Fetch full request details
      const response = await getRepairRequestById(request._id)
      const fullRequest = (response as any).request
      if (fullRequest) {
        setSelectedRequest(fullRequest)
        console.log("CustomerRepairRequests: Request details loaded")
      }
    } catch (error) {
      console.error("CustomerRepairRequests: Error fetching request details:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load request details"
      })
    } finally {
      setDetailsLoading(false)
    }
  }


  // Get status color for badge
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'converted':
        return 'bg-green-500 text-white'
      case 'approved':
        return 'bg-blue-500 text-white'
      case 'reviewing':
        return 'bg-yellow-500 text-black'
      case 'pending':
        return 'bg-gray-500 text-white'
      case 'rejected':
        return 'bg-red-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'converted':
        return <CheckCircle className="h-4 w-4" />
      case 'approved':
        return <CheckCircle className="h-4 w-4" />
      case 'reviewing':
        return <Clock className="h-4 w-4" />
      case 'pending':
        return <AlertCircle className="h-4 w-4" />
      case 'rejected':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Format date
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading repair requests...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Repair Requests</h1>
        <p className="text-muted-foreground mt-2">
          Track and manage your device repair requests
        </p>
      </div>

      {/* Filter and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by device, request number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="converted">Converted to Order</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Repair Requests ({filteredRequests.length})</CardTitle>
          <CardDescription>
            Click on any request to view details and communicate with staff
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {searchTerm || statusFilter !== 'all'
                  ? "No repair requests match your filters."
                  : "You haven't submitted any repair requests yet."}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request #</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow
                      key={request._id}
                      onClick={() => openDetailsDialog(request)}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-medium">{request.requestNumber}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{request.deviceBrand}</span>
                          <span className="text-sm text-muted-foreground">{request.deviceModel}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate text-sm">{request.issueDescription}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(request.status)}>
                          {getStatusIcon(request.status)}
                          <span className="ml-1 capitalize">{request.status}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(request.priority)} variant="outline">
                          {request.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(request.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openDetailsDialog(request)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View Details</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-start justify-between pr-6">
              <div>
                <DialogTitle className="text-xl">
                  Request #{selectedRequest?.requestNumber}
                </DialogTitle>
                <DialogDescription className="mt-2">
                  {selectedRequest?.deviceBrand} {selectedRequest?.deviceModel}
                </DialogDescription>
              </div>
              {selectedRequest && (
                <Badge className={`${getStatusColor(selectedRequest.status)} whitespace-nowrap`}>
                  {getStatusIcon(selectedRequest.status)}
                  <span className="ml-1 capitalize">{selectedRequest.status}</span>
                </Badge>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-hidden pr-4">
            <div className="space-y-6 p-4">
              {detailsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : selectedRequest ? (
                <>
                  {/* Device Information */}
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Device Information
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Brand</p>
                        <p className="font-medium">{selectedRequest.deviceBrand}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Model</p>
                        <p className="font-medium">{selectedRequest.deviceModel}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Issue Description</p>
                        <p className="font-medium">{selectedRequest.issueDescription}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Issue Occurred</p>
                        <p className="font-medium">{formatDate(selectedRequest.issueOccurredDate)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Previous Repair Attempts</p>
                        <p className="font-medium">{selectedRequest.repairAttempts || 'None'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Priority</p>
                        <Badge className={getPriorityColor(selectedRequest.priority)}>
                          {selectedRequest.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Additional Information */}
                  {selectedRequest.additionalInfo && (
                    <div className="space-y-3">
                      <h3 className="font-semibold">Additional Information</h3>
                      <p className="text-sm">{selectedRequest.additionalInfo}</p>
                    </div>
                  )}

                  {/* Estimated Cost */}
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Estimated Cost
                    </h3>
                    <p className="text-lg font-bold">${selectedRequest.estimatedCost.toFixed(2)}</p>
                  </div>

                  {/* Converted Order Information */}
                  {selectedRequest.status === 'converted' && selectedRequest.convertedToOrderId && (
                    <div className="space-y-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <h3 className="font-semibold flex items-center gap-2 text-green-900">
                        <CheckCircle className="h-4 w-4" />
                        Converted to Order
                      </h3>
                      <div className="text-sm">
                        <p className="text-muted-foreground">Order Number</p>
                        <p className="font-medium">{selectedRequest.convertedToOrderId.orderNumber}</p>
                      </div>
                      <div className="text-sm">
                        <p className="text-muted-foreground">Converted By</p>
                        <p className="font-medium">{selectedRequest.convertedByStaffName || 'N/A'}</p>
                      </div>
                      {selectedRequest.convertedAt && (
                        <div className="text-sm">
                          <p className="text-muted-foreground">Converted Date</p>
                          <p className="font-medium">{formatDate(selectedRequest.convertedAt)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assigned Staff */}
                  {selectedRequest.assignedStaffId && (
                    <div className="space-y-3">
                      <h3 className="font-semibold">Assigned Staff</h3>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Staff Member</p>
                        <p className="font-medium">{selectedRequest.assignedStaffName || 'N/A'}</p>
                      </div>
                    </div>
                  )}

                  {/* Messaging Panel */}
                  <RepairRequestMessagesPanel
                    requestId={selectedRequest._id}
                    userRole={user?.role}
                    isReadOnly={false}
                  />

                  {/* Images */}
                  {selectedRequest.images && selectedRequest.images.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold">Uploaded Images ({selectedRequest.images.length})</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {selectedRequest.images.map((image, index) => (
                          <img
                            key={index}
                            src={image}
                            alt={`Device image ${index + 1}`}
                            className="rounded-lg w-full h-48 object-cover"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Timeline
                    </h3>
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created</span>
                        <span>{formatDate(selectedRequest.createdAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Updated</span>
                        <span>{formatDate(selectedRequest.updatedAt)}</span>
                      </div>
                      {selectedRequest.reviewDeadline && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Review Deadline</span>
                          <span>{formatDate(selectedRequest.reviewDeadline)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
