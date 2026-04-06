import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { CheckCircle2, Clock, AlertCircle, ChevronRight, ChevronLeft, Play } from "lucide-react"
import { WorkflowStepExecutionPanel } from "./WorkflowStepExecutionPanel"
import { completeWorkflowStep, skipWorkflowStep } from "@/api/workflow"
import { useToast } from "@/hooks/useToast"

interface WorkflowStep {
  _id: string
  stepName: string
  description?: string
  status: 'completed' | 'in-progress' | 'skipped' | 'pending'
  estimatedTime?: number
  order: number
}

interface WorkflowExecutionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflow: any
  orderId?: string
  workflowId?: string
  onConfirmStart?: () => void
  onConfirmResume?: () => void
  onStepComplete?: () => Promise<void>
  isLoading?: boolean
  mode: 'start' | 'resume' | 'execute' | 'view'
}

export function WorkflowExecutionModal({
  open,
  onOpenChange,
  workflow,
  orderId,
  workflowId,
  onConfirmStart,
  onConfirmResume,
  onStepComplete,
  isLoading = false,
  mode = 'view',
}: WorkflowExecutionModalProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [tab, setTab] = useState<'overview' | 'execute'>('overview')
  const [showPauseReasonDialog, setShowPauseReasonDialog] = useState(false)
  const [pauseReason, setPauseReason] = useState('')
  const [nowTick, setNowTick] = useState(() => Date.now())

  // Auto-set tab to execute when mode changes to execute
  useEffect(() => {
    if (mode === 'execute') {
      setTab('execute')
    }
  }, [mode])

  useEffect(() => {
    if (!workflow) {
      return
    }

    const nextStepIndex = resolveActiveStepIndex(workflow.steps || [], workflow.currentStepIndex)
    setCurrentStepIndex(nextStepIndex)
  }, [workflow?._id, workflow?.currentStepIndex, workflow?.steps])

  if (!workflow) return null

  const normalizeStepStatus = (status?: string) => {
    const normalizedStatus = String(status || '').trim().toLowerCase()
    if (normalizedStatus === 'in_progress') return 'in-progress'
    return normalizedStatus
  }

  const resolveActiveStepIndex = (stepsData: any[], explicitIndex?: number) => {
    if (!Array.isArray(stepsData) || stepsData.length === 0) {
      return 0
    }

    if (Number.isInteger(explicitIndex)) {
      return Math.min(Math.max(Number(explicitIndex), 0), stepsData.length - 1)
    }

    const inProgressIndex = stepsData.findIndex((step: any) => normalizeStepStatus(step?.status) === 'in-progress')
    if (inProgressIndex >= 0) {
      return inProgressIndex
    }

    const firstPendingIndex = stepsData.findIndex((step: any) => normalizeStepStatus(step?.status) === 'pending')
    if (firstPendingIndex >= 0) {
      return firstPendingIndex
    }

    const lastFinishedIndex = [...stepsData].reverse().findIndex((step: any) => {
      const stepStatus = normalizeStepStatus(step?.status)
      return stepStatus === 'completed' || stepStatus === 'skipped'
    })

    return lastFinishedIndex >= 0 ? stepsData.length - 1 - lastFinishedIndex : 0
  }

  useEffect(() => {
    if (!open || workflow?.status !== 'on-hold') {
      return
    }

    const interval = window.setInterval(() => {
      setNowTick(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [open, workflow?.status])

  // Normalize steps to ensure consistent naming (handle both `name` and `stepName`)
  const normalizeSteps = (stepsData: any[]): WorkflowStep[] => {
    return stepsData.map((step: any) => ({
      ...step,
      // Use name if available, otherwise use stepName
      name: step.name || step.stepName || 'Unnamed Step',
      status: normalizeStepStatus(step.status),
    })) as WorkflowStep[]
  }

  const steps: WorkflowStep[] = normalizeSteps(workflow.steps || [])
  const totalSteps = steps.length
  const completedSteps = steps.filter((step: any) => {
    return step.status === 'completed' || step.status === 'skipped'
  }).length
  const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
  const activeStepIndex = resolveActiveStepIndex(steps, workflow.currentStepIndex)
  const activeStep = steps[activeStepIndex] || null

  const currentStep = steps[currentStepIndex] || null
  const nextStep = steps[currentStepIndex + 1] || null
  const canGoNext = currentStepIndex < steps.length - 1
  const canGoPrev = currentStepIndex > 0

  const totalEstimatedTime = steps.reduce((sum: number, step: any) => {
    return sum + (step.estimatedTime || 0)
  }, 0)

  const formatMinutes = (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes < 0) return '0 Min'
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (hours <= 0) return `${remainingMinutes} Min`
    if (remainingMinutes <= 0) return `${hours} Std`
    return `${hours} Std ${remainingMinutes} Min`
  }

  const formatDateTime = (value?: string | Date) => {
    if (!value) return 'Unbekannt'
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return 'Unbekannt'
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const pauseHistory = Array.isArray(workflow.pauseHistory) ? workflow.pauseHistory : []
  const openPauseEntry = [...pauseHistory].reverse().find((entry: any) => !entry?.resumedAt) || null
  const pauseStartedAt = openPauseEntry?.pausedAt || workflow.pausedAt
  const currentPauseDurationMinutes = (() => {
    if (workflow.status !== 'on-hold' || !pauseStartedAt) return 0
    const pauseStartTs = new Date(pauseStartedAt).getTime()
    const nowTs = nowTick
    if (!Number.isFinite(pauseStartTs) || nowTs <= pauseStartTs) return 0
    return Math.round((nowTs - pauseStartTs) / (1000 * 60))
  })()
  const totalPausedMinutes = Number(workflow.totalPausedMinutes || 0)
  const pauseEntries = [...pauseHistory]
    .map((entry: any, index: number) => {
      const pausedAt = entry?.pausedAt ? new Date(entry.pausedAt) : null
      if (!pausedAt || !Number.isFinite(pausedAt.getTime())) {
        return null
      }

      const resumedAt = entry?.resumedAt ? new Date(entry.resumedAt) : null
      const entryIsOpen = !resumedAt || !Number.isFinite(resumedAt.getTime())
      const endTs = entryIsOpen ? nowTick : resumedAt.getTime()
      const durationMinutes = Math.max(0, Math.round((endTs - pausedAt.getTime()) / (1000 * 60)))

      return {
        id: `${index}-${pausedAt.toISOString()}`,
        pausedAt,
        resumedAt: entryIsOpen ? null : resumedAt,
        durationMinutes,
        reason: entry?.reason || workflow.pauseReason || 'Kein Grund angegeben',
        stepName: entry?.stepName || 'Unbekannter Schritt',
        isOpen: entryIsOpen,
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.pausedAt.getTime() - a.pausedAt.getTime())

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-700 border-green-200'
      case 'in-progress':
        return 'bg-blue-500/10 text-blue-700 border-blue-200'
      case 'skipped':
        return 'bg-gray-500/10 text-gray-700 border-gray-200'
      default:
        return 'bg-gray-400/10 text-gray-600 border-gray-200'
    }
  }

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />
      case 'in-progress':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const handleConfirm = () => {
    if (mode === 'start' && onConfirmStart) {
      onConfirmStart()
    } else if (mode === 'resume' && onConfirmResume) {
      onConfirmResume()
    }
    setShowConfirmation(false)
  }

  const handleStepComplete = async (stepData: any) => {
    if (!orderId || !workflowId) {
      toast({
        title: "Error",
        description: "Missing order or workflow information",
        variant: "destructive",
      })
      return
    }

    try {
      const currentStepData = steps[currentStepIndex]
      await completeWorkflowStep(orderId, workflowId, currentStepData._id, stepData)

      if (onStepComplete) {
        onStepComplete()
      }
    } catch (error: any) {
      console.error("Error completing step:", error)
      throw error
    }
  }

  const handleSkipStep = async (reason: string) => {
    if (!orderId || !workflowId) {
      toast({
        title: "Error",
        description: "Missing order or workflow information",
        variant: "destructive",
      })
      return
    }

    try {
      const currentStepData = steps[currentStepIndex]
      await skipWorkflowStep(orderId, workflowId, currentStepData._id, reason)

      if (onStepComplete) {
        onStepComplete()
      }
    } catch (error: any) {
      console.error("Error skipping step:", error)
      throw error
    }
  }

  // Render based on mode
  if (mode === 'execute' && currentStep) {
    return (
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            className="max-w-5xl max-h-[90vh] overflow-y-auto"
            onInteractOutside={(e) => {
              // Prevent closing when clicking outside
              e.preventDefault()
            }}
          >
            <DialogHeader>
              <div className="rounded-xl bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] p-4 md:p-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <DialogTitle
                      className="workflow-execution-title text-2xl text-[#f5b800]"
                      style={{ color: "var(--accent-yellow, #f5b800)" }}
                    >
                      {workflow.workflowName}
                    </DialogTitle>
                    <DialogDescription className="mt-2 text-blue-100">
                      {totalSteps} Steps • {Math.round(totalEstimatedTime)} Minuten Richtzeit
                    </DialogDescription>
                    <div className="mt-3 h-2 w-full rounded-full bg-white/20">
                      <div
                        className="h-2 rounded-full bg-white transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-blue-100">
                      {completedSteps}/{totalSteps} Steps erledigt
                    </p>
                  </div>
                  <Badge variant="outline" className="whitespace-nowrap border-white/30 bg-white text-[#1a2a5e]">
                    Aktiver Step {activeStepIndex + 1}
                  </Badge>
                </div>
              </div>
            </DialogHeader>

            <Tabs value={tab} onValueChange={(value: any) => setTab(value)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Uebersicht
                </TabsTrigger>
                <TabsTrigger value="execute" className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  Schritt ausfuehren
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="space-y-6">
                  {/* Overall Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Workflow-Fortschritt</span>
                      <span className="text-sm text-muted-foreground">
                        {completedSteps}/{totalSteps} Schritte erledigt
                      </span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                  </div>

                  {/* Pause Insights */}
                  <Card className={workflow.status === 'on-hold' ? 'border-amber-300 bg-amber-50' : 'border-blue-100 bg-blue-50/70'}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-800">Pausenstatus</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-slate-700">
                      <p>
                        Gesamt pausiert: <span className="font-semibold text-slate-900">{formatMinutes(totalPausedMinutes)}</span>
                      </p>
                      {workflow.status === 'on-hold' && (
                        <p>
                          Aktuell pausiert seit: <span className="font-semibold text-amber-800">{formatMinutes(currentPauseDurationMinutes)}</span>
                        </p>
                      )}
                      {(workflow.pauseReason || openPauseEntry?.reason) && (
                        <p>
                          Grund: <span className="font-medium">{workflow.pauseReason || openPauseEntry?.reason}</span>
                        </p>
                      )}
                      {(openPauseEntry?.stepName || activeStep?.stepName || currentStep?.stepName) && (
                        <p>
                          Betroffener Schritt: <span className="font-medium">{openPauseEntry?.stepName || activeStep?.stepName || currentStep?.stepName}</span>
                        </p>
                      )}

                      {pauseEntries.length > 0 && (
                        <div className="mt-2 rounded-md border border-slate-200 bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pause-Historie</p>
                          <div className="mt-2 space-y-2 max-h-44 overflow-y-auto pr-1">
                            {pauseEntries.map((entry: any, index: number) => (
                              <div key={entry.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-slate-700">Pause #{pauseEntries.length - index}</p>
                                  <Badge
                                    variant="outline"
                                    className={entry.isOpen ? 'border-amber-300 bg-amber-100 text-amber-800' : 'border-slate-300 bg-white text-slate-700'}
                                  >
                                    {entry.isOpen ? 'Laufend' : 'Abgeschlossen'}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-xs text-slate-600">Start: {formatDateTime(entry.pausedAt)}</p>
                                <p className="text-xs text-slate-600">Ende: {entry.resumedAt ? formatDateTime(entry.resumedAt) : 'Noch pausiert'}</p>
                                <p className="text-xs text-slate-600">Dauer: <span className="font-semibold text-slate-800">{formatMinutes(entry.durationMinutes)}</span></p>
                                <p className="text-xs text-slate-600">Schritt: {entry.stepName}</p>
                                <p className="text-xs text-slate-600">Grund: {entry.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Current Step Preview */}
                  {currentStep && (
                    <Card className="border-gray-200 bg-white shadow-sm">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <CardTitle className="text-lg">
                              Schritt {currentStepIndex + 1}: {currentStep.stepName}
                            </CardTitle>
                            <CardDescription className="mt-2">
                              {currentStep.description || 'Keine Beschreibung vorhanden'}
                            </CardDescription>
                          </div>
                          <Badge
                            variant="outline"
                            className={`flex items-center gap-1 whitespace-nowrap ${getStepStatusColor(
                              currentStep.status
                            )}`}
                          >
                            {getStepStatusIcon(currentStep.status)}
                            <span className="capitalize">{currentStep.status}</span>
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {currentStep.estimatedTime && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>Richtzeit: {currentStep.estimatedTime} Minuten</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Guided Flow */}
                  <div className="grid gap-3 md:grid-cols-2">
                    <Card className="border-blue-100 bg-blue-50/70">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-[#1a2a5e]">Jetzt bearbeiten</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-slate-700">
                        <p className="font-medium text-slate-900">
                          Schritt {currentStepIndex + 1}: {currentStep?.stepName || 'Kein Schritt gewaehlt'}
                        </p>
                        <p className="mt-1">Pruefe die Eingaben und arbeite danach den Step gezielt ab.</p>
                      </CardContent>
                    </Card>

                    <Card className="border-emerald-100 bg-emerald-50/70">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-emerald-700">Als Naechstes</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-slate-700">
                        <p className="font-medium text-slate-900">
                          {nextStep ? `Schritt ${currentStepIndex + 2}: ${nextStep.stepName}` : 'Letzter Schritt im Workflow'}
                        </p>
                        <p className="mt-1">
                          {nextStep
                            ? 'Nach Abschluss springt der Workflow automatisch zum naechsten Schritt.'
                            : 'Nach Abschluss dieses Steps wird der Workflow abgeschlossen.'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* All Steps List */}
                  <div className="space-y-3">
                    <h3 className="font-medium">Alle Schritte</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {steps.map((step: any, index: number) => (
                        <button
                          key={step._id}
                          onClick={() => setCurrentStepIndex(index)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            currentStepIndex === index
                              ? 'border-[#1a2a5e] bg-white ring-2 ring-[#1a2a5e]/15'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-3 w-3 rounded-full flex-shrink-0 ${
                                step.status === 'completed'
                                  ? 'bg-green-500'
                                  : step.status === 'in-progress'
                                    ? 'bg-blue-500'
                                    : step.status === 'skipped'
                                      ? 'bg-gray-400'
                                      : 'bg-gray-300'
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-sm font-medium truncate">
                                {index + 1}. {step.name}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                              {step.status === 'completed' && '✓'}
                              {step.status === 'in-progress' && '⟳'}
                              {step.status === 'skipped' && '⊘'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="execute" className="mt-4">
                {currentStep && (
                  <WorkflowStepExecutionPanel
                    step={currentStep}
                    steps={steps}
                    currentStepIndex={currentStepIndex}
                    onStepChange={setCurrentStepIndex}
                    onStepComplete={handleStepComplete}
                    onStepSkip={handleSkipStep}
                    isLoading={isLoading}
                    workflowStatus={workflow.status}
                    workflowPauseReason={workflow.pauseReason}
                  />
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  if (workflow.status === 'in-progress') {
                    setShowPauseReasonDialog(true)
                  } else {
                    onOpenChange(false)
                  }
                }}
                disabled={isLoading}
              >
                Schliessen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Pause Reason Dialog - for Execute Mode */}
        <AlertDialog open={showPauseReasonDialog} onOpenChange={setShowPauseReasonDialog}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Workflow pausieren</AlertDialogTitle>
              <AlertDialogDescription>
                Bitte gib einen Grund fuer die Pausierung des Workflows "{workflow.workflowName}" an. Der Grund wird in den Auftragsdetails gespeichert.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="pause-reason" className="text-sm font-medium">
                  Grund der Pausierung <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="pause-reason"
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  placeholder="Grund eingeben (z. B. fehlende Teile, Rueckfrage beim Kunden usw.)"
                  className="w-full min-h-24 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {!pauseReason.trim() && (
                  <p className="text-sm text-destructive">Bitte gib einen Grund an</p>
                )}
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setPauseReason('')
                }}
                disabled={isLoading}
              >
                Abbrechen
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!pauseReason.trim()) {
                    toast({
                      variant: "destructive",
                      title: "Fehler",
                      description: "Bitte gib einen Grund fuer die Pausierung an"
                    })
                    return
                  }

                  try {
                    setShowPauseReasonDialog(false)
                    // Call the API to pause workflow with reason
                    const { updateWorkflowStatus } = await import('@/api/workflow')
                    await updateWorkflowStatus(orderId || '', workflowId || '', 'on-hold', pauseReason)

                    toast({
                      title: "Erfolg",
                      description: `Workflow pausiert. Auftragsstatus auf "pending" gesetzt. Grund: ${pauseReason}`
                    })

                    setPauseReason('')
                    onOpenChange(false)

                    // Trigger refresh of order data
                    if (onStepComplete) {
                      await onStepComplete()
                    }
                  } catch (error: any) {
                    console.error("Error pausing workflow:", error)
                    toast({
                      variant: "destructive",
                      title: "Fehler",
                      description: error.message || "Workflow konnte nicht pausiert werden"
                    })
                  }
                }}
                disabled={isLoading || !pauseReason.trim()}
              >
                {isLoading ? 'Pausiere...' : 'Workflow pausieren'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  // Standard overview/start/resume mode
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => {
            // Prevent closing when clicking outside
            e.preventDefault()
          }}
        >
          <DialogHeader>
            <div className="rounded-xl bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] p-4 md:p-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <DialogTitle
                    className="workflow-execution-title text-2xl text-[#f5b800]"
                    style={{ color: "var(--accent-yellow, #f5b800)" }}
                  >
                    {workflow.workflowName}
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-blue-100">
                    {totalSteps} Steps • {Math.round(totalEstimatedTime)} Minuten Richtzeit
                  </DialogDescription>
                  <div className="mt-3 h-2 w-full rounded-full bg-white/20">
                    <div
                      className="h-2 rounded-full bg-white transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-blue-100">
                    {completedSteps}/{totalSteps} Steps erledigt
                  </p>
                </div>
                <Badge variant="outline" className="whitespace-nowrap border-white/30 bg-white text-[#1a2a5e]">
                  {mode === 'start' && 'Bereit zum Start'}
                  {mode === 'resume' && 'Bereit zum Fortsetzen'}
                  {mode === 'view' && 'Workflow Uebersicht'}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Gesamtfortschritt</span>
                <span className="text-sm text-muted-foreground">
                  {completedSteps}/{totalSteps} Schritte erledigt
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            {/* Pause Insights */}
            <Card className={workflow.status === 'on-hold' ? 'border-amber-300 bg-amber-50' : 'border-blue-100 bg-blue-50/70'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-800">Pausenstatus</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p>
                  Gesamt pausiert: <span className="font-semibold text-slate-900">{formatMinutes(totalPausedMinutes)}</span>
                </p>
                {workflow.status === 'on-hold' && (
                  <p>
                    Aktuell pausiert seit: <span className="font-semibold text-amber-800">{formatMinutes(currentPauseDurationMinutes)}</span>
                  </p>
                )}
                {(workflow.pauseReason || openPauseEntry?.reason) && (
                  <p>
                    Grund: <span className="font-medium">{workflow.pauseReason || openPauseEntry?.reason}</span>
                  </p>
                )}
                {(openPauseEntry?.stepName || currentStep?.stepName) && (
                  <p>
                    Betroffener Schritt: <span className="font-medium">{openPauseEntry?.stepName || currentStep?.stepName}</span>
                  </p>
                )}

                {pauseEntries.length > 0 && (
                  <div className="mt-2 rounded-md border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pause-Historie</p>
                    <div className="mt-2 space-y-2 max-h-44 overflow-y-auto pr-1">
                      {pauseEntries.map((entry: any, index: number) => (
                        <div key={entry.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-700">Pause #{pauseEntries.length - index}</p>
                            <Badge
                              variant="outline"
                              className={entry.isOpen ? 'border-amber-300 bg-amber-100 text-amber-800' : 'border-slate-300 bg-white text-slate-700'}
                            >
                              {entry.isOpen ? 'Laufend' : 'Abgeschlossen'}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">Start: {formatDateTime(entry.pausedAt)}</p>
                          <p className="text-xs text-slate-600">Ende: {entry.resumedAt ? formatDateTime(entry.resumedAt) : 'Noch pausiert'}</p>
                          <p className="text-xs text-slate-600">Dauer: <span className="font-semibold text-slate-800">{formatMinutes(entry.durationMinutes)}</span></p>
                          <p className="text-xs text-slate-600">Schritt: {entry.stepName}</p>
                          <p className="text-xs text-slate-600">Grund: {entry.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Current Step Display */}
            {currentStep && (
              <Card className="border-gray-200 bg-white shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        Schritt {currentStepIndex + 1}: {currentStep.stepName}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {currentStep.description || 'Keine Beschreibung vorhanden'}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={`flex items-center gap-1 whitespace-nowrap ${getStepStatusColor(
                        currentStep.status
                      )}`}
                    >
                      {getStepStatusIcon(currentStep.status)}
                      <span className="capitalize">{currentStep.status}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentStep.estimatedTime && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Richtzeit: {currentStep.estimatedTime} Minuten</span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Dieser Schritt erfordert sorgfaeltiges Arbeiten. Folge den Hinweisen und stelle sicher, dass alle Qualitaetspruefungen abgeschlossen sind.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Steps Overview */}
            <div className="space-y-3">
              <h3 className="font-medium">Alle Schritte</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {steps.map((step: any, index: number) => (
                  <button
                    key={step._id}
                    onClick={() => setCurrentStepIndex(index)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      currentStepIndex === index
                        ? 'border-[#1a2a5e] bg-white ring-2 ring-[#1a2a5e]/15'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-3 w-3 rounded-full flex-shrink-0 ${
                          step.status === 'completed'
                            ? 'bg-green-500'
                            : step.status === 'in-progress'
                              ? 'bg-blue-500'
                              : step.status === 'skipped'
                                ? 'bg-gray-400'
                                : 'bg-gray-300'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-sm font-medium truncate">
                          {index + 1}. {step.name}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {step.status === 'completed' && '✓'}
                        {step.status === 'in-progress' && '⟳'}
                        {step.status === 'skipped' && '⊘'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Key Guidelines */}
            <Card className="bg-amber-50 border-amber-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Wichtige Hinweise
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2 text-amber-900">
                <ul className="list-disc list-inside space-y-1">
                  <li>Bearbeite die Schritte in der angegebenen Reihenfolge</li>
                  <li>Pruefe die Schrittdetails, bevor du fortfaehrst</li>
                  <li>Du kannst den Workflow bei Bedarf jederzeit pausieren</li>
                  <li>Schritte nur im Ausnahmefall ueberspringen</li>
                  <li>Dokumentiere Auffaelligkeiten fuer die Qualitaetssicherung</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => {
                // Show pause dialog only in execute mode when actively working on workflow
                console.log('Close button clicked - workflow status:', workflow?.status, 'mode:', mode, 'tab:', tab)
                if (mode === 'execute' && tab === 'execute') {
                  console.log('Showing pause reason dialog')
                  setShowPauseReasonDialog(true)
                } else {
                  console.log('Closing modal directly')
                  onOpenChange(false)
                }
              }}
              disabled={isLoading}
            >
              {mode === 'view' ? 'Schliessen' : 'Abbrechen'}
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
                disabled={!canGoPrev}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center px-2 text-sm text-muted-foreground">
                {currentStepIndex + 1} / {totalSteps}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStepIndex(Math.min(steps.length - 1, currentStepIndex + 1))}
                disabled={!canGoNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {mode !== 'view' && (
              <Button
                onClick={() => setShowConfirmation(true)}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Lade...' : mode === 'start' ? 'Bestaetigen & Starten' : 'Bestaetigen & Fortsetzen'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {mode === 'start' ? 'Workflow starten?' : 'Workflow fortsetzen?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {mode === 'start'
                ? `Du bist dabei, "${workflow.workflowName}" zu starten. Dieser Workflow hat ${totalSteps} Schritte und dauert voraussichtlich ca. ${Math.round(totalEstimatedTime)} Minuten.`
                : `Du bist dabei, "${workflow.workflowName}" fortzusetzen. Der Workflow laeuft ab der letzten Pausenstelle weiter.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? 'Verarbeite...' : mode === 'start' ? 'Workflow starten' : 'Workflow fortsetzen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  )
}
