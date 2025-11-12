import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
import { CheckCircle2, Clock, AlertCircle, ChevronLeft, ChevronRight, FileUp } from "lucide-react"
import { useToast } from "@/hooks/useToast"

interface FormField {
  id: string
  name: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'checkbox' | 'radio' | 'select' | 'multiselect' | 'file' | 'date' | 'time'
  required: boolean
  placeholder?: string
  helpText?: string
  options?: Array<{ value: string; label: string }>
  validation?: {
    min?: number
    max?: number
    pattern?: string
    minLength?: number
    maxLength?: number
  }
  defaultValue?: any
}

interface WorkflowStep {
  _id: string
  stepId?: string
  name: string
  stepName?: string // For backward compatibility
  description?: string
  status: 'completed' | 'in-progress' | 'skipped' | 'pending'
  estimatedTime?: number
  order: number
  checklistItems?: string[]
  formFields?: FormField[]
  requiresFormCompletion?: boolean
  canSkip?: boolean
  startedAt?: string
  completedAt?: string
}

interface WorkflowStepExecutionPanelProps {
  step: WorkflowStep
  steps: WorkflowStep[]
  currentStepIndex: number
  onStepChange: (stepIndex: number) => void
  onStepComplete: (stepData: any) => Promise<void>
  onStepSkip?: (reason: string) => Promise<void>
  isLoading?: boolean
}

