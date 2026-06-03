import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
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
import { CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, FileUp, X } from "lucide-react"
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
}: WorkflowStepExecutionPanelProps) {
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
        title: canGoNext ? "Erfolg" : "Workflow abgeschlossen!",
        description: canGoNext
          ? `Schritt "${step.name}" wurde erfolgreich abgeschlossen`
          : `Letzter Schritt "${step.name}" abgeschlossen – der gesamte Workflow ist nun fertig.`,
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

  const totalChecklistItems = normalizedStep.checklistItems.length
  const completedChecklistItems = normalizedStep.checklistItems.filter((_, i) => checklistData[i]).length

  const fieldControlClass = "bg-white border-slate-300 text-slate-900 focus-visible:ring-[#1a2a5e] focus-visible:ring-offset-1"
  const checkboxClass = "h-5 w-5 rounded border-2 border-slate-400 data-[state=checked]:border-[#1a2a5e] data-[state=checked]:bg-[#1a2a5e] data-[state=unchecked]:bg-white shrink-0"

  return (
    <>
      <div className="flex flex-col h-full bg-white">

        {/* ── Step header ── */}
        <div className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-300 mb-1">
                Schritt {currentStepIndex + 1} von {steps.length}
              </p>
              <h2 className="text-lg font-bold text-[#f5b800] leading-snug">
                {normalizedStep.name}
              </h2>
              {normalizedStep.description && (
                <p className="mt-1 text-sm text-blue-100 leading-relaxed">
                  {normalizedStep.description}
                </p>
              )}
            </div>
            <Badge
              className={`flex-shrink-0 whitespace-nowrap font-semibold text-xs ${
                normalizedStep.status === 'completed'
                  ? 'bg-emerald-500 text-white hover:bg-emerald-500'
                  : normalizedStep.status === 'in-progress'
                    ? 'bg-[#f5b800] text-[#1a2a5e] hover:bg-[#f5b800]'
                    : 'bg-white/20 text-white hover:bg-white/20'
              }`}
            >
              {normalizedStep.status === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              {normalizedStep.status === 'in-progress' && <AlertCircle className="h-3.5 w-3.5 mr-1" />}
              {normalizedStep.status === 'completed'
                ? 'Abgeschlossen'
                : normalizedStep.status === 'in-progress'
                  ? 'In Bearbeitung'
                  : normalizedStep.status === 'skipped'
                    ? 'Übersprungen'
                    : 'Ausstehend'}
            </Badge>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* ── Checklist ── */}
          {normalizedStep.checklistItems && normalizedStep.checklistItems.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <span className="inline-block h-3 w-1 rounded-full bg-[#1a2a5e]" />
                  Checkliste
                </h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  completedChecklistItems === totalChecklistItems && totalChecklistItems > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {completedChecklistItems}/{totalChecklistItems} erledigt
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden divide-y divide-slate-200">
                {normalizedStep.checklistItems.map((item, index) => (
                  <label
                    key={index}
                    htmlFor={`checklist-${index}`}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors select-none ${
                      checklistData[index]
                        ? 'bg-emerald-50/70'
                        : 'hover:bg-white'
                    }`}
                  >
                    <Checkbox
                      id={`checklist-${index}`}
                      checked={checklistData[index] || false}
                      onCheckedChange={() => handleChecklistItemToggle(index)}
                      disabled={isSubmitting}
                      className={checkboxClass}
                    />
                    <span className={`text-sm flex-1 leading-snug ${
                      checklistData[index]
                        ? 'line-through text-slate-400'
                        : 'text-slate-800 font-medium'
                    }`}>
                      {item}
                    </span>
                    {checklistData[index] && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    )}
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* ── Form fields ── */}
          {normalizedStep.formFields && normalizedStep.formFields.length > 0 && (
            <section>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2 mb-3">
                <span className="inline-block h-3 w-1 rounded-full bg-[#1a2a5e]" />
                Formularfelder
              </h3>
              <div className="space-y-3">
                {normalizedStep.formFields.map((field) => (
                  <div key={field.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 shadow-sm">
                    <label className="text-sm font-semibold text-slate-800 flex items-center gap-1">
                      {field.label}
                      {field.required && <span className="text-red-500 text-xs ml-0.5">*</span>}
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
                          <SelectValue placeholder={field.placeholder || 'Bitte wählen…'} />
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
                      <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={formData[field.name] || false}
                          onCheckedChange={(checked) => handleFormFieldChange(field.name, checked)}
                          disabled={isSubmitting}
                          className={checkboxClass}
                        />
                        <span className="text-sm text-slate-800">{field.placeholder || field.label}</span>
                      </label>
                    )}

                    {field.type === 'radio' && field.options && (
                      <RadioGroup
                        value={formData[field.name] || ""}
                        onValueChange={(value) => handleFormFieldChange(field.name, value)}
                        disabled={isSubmitting}
                        className="space-y-1"
                      >
                        {field.options.map((option) => (
                          <label
                            key={option.value}
                            htmlFor={`${field.id}-${option.value}`}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
                          >
                            <RadioGroupItem
                              value={option.value}
                              id={`${field.id}-${option.value}`}
                              disabled={isSubmitting}
                              className="border-slate-400 text-[#1a2a5e]"
                            />
                            <span className="text-sm text-slate-800 font-medium">{option.label}</span>
                          </label>
                        ))}
                      </RadioGroup>
                    )}

                    {field.type === 'multiselect' && field.options && (
                      <div className="rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
                        {field.options.map((option) => (
                          <label
                            key={option.value}
                            htmlFor={`${field.id}-${option.value}`}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                              (formData[field.name] || []).includes(option.value) ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <Checkbox
                              id={`${field.id}-${option.value}`}
                              checked={(formData[field.name] || []).includes(option.value)}
                              onCheckedChange={(checked) => {
                                const currentValues = formData[field.name] || []
                                if (checked) {
                                  handleFormFieldChange(field.name, [...currentValues, option.value])
                                } else {
                                  handleFormFieldChange(field.name, currentValues.filter((v: string) => v !== option.value))
                                }
                              }}
                              disabled={isSubmitting}
                              className={checkboxClass}
                            />
                            <span className="text-sm text-slate-800 font-medium">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {field.type === 'file' && (
                      <div className="space-y-2">
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
                          className="flex flex-col items-center gap-2 border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-[#1a2a5e] hover:bg-blue-50/30 transition-colors"
                        >
                          <FileUp className="h-6 w-6 text-slate-400" />
                          <span className="text-xs text-slate-600 font-medium">
                            Klicken zum Hochladen
                          </span>
                        </label>
                        {formData[field.name] && formData[field.name].length > 0 && (
                          <div className="space-y-1">
                            {formData[field.name].map((file: File, index: number) => (
                              <div key={index} className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                <span className="truncate text-slate-700">{file.name}</span>
                                <button
                                  onClick={() => {
                                    handleFormFieldChange(field.name, formData[field.name].filter((_: File, i: number) => i !== index))
                                  }}
                                  className="ml-2 text-slate-400 hover:text-red-500 transition-colors"
                                  type="button"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {field.helpText && (
                      <p className="text-xs text-slate-500 italic">{field.helpText}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Notes ── */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2 mb-3">
              <span className="inline-block h-3 w-1 rounded-full bg-[#1a2a5e]" />
              Notizen
            </h3>
            <Textarea
              placeholder="Beobachtungen, Auffälligkeiten oder Hinweise für diesen Schritt …"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#1a2a5e] resize-none"
            />
          </section>

          {/* ── Photo upload ── */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2 mb-3">
              <span className="inline-block h-3 w-1 rounded-full bg-[#1a2a5e]" />
              Fotos
            </h3>
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
              className="flex flex-col items-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-5 text-center cursor-pointer hover:border-[#1a2a5e] hover:bg-blue-50/30 transition-colors"
            >
              <FileUp className="h-7 w-7 text-slate-400" />
              <span className="text-sm font-medium text-slate-600">Fotos hochladen</span>
              <span className="text-xs text-slate-400">Klicken oder Drag & Drop</span>
            </label>
            {photos.length > 0 && (
              <p className="mt-2 text-xs text-slate-500 font-medium">{photos.length} Foto(s) ausgewählt</p>
            )}
          </section>
        </div>

        {/* ── Footer: navigation + actions ── */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-white px-5 py-3 space-y-2">
          {/* Step complete / skip */}
          {normalizedStep.status !== 'completed' ? (
            <div className="flex gap-2">
              <Button
                onClick={() => setShowCompleteConfirm(true)}
                disabled={isSubmitting || isLoading}
                className="flex-1 bg-[#1a2a5e] hover:bg-[#2a3f7e] text-white font-semibold h-10"
              >
                {isSubmitting
                  ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Schliesse ab…</>
                  : <><CheckCircle2 className="h-4 w-4 mr-2" />Schritt {currentStepIndex + 1} abschliessen</>
                }
              </Button>
              {normalizedStep.canSkip && (
                <Button
                  variant="outline"
                  onClick={() => setShowSkipConfirm(true)}
                  disabled={isSubmitting || isLoading}
                  className="border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Überspringen
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-2 text-emerald-600 bg-emerald-50 rounded-lg border border-emerald-200">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-semibold">Schritt abgeschlossen</span>
            </div>
          )}

          {/* Prev / next navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStepChange(Math.max(0, currentStepIndex - 1))}
              disabled={!canGoPrev || isSubmitting || isLoading}
              className="border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Zurück
            </Button>
            <span className="flex-1 text-center text-xs text-slate-400 font-medium">
              {currentStepIndex + 1} / {steps.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStepChange(Math.min(steps.length - 1, currentStepIndex + 1))}
              disabled={!canGoNext || isSubmitting || isLoading}
              className="border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Weiter
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

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
