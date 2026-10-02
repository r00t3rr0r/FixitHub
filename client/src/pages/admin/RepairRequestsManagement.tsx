import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import "./RepairRequestsManagement.css"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/useToast"
import {
  getRepairRequests,
  getRepairRequestById,
  getRepairRequestStatistics,
  updateRepairRequestStatus,
  updateRepairRequestPriority,
  assignStaffToRepairRequest,
  addAdminNote,
  convertRepairRequestToOrder,
  deleteRepairRequest,
  saveRepairRequestQuoteDraft,
  sendRepairRequestQuote,
  updateRepairRequestDevice,
  RepairRequest,
  RepairRequestQuote,
  RepairRequestStats,
} from "@/api/repairRequests"
import { getStaffMembers, StaffMember } from "@/api/staff"
import { getRepairServices, RepairService } from "@/api/services"
import { CommunicationPanel } from "@/components/inspection/CommunicationPanel"
import { ContactMessagesPanel } from "@/components/admin/ContactMessagesPanel"
import { CatalogDevicePicker, PickedCatalogDevice } from "@/components/repair-request/CatalogDevicePicker"
import {
  formatDateDe,
  formatDeviceLabel,
  formatMoney,
  QUOTE_STATUS_LABELS,
  statusLabel,
} from "@/components/repair-request/repairRequestFormat"
import { parseDecimalInput } from "@/lib/parseDecimalInput"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Filter,
  Loader2,
  Lock,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  Truck,
  UserPlus,
  X,
} from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"

type RepairRequestsManagementView = "repair-requests" | "contact-messages"

interface RepairRequestsManagementProps {
  view?: RepairRequestsManagementView
}

const PAGE_SIZE = 25
const PRIORITY_LABELS: Record<string, string> = { low: "Niedrig", medium: "Mittel", high: "Hoch", urgent: "Dringend" }

const staffName = (member: StaffMember | any) =>
  `${member?.firstName || ""} ${member?.lastName || ""}`.trim() || member?.name || member?.email || "Mitarbeiter"

const statusChipClass = (status: string) => {
  switch (status) {
    case "pending": return "bg-amber-100 text-amber-900 ring-amber-200"
    case "reviewing": return "bg-sky-100 text-sky-900 ring-sky-200"
    case "approved": return "bg-emerald-100 text-emerald-900 ring-emerald-200"
    case "rejected": return "bg-red-100 text-red-800 ring-red-200"
    case "converted": return "bg-purple-100 text-purple-900 ring-purple-200"
    default: return "bg-slate-100 text-slate-700 ring-slate-200"
  }
}

const quoteChipClass = (status?: string) => {
  switch (status) {
    case "draft": return "bg-slate-100 text-slate-700 ring-slate-300"
    case "sent": return "bg-amber-100 text-amber-900 ring-amber-200"
    case "accepted": return "bg-emerald-100 text-emerald-900 ring-emerald-200"
    case "declined": return "bg-red-100 text-red-800 ring-red-200"
    default: return "bg-white text-slate-500 ring-slate-200"
  }
}

const QUOTE_SHORT: Record<string, string> = { draft: "Entwurf", sent: "Gesendet", accepted: "Angenommen", declined: "Abgelehnt" }

const chip = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1"

const effectiveQuoteOf = (request: RepairRequest | null): RepairRequestQuote | null =>
  (request?.effectiveQuote as RepairRequestQuote | null) ?? null

