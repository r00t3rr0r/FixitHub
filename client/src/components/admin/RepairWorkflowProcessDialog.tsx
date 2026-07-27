import { useEffect, useMemo, useState } from "react"
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
import {
  approveRepairStart,
  completeRepair,
  pauseRepair,
  reportIncident,
  resumeRepair,
} from "@/api/repairWorkflow"
import { CorrectionModal } from "@/components/repair/CorrectionModal"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit3,
  Hash,
  Info,
  MessageSquarePlus,
  Pause,
  Play,
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
}: RepairWorkflowProcessDialogProps) {
  const { toast } = useToast()

  const [loadingAction, setLoadingAction] = useState<"approve" | "pause" | "resume" | "complete" | "incident" | null>(null)
  const [ticker, setTicker] = useState(() => Date.now())
  const [activeSection, setActiveSection] = useState<SidebarSection>("actions")

  // Approve form
  const [internalNotes, setInternalNotes] = useState("")
  const [notifyCustomer, setNotifyCustomer] = useState(false)

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
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [closeReason, setCloseReason] = useState("")

  // Incident: notify customer
  const [incidentNotifyCustomer, setIncidentNotifyCustomer] = useState(false)

  // Sync form from workflow
  useEffect(() => {
    if (!workflow || !open) return
    setInternalNotes(workflow?.approvalData?.internalNotes || "")
    setNotifyCustomer(Boolean(workflow?.approvalData?.notifyCustomer))
  }, [workflow?._id, open])

  // Navigate to actions on open/workflow change
  useEffect(() => {
    if (open) setActiveSection("actions")
  }, [open, workflow?._id])

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
  const incidents: any[] = Array.isArray(workflow.incidents) ? workflow.incidents : []
  const incidentCount = incidents.length
  const totalPausedMs = Number(workflow?.timerData?.totalPausedMs || 0)
  const pauseHistory: any[] = Array.isArray(workflow?.timerData?.pauseHistory) ? workflow.timerData.pauseHistory : []

  const technicianName =
    workflow?.approvalData?.approvedByTechnicianName ||
    order?.assignedStaff?.[0]?.name ||
    order?.assignedStaff?.[0]?.email ||
    "Nicht zugewiesen"

  const deviceLabel = [order?.deviceBrand, order?.deviceModel].filter(Boolean).join(" ") || "—"
  const isCompleted = status === "completed"
  const isActionable = !isCompleted

  // ── Action helpers ────────────────────────────────────────────────────────

  const applyUpdate = (nextWorkflow: any, successMessage: string) => {
    if (nextWorkflow) onWorkflowUpdated?.(nextWorkflow)
    toast({ title: "Erfolg", description: successMessage })
  }

  const handleApprove = async () => {
    try {
      setLoadingAction("approve")
      const response = await approveRepairStart(orderId, internalNotes, "", notifyCustomer)
      applyUpdate((response as any)?.data?.workflow, "Reparatur-Workflow wurde gestartet.")
    } catch (error: any) {
      toast({ title: "Fehler", description: error?.message || "Workflow konnte nicht gestartet werden", variant: "destructive" })
    } finally {
      setLoadingAction(null)
    }
  }

  const handlePause = async () => {
    try {
      setLoadingAction("pause")
      const response = await pauseRepair(orderId, pauseReason.trim() || undefined)
      applyUpdate((response as any)?.data?.workflow, "Workflow wurde pausiert.")
      setPauseReason("")
      setShowPauseDialog(false)
    } catch (error: any) {
      toast({ title: "Fehler", description: error?.message || "Workflow konnte nicht pausiert werden", variant: "destructive" })
    } finally {
      setLoadingAction(null)
    }
  }

  const handleResume = async () => {
    try {
      setLoadingAction("resume")
      const response = await resumeRepair(orderId)
      applyUpdate((response as any)?.data?.workflow, "Workflow wurde fortgesetzt.")
    } catch (error: any) {
      toast({ title: "Fehler", description: error?.message || "Workflow konnte nicht fortgesetzt werden", variant: "destructive" })
    } finally {
      setLoadingAction(null)
    }
  }

  const handleComplete = async () => {
    try {
      setLoadingAction("complete")
      const response = await completeRepair(orderId)
      applyUpdate((response as any)?.data?.workflow, "Workflow wurde erfolgreich abgeschlossen.")
      setShowCompleteConfirm(false)
    } catch (error: any) {
      toast({ title: "Fehler", description: error?.message || "Workflow konnte nicht abgeschlossen werden", variant: "destructive" })
    } finally {
      setLoadingAction(null)
    }
  }

  const handleReportIncident = async () => {
    if (!incidentReason.trim()) {
      toast({ title: "Hinweis", description: "Bitte gib einen Grund für den Zwischenfall an.", variant: "destructive" })
      return
    }
    try {
      setLoadingAction("incident")
      const response = await reportIncident(orderId, incidentType, incidentReason.trim(), {
        notes: incidentNotes.trim() || undefined,
        notifyCustomer: incidentNotifyCustomer,
      })
      applyUpdate((response as any)?.data?.workflow, "Zwischenfall wurde gemeldet.")
      setIncidentReason("")
      setIncidentNotes("")
      setIncidentNotifyCustomer(false)
      setShowIncidentDialog(false)
      setActiveSection("incidents")
    } catch (error: any) {
      toast({ title: "Fehler", description: error?.message || "Zwischenfall konnte nicht gemeldet werden", variant: "destructive" })
    } finally {
      setLoadingAction(null)
    }
  }

  const handleCloseDialog = () => {
    if (status === "in-progress") {
      setShowCloseConfirm(true)
    } else {
      onOpenChange(false)
    }
  }

  const handleCloseWithPause = async () => {
    if (!closeReason.trim()) return
    try {
      setLoadingAction("pause")
      const response = await pauseRepair(orderId, closeReason.trim())
      applyUpdate((response as any)?.data?.workflow, "Workflow pausiert & Dialog geschlossen.")
      setCloseReason("")
      setShowCloseConfirm(false)
      onOpenChange(false)
    } catch (error: any) {
      toast({ title: "Fehler", description: error?.message || "Workflow konnte nicht pausiert werden", variant: "destructive" })
    } finally {
      setLoadingAction(null)
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

                {/* Status badge */}
                <div className="flex-shrink-0 pt-0.5">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusUI.badgeClass}`}>
                    <span className={`h-2 w-2 rounded-full ${statusUI.dotColor}`} />
                    {statusUI.label}
                  </span>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* ── Body: sidebar + main ── */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* Left sidebar */}
            <div className="w-48 flex-shrink-0 border-r border-gray-100 bg-gray-50 flex flex-col overflow-hidden">
              {/* Info summary */}
              <div className="px-3 py-3 space-y-2 border-b border-gray-100 bg-white">
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
              <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
                <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Navigation
                </p>
                {NAV_ITEMS.map((item) => {
                  const isActive = activeSection === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full text-left rounded-lg px-2.5 py-2 flex items-center gap-2 transition-all text-sm ${
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
              <div className="flex-shrink-0 border-t border-gray-100 p-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs gap-1.5"
                  onClick={handleCloseDialog}
                  disabled={loadingAction !== null}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Schliessen
                </Button>
              </div>
            </div>

            {/* ── Main content ── */}
            <div className="flex-1 min-w-0 overflow-y-auto bg-slate-50/40">

              {/* ACTIONS */}
              {activeSection === "actions" && (
                <div className="p-5 space-y-4">

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

                              {/* Repair assessment */}
                              {(inspection.isRepairable !== undefined || inspection.repairOffer) && (
                                <div className={`rounded-md border px-3 py-2 ${
                                  inspection.isRepairable === true
                                    ? "border-emerald-200 bg-emerald-50"
                                    : inspection.isRepairable === false
                                      ? "border-red-200 bg-red-50"
                                      : "border-slate-200 bg-slate-50"
                                }`}>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-semibold ${
                                      inspection.isRepairable === true ? "text-emerald-700" : inspection.isRepairable === false ? "text-red-700" : "text-slate-600"
                                    }`}>
                                      {inspection.isRepairable === true ? "✓ Reparierbar" : inspection.isRepairable === false ? "✗ Nicht reparierbar" : "Bewertung ausstehend"}
                                    </span>
                                    {inspection.repairOffer?.cost != null && (
                                      <span className="ml-auto text-xs font-bold text-slate-800">
                                        {Number(inspection.repairOffer.cost).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                                      </span>
                                    )}
                                  </div>
                                  {inspection.repairOffer?.timeframe && (
                                    <p className="mt-0.5 text-xs text-slate-600">Zeitrahmen: {inspection.repairOffer.timeframe}</p>
                                  )}
                                  {inspection.repairOffer?.description && (
                                    <p className="mt-0.5 text-xs text-slate-600">{inspection.repairOffer.description}</p>
                                  )}
                                </div>
                              )}

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

                        {/* Two primary actions */}
                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            onClick={() => setShowCorrectionModal(true)}
                            disabled={loadingAction !== null}
                            className="flex-1 gap-2 border-[#1a2a5e]/20 text-[#1a2a5e] hover:bg-[#1a2a5e]/05 font-semibold"
                          >
                            <Edit3 className="h-4 w-4" />
                            Korrigieren
                          </Button>
                          <Button
                            onClick={handleApprove}
                            disabled={loadingAction !== null}
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
                            disabled={loadingAction !== null}
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
                            disabled={loadingAction !== null}
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

                        {/* Workflow pausieren */}
                        <button
                          onClick={() => setShowPauseDialog(true)}
                          disabled={loadingAction !== null || status === "paused"}
                          className="flex items-center gap-4 rounded-xl border border-blue-200 bg-white p-4 text-left transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100">
                            <Pause className="h-5 w-5 text-blue-700" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">Workflow pausieren</p>
                            <p className="text-xs text-slate-500 mt-0.5">Zeiterfassung unterbrechen, z. B. bei Wartezeit auf Ersatzteile oder Kundenkontakt</p>
                          </div>
                        </button>

                        {/* Zwischenfall melden */}
                        <button
                          onClick={() => setShowIncidentDialog(true)}
                          disabled={loadingAction !== null}
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
                          disabled={loadingAction !== null}
                          className="flex items-center gap-4 rounded-xl border border-emerald-200 bg-white p-4 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">Reparatur abschliessen</p>
                            <p className="text-xs text-slate-500 mt-0.5">Alle Arbeiten abgeschlossen — beendet die Zeiterfassung und schliesst den Workflow</p>
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
                              <p className="text-sm font-semibold text-red-800 capitalize">
                                {String(incident.type || "").replace(/_/g, " ")}
                              </p>
                            </div>
                            <p className="text-xs text-slate-500 flex-shrink-0">{formatDateTime(incident.timestamp)}</p>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">{incident.reason || "Kein Grund angegeben"}</p>
                          {incident.notes && (
                            <p className="mt-1 text-xs text-slate-500 border-t border-slate-100 pt-1.5">{incident.notes}</p>
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
                            <p className="text-xs text-slate-400 mb-0.5">Interne Notizen</p>
                            <p className="text-slate-700 text-sm bg-slate-50 rounded-md p-2 border border-slate-200">
                              {workflow.approvalData.internalNotes}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">Kunde benachrichtigt</p>
                          <p className="font-medium text-slate-900">
                            {workflow.approvalData.notifyCustomer ? "Ja" : "Nein"}
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
            <AlertDialogTitle>Reparatur abschliessen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion beendet die Zeiterfassung und markiert den Reparatur-Workflow als abgeschlossen. Sie kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingAction !== null}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleComplete}
              disabled={loadingAction !== null}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loadingAction === "complete" ? "Wird abgeschlossen …" : "Ja, abschliessen"}
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
              <Label htmlFor="pause-reason-dialog" className="text-sm font-medium text-slate-700">
                Pausengrund <span className="text-destructive">*</span>
              </Label>
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
              <Label className="text-sm font-medium text-slate-700">
                Kurzbeschreibung <span className="text-destructive">*</span>
              </Label>
              <Input
                value={incidentReason}
                onChange={(e) => setIncidentReason(e.target.value)}
                placeholder="Was ist passiert?"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">
                Zusatznotizen <span className="text-slate-400 font-normal">(optional)</span>
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
                  <p className="text-sm font-medium text-slate-800">Kunde informieren?</p>
                  <p className="text-[11px] text-slate-500">Automatische Benachrichtigung über den Zwischenfall</p>
                </div>
              </div>
              <Switch
                checked={incidentNotifyCustomer}
                onCheckedChange={setIncidentNotifyCustomer}
                disabled={loadingAction !== null}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowIncidentDialog(false)
                setIncidentReason("")
                setIncidentNotes("")
                setIncidentNotifyCustomer(false)
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

      {/* Close confirm — pause workflow before leaving */}
      <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Pause className="h-5 w-5 text-amber-600" />
              Workflow pausieren & schliessen
            </DialogTitle>
            <DialogDescription>
              Der Workflow wird automatisch pausiert, wenn Sie den Dialog verlassen. Bitte geben Sie einen Grund an.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="close-reason" className="text-sm font-medium text-slate-700">
                Pausengrund <span className="text-destructive">*</span>
              </Label>
              <Input
                id="close-reason"
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                placeholder="z. B. Mittagspause, anderer Auftrag …"
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCloseConfirm(false)} disabled={loadingAction !== null}>
              Abbrechen
            </Button>
            <Button
              onClick={handleCloseWithPause}
              disabled={loadingAction !== null || !closeReason.trim()}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Pause className="h-4 w-4" />
              {loadingAction === "pause" ? "Wird pausiert …" : "Pausieren & Schliessen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
