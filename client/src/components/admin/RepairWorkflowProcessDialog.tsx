import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { useToast } from "@/hooks/useToast"
import api from "@/api/api"
import { getKnownRepairCost } from "@/api/deviceInspection"
import {
  approveRepairStart,
  completeRepair,
  defaultRepairCustomerMessage,
  describeCustomerNotification,
  pauseRepair,
  reopenRepair,
  reportIncident,
  resolveRepairIncident,
  resumeRepair,
  retryRepairCustomerNotification,
  syncRepairOrder,
  type RepairCustomerNotification,
  type RepairTransitionResult,
} from "@/api/repairWorkflow"
import { CorrectionModal } from "@/components/repair/CorrectionModal"
import { resolveReturnMethod, type ReturnMethodShipments } from "@/lib/returnMethod"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit3,
  Hash,
  Info,
  Lock,
  MessageSquarePlus,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Truck,
  Smartphone,
  ShieldCheck,
  Timer,
  User,
  Wrench,
  XCircle,
} from "lucide-react"

// ── Types ───────────────────────────────────────────────────────────────────

type RepairWorkflowStatus = "pending-confirmation" | "in-progress" | "paused" | "completed" | "incident"

type SidebarSection = "actions" | "incidents" | "history" | "details"

interface RepairWorkflowProcessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  workflow: any | null
  order?: any | null
  inspection?: any | null
  onWorkflowUpdated?: (workflow: any) => void
  /** Versandstand (GET /api/orders/:id -> shipments) für den Rückgabeweg im Abschlusstext. */
  shipments?: ReturnMethodShipments | null
}

// ── Constants ───────────────────────────────────────────────────────────────

const INCIDENT_TYPE_OPTIONS = [
  { value: "defective_part", label: "Defektes Ersatzteil" },
  { value: "spare_part_needed", label: "Ersatzteil benötigt" },
  { value: "customer_info", label: "Rückfrage an Kunden" },
  { value: "other_repair", label: "Weitere Reparatur nötig" },
  { value: "technician_handover", label: "Techniker-Übergabe" },
  { value: "needs_time", label: "Mehr Zeit erforderlich" },
]

const INCIDENT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  INCIDENT_TYPE_OPTIONS.map((option) => [option.value, option.label])
)

// Server-Meldungen (deutsch) bevorzugen, sonst die Axios-Meldung.
const errorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback

// Auftragsstatus nach dem Abgleich (gleiche Bezeichnungen wie im Auftragsverlauf).
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Ausstehend",
  "diagnostic-assessment": "Diagnosebewertung",
  "in-progress": "Reparatur in Bearbeitung",
  paused: "Pausiert",
  "quality-check": "Qualitätskontrolle",
  "ready-for-pickup": "Reparatur abgeschlossen – bereit zur Rückgabe",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
}
const orderStatusLabel = (status?: string | null) => (status ? ORDER_STATUS_LABELS[status] || status : "")

// Ergebnis der letzten Aktion: Speichern, Auftragsstatus und Kundenbenachrichtigung getrennt.
type NotificationTarget = { target: "approval" | "completion" | "incident"; incidentId?: string }
interface ActionOutcome {
  message: string
  orderStatus?: string | null
  warnings: string[]
  notification?: RepairCustomerNotification
  notificationTarget?: NotificationTarget
}

// Badges der zwei Zielgruppen - Farbe ist nie das einzige Signal (Text + Symbol).
const AudienceBadge = ({ audience }: { audience: "customer" | "internal" }) => (
  audience === "customer" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
      <Send className="h-3 w-3" aria-hidden="true" /> An Kunden
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
      <Lock className="h-3 w-3" aria-hidden="true" /> Intern – nur für das Team
    </span>
  )
)

const notificationLine = (notification?: RepairCustomerNotification | null, sentAtFallback?: string) => {
  if (notification?.status === "sent" || (!notification && sentAtFallback)) {
    const channel = notification?.inApp === false && notification?.email === "sent" ? " (E-Mail an Gastkunden)" : ""
    return `Ja, am ${formatDateTime(notification?.at || sentAtFallback)}${channel}`
  }
  if (notification?.status === "failed" && notification.inApp === true && notification.email === "failed") return "Teilweise – im Kundenkonto benachrichtigt, E-Mail fehlgeschlagen"
  if (notification?.status === "failed") return "Fehlgeschlagen"
  if (notification?.status === "skipped" && notification.reason === "no_customer_account") return "Nein – Gastauftrag ohne Kundenkonto"
  if (notification?.status === "skipped" && notification.reason === "no_contact") return "Nein – Gastauftrag ohne E-Mail-Adresse"
  if (notification?.status === "skipped" && notification.reason === "order_cancelled") return "Nein – Auftrag storniert"
  if (notification?.status === "skipped" && notification.reason === "preferences") return "Nein – Kunde hat Benachrichtigungen abgeschaltet"
  return "Nein"
}

