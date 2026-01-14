import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/useToast"
import {
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  ChevronDown,
  PlayCircle,
  AlertCircle,
  FileText,
  Camera,
  Wrench,
  User,
  SkipForward,
  Pause,
  Play,
  ArrowLeft
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { completeWorkflowStep, startWorkflow, skipWorkflowStep, updateWorkflowStatus, goBackToStep } from "@/api/workflow"

interface WorkflowStep {
  _id: string
  stepId: string
  stepName: string
  status: 'pending' | 'in-progress' | 'completed' | 'skipped'
  assignedStaffId?: {
    _id: string
    name: string
    avatar: string
  }
  startedAt?: string
  completedAt?: string
  formData?: any
  checklistData?: Map<string, boolean>
  notes?: string
  photos?: string[]
}

interface OrderWorkflow {
  _id: string
  workflowTemplateId: {
    _id: string
    name: string
    description: string
    steps: Array<{
      _id: string
      name: string
      description: string
      estimatedTime: number
      category: string
      tools: string[]
      skills: string[]
      checklistItems: string[]
      formFields: any[]
    }>
  }
  workflowName: string
  steps: WorkflowStep[]
  currentStepIndex: number
  status: 'not-started' | 'in-progress' | 'completed' | 'on-hold'
  startedAt?: string
  completedAt?: string
  estimatedCompletionTime?: number
}

interface WorkflowExecutionViewProps {
  orderId: string
  workflow: OrderWorkflow
  onWorkflowUpdate?: () => void
}

export function WorkflowExecutionView({ orderId, workflow, onWorkflowUpdate }: WorkflowExecutionViewProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set([workflow.steps[workflow.currentStepIndex]?._id]))
  const [stepFormData, setStepFormData] = useState<Record<string, any>>({})
  const [stepChecklistData, setStepChecklistData] = useState<Record<string, Record<string, boolean>>>({})
  const [stepNotes, setStepNotes] = useState<Record<string, string>>({})
  const [completing, setCompleting] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [skipping, setSkipping] = useState<string | null>(null)
  const [skipDialogOpen, setSkipDialogOpen] = useState(false)
  const [skipReason, setSkipReason] = useState("")
  const [stepToSkip, setStepToSkip] = useState<WorkflowStep | null>(null)
  const [pausingResuming, setPausingResuming] = useState(false)
  const [navigating, setNavigating] = useState<string | null>(null)
  const { toast } = useToast()

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps)
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId)
    } else {
      newExpanded.add(stepId)
    }
    setExpandedSteps(newExpanded)
  }

  const handleStartWorkflow = async () => {
    try {
      setStarting(true)
      console.log("WorkflowExecutionView: Starting workflow:", workflow._id)

      await startWorkflow(orderId, workflow._id)

      toast({
        title: "Workflow Started",
        description: `${workflow.workflowName} has been started successfully.`
      })

      if (onWorkflowUpdate) {
        onWorkflowUpdate()
      }
    } catch (error: any) {
      console.error("WorkflowExecutionView: Error starting workflow:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to start workflow",
        variant: "destructive"
      })
    } finally {
      setStarting(false)
    }
  }

  const handleCompleteStep = async (step: WorkflowStep) => {
    try {
      setCompleting(step._id)
      console.log("WorkflowExecutionView: Completing step:", step._id)

      // Get the template step for checklist items
      const templateStep = workflow.workflowTemplateId.steps.find(
        ts => ts._id === step.stepId
      )

      const stepData = {
        formData: stepFormData[step._id] || {},
        checklistData: stepChecklistData[step._id] || {},
        notes: stepNotes[step._id] || '',
        photos: []
      }

      // Validate required checklist items
      if (templateStep?.checklistItems && templateStep.checklistItems.length > 0) {
        const allChecked = templateStep.checklistItems.every(
          item => stepChecklistData[step._id]?.[item] === true
        )
        if (!allChecked) {
          toast({
            title: "Incomplete Checklist",
            description: "Please complete all checklist items before proceeding.",
            variant: "destructive"
          })
          setCompleting(null)
          return
        }
      }

      // Validate required form fields
      if (templateStep?.formFields && templateStep.formFields.length > 0) {
        const requiredFields = templateStep.formFields.filter(f => f.required)
        const missingFields = requiredFields.filter(field => {
          const value = stepFormData[step._id]?.[field.id]
          return value === undefined || value === null || value === ''
        })

        if (missingFields.length > 0) {
          toast({
            title: "Required Fields Missing",
            description: `Please fill in all required fields: ${missingFields.map(f => f.label).join(', ')}`,
            variant: "destructive"
          })
          setCompleting(null)
          return
        }
      }

      await completeWorkflowStep(orderId, workflow._id, step._id, stepData)

      toast({
        title: "Step Completed",
        description: `${step.stepName} has been completed successfully.`
      })

      // Clear form data for this step
      const newFormData = { ...stepFormData }
      delete newFormData[step._id]
      setStepFormData(newFormData)

      const newChecklistData = { ...stepChecklistData }
      delete newChecklistData[step._id]
      setStepChecklistData(newChecklistData)

      const newNotes = { ...stepNotes }
      delete newNotes[step._id]
      setStepNotes(newNotes)

      if (onWorkflowUpdate) {
        onWorkflowUpdate()
      }
    } catch (error: any) {
      console.error("WorkflowExecutionView: Error completing step:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to complete step",
        variant: "destructive"
      })
    } finally {
      setCompleting(null)
    }
  }

  const handleChecklistChange = (stepId: string, item: string, checked: boolean) => {
    setStepChecklistData(prev => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] || {}),
        [item]: checked
      }
    }))
  }

  const handleSkipStep = (step: WorkflowStep) => {
    setStepToSkip(step)
    setSkipReason("")
    setSkipDialogOpen(true)
  }

  const confirmSkipStep = async () => {
    if (!stepToSkip) return

    try {
      setSkipping(stepToSkip._id)
      console.log("WorkflowExecutionView: Skipping step:", stepToSkip._id)

      await skipWorkflowStep(orderId, workflow._id, stepToSkip._id, skipReason)

      toast({
        title: "Step Skipped",
        description: `${stepToSkip.stepName} has been skipped.`
      })

      setSkipDialogOpen(false)
      setStepToSkip(null)
      setSkipReason("")

      if (onWorkflowUpdate) {
        onWorkflowUpdate()
      }
    } catch (error: any) {
      console.error("WorkflowExecutionView: Error skipping step:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to skip step",
        variant: "destructive"
      })
    } finally {
      setSkipping(null)
    }
  }

  const handlePauseResume = async () => {
    try {
      setPausingResuming(true)
      const newStatus = workflow.status === 'on-hold' ? 'in-progress' : 'on-hold'
      console.log("WorkflowExecutionView: Updating workflow status to:", newStatus)

      await updateWorkflowStatus(orderId, workflow._id, newStatus)

      toast({
        title: newStatus === 'on-hold' ? "Workflow Paused" : "Workflow Resumed",
        description: `${workflow.workflowName} has been ${newStatus === 'on-hold' ? 'paused' : 'resumed'}.`
      })

      if (onWorkflowUpdate) {
        onWorkflowUpdate()
      }
    } catch (error: any) {
      console.error("WorkflowExecutionView: Error updating workflow status:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update workflow status",
        variant: "destructive"
      })
    } finally {
      setPausingResuming(false)
    }
  }

  const handleGoBackToStep = async (step: WorkflowStep) => {
    if (step.status !== 'completed' && step.status !== 'skipped') {
      toast({
        title: "Cannot Navigate",
        description: "Can only navigate back to completed or skipped steps",
        variant: "destructive"
      })
      return
    }

    try {
      setNavigating(step._id)
      console.log("WorkflowExecutionView: Navigating back to step:", step._id)

      await goBackToStep(orderId, workflow._id, step._id)

      toast({
        title: "Navigation Successful",
        description: `Navigated back to ${step.stepName}`
      })

      if (onWorkflowUpdate) {
        onWorkflowUpdate()
      }
    } catch (error: any) {
      console.error("WorkflowExecutionView: Error navigating to step:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to navigate to step",
        variant: "destructive"
      })
    } finally {
      setNavigating(null)
    }
  }

  const handleFormFieldChange = (stepId: string, fieldId: string, value: any) => {
    setStepFormData(prev => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] || {}),
        [fieldId]: value
      }
    }))
  }

  const renderFormField = (stepId: string, field: any, disabled: boolean) => {
    const value = stepFormData[stepId]?.[field.id] ?? field.defaultValue ?? ''

    switch (field.type) {
      case 'text':
      case 'number':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={`${stepId}-${field.id}`}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={`${stepId}-${field.id}`}
              type={field.type}
              placeholder={field.placeholder}
              value={value}
              onChange={(e) => handleFormFieldChange(stepId, field.id, field.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
              disabled={disabled}
              required={field.required}
            />
            {field.helpText && <p className="text-sm text-muted-foreground">{field.helpText}</p>}
          </div>
        )

      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={`${stepId}-${field.id}`}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id={`${stepId}-${field.id}`}
              placeholder={field.placeholder}
              value={value}
              onChange={(e) => handleFormFieldChange(stepId, field.id, e.target.value)}
              disabled={disabled}
              required={field.required}
              rows={4}
            />
            {field.helpText && <p className="text-sm text-muted-foreground">{field.helpText}</p>}
          </div>
        )

      case 'checkbox':
        return (
          <div key={field.id} className="flex items-center space-x-2">
            <Checkbox
              id={`${stepId}-${field.id}`}
              checked={value === true}
              onCheckedChange={(checked) => handleFormFieldChange(stepId, field.id, checked)}
              disabled={disabled}
            />
            <Label htmlFor={`${stepId}-${field.id}`} className="cursor-pointer">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
          </div>
        )

      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={`${stepId}-${field.id}`}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <select
              id={`${stepId}-${field.id}`}
              value={value}
              onChange={(e) => handleFormFieldChange(stepId, field.id, e.target.value)}
              disabled={disabled}
              required={field.required}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select an option...</option>
              {field.options?.map((option: any) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {field.helpText && <p className="text-sm text-muted-foreground">{field.helpText}</p>}
          </div>
        )

      case 'date':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={`${stepId}-${field.id}`}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={`${stepId}-${field.id}`}
              type="date"
              value={value}
              onChange={(e) => handleFormFieldChange(stepId, field.id, e.target.value)}
              disabled={disabled}
              required={field.required}
            />
            {field.helpText && <p className="text-sm text-muted-foreground">{field.helpText}</p>}
          </div>
        )

      case 'time':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={`${stepId}-${field.id}`}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={`${stepId}-${field.id}`}
              type="time"
              value={value}
              onChange={(e) => handleFormFieldChange(stepId, field.id, e.target.value)}
              disabled={disabled}
              required={field.required}
            />
            {field.helpText && <p className="text-sm text-muted-foreground">{field.helpText}</p>}
          </div>
        )

      default:
        return null
    }
  }

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'in-progress':
        return <Clock className="h-5 w-5 text-blue-500" />
      case 'skipped':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      default:
        return <Circle className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const statusColors = {
      'not-started': 'bg-gray-100 text-gray-800',
      'in-progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'on-hold': 'bg-yellow-100 text-yellow-800'
    }

    return (
      <Badge className={statusColors[status as keyof typeof statusColors]}>
        {status.replace('-', ' ').toUpperCase()}
      </Badge>
    )
  }

  const completedSteps = workflow.steps.filter(s => s.status === 'completed').length
  const totalSteps = workflow.steps.length
  const progressPercentage = Math.round((completedSteps / totalSteps) * 100)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{workflow.workflowName}</CardTitle>
            <CardDescription className="mt-2">
              {workflow.workflowTemplateId.description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(workflow.status)}
            {workflow.status === 'not-started' && (
              <Button
                onClick={handleStartWorkflow}
                disabled={starting}
                size="sm"
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Start Workflow
              </Button>
            )}
            {(workflow.status === 'in-progress' || workflow.status === 'on-hold') && (
              <Button
                onClick={handlePauseResume}
                disabled={pausingResuming}
                size="sm"
                variant="outline"
              >
                {workflow.status === 'on-hold' ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{completedSteps} / {totalSteps} steps</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          {workflow.estimatedCompletionTime && (
            <div className="text-sm text-muted-foreground">
              <Clock className="h-4 w-4 inline mr-1" />
              Estimated time: {workflow.estimatedCompletionTime} minutes
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {workflow.steps.map((step, index) => {
          const templateStep = workflow.workflowTemplateId.steps.find(
            ts => ts._id === step.stepId
          )
          const isExpanded = expandedSteps.has(step._id)
          const isCurrentStep = workflow.currentStepIndex === index

          return (
            <Collapsible
              key={step._id}
              open={isExpanded}
              onOpenChange={() => toggleStep(step._id)}
            >
              <Card className={isCurrentStep && step.status === 'in-progress' ? 'border-blue-500 border-2' : ''}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {getStepIcon(step.status)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Step {index + 1}</span>
                            {isCurrentStep && step.status === 'in-progress' && (
                              <Badge variant="outline" className="text-xs">CURRENT</Badge>
                            )}
                          </div>
                          <CardTitle className="text-base">{step.stepName}</CardTitle>
                          {templateStep && (
                            <CardDescription className="mt-1">
                              {templateStep.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {templateStep?.estimatedTime && (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {templateStep.estimatedTime}min
                          </Badge>
                        )}
                        {templateStep?.category && (
                          <Badge variant="outline" className="text-xs">
                            {templateStep.category}
                          </Badge>
                        )}
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {/* Tools and Skills Required */}
                    {(templateStep?.tools.length > 0 || templateStep?.skills.length > 0) && (
                      <div className="space-y-2">
                        {templateStep?.tools.length > 0 && (
                          <div className="flex items-start gap-2">
                            <Wrench className="h-4 w-4 mt-1 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Tools Required:</p>
                              <p className="text-sm text-muted-foreground">{templateStep.tools.join(', ')}</p>
                            </div>
                          </div>
                        )}
                        {templateStep?.skills.length > 0 && (
                          <div className="flex items-start gap-2">
                            <User className="h-4 w-4 mt-1 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Skills Required:</p>
                              <p className="text-sm text-muted-foreground">{templateStep.skills.join(', ')}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Form Fields */}
                    {templateStep?.formFields && templateStep.formFields.length > 0 && step.status === 'in-progress' && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Required Information:</Label>
                        <div className="space-y-3 pl-2">
                          {templateStep.formFields.map((field) =>
                            renderFormField(step._id, field, false)
                          )}
                        </div>
                      </div>
                    )}

                    {/* Checklist Items */}
                    {templateStep?.checklistItems && templateStep.checklistItems.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Checklist:</Label>
                        <div className="space-y-2 pl-2">
                          {templateStep.checklistItems.map((item, idx) => (
                            <div key={idx} className="flex items-center space-x-2">
                              <Checkbox
                                id={`${step._id}-check-${idx}`}
                                checked={stepChecklistData[step._id]?.[item] || false}
                                onCheckedChange={(checked) =>
                                  handleChecklistChange(step._id, item, checked as boolean)
                                }
                                disabled={step.status !== 'in-progress'}
                              />
                              <label
                                htmlFor={`${step._id}-check-${idx}`}
                                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {item}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes Field */}
                    {step.status === 'in-progress' && (
                      <div className="space-y-2">
                        <Label htmlFor={`${step._id}-notes`} className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Notes (Optional)
                        </Label>
                        <Textarea
                          id={`${step._id}-notes`}
                          placeholder="Add any notes or observations about this step..."
                          value={stepNotes[step._id] || ''}
                          onChange={(e) => setStepNotes({ ...stepNotes, [step._id]: e.target.value })}
                          rows={3}
                        />
                      </div>
                    )}

                    {/* Completion Info */}
                    {step.status === 'completed' && step.completedAt && (
                      <div className="text-sm text-muted-foreground bg-green-50 p-3 rounded-md">
                        <CheckCircle2 className="h-4 w-4 inline mr-2 text-green-500" />
                        Completed on {new Date(step.completedAt).toLocaleString()}
                        {step.notes && (
                          <p className="mt-2 text-sm"><strong>Notes:</strong> {step.notes}</p>
                        )}
                      </div>
                    )}

                    {/* Skipped Info */}
                    {step.status === 'skipped' && step.completedAt && (
                      <div className="text-sm text-muted-foreground bg-yellow-50 p-3 rounded-md">
                        <AlertCircle className="h-4 w-4 inline mr-2 text-yellow-500" />
                        Skipped on {new Date(step.completedAt).toLocaleString()}
                        {step.notes && (
                          <p className="mt-2 text-sm"><strong>Reason:</strong> {step.notes}</p>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    {step.status === 'in-progress' && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleCompleteStep(step)}
                          disabled={completing === step._id}
                          className="flex-1"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          {completing === step._id ? 'Completing...' : 'Complete Step'}
                        </Button>
                        {templateStep?.canSkip && (
                          <Button
                            onClick={() => handleSkipStep(step)}
                            disabled={skipping === step._id}
                            variant="outline"
                          >
                            <SkipForward className="h-4 w-4 mr-2" />
                            Skip
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Go Back Button for Completed/Skipped Steps */}
                    {(step.status === 'completed' || step.status === 'skipped') && (
                      <Button
                        onClick={() => handleGoBackToStep(step)}
                        disabled={navigating === step._id}
                        variant="outline"
                        className="w-full"
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        {navigating === step._id ? 'Going back...' : 'Go Back to This Step'}
                      </Button>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )
        })}
      </CardContent>

      {/* Skip Confirmation Dialog */}
      <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip Step</DialogTitle>
            <DialogDescription>
              Are you sure you want to skip "{stepToSkip?.stepName}"? This step will be marked as skipped and you'll move to the next step.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="skip-reason">Reason for skipping (optional)</Label>
              <Textarea
                id="skip-reason"
                placeholder="Explain why this step is being skipped..."
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSkipDialogOpen(false)
                setStepToSkip(null)
                setSkipReason("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSkipStep}
              disabled={skipping !== null}
            >
              {skipping ? 'Skipping...' : 'Skip Step'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
