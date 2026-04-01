import { useEffect, useState } from "react"
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
  MessageSquare,
  Smartphone,
  Wrench,
  ImageIcon
} from "lucide-react"
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
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ExtendedRepairRequest extends RepairRequest {
  unreadMessages?: number
}

export function CustomerRepairRequests() {
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
          title: "Fehler",
          description: error instanceof Error ? error.message : "Reparaturanfragen konnten nicht geladen werden"
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
        title: "Fehler",
        description: error instanceof Error ? error.message : "Anfragedetails konnten nicht geladen werden"
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
    return new Date(date).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Ausstehend',
      reviewing: 'In Pruefung',
      approved: 'Genehmigt',
      rejected: 'Abgelehnt',
      converted: 'In Auftrag umgewandelt'
    }

    return labels[status] || status
  }

  const formatPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      low: 'Niedrig',
      medium: 'Mittel',
      high: 'Hoch',
      urgent: 'Dringend'
    }

    return labels[priority] || priority
  }

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'converted':
        return 'bg-emerald-500 text-white'
      case 'approved':
        return 'bg-blue-500 text-white'
      case 'reviewing':
        return 'bg-[#f5b800] text-[#1a2a5e]'
      case 'rejected':
        return 'bg-red-500 text-white'
      default:
        return 'bg-slate-500 text-white'
    }
  }

  const getStatusAccentColor = (status: string) => {
    switch (status) {
      case 'converted':
        return '#10b981'
      case 'approved':
        return '#3b82f6'
      case 'reviewing':
        return '#f5b800'
      case 'rejected':
        return '#ef4444'
      default:
        return '#94a3b8'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Reparaturanfragen werden geladen...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-amber-50/20">
      <div className="max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#f5b800] rounded-full opacity-5 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#f5b800] rounded-full opacity-5 blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="h-8 w-8 text-[#f5b800]" />
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Meine Reparaturanfragen</h1>
            </div>
            <p className="text-blue-100 text-base md:text-lg">Verfolge und verwalte deine Geraete-Reparaturanfragen</p>
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
                    placeholder="Nach Geraet oder Anfragenummer suchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 text-sm border-slate-200 focus:border-[#f5b800] focus:ring-[#f5b800]"
                  />
                </div>
              </div>
              <div className="min-w-[180px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 text-sm border-slate-200 focus:border-[#f5b800] focus:ring-[#f5b800]">
                    <SelectValue placeholder="Status waehlen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="pending">Ausstehend</SelectItem>
                    <SelectItem value="reviewing">In Pruefung</SelectItem>
                    <SelectItem value="approved">Genehmigt</SelectItem>
                    <SelectItem value="rejected">Abgelehnt</SelectItem>
                    <SelectItem value="converted">In Auftrag umgewandelt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Requests Table */}
        <Card className="border-none shadow-lg bg-white">
          <CardHeader className="border-b border-slate-100 bg-white">
            <CardTitle className="text-xl font-bold text-[#1a2a5e]">Reparaturanfragen ({filteredRequests.length})</CardTitle>
            <CardDescription className="text-slate-600">
              Klicke auf eine Anfrage, um Details zu sehen und mit dem Team zu kommunizieren
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
                    ? "Keine Reparaturanfragen gefunden"
                    : "Noch keine Reparaturanfragen"}
                </h3>
                <p className="text-slate-500">
                  {searchTerm || statusFilter !== 'all'
                    ? "Passe deine Filter an, um passende Ergebnisse zu finden."
                    : "Du hast noch keine Reparaturanfrage eingereicht."}
                </p>
              </div>
            ) : (
              <div className="space-y-3 p-4 sm:p-5">
                {filteredRequests.map((request) => (
                  <div
                    key={request._id}
                    onClick={() => openDetailsDialog(request)}
                    className="group bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex items-center gap-4 cursor-pointer transition-all hover:border-[#f5b800] hover:shadow-md"
                  >
                    <div
                      className="w-1 self-stretch rounded-full"
                      style={{ background: getStatusAccentColor(request.status) }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">{request.requestNumber}</span>
                        <span className={`status-badge status-${request.status}`}>
                          {getStatusIcon(request.status)}
                          <span>{formatStatusLabel(request.status)}</span>
                        </span>
                        {unreadCounts[request._id] > 0 && (
                          <span className="inline-flex items-center rounded-full bg-red-500 text-white text-[11px] font-bold px-2 py-0.5">
                            {unreadCounts[request._id]} neu
                          </span>
                        )}
                      </div>

                      <p className="text-base font-semibold text-slate-900 truncate mb-1.5">
                        {request.issueDescription}
                      </p>

                      <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-600 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Smartphone className="h-3.5 w-3.5" />
                          {request.deviceBrand} {request.deviceModel}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(request.createdAt)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className={`priority-badge priority-${request.priority}`}>
                            {formatPriorityLabel(request.priority)}
                          </span>
                        </span>
                      </div>
                    </div>

                    <button
                      className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-[#1a2a5e] group-hover:border-[#f5b800]"
                      onClick={(e) => {
                        e.stopPropagation()
                        openDetailsDialog(request)
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">Details anzeigen</span>
                    </button>
                  </div>
                ))}
              </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-[95vw] xl:max-w-6xl my-4 max-h-[88vh] p-0 gap-0 overflow-hidden border-none shadow-[0_20px_60px_rgba(26,42,94,0.3)] flex flex-col">
          <DialogHeader className="px-5 sm:px-8 py-6 bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] relative overflow-hidden border-b-0">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-[0.08] blur-3xl pointer-events-none bg-[radial-gradient(circle,rgba(245,184,0,1)_0%,transparent_70%)]" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-[0.06] blur-3xl pointer-events-none bg-[radial-gradient(circle,rgba(245,184,0,1)_0%,transparent_70%)]" />

            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:pr-8">
              <div className="space-y-2">
                <DialogTitle className="text-2xl sm:text-[1.75rem] font-extrabold tracking-tight" style={{ color: '#f5b800' }}>
                  Anfrage #{selectedRequest?.requestNumber}
                </DialogTitle>
                <DialogDescription className="text-base sm:text-lg text-white/90">
                  {selectedRequest?.deviceBrand} {selectedRequest?.deviceModel}
                </DialogDescription>
                {selectedRequest && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold ${getStatusBadgeClasses(selectedRequest.status)}`}>
                      {getStatusIcon(selectedRequest.status)}
                      {formatStatusLabel(selectedRequest.status)}
                    </Badge>
                    <Badge variant="secondary" className="bg-white/15 text-white hover:bg-white/15 capitalize">
                      Prioritaet: {formatPriorityLabel(selectedRequest.priority)}
                    </Badge>
                  </div>
                )}
              </div>

              {selectedRequest && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full sm:w-auto">
                  <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-center min-w-[92px]">
                    <p className="text-[11px] sm:text-xs uppercase tracking-wide text-blue-100">Eingereicht</p>
                    <p className="text-xs sm:text-sm font-semibold text-white">{formatDate(selectedRequest.createdAt)}</p>
                  </div>
                  <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-center min-w-[92px]">
                    <p className="text-[11px] sm:text-xs uppercase tracking-wide text-blue-100">Aktualisiert</p>
                    <p className="text-xs sm:text-sm font-semibold text-white">{formatDate(selectedRequest.updatedAt)}</p>
                  </div>
                  <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-center min-w-[92px]">
                    <p className="text-[11px] sm:text-xs uppercase tracking-wide text-blue-100">Schaetzung</p>
                    <p className="text-xs sm:text-sm font-extrabold text-[#f5b800]">${selectedRequest.estimatedCost.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>
          </DialogHeader>

          {detailsLoading ? (
            <div className="h-[60vh] flex items-center justify-center bg-gradient-to-b from-white to-slate-50">
              <Loader2 className="h-7 w-7 animate-spin text-[#1a2a5e]" />
            </div>
          ) : selectedRequest ? (
            <Tabs defaultValue="overview" className="flex flex-col lg:flex-row flex-1 min-h-0 bg-gradient-to-b from-white to-slate-50">
              <div className="lg:w-72 lg:border-r lg:border-slate-200/80 bg-white/80 backdrop-blur-sm">
                <div className="px-4 pt-4 pb-2 lg:pb-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 mb-3">Bereiche</p>
                  <TabsList className="w-full h-auto p-0 bg-transparent rounded-none flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible">
                    <TabsTrigger value="overview" className="min-w-max lg:w-full justify-start rounded-xl px-3 py-2.5 data-[state=active]:bg-[#1a2a5e] data-[state=active]:text-white data-[state=active]:shadow">
                      <FileText className="h-4 w-4 mr-2" />
                      Uebersicht
                    </TabsTrigger>
                    <TabsTrigger value="device" className="min-w-max lg:w-full justify-start rounded-xl px-3 py-2.5 data-[state=active]:bg-[#1a2a5e] data-[state=active]:text-white data-[state=active]:shadow">
                      <Smartphone className="h-4 w-4 mr-2" />
                      Geraet & Problem
                    </TabsTrigger>
                    <TabsTrigger value="communication" className="min-w-max lg:w-full justify-start rounded-xl px-3 py-2.5 data-[state=active]:bg-[#1a2a5e] data-[state=active]:text-white data-[state=active]:shadow">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Kommunikation
                    </TabsTrigger>
                    <TabsTrigger value="media" className="min-w-max lg:w-full justify-start rounded-xl px-3 py-2.5 data-[state=active]:bg-[#1a2a5e] data-[state=active]:text-white data-[state=active]:shadow">
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Bilder
                    </TabsTrigger>
                    <TabsTrigger value="timeline" className="min-w-max lg:w-full justify-start rounded-xl px-3 py-2.5 data-[state=active]:bg-[#1a2a5e] data-[state=active]:text-white data-[state=active]:shadow">
                      <Calendar className="h-4 w-4 mr-2" />
                      Zeitverlauf
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <ScrollArea className="h-full">
                  <div className="p-4 sm:p-6 lg:p-7 space-y-5">
                    <TabsContent value="overview" className="mt-0 space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Anfrage</p>
                          <p className="text-base font-semibold text-[#1a2a5e] mt-1">{selectedRequest.requestNumber}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Status</p>
                          <p className="text-base font-semibold text-[#1a2a5e] mt-1">{formatStatusLabel(selectedRequest.status)}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Prioritaet</p>
                          <p className="text-base font-semibold text-[#1a2a5e] mt-1 capitalize">{formatPriorityLabel(selectedRequest.priority)}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Schaetzung</p>
                          <p className="text-base font-extrabold text-[#1a2a5e] mt-1">${selectedRequest.estimatedCost.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <h3 className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] mb-3">Geraet & Problem</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Marke</p>
                              <p className="text-sm font-semibold text-[#1a2a5e] mt-0.5">{selectedRequest.deviceBrand}</p>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Modell</p>
                              <p className="text-sm font-semibold text-[#1a2a5e] mt-0.5">{selectedRequest.deviceModel}</p>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 sm:col-span-2">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Problem</p>
                              <p className="text-sm text-[#1a2a5e] mt-0.5 line-clamp-2">{selectedRequest.issueDescription}</p>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 sm:col-span-2">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Aufgetreten am</p>
                              <p className="text-sm font-semibold text-[#1a2a5e] mt-0.5">{formatDate(selectedRequest.issueOccurredDate)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <h3 className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] mb-3">Kommunikation</h3>
                          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Nachrichten</p>
                              <p className="text-sm font-semibold text-[#1a2a5e] mt-0.5">{selectedRequest.messages?.length || 0}</p>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Ungelesen</p>
                              <p className="text-sm font-semibold text-[#1a2a5e] mt-0.5">{unreadCounts[selectedRequest._id] || 0}</p>
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Letzte Nachricht</p>
                            <p className="text-sm text-[#1a2a5e] mt-0.5 line-clamp-2">
                              {selectedRequest.messages && selectedRequest.messages.length > 0
                                ? selectedRequest.messages[selectedRequest.messages.length - 1].message
                                : "Noch keine Nachrichten vorhanden."}
                            </p>
                          </div>
                        </div>
                      </div>

                      {selectedRequest.status === 'converted' && selectedRequest.convertedToOrderId && (
                        <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-5">
                          <h3 className="text-lg font-bold text-emerald-800 flex items-center gap-2 mb-3">
                            <CheckCircle className="h-5 w-5" />
                            In Auftrag umgewandelt
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div className="rounded-xl border border-emerald-200 bg-white p-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Auftragsnummer</p>
                              <p className="mt-1 font-semibold text-[#1a2a5e]">{selectedRequest.convertedToOrderId.orderNumber}</p>
                            </div>
                            <div className="rounded-xl border border-emerald-200 bg-white p-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Umgewandelt von</p>
                              <p className="mt-1 font-semibold text-[#1a2a5e]">{selectedRequest.convertedByStaffName || 'k. A.'}</p>
                            </div>
                            {selectedRequest.convertedAt && (
                              <div className="rounded-xl border border-emerald-200 bg-white p-3">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Umgewandelt am</p>
                                <p className="mt-1 font-semibold text-[#1a2a5e]">{formatDate(selectedRequest.convertedAt)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedRequest.assignedStaffName && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                          <h3 className="text-lg font-bold text-[#1a2a5e] flex items-center gap-2 mb-2">
                            <Wrench className="h-5 w-5 text-[#f5b800]" />
                            Zugewiesenes Teammitglied
                          </h3>
                          <p className="text-slate-700">{selectedRequest.assignedStaffName}</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="device" className="mt-0 space-y-5">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="text-lg font-bold text-[#1a2a5e] mb-4">Geraeteinformationen</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Marke</p>
                            <p className="mt-1 font-semibold text-[#1a2a5e]">{selectedRequest.deviceBrand}</p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Modell</p>
                            <p className="mt-1 font-semibold text-[#1a2a5e]">{selectedRequest.deviceModel}</p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 sm:col-span-2">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Problembeschreibung</p>
                            <p className="mt-1 font-semibold text-[#1a2a5e] leading-relaxed">{selectedRequest.issueDescription}</p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Problem aufgetreten am</p>
                            <p className="mt-1 font-semibold text-[#1a2a5e]">{formatDate(selectedRequest.issueOccurredDate)}</p>
                          </div>
                          {selectedRequest.modelNumber && (
                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Modellnummer</p>
                              <p className="mt-1 font-semibold text-[#1a2a5e]">{selectedRequest.modelNumber}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {(selectedRequest.waterDamage || selectedRequest.itemCondition || selectedRequest.previousRepairDetails) && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                          <h3 className="text-lg font-bold text-[#1a2a5e] mb-4">Zusaetzliche Details</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedRequest.waterDamage && (
                              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Wasserschaden</p>
                                <Badge variant={selectedRequest.waterDamage === 'yes' ? 'destructive' : 'secondary'} className="mt-2">
                                  {selectedRequest.waterDamage === 'yes' ? 'Ja' : selectedRequest.waterDamage === 'no' ? 'Nein' : 'Unsicher'}
                                </Badge>
                              </div>
                            )}
                            {selectedRequest.itemCondition && (
                              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Geraetezustand</p>
                                <Badge variant="outline" className="mt-2">
                                  {selectedRequest.itemCondition === 'original' ? 'Original' : selectedRequest.itemCondition === 'refurbished' ? 'Generalueberholt' : 'Unsicher'}
                                </Badge>
                              </div>
                            )}
                            {selectedRequest.previousRepairDetails && (
                              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 sm:col-span-2">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Bisherige Reparaturversuche</p>
                                <p className="mt-2 text-sm sm:text-base text-[#1a2a5e] leading-relaxed">{selectedRequest.previousRepairDetails}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="communication" className="mt-0 space-y-5">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                        <h3 className="text-lg font-bold text-[#1a2a5e] mb-1">Kommunikation</h3>
                        <p className="text-sm text-slate-600 mb-4">Hier kannst du den Verlauf verfolgen und Rueckfragen direkt mit dem Team klaeren.</p>
                        <RepairRequestMessagesPanel
                          requestId={selectedRequest._id}
                          userRole={user?.role}
                          isReadOnly={false}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="media" className="mt-0 space-y-5">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="text-lg font-bold text-[#1a2a5e] mb-4">Hochgeladene Bilder</h3>
                        {selectedRequest.images && selectedRequest.images.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {selectedRequest.images.map((image, index) => (
                              <img
                                key={index}
                                src={image}
                                alt={`Geraetebild ${index + 1}`}
                                className="w-full h-52 object-cover rounded-xl border border-slate-200 transition-all duration-200 hover:border-[#f5b800] hover:shadow-md"
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-500 text-sm">Fuer diese Anfrage wurden keine Bilder hochgeladen.</p>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="timeline" className="mt-0 space-y-5">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="text-lg font-bold text-[#1a2a5e] mb-4">Zeitverlauf</h3>
                        <div className="space-y-3">
                          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex items-center justify-between gap-3">
                            <span className="font-semibold text-[#1a2a5e]">Erstellt</span>
                            <span className="text-sm text-slate-600">{formatDate(selectedRequest.createdAt)}</span>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex items-center justify-between gap-3">
                            <span className="font-semibold text-[#1a2a5e]">Zuletzt aktualisiert</span>
                            <span className="text-sm text-slate-600">{formatDate(selectedRequest.updatedAt)}</span>
                          </div>
                          {selectedRequest.reviewDeadline && (
                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex items-center justify-between gap-3">
                              <span className="font-semibold text-[#1a2a5e]">Prueffrist</span>
                              <span className="text-sm text-slate-600">{formatDate(selectedRequest.reviewDeadline)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </TabsContent>
                  </div>
                </ScrollArea>
              </div>
            </Tabs>
          ) : null}

          <DialogFooter className="px-5 sm:px-8 py-5 border-t border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100">
            <button
              className="px-6 sm:px-8 py-2.5 rounded-xl font-bold text-sm sm:text-base transition-all duration-200 bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] text-white shadow hover:brightness-110"
              onClick={() => setShowDetailsDialog(false)}
            >
              Schliessen
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
