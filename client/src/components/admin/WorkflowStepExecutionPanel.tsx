import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
import { CheckCircle2, Clock, AlertCircle, ChevronLeft, ChevronRight, FileUp, X } from "lucide-react"
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
  actualDurationMinutes?: number
  totalPausedMinutes?: number
  currentPauseStartedAt?: string
  pauseHistory?: Array<{
    pausedAt: string
    resumedAt?: string
    durationMinutes?: number
    reason?: string
  }>
}

interface WorkflowStepExecutionPanelProps {
  step: WorkflowStep
  steps: WorkflowStep[]
  currentStepIndex: number
  onStepChange: (stepIndex: number) => void
  onStepComplete: (stepData: any) => Promise<void>
  onStepSkip?: (reason: string) => Promise<void>
  isLoading?: boolean
  workflowStatus?: 'not-started' | 'in-progress' | 'completed' | 'on-hold'
  workflowPauseReason?: string
}

export function WorkflowStepExecutionPanel({
  step,
  steps,
  currentStepIndex,
  onStepChange,
  onStepComplete,
  onStepSkip,
  isLoading = false,
  workflowStatus,
  workflowPauseReason,
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
  const [timerTick, setTimerTick] = useState(() => Date.now())
  const [fallbackStartedAt, setFallbackStartedAt] = useState<string>(() => new Date().toISOString())

  const canGoNext = currentStepIndex < steps.length - 1
  const canGoPrev = currentStepIndex > 0
  const completedSteps = steps.filter((s) => s.status === 'completed').length
  const progressPercentage = (completedSteps / steps.length) * 100

  useEffect(() => {
    if (normalizedStep.startedAt) {
      setFallbackStartedAt(normalizedStep.startedAt)
    } else {
      setFallbackStartedAt(new Date().toISOString())
    }
  }, [normalizedStep._id, normalizedStep.startedAt])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimerTick(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  const effectiveStartedAt = normalizedStep.startedAt || fallbackStartedAt
  const storedPausedMinutes = Number(normalizedStep.totalPausedMinutes || 0)
  const activePauseMinutes = useMemo(() => {
    if (workflowStatus !== 'on-hold' || !normalizedStep.currentPauseStartedAt) {
      return 0
    }

    const pauseStart = new Date(normalizedStep.currentPauseStartedAt).getTime()
    if (!Number.isFinite(pauseStart) || timerTick <= pauseStart) {
      return 0
    }

    return Math.max(0, Math.round((timerTick - pauseStart) / 60000))
  }, [workflowStatus, normalizedStep.currentPauseStartedAt, timerTick])

  const totalPausedMinutes = Math.max(0, storedPausedMinutes + activePauseMinutes)

  const stepElapsedMinutes = useMemo(() => {
    if (normalizedStep.actualDurationMinutes && normalizedStep.actualDurationMinutes > 0) {
      return normalizedStep.actualDurationMinutes
    }

    const start = new Date(effectiveStartedAt).getTime()
    const end = normalizedStep.completedAt
      ? new Date(normalizedStep.completedAt).getTime()
      : timerTick

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return 0
    }

    const rawMinutes = Math.max(0, Math.round((end - start) / 60000))
    return Math.max(0, rawMinutes - totalPausedMinutes)
  }, [effectiveStartedAt, normalizedStep.actualDurationMinutes, normalizedStep.completedAt, timerTick, totalPausedMinutes])

  const estimatedMinutes = normalizedStep.estimatedTime || 0
  const deltaMinutes = stepElapsedMinutes - estimatedMinutes
  const stepTimingProgress = estimatedMinutes > 0
    ? Math.min(100, Math.round((stepElapsedMinutes / estimatedMinutes) * 100))
    : 0
  const isStepOverEstimate = estimatedMinutes > 0 && stepElapsedMinutes > estimatedMinutes

  const formatMinutes = (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes < 0) return "0m"
    const hours = Math.floor(minutes / 60)
    const remaining = minutes % 60
    if (hours <= 0) return `${remaining}m`
    if (remaining <= 0) return `${hours}h`
    return `${hours}h ${remaining}m`
  }

  const validateForm = (): boolean => {
    if (!normalizedStep.formFields || normalizedStep.formFields.length === 0) return true

    for (const field of normalizedStep.formFields) {
      // Skip validation for file types as they handle their own validation
      if (field.type === 'file') continue

      // Check if required field is empty
      const fieldValue = formData[field.name]
      const isEmpty = fieldValue === undefined || fieldValue === null || fieldValue === '' ||
                      (Array.isArray(fieldValue) && fieldValue.length === 0)

      if (field.required && isEmpty) {
        toast({
          title: "Validierungsfehler",
          description: `${field.label} ist erforderlich`,
          variant: "destructive",
        })
        return false
      }

      // Validate number fields
      if (field.type === 'number' && fieldValue) {
        const value = parseFloat(fieldValue)
        if (isNaN(value)) {
          toast({
            title: "Validierungsfehler",
            description: `${field.label} muss eine gueltige Zahl sein`,
            variant: "destructive",
          })
          return false
        }
        if (field.validation?.min !== undefined && value < field.validation.min) {
          toast({
            title: "Validierungsfehler",
            description: `${field.label} muss mindestens ${field.validation.min} sein`,
            variant: "destructive",
          })
          return false
        }
        if (field.validation?.max !== undefined && value > field.validation.max) {
          toast({
            title: "Validierungsfehler",
            description: `${field.label} darf hoechstens ${field.validation.max} sein`,
            variant: "destructive",
          })
          return false
        }
      }

      // Validate text fields
      if (field.type === 'text' && fieldValue) {
        const value = fieldValue as string
        if (field.validation?.minLength && value.length < field.validation.minLength) {
          toast({
            title: "Validierungsfehler",
            description: `${field.label} muss mindestens ${field.validation.minLength} Zeichen haben`,
            variant: "destructive",
          })
          return false
        }
        if (field.validation?.maxLength && value.length > field.validation.maxLength) {
          toast({
            title: "Validierungsfehler",
            description: `${field.label} darf hoechstens ${field.validation.maxLength} Zeichen haben`,
            variant: "destructive",
          })
          return false
        }
      }

      // Validate textarea fields
      if (field.type === 'textarea' && fieldValue) {
        const value = fieldValue as string
        if (field.validation?.minLength && value.length < field.validation.minLength) {
          toast({
            title: "Validierungsfehler",
            description: `${field.label} muss mindestens ${field.validation.minLength} Zeichen haben`,
            variant: "destructive",
          })
          return false
        }
        if (field.validation?.maxLength && value.length > field.validation.maxLength) {
          toast({
            title: "Validierungsfehler",
            description: `${field.label} darf hoechstens ${field.validation.maxLength} Zeichen haben`,
            variant: "destructive",
          })
          return false
        }
      }

      // Validate multiselect fields
      if (field.type === 'multiselect' && field.required) {
        if (!Array.isArray(fieldValue) || fieldValue.length === 0) {
          toast({
            title: "Validierungsfehler",
            description: `Bitte waehle mindestens eine Option fuer ${field.label}`,
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
        timing: {
          elapsedMinutes: stepElapsedMinutes,
          estimatedMinutes,
          deltaMinutes,
          startedAt: effectiveStartedAt,
          pausedMinutes: totalPausedMinutes,
        },
      })

      toast({
        title: "Erfolg",
        description: `Schritt "${step.name}" wurde erfolgreich abgeschlossen`,
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
        title: "Fehler",
        description: error.message || "Schritt konnte nicht abgeschlossen werden",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkipStep = async () => {
    if (!step.canSkip) {
      toast({
        title: "Ueberspringen nicht moeglich",
        description: "Dieser Schritt kann nicht uebersprungen werden",
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
          title: "Erfolg",
          description: `Schritt "${step.name}" wurde uebersprungen`,
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
        title: "Fehler",
        description: error.message || "Schritt konnte nicht uebersprungen werden",
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
  const fieldControlClass = "bg-white border-slate-300 text-slate-900 focus-visible:ring-[#1a2a5e] focus-visible:ring-offset-1"
  const choiceControlClass = "border-slate-400 data-[state=checked]:border-[#1a2a5e] data-[state=checked]:bg-[#1a2a5e]"

  return (
    <>
      <Card className="border-gray-200 bg-white shadow-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-lg text-white">
                Schritt {currentStepIndex + 1}: {normalizedStep.name}
              </CardTitle>
              <CardDescription className="mt-2 text-blue-100">
                {normalizedStep.description || "Keine Beschreibung vorhanden"}
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={`whitespace-nowrap ${
                normalizedStep.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : normalizedStep.status === 'in-progress'
                    ? 'bg-white text-[#1a2a5e] border-blue-100'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {normalizedStep.status === 'completed' && <CheckCircle2 className="h-4 w-4 mr-1" />}
              {normalizedStep.status === 'in-progress' && <AlertCircle className="h-4 w-4 mr-1" />}
              <span className="capitalize">{normalizedStep.status}</span>
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step Timing Guidance */}
          <div className={`rounded-lg border p-4 ${
            isStepOverEstimate
              ? 'border-amber-300 bg-amber-50'
              : 'border-blue-100 bg-blue-50/60'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Zeitstatus dieses Steps</p>
                <p className="text-xs text-slate-600">
                  {estimatedMinutes > 0
                    ? 'Die Soll-Zeit ist eine Richtlinie. Du siehst hier live, ob du im Plan bist.'
                    : 'Für diesen Step wurde keine Soll-Zeit hinterlegt.'}
                </p>
              </div>
              <Badge
                variant="outline"
                className={isStepOverEstimate
                  ? 'border-amber-300 bg-amber-100 text-amber-800'
                  : 'border-emerald-200 bg-emerald-100 text-emerald-800'}
              >
                {isStepOverEstimate ? 'Ueber Sollzeit' : 'Im Zeitplan'}
              </Badge>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-white p-3 border border-slate-100">
                <p className="text-xs text-slate-500">Soll-Zeit</p>
                <p className="text-lg font-semibold text-slate-900">{formatMinutes(estimatedMinutes)}</p>
              </div>
              <div className="rounded-md bg-white p-3 border border-slate-100">
                <p className="text-xs text-slate-500">Laufzeit</p>
                <p className="text-lg font-semibold text-slate-900">{formatMinutes(stepElapsedMinutes)}</p>
              </div>
              <div className="rounded-md bg-white p-3 border border-slate-100">
                <p className="text-xs text-slate-500">Abweichung</p>
                <p className={`text-lg font-semibold ${deltaMinutes > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {deltaMinutes > 0 ? '+' : ''}{formatMinutes(Math.abs(deltaMinutes))}
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-white p-3 border border-slate-100">
                <p className="text-xs text-slate-500">Pausenzeit in diesem Schritt</p>
                <p className="text-lg font-semibold text-slate-900">{formatMinutes(totalPausedMinutes)}</p>
              </div>
              <div className="rounded-md bg-white p-3 border border-slate-100">
                <p className="text-xs text-slate-500">Aktueller Workflow-Status</p>
                <p className={`text-sm font-semibold ${workflowStatus === 'on-hold' ? 'text-amber-700' : 'text-slate-900'}`}>
                  {workflowStatus === 'on-hold' ? 'Pausiert' : 'Aktiv'}
                </p>
                {workflowStatus === 'on-hold' && workflowPauseReason && (
                  <p className="mt-1 text-xs text-slate-600">Grund: {workflowPauseReason}</p>
                )}
              </div>
            </div>

            {estimatedMinutes > 0 && (
              <div className="mt-3 space-y-1">
                <Progress value={stepTimingProgress} className="h-2" />
                <p className="text-xs text-slate-500">
                  {isStepOverEstimate
                    ? `Du arbeitest seit ${formatMinutes(stepElapsedMinutes)} an diesem Step und liegst ${formatMinutes(Math.abs(deltaMinutes))} ueber der Richtzeit.`
                    : `Du arbeitest seit ${formatMinutes(stepElapsedMinutes)} an diesem Step und liegst im Zeitkorridor.`}
                </p>
              </div>
            )}
          </div>

          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Workflow-Fortschritt</span>
              <span className="text-sm text-muted-foreground">
                {completedSteps}/{steps.length} Schritte
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Step Time Estimate */}
          {normalizedStep.estimatedTime && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Richtzeit: {normalizedStep.estimatedTime} Minuten</span>
            </div>
          )}

          {/* Checklist Items */}
          {normalizedStep.checklistItems && normalizedStep.checklistItems.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Checkliste ({completedChecklistItems}/{totalChecklistItems})
              </h4>
              <div className="space-y-2 bg-white p-3 rounded-lg border">
                {normalizedStep.checklistItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Checkbox
                      id={`checklist-${index}`}
                      checked={checklistData[index] || false}
                      onCheckedChange={() => handleChecklistItemToggle(index)}
                      disabled={isSubmitting}
                      className={choiceControlClass}
                    />
                    <label
                      htmlFor={`checklist-${index}`}
                      className="text-sm text-slate-800 flex-1 cursor-pointer"
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
              <h4 className="font-medium">Formularangaben</h4>
              <div className="space-y-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                {normalizedStep.formFields.map((field) => (
                  <div key={field.id} className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
                    <label className="text-sm font-semibold text-slate-800">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>

                    {field.type === 'text' && (
                      <Input
                        placeholder={field.placeholder}
                        value={formData[field.name] || ""}
                        onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                        disabled={isSubmitting}
                        className={fieldControlClass}
                      />
                    )}

                    {field.type === 'textarea' && (
                      <Textarea
                        placeholder={field.placeholder}
                        value={formData[field.name] || ""}
                        onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                        disabled={isSubmitting}
                        rows={3}
                        className={fieldControlClass}
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
                        className={fieldControlClass}
                      />
                    )}

                    {field.type === 'date' && (
                      <Input
                        type="date"
                        value={formData[field.name] || ""}
                        onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                        disabled={isSubmitting}
                        className={fieldControlClass}
                      />
                    )}

                    {field.type === 'time' && (
                      <Input
                        type="time"
                        value={formData[field.name] || ""}
                        onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                        disabled={isSubmitting}
                        className={fieldControlClass}
                      />
                    )}

                    {field.type === 'select' && field.options && (
                      <Select
                        value={formData[field.name] || ""}
                        onValueChange={(value) => handleFormFieldChange(field.name, value)}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger className={fieldControlClass}>
                          <SelectValue placeholder={field.placeholder} />
                        </SelectTrigger>
                        <SelectContent className="border-slate-300">
                          {field.options.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              className="text-slate-800 focus:bg-blue-50 focus:text-[#1a2a5e]"
                            >
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
                          className={choiceControlClass}
                        />
                        <span className="text-sm text-slate-800">{field.placeholder}</span>
                      </div>
                    )}

                    {field.type === 'radio' && field.options && (
                      <RadioGroup
                        value={formData[field.name] || ""}
                        onValueChange={(value) => handleFormFieldChange(field.name, value)}
                        disabled={isSubmitting}
                      >
                        <div className="space-y-2">
                          {field.options.map((option) => (
                            <div key={option.value} className="flex items-center gap-2">
                              <RadioGroupItem
                                value={option.value}
                                id={`${field.id}-${option.value}`}
                                disabled={isSubmitting}
                                className="border-slate-400 text-[#1a2a5e]"
                              />
                              <label
                                htmlFor={`${field.id}-${option.value}`}
                                className="text-sm text-slate-800 font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {option.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      </RadioGroup>
                    )}

                    {field.type === 'multiselect' && field.options && (
                      <div className="space-y-2">
                        {field.options.map((option) => (
                          <div key={option.value} className="flex items-center gap-2">
                            <Checkbox
                              id={`${field.id}-${option.value}`}
                              checked={(formData[field.name] || []).includes(option.value)}
                              onCheckedChange={(checked) => {
                                const currentValues = formData[field.name] || []
                                if (checked) {
                                  handleFormFieldChange(field.name, [...currentValues, option.value])
                                } else {
                                  handleFormFieldChange(
                                    field.name,
                                    currentValues.filter((v: string) => v !== option.value)
                                  )
                                }
                              }}
                              disabled={isSubmitting}
                              className={choiceControlClass}
                            />
                            <label
                              htmlFor={`${field.id}-${option.value}`}
                              className="text-sm text-slate-800 font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {option.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}

                    {field.type === 'file' && (
                      <div className="space-y-2">
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-3 text-center bg-slate-50">
                          <input
                            type="file"
                            multiple
                            onChange={(e) => {
                              if (e.target.files) {
                                const files = Array.from(e.target.files)
                                const currentFiles = formData[field.name] || []
                                handleFormFieldChange(field.name, [...currentFiles, ...files])
                              }
                            }}
                            disabled={isSubmitting}
                            className="hidden"
                            id={`file-${field.id}`}
                          />
                          <label
                            htmlFor={`file-${field.id}`}
                            className="cursor-pointer flex flex-col items-center gap-1"
                          >
                            <FileUp className="h-5 w-5 text-slate-500" />
                            <span className="text-xs text-slate-700">
                              Klicken, um Dateien hochzuladen
                            </span>
                          </label>
                        </div>
                        {formData[field.name] && formData[field.name].length > 0 && (
                          <div className="space-y-1">
                            {formData[field.name].map((file: File, index: number) => (
                              <div key={index} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                                <span className="truncate">{file.name}</span>
                                <button
                                  onClick={() => {
                                    const updatedFiles = formData[field.name].filter(
                                      (_: File, i: number) => i !== index
                                    )
                                    handleFormFieldChange(field.name, updatedFiles)
                                  }}
                                  className="text-red-500 hover:text-red-700"
                                  type="button"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {field.helpText && (
                      <p className="text-xs text-slate-600">{field.helpText}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Zusaetzliche Notizen</label>
            <Textarea
              placeholder="Notizen oder Beobachtungen zu diesem Schritt..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Fotos hochladen</label>
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
                  Klicken, um Fotos hochzuladen, oder per Drag and Drop ablegen
                </span>
              </label>
            </div>
            {photos.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {photos.length} Foto(s) ausgewaehlt
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
              Zurueck
            </Button>

            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Schritt {currentStepIndex + 1} / {steps.length}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onStepChange(Math.min(steps.length - 1, currentStepIndex + 1))}
              disabled={!canGoNext || isSubmitting || isLoading}
            >
              Weiter
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
                  {isSubmitting ? "Schliesse ab..." : `Schritt ${currentStepIndex + 1} abschliessen`}
                </Button>

                {normalizedStep.canSkip && (
                  <Button
                    variant="ghost"
                    onClick={() => setShowSkipConfirm(true)}
                    disabled={isSubmitting || isLoading}
                  >
                    Schritt ueberspringen
                  </Button>
                )}
              </>
            )}

            {normalizedStep.status === 'completed' && (
              <div className="flex-1 flex items-center justify-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span>Schritt abgeschlossen</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Complete Confirmation Dialog */}
      <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schritt abschliessen?</AlertDialogTitle>
            <AlertDialogDescription>
              Moechtest du "{normalizedStep.name}" wirklich als abgeschlossen markieren? Danach wirst du automatisch zum naechsten Schritt gefuehrt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompleteStep} disabled={isSubmitting}>
              {isSubmitting ? "Schliesse ab..." : "Schritt abschliessen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Skip Confirmation Dialog */}
      {normalizedStep.canSkip && (
        <AlertDialog open={showSkipConfirm} onOpenChange={setShowSkipConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Schritt ueberspringen?</AlertDialogTitle>
              <AlertDialogDescription>
                Moechtest du "{normalizedStep.name}" wirklich ueberspringen? Bitte gib einen Grund an.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Warum ueberspringst du diesen Schritt?"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                disabled={isSubmitting}
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={handleSkipStep} disabled={isSubmitting || !skipReason}>
                {isSubmitting ? "Ueberspringe..." : "Schritt ueberspringen"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
