import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { SEO } from '@/components/SEO'
import "./CustomerRepairRequests.css"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/useToast"
import {
  getMyRepairRequests,
  getRepairRequestById,
  respondToRepairRequestQuote,
  RepairRequest,
} from "@/api/repairRequests"
import {
  getCommunicationThread,
  sendMessage,
  markMessagesAsRead,
  respondToFeedback,
  completeQuickAction,
} from "@/api/repairRequestCommunication"
import { QuoteResponseCard } from "@/components/repair-request/QuoteResponseCard"
import {
  formatDateDe,
  formatDeviceLabel,
  formatMoney,
  newClientMessageId,
  statusLabel,
} from "@/components/repair-request/repairRequestFormat"
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
  RefreshCw,
  ExternalLink,
  Plus,
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

const statusBadgeClass = (status: string) => {
  switch (status) {
    case "converted": return "bg-emerald-100 text-emerald-800 ring-emerald-200"
    case "approved": return "bg-blue-100 text-blue-800 ring-blue-200"
    case "reviewing": return "bg-amber-100 text-amber-900 ring-amber-200"
    case "rejected": return "bg-red-100 text-red-800 ring-red-200"
    default: return "bg-slate-100 text-slate-700 ring-slate-200"
  }
}

const statusAccentColor = (status: string) => {
  switch (status) {
    case "converted": return "#10b981"
    case "approved": return "#3b82f6"
    case "reviewing": return "#f5b800"
    case "rejected": return "#ef4444"
    default: return "#94a3b8"
  }
}

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case "converted":
    case "approved": return <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
    case "reviewing": return <Clock className="h-3.5 w-3.5" aria-hidden="true" />
    case "rejected": return <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
    default: return <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
  }
}

