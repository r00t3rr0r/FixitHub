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

  // Auto-set tab to execute when mode changes to execute
  useEffect(() => {
    if (mode === 'execute') {
      setTab('execute')
    }
  }, [mode])

  if (!workflow) return null

  const steps: WorkflowStep[] = workflow.steps || []
  const totalSteps = steps.length
  const completedSteps = steps.filter((s: any) => s.status === 'completed').length
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0

  const currentStep = steps[currentStepIndex] || null
  const canGoNext = currentStepIndex < steps.length - 1
  const canGoPrev = currentStepIndex > 0

  const totalEstimatedTime = steps.reduce((sum: number, step: any) => {
    return sum + (step.estimatedTime || 0)
  }, 0)

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
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <DialogTitle className="text-2xl">{workflow.workflowName}</DialogTitle>
                  <DialogDescription className="mt-2">
                    {totalSteps} steps • {Math.round(totalEstimatedTime)} minutes estimated
                  </DialogDescription>
                </div>
                <Badge variant="outline" className="whitespace-nowrap">
                  Executing Step {currentStepIndex + 1}
                </Badge>
              </div>
            </DialogHeader>

            <Tabs value={tab} onValueChange={(value: any) => setTab(value)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="execute" className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  Execute Step
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="space-y-6">
                  {/* Overall Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Workflow Progress</span>
                      <span className="text-sm text-muted-foreground">
                        {completedSteps}/{totalSteps} steps completed
                      </span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                  </div>

                  {/* Current Step Preview */}
                  {currentStep && (
                    <Card className="border-blue-200 bg-blue-50/50">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <CardTitle className="text-lg">
                              Step {currentStepIndex + 1}: {currentStep.stepName}
                            </CardTitle>
                            <CardDescription className="mt-2">
                              {currentStep.description || 'No description provided'}
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
                            <span>Estimated time: {currentStep.estimatedTime} minutes</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* All Steps List */}
                  <div className="space-y-3">
                    <h3 className="font-medium">All Steps</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {steps.map((step: any, index: number) => (
                        <button
                          key={step._id}
                          onClick={() => setCurrentStepIndex(index)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            currentStepIndex === index
                              ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-300'
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
                                {index + 1}. {step.stepName}
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
                  />
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // Standard overview/start/resume mode
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-2xl">{workflow.workflowName}</DialogTitle>
                <DialogDescription className="mt-2">
                  {totalSteps} steps • {Math.round(totalEstimatedTime)} minutes estimated
                </DialogDescription>
              </div>
              <Badge variant="outline" className="whitespace-nowrap">
                {mode === 'start' && 'Ready to Start'}
                {mode === 'resume' && 'Ready to Resume'}
                {mode === 'view' && 'Workflow Details'}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Overall Progress</span>
                <span className="text-sm text-muted-foreground">
                  {completedSteps}/{totalSteps} steps completed
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            {/* Current Step Display */}
            {currentStep && (
              <Card className="border-blue-200 bg-blue-50/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        Step {currentStepIndex + 1}: {currentStep.stepName}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {currentStep.description || 'No description provided'}
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
                      <span>Estimated time: {currentStep.estimatedTime} minutes</span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    This step requires careful attention to detail. Follow all instructions and ensure quality checks are completed.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Steps Overview */}
            <div className="space-y-3">
              <h3 className="font-medium">All Steps</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {steps.map((step: any, index: number) => (
                  <button
                    key={step._id}
                    onClick={() => setCurrentStepIndex(index)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      currentStepIndex === index
                        ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-300'
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
                          {index + 1}. {step.stepName}
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
                  Important Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2 text-amber-900">
                <ul className="list-disc list-inside space-y-1">
                  <li>Follow each step in order for best results</li>
                  <li>Take time to review step details before proceeding</li>
                  <li>You can pause the workflow at any time if needed</li>
                  <li>Don't skip steps unless absolutely necessary</li>
                  <li>Document any issues or notes for quality assurance</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              {mode === 'view' ? 'Close' : 'Cancel'}
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
                {isLoading ? 'Loading...' : mode === 'start' ? 'Confirm & Start' : 'Confirm & Resume'}
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
              {mode === 'start' ? 'Start Workflow?' : 'Resume Workflow?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {mode === 'start'
                ? `You are about to start "${workflow.workflowName}". This workflow has ${totalSteps} steps and should take approximately ${Math.round(totalEstimatedTime)} minutes.`
                : `You are about to resume "${workflow.workflowName}". The workflow will continue from where it was paused.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? 'Processing...' : mode === 'start' ? 'Start Workflow' : 'Resume Workflow'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