export function WorkflowStepExecutionPanel({
  step,
  steps,
  currentStepIndex,
  onStepChange,
  onStepComplete,
  onStepSkip,
  isLoading = false,
}: WorkflowStepExecutionPanelProps) {
  const { t } = useTranslation()
  const { toast } = useToast()

  // Normalize step data to ensure consistent property naming
  const normalizedStep = {
    ...step,
    name: step.name || step.stepName || 'Unnamed Step',
    checklistItems: step.checklistItems || [],
    formFields: step.formFields || [],
  }

  const [formData, setFormData] = useState<Record<string, any>>({})
  const [checklistData, setChecklistData] = useState<Record<number, boolean>>({})
  const [notes, setNotes] = useState("")
  const [photos, setPhotos] = useState<File[]>([])
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const [skipReason, setSkipReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canGoNext = currentStepIndex < steps.length - 1
  const canGoPrev = currentStepIndex > 0
  const completedSteps = steps.filter((s) => s.status === 'completed').length
  const progressPercentage = (completedSteps / steps.length) * 100

  const validateForm = (): boolean => {
    if (!normalizedStep.formFields || normalizedStep.formFields.length === 0) return true

    for (const field of normalizedStep.formFields) {
      if (field.required && !formData[field.name]) {
        toast({
          title: "Validation Error",
          description: `${field.label} is required`,
          variant: "destructive",
        })
        return false
      }

      // Validate number fields
      if (field.type === 'number' && formData[field.name]) {
        const value = parseFloat(formData[field.name])
        if (field.validation?.min !== undefined && value < field.validation.min) {
          toast({
            title: "Validation Error",
            description: `${field.label} must be at least ${field.validation.min}`,
            variant: "destructive",
          })
          return false
        }
        if (field.validation?.max !== undefined && value > field.validation.max) {
          toast({
            title: "Validation Error",
            description: `${field.label} must be at most ${field.validation.max}`,
            variant: "destructive",
          })
          return false
        }
      }

      // Validate text fields
      if (field.type === 'text' && formData[field.name]) {
        const value = formData[field.name] as string
        if (field.validation?.minLength && value.length < field.validation.minLength) {
          toast({
            title: "Validation Error",
            description: `${field.label} must be at least ${field.validation.minLength} characters`,
            variant: "destructive",
          })
          return false
        }
        if (field.validation?.maxLength && value.length > field.validation.maxLength) {
          toast({
            title: "Validation Error",
            description: `${field.label} must be at most ${field.validation.maxLength} characters`,
            variant: "destructive",
          })
          return false
        }
      }
    }

    return true
  }

  const handleCompleteStep = async () => {
    if (!validateForm()) return

    setShowCompleteConfirm(false)
    setIsSubmitting(true)

    try {
      await onStepComplete({
        formData: Object.keys(formData).length > 0 ? formData : undefined,
        checklistData: Object.keys(checklistData).length > 0 ? checklistData : undefined,
        notes: notes || undefined,
        photos: photos.length > 0 ? photos : undefined,
      })

      toast({
        title: "Success",
        description: `Step "${step.name}" completed successfully`,
      })

      // Reset form for next step if available
      setFormData({})
      setChecklistData({})
      setNotes("")
      setPhotos([])

      // Move to next step automatically if available
      if (canGoNext) {
        onStepChange(currentStepIndex + 1)
      }
    } catch (error: any) {
      console.error("Error completing step:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to complete step",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkipStep = async () => {
    if (!step.canSkip) {
      toast({
        title: "Cannot Skip",
        description: "This step cannot be skipped",
        variant: "destructive",
      })
      return
    }

    setShowSkipConfirm(false)
    setIsSubmitting(true)

    try {
      if (onStepSkip) {
        await onStepSkip(skipReason)

        toast({
          title: "Success",
          description: `Step "${step.name}" skipped`,
        })

        setSkipReason("")

        // Move to next step
        if (canGoNext) {
          onStepChange(currentStepIndex + 1)
        }
      }
    } catch (error: any) {
      console.error("Error skipping step:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to skip step",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos([...photos, ...Array.from(e.target.files)])
    }
  }

  const handleFormFieldChange = (fieldName: string, value: any) => {
    setFormData({
      ...formData,
      [fieldName]: value,
    })
  }

  const handleChecklistItemToggle = (index: number) => {
    setChecklistData({
      ...checklistData,
      [index]: !checklistData[index],
    })
  }

  const completedChecklistItems = Object.values(checklistData).filter(Boolean).length
  const totalChecklistItems = normalizedStep.checklistItems?.length || 0

  return (
    <>
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-lg">
                Step {currentStepIndex + 1}: {normalizedStep.name}
              </CardTitle>
              <CardDescription className="mt-2">
                {normalizedStep.description || "No description provided"}
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={`whitespace-nowrap ${
                normalizedStep.status === 'completed'
                  ? 'bg-green-500/10 text-green-700 border-green-200'
                  : normalizedStep.status === 'in-progress'
                    ? 'bg-blue-500/10 text-blue-700 border-blue-200'
                    : 'bg-gray-500/10 text-gray-700 border-gray-200'
              }`}
            >
              {normalizedStep.status === 'completed' && <CheckCircle2 className="h-4 w-4 mr-1" />}
              {normalizedStep.status === 'in-progress' && <AlertCircle className="h-4 w-4 mr-1" />}
              <span className="capitalize">{normalizedStep.status}</span>
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Workflow Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedSteps}/{steps.length} steps
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Step Time Estimate */}
          {normalizedStep.estimatedTime && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Estimated time: {normalizedStep.estimatedTime} minutes</span>
            </div>
          )}

          {/* Checklist Items */}
          {normalizedStep.checklistItems && normalizedStep.checklistItems.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Checklist Items ({completedChecklistItems}/{totalChecklistItems})
              </h4>
              <div className="space-y-2 bg-white p-3 rounded-lg border">
                {normalizedStep.checklistItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Checkbox
                      id={`checklist-${index}`}
                      checked={checklistData[index] || false}
                      onCheckedChange={() => handleChecklistItemToggle(index)}
                      disabled={isSubmitting}
                    />
                    <label
                      htmlFor={`checklist-${index}`}
                      className="text-sm flex-1 cursor-pointer"
                    >
                      {item}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form Fields */}
          {normalizedStep.formFields && normalizedStep.formFields.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Form Information</h4>
              <div className="space-y-4 bg-white p-3 rounded-lg border">
                {normalizedStep.formFields.map((field) => (
                  <div key={field.id} className="space-y-1">
                    <label className="text-sm font-medium">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>

                    {field.type === 'text' && (
                      <Input
                        placeholder={field.placeholder}
                        value={formData[field.name] || ""}
                        onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                        disabled={isSubmitting}
                      />
                    )}

                    {field.type === 'textarea' && (
                      <Textarea
                        placeholder={field.placeholder}
                        value={formData[field.name] || ""}
                        onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                        disabled={isSubmitting}
                        rows={3}
                      />
                    )}

                    {field.type === 'number' && (
                      <Input
                        type="number"
                        placeholder={field.placeholder}
                        value={formData[field.name] || ""}
                        onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                        disabled={isSubmitting}
                        min={field.validation?.min}
                        max={field.validation?.max}
                      />
                    )}

                    {field.type === 'date' && (
                      <Input
                        type="date"
                        value={formData[field.name] || ""}
                        onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                        disabled={isSubmitting}
                      />
                    )}

                    {field.type === 'time' && (
                      <Input
                        type="time"
                        value={formData[field.name] || ""}
                        onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                        disabled={isSubmitting}
                      />
                    )}

                    {field.type === 'select' && field.options && (
                      <Select
                        value={formData[field.name] || ""}
                        onValueChange={(value) => handleFormFieldChange(field.name, value)}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={field.placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {field.type === 'checkbox' && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={formData[field.name] || false}
                          onCheckedChange={(checked) => handleFormFieldChange(field.name, checked)}
                          disabled={isSubmitting}
                        />
                        <span className="text-sm">{field.placeholder}</span>
                      </div>
                    )}

                    {field.helpText && (
                      <p className="text-xs text-muted-foreground">{field.helpText}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Notes</label>
            <Textarea
              placeholder="Add any notes or observations about this step..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Upload Photos</label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={isSubmitting}
                className="hidden"
                id="photo-upload"
              />
              <label
                htmlFor="photo-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <FileUp className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Click to upload photos or drag and drop
                </span>
              </label>
            </div>
            {photos.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {photos.length} photo(s) selected
              </div>
            )}
          </div>

          {/* Navigation and Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStepChange(Math.max(0, currentStepIndex - 1))}
              disabled={!canGoPrev || isSubmitting || isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Step {currentStepIndex + 1} / {steps.length}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onStepChange(Math.min(steps.length - 1, currentStepIndex + 1))}
              disabled={!canGoNext || isSubmitting || isLoading}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Complete and Skip Actions */}
          <div className="flex gap-2 pt-2 border-t">
            {normalizedStep.status !== 'completed' && (
              <>
                <Button
                  onClick={() => setShowCompleteConfirm(true)}
                  disabled={isSubmitting || isLoading}
                  className="flex-1"
                >
                  {isSubmitting ? "Completing..." : `Complete Step ${currentStepIndex + 1}`}
                </Button>

                {normalizedStep.canSkip && (
                  <Button
                    variant="ghost"
                    onClick={() => setShowSkipConfirm(true)}
                    disabled={isSubmitting || isLoading}
                  >
                    Skip Step
                  </Button>
                )}
              </>
            )}

            {normalizedStep.status === 'completed' && (
              <div className="flex-1 flex items-center justify-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span>Step Completed</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Complete Confirmation Dialog */}
      <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Step?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark "{normalizedStep.name}" as complete? You will be automatically guided to the next step.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompleteStep} disabled={isSubmitting}>
              {isSubmitting ? "Completing..." : "Complete Step"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Skip Confirmation Dialog */}
      {normalizedStep.canSkip && (
        <AlertDialog open={showSkipConfirm} onOpenChange={setShowSkipConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Skip Step?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to skip "{normalizedStep.name}"? Please provide a reason for skipping this step.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Why are you skipping this step?"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                disabled={isSubmitting}
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSkipStep} disabled={isSubmitting || !skipReason}>
                {isSubmitting ? "Skipping..." : "Skip Step"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
