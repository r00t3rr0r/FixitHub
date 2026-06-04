import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Trash2, Play, Pause, CheckCircle2, Clock, AlertTriangle,
  FileText, RotateCcw, ChevronRight, Loader2
} from "lucide-react"
import { WorkflowReportModal } from "./WorkflowReportModal"

interface WorkflowCardProps {
  workflow: any
  orderId: string
  onDelete: (workflowId: string) => void
  onStart?: (workflowId: string) => void
  onPause?: (workflowId: string) => void
  onResume?: (workflowId: string) => void
  isDeleting?: boolean
  isActionInProgress?: boolean
  actionInProgressType?: 'start' | 'pause' | 'resume'
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string; bar: string }> = {
  'completed':   { label: 'Abgeschlossen', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
  'in-progress': { label: 'In Bearbeitung', dot: 'bg-[#1a2a5e]',  badge: 'bg-[#1a2a5e]/10 text-[#1a2a5e] border-[#1a2a5e]/20',   bar: 'bg-[#1a2a5e]' },
  'on-hold':     { label: 'Pausiert',       dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 border-amber-200',           bar: 'bg-amber-400' },
  'not-started': { label: 'Ausstehend',     dot: 'bg-slate-300',  badge: 'bg-slate-100 text-slate-600 border-slate-200',          bar: 'bg-slate-300' },
}

const STEP_STATUS_CONFIG: Record<string, { dot: string; icon: string }> = {
  'completed':   { dot: 'bg-emerald-500 ring-2 ring-emerald-200', icon: '✓' },
  'in-progress': { dot: 'bg-[#1a2a5e] ring-2 ring-[#1a2a5e]/30', icon: '●' },
  'skipped':     { dot: 'bg-slate-300 ring-2 ring-slate-100',     icon: '⊘' },
  'pending':     { dot: 'bg-slate-200',                           icon: '' },
}

export function WorkflowCard({
  workflow,
  orderId,
  onDelete,
  onStart,
  onPause,
  onResume,
  isDeleting = false,
  isActionInProgress = false,
  actionInProgressType,
}: WorkflowCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showStartConfirm, setShowStartConfirm] = useState(false)
  const [stepsExpanded, setStepsExpanded] = useState(false)

  const totalSteps = workflow.steps?.length || 0
  const completedSteps = workflow.steps?.filter((s: any) => s.status === 'completed' || s.status === 'skipped').length || 0
  const inProgressStepIndex = workflow.steps?.findIndex((s: any) => s.status === 'in-progress') ?? -1
  const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  const statusCfg = STATUS_CONFIG[workflow.status] ?? STATUS_CONFIG['not-started']
  const estimatedMin = workflow.estimatedCompletionTime ? Math.round(workflow.estimatedCompletionTime) : null

  const handleDelete = () => {
    setShowDeleteConfirm(false)
    onDelete(workflow._id)
  }

  const handleStartConfirmation = () => {
    setShowStartConfirm(false)
    onStart?.(workflow._id)
  }

  const visibleSteps = stepsExpanded ? workflow.steps : workflow.steps?.slice(0, 4)
  const hasMoreSteps = (workflow.steps?.length || 0) > 4

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all overflow-hidden">

        {/* ── Header bar ─────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] px-4 py-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate leading-snug">
              {workflow.workflowName}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[11px] text-blue-200">
                {completedSteps}/{totalSteps} Schritte
              </span>
              {estimatedMin && (
                <span className="text-[11px] text-blue-200 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {estimatedMin} Min.
                </span>
              )}
            </div>
          </div>
          <Badge variant="outline" className={`text-[11px] px-2 py-0.5 shrink-0 font-medium ${statusCfg.badge}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${statusCfg.dot}`} />
            {statusCfg.label}
          </Badge>
        </div>

        {/* ── Progress bar ───────────────────────────────────────── */}
        <div className="h-1.5 bg-slate-100">
          <div
            className={`h-full transition-all ${statusCfg.bar}`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        <div className="px-4 py-3 space-y-3">

          {/* ── Pause notice ───────────────────────────────────────── */}
          {workflow.status === 'on-hold' && workflow.pauseReason && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-800">Pausiert</p>
                <p className="text-xs text-amber-700 mt-0.5">{workflow.pauseReason}</p>
                {workflow.pausedAt && (
                  <p className="text-[11px] text-amber-600 mt-0.5">
                    seit {new Date(workflow.pausedAt).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Step timeline ──────────────────────────────────────── */}
          {workflow.steps && workflow.steps.length > 0 && (
            <div className="space-y-1">
              {(visibleSteps as any[]).map((step: any, index: number) => {
                const stepCfg = STEP_STATUS_CONFIG[step.status] ?? STEP_STATUS_CONFIG['pending']
                const isActive = index === inProgressStepIndex
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                      isActive
                        ? 'bg-[#1a2a5e]/8 border border-[#1a2a5e]/15'
                        : step.status === 'completed'
                          ? 'bg-emerald-50/60'
                          : 'bg-transparent'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${stepCfg.dot}`} />
                    <span className={`flex-1 truncate ${
                      step.status === 'completed' ? 'text-slate-400 line-through' : isActive ? 'font-semibold text-[#1a2a5e]' : 'text-slate-600'
                    }`}>
                      {index + 1}. {step.stepName || step.name}
                    </span>
                    {step.estimatedTime && (
                      <span className="text-slate-400 shrink-0">{step.estimatedTime}m</span>
                    )}
                    {step.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
                    {isActive && <span className="text-[10px] font-semibold text-[#1a2a5e] bg-[#1a2a5e]/10 rounded px-1.5 py-0.5 shrink-0">Aktiv</span>}
                  </div>
                )
              })}

              {hasMoreSteps && (
                <button
                  onClick={() => setStepsExpanded(!stepsExpanded)}
                  className="w-full text-xs text-[#1a2a5e] hover:text-[#2a3f7e] font-medium flex items-center gap-1 px-2.5 py-1 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <ChevronRight className={`h-3 w-3 transition-transform ${stepsExpanded ? 'rotate-90' : ''}`} />
                  {stepsExpanded ? 'Weniger anzeigen' : `+ ${workflow.steps.length - 4} weitere Schritte`}
                </button>
              )}
            </div>
          )}

          {/* ── Action bar ─────────────────────────────────────────── */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">

            {workflow.status === 'not-started' && onStart && (
              <Button
                size="sm"
                onClick={() => setShowStartConfirm(true)}
                disabled={isActionInProgress}
                className="flex-1 h-8 text-xs bg-[#1a2a5e] hover:bg-[#2a3f7e] text-white"
              >
                {isActionInProgress && actionInProgressType === 'start'
                  ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <Play className="h-3.5 w-3.5 mr-1.5" />}
                Workflow starten
              </Button>
            )}

            {workflow.status === 'in-progress' && onPause && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPause(workflow._id)}
                disabled={isActionInProgress}
                className="flex-1 h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                {isActionInProgress && actionInProgressType === 'pause'
                  ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <Pause className="h-3.5 w-3.5 mr-1.5" />}
                Pausieren
              </Button>
            )}

            {workflow.status === 'on-hold' && onResume && (
              <Button
                size="sm"
                onClick={() => onResume(workflow._id)}
                disabled={isActionInProgress}
                className="flex-1 h-8 text-xs bg-[#1a2a5e] hover:bg-[#2a3f7e] text-white"
              >
                {isActionInProgress && actionInProgressType === 'resume'
                  ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
                Fortsetzen
              </Button>
            )}

            {workflow.status === 'completed' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowReportModal(true)}
                className="flex-1 h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Bericht anzeigen
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting || isActionInProgress}
              className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Workflow Report Modal */}
      <WorkflowReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        workflow={workflow}
        orderId={orderId}
      />

      {/* Start Confirmation Dialog */}
      <AlertDialog open={showStartConfirm} onOpenChange={setShowStartConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Workflow starten</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du den Workflow <strong>„{workflow.workflowName}"</strong> starten?
              Der Auftragsstatus wird auf „Reparatur in Bearbeitung" gesetzt und du wirst als verantwortliche Person eingetragen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStartConfirmation}
              disabled={isActionInProgress}
              className="bg-[#1a2a5e] hover:bg-[#2a3f7e] text-white"
            >
              {isActionInProgress && actionInProgressType === 'start' ? 'Starte...' : 'Workflow starten'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Workflow entfernen</AlertDialogTitle>
            <AlertDialogDescription>
              Soll der Workflow <strong>„{workflow.workflowName}"</strong> wirklich von diesem Auftrag entfernt werden?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Wird entfernt...' : 'Entfernen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