export function CustomerRepairRequests() {
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  // Liste: Laden / Fehler / leer sind getrennte Zustände
  const [requests, setRequests] = useState<RepairRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Detaildialog
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<RepairRequest | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState("")

  // Nachrichten
  const [commThread, setCommThread] = useState<any | null>(null)
  const [commLoading, setCommLoading] = useState(false)
  const [commError, setCommError] = useState("")
  const [commMessage, setCommMessage] = useState("")
  const [commSending, setCommSending] = useState(false)
  const sendingRef = useRef(false)
  const draftIdRef = useRef<string>(newClientMessageId())
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [pendingFeedbackOption, setPendingFeedbackOption] = useState<{ label: string; value: string } | null>(null)
  const [completingAction, setCompletingAction] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError("")
      const response: any = await getMyRepairRequests()
      setRequests(response?.requests || [])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Reparaturanfragen konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const filteredRequests = requests.filter((request) => {
    if (statusFilter === "answer" && !request.responseRequired) return false
    if (statusFilter !== "all" && statusFilter !== "answer" && request.status !== statusFilter) return false
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    return [request.deviceBrand, request.deviceModel, request.requestNumber, request.issueDescription]
      .some((value) => String(value || "").toLowerCase().includes(q))
  })

  const loadDetails = useCallback(async (requestId: string) => {
    try {
      setDetailsLoading(true)
      setDetailsError("")
      const response: any = await getRepairRequestById(requestId)
      if (response?.request) setSelectedRequest(response.request)
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : "Anfragedetails konnten nicht geladen werden.")
    } finally {
      setDetailsLoading(false)
    }
  }, [])

  const openDetailsDialog = (request: RepairRequest) => {
    setSelectedRequest(request)
    setShowDetailsDialog(true)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set("requestId", request._id)
      return next
    }, { replace: true })
    loadDetails(request._id)
  }

  const closeDetailsDialog = () => {
    setShowDetailsDialog(false)
    setCommThread(null)
    setCommMessage("")
    setCommError("")
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete("requestId")
      return next
    }, { replace: true })
    // Liste aktualisieren (Antwortstatus, ungelesen)
    fetchRequests()
  }

  // Deep-Link aus E-Mail/Benachrichtigung: /my-repair-requests?requestId=<id>
  useEffect(() => {
    const requestId = searchParams.get("requestId")
    if (!requestId || showDetailsDialog) return
    const fromList = requests.find((r) => r._id === requestId)
    setSelectedRequest(fromList || null)
    setShowDetailsDialog(true)
    loadDetails(requestId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Thread laden (nur bei geöffnetem Dialog = vollständig sichtbar => als gelesen markieren)
  useEffect(() => {
    const id = selectedRequest?._id
    if (!id || !showDetailsDialog) return
    let cancelled = false
    const loadThread = async (initial: boolean) => {
      try {
        if (initial) setCommLoading(true)
        const thread = await getCommunicationThread(id)
        if (cancelled) return
        setCommThread(thread)
        setCommError("")
        if (thread?.messages?.length) await markMessagesAsRead(id).catch(() => {})
      } catch (error) {
        if (!cancelled && initial) setCommError(error instanceof Error ? error.message : "Nachrichten konnten nicht geladen werden.")
      } finally {
        if (!cancelled && initial) setCommLoading(false)
      }
    }
    loadThread(true)
    const interval = setInterval(() => loadThread(false), 10000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [selectedRequest?._id, showDetailsDialog])

  const handleQuoteRespond = async (decision: "accept" | "decline", seen: { quoteVersion: number; amount: number }) => {
    if (!selectedRequest?._id) return
    const requestId = selectedRequest._id
    let response: any
    try {
      response = await respondToRepairRequestQuote(requestId, decision, seen)
    } catch (error: any) {
      // Stand veraltet oder schon beantwortet: aktuellen Kostenvoranschlag laden und anzeigen.
      if (error?.code === "QUOTE_CHANGED" || error?.code === "QUOTE_NOT_OPEN") {
        const fresh: any = await getRepairRequestById(requestId).catch(() => null)
        if (fresh?.request) setSelectedRequest(fresh.request)
        const thread = await getCommunicationThread(requestId).catch(() => null)
        if (thread) setCommThread(thread)
      }
      throw error
    }
    if (response?.request) setSelectedRequest(response.request)
    const thread = await getCommunicationThread(selectedRequest._id).catch(() => null)
    if (thread) setCommThread(thread)
    toast({
      title: decision === "accept" ? "Kostenvoranschlag angenommen" : "Kostenvoranschlag abgelehnt",
      description: decision === "accept" ? "Danke! Wir melden uns mit den nächsten Schritten." : "Unser Team meldet sich bei Ihnen.",
    })
  }

  const handleFeedbackResponse = async (messageId: string, option: { label: string; value: string }) => {
    if (!selectedRequest?._id) return
    try {
      const updated = await respondToFeedback(selectedRequest._id, messageId, option)
      setCommThread(updated)
      setRespondingTo(null)
      setPendingFeedbackOption(null)
      toast({ title: "Antwort gesendet", description: `Ihre Antwort: ${option.label}` })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fehler", description: error?.message || "Antwort konnte nicht gesendet werden." })
    }
  }

  const handleCompleteAction = async (messageId: string) => {
    if (!selectedRequest?._id) return
    try {
      setCompletingAction(messageId)
      const updated = await completeQuickAction(selectedRequest._id, messageId)
      setCommThread(updated)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fehler", description: error?.message || "Aktion konnte nicht abgeschlossen werden." })
    } finally {
      setCompletingAction(null)
    }
  }

  // Ein Sende-Weg für Klick und Enter, mit Sperre gegen Doppelsenden und Idempotenzschlüssel
  const handleCommSend = async () => {
    const text = commMessage.trim()
    if (!text || !selectedRequest?._id || sendingRef.current) return
    sendingRef.current = true
    setCommSending(true)
    try {
      const updated = await sendMessage(selectedRequest._id, text, draftIdRef.current)
      setCommThread(updated)
      setCommMessage("")
      draftIdRef.current = newClientMessageId()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fehler", description: error?.message || "Nachricht konnte nicht gesendet werden." })
    } finally {
      sendingRef.current = false
      setCommSending(false)
    }
  }

  const reported = selectedRequest?.reportedDevice
  const reportedLabel = reported ? formatDeviceLabel(reported.brand, reported.model) : ""
  const currentLabel = selectedRequest ? formatDeviceLabel(selectedRequest.deviceBrand, selectedRequest.deviceModel) : ""
  const closed = selectedRequest ? ["converted", "rejected"].includes(selectedRequest.status) : false

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-amber-50/20">
      <SEO
        title="Meine Reparaturanfragen – McRepair.de"
        description="Alle Ihre Reparaturanfragen im Überblick. Status einsehen, Nachrichten lesen und Anfragen verwalten im McRepair.de Kundenportal."
        canonical="/my-repair-requests"
        noindex={true}
      />
      <div className="mx-auto w-[calc(100%-2rem)] max-w-[1200px] space-y-6 pb-8 max-[480px]:w-[calc(100%-0.8rem)]">
        {/* Kopf */}
        <div className="w-full overflow-hidden rounded-[18px] border-b border-[#2a3f7e] bg-gradient-to-br from-[#1a2a5e] to-[#0f1d45] px-6 py-10 text-white max-[480px]:rounded-[12px] max-[480px]:px-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-4 sm:items-center">
              <FileText className="h-11 w-11 flex-shrink-0 text-[#f5b800] max-sm:h-[34px] max-sm:w-[34px]" aria-hidden="true" />
              <div>
                <h1 className="m-0 text-[2rem] font-extrabold leading-[1.2] tracking-[-0.5px] max-[480px]:text-[1.25rem]">Meine Reparaturanfragen</h1>
                <p className="mt-1 text-[0.95rem] text-white/85 max-[480px]:text-[0.8rem]">Status verfolgen, Kostenvoranschläge beantworten und mit unserem Team schreiben.</p>
              </div>
            </div>
            <Link
              to="/repair-request"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[#f5b800] px-4 text-sm font-bold text-[#1a2a5e] hover:bg-[#e5ab00]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Neue Reparaturanfrage
            </Link>
          </div>
        </div>

        {/* Filter */}
        <Card className="border-none bg-white shadow-lg">
          <CardContent className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-[#1a2a5e]">
                <Filter className="h-4 w-4" aria-hidden="true" />
                <span className="whitespace-nowrap text-sm font-bold">Filter</span>
              </div>
              <div className="min-w-[200px] flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <Input
                    placeholder="Nach Gerät oder Anfragenummer suchen …"
                    aria-label="Anfragen durchsuchen"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9 border-slate-200 pl-10 text-sm"
                  />
                </div>
              </div>
              <div className="min-w-[200px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 border-slate-200 text-sm" aria-label="Status filtern">
                    <SelectValue placeholder="Status wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Anfragen</SelectItem>
                    <SelectItem value="answer">Antwort erforderlich</SelectItem>
                    <SelectItem value="pending">Ausstehend</SelectItem>
                    <SelectItem value="reviewing">In Prüfung</SelectItem>
                    <SelectItem value="approved">Kostenvoranschlag angenommen</SelectItem>
                    <SelectItem value="rejected">Abgelehnt</SelectItem>
                    <SelectItem value="converted">In Auftrag umgewandelt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste */}
        <Card className="border-none bg-white shadow-lg">
          <CardHeader className="border-b border-slate-100 bg-white">
            <CardTitle className="text-xl font-bold text-[#1a2a5e]">
              Reparaturanfragen{!loading && !loadError ? ` (${filteredRequests.length})` : ""}
            </CardTitle>
            <CardDescription className="text-slate-600">
              Mit „Details ansehen“ öffnen Sie Kostenvoranschlag, Verlauf und Nachrichten einer Anfrage.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Wird geladen …
              </div>
            ) : loadError ? (
              <div className="py-14 text-center">
                <AlertCircle className="mx-auto mb-3 h-9 w-9 text-red-500" aria-hidden="true" />
                <p className="font-semibold text-slate-800">Reparaturanfragen konnten nicht geladen werden.</p>
                <p className="mt-1 text-sm text-slate-500">{loadError}</p>
                <button type="button" onClick={fetchRequests} className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-[#1a2a5e] hover:bg-slate-50">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Erneut versuchen
                </button>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="py-16 text-center">
                <AlertCircle className="mx-auto mb-4 h-10 w-10 text-slate-400" aria-hidden="true" />
                <h3 className="mb-2 text-lg font-semibold text-slate-700">
                  {requests.length > 0 ? "Keine Anfragen für diesen Filter" : "Noch keine Reparaturanfragen"}
                </h3>
                <p className="text-slate-500">
                  {requests.length > 0 ? "Passen Sie Suche oder Filter an." : "Sie haben noch keine Reparaturanfrage gestellt."}
                </p>
                {requests.length > 0 ? (
                  <button type="button" onClick={() => { setSearchTerm(""); setStatusFilter("all") }} className="mt-4 text-sm font-semibold text-[#1a2a5e] underline">
                    Filter zurücksetzen
                  </button>
                ) : (
                  <Link to="/repair-request" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1a2a5e] px-4 py-2 text-sm font-bold text-white">
                    <Plus className="h-4 w-4" aria-hidden="true" /> Reparaturanfrage stellen
                  </Link>
                )}
              </div>
            ) : (
              <ul className="space-y-3 p-4 sm:p-5">
                {filteredRequests.map((request) => {
                  const unread = request.communicationSummary?.unreadCount || 0
                  return (
                    <li
                      key={request._id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-[#f5b800] hover:shadow-md sm:flex-row sm:items-center sm:p-5"
                    >
                      <div className="hidden w-1 self-stretch rounded-full sm:block" style={{ background: statusAccentColor(request.status) }} />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{request.requestNumber}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusBadgeClass(request.status)}`}>
                            <StatusIcon status={request.status} /> {request.statusLabel || statusLabel(request.status)}
                          </span>
                          {request.responseRequired && (
                            <span className="inline-flex items-center rounded-full bg-[#f5b800] px-2.5 py-0.5 text-xs font-bold text-[#1a2a5e]">Antwort erforderlich</span>
                          )}
                          {unread > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
                              <MessageSquare className="h-3 w-3" aria-hidden="true" /> {unread} {unread === 1 ? "neue Nachricht" : "neue Nachrichten"}
                            </span>
                          )}
                        </div>
                        <p className="mb-1 truncate text-base font-semibold text-slate-900">{request.issueDescription}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <Smartphone className="h-3.5 w-3.5" aria-hidden="true" /> {request.deviceLabel || formatDeviceLabel(request.deviceBrand, request.deviceModel)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" aria-hidden="true" /> {formatDateDe(request.createdAt)}
                          </span>
                          {request.quote && (
                            <span className="font-semibold text-[#1a2a5e]">Kostenvoranschlag: {formatMoney(request.quote.amount)}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openDetailsDialog(request)}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-[#1a2a5e] px-4 text-sm font-bold text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" /> Details ansehen
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Detaildialog */}
        <Dialog open={showDetailsDialog} onOpenChange={(open) => { if (!open) closeDetailsDialog() }}>
          <DialogContent className="my-0 flex max-h-dvh max-w-[95vw] flex-col gap-0 overflow-hidden rounded-[16px] border-none p-0 shadow-[0_20px_60px_rgba(26,42,94,0.3)] sm:my-3 sm:max-h-[92vh] sm:max-w-2xl sm:rounded-[24px]">
            <DialogHeader className="relative flex-shrink-0 overflow-hidden" style={{ padding: '1.25rem 1.5rem', paddingRight: '3rem', background: 'linear-gradient(to right, #1a2a5e, #2a3f7e)' }}>
              <DialogTitle className="font-extrabold leading-tight tracking-tight" style={{ color: '#f5b800', fontSize: 'clamp(1.1rem, 3vw, 1.5rem)' }}>
                Anfrage {selectedRequest?.requestNumber || ""}
              </DialogTitle>
              <DialogDescription className="font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {currentLabel}
              </DialogDescription>
              {selectedRequest && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusBadgeClass(selectedRequest.status)}`}>
                    <StatusIcon status={selectedRequest.status} /> {selectedRequest.statusLabel || statusLabel(selectedRequest.status)}
                  </span>
                  <span className="text-xs text-white/80">Eingereicht am {formatDateDe(selectedRequest.createdAt)}</span>
                </div>
              )}
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f8f9fc]">
              {detailsLoading && !selectedRequest ? (
                <div className="flex items-center justify-center gap-2 py-16 text-slate-600"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Wird geladen …</div>
              ) : detailsError && !selectedRequest ? (
                <div className="py-14 text-center">
                  <p className="font-semibold text-slate-800">Die Anfrage konnte nicht geladen werden.</p>
                  <p className="mt-1 text-sm text-slate-500">{detailsError}</p>
                </div>
              ) : selectedRequest ? (
                <div className="customer-repair-requests" style={{ padding: 0, maxWidth: 'none', background: 'transparent', minHeight: 'auto', margin: 0 }}>
                  <div className="dialog-body space-y-4">
                    {/* Kostenvoranschlag zuerst – die wichtigste Aktion */}
                    {selectedRequest.quote && (
                      <QuoteResponseCard
                        quote={selectedRequest.quote}
                        canRespond={!closed}
                        onRespond={handleQuoteRespond}
                      />
                    )}

                    {selectedRequest.status === "converted" && (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="flex items-center gap-2 font-bold text-emerald-900"><CheckCircle className="h-4 w-4" aria-hidden="true" /> In Auftrag umgewandelt</p>
                        <p className="mt-1 text-sm text-emerald-900">
                          Ihre Anfrage wurde in den Auftrag {selectedRequest.convertedOrder?.orderNumber || selectedRequest.convertedToOrderId?.orderNumber || ""} umgewandelt
                          {selectedRequest.convertedAt ? ` (am ${formatDateDe(selectedRequest.convertedAt)})` : ""}.
                        </p>
                        {selectedRequest.convertedOrder?.path && (
                          <Link to={selectedRequest.convertedOrder.path} className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-[#1a2a5e] px-4 text-sm font-bold text-white">
                            <ExternalLink className="h-4 w-4" aria-hidden="true" /> Auftrag ansehen
                          </Link>
                        )}
                      </div>
                    )}

                    {/* Gerät & Problem */}
                    <div className="dialog-section">
                      <h3 className="dialog-section-title"><Smartphone aria-hidden="true" /> Gerät & Problem</h3>
                      <div className="dialog-info-grid">
                        <div className="dialog-info-item">
                          <span className="dialog-info-label">Gerät</span>
                          <span className="dialog-info-value">{currentLabel}</span>
                        </div>
                        {selectedRequest.deviceType && (
                          <div className="dialog-info-item">
                            <span className="dialog-info-label">Gerätetyp</span>
                            <span className="dialog-info-value">{selectedRequest.deviceType}</span>
                          </div>
                        )}
                        {reportedLabel && reportedLabel !== currentLabel && (
                          <div className="dialog-info-item" style={{ gridColumn: '1 / -1' }}>
                            <span className="dialog-info-label">Ihre ursprüngliche Angabe</span>
                            <span className="dialog-info-value">{reportedLabel}{reported?.source === "manual" ? " (manuell angegeben)" : ""}</span>
                          </div>
                        )}
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
                        {selectedRequest.waterDamage && (
                          <div className="dialog-info-item">
                            <span className="dialog-info-label">Flüssigkeitsschaden</span>
                            <span className="dialog-info-value">{selectedRequest.waterDamage === 'yes' ? 'Ja' : selectedRequest.waterDamage === 'no' ? 'Nein' : 'Nicht sicher'}</span>
                          </div>
                        )}
                        {selectedRequest.previousRepairDetails && (
                          <div className="dialog-info-item" style={{ gridColumn: '1 / -1' }}>
                            <span className="dialog-info-label">Bisherige Reparaturversuche</span>
                            <span className="dialog-info-value">{selectedRequest.previousRepairDetails}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedRequest.images && selectedRequest.images.length > 0 && (
                      <div className="dialog-section">
                        <h3 className="dialog-section-title"><ImageIcon aria-hidden="true" /> Fotos</h3>
                        <div className="images-grid">
                          {selectedRequest.images.map((image, index) => (
                            <img key={index} src={image} alt={`Gerätefoto ${index + 1}`} className="request-image" />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Nachrichten */}
                    <div className="dialog-section">
                      <h3 className="dialog-section-title"><MessageSquare aria-hidden="true" /> Nachrichten</h3>
                      {commLoading && !commThread ? (
                        <div className="crr-comm-empty"><Loader2 className="h-4 w-4 animate-spin" style={{ margin: '0 auto 0.5rem' }} /> Wird geladen …</div>
                      ) : commError && !commThread ? (
                        <div className="crr-comm-empty">Nachrichten konnten nicht geladen werden. Bitte später erneut versuchen.</div>
                      ) : !commThread?.messages?.length ? (
                        <div className="crr-comm-empty">Noch keine Nachrichten. Schreiben Sie uns Ihre Fragen oder Anmerkungen.</div>
                      ) : (
                        <div className="crr-comm-thread">
                          {commThread.messages.map((msg: any) => {
                            const isQuoteQuestion = msg.feedbackRequest?.metadata?.kind === "quote"
                            return (
                              <div key={msg._id} className={`crr-comm-item${msg.senderType !== 'customer' ? ' is-staff' : ''}`}>
                                <div className="crr-comm-meta">
                                  <span className="crr-comm-author">{msg.senderType === 'customer' ? 'Sie' : msg.senderName}</span>
                                  <span className={`crr-comm-role ${msg.senderType === 'customer' ? 'customer' : 'staff'}`}>
                                    {msg.senderType === 'customer' ? 'Sie' : 'McRepair-Team'}
                                  </span>
                                  <span className="crr-comm-time">{formatDateDe(msg.createdAt, true)}</span>
                                </div>
                                {msg.messageType === 'feedback_request' && msg.feedbackRequest ? (
                                  <div className="crr-feedback">
                                    <p className="crr-feedback-badge">{isQuoteQuestion ? 'Kostenvoranschlag' : 'Rückfrage an Sie'}</p>
                                    <p className="crr-feedback-question">{msg.feedbackRequest.question}</p>
                                    {msg.feedbackRequest.status === 'pending' && isQuoteQuestion ? (
                                      <p className="text-xs text-slate-600">Bitte antworten Sie oben in der Karte „Kostenvoranschlag“.</p>
                                    ) : msg.feedbackRequest.status === 'pending' && respondingTo !== msg._id ? (
                                      <div className="crr-feedback-options">
                                        {(msg.feedbackRequest.options || []).map((opt: any) => (
                                          <button key={opt.value} type="button" className="crr-feedback-option-btn" onClick={() => { setRespondingTo(msg._id); setPendingFeedbackOption(opt) }}>
                                            {opt.label}
                                          </button>
                                        ))}
                                      </div>
                                    ) : respondingTo === msg._id ? (
                                      <div className="crr-feedback-confirm">
                                        <p>Antwort bestätigen: <strong>{pendingFeedbackOption?.label}</strong></p>
                                        <div className="crr-feedback-confirm-btns">
                                          <button type="button" className="crr-feedback-confirm-ok" onClick={() => handleFeedbackResponse(msg._id, pendingFeedbackOption!)}>Ja, Antwort senden</button>
                                          <button type="button" className="crr-feedback-confirm-cancel" onClick={() => { setRespondingTo(null); setPendingFeedbackOption(null) }}>Abbrechen</button>
                                        </div>
                                      </div>
                                    ) : msg.feedbackRequest.status === 'expired' ? (
                                      <p className="text-xs text-slate-500">Diese Rückfrage ist nicht mehr gültig.</p>
                                    ) : msg.feedbackRequest.response ? (
                                      <div className="crr-feedback-answered">
                                        <CheckCircle size={14} aria-hidden="true" />
                                        <span>Ihre Antwort: <strong>{msg.feedbackRequest.response.label}</strong></span>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : msg.messageType === 'quick_action' && msg.quickAction ? (
                                  <div className="crr-quick-action">
                                    <p className="crr-quick-action-badge">Aktion erforderlich</p>
                                    <p className="crr-quick-action-label">{msg.quickAction.actionLabel}</p>
                                    {msg.quickAction.description && <p className="crr-quick-action-desc">{msg.quickAction.description}</p>}
                                    {msg.quickAction.status === 'pending' ? (
                                      <button type="button" className="crr-quick-action-btn" disabled={completingAction === msg._id} onClick={() => handleCompleteAction(msg._id)}>
                                        {completingAction === msg._id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                                        Als erledigt markieren
                                      </button>
                                    ) : (
                                      <p className="crr-quick-action-done">Erledigt</p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="crr-comm-text">{msg.content}</p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {selectedRequest.status !== 'converted' && (
                        <div className="crr-comm-composer">
                          <label htmlFor="crr-composer" className="mb-1 block text-xs font-semibold text-slate-700">Nachricht an das Reparaturteam</label>
                          <textarea
                            id="crr-composer"
                            rows={3}
                            placeholder="Ihre Nachricht …"
                            value={commMessage}
                            onChange={(e) => setCommMessage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleCommSend()
                              }
                            }}
                          />
                          <div className="crr-comm-composer-footer">
                            <span className="mr-auto text-[11px] text-slate-500">Enter = senden, Umschalt+Enter = neue Zeile</span>
                            <button type="button" className="crr-comm-send-btn" onClick={handleCommSend} disabled={commSending || !commMessage.trim()}>
                              {commSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                              Nachricht senden
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-shrink-0 justify-end border-t border-slate-200 bg-white px-5 py-3">
              <button type="button" className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={closeDetailsDialog}>
                Schließen
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
