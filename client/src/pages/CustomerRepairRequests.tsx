import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import "./CustomerRepairRequests.css"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import { RepairRequestMessagesPanel } from "@/components/repair-request/RepairRequestMessagesPanel"
import {
  getMyRepairRequests,
  getRepairRequestById,
  RepairRequest
} from "@/api/repairRequests"
import { getUnreadMessageCount } from "@/api/repairRequestCommunication"
import {
  Search,
  Filter,
  Eye,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  AlertCircle,
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
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

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
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading repair requests...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-amber-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#f5b800] rounded-full opacity-5 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#f5b800] rounded-full opacity-5 blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="h-8 w-8 text-[#f5b800]" />
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">My Repair Requests</h1>
            </div>
            <p className="text-blue-100 text-base md:text-lg">Track and manage your device repair requests</p>
          </div>
        </div>

        {/* Filter and Search */}
        <Card className="border-none shadow-lg bg-white">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-[#1a2a5e]">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#f5b800] to-[#e5ab00] flex items-center justify-center flex-shrink-0">
                  <Filter className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-sm uppercase tracking-wide whitespace-nowrap">Filter</span>
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by device, request number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 text-sm border-slate-200 focus:border-[#f5b800] focus:ring-[#f5b800]"
                  />
                </div>
              </div>
              <div className="min-w-[180px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 text-sm border-slate-200 focus:border-[#f5b800] focus:ring-[#f5b800]">
                    <SelectValue placeholder="Select Status" />
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
        <Card className="border-none shadow-lg bg-white">
          <CardHeader className="border-b border-slate-100 bg-white">
            <CardTitle className="text-xl font-bold text-[#1a2a5e]">Repair Requests ({filteredRequests.length})</CardTitle>
            <CardDescription className="text-slate-600">
              Click on any request to view details and communicate with staff
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredRequests.length === 0 ? (
              <div className="py-16 text-center">
                <div className="h-20 w-20 mx-auto rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-6">
                  <AlertCircle className="h-10 w-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                  {searchTerm || statusFilter !== 'all'
                    ? "No repair requests found"
                    : "No repair requests yet"}
                </h3>
                <p className="text-slate-500">
                  {searchTerm || statusFilter !== 'all'
                    ? "Try adjusting your filters to find what you're looking for."
                    : "You haven't submitted any repair requests yet."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="requests-table">
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
                    >
                      <TableCell>
                        <div className="request-number">
                          <span>{request.requestNumber}</span>
                          {unreadCounts[request._id] > 0 && (
                            <span className="unread-badge">
                              {unreadCounts[request._id]}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="device-info">
                          <span className="device-brand">{request.deviceBrand}</span>
                          <span className="device-model">{request.deviceModel}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="issue-description">{request.issueDescription}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`status-badge status-${request.status}`}>
                          {getStatusIcon(request.status)}
                          <span>{request.status}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`priority-badge priority-${request.priority}`}>
                          {request.priority}
                        </span>
                      </TableCell>
                      <TableCell>
                        {formatDate(request.createdAt)}
                      </TableCell>
                      <TableCell>
                        <button
                          className="action-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openDetailsDialog(request)
                          }}
                        >
                          <Eye className="h-5 w-5" />
                          <span className="sr-only">View Details</span>
                        </button>
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
        <DialogContent className="max-w-[56rem] overflow-hidden" style={{
          borderRadius: '24px',
          border: 'none',
          boxShadow: '0 20px 60px rgba(26, 42, 94, 0.3)',
          background: '#ffffff'
        }}>
          <DialogHeader style={{
            padding: '2rem 2.5rem',
            background: 'linear-gradient(to right, #1a2a5e 0%, #2a3f7e 100%)',
            borderBottom: 'none',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-[0.08] blur-3xl pointer-events-none" 
                 style={{ background: 'radial-gradient(circle, rgba(245, 184, 0, 1) 0%, transparent 70%)' }} />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-[0.06] blur-3xl pointer-events-none" 
                 style={{ background: 'radial-gradient(circle, rgba(245, 184, 0, 1) 0%, transparent 70%)' }} />
            
            <div className="flex items-start justify-between pr-6 relative z-10">
              <div>
                <DialogTitle className="text-[1.75rem] font-extrabold text-white mb-2" style={{
                  letterSpacing: '-0.5px'
                }}>
                  Request #{selectedRequest?.requestNumber}
                </DialogTitle>
                <DialogDescription className="text-[1.125rem] font-normal" style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  letterSpacing: '0.3px'
                }}>
                  {selectedRequest?.deviceBrand} {selectedRequest?.deviceModel}
                </DialogDescription>
              </div>
              {selectedRequest && (
                <span className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg transition-all duration-200 hover:-translate-y-0.5 status-${selectedRequest.status}`}
                      style={{
                        background: selectedRequest.status === 'converted' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
                                   selectedRequest.status === 'approved' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' :
                                   selectedRequest.status === 'reviewing' ? 'linear-gradient(135deg, #f5b800 0%, #e5ab00 100%)' :
                                   selectedRequest.status === 'rejected' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
                                   'linear-gradient(135deg, #8892a8 0%, #636e85 100%)',
                        color: selectedRequest.status === 'reviewing' ? '#1a2a5e' : '#ffffff',
                        boxShadow: selectedRequest.status === 'converted' ? '0 4px 12px rgba(16, 185, 129, 0.35)' :
                                  selectedRequest.status === 'approved' ? '0 4px 12px rgba(59, 130, 246, 0.35)' :
                                  selectedRequest.status === 'reviewing' ? '0 4px 12px rgba(245, 184, 0, 0.35)' :
                                  selectedRequest.status === 'rejected' ? '0 4px 12px rgba(239, 68, 68, 0.35)' :
                                  '0 4px 12px rgba(136, 146, 168, 0.35)'
                      }}>
                  {getStatusIcon(selectedRequest.status)}
                  <span>{selectedRequest.status}</span>
                </span>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-hidden pr-4">
            <div style={{
              padding: '2.5rem',
              background: 'linear-gradient(to bottom, #ffffff 0%, #fafbfc 100%)'
            }}>
              {detailsLoading ? (
                <div className="loading-container">
                  <Loader2 className="h-6 w-6 animate-spin loading-spinner" />
                </div>
              ) : selectedRequest ? (
                <>  
                  {/* Device Information */}
                  <div className="mb-10 p-8 bg-white rounded-2xl border transition-all duration-200 hover:shadow-lg hover:border-yellow-200 hover:-translate-y-1" 
                       style={{
                         boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                         borderColor: 'rgba(26, 42, 94, 0.06)'
                       }}>
                    <h3 className="text-xl font-bold text-[#1a2a5e] mb-5 flex items-center gap-2.5 pb-3.5 border-b-2" style={{
                      borderColor: 'rgba(245, 184, 0, 0.2)',
                      letterSpacing: '-0.3px'
                    }}>
                      <FileText className="h-5 w-5 text-[#f5b800]" />
                      Device Information
                    </h3>
                    <div className="grid gap-6" style={{
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'
                    }}>
                      <div className="flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200 hover:bg-white hover:border-yellow-200 hover:translate-x-1" 
                           style={{
                             background: 'linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%)',
                             borderColor: 'rgba(26, 42, 94, 0.05)'
                           }}>
                        <span className="text-[0.8125rem] font-bold uppercase tracking-wide" style={{ color: '#636e85' }}>Brand</span>
                        <span className="text-[1.0625rem] font-semibold text-[#1a2a5e] leading-relaxed">{selectedRequest.deviceBrand}</span>
                      </div>
                      <div className="flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200 hover:bg-white hover:border-yellow-200 hover:translate-x-1" 
                           style={{
                             background: 'linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%)',
                             borderColor: 'rgba(26, 42, 94, 0.05)'
                           }}>
                        <span className="text-[0.8125rem] font-bold uppercase tracking-wide" style={{ color: '#636e85' }}>Model</span>
                        <span className="text-[1.0625rem] font-semibold text-[#1a2a5e] leading-relaxed">{selectedRequest.deviceModel}</span>
                      </div>
                      <div className="flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200 hover:bg-white hover:border-yellow-200 hover:translate-x-1" 
                           style={{
                             background: 'linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%)',
                             borderColor: 'rgba(26, 42, 94, 0.05)'
                           }}>
                        <span className="text-[0.8125rem] font-bold uppercase tracking-wide" style={{ color: '#636e85' }}>Issue Description</span>
                        <span className="text-[1.0625rem] font-semibold text-[#1a2a5e] leading-relaxed">{selectedRequest.issueDescription}</span>
                      </div>
                      <div className="flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200 hover:bg-white hover:border-yellow-200 hover:translate-x-1" 
                           style={{
                             background: 'linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%)',
                             borderColor: 'rgba(26, 42, 94, 0.05)'
                           }}>
                        <span className="text-[0.8125rem] font-bold uppercase tracking-wide" style={{ color: '#636e85' }}>Issue Occurred</span>
                        <span className="text-[1.0625rem] font-semibold text-[#1a2a5e] leading-relaxed">{formatDate(selectedRequest.issueOccurredDate)}</span>
                      </div>
                      <div className="flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200 hover:bg-white hover:border-yellow-200 hover:translate-x-1" 
                           style={{
                             background: 'linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%)',
                             borderColor: 'rgba(26, 42, 94, 0.05)'
                           }}>
                        <span className="text-[0.8125rem] font-bold uppercase tracking-wide" style={{ color: '#636e85' }}>Priority</span>
                        <span className={`inline-flex items-center px-4 py-2 rounded-xl font-bold text-sm uppercase tracking-wide shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-lg priority-${selectedRequest.priority}`}
                              style={{
                                background: selectedRequest.priority === 'urgent' ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' :
                                           selectedRequest.priority === 'high' ? 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)' :
                                           selectedRequest.priority === 'medium' ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' :
                                           'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                                color: selectedRequest.priority === 'urgent' ? '#991b1b' :
                                       selectedRequest.priority === 'high' ? '#9a3412' :
                                       selectedRequest.priority === 'medium' ? '#854d0e' :
                                       '#065f46',
                                border: selectedRequest.priority === 'urgent' ? '2px solid #f87171' :
                                        selectedRequest.priority === 'high' ? '2px solid #fb923c' :
                                        selectedRequest.priority === 'medium' ? '2px solid #fbbf24' :
                                        '2px solid #34d399'
                              }}>
                          {selectedRequest.priority}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Model Number */}
                  {selectedRequest.modelNumber && (
                    <div className="mb-10 p-8 bg-white rounded-2xl border transition-all duration-200 hover:shadow-lg hover:border-yellow-200 hover:-translate-y-1" 
                         style={{
                           boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                           borderColor: 'rgba(26, 42, 94, 0.06)'
                         }}>
                      <h3 className="text-xl font-bold text-[#1a2a5e] mb-5 flex items-center gap-2.5 pb-3.5 border-b-2" style={{
                        borderColor: 'rgba(245, 184, 0, 0.2)',
                        letterSpacing: '-0.3px'
                      }}>Modellnummer</h3>
                      <p className="text-[1.0625rem] font-semibold text-[#1a2a5e] leading-relaxed">{selectedRequest.modelNumber}</p>
                    </div>
                  )}

                  {/* Extended Information */}
                  {(selectedRequest.waterDamage || selectedRequest.previousRepairDetails || selectedRequest.itemCondition) && (
                    <div className="mb-10 p-8 bg-white rounded-2xl border transition-all duration-200 hover:shadow-lg hover:border-yellow-200 hover:-translate-y-1" 
                         style={{
                           boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                           borderColor: 'rgba(26, 42, 94, 0.06)'
                         }}>
                      <h3 className="text-xl font-bold text-[#1a2a5e] mb-5 flex items-center gap-2.5 pb-3.5 border-b-2" style={{
                        borderColor: 'rgba(245, 184, 0, 0.2)',
                        letterSpacing: '-0.3px'
                      }}>Weitere Informationen</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {selectedRequest.waterDamage && (
                          <div className="flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200 hover:bg-white hover:border-yellow-200 hover:translate-x-1" 
                               style={{
                                 background: 'linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%)',
                                 borderColor: 'rgba(26, 42, 94, 0.05)'
                               }}>
                            <span className="text-[0.8125rem] font-bold uppercase tracking-wide" style={{ color: '#636e85' }}>Wasserschaden</span>
                            <Badge variant={selectedRequest.waterDamage === 'yes' ? 'destructive' : 'secondary'}>
                              {selectedRequest.waterDamage === 'yes' ? 'Ja' : selectedRequest.waterDamage === 'no' ? 'Nein' : 'Nicht sicher'}
                            </Badge>
                          </div>
                        )}
                        
                        {selectedRequest.itemCondition && (
                          <div className="flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200 hover:bg-white hover:border-yellow-200 hover:translate-x-1" 
                               style={{
                                 background: 'linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%)',
                                 borderColor: 'rgba(26, 42, 94, 0.05)'
                               }}>
                            <span className="text-[0.8125rem] font-bold uppercase tracking-wide" style={{ color: '#636e85' }}>Gerätezustand</span>
                            <Badge variant="outline">
                              {selectedRequest.itemCondition === 'original' ? 'Original' : 
                               selectedRequest.itemCondition === 'refurbished' ? 'Generalüberholt' : 
                               'Nicht sicher'}
                            </Badge>
                          </div>
                        )}
                      </div>
                      
                      {selectedRequest.previousRepairDetails && (
                        <div className="mt-4 flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200" 
                             style={{
                               background: 'linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%)',
                               borderColor: 'rgba(26, 42, 94, 0.05)'
                             }}>
                          <span className="text-[0.8125rem] font-bold uppercase tracking-wide" style={{ color: '#636e85' }}>Vorherige Reparaturversuche</span>
                          <span className="text-[1.0625rem] font-semibold text-[#1a2a5e] leading-relaxed">{selectedRequest.previousRepairDetails}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Estimated Cost */}
                  <div className="mb-10 p-8 bg-white rounded-2xl border transition-all duration-200 hover:shadow-lg hover:border-yellow-200 hover:-translate-y-1" 
                       style={{
                         boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                         borderColor: 'rgba(26, 42, 94, 0.06)'
                       }}>
                    <h3 className="text-xl font-bold text-[#1a2a5e] mb-5 flex items-center gap-2.5 pb-3.5 border-b-2" style={{
                      borderColor: 'rgba(245, 184, 0, 0.2)',
                      letterSpacing: '-0.3px'
                    }}>
                      <DollarSign className="h-5 w-5 text-[#f5b800]" />
                      Estimated Cost
                    </h3>
                    <p className="text-[2rem] font-extrabold" style={{
                      background: 'linear-gradient(135deg, #1a2a5e 0%, #f5b800 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text'
                    }}>${selectedRequest.estimatedCost.toFixed(2)}</p>
                  </div>

                  {/* Converted Order Information */}
                  {selectedRequest.status === 'converted' && selectedRequest.convertedToOrderId && (
                    <div className="p-7 rounded-2xl border-2 mb-10 shadow-lg" style={{
                      background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                      borderColor: '#10b981'
                    }}>
                      <h3 className="text-xl font-extrabold mb-5 flex items-center gap-2.5" style={{
                        color: '#065f46',
                        letterSpacing: '-0.3px'
                      }}>
                        <CheckCircle className="h-5 w-5" />
                        Converted to Order
                      </h3>
                      <div className="grid gap-6" style={{
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'
                      }}>
                        <div className="flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200 hover:bg-white hover:border-yellow-200 hover:translate-x-1" 
                             style={{
                               background: 'linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%)',
                               borderColor: 'rgba(26, 42, 94, 0.05)'
                             }}>
                          <span className="text-[0.8125rem] font-bold uppercase tracking-wide" style={{ color: '#636e85' }}>Order Number</span>
                          <span className="text-[1.0625rem] font-semibold text-[#1a2a5e] leading-relaxed">{selectedRequest.convertedToOrderId.orderNumber}</span>
                        </div>
                        <div className="flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200 hover:bg-white hover:border-yellow-200 hover:translate-x-1" 
                             style={{
                               background: 'linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%)',
                               borderColor: 'rgba(26, 42, 94, 0.05)'
                             }}>
                          <span className="text-[0.8125rem] font-bold uppercase tracking-wide" style={{ color: '#636e85' }}>Converted By</span>
                          <span className="text-[1.0625rem] font-semibold text-[#1a2a5e] leading-relaxed">{selectedRequest.convertedByStaffName || 'N/A'}</span>
                        </div>
                        {selectedRequest.convertedAt && (
                          <div className="flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200 hover:bg-white hover:border-yellow-200 hover:translate-x-1" 
                               style={{
                                 background: 'linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%)',
                                 borderColor: 'rgba(26, 42, 94, 0.05)'
                               }}>
                            <span className="text-[0.8125rem] font-bold uppercase tracking-wide" style={{ color: '#636e85' }}>Converted Date</span>
                            <span className="text-[1.0625rem] font-semibold text-[#1a2a5e] leading-relaxed">{formatDate(selectedRequest.convertedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Assigned Staff */}
                  {selectedRequest.assignedStaffId && (
                    <div className="mb-10 p-8 bg-white rounded-2xl border transition-all duration-200 hover:shadow-lg hover:border-yellow-200 hover:-translate-y-1" 
                         style={{
                           boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                           borderColor: 'rgba(26, 42, 94, 0.06)'
                         }}>
                      <h3 className="text-xl font-bold text-[#1a2a5e] mb-5 flex items-center gap-2.5 pb-3.5 border-b-2" style={{
                        borderColor: 'rgba(245, 184, 0, 0.2)',
                        letterSpacing: '-0.3px'
                      }}>Assigned Staff</h3>
                      <div className="flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200 hover:bg-white hover:border-yellow-200 hover:translate-x-1" 
                           style={{
                             background: 'linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%)',
                             borderColor: 'rgba(26, 42, 94, 0.05)'
                           }}>
                        <span className="text-[0.8125rem] font-bold uppercase tracking-wide" style={{ color: '#636e85' }}>Staff Member</span>
                        <span className="text-[1.0625rem] font-semibold text-[#1a2a5e] leading-relaxed">{selectedRequest.assignedStaffName || 'N/A'}</span>
                      </div>
                    </div>
                  )}

                  {/* Messaging Panel */}
                  <div className="mb-10 p-8 bg-white rounded-2xl border transition-all duration-200 hover:shadow-lg hover:border-yellow-200" 
                       style={{
                         boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                         borderColor: 'rgba(26, 42, 94, 0.06)'
                       }}>
                    <RepairRequestMessagesPanel
                      requestId={selectedRequest._id}
                      userRole={user?.role}
                      isReadOnly={false}
                    />
                  </div>

                  {/* Images */}
                  {selectedRequest.images && selectedRequest.images.length > 0 && (
                    <div className="mb-10 p-8 bg-white rounded-2xl border transition-all duration-200 hover:shadow-lg hover:border-yellow-200 hover:-translate-y-1" 
                         style={{
                           boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                           borderColor: 'rgba(26, 42, 94, 0.06)'
                         }}>
                      <h3 className="text-xl font-bold text-[#1a2a5e] mb-5 flex items-center gap-2.5 pb-3.5 border-b-2" style={{
                        borderColor: 'rgba(245, 184, 0, 0.2)',
                        letterSpacing: '-0.3px'
                      }}>Uploaded Images ({selectedRequest.images.length})</h3>
                      <div className="grid gap-5" style={{
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))'
                      }}>
                        {selectedRequest.images.map((image, index) => (
                          <img
                            key={index}
                            src={image}
                            alt={`Device image ${index + 1}`}
                            className="w-full h-[220px] object-cover rounded-2xl border-2 transition-all duration-200 hover:border-[#f5b800] hover:scale-105 hover:-translate-y-1"
                            style={{
                              borderColor: 'rgba(26, 42, 94, 0.08)',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="mb-0 p-8 bg-white rounded-2xl border transition-all duration-200 hover:shadow-lg hover:border-yellow-200 hover:-translate-y-1" 
                       style={{
                         boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                         borderColor: 'rgba(26, 42, 94, 0.06)'
                       }}>
                    <h3 className="text-xl font-bold text-[#1a2a5e] mb-5 flex items-center gap-2.5 pb-3.5 border-b-2" style={{
                      borderColor: 'rgba(245, 184, 0, 0.2)',
                      letterSpacing: '-0.3px'
                    }}>
                      <Calendar className="h-5 w-5 text-[#f5b800]" />
                      Timeline
                    </h3>
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-center px-5 py-4 rounded-xl border transition-all duration-200 hover:bg-white hover:border-yellow-200 hover:translate-x-1" 
                           style={{
                             background: 'linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%)',
                             borderColor: 'rgba(26, 42, 94, 0.06)'
                           }}>
                        <span className="text-[0.9375rem] font-bold text-[#1a2a5e] tracking-wide">Created</span>
                        <span className="text-[0.9375rem] font-semibold" style={{ color: '#636e85' }}>{formatDate(selectedRequest.createdAt)}</span>
                      </div>
                      <div className="flex justify-between items-center px-5 py-4 rounded-xl border transition-all duration-200 hover:bg-white hover:border-yellow-200 hover:translate-x-1" 
                           style={{
                             background: 'linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%)',
                             borderColor: 'rgba(26, 42, 94, 0.06)'
                           }}>
                        <span className="text-[0.9375rem] font-bold text-[#1a2a5e] tracking-wide">Last Updated</span>
                        <span className="text-[0.9375rem] font-semibold" style={{ color: '#636e85' }}>{formatDate(selectedRequest.updatedAt)}</span>
                      </div>
                      {selectedRequest.reviewDeadline && (
                        <div className="flex justify-between items-center px-5 py-4 rounded-xl border transition-all duration-200 hover:bg-white hover:border-yellow-200 hover:translate-x-1" 
                             style={{
                               background: 'linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%)',
                               borderColor: 'rgba(26, 42, 94, 0.06)'
                             }}>
                          <span className="text-[0.9375rem] font-bold text-[#1a2a5e] tracking-wide">Review Deadline</span>
                          <span className="text-[0.9375rem] font-semibold" style={{ color: '#636e85' }}>{formatDate(selectedRequest.reviewDeadline)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </ScrollArea>

          <DialogFooter className="flex justify-end gap-4 px-10 py-7 border-t" style={{
            background: 'linear-gradient(to bottom, #fafbfc 0%, #f5f6f8 100%)',
            borderColor: 'rgba(26, 42, 94, 0.08)'
          }}>
            <button 
              className="px-10 py-3.5 rounded-2xl font-bold text-base transition-all duration-200 shadow-lg hover:-translate-y-0.5 active:translate-y-0" 
              style={{
                background: 'linear-gradient(135deg, #1a2a5e 0%, #2a3f7e 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(26, 42, 94, 0.2)',
                letterSpacing: '0.3px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #f5b800 0%, #e5ab00 100%)';
                e.currentTarget.style.color = '#1a2a5e';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 184, 0, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #1a2a5e 0%, #2a3f7e 100%)';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(26, 42, 94, 0.2)';
              }}
              onClick={() => setShowDetailsDialog(false)}
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
