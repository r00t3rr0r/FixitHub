import { useEffect, useState } from "react"
import { formatEUR } from '@/lib/utils'
import "./CustomerRepairRequests.css"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import {
  getMyRepairRequests,
  getRepairRequestById,
  RepairRequest
} from "@/api/repairRequests"
import {
  getUnreadMessageCount,
  getCommunicationThread,
  sendMessage,
  markMessagesAsRead,
  respondToFeedback,
  completeQuickAction,
} from "@/api/repairRequestCommunication"
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
  ImageIcon,
  Send,
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"


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

  // Inline communication thread state
  const [commThread, setCommThread] = useState<any | null>(null)
  const [commLoading, setCommLoading] = useState(false)
  const [commMessage, setCommMessage] = useState("")
  const [commSending, setCommSending] = useState(false)
  // Feedback response state
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [pendingFeedbackOption, setPendingFeedbackOption] = useState<{ label: string; value: string } | null>(null)
  const [completingAction, setCompletingAction] = useState<string | null>(null)

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

  // Load communication thread when dialog opens for a request
  useEffect(() => {
    if (!selectedRequest?._id || !showDetailsDialog) return
    let cancelled = false
    const loadThread = async () => {
      try {
        setCommLoading(true)
        const thread = await getCommunicationThread(selectedRequest._id)
        if (!cancelled) {
          setCommThread(thread)
          await markMessagesAsRead(selectedRequest._id).catch(() => {})
        }
      } catch {
        // silently ignore – thread may not exist yet
      } finally {
        if (!cancelled) setCommLoading(false)
      }
    }
    loadThread()
    const interval = setInterval(loadThread, 5000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [selectedRequest?._id, showDetailsDialog])

  // Respond to a feedback request
  const handleFeedbackResponse = async (messageId: string, option: { label: string; value: string }) => {
    if (!selectedRequest?._id) return
    try {
      const updated = await respondToFeedback(selectedRequest._id, messageId, option)
      setCommThread(updated)
      setRespondingTo(null)
      setPendingFeedbackOption(null)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fehler", description: error?.message || "Antwort konnte nicht gesendet werden" })
    }
  }

  // Complete a quick action
  const handleCompleteAction = async (messageId: string) => {
    if (!selectedRequest?._id) return
    try {
      setCompletingAction(messageId)
      const updated = await completeQuickAction(selectedRequest._id, messageId)
      setCommThread(updated)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fehler", description: error?.message || "Aktion konnte nicht abgeschlossen werden" })
    } finally {
      setCompletingAction(null)
    }
  }

  // Send message in details dialog
  const handleCommSend = async () => {
    if (!commMessage.trim() || !selectedRequest?._id) return
    try {
      setCommSending(true)
      const updated = await sendMessage(selectedRequest._id, commMessage)
      setCommThread(updated)
      setCommMessage("")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fehler", description: error?.message || "Nachricht konnte nicht gesendet werden" })
    } finally {
      setCommSending(false)
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
      <div className="mx-auto w-[calc(100%-2rem)] max-w-[1200px] pb-8 space-y-8 max-[480px]:w-[calc(100%-0.8rem)] max-[360px]:w-[calc(100%-0.5rem)]">
        {/* Header Section */}
        <div className="w-full overflow-hidden rounded-[18px] border-b border-[#2a3f7e] bg-gradient-to-br from-[#1a2a5e] to-[#0f1d45] px-6 py-12 text-white max-[480px]:rounded-[12px] max-[480px]:px-3 max-[360px]:px-[10px]">
          <div className="flex items-start gap-4 sm:items-center max-[480px]:items-start max-[480px]:gap-[10px]">
            <FileText className="h-12 w-12 flex-shrink-0 text-[#f5b800] max-sm:h-[34px] max-sm:w-[34px]" />
            <div>
              <h1 className="m-0 text-[2rem] font-extrabold leading-[1.2] tracking-[-0.5px] max-[480px]:text-[1rem] max-[480px]:leading-[1.25] max-[360px]:text-[0.92rem]">Meine Reparaturanfragen</h1>
              <p className="mt-1 text-[0.95rem] leading-[1.35] text-[rgba(255,255,255,0.85)] opacity-90 max-[480px]:text-[0.76rem] max-[360px]:text-[0.72rem]">Verfolge und verwalte deine Geraete-Reparaturanfragen</p>
            </div>
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
      <Dialog open={showDetailsDialog} onOpenChange={(open) => { setShowDetailsDialog(open); if (!open) { setCommThread(null); setCommMessage("") } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl my-0 sm:my-3 max-h-dvh sm:max-h-[92vh] p-0 gap-0 overflow-hidden border-none rounded-[16px] sm:rounded-[24px] shadow-[0_20px_60px_rgba(26,42,94,0.3)] flex flex-col">

          {/* Header */}
          <DialogHeader className="relative overflow-hidden flex-shrink-0" style={{ padding: '1.25rem 1.5rem', paddingRight: '3rem', background: 'linear-gradient(to right, #1a2a5e, #2a3f7e)', borderBottom: 'none' }}>
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(245,184,0,0.08) 0%, transparent 70%)' }} />
            <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(245,184,0,0.06) 0%, transparent 70%)' }} />
            <div className="relative z-10">
              <DialogTitle className="font-extrabold tracking-tight leading-tight" style={{ color: '#f5b800', fontSize: 'clamp(1.1rem, 3vw, 1.5rem)', marginBottom: '0.25rem' }}>
                Anfrage #{selectedRequest?.requestNumber}
              </DialogTitle>
              <DialogDescription className="font-medium" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 'clamp(0.85rem, 2vw, 1rem)', marginBottom: '0.75rem' }}>
                {selectedRequest?.deviceBrand} {selectedRequest?.deviceModel}
              </DialogDescription>
              {selectedRequest && (
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`status-badge status-${selectedRequest.status}`} style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }}>
                    {getStatusIcon(selectedRequest.status)}
                    {formatStatusLabel(selectedRequest.status)}
                  </span>
                  <span className="inline-flex items-center rounded-full font-semibold" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
                    {formatPriorityLabel(selectedRequest.priority)}
                  </span>
                </div>
              )}
              {selectedRequest && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem 0.25rem' }}>
                    <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#bfdbfe', fontWeight: 600, marginBottom: '0.2rem' }}>Eingereicht</p>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff' }}>{formatDate(selectedRequest.createdAt)}</p>
                  </div>
                  <div className="rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem 0.25rem' }}>
                    <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#bfdbfe', fontWeight: 600, marginBottom: '0.2rem' }}>Aktualisiert</p>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff' }}>{formatDate(selectedRequest.updatedAt)}</p>
                  </div>
                  <div className="rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem 0.25rem' }}>
                    <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#bfdbfe', fontWeight: 600, marginBottom: '0.2rem' }}>Schätzung</p>
                    <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f5b800' }}>{formatEUR(selectedRequest.estimatedCost)}</p>
                  </div>
                </div>
              )}
            </div>
          </DialogHeader>

          {detailsLoading ? (
            <div className="flex-1 flex items-center justify-center" style={{ background: '#f8f9fc' }}>
              <Loader2 className="h-7 w-7 animate-spin" style={{ color: '#1a2a5e' }} />
            </div>
          ) : selectedRequest ? (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {/* customer-repair-requests wrapper gives CSS scope for all dialog classes */}
              <div className="customer-repair-requests" style={{ padding: 0, maxWidth: 'none', background: 'transparent', minHeight: 'auto', margin: 0 }}>
                <div className="dialog-body">

                  {/* In Auftrag umgewandelt */}
                  {selectedRequest.status === 'converted' && selectedRequest.convertedToOrderId && (
                    <div className="converted-alert">
                      <p className="converted-alert-title">
                        <CheckCircle />
                        In Auftrag umgewandelt
                      </p>
                      <div className="dialog-info-grid">
                        <div className="dialog-info-item">
                          <span className="dialog-info-label">Auftragsnummer</span>
                          <span className="dialog-info-value">{selectedRequest.convertedToOrderId.orderNumber}</span>
                        </div>
                        <div className="dialog-info-item">
                          <span className="dialog-info-label">Umgewandelt von</span>
                          <span className="dialog-info-value">{selectedRequest.convertedByStaffName || 'k. A.'}</span>
                        </div>
                        {selectedRequest.convertedAt && (
                          <div className="dialog-info-item">
                            <span className="dialog-info-label">Umgewandelt am</span>
                            <span className="dialog-info-value">{formatDate(selectedRequest.convertedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Gerät & Problem */}
                  <div className="dialog-section">
                    <h3 className="dialog-section-title">
                      <Smartphone />
                      Gerät & Problem
                    </h3>
                    <div className="dialog-info-grid">
                      <div className="dialog-info-item">
                        <span className="dialog-info-label">Marke</span>
                        <span className="dialog-info-value">{selectedRequest.deviceBrand}</span>
                      </div>
                      <div className="dialog-info-item">
                        <span className="dialog-info-label">Modell</span>
                        <span className="dialog-info-value">{selectedRequest.deviceModel}</span>
                      </div>
                      {selectedRequest.modelNumber && (
                        <div className="dialog-info-item">
                          <span className="dialog-info-label">Modellnummer</span>
                          <span className="dialog-info-value">{selectedRequest.modelNumber}</span>
                        </div>
                      )}
                      <div className="dialog-info-item" style={{ gridColumn: '1 / -1' }}>
                        <span className="dialog-info-label">Problembeschreibung</span>
                        <span className="dialog-info-value" style={{ lineHeight: 1.6 }}>{selectedRequest.issueDescription}</span>
                      </div>
                    </div>
                  </div>

                  {/* Zusätzliche Details */}
                  {(selectedRequest.waterDamage || selectedRequest.itemCondition || selectedRequest.previousRepairDetails) && (
                    <div className="dialog-section">
                      <h3 className="dialog-section-title">
                        Zusätzliche Details
                      </h3>
                      <div className="dialog-info-grid">
                        {selectedRequest.waterDamage && (
                          <div className="dialog-info-item">
                            <span className="dialog-info-label">Wasserschaden</span>
                            <span className="dialog-info-value">
                              {selectedRequest.waterDamage === 'yes' ? 'Ja' : selectedRequest.waterDamage === 'no' ? 'Nein' : 'Unsicher'}
                            </span>
                          </div>
                        )}
                        {selectedRequest.itemCondition && (
                          <div className="dialog-info-item">
                            <span className="dialog-info-label">Gerätezustand</span>
                            <span className="dialog-info-value">
                              {selectedRequest.itemCondition === 'original' ? 'Original' : selectedRequest.itemCondition === 'refurbished' ? 'Generalüberholt' : 'Unsicher'}
                            </span>
                          </div>
                        )}
                        {selectedRequest.previousRepairDetails && (
                          <div className="dialog-info-item" style={{ gridColumn: '1 / -1' }}>
                            <span className="dialog-info-label">Bisherige Reparaturversuche</span>
                            <span className="dialog-info-value" style={{ lineHeight: 1.6 }}>{selectedRequest.previousRepairDetails}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bilder */}
                  {selectedRequest.images && selectedRequest.images.length > 0 && (
                    <div className="dialog-section">
                      <h3 className="dialog-section-title">
                        <ImageIcon />
                        Bilder
                      </h3>
                      <div className="images-grid">
                        {selectedRequest.images.map((image, index) => (
                          <img
                            key={index}
                            src={image}
                            alt={`Gerätebild ${index + 1}`}
                            className="request-image"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Kommunikation */}
                  <div className="dialog-section">
                    <h3 className="dialog-section-title">
                      <MessageSquare />
                      Kommunikation ({commThread?.messages?.length ?? 0})
                    </h3>

                    {commLoading && !commThread ? (
                      <div className="crr-comm-empty">
                        <Loader2 className="h-4 w-4 animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                        Wird geladen…
                      </div>
                    ) : !commThread?.messages?.length ? (
                      <div className="crr-comm-empty">
                        Noch keine Nachrichten. Schreib uns deine Fragen oder Anmerkungen.
                      </div>
                    ) : (
                      <div className="crr-comm-thread">
                        {commThread.messages.map((msg: any) => (
                          <div
                            key={msg._id}
                            className={`crr-comm-item${msg.senderType !== 'customer' ? ' is-staff' : ''}`}
                          >
                            <div className="crr-comm-meta">
                              <span className="crr-comm-author">{msg.senderName}</span>
                              <span className={`crr-comm-role ${msg.senderType === 'customer' ? 'customer' : 'staff'}`}>
                                {msg.senderType === 'customer' ? 'Sie' : 'Support'}
                              </span>
                              <span className="crr-comm-time">{formatDate(msg.createdAt)}</span>
                            </div>

                            {msg.messageType === 'feedback_request' && msg.feedbackRequest ? (
                              <div className="crr-feedback">
                                <p className="crr-feedback-badge">❓ Feedback erforderlich</p>
                                <p className="crr-feedback-question">{msg.feedbackRequest.question}</p>
                                {msg.feedbackRequest.status === 'pending' && respondingTo !== msg._id ? (
                                  <div className="crr-feedback-options">
                                    {(msg.feedbackRequest.options || []).map((opt: any) => (
                                      <button
                                        key={opt.value}
                                        className="crr-feedback-option-btn"
                                        onClick={() => { setRespondingTo(msg._id); setPendingFeedbackOption(opt) }}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                ) : respondingTo === msg._id ? (
                                  <div className="crr-feedback-confirm">
                                    <p>Bestätigen: <strong>{pendingFeedbackOption?.label}</strong></p>
                                    <div className="crr-feedback-confirm-btns">
                                      <button className="crr-feedback-confirm-ok" onClick={() => handleFeedbackResponse(msg._id, pendingFeedbackOption!)}>Ja, absenden</button>
                                      <button className="crr-feedback-confirm-cancel" onClick={() => { setRespondingTo(null); setPendingFeedbackOption(null) }}>Abbrechen</button>
                                    </div>
                                  </div>
                                ) : msg.feedbackRequest.response ? (
                                  <div className="crr-feedback-answered">
                                    <CheckCircle size={14} />
                                    <span>Ihre Antwort: <strong>{msg.feedbackRequest.response.label}</strong></span>
                                  </div>
                                ) : null}
                              </div>
                            ) : msg.messageType === 'quick_action' && msg.quickAction ? (
                              <div className="crr-quick-action">
                                <p className="crr-quick-action-badge">⚡ Aktion erforderlich</p>
                                <p className="crr-quick-action-label">{msg.quickAction.actionLabel}</p>
                                {msg.quickAction.description && (
                                  <p className="crr-quick-action-desc">{msg.quickAction.description}</p>
                                )}
                                {msg.quickAction.status === 'pending' ? (
                                  <button
                                    className="crr-quick-action-btn"
                                    disabled={completingAction === msg._id}
                                    onClick={() => handleCompleteAction(msg._id)}
                                  >
                                    {completingAction === msg._id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                                    Als erledigt markieren
                                  </button>
                                ) : (
                                  <p className="crr-quick-action-done">✓ Abgeschlossen</p>
                                )}
                              </div>
                            ) : (
                              <p className="crr-comm-text">{msg.content}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="crr-comm-composer">
                      <textarea
                        rows={3}
                        placeholder="Nachricht schreiben…"
                        value={commMessage}
                        onChange={(e) => setCommMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCommSend()
                        }}
                      />
                      <div className="crr-comm-composer-footer">
                        <button
                          className="crr-comm-send-btn"
                          onClick={handleCommSend}
                          disabled={commSending || !commMessage.trim()}
                        >
                          {commSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          Senden
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          ) : null}

          {/* Footer */}
          <div className="customer-repair-requests" style={{ padding: 0, maxWidth: 'none', background: 'transparent', minHeight: 'auto', margin: 0, flexShrink: 0 }}>
            <div className="dialog-footer">
              <button className="dialog-close-button" onClick={() => setShowDetailsDialog(false)}>
                Schließen
              </button>
            </div>
          </div>

        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
