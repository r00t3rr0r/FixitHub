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
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
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
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Hash,
  Info,
  MessageSquarePlus,
  Pause,
  Play,
  Smartphone,
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

export function RepairWorkflowProcessDialog({
  open,
  onOpenChange,
  orderId,
  workflow,
  order,
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

  // Live timer tick for in-progress and incident states
  useEffect(() => {
    if (!open) return
    if (!workflow || (workflow.status !== "in-progress" && workflow.status !== "incident")) return
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
    if (workflow.status === "paused" && workflow?.timerData?.pausedAt) {
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
      })
      applyUpdate((response as any)?.data?.workflow, "Zwischenfall wurde gemeldet.")
      setIncidentReason("")
      setIncidentNotes("")
      setActiveSection("incidents")
    } catch (error: any) {
      toast({ title: "Fehler", description: error?.message || "Zwischenfall konnte nicht gemeldet werden", variant: "destructive" })
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
      <Dialog open={open} onOpenChange={onOpenChange}>
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
                  onClick={() => onOpenChange(false)}
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
                          Der Workflow wartet auf Ihre Freigabe. Nach dem Start beginnt die Zeiterfassung automatisch.
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="repair-internal-notes" className="text-xs font-medium text-slate-700">
                            Interne Notizen <span className="text-slate-400 font-normal">(optional)</span>
                          </Label>
                          <Textarea
                            id="repair-internal-notes"
                            value={internalNotes}
                            onChange={(e) => setInternalNotes(e.target.value)}
                            placeholder="Hinweise zum Reparaturstart, besondere Anforderungen …"
                            className="min-h-[80px] resize-none text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2.5">
                          <Checkbox
                            id="notify-customer"
                            checked={notifyCustomer}
                            onCheckedChange={(v) => setNotifyCustomer(Boolean(v))}
                          />
                          <Label htmlFor="notify-customer" className="text-sm cursor-pointer">
                            Kunde über den Reparaturstart benachrichtigen
                          </Label>
                        </div>
                        <Separator />
                        <div className="flex justify-end">
                          <Button
                            onClick={handleApprove}
                            disabled={loadingAction !== null}
                            className="gap-2 bg-[#1a2a5e] hover:bg-[#2a3f7e] text-white"
                          >
                            <Play className="h-4 w-4" />
                            {loadingAction === "approve" ? "Wird gestartet …" : "Workflow jetzt starten"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* In-progress: Pause + Complete */}
                  {status === "in-progress" && (
                    <>
                      <Card className="border-blue-200 bg-blue-50/60 shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-900">
                            <Pause className="h-4 w-4" />
                            Workflow pausieren
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="pause-reason-input" className="text-xs font-medium text-slate-700">
                              Pausengrund <span className="text-slate-400 font-normal">(optional)</span>
                            </Label>
                            <Input
                              id="pause-reason-input"
                              value={pauseReason}
                              onChange={(e) => setPauseReason(e.target.value)}
                              placeholder="z. B. fehlende Ersatzteile, Kundenkontakt …"
                              className="text-sm"
                            />
                          </div>
                          <Button
                            variant="outline"
                            onClick={handlePause}
                            disabled={loadingAction !== null}
                            className="gap-2 border-blue-300 text-blue-800 hover:bg-blue-100"
                          >
                            <Pause className="h-4 w-4" />
                            {loadingAction === "pause" ? "Wird pausiert …" : "Workflow pausieren"}
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            Reparatur abschliessen
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-slate-600">
                            Alle Reparaturarbeiten wurden erfolgreich abgeschlossen. Diese Aktion beendet die Zeiterfassung.
                          </p>
                          <Button
                            onClick={() => setShowCompleteConfirm(true)}
                            disabled={loadingAction !== null}
                            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Reparatur abschliessen
                          </Button>
                        </CardContent>
                      </Card>
                    </>
                  )}

                  {/* Paused: Resume */}
                  {status === "paused" && (
                    <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-900">
                          <Play className="h-4 w-4" />
                          Workflow fortsetzen
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-amber-800">
                          Der Workflow ist aktuell pausiert. Klicke auf „Fortsetzen", um die Zeiterfassung fortzuführen.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={handleResume}
                            disabled={loadingAction !== null}
                            className="gap-2 bg-[#1a2a5e] hover:bg-[#2a3f7e] text-white"
                          >
                            <Play className="h-4 w-4" />
                            {loadingAction === "resume" ? "Wird fortgesetzt …" : "Workflow fortsetzen"}
                          </Button>
                          <Button
                            onClick={() => setShowCompleteConfirm(true)}
                            disabled={loadingAction !== null}
                            variant="outline"
                            className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Abschliessen
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Incident status: Resume */}
                  {status === "incident" && (
                    <Card className="border-red-200 bg-red-50/60 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-900">
                          <AlertTriangle className="h-4 w-4" />
                          Zwischenfall aktiv
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-red-700">
                          Der Workflow befindet sich im Zwischenfall-Modus. Löse das Problem und setze den Workflow fort.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={handleResume}
                            disabled={loadingAction !== null}
                            className="gap-2 bg-[#1a2a5e] hover:bg-[#2a3f7e] text-white"
                          >
                            <Play className="h-4 w-4" />
                            {loadingAction === "resume" ? "Wird fortgesetzt …" : "Workflow fortsetzen"}
                          </Button>
                          <Button
                            onClick={() => setShowCompleteConfirm(true)}
                            disabled={loadingAction !== null}
                            variant="outline"
                            className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Abschliessen
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
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

                  {/* Incident reporting — visible when actionable and past pending */}
                  {isActionable && status !== "pending-confirmation" && (
                    <Card className="border-slate-200 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                          <MessageSquarePlus className="h-4 w-4 text-red-500" />
                          Zwischenfall melden
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-700">Typ</Label>
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
                            <Label className="text-xs font-medium text-slate-700">
                              Kurzbeschreibung <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              value={incidentReason}
                              onChange={(e) => setIncidentReason(e.target.value)}
                              placeholder="Was ist passiert?"
                              className="text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-700">
                            Zusatznotizen <span className="text-slate-400 font-normal">(optional)</span>
                          </Label>
                          <Textarea
                            value={incidentNotes}
                            onChange={(e) => setIncidentNotes(e.target.value)}
                            placeholder="Weitere Details zum Zwischenfall …"
                            className="min-h-[60px] resize-none text-sm"
                          />
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleReportIncident}
                          disabled={loadingAction !== null || !incidentReason.trim()}
                          className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
                        >
                          <AlertTriangle className="h-4 w-4" />
                          {loadingAction === "incident" ? "Wird gemeldet …" : "Zwischenfall melden"}
                        </Button>
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
    </>
  )
}
