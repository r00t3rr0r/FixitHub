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
  User
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { completeWorkflowStep, startWorkflow } from "@/api/workflow"

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

                    {/* Complete Step Button */}
                    {step.status === 'in-progress' && (
                      <Button
                        onClick={() => handleCompleteStep(step)}
                        disabled={completing === step._id}
                        className="w-full"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {completing === step._id ? 'Completing...' : 'Complete Step'}
                      </Button>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )
        })}
      </CardContent>
    </Card>
  )
}