const STATUS_UI: Record<RepairWorkflowStatus, { label: string; dotColor: string; badgeClass: string }> = {
  "pending-confirmation": {
    label: "Wartet auf Freigabe",
    dotColor: "bg-slate-400",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
  },
  "in-progress": {
    label: "In Bearbeitung",
    dotColor: "bg-blue-500 animate-pulse",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
  },
  paused: {
    label: "Pausiert",
    dotColor: "bg-amber-400",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
  },
  completed: {
    label: "Abgeschlossen",
    dotColor: "bg-emerald-500",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  incident: {
    label: "Zwischenfall",
    dotColor: "bg-red-500 animate-pulse",
    badgeClass: "bg-red-100 text-red-800 border-red-300",
  },
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const formatElapsed = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

const formatMs = (ms: number) => {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

const formatDateTime = (value?: string) => {
  if (!value) return "—"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "—"
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ── Component ────────────────────────────────────────────────────────────────

// ── Inspection helpers ───────────────────────────────────────────────────

const CONDITION_LABEL: Record<string, { label: string; color: string }> = {
  OK: { label: "OK", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  "light-wear": { label: "Leichte Gebrauchsspuren", color: "text-amber-700 bg-amber-50 border-amber-200" },
  "scratches-wear": { label: "Kratzer", color: "text-amber-700 bg-amber-50 border-amber-200" },
  "heavy-scratches-wear": { label: "Starke Kratzer", color: "text-orange-700 bg-orange-50 border-orange-200" },
  damaged: { label: "Beschädigt", color: "text-red-700 bg-red-50 border-red-200" },
  "Not OK": { label: "Nicht OK", color: "text-red-700 bg-red-50 border-red-200" },
  working: { label: "Funktioniert", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  "not-working": { label: "Defekt", color: "text-red-700 bg-red-50 border-red-200" },
  defective: { label: "Defekt", color: "text-red-700 bg-red-50 border-red-200" },
  "not-testable": { label: "Nicht testbar", color: "text-slate-600 bg-slate-50 border-slate-200" },
}

const ConditionBadge = ({ status }: { status?: string }) => {
  if (!status) return <span className="text-xs text-slate-400">—</span>
  const ui = CONDITION_LABEL[status] ?? { label: status, color: "text-slate-600 bg-slate-50 border-slate-200" }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ui.color}`}>
      {ui.label}
    </span>
  )
}

export function RepairWorkflowProcessDialog({
  open,
  onOpenChange,
  orderId,
  workflow,
  order,
  inspection,
  onWorkflowUpdated,
  shipments,
}: RepairWorkflowProcessDialogProps) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [loadingAction, setLoadingAction] = useState<"approve" | "pause" | "resume" | "complete" | "incident" | "reopen" | "sync" | "notify" | null>(null)
  const [lastOutcome, setLastOutcome] = useState<ActionOutcome | null>(null)
  const [ticker, setTicker] = useState(() => Date.now())
  const [activeSection, setActiveSection] = useState<SidebarSection>("actions")

  // Approve form
  const [internalNotes, setInternalNotes] = useState("")
  const [notifyCustomer, setNotifyCustomer] = useState(false)
  const [approveCustomerMessage, setApproveCustomerMessage] = useState("")

  // Complete form ("Kunde informieren" ist beim Abschluss vorausgewählt)
  const [completeNotifyCustomer, setCompleteNotifyCustomer] = useState(true)
  const [completeCustomerMessage, setCompleteCustomerMessage] = useState("")
  // Unveränderter Vorschlag => KEIN Text mitschicken: der Server wählt dann den Text nach dem
  // Rückgabeweg (server/utils/returnMethod.js, dieselbe Regel wie lib/returnMethod). Nur ein von
  // Hand geänderter Text wird wörtlich übernommen.
  const [completeMessageEdited, setCompleteMessageEdited] = useState(false)
  const completeReturnMethod = resolveReturnMethod(shipments)

  // Reopen form
  const [showReopenDialog, setShowReopenDialog] = useState(false)
  const [reopenReason, setReopenReason] = useState("")

  // Pause form
  const [pauseReason, setPauseReason] = useState("")

  // Incident form
  const [incidentType, setIncidentType] = useState("defective_part")
  const [incidentReason, setIncidentReason] = useState("")
  const [incidentNotes, setIncidentNotes] = useState("")

  // Confirm dialogs
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [showPauseDialog, setShowPauseDialog] = useState(false)
  const [showIncidentDialog, setShowIncidentDialog] = useState(false)
  const [resolvingIncidentId, setResolvingIncidentId] = useState<string | null>(null)

  // Incident: notify customer
  const [incidentNotifyCustomer, setIncidentNotifyCustomer] = useState(false)
  const [incidentCustomerMessage, setIncidentCustomerMessage] = useState("")
  const [incidentMessageEdited, setIncidentMessageEdited] = useState(false)

  // "Wartet auf Kundenrückmeldung" kommt ausschließlich aus der Server-Ableitung
  // (GET /api/repair-workflows/admin/awaiting-customer-feedback) - dieselbe Regel wie in den
  // Auftragslisten: eine Kundenantwort oder eine Erledigung beendet das Warten.
  const [awaitingIncidentIds, setAwaitingIncidentIds] = useState<Set<string>>(() => new Set())
  const incidentsSignature = Array.isArray(workflow?.incidents)
    ? workflow.incidents.map((incident: any) => `${incident?._id}:${incident?.status}:${incident?.emailSentAt || ""}`).join("|")
    : ""
  useEffect(() => {
    if (!open || !orderId || !incidentsSignature) {
      setAwaitingIncidentIds(new Set())
      return
    }
    let cancelled = false
    api.get("/api/repair-workflows/admin/awaiting-customer-feedback", { params: { orderIds: orderId } })
      .then((response: any) => {
        if (cancelled) return
        const entries: any[] = Array.isArray(response?.data?.orders) ? response.data.orders : []
        const ids = new Set<string>()
        entries
          .filter((entry) => String(entry?.orderId) === String(orderId))
          .forEach((entry) => (Array.isArray(entry?.reasons) ? entry.reasons : [])
            .filter((reason: any) => reason?.type === "workflow_customer_info" && reason?.sourceId)
            .forEach((reason: any) => ids.add(String(reason.sourceId))))
        setAwaitingIncidentIds(ids)
      })
      .catch((error: any) => {
        // Ohne Server-Antwort keine Behauptung - "Kunde benachrichtigt" bleibt sichtbar.
        if (!cancelled) setAwaitingIncidentIds(new Set())
        console.warn("Kundenrückmeldungs-Status konnte nicht geladen werden", error)
      })
    return () => {
      cancelled = true
    }
  }, [open, orderId, incidentsSignature])

  // Sync form from workflow
  useEffect(() => {
    if (!workflow || !open) return
    setInternalNotes(workflow?.approvalData?.internalNotes || "")
    setNotifyCustomer(Boolean(workflow?.approvalData?.notifyCustomer))
    setApproveCustomerMessage(workflow?.approvalData?.customerMessage || defaultRepairCustomerMessage("approve", order))
    setCompleteMessageEdited(false)
  }, [workflow?._id, open])

  // Vorschlag zum Abschluss folgt dem Rückgabeweg (Versand / Abholung), solange er nicht von Hand
  // geändert wurde - auch wenn der Versandstand erst nach dem Öffnen geladen wird.
  useEffect(() => {
    if (!open || completeMessageEdited) return
    setCompleteCustomerMessage(defaultRepairCustomerMessage("complete", order, undefined, completeReturnMethod))
  }, [open, workflow?._id, completeMessageEdited, completeReturnMethod, order?.orderNumber])

  // Navigate to actions on open/workflow change
  useEffect(() => {
    if (open) {
      setActiveSection("actions")
      setLastOutcome(null)
    }
  }, [open, workflow?._id])

  // Kundentext des Zwischenfalls folgt der Art, solange er nicht von Hand geändert wurde.
  useEffect(() => {
    if (!incidentMessageEdited) setIncidentCustomerMessage(defaultRepairCustomerMessage("incident", order, incidentType))
  }, [incidentType, incidentMessageEdited, order?.orderNumber])

  // Live timer tick — only when actively running (not paused/incident)
  useEffect(() => {
    if (!open) return
    if (!workflow || workflow.status !== "in-progress") return
    const id = window.setInterval(() => setTicker(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [open, workflow?.status])

  // Elapsed active time
  const elapsedMs = useMemo(() => {
    if (!workflow?.timerData?.startedAt) return 0
    const startedAt = new Date(workflow.timerData.startedAt).getTime()
    if (!Number.isFinite(startedAt)) return 0

    const now = ticker
    const storedPaused = Number(workflow?.timerData?.totalPausedMs || 0)

    let activePaused = 0
    if ((workflow.status === "paused" || workflow.status === "incident") && workflow?.timerData?.pausedAt) {
      const pausedAt = new Date(workflow.timerData.pausedAt).getTime()
      if (Number.isFinite(pausedAt) && now > pausedAt) {
        activePaused = now - pausedAt
      }
    }

    return Math.max(0, now - startedAt - storedPaused - activePaused)
  }, [workflow, ticker])

  if (!workflow) return null

  const status = (workflow.status || "pending-confirmation") as RepairWorkflowStatus
  const statusUI = STATUS_UI[status] ?? STATUS_UI["pending-confirmation"]
  // K09: Storniert -> Arbeitsschritte vorab sperren (der Server lehnt sie ohnehin mit 409 ab).
  const orderCancelled = order?.status === "cancelled"
  const incidents: any[] = Array.isArray(workflow.incidents) ? workflow.incidents : []
  const incidentCount = incidents.length
  const totalPausedMs = Number(workflow?.timerData?.totalPausedMs || 0)
  const storedPauseHistory: any[] = Array.isArray(workflow?.timerData?.pauseHistory) ? workflow.timerData.pauseHistory : []
  // Die laufende Pause steht erst nach dem Fortsetzen in pauseHistory - für die
  // Lesesicht wird sie als offener Eintrag angehängt.
  const pauseHistory: any[] = (status === "paused" || status === "incident") && workflow?.timerData?.pausedAt
    ? [
        ...storedPauseHistory,
        {
          pausedAt: workflow.timerData.pausedAt,
          reason: workflow.timerData.currentPauseReason,
          pausedByTechnicianName: workflow.timerData.currentPausedByTechnicianName,
        },
      ]
    : storedPauseHistory

  const technicianName =
    workflow?.approvalData?.approvedByTechnicianName ||
    order?.assignedStaff?.[0]?.name ||
    order?.assignedStaff?.[0]?.email ||
    "Nicht zugewiesen"

  const deviceLabel = [order?.deviceBrand, order?.deviceModel].filter(Boolean).join(" ") || "—"

  // ── Action helpers ────────────────────────────────────────────────────────

  // Speichererfolg und Benachrichtigungsergebnis werden GETRENNT gemeldet: ein gespeicherter
  // Zustandswechsel ist ein Erfolg, auch wenn die Nachricht an den Kunden scheitert.
  const applyResult = (result: RepairTransitionResult, successMessage: string, notificationTarget?: NotificationTarget) => {
    if (result?.workflow) onWorkflowUpdated?.(result.workflow)
    const notification = result?.customerNotification
    const described = describeCustomerNotification(notification)
    setLastOutcome({
      message: result?.message || successMessage,
      orderStatus: result?.orderStatus,
      warnings: Array.isArray(result?.warnings) ? result.warnings : [],
      notification: notification && notification.reason !== "not_requested" ? notification : undefined,
      notificationTarget,
    })
    const statusText = result?.orderStatusChanged && result?.orderStatus ? ` Auftragsstatus: ${orderStatusLabel(result.orderStatus)}.` : ""
    toast({ title: "Gespeichert", description: `${result?.message || successMessage}${statusText}` })
    if (described && described.tone !== "success" && described.tone !== "info") {
      toast({ title: described.title, description: described.description, variant: "destructive" })
    } else if (described) {
      toast({ title: described.title, description: described.description })
    }
  }

  const runAction = async (
    action: NonNullable<typeof loadingAction>,
    run: () => Promise<RepairTransitionResult>,
    successMessage: string,
    fallbackError: string,
    notificationTarget?: NotificationTarget
  ) => {
    try {
      setLoadingAction(action)
      const result = await run()
      applyResult(result, successMessage, notificationTarget)
      return result
    } catch (error: any) {
      toast({ title: "Nicht gespeichert", description: errorMessage(error, fallbackError), variant: "destructive" })
      return null
    } finally {
      setLoadingAction(null)
    }
  }

  const handleApprove = async () => {
    if (notifyCustomer && !approveCustomerMessage.trim()) {
      toast({ title: "Hinweis", description: "Bitte die Nachricht an den Kunden eingeben oder „Kunde informieren“ ausschalten.", variant: "destructive" })
      return
    }
    await runAction(
      "approve",
      () => approveRepairStart(orderId, internalNotes, null, notifyCustomer, approveCustomerMessage.trim()),
      "Die Reparatur wurde gestartet.",
      "Die Reparatur konnte nicht gestartet werden.",
      { target: "approval" }
    )
  }

  const handlePause = async () => {
    const result = await runAction("pause", () => pauseRepair(orderId, pauseReason.trim() || undefined), "Die Reparatur wurde pausiert.", "Die Reparatur konnte nicht pausiert werden.")
    if (result) {
      setPauseReason("")
      setShowPauseDialog(false)
    }
  }

  const handleResume = async () => {
    await runAction("resume", () => resumeRepair(orderId), "Die Reparatur wurde fortgesetzt.", "Die Reparatur konnte nicht fortgesetzt werden.")
  }

  const handleComplete = async () => {
    if (completeNotifyCustomer && !completeCustomerMessage.trim()) {
      toast({ title: "Hinweis", description: "Bitte die Nachricht an den Kunden eingeben oder „Kunde informieren“ ausschalten.", variant: "destructive" })
      return
    }
    const result = await runAction(
      "complete",
      () => completeRepair(orderId, {
        notifyCustomer: completeNotifyCustomer,
        customerMessage: completeMessageEdited ? completeCustomerMessage.trim() : undefined,
      }),
      "Die Reparatur wurde abgeschlossen.",
      "Die Reparatur konnte nicht abgeschlossen werden.",
      { target: "completion" }
    )
    if (result) setShowCompleteConfirm(false)
  }

  const handleReopen = async () => {
    if (!reopenReason.trim()) return
    const result = await runAction("reopen", () => reopenRepair(orderId, reopenReason.trim()), "Die Reparatur wurde wieder aufgenommen.", "Die Reparatur konnte nicht wieder aufgenommen werden.")
    if (result) {
      setReopenReason("")
      setShowReopenDialog(false)
    }
  }

  const handleSyncOrder = async () => {
    await runAction("sync", () => syncRepairOrder(orderId), "Auftragsstatus und Verlauf sind aktuell.", "Der Auftragsstatus konnte nicht abgeglichen werden.")
  }

  const handleRetryNotification = async (target: NotificationTarget, customerMessage?: string) => {
    await runAction(
      "notify",
      () => retryRepairCustomerNotification(orderId, target.target, target.incidentId, customerMessage),
      "Benachrichtigung erneut gesendet.",
      "Die Benachrichtigung konnte nicht gesendet werden.",
      target
    )
  }

  const handleReportIncident = async () => {
    if (!incidentReason.trim()) {
      toast({ title: "Hinweis", description: "Bitte eine Kurzbeschreibung des Zwischenfalls angeben.", variant: "destructive" })
      return
    }
    if (incidentNotifyCustomer && !incidentCustomerMessage.trim()) {
      toast({ title: "Hinweis", description: "Bitte die Nachricht an den Kunden eingeben oder „Kunde informieren“ ausschalten.", variant: "destructive" })
      return
    }
    const result = await runAction(
      "incident",
      () => reportIncident(orderId, incidentType, incidentReason.trim(), { notes: incidentNotes.trim() || undefined }, {
        notifyCustomer: incidentNotifyCustomer,
        customerMessage: incidentCustomerMessage.trim(),
      }),
      "Der Zwischenfall wurde gemeldet.",
      "Der Zwischenfall konnte nicht gemeldet werden."
    )
    if (result) {
      const newest = Array.isArray(result.workflow?.incidents) ? result.workflow.incidents[result.workflow.incidents.length - 1] : null
      if (newest?._id) {
        setLastOutcome((previous) => (previous ? { ...previous, notificationTarget: { target: "incident", incidentId: String(newest._id) } } : previous))
      }
      setIncidentReason("")
      setIncidentNotes("")
      setIncidentNotifyCustomer(false)
      setIncidentMessageEdited(false)
      setShowIncidentDialog(false)
    }
  }

  // "Auslieferung vorbereiten": Dialog schließen und im Auftrag den Bereich „Versand“ öffnen
  // (Personal-Auftragsdetail: ?bereich=versand, Abschnitt #admin-od-shipping mit „An Kunden versenden“).
  // Gibt es den Abschnitt nicht (Dialog außerhalb des Auftragsdetails), bleibt der Dialog offen
  // und ein Hinweis erklärt den Weg – kein stilles Schließen.
  const handlePrepareShipping = () => {
    const inOrderDetail = Boolean(document.querySelector(".admin-od-tabs"))
    if (!inOrderDetail) {
      toast({ title: "Auslieferung vorbereiten", description: "Bitte den Auftrag öffnen und im Bereich „Versand“ das Versandlabel an den Kunden erstellen." })
      return
    }
    onOpenChange(false)
    const params = new URLSearchParams(location.search)
    params.set("bereich", "versand")
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true, state: location.state })
    window.setTimeout(() => {
      const target = document.getElementById("admin-od-shipping")
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" })
        target.focus({ preventScroll: true })
      } else {
        toast({ title: "Auslieferung vorbereiten", description: "Bitte im Auftrag den Bereich „Versand“ öffnen und dort das Versandlabel an den Kunden erstellen." })
      }
    }, 200)
  }

  // Schließen ist KEIN Zustandswechsel: Ansicht und Arbeitszustand sind getrennt.
  // Ein laufender Workflow läuft weiter (Zeiterfassung inklusive) und lässt sich
  // jederzeit direkt wieder öffnen; Pausieren ist eine eigene, ausdrückliche Aktion.
  const handleCloseDialog = () => {
    onOpenChange(false)
  }

  const handleResolveIncident = async (incidentId: string) => {
    try {
      setResolvingIncidentId(incidentId)
      const result = await resolveRepairIncident(orderId, incidentId)
      applyResult(result, "Zwischenfall wurde als erledigt markiert.")
    } catch (error: any) {
      toast({ title: "Fehler", description: errorMessage(error, "Zwischenfall konnte nicht als erledigt markiert werden"), variant: "destructive" })
    } finally {
      setResolvingIncidentId(null)
    }
  }

  // ── Sidebar nav config ───────────────────────────────────────────────────

  const NAV_ITEMS: { id: SidebarSection; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: "actions",
      label: status === "pending-confirmation" ? "Freigabe & Start" : "Aktionen",
      icon: <Wrench className="h-4 w-4" />,
    },
    {
      id: "incidents",
      label: "Zwischenfälle",
      icon: <AlertTriangle className="h-4 w-4" />,
      badge: incidentCount > 0 ? incidentCount : undefined,
    },
    {
      id: "history",
      label: "Pause-Historie",
      icon: <ClipboardList className="h-4 w-4" />,
      badge: pauseHistory.length > 0 ? pauseHistory.length : undefined,
    },
    {
      id: "details",
      label: "Details",
      icon: <Info className="h-4 w-4" />,
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleCloseDialog() }}>
        <DialogContent
          className="flex flex-col gap-0 p-0 max-w-5xl w-[95vw] h-[88vh] overflow-hidden"
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* ── Header ── */}
          <div className="flex-shrink-0 bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] px-5 py-4 text-white">
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-xl font-bold text-[#f5b800] truncate leading-tight">
                    Reparatur-Workflow
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-blue-200 text-sm">
                    {order?.orderNumber ? `Auftrag #${order.orderNumber}` : orderId} · {deviceLabel}
                  </DialogDescription>

                  {/* Live timer + chips */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-mono text-lg font-bold text-white tracking-widest">
                      <Timer className="h-4 w-4 text-[#f5b800] flex-shrink-0" />
                      {formatElapsed(elapsedMs)}
                    </span>
                    {totalPausedMs > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-200">
                        <Pause className="h-3 w-3" />
                        {formatMs(totalPausedMs)} pausiert
                      </span>
                    )}
                    {incidentCount > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-200">
                        <AlertTriangle className="h-3 w-3" />
                        {incidentCount} Zwischenfall{incidentCount !== 1 ? "e" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status badge (Abstand zum Schließen-X oben rechts) */}
                <div className="flex-shrink-0 pt-0.5 mr-8">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusUI.badgeClass}`}>
                    <span className={`h-2 w-2 rounded-full ${statusUI.dotColor}`} />
                    {statusUI.label}
                  </span>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* ── Body: sidebar + main ── */}
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden sm:flex-row">

            {/* Left sidebar (auf dem Handy oben als waagerechte Navigation) */}
            <div className="w-full flex-shrink-0 border-b border-gray-100 bg-gray-50 flex flex-col overflow-hidden sm:w-48 sm:border-b-0 sm:border-r">
              {/* Info summary */}
              <div className="hidden px-3 py-3 space-y-2 border-b border-gray-100 bg-white sm:block">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <User className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate font-medium">{technicianName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Smartphone className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{deviceLabel}</span>
                </div>
                {workflow?.timerData?.startedAt && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CalendarClock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{formatDateTime(workflow.timerData.startedAt)}</span>
                  </div>
                )}
              </div>

              {/* Nav */}
              <div className="flex gap-1 overflow-x-auto py-2 px-2 sm:block sm:flex-1 sm:overflow-y-auto sm:space-y-0.5" role="tablist" aria-label="Bereiche des Reparatur-Workflows">
                <p className="hidden px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:block">
                  Navigation
                </p>
                {NAV_ITEMS.map((item) => {
                  const isActive = activeSection === item.id
                  return (
                    <button
                      key={item.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveSection(item.id)}
                      className={`flex-shrink-0 whitespace-nowrap sm:w-full text-left rounded-lg px-2.5 py-2 flex items-center gap-2 transition-all text-sm ${
                        isActive
                          ? "bg-[#1a2a5e] text-white shadow-sm"
                          : "hover:bg-white hover:shadow-sm text-gray-600"
                      }`}
                    >
                      <span className={isActive ? "text-[#f5b800]" : "text-gray-400"}>{item.icon}</span>
                      <span className="flex-1 text-xs leading-snug font-medium">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Sidebar footer */}
              <div className="hidden flex-shrink-0 border-t border-gray-100 p-2 sm:block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs gap-1.5"
                  onClick={handleCloseDialog}
                  disabled={loadingAction !== null}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Schließen
                </Button>
                {status === "in-progress" && (
                  <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
                    Schließen ändert den Status nicht – die Zeiterfassung läuft weiter.
                  </p>
                )}
              </div>
            </div>

            {/* ── Main content ── */}
            <div className="flex-1 min-w-0 overflow-y-auto bg-slate-50/40">

              {/* ACTIONS */}
              {activeSection === "actions" && (
                <div className="p-5 space-y-4">

                  {/* Ergebnis der letzten Aktion: gespeichert / Auftragsstatus / Kunde - getrennt */}
                  {lastOutcome && (
                    <div role="status" aria-live="polite" className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm space-y-2">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">Gespeichert: {lastOutcome.message}</p>
                          {lastOutcome.orderStatus && (
                            <p className="text-xs text-slate-600 mt-0.5">Auftragsstatus: <span className="font-medium">{orderStatusLabel(lastOutcome.orderStatus)}</span></p>
                          )}
                          {lastOutcome.notification && (() => {
                            const described = describeCustomerNotification(lastOutcome.notification)
                            if (!described) return null
                            return (
                              <p className={`text-xs mt-0.5 ${described.tone === "success" || described.tone === "info" ? "text-emerald-700" : "text-red-700"}`}>
                                <Send className="inline h-3 w-3 mr-1" aria-hidden="true" />
                                {described.title}: {described.description}
                              </p>
                            )
                          })()}
                        </div>
                        <button type="button" className="text-xs text-slate-400 hover:text-slate-600" onClick={() => setLastOutcome(null)} aria-label="Hinweis schließen">
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                      {lastOutcome.warnings.length > 0 && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
                          {lastOutcome.warnings.map((warning, index) => (
                            <p key={index} className="flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />{warning}</p>
                          ))}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {lastOutcome.warnings.some((warning) => /Auftragsstatus/.test(warning)) && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleSyncOrder} disabled={loadingAction !== null}>
                                <RefreshCw className="h-3.5 w-3.5" /> {loadingAction === "sync" ? "Wird abgeglichen …" : "Auftragsstatus erneut abgleichen"}
                              </Button>
                            )}
                            {lastOutcome.notification?.status === "failed" && lastOutcome.notificationTarget && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleRetryNotification(lastOutcome.notificationTarget!)} disabled={loadingAction !== null}>
                                <Send className="h-3.5 w-3.5" /> {loadingAction === "notify" ? "Wird gesendet …" : "Benachrichtigung erneut senden"}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {orderCancelled && (
                    <div role="status" data-testid="repair-workflow-cancelled-notice" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
                      <Lock className="h-5 w-5 flex-shrink-0 text-red-700 mt-0.5" aria-hidden="true" />
                      <p className="text-sm font-medium text-red-900">
                        Auftrag storniert – Arbeitsschritte sind gesperrt. Zum Fortsetzen muss ein Admin die Stornierung aufheben.
                      </p>
                    </div>
                  )}

                  {/* Pending: Freigabe */}
                  {status === "pending-confirmation" && (
                    <Card className="border-slate-200 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                          <Wrench className="h-4 w-4 text-[#1a2a5e]" />
                          Reparatur freigeben &amp; starten
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                          Der Workflow wartet auf Ihre Freigabe. Überprüfen Sie die Inspektionsdaten und starten Sie die Reparatur oder nehmen Sie Korrekturen vor.
                        </div>

                        {/* ── Inspection summary ── */}
                        {inspection && (
                          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                            <div className="flex items-center gap-2 bg-slate-50 border-b border-slate-200 px-3 py-2">
                              <ShieldCheck className="h-3.5 w-3.5 text-[#1a2a5e]" />
                              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Geräteinspektion</p>
                              {inspection.status && (
                                <span className={`ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                  inspection.status === "completed"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : inspection.status === "in-progress"
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-slate-50 text-slate-600 border-slate-200"
                                }`}>
                                  {inspection.status === "completed" ? "Abgeschlossen" : inspection.status === "in-progress" ? "In Bearbeitung" : inspection.status}
                                </span>
                              )}
                            </div>

                            <div className="p-3 space-y-3">

                              {/* Model verification */}
                              {inspection.modelVerification && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Modellverifizierung</p>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    <div>
                                      <span className="text-slate-400">Gemeldet: </span>
                                      <span className="font-medium text-slate-700">{inspection.modelVerification.reportedModel || "—"}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400">Tatsächlich: </span>
                                      <span className="font-medium text-slate-700">{inspection.modelVerification.actualModel || "—"}</span>
                                    </div>
                                    <div className="col-span-2 flex items-center gap-2 mt-0.5">
                                      <span className="text-slate-400">Status: </span>
                                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                        inspection.modelVerification.verified
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          : "bg-red-50 text-red-700 border-red-200"
                                      }`}>
                                        {inspection.modelVerification.verified ? "Verifiziert" : "Nicht verifiziert"}
                                      </span>
                                      {inspection.modelVerification.verificationStatus === "incorrect-more-expensive" && (
                                        <span className="text-[10px] text-orange-600 font-medium">⚠ Tatsächliches Modell teurer</span>
                                      )}
                                    </div>
                                    {inspection.modelVerification.notes && (
                                      <div className="col-span-2 text-slate-600 italic">{inspection.modelVerification.notes}</div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Identification */}
                              {inspection.identification && (inspection.identification.imei || inspection.identification.serialNumber) && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Identifikation</p>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    {inspection.identification.imei && (
                                      <div className="col-span-2">
                                        <span className="text-slate-400">IMEI: </span>
                                        <span className="font-mono font-medium text-slate-700">{inspection.identification.imei}</span>
                                      </div>
                                    )}
                                    {inspection.identification.serialNumber && (
                                      <div className="col-span-2">
                                        <span className="text-slate-400">Seriennummer: </span>
                                        <span className="font-mono font-medium text-slate-700">{inspection.identification.serialNumber}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* External inspection */}
                              {inspection.externalInspection && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Äußerer Zustand</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {([
                                      { key: "display", label: "Display" },
                                      { key: "frame", label: "Rahmen" },
                                      { key: "backCover", label: "Rückseite" },
                                      { key: "buttons", label: "Tasten" },
                                    ] as const).map(({ key, label }) => {
                                      const part = inspection.externalInspection[key]
                                      if (!part) return null
                                      return (
                                        <div key={key} className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
                                          <span className="text-xs text-slate-600">{label}</span>
                                          <ConditionBadge status={part.status} />
                                        </div>
                                      )
                                    })}
                                  </div>
                                  {inspection.externalInspection.visibleDamages?.hasDamage && (
                                    <div className="mt-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
                                      <span className="font-semibold">Sichtbare Schäden: </span>
                                      {inspection.externalInspection.visibleDamages.description || "Vorhanden"}
                                    </div>
                                  )}
                                  {inspection.externalInspection.uniqueNotes && (
                                    <p className="mt-1.5 text-xs text-slate-600 italic">{inspection.externalInspection.uniqueNotes}</p>
                                  )}
                                </div>
                              )}

                              {/* Device tests */}
                              {inspection.deviceTest && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Funktionstest</p>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {([
                                      { key: "power", label: "Power" },
                                      { key: "charging", label: "Laden" },
                                      { key: "wifi", label: "WLAN" },
                                      { key: "frontCamera", label: "Front-Kamera" },
                                      { key: "mainCamera", label: "Haupt-Kamera" },
                                    ] as const).map(({ key, label }) => {
                                      const test = inspection.deviceTest[key]
                                      if (!test) return null
                                      const ok = test.status === "OK"
                                      return (
                                        <div key={key} className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs ${
                                          ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
                                        }`}>
                                          <span className="font-bold">{ok ? "✓" : "✗"}</span>
                                          <span>{label}</span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                  {inspection.hasFailedTests && Array.isArray(inspection.failedTestDetails) && inspection.failedTestDetails.length > 0 && (
                                    <div className="mt-1.5 space-y-1">
                                      {inspection.failedTestDetails.map((f: any, i: number) => (
                                        <div key={i} className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                                          <span className="font-semibold">{f.testName}: </span>{f.reason}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Repair assessment: keine "Reparierbar"-Aussage (gespeicherte Altwerte waren
                                  Client-Vorgaben); nur ein tatsächlich angegebener Preis wird gezeigt. */}
                              {inspection.repairOffer && (() => {
                                const knownCost = getKnownRepairCost(inspection)
                                return (
                                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-700">
                                      Kostenvoranschlag
                                    </span>
                                    <span className={`ml-auto text-xs ${knownCost === null ? "text-slate-500" : "font-bold text-slate-800"}`}>
                                      {knownCost === null
                                        ? "Kosten: nicht angegeben"
                                        : `${knownCost.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}${knownCost === 0 ? " (kostenlos)" : ""}`}
                                    </span>
                                  </div>
                                  {inspection.repairOffer?.timeframe && (
                                    <p className="mt-0.5 text-xs text-slate-600">Zeitrahmen: {inspection.repairOffer.timeframe}</p>
                                  )}
                                  {inspection.repairOffer?.description && (
                                    <p className="mt-0.5 text-xs text-slate-600">{inspection.repairOffer.description}</p>
                                  )}
                                </div>
                                )
                              })()}

                              {/* Accessories */}
                              {inspection.accessories && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Zubehör</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {([
                                      { key: "originalPackaging", label: "Originalverpackung" },
                                      { key: "caseCover", label: "Hülle" },
                                      { key: "powerAdapter", label: "Netzteil" },
                                      { key: "simTray", label: "SIM-Schublade" },
                                      { key: "cables", label: "Kabel" },
                                    ] as const).map(({ key, label }) => {
                                      const item = inspection.accessories[key]
                                      if (!item || item.present === undefined) return null
                                      return (
                                        <span key={key} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                          item.present
                                            ? "bg-slate-100 text-slate-700 border-slate-200"
                                            : "bg-slate-50 text-slate-400 border-slate-200 line-through"
                                        }`}>
                                          {item.present ? "✓" : "—"} {label}
                                        </span>
                                      )
                                    })}
                                  </div>
                                  {inspection.accessories.additionalAccessoriesText && (
                                    <p className="mt-1.5 text-xs text-slate-600">{inspection.accessories.additionalAccessoriesText}</p>
                                  )}
                                </div>
                              )}

                            </div>
                          </div>
                        )}

                        <Separator />

                        {/* Interne Notiz und Nachricht an Kunden - klar getrennt */}
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="approve-internal-notes" className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
                              Interne Notiz <AudienceBadge audience="internal" />
                            </Label>
                            <Textarea
                              id="approve-internal-notes"
                              value={internalNotes}
                              onChange={(e) => setInternalNotes(e.target.value)}
                              placeholder="Nur für das Team – wird dem Kunden nie gesendet."
                              className="min-h-[60px] resize-none text-sm"
                              disabled={loadingAction !== null}
                            />
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <MessageSquarePlus className="h-4 w-4 text-[#1a2a5e]" aria-hidden="true" />
                                <div>
                                  <p className="text-sm font-medium text-slate-800">Kunde informieren</p>
                                  <p className="text-[11px] text-slate-500">Benachrichtigung im Kundenkonto und E-Mail beim Start</p>
                                </div>
                              </div>
                              <Switch checked={notifyCustomer} onCheckedChange={setNotifyCustomer} disabled={loadingAction !== null} aria-label="Kunde informieren" />
                            </div>
                            {notifyCustomer && (
                              <div className="space-y-1.5">
                                <Label htmlFor="approve-customer-message" className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-700">
                                  Nachricht an Kunden <AudienceBadge audience="customer" />
                                </Label>
                                <Textarea
                                  id="approve-customer-message"
                                  value={approveCustomerMessage}
                                  onChange={(e) => setApproveCustomerMessage(e.target.value)}
                                  className="min-h-[70px] resize-none text-sm bg-white"
                                  disabled={loadingAction !== null}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Two primary actions - bleiben beim Scrollen unten sichtbar */}
                        <div className="sticky bottom-0 z-10 -mx-6 -mb-6 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur sm:flex-row">
                          <Button
                            variant="outline"
                            onClick={() => setShowCorrectionModal(true)}
                            disabled={loadingAction !== null || orderCancelled}
                            className="flex-1 gap-2 border-[#1a2a5e]/20 text-[#1a2a5e] hover:bg-[#1a2a5e]/05 font-semibold"
                          >
                            <Edit3 className="h-4 w-4" />
                            Korrigieren
                          </Button>
                          <Button
                            onClick={handleApprove}
                            disabled={loadingAction !== null || orderCancelled}
                            className="flex-1 gap-2 bg-[#f5b800] text-[#1a2a5e] hover:bg-[#e5ab00] font-semibold border-0"
                          >
                            <Play className="h-4 w-4" />
                            {loadingAction === "approve" ? "Wird gestartet …" : "Bestätigen & Starten"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* In-progress / Incident / Paused: Clean 3-button interface */}
                  {(status === "in-progress" || status === "incident" || status === "paused") && (
                    <div className="space-y-3">

                      {/* Status context message */}
                      {status === "paused" && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
                          <Pause className="h-5 w-5 text-amber-600 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-amber-900">Workflow ist pausiert</p>
                            <p className="text-xs text-amber-700 mt-0.5">Die Zeiterfassung ist angehalten. Setzen Sie den Workflow fort, um weiterzuarbeiten.</p>
                          </div>
                          <Button
                            onClick={handleResume}
                            disabled={loadingAction !== null || orderCancelled}
                            size="sm"
                            className="ml-auto gap-1.5 bg-[#1a2a5e] hover:bg-[#2a3f7e] text-white flex-shrink-0"
                          >
                            <Play className="h-3.5 w-3.5" />
                            {loadingAction === "resume" ? "…" : "Fortsetzen"}
                          </Button>
                        </div>
                      )}

                      {status === "incident" && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-red-900">Zwischenfall aktiv</p>
                            <p className="text-xs text-red-700 mt-0.5">Lösen Sie das Problem und setzen Sie den Workflow fort.</p>
                          </div>
                          <Button
                            onClick={handleResume}
                            disabled={loadingAction !== null || orderCancelled}
                            size="sm"
                            className="ml-auto gap-1.5 bg-[#1a2a5e] hover:bg-[#2a3f7e] text-white flex-shrink-0"
                          >
                            <Play className="h-3.5 w-3.5" />
                            {loadingAction === "resume" ? "…" : "Fortsetzen"}
                          </Button>
                        </div>
                      )}

                      {/* 3 Action buttons */}
                      <div className="grid gap-3">

                        {/* Workflow pausieren - wie der Server nur aus laufender Arbeit ("in-progress") */}
                        <button
                          onClick={() => setShowPauseDialog(true)}
                          disabled={loadingAction !== null || status !== "in-progress" || orderCancelled}
                          className="flex items-center gap-4 rounded-xl border border-blue-200 bg-white p-4 text-left transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100">
                            <Pause className="h-5 w-5 text-blue-700" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">Workflow pausieren</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {status === "incident"
                                ? "Während eines aktiven Zwischenfalls nicht möglich – die Zeiterfassung ist bereits angehalten. Zum Weiterarbeiten „Fortsetzen“ wählen."
                                : status === "paused"
                                  ? "Der Workflow ist bereits pausiert."
                                  : "Zeiterfassung unterbrechen, z. B. bei Wartezeit auf Ersatzteile oder Kundenkontakt"}
                            </p>
                          </div>
                        </button>

                        {/* Zwischenfall melden */}
                        <button
                          onClick={() => setShowIncidentDialog(true)}
                          disabled={loadingAction !== null || orderCancelled}
                          className="flex items-center gap-4 rounded-xl border border-red-200 bg-white p-4 text-left transition-all hover:border-red-300 hover:bg-red-50/50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-100">
                            <AlertTriangle className="h-5 w-5 text-red-700" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">Zwischenfall melden</p>
                            <p className="text-xs text-slate-500 mt-0.5">Problem dokumentieren — z. B. defektes Teil, zusätzliche Reparatur oder Rückfrage an Kunden</p>
                          </div>
                        </button>

                        {/* Reparatur abschliessen */}
                        <button
                          onClick={() => setShowCompleteConfirm(true)}
                          disabled={loadingAction !== null || orderCancelled}
                          className="flex items-center gap-4 rounded-xl border border-emerald-200 bg-white p-4 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">Reparatur abschließen</p>
                            <p className="text-xs text-slate-500 mt-0.5">Alle Arbeiten abgeschlossen — beendet die Zeiterfassung und schließt den Workflow</p>
                          </div>
                        </button>

                      </div>
                    </div>
                  )}

                  {/* Completed */}
                  {status === "completed" && (
                    <Card className="border-emerald-200 bg-emerald-50/60 shadow-sm">
                      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                        <p className="text-base font-semibold text-emerald-800">Reparatur erfolgreich abgeschlossen</p>
                        <p className="text-sm text-emerald-700">
                          Aktive Laufzeit: <span className="font-semibold">{formatElapsed(elapsedMs)}</span>
                          {totalPausedMs > 0 && (
                            <> · Pausiert: <span className="font-semibold">{formatMs(totalPausedMs)}</span></>
                          )}
                        </p>
                        {workflow?.timerData?.completedAt && (
                          <p className="text-xs text-emerald-600">
                            Abgeschlossen am {formatDateTime(workflow.timerData.completedAt)}
                          </p>
                        )}
                        {order?.status && (
                          <p className="text-xs text-emerald-800">
                            Auftragsstatus: <span className="font-semibold">{orderStatusLabel(order.status)}</span>
                          </p>
                        )}
                        <p className="text-xs text-emerald-700">
                          Kunde benachrichtigt: {notificationLine(workflow?.completionNotification)}
                        </p>
                        <div className="mt-2 flex w-full max-w-md flex-col gap-2 sm:flex-row sm:justify-center">
                          <Button onClick={handlePrepareShipping} className="gap-2 bg-[#1a2a5e] hover:bg-[#2a3f7e] text-white">
                            <Truck className="h-4 w-4" aria-hidden="true" />
                            Auslieferung vorbereiten
                          </Button>
                          <Button variant="outline" onClick={() => setShowReopenDialog(true)} disabled={loadingAction !== null || orderCancelled} className="gap-2">
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            Reparatur wieder aufnehmen
                          </Button>
                        </div>
                        {/* Kunde nachträglich informieren: immer möglich, solange keine Benachrichtigung gesendet
                            wurde (z. B. Abschluss durch den Techniker ohne Benachrichtigung, oder Fehler). */}
                        {!["sent", "duplicate"].includes(String(workflow?.completionNotification?.status || "")) && (
                          <div className="mt-1 w-full max-w-md space-y-1.5 rounded-lg border border-blue-200 bg-white p-3 text-left">
                            <div className="flex items-center justify-between gap-2">
                              <Label htmlFor="rw-complete-later-message" className="text-xs font-semibold text-slate-800">Nachricht an Kunden</Label>
                              <AudienceBadge audience="customer" />
                            </div>
                            <Textarea
                              id="rw-complete-later-message"
                              value={completeCustomerMessage}
                              onChange={(event) => {
                                setCompleteCustomerMessage(event.target.value)
                                setCompleteMessageEdited(true)
                              }}
                              rows={3}
                              className="text-xs"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs"
                              onClick={() => {
                                if (!completeCustomerMessage.trim()) {
                                  toast({ title: "Hinweis", description: "Bitte die Nachricht an den Kunden eingeben.", variant: "destructive" })
                                  return
                                }
                                // Unveränderter Vorschlag: Server wählt den Text nach dem Rückgabeweg.
                                void handleRetryNotification({ target: "completion" }, completeMessageEdited ? completeCustomerMessage.trim() : undefined)
                              }}
                              disabled={loadingAction !== null}
                            >
                              <Send className="h-3.5 w-3.5" aria-hidden="true" />
                              {workflow?.completionNotification?.status === "failed" ? "Benachrichtigung erneut senden" : "Kunde über Abschluss informieren"}
                            </Button>
                            <p className="text-[11px] text-slate-500">Sendet eine Benachrichtigung im Kundenkonto und eine E-Mail (Gastauftrag: nur E-Mail). Interne Notizen werden nie mitgesendet.</p>
                          </div>
                        )}
                        <p className="text-[11px] text-emerald-700/80">
                          Eine Wiederaufnahme ist möglich, solange noch kein Versandlabel an den Kunden erstellt wurde.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* INCIDENTS */}
              {activeSection === "incidents" && (
                <div className="p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Zwischenfall-Historie
                    {incidentCount > 0 && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                        {incidentCount}
                      </span>
                    )}
                  </h3>

                  {incidentCount === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white py-10 text-center">
                      <CheckCircle2 className="h-8 w-8 text-slate-300" />
                      <p className="text-sm text-slate-500">Keine Zwischenfälle gemeldet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[...incidents].reverse().map((incident: any, i: number) => (
                        <div
                          key={incident._id || `${incident.type}-${i}`}
                          className="rounded-lg border border-red-200 bg-white px-4 py-3 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold">
                                {incidents.length - i}
                              </span>
                              <p className="text-sm font-semibold text-red-800">
                                {INCIDENT_TYPE_LABEL[incident.type] || "Zwischenfall"}
                              </p>
                              <Badge
                                variant="outline"
                                className={incident.status === "resolved" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-300 bg-red-50 text-red-700"}
                              >
                                {incident.status === "resolved" ? "Erledigt" : "Offen"}
                              </Badge>
                              {incident._id && awaitingIncidentIds.has(String(incident._id)) && (
                                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                                  Wartet auf Kundenrückmeldung
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 flex-shrink-0">{formatDateTime(incident.timestamp)}</p>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">{incident.reason || "Kein Grund angegeben"}</p>
                          {incident.notes && (
                            <p className="mt-1 text-xs text-slate-500 border-t border-slate-100 pt-1.5">{incident.notes}</p>
                          )}
                          <div className="mt-2 grid grid-cols-1 gap-0.5 text-[11px] text-slate-500 sm:grid-cols-2">
                            <span>Gemeldet von: {incident.reportedByTechnicianName || "—"}</span>
                            <span>
                              Kunde benachrichtigt: {notificationLine(incident.customerNotification, incident.emailSentAt)}
                            </span>
                            {incident.status === "resolved" && (
                              <span className="sm:col-span-2">
                                Erledigt am {formatDateTime(incident.resolvedAt)}
                                {incident.resolvedByTechnicianName ? ` von ${incident.resolvedByTechnicianName}` : ""}
                                {incident.resolutionNote ? ` – ${incident.resolutionNote}` : ""}
                              </span>
                            )}
                          </div>
                          {incident._id && incident.customerNotification?.status === "failed" && !incident.emailSentAt && (
                            <div className="mt-2 flex justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() => handleRetryNotification({ target: "incident", incidentId: String(incident._id) })}
                                disabled={loadingAction !== null}
                              >
                                <Send className="h-3.5 w-3.5" /> Benachrichtigung erneut senden
                              </Button>
                            </div>
                          )}
                          {incident.status !== "resolved" && incident._id && (
                            <div className="mt-2 flex justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => handleResolveIncident(String(incident._id))}
                                disabled={resolvingIncidentId !== null || loadingAction !== null}
                              >
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                {resolvingIncidentId === String(incident._id) ? "Wird gespeichert …" : "Als erledigt markieren"}
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PAUSE HISTORY */}
              {activeSection === "history" && (
                <div className="p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Pause-Historie
                    {pauseHistory.length > 0 && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                        {pauseHistory.length}
                      </span>
                    )}
                  </h3>

                  {pauseHistory.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white py-10 text-center">
                      <Clock className="h-8 w-8 text-slate-300" />
                      <p className="text-sm text-slate-500">Noch keine Pausen aufgezeichnet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[...pauseHistory].reverse().map((entry: any, i: number) => {
                        const pausedAt = entry?.pausedAt ? new Date(entry.pausedAt) : null
                        const resumedAt = entry?.resumedAt ? new Date(entry.resumedAt) : null
                        const isOpen = !resumedAt || !Number.isFinite(resumedAt.getTime())
                        const durationMs =
                          pausedAt && Number.isFinite(pausedAt.getTime())
                            ? (isOpen ? Date.now() : resumedAt!.getTime()) - pausedAt.getTime()
                            : 0

                        return (
                          <div
                            key={i}
                            className={`rounded-lg border bg-white px-4 py-3 shadow-sm ${
                              isOpen ? "border-amber-300" : "border-slate-200"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                                  {pauseHistory.length - i}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={isOpen ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-600"}
                                >
                                  {isOpen ? "Laufend" : "Abgeschlossen"}
                                </Badge>
                              </div>
                              <span className="text-xs font-semibold text-slate-600">{formatMs(durationMs)}</span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                              <div>
                                <span className="text-slate-400">Start: </span>
                                {pausedAt ? formatDateTime(pausedAt.toISOString()) : "—"}
                              </div>
                              <div>
                                <span className="text-slate-400">Ende: </span>
                                {isOpen ? (
                                  <span className="text-amber-700 font-medium">Noch aktiv</span>
                                ) : (
                                  formatDateTime(resumedAt!.toISOString())
                                )}
                              </div>
                            </div>
                            {entry?.reason && (
                              <p className="mt-2 text-xs text-slate-600 border-t border-slate-100 pt-1.5">
                                <span className="text-slate-400">Grund: </span>{entry.reason}
                              </p>
                            )}
                            {(entry?.pausedByTechnicianName || entry?.resumedByTechnicianName) && (
                              <p className="mt-1 text-[11px] text-slate-500">
                                {entry?.pausedByTechnicianName ? `Pausiert von ${entry.pausedByTechnicianName}` : ""}
                                {entry?.pausedByTechnicianName && entry?.resumedByTechnicianName ? " · " : ""}
                                {entry?.resumedByTechnicianName ? `Fortgesetzt von ${entry.resumedByTechnicianName}` : ""}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {totalPausedMs > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm">
                      <span className="text-amber-700">Gesamte Pausenzeit: </span>
                      <span className="font-semibold text-amber-900">{formatMs(totalPausedMs)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* DETAILS */}
              {activeSection === "details" && (
                <div className="p-5 space-y-4">
                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                        <Hash className="h-4 w-4 text-[#1a2a5e]" />
                        Auftrag &amp; Gerät
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Auftragsnummer</p>
                        <p className="font-medium text-slate-900">{order?.orderNumber || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Gerät</p>
                        <p className="font-medium text-slate-900">{deviceLabel}</p>
                      </div>
                      {order?.customerName && (
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">Kunde</p>
                          <p className="font-medium text-slate-900">{order.customerName}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Workflow-ID</p>
                        <p className="font-mono text-xs text-slate-600 break-all">{String(workflow._id || "")}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                        <Timer className="h-4 w-4 text-[#1a2a5e]" />
                        Zeiterfassung
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Startzeit</p>
                        <p className="font-medium text-slate-900">{formatDateTime(workflow?.timerData?.startedAt)}</p>
                      </div>
                      {workflow?.timerData?.completedAt && (
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">Abschlusszeit</p>
                          <p className="font-medium text-slate-900">{formatDateTime(workflow.timerData.completedAt)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Aktive Laufzeit</p>
                        <p className="font-semibold font-mono text-slate-900">{formatElapsed(elapsedMs)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Pausiert gesamt</p>
                        <p className="font-medium text-slate-900">{formatMs(totalPausedMs)}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {workflow?.approvalData && (
                    <Card className="border-slate-200 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                          <User className="h-4 w-4 text-[#1a2a5e]" />
                          Freigabe-Daten
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">Freigegeben von</p>
                          <p className="font-medium text-slate-900">{workflow.approvalData.approvedByTechnicianName || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">Freigegeben am</p>
                          <p className="font-medium text-slate-900">{formatDateTime(workflow.approvalData.approvedAt)}</p>
                        </div>
                        {workflow.approvalData.internalNotes && (
                          <div className="sm:col-span-2">
                            <p className="text-xs text-slate-400 mb-0.5 flex items-center gap-2">Interne Notizen <AudienceBadge audience="internal" /></p>
                            <p className="text-slate-700 text-sm bg-slate-50 rounded-md p-2 border border-slate-200">
                              {workflow.approvalData.internalNotes}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">Kunde benachrichtigt</p>
                          <p className="font-medium text-slate-900">
                            {workflow.approvalData.notifyCustomer
                              ? notificationLine(workflow.approvalData.customerNotification)
                              : "Nein (nicht gewählt)"}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete confirmation */}
      <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Reparatur abschließen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Zeiterfassung endet. Der Auftrag wechselt auf „Reparatur abgeschlossen – bereit zur Rückgabe“; danach kann die Auslieferung vorbereitet werden.
              Rechnungen und Zahlungen werden nicht verändert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Kunde informieren</p>
                <p className="text-[11px] text-slate-500">Benachrichtigung im Kundenkonto und E-Mail</p>
              </div>
              <Switch checked={completeNotifyCustomer} onCheckedChange={setCompleteNotifyCustomer} disabled={loadingAction !== null} aria-label="Kunde über den Abschluss informieren" />
            </div>
            {completeNotifyCustomer && (
              <div className="space-y-1.5">
                <Label htmlFor="complete-customer-message" className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-700">
                  Nachricht an Kunden <AudienceBadge audience="customer" />
                </Label>
                <Textarea
                  id="complete-customer-message"
                  value={completeCustomerMessage}
                  onChange={(e) => {
                    setCompleteCustomerMessage(e.target.value)
                    setCompleteMessageEdited(true)
                  }}
                  className="min-h-[70px] resize-none text-sm bg-white"
                  disabled={loadingAction !== null}
                />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingAction !== null}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); void handleComplete() }}
              disabled={loadingAction !== null}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loadingAction === "complete" ? "Wird abgeschlossen …" : "Ja, abschließen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Correction modal */}
      {showCorrectionModal && (
        <CorrectionModal
          orderId={orderId}
          inspection={inspection ?? undefined}
          order={order ?? undefined}
          onClose={() => setShowCorrectionModal(false)}
          onApprove={(updatedWorkflow) => {
            onWorkflowUpdated?.(updatedWorkflow)
            setShowCorrectionModal(false)
          }}
        />
      )}

      {/* Pause dialog */}
      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Pause className="h-5 w-5 text-blue-600" />
              Workflow pausieren
            </DialogTitle>
            <DialogDescription>
              Die Zeiterfassung wird unterbrochen, bis der Workflow fortgesetzt wird.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pause-reason-dialog" className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
                Pausengrund <span className="text-destructive">*</span> <AudienceBadge audience="internal" />
              </Label>
              <p className="text-[11px] text-slate-500">Der Kunde wird beim Pausieren nicht benachrichtigt.</p>
              <Input
                id="pause-reason-dialog"
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder="z. B. fehlende Ersatzteile, Kundenkontakt …"
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowPauseDialog(false)} disabled={loadingAction !== null}>
              Abbrechen
            </Button>
            <Button
              onClick={handlePause}
              disabled={loadingAction !== null || !pauseReason.trim()}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Pause className="h-4 w-4" />
              {loadingAction === "pause" ? "Wird pausiert …" : "Pausieren"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Incident dialog */}
      <Dialog open={showIncidentDialog} onOpenChange={setShowIncidentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Zwischenfall melden
            </DialogTitle>
            <DialogDescription>
              Dokumentieren Sie das Problem. Der Workflow wechselt in den Zwischenfall-Modus.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Art des Zwischenfalls</Label>
              <Select value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Typ wählen" />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
                Kurzbeschreibung <span className="text-destructive">*</span> <AudienceBadge audience="internal" />
              </Label>
              <Input
                value={incidentReason}
                onChange={(e) => setIncidentReason(e.target.value)}
                placeholder="Was ist passiert?"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
                Zusatznotizen <span className="text-slate-400 font-normal">(optional)</span> <AudienceBadge audience="internal" />
              </Label>
              <Textarea
                value={incidentNotes}
                onChange={(e) => setIncidentNotes(e.target.value)}
                placeholder="Weitere Details zum Zwischenfall …"
                className="min-h-[70px] resize-none text-sm"
              />
            </div>

            <Separator />

            {/* Kunde informieren */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2.5">
                <MessageSquarePlus className="h-4 w-4 text-[#1a2a5e]" />
                <div>
                  <p className="text-sm font-medium text-slate-800">Kunde informieren</p>
                  <p className="text-[11px] text-slate-500">Benachrichtigung im Kundenkonto und E-Mail – Kurzbeschreibung und Notizen bleiben intern</p>
                </div>
              </div>
              <Switch
                checked={incidentNotifyCustomer}
                onCheckedChange={setIncidentNotifyCustomer}
                disabled={loadingAction !== null}
                aria-label="Kunde über den Zwischenfall informieren"
              />
            </div>
            {incidentNotifyCustomer && (
              <div className="space-y-1.5">
                <Label htmlFor="incident-customer-message" className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
                  Nachricht an Kunden <AudienceBadge audience="customer" />
                </Label>
                <Textarea
                  id="incident-customer-message"
                  value={incidentCustomerMessage}
                  onChange={(e) => { setIncidentCustomerMessage(e.target.value); setIncidentMessageEdited(true) }}
                  className="min-h-[80px] resize-none text-sm"
                  disabled={loadingAction !== null}
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowIncidentDialog(false)
                setIncidentReason("")
                setIncidentNotes("")
                setIncidentNotifyCustomer(false)
                setIncidentMessageEdited(false)
              }}
              disabled={loadingAction !== null}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleReportIncident}
              disabled={loadingAction !== null || !incidentReason.trim()}
              className="gap-2 bg-red-600 hover:bg-red-700 text-white"
            >
              <AlertTriangle className="h-4 w-4" />
              {loadingAction === "incident" ? "Wird gemeldet …" : "Zwischenfall melden"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reopen dialog */}
      <Dialog open={showReopenDialog} onOpenChange={(value) => { setShowReopenDialog(value); if (!value) setReopenReason("") }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <RotateCcw className="h-5 w-5 text-[#1a2a5e]" />
              Reparatur wieder aufnehmen
            </DialogTitle>
            <DialogDescription>
              Der Auftrag wechselt zurück auf „Reparatur in Bearbeitung“. Die Zeit seit dem Abschluss zählt als Pause.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="reopen-reason" className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
              Grund für die Wiederaufnahme <span className="text-destructive">*</span> <AudienceBadge audience="internal" />
            </Label>
            <Textarea
              id="reopen-reason"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="z. B. Fehler beim Endtest festgestellt"
              className="min-h-[70px] resize-none text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowReopenDialog(false)} disabled={loadingAction !== null}>
              Abbrechen
            </Button>
            <Button onClick={handleReopen} disabled={loadingAction !== null || !reopenReason.trim()} className="gap-2 bg-[#1a2a5e] hover:bg-[#2a3f7e] text-white">
              <RotateCcw className="h-4 w-4" />
              {loadingAction === "reopen" ? "Wird gespeichert …" : "Wieder aufnehmen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </>
  )
}