export function RepairRequestsManagement({ view = "repair-requests" }: RepairRequestsManagementProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()

  // ── Liste (serverseitig: Suche, Filter, Seiten; Filter stehen in der URL) ──
  const [requests, setRequests] = useState<RepairRequest[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading")
  const [listError, setListError] = useState("")
  const [loadingMore, setLoadingMore] = useState(false)
  const [statistics, setStatistics] = useState<RepairRequestStats | null>(null)
  const [staff, setStaff] = useState<StaffMember[]>([])

  const searchQuery = searchParams.get("q") || ""
  const statusFilter = searchParams.get("status") || "all"
  const priorityFilter = searchParams.get("priority") || "all"
  const quoteFilter = searchParams.get("quote") || "all"
  const [searchInput, setSearchInput] = useState(searchQuery)

  // ── Details ──
  const [detail, setDetail] = useState<RepairRequest | null>(null)
  const [detailState, setDetailState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [detailError, setDetailError] = useState("")
  const selectedId = searchParams.get("requestId")

  const [quoteAmount, setQuoteAmount] = useState("")
  const [quoteDescription, setQuoteDescription] = useState("")
  const [savingQuote, setSavingQuote] = useState(false)
  const [sendingQuote, setSendingQuote] = useState(false)
  const [confirmSendOpen, setConfirmSendOpen] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState("")
  const [internalNote, setInternalNote] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [busyField, setBusyField] = useState<string | null>(null)
  const [showDevicePicker, setShowDevicePicker] = useState(false)
  const [savingDevice, setSavingDevice] = useState(false)

  // ── Umwandeln / Löschen ──
  const [convertTarget, setConvertTarget] = useState<RepairRequest | null>(null)
  const [services, setServices] = useState<RepairService[]>([])
  const [servicesState, setServicesState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [serviceSearch, setServiceSearch] = useState("")
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [shippingMode, setShippingMode] = useState<"none" | "inbound_label">("none")
  const [confirmDifference, setConfirmDifference] = useState(false)
  const [converting, setConverting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RepairRequest | null>(null)
  const [deleting, setDeleting] = useState(false)

  const quoteSectionRef = useRef<HTMLDivElement>(null)
  const quoteAmountRef = useRef<HTMLInputElement>(null)
  const assignRef = useRef<HTMLSelectElement>(null)
  const commRef = useRef<HTMLDivElement>(null)

  const updateParams = useCallback((patch: Record<string, string | null>) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === "" || value === "all") next.delete(key)
        else next.set(key, value)
      })
      return next
    }, { replace: true })
  }, [setSearchParams])

  const fetchList = useCallback(async (targetPage = 1, append = false) => {
    if (append) setLoadingMore(true)
    else { setListState("loading"); setListError("") }
    try {
      const response: any = await getRepairRequests({
        page: targetPage,
        limit: PAGE_SIZE,
        search: searchQuery || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        priority: priorityFilter !== "all" ? priorityFilter : undefined,
        quoteStatus: quoteFilter !== "all" ? quoteFilter : undefined,
      })
      const items: RepairRequest[] = response?.requests || []
      setRequests((prev) => (append ? [...prev, ...items.filter((i) => !prev.some((p) => p._id === i._id))] : items))
      setTotal(response?.pagination?.total ?? items.length)
      setPage(targetPage)
      setListState("ready")
    } catch (error: any) {
      if (append) toast({ title: "Fehler", description: error?.message || "Weitere Anfragen konnten nicht geladen werden.", variant: "destructive" })
      else { setListState("error"); setListError(error?.message || "") }
    } finally {
      setLoadingMore(false)
    }
  }, [searchQuery, statusFilter, priorityFilter, quoteFilter, toast])

  const fetchStats = useCallback(async () => {
    try {
      const response: any = await getRepairRequestStatistics()
      setStatistics(response?.statistics || null)
    } catch {
      setStatistics(null)
    }
  }, [])

  useEffect(() => {
    if (view !== "repair-requests") return
    fetchList(1, false)
  }, [view, fetchList])

  useEffect(() => {
    if (view !== "repair-requests") return
    fetchStats()
    getStaffMembers({}).then((res: any) => setStaff(res?.staff || [])).catch(() => setStaff([]))
  }, [view, fetchStats])

  // Suche entprellt in die URL übernehmen
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput.trim() !== searchQuery) updateParams({ q: searchInput.trim() || null })
    }, 350)
    return () => clearTimeout(handle)
  }, [searchInput, searchQuery, updateParams])

  // Details laden (Deep-Link ?requestId= oder "Öffnen")
  const loadDetail = useCallback(async (id: string) => {
    setDetailState("loading")
    setDetailError("")
    try {
      const response: any = await getRepairRequestById(id)
      const request: RepairRequest = response?.request
      setDetail(request)
      const quote = effectiveQuoteOf(request)
      setQuoteAmount(quote ? String(quote.amount ?? 0).replace(".", ",") : "")
      setQuoteDescription(quote?.description || "")
      setSelectedStaffId((request?.assignedStaffId as any)?._id || "")
      setShowDevicePicker(false)
      setDetailState("ready")
    } catch (error: any) {
      setDetailState("error")
      setDetailError(error?.message || "")
    }
  }, [])

  useEffect(() => {
    if (view !== "repair-requests") return
    if (selectedId) loadDetail(selectedId)
    else { setDetail(null); setDetailState("idle") }
  }, [selectedId, view, loadDetail])

  const openDetail = (request: RepairRequest, focus?: "communication" | "quote" | "assign") => {
    updateParams({ requestId: request._id })
    if (focus) {
      setTimeout(() => {
        const target = focus === "communication" ? commRef.current : focus === "quote" ? quoteSectionRef.current : assignRef.current
        target?.scrollIntoView({ behavior: "smooth", block: "start" })
        if (focus === "quote") quoteAmountRef.current?.focus()
        if (focus === "assign") assignRef.current?.focus()
      }, 450)
    }
  }

  const closeDetail = () => {
    updateParams({ requestId: null })
    fetchList(1, false)
    fetchStats()
  }

  const applyUpdatedRequest = (updated: RepairRequest | undefined) => {
    if (!updated) return
    setDetail((prev) => (prev && prev._id === updated._id ? { ...prev, ...updated } : prev))
    setRequests((prev) => prev.map((r) => (r._id === updated._id ? { ...r, ...updated, communicationSummary: r.communicationSummary } : r)))
  }

  // ── Aktionen im Detail ──
  // Gemeinsame Dezimalregel: "49,90" und "49.90" => 49,9; "1.234,50" => 1234,5.
  const parseAmount = (): number | null => {
    const value = parseDecimalInput(quoteAmount)
    return value !== null && value >= 0 ? Math.round(value * 100) / 100 : null
  }

  const handleSaveDraft = async () => {
    if (!detail) return
    const amount = parseAmount()
    if (amount === null) {
      toast({ title: "Betrag fehlt", description: "Bitte einen Betrag ab 0,00 € eingeben.", variant: "destructive" })
      return
    }
    try {
      setSavingQuote(true)
      const response: any = await saveRepairRequestQuoteDraft(detail._id, { amount, description: quoteDescription })
      applyUpdatedRequest(response?.request)
      toast({ title: "Entwurf gespeichert", description: "Der Kunde sieht den Entwurf noch nicht." })
    } catch (error: any) {
      toast({ title: "Fehler beim Speichern", description: error?.message, variant: "destructive" })
    } finally {
      setSavingQuote(false)
    }
  }

  const handleSendQuote = async () => {
    if (!detail || sendingQuote) return
    const amount = parseAmount()
    if (amount === null) {
      toast({ title: "Betrag fehlt", description: "Bitte einen Betrag ab 0,00 € eingeben.", variant: "destructive" })
      return
    }
    try {
      setSendingQuote(true)
      const result = await sendRepairRequestQuote(detail._id, { amount, description: quoteDescription })
      applyUpdatedRequest(result.request)
      if (result.alreadySent) {
        toast({ title: "Bereits gesendet", description: result.message })
      } else if (result.email?.status === "failed") {
        toast({ title: "Kostenvoranschlag veröffentlicht – E-Mail fehlgeschlagen", description: result.email.error || "Der Kunde sieht ihn im Kundenkonto bzw. über den Tracking-Link.", variant: "destructive" })
      } else {
        toast({ title: "Kostenvoranschlag gesendet", description: "Die E-Mail wurde vom Mailserver angenommen." })
      }
    } catch (error: any) {
      toast({ title: "Nicht gesendet", description: error?.message, variant: "destructive" })
    } finally {
      setSendingQuote(false)
      setConfirmSendOpen(false)
    }
  }

  const handleStatusChange = async (status: string) => {
    if (!detail || status === detail.status) return
    try {
      setBusyField("status")
      const response: any = await updateRepairRequestStatus(detail._id, status)
      applyUpdatedRequest(response?.request)
      toast({ title: "Gespeichert", description: `Status: ${statusLabel(status)}` })
    } catch (error: any) {
      toast({ title: "Fehler beim Speichern", description: error?.message, variant: "destructive" })
    } finally {
      setBusyField(null)
    }
  }

  const handlePriorityChange = async (priority: string) => {
    if (!detail || priority === detail.priority) return
    try {
      setBusyField("priority")
      const response: any = await updateRepairRequestPriority(detail._id, priority)
      applyUpdatedRequest(response?.request)
      toast({ title: "Gespeichert", description: `Priorität: ${PRIORITY_LABELS[priority]}` })
    } catch (error: any) {
      toast({ title: "Fehler beim Speichern", description: error?.message, variant: "destructive" })
    } finally {
      setBusyField(null)
    }
  }

  const handleAssign = async () => {
    if (!detail || !selectedStaffId) return
    try {
      setBusyField("assign")
      const response: any = await assignStaffToRepairRequest(detail._id, selectedStaffId)
      applyUpdatedRequest(response?.request)
      toast({ title: "Gespeichert", description: "Mitarbeiter zugewiesen." })
    } catch (error: any) {
      toast({ title: "Fehler beim Speichern", description: error?.message, variant: "destructive" })
    } finally {
      setBusyField(null)
    }
  }

  const handleAddNote = async () => {
    if (!detail || !internalNote.trim() || savingNote) return
    try {
      setSavingNote(true)
      const response: any = await addAdminNote(detail._id, internalNote.trim())
      applyUpdatedRequest(response?.request)
      setInternalNote("")
      toast({ title: "Interne Notiz gespeichert", description: "Nur für das Team sichtbar. Der Kunde wird nicht benachrichtigt." })
    } catch (error: any) {
      toast({ title: "Fehler beim Speichern", description: error?.message, variant: "destructive" })
    } finally {
      setSavingNote(false)
    }
  }

  const handleDeviceSelect = async (device: PickedCatalogDevice) => {
    if (!detail) return
    try {
      setSavingDevice(true)
      const response: any = await updateRepairRequestDevice(detail._id, { deviceModelId: device._id })
      applyUpdatedRequest(response?.request)
      setShowDevicePicker(false)
      toast({ title: response?.changed ? "Gerät zugeordnet" : "Keine Änderung", description: `${device.manufacturer} ${device.name} (Katalog)` })
    } catch (error: any) {
      toast({ title: "Fehler beim Zuordnen", description: error?.message, variant: "destructive" })
    } finally {
      setSavingDevice(false)
    }
  }

  // ── Umwandeln ──
  const openConvert = async (request: RepairRequest) => {
    setConvertTarget(request)
    setSelectedServices([])
    setServiceSearch("")
    setShippingMode("none")
    setConfirmDifference(false)
    setServicesState("loading")
    try {
      const isCatalog = request.deviceSource === "catalog"
      const response: any = await getRepairServices({
        deviceType: request.deviceType || undefined,
        ...(isCatalog ? { manufacturerPrecise: request.deviceBrand, modelPrecise: request.deviceModel } : {}),
        limit: 100,
        sortBy: "name",
        sortOrder: "asc",
      })
      setServices(response?.services || [])
      setServicesState("ready")
    } catch {
      setServicesState("error")
    }
  }

  const visibleServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase()
    if (!q) return services
    return services.filter((s) => `${s.name} ${s.description || ""}`.toLowerCase().includes(q))
  }, [services, serviceSearch])

  const selectedServicesTotal = services
    .filter((s) => selectedServices.includes(s._id))
    .reduce((sum, s) => sum + Number(s.price || 0), 0)
  const convertQuote = effectiveQuoteOf(convertTarget)
  const quoteDifference = convertQuote ? Math.round((selectedServicesTotal - Number(convertQuote.amount || 0)) * 100) / 100 : 0
  const needsDifferenceConfirm = Boolean(convertQuote && convertQuote.status === "accepted" && selectedServices.length > 0 && quoteDifference !== 0)

  const handleConvert = async () => {
    if (!convertTarget || converting) return
    if (selectedServices.length === 0) {
      toast({ title: "Leistung fehlt", description: "Bitte mindestens eine Reparaturleistung auswählen.", variant: "destructive" })
      return
    }
    if (needsDifferenceConfirm && !confirmDifference) {
      toast({ title: "Bitte bestätigen", description: "Der Auftragswert weicht vom angenommenen Kostenvoranschlag ab.", variant: "destructive" })
      return
    }
    try {
      setConverting(true)
      const response: any = await convertRepairRequestToOrder(convertTarget._id, { services: selectedServices, shippingMode })
      toast({ title: "Auftrag angelegt", description: response?.message || "Die Anfrage wurde umgewandelt." })
      setConvertTarget(null)
      if (response?.order?._id) navigate(`/orders/${response.order._id}`)
      else fetchList(1, false)
    } catch (error: any) {
      toast({ title: "Umwandlung fehlgeschlagen", description: error?.message, variant: "destructive" })
    } finally {
      setConverting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await deleteRepairRequest(deleteTarget._id)
      setRequests((prev) => prev.filter((r) => r._id !== deleteTarget._id))
      setTotal((t) => Math.max(0, t - 1))
      if (detail?._id === deleteTarget._id) updateParams({ requestId: null })
      toast({ title: "Gelöscht", description: `Anfrage ${deleteTarget.requestNumber} wurde gelöscht.` })
      setDeleteTarget(null)
      fetchStats()
    } catch (error: any) {
      toast({ title: "Fehler beim Löschen", description: error?.message, variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  // ── Darstellung ──
  const renderQuoteCell = (request: RepairRequest) => {
    const quote = effectiveQuoteOf(request)
    if (!quote) return <span className="text-xs text-slate-500">Noch keiner</span>
    return (
      <div className="space-y-0.5">
        <span className={`${chip} ${quoteChipClass(quote.status)}`}>{quote.legacy && !request.quote ? "Altbestand" : QUOTE_SHORT[quote.status]}</span>
        <div className="text-sm font-semibold text-slate-900">{formatMoney(quote.amount)}</div>
      </div>
    )
  }

  const renderRowBadges = (request: RepairRequest) => {
    const summary = request.communicationSummary
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {summary?.awaitingReply && <span className={`${chip} bg-orange-100 text-orange-900 ring-orange-200`}><MessageSquare className="h-3 w-3" aria-hidden="true" /> Antwort ausstehend</span>}
        {(summary?.unreadCount || 0) > 0 && <span className={`${chip} bg-red-600 text-white ring-red-600`}>{summary!.unreadCount} ungelesen</span>}
        {effectiveQuoteOf(request)?.status === "accepted" && request.status !== "converted" && (
          <span className={`${chip} bg-emerald-100 text-emerald-900 ring-emerald-200`}><CheckCircle className="h-3 w-3" aria-hidden="true" /> Bereit zur Umwandlung</span>
        )}
      </div>
    )
  }

  const renderRowMenu = (request: RepairRequest) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9" aria-label={`Weitere Aktionen für ${request.requestNumber}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openDetail(request, "communication")}>
          <MessageSquare className="mr-2 h-4 w-4" /> Gespräch öffnen
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openDetail(request, "quote")}>
          <Send className="mr-2 h-4 w-4" /> Kostenvoranschlag bearbeiten
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openDetail(request, "assign")}>
          <UserPlus className="mr-2 h-4 w-4" /> Mitarbeiter zuweisen
        </DropdownMenuItem>
        {request.status !== "converted" && (
          <DropdownMenuItem onClick={() => openConvert(request)}>
            <ShoppingCart className="mr-2 h-4 w-4" /> In Auftrag umwandeln
          </DropdownMenuItem>
        )}
        {request.status !== "converted" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDeleteTarget(request)} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" /> Löschen
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  if (view === "contact-messages") {
    return (
      <div className="repair-requests-management">
        <ContactMessagesPanel />
      </div>
    )
  }

  const filtersActive = Boolean(searchQuery) || statusFilter !== "all" || priorityFilter !== "all" || quoteFilter !== "all"
  const detailQuote = effectiveQuoteOf(detail)
  const reported = detail?.reportedDevice
  const isConverted = detail?.status === "converted"
  const deviceUnmatched = detail?.deviceSource === "manual"
  const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-[#1a2a5e] focus:outline-none focus:ring-2 focus:ring-[#1a2a5e]/20 disabled:bg-slate-50"

  return (
    <div className="repair-requests-management">
      <div className="mt-4 space-y-4">
        <div className="repair-requests-header">
          <h1><FileText className="h-6 w-6" /> Reparaturanfragen</h1>
          <p>Anfragen prüfen, Kostenvoranschläge senden und in Reparaturaufträge umwandeln</p>
        </div>

        {statistics && (
          <div className="stats-grid">
            <div className="stat-card stat-total"><div className="stat-card-header"><div className="stat-card-title">Gesamt</div><div className="stat-card-icon"><FileText className="h-5 w-5" /></div></div><div className="stat-card-value">{statistics.total}</div></div>
            <div className="stat-card stat-pending"><div className="stat-card-header"><div className="stat-card-title">Ausstehend</div><div className="stat-card-icon"><Clock className="h-5 w-5" /></div></div><div className="stat-card-value">{statistics.byStatus.pending}</div></div>
            <div className="stat-card stat-reviewing"><div className="stat-card-header"><div className="stat-card-title">In Prüfung</div><div className="stat-card-icon"><Eye className="h-5 w-5" /></div></div><div className="stat-card-value">{statistics.byStatus.reviewing}</div></div>
            <div className="stat-card stat-converted"><div className="stat-card-header"><div className="stat-card-title">Kostenvoranschlag angenommen</div><div className="stat-card-icon"><CheckCircle className="h-5 w-5" /></div></div><div className="stat-card-value">{statistics.byStatus.approved}</div></div>
            <div className="stat-card stat-priority"><div className="stat-card-header"><div className="stat-card-title">Hohe Priorität</div><div className="stat-card-icon"><AlertTriangle className="h-5 w-5" /></div></div><div className="stat-card-value">{statistics.highPriority}</div></div>
          </div>
        )}

        {/* Filter (in der URL) */}
        <div className="filter-card">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Suche nach Anfragenummer, Kunde, E-Mail oder Gerät …"
                aria-label="Reparaturanfragen durchsuchen"
                className="h-10 pl-9"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
              <select aria-label="Status filtern" className={`${selectClass} lg:w-44`} value={statusFilter} onChange={(e) => updateParams({ status: e.target.value })}>
                <option value="all">Alle Status</option>
                <option value="pending">Ausstehend</option>
                <option value="reviewing">In Prüfung</option>
                <option value="approved">Kostenvoranschlag angenommen</option>
                <option value="rejected">Abgelehnt</option>
                <option value="converted">In Auftrag umgewandelt</option>
              </select>
              <select aria-label="Kostenvoranschlag filtern" className={`${selectClass} lg:w-48`} value={quoteFilter} onChange={(e) => updateParams({ quote: e.target.value })}>
                <option value="all">Alle Kostenvoranschläge</option>
                <option value="none">Noch keiner</option>
                <option value="draft">Entwurf</option>
                <option value="sent">Gesendet (Antwort ausstehend)</option>
                <option value="accepted">Angenommen</option>
                <option value="declined">Abgelehnt</option>
              </select>
              <select aria-label="Priorität filtern" className={`${selectClass} lg:w-40`} value={priorityFilter} onChange={(e) => updateParams({ priority: e.target.value })}>
                <option value="all">Alle Prioritäten</option>
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
                <option value="urgent">Dringend</option>
              </select>
            </div>
          </div>
        </div>

        {/* Liste */}
        <div className="requests-table-card">
          <div className="requests-table-header">
            <h2 className="requests-table-title"><Filter className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> Reparaturanfragen{listState === "ready" ? ` (${total})` : ""}</h2>
            <p className="requests-table-description">„Öffnen“ zeigt Details, Kostenvoranschlag und Kommunikation.</p>
          </div>

          {listState === "loading" ? (
            <div className="flex items-center justify-center gap-2 py-14 text-slate-600"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Wird geladen …</div>
          ) : listState === "error" ? (
            <div className="py-12 text-center">
              <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" aria-hidden="true" />
              <p className="font-semibold text-slate-800">Reparaturanfragen konnten nicht geladen werden.</p>
              {listError && <p className="text-sm text-slate-500">{listError}</p>}
              <Button variant="outline" className="mt-3" onClick={() => fetchList(1, false)}><RefreshCw className="mr-2 h-4 w-4" /> Erneut versuchen</Button>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto mb-2 h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="font-semibold text-slate-700">{filtersActive ? "Keine Anfragen für diesen Filter." : "Noch keine Reparaturanfragen."}</p>
              {filtersActive && (
                <Button variant="outline" className="mt-3" onClick={() => { setSearchInput(""); updateParams({ q: null, status: null, priority: null, quote: null }) }}>
                  Filter zurücksetzen
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Tabelle ab md – passt ohne horizontales Scrollen auf 1366 px */}
              <table className="hidden w-full table-fixed border-collapse text-sm md:table">
                <thead className="border-b-2 border-slate-100 bg-white text-left text-[11px] uppercase tracking-wide text-[#1a2a5e]">
                  <tr>
                    <th className="w-[19%] px-3 py-2">Anfrage</th>
                    <th className="w-[20%] px-3 py-2">Kunde</th>
                    <th className="w-[20%] px-3 py-2">Gerät</th>
                    <th className="w-[15%] px-3 py-2">Status</th>
                    <th className="w-[13%] px-3 py-2">Kostenvoranschlag</th>
                    <th className="w-[13%] px-3 py-2 text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request._id} className={`border-b border-slate-100 align-top hover:bg-slate-50 ${selectedId === request._id ? "bg-blue-50/60" : ""}`}>
                      <td className="px-3 py-2.5">
                        <div className="truncate font-semibold text-slate-900">{request.requestNumber}</div>
                        <div className="text-xs text-slate-500">{formatDateDe(request.createdAt)}</div>
                        {renderRowBadges(request)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium text-slate-900">{request.customerName}</span>
                          {request.isGuest && <span className={`${chip} bg-slate-100 text-slate-700 ring-slate-300`}>Gast</span>}
                        </div>
                        <div className="truncate text-xs text-slate-500">{request.customerEmail}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="truncate font-medium text-slate-900">{request.deviceLabel || formatDeviceLabel(request.deviceBrand, request.deviceModel)}</div>
                        <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                          <span>{request.deviceType}</span>
                          {request.deviceSource === "manual" && <span className={`${chip} bg-amber-50 text-amber-900 ring-amber-200`}>manuell</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`${chip} ${statusChipClass(request.status)}`}>{request.statusLabel || statusLabel(request.status)}</span>
                        <div className="mt-1 text-xs text-slate-500">Priorität: {PRIORITY_LABELS[request.priority || "medium"]}</div>
                        <div className="truncate text-xs text-slate-500">{request.assignedStaffName ? `Zuständig: ${request.assignedStaffName}` : "Nicht zugewiesen"}</div>
                      </td>
                      <td className="px-3 py-2.5">{renderQuoteCell(request)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" className="h-9 bg-[#1a2a5e] text-white hover:bg-[#0f1d45]" onClick={() => openDetail(request)}>
                            <Eye className="mr-1.5 h-4 w-4" aria-hidden="true" /> Öffnen
                          </Button>
                          {renderRowMenu(request)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Karten auf schmalen Bildschirmen */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {requests.map((request) => (
                  <li key={request._id} className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{request.requestNumber}</div>
                        <div className="text-xs text-slate-500">{formatDateDe(request.createdAt)} · {request.customerName}{request.isGuest ? " (Gast)" : ""}</div>
                      </div>
                      <span className={`${chip} ${statusChipClass(request.status)}`}>{request.statusLabel || statusLabel(request.status)}</span>
                    </div>
                    <div className="text-sm text-slate-800">
                      {request.deviceLabel || formatDeviceLabel(request.deviceBrand, request.deviceModel)}
                      {request.deviceSource === "manual" && <span className={`${chip} ml-1 bg-amber-50 text-amber-900 ring-amber-200`}>manuell</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {renderQuoteCell(request)}
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" className="h-9 bg-[#1a2a5e] text-white" onClick={() => openDetail(request)}><Eye className="mr-1.5 h-4 w-4" /> Öffnen</Button>
                        {renderRowMenu(request)}
                      </div>
                    </div>
                    {renderRowBadges(request)}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-3 text-sm text-slate-600">
                <span>{requests.length} von {total} angezeigt</span>
                {requests.length < total && (
                  <Button variant="outline" onClick={() => fetchList(page + 1, true)} disabled={loadingMore}>
                    {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Weitere laden
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {/* ─────────── Details ─────────── */}
        <Dialog open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) closeDetail() }}>
          <DialogContent className="flex max-h-[94vh] w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 [&>button]:hidden">
            <DialogHeader className="flex-shrink-0 space-y-2 bg-[#1a2a5e] px-4 py-3 text-white sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="text-base font-semibold" style={{ color: "#f5b800" }}>
                    Reparaturanfrage {detail?.requestNumber || ""}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-white/85">
                    {detail ? `${detail.customerName}${detail.isGuest ? " (Gast)" : ""} · ${detail.deviceLabel || formatDeviceLabel(detail.deviceBrand, detail.deviceModel)}` : "Details"}
                  </DialogDescription>
                </div>
                <DialogClose asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-[#f5b800] hover:bg-white/10" aria-label="Details schließen">
                    <X className="h-4 w-4" />
                  </Button>
                </DialogClose>
              </div>
              {detail && detailState === "ready" && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" className="h-9" disabled={isConverted} onClick={() => { quoteSectionRef.current?.scrollIntoView({ behavior: "smooth" }); quoteAmountRef.current?.focus() }}>
                    <Send className="mr-1.5 h-4 w-4" /> Kostenvoranschlag senden
                  </Button>
                  <Button size="sm" className="h-9 bg-[#f5b800] text-[#1a2a5e] hover:bg-[#e5ab00]" disabled={isConverted} onClick={() => openConvert(detail)}>
                    <ShoppingCart className="mr-1.5 h-4 w-4" /> In Auftrag umwandeln
                  </Button>
                  <Button size="sm" variant="secondary" className="h-9" onClick={() => { assignRef.current?.scrollIntoView({ behavior: "smooth" }); assignRef.current?.focus() }}>
                    <UserPlus className="mr-1.5 h-4 w-4" /> Mitarbeiter zuweisen
                  </Button>
                </div>
              )}
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
              {detailState === "loading" || (detailState === "idle" && selectedId) ? (
                <div className="flex items-center justify-center gap-2 py-16 text-slate-600"><Loader2 className="h-5 w-5 animate-spin" /> Wird geladen …</div>
              ) : detailState === "error" ? (
                <div className="py-14 text-center">
                  <p className="font-semibold text-slate-800">Die Anfrage konnte nicht geladen werden.</p>
                  {detailError && <p className="text-sm text-slate-500">{detailError}</p>}
                  {selectedId && <Button variant="outline" className="mt-3" onClick={() => loadDetail(selectedId)}><RefreshCw className="mr-2 h-4 w-4" /> Erneut versuchen</Button>}
                </div>
              ) : detail ? (
                <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                  {/* Linke Spalte */}
                  <div className="space-y-4">
                    {isConverted && (
                      <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900">
                        <p className="font-semibold">In Auftrag {detail.convertedToOrderId?.orderNumber || ""} umgewandelt{detail.convertedAt ? ` am ${formatDateDe(detail.convertedAt)}` : ""}.</p>
                        {detail.convertedToOrderId?._id && (
                          <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate(`/orders/${detail.convertedToOrderId!._id}`)}>Auftrag öffnen</Button>
                        )}
                      </div>
                    )}

                    <section className="rounded-lg border bg-white p-4">
                      <h3 className="mb-2 text-sm font-bold text-[#1a2a5e]">Kunde</h3>
                      <div className="grid gap-1 text-sm sm:grid-cols-2">
                        <p><span className="text-slate-500">Name:</span> {detail.customerName} {detail.isGuest && <span className={`${chip} ml-1 bg-slate-100 text-slate-700 ring-slate-300`}>Gast</span>}</p>
                        <p className="break-all"><span className="text-slate-500">E-Mail:</span> {detail.customerEmail}</p>
                        <p><span className="text-slate-500">Telefon:</span> {detail.customerPhone || "Nicht angegeben"}</p>
                        <p><span className="text-slate-500">Eingegangen:</span> {formatDateDe(detail.createdAt, true)}</p>
                      </div>
                    </section>

                    <section className="rounded-lg border bg-white p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#1a2a5e]">Gerät</h3>
                        {deviceUnmatched && !isConverted && <span className={`${chip} bg-amber-50 text-amber-900 ring-amber-200`}>Manuell angegeben – noch nicht zugeordnet</span>}
                      </div>
                      <dl className="grid gap-1.5 text-sm">
                        <div className="flex flex-wrap gap-1"><dt className="text-slate-500">Kundenangabe:</dt><dd className="font-medium">{formatDeviceLabel(reported?.brand, reported?.model) || "–"} ({reported?.source === "catalog" ? "Katalog" : "manuell"}){reported?.modelNumber ? ` · Modellnr. ${reported.modelNumber}` : ""}</dd></div>
                        <div className="flex flex-wrap gap-1"><dt className="text-slate-500">Zugeordnet:</dt><dd className="font-medium">{detail.deviceSource === "catalog" ? `${formatDeviceLabel(detail.deviceBrand, detail.deviceModel)} – Katalog` : "–"}</dd></div>
                        <div className="flex flex-wrap gap-1"><dt className="text-slate-500">Gerätetyp:</dt><dd>{detail.deviceType || "–"}</dd></div>
                      </dl>
                      {isConverted ? (
                        <p className="mt-2 text-xs text-slate-500">Nach der Umwandlung bitte das Gerät im Auftrag korrigieren.</p>
                      ) : showDevicePicker ? (
                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold">Katalogmodell wählen</p>
                            <Button size="sm" variant="ghost" onClick={() => setShowDevicePicker(false)}>Abbrechen</Button>
                          </div>
                          <CatalogDevicePicker compact onSelect={handleDeviceSelect} disabled={savingDevice} selectedModelId={typeof detail.deviceModelId === "object" ? detail.deviceModelId?._id : (detail.deviceModelId as string | undefined)} />
                          {savingDevice && <p className="mt-2 flex items-center gap-2 text-xs text-slate-600"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Wird gespeichert …</p>}
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowDevicePicker(true)}>
                          {detail.deviceSource === "catalog" ? "Zuordnung ändern" : "Katalogmodell zuordnen"}
                        </Button>
                      )}
                    </section>

                    <section className="rounded-lg border bg-white p-4 text-sm">
                      <h3 className="mb-2 text-sm font-bold text-[#1a2a5e]">Problem</h3>
                      <p className="whitespace-pre-wrap">{detail.issueDescription}</p>
                      <div className="mt-3 grid gap-1 sm:grid-cols-2">
                        {detail.issueOccurredDate && <p><span className="text-slate-500">Seit:</span> {detail.issueOccurredDate}</p>}
                        <p><span className="text-slate-500">Flüssigkeitsschaden:</span> {detail.waterDamage === "yes" ? "Ja" : detail.waterDamage === "unsure" ? "Nicht sicher" : "Nein"}</p>
                        <p><span className="text-slate-500">Gerätezustand:</span> {detail.itemCondition === "original" ? "Original" : detail.itemCondition === "refurbished" ? "Gebraucht/aufbereitet" : "Nicht sicher"}</p>
                        {detail.previousRepairDetails && <p className="sm:col-span-2"><span className="text-slate-500">Frühere Reparaturversuche:</span> {detail.previousRepairDetails}</p>}
                      </div>
                      {detail.images && detail.images.length > 0 && (
                        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                          {detail.images.map((img, idx) => (
                            <a key={idx} href={img} target="_blank" rel="noreferrer" className="block">
                              <img src={img} alt={`Gerätefoto ${idx + 1}`} className="h-20 w-full rounded border object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                    </section>

                    {/* Kostenvoranschlag */}
                    <section ref={quoteSectionRef} className="scroll-mt-4 rounded-lg border-2 border-[#1a2a5e]/20 bg-white p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#1a2a5e]">Kostenvoranschlag</h3>
                        {detailQuote ? (
                          <span className={`${chip} ${quoteChipClass(detailQuote.status)}`}>{detailQuote.legacy && !detail.quote ? "Altbestand (vom Kunden bereits gesehen)" : QUOTE_STATUS_LABELS[detailQuote.status]}</span>
                        ) : (
                          <span className={`${chip} bg-white text-slate-500 ring-slate-200`}>Noch keiner</span>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                        <div className="space-y-1">
                          <Label htmlFor="rr-quote-amount" className="text-xs">Betrag (brutto, EUR)</Label>
                          <Input id="rr-quote-amount" ref={quoteAmountRef} inputMode="decimal" placeholder="z. B. 89,00" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} disabled={isConverted || detailQuote?.status === "accepted"} />
                          <p className="text-[11px] text-slate-500">0,00 € ist erlaubt (kostenlos).</p>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="rr-quote-desc" className="text-xs">Leistungsbeschreibung für den Kunden</Label>
                          <Textarea id="rr-quote-desc" rows={3} maxLength={2000} placeholder="z. B. Displaytausch inkl. Original-Ersatzteil, 12 Monate Garantie" value={quoteDescription} onChange={(e) => setQuoteDescription(e.target.value)} disabled={isConverted || detailQuote?.status === "accepted"} />
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-slate-600">
                        {detailQuote?.status === "draft" && <p>Entwurf{detailQuote.draftUpdatedAt ? ` gespeichert am ${formatDateDe(detailQuote.draftUpdatedAt, true)}` : ""}{detailQuote.draftUpdatedByName ? ` von ${detailQuote.draftUpdatedByName}` : ""} – der Kunde sieht ihn noch nicht.</p>}
                        {detailQuote?.publishedAt && <p>Gesendet am {formatDateDe(detailQuote.publishedAt, true)}{detailQuote.publishedByName ? ` von ${detailQuote.publishedByName}` : ""}{detailQuote.version ? ` (Version ${detailQuote.version})` : ""}.</p>}
                        {detailQuote?.emailStatus === "accepted" && <p className="text-emerald-700">E-Mail an den Kunden: vom Mailserver angenommen{detailQuote.emailSentAt ? ` (${formatDateDe(detailQuote.emailSentAt, true)})` : ""}.</p>}
                        {detailQuote?.emailStatus === "failed" && <p className="font-semibold text-red-700">E-Mail an den Kunden fehlgeschlagen{detailQuote.emailError ? `: ${detailQuote.emailError}` : ""}. Der Kostenvoranschlag ist trotzdem im Kundenkonto/Tracking-Link sichtbar.</p>}
                        {detailQuote?.status === "accepted" && <p className="font-semibold text-emerald-800">Angenommen am {formatDateDe(detailQuote.respondedAt, true)}{detailQuote.respondedByName ? ` von ${detailQuote.respondedByName}` : ""}{detailQuote.responseChannel === "guest" ? " (Gast-Link)" : ""}.</p>}
                        {detailQuote?.status === "declined" && <p className="font-semibold text-red-700">Abgelehnt am {formatDateDe(detailQuote.respondedAt, true)}{detailQuote.respondedByName ? ` von ${detailQuote.respondedByName}` : ""}. Sie können einen neuen Entwurf senden.</p>}
                      </div>
                      {!isConverted && detailQuote?.status !== "accepted" && (
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <Button variant="outline" onClick={handleSaveDraft} disabled={savingQuote || sendingQuote}>
                            {savingQuote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Entwurf speichern
                          </Button>
                          <Button className="bg-[#1a2a5e] text-white hover:bg-[#0f1d45]" onClick={() => {
                            if (parseAmount() === null) {
                              toast({ title: "Betrag fehlt", description: "Bitte einen Betrag ab 0,00 € eingeben.", variant: "destructive" })
                              return
                            }
                            setConfirmSendOpen(true)
                          }} disabled={savingQuote || sendingQuote || detail.status === "rejected"}>
                            <Send className="mr-2 h-4 w-4" /> Kostenvoranschlag an Kunden senden
                          </Button>
                        </div>
                      )}
                      {detail.status === "rejected" && !isConverted && <p className="mt-2 text-xs text-slate-500">Die Anfrage ist abgelehnt – zum Senden bitte zuerst den Status ändern.</p>}
                    </section>

                    {/* Bearbeitung */}
                    <section className="rounded-lg border bg-white p-4">
                      <h3 className="mb-3 text-sm font-bold text-[#1a2a5e]">Bearbeitung</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="rr-status" className="text-xs">Status</Label>
                          <select id="rr-status" className={selectClass} value={detail.status} disabled={isConverted || busyField === "status"} onChange={(e) => handleStatusChange(e.target.value)}>
                            <option value="pending">Ausstehend</option>
                            <option value="reviewing">In Prüfung</option>
                            {detail.status === "approved" && <option value="approved" disabled>{detail.statusLabel || "Kostenvoranschlag angenommen"}</option>}
                            <option value="rejected">Abgelehnt</option>
                            {isConverted && <option value="converted">In Auftrag umgewandelt</option>}
                          </select>
                          <p className="text-[11px] text-slate-500">„Kostenvoranschlag angenommen“ setzt nur die Antwort des Kunden; „In Auftrag umgewandelt“ nur „In Auftrag umwandeln“.</p>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="rr-priority" className="text-xs">Priorität (intern)</Label>
                          <select id="rr-priority" className={selectClass} value={detail.priority || "medium"} disabled={busyField === "priority"} onChange={(e) => handlePriorityChange(e.target.value)}>
                            <option value="low">Niedrig</option>
                            <option value="medium">Mittel</option>
                            <option value="high">Hoch</option>
                            <option value="urgent">Dringend</option>
                          </select>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label htmlFor="rr-assign" className="text-xs">Zuständiger Mitarbeiter</Label>
                          <div className="flex gap-2">
                            <select id="rr-assign" ref={assignRef} className={selectClass} value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)}>
                              <option value="">Mitarbeiter wählen …</option>
                              {staff.map((member) => <option key={member._id} value={member._id}>{staffName(member)}</option>)}
                            </select>
                            <Button onClick={handleAssign} disabled={!selectedStaffId || busyField === "assign"}>
                              {busyField === "assign" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Zuweisen"}
                            </Button>
                          </div>
                          <p className="text-[11px] text-slate-500">{detail.assignedStaffName ? `Aktuell: ${detail.assignedStaffName}` : "Ohne Zuweisung erhalten alle Admins Kundennachrichten."}</p>
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Rechte Spalte: Kommunikation + Intern */}
                  <div className="space-y-4">
                    <section ref={commRef} className="scroll-mt-4 rounded-lg border-2 border-blue-200 bg-white p-3">
                      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-[#1a2a5e]">
                        <MessageSquare className="h-4 w-4" aria-hidden="true" /> Kommunikation mit dem Kunden
                        <span className={`${chip} bg-blue-50 text-blue-900 ring-blue-200`}>An Kunden</span>
                      </h3>
                      <p className="mb-2 text-xs text-slate-600">Der Kunde sieht diese Nachrichten{detail.isGuest ? " über seinen Tracking-Link und erhält eine E-Mail" : " im Kundenkonto und erhält eine E-Mail"}.</p>
                      <CommunicationPanel orderId={detail._id} entityType="repair-request" hideTitle />
                    </section>

                    <section className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/70 p-4">
                      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-amber-900">
                        <Lock className="h-4 w-4" aria-hidden="true" /> Interne Notizen
                        <span className={`${chip} bg-amber-100 text-amber-900 ring-amber-300`}>Intern – nur für das Team</span>
                      </h3>
                      <p className="mb-2 text-xs text-amber-900/80">Nur für Mitarbeiter sichtbar. Der Kunde wird nicht benachrichtigt.</p>
                      <Textarea rows={2} placeholder="Interne Notiz …" value={internalNote} onChange={(e) => setInternalNote(e.target.value)} className="bg-white" aria-label="Interne Notiz" />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" className="bg-amber-600 text-white hover:bg-amber-700" onClick={handleAddNote} disabled={savingNote || !internalNote.trim()}>
                          {savingNote ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Lock className="mr-1.5 h-3.5 w-3.5" />} Interne Notiz speichern
                        </Button>
                        {internalNote && <Button size="sm" variant="ghost" onClick={() => setInternalNote("")}>Entwurf verwerfen</Button>}
                      </div>
                      {(detail.adminNotes || []).length > 0 ? (
                        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                          {[...(detail.adminNotes || [])].reverse().map((note, idx) => (
                            <li key={note._id || idx} className="rounded-md border border-amber-200 bg-white p-2">
                              <div className="mb-0.5 flex flex-wrap justify-between gap-2 text-[11px] text-slate-500">
                                <span>{note.staffName}</span>
                                <span>{formatDateDe(note.createdAt, true)}</span>
                              </div>
                              <p className="whitespace-pre-wrap text-xs text-slate-800">{note.note}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">Noch keine internen Notizen.</p>
                      )}
                    </section>

                    {(detail.messages || []).length > 0 && (
                      <section className="rounded-lg border bg-white p-4">
                        <h3 className="mb-1 text-sm font-bold text-slate-700">Ältere Nachrichten (Altbestand)</h3>
                        <p className="mb-2 text-xs text-slate-500">Aus dem früheren Nachrichtenspeicher – der Kunde sieht diese nicht im Portal. Neue Nachrichten bitte oben senden.</p>
                        <ul className="space-y-2">
                          {(detail.messages || []).map((msg, idx) => (
                            <li key={msg._id || idx} className="rounded-md border p-2 text-xs">
                              <div className="mb-0.5 flex justify-between gap-2 text-slate-500"><span>{msg.senderName}</span><span>{formatDateDe(msg.sentAt, true)}</span></div>
                              <p className="whitespace-pre-wrap">{msg.message}</p>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        {/* Bestätigung: Kostenvoranschlag senden */}
        <AlertDialog open={confirmSendOpen} onOpenChange={(open) => { if (!sendingQuote) setConfirmSendOpen(open) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Kostenvoranschlag an Kunden senden?</AlertDialogTitle>
              <AlertDialogDescription>
                {detail ? `${formatMoney(parseAmount() ?? 0)} an ${detail.customerEmail}. ` : ""}
                Der Kunde erhält eine Nachricht mit Betrag und Link zur Antwort. Jetzt senden?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={sendingQuote}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); handleSendQuote() }} disabled={sendingQuote} className="bg-[#1a2a5e]">
                {sendingQuote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Jetzt senden
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Umwandeln */}
        <Dialog open={Boolean(convertTarget)} onOpenChange={(open) => { if (!open && !converting) setConvertTarget(null) }}>
          <DialogContent className="flex max-h-[94vh] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="mcrepair-dialog-header flex-shrink-0">
              <DialogTitle className="mcrepair-dialog-title">In Auftrag umwandeln – {convertTarget?.requestNumber}</DialogTitle>
              <DialogDescription className="mcrepair-dialog-description">Leistungen aus dem Katalog wählen. Der Auftragswert wird nach Katalogpreisen und Kundenkonditionen berechnet.</DialogDescription>
            </DialogHeader>
            {convertTarget && (
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                <div className="grid gap-2 rounded-lg border bg-slate-50 p-3 text-sm sm:grid-cols-2">
                  <p><span className="text-slate-500">Gerät im Auftrag:</span> <strong>{formatDeviceLabel(convertTarget.deviceBrand, convertTarget.deviceModel)}</strong></p>
                  <p><span className="text-slate-500">Kundenangabe:</span> {formatDeviceLabel(convertTarget.reportedDevice?.brand, convertTarget.reportedDevice?.model) || "–"}{convertTarget.reportedDevice?.source === "manual" ? " (manuell)" : ""}</p>
                  <p className="sm:col-span-2"><span className="text-slate-500">Kunde:</span> {convertTarget.customerName}{convertTarget.isGuest ? " – bleibt Gast (Tracking per E-Mail)" : ""}</p>
                </div>
                {convertTarget.deviceSource === "manual" && (
                  <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    Gerät noch nicht zugeordnet – es werden alle Leistungen für „{convertTarget.deviceType}“ gezeigt. Für passende Leistungen zuerst im Detail „Katalogmodell zuordnen“.
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="rr-service-search" className="text-sm font-semibold">Passende Reparaturleistungen</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <Input id="rr-service-search" className="pl-9" placeholder="Leistung suchen …" value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} />
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-lg border bg-white">
                    {servicesState === "loading" ? (
                      <p className="flex items-center gap-2 p-3 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Wird geladen …</p>
                    ) : servicesState === "error" ? (
                      <p className="p-3 text-sm text-red-700">Leistungen konnten nicht geladen werden. <button type="button" className="font-semibold underline" onClick={() => openConvert(convertTarget)}>Erneut versuchen</button></p>
                    ) : visibleServices.length === 0 ? (
                      <p className="p-3 text-sm text-slate-600">{services.length === 0 ? "Noch keine passenden Leistungen im Katalog." : `Keine Leistung passt zu „${serviceSearch}“.`}</p>
                    ) : (
                      visibleServices.map((service) => (
                        <label key={service._id} htmlFor={`svc-${service._id}`} className="flex cursor-pointer items-start gap-3 border-b border-slate-100 p-3 last:border-b-0 hover:bg-slate-50">
                          <Checkbox
                            id={`svc-${service._id}`}
                            checked={selectedServices.includes(service._id)}
                            onCheckedChange={(checked) => setSelectedServices((prev) => checked ? [...prev, service._id] : prev.filter((id) => id !== service._id))}
                          />
                          <span className="flex-1">
                            <span className="block text-sm font-medium text-slate-900">{service.name}</span>
                            {service.description && <span className="block text-xs text-slate-500 line-clamp-2">{service.description}</span>}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">{formatMoney(service.price)}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-1 rounded-lg border bg-slate-50 p-3 text-sm">
                  <p className="flex justify-between"><span>Ausgewählte Leistungen</span><strong>{selectedServices.length}</strong></p>
                  <p className="flex justify-between"><span>Summe Listenpreise (vor Kundenkonditionen)</span><strong>{formatMoney(selectedServicesTotal)}</strong></p>
                  {convertQuote && (
                    <>
                      <p className="flex justify-between"><span>Kostenvoranschlag ({QUOTE_SHORT[convertQuote.status]?.toLowerCase() || convertQuote.status})</span><strong>{formatMoney(convertQuote.amount)}</strong></p>
                      {selectedServices.length > 0 && (
                        <p className={`flex justify-between ${quoteDifference !== 0 ? "font-semibold text-amber-800" : "text-emerald-800"}`}>
                          <span>Abweichung</span><span>{quoteDifference > 0 ? "+" : ""}{formatMoney(quoteDifference)}</span>
                        </p>
                      )}
                    </>
                  )}
                </div>
                {needsDifferenceConfirm && (
                  <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <Checkbox checked={confirmDifference} onCheckedChange={(c) => setConfirmDifference(Boolean(c))} />
                    <span>Mir ist bewusst, dass der Auftragswert vom angenommenen Kostenvoranschlag ({formatMoney(convertQuote?.amount)}) abweicht. Ich passe den Auftrag ggf. danach an.</span>
                  </label>
                )}

                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold">Versandart</legend>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border bg-white p-3 text-sm">
                    <input type="radio" name="rr-shipping" className="mt-1" checked={shippingMode === "none"} onChange={() => setShippingMode("none")} />
                    <span><strong>Gerät liegt vor bzw. Abgabe im Laden</strong><span className="block text-xs text-slate-500">Es wird kein DHL-Einsendelabel erstellt.</span></span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border bg-white p-3 text-sm">
                    <input type="radio" name="rr-shipping" className="mt-1" checked={shippingMode === "inbound_label"} onChange={() => setShippingMode("inbound_label")} />
                    <span><strong className="inline-flex items-center gap-1"><Truck className="h-4 w-4" aria-hidden="true" /> Gerät wird eingesendet</strong><span className="block text-xs text-slate-500">DHL-Einsendelabel (Kunde → McRepair) wird für die Buchung erstellt.</span></span>
                  </label>
                </fieldset>
              </div>
            )}
            <DialogFooter className="flex-shrink-0 gap-2 border-t bg-white p-3 sm:p-4">
              <Button variant="outline" onClick={() => setConvertTarget(null)} disabled={converting}>Abbrechen</Button>
              <Button onClick={handleConvert} disabled={converting || selectedServices.length === 0 || (needsDifferenceConfirm && !confirmDifference)} className="bg-[#1a2a5e] text-white hover:bg-[#0f1d45]">
                {converting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />} Auftrag anlegen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Löschen */}
        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reparaturanfrage löschen?</AlertDialogTitle>
              <AlertDialogDescription>Anfrage {deleteTarget?.requestNumber} wird endgültig gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete() }} className="bg-red-600 hover:bg-red-700" disabled={deleting}>
                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Endgültig löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
