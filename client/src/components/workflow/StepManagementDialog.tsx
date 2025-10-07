import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/useToast"
import { WorkflowStep, FormField, AutomationRule } from "@/api/workflow"
import {
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Settings,
  FormInput,
  Zap,
  CheckSquare,
  Clock,
  AlertTriangle,
  Info
} from "lucide-react"

interface StepManagementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: WorkflowStep | null
  onSave: (stepData: Partial<WorkflowStep>) => Promise<void>
  onAddFormField: (formField: FormField) => Promise<void>
  onUpdateFormField: (fieldId: string, updates: Partial<FormField>) => Promise<void>
  onRemoveFormField: (fieldId: string) => Promise<void>
  onAddAutomationRule: (rule: AutomationRule) => Promise<void>
  onUpdateAutomationRule: (ruleId: string, updates: Partial<AutomationRule>) => Promise<void>
  onRemoveAutomationRule: (ruleId: string) => Promise<void>
  isNew?: boolean
}

export function StepManagementDialog({
  open,
  onOpenChange,
  step,
  onSave,
  onAddFormField,
  onUpdateFormField,
  onRemoveFormField,
  onAddAutomationRule,
  onUpdateAutomationRule,
  onRemoveAutomationRule,
  isNew = false
}: StepManagementDialogProps) {
  const [stepData, setStepData] = useState<Partial<WorkflowStep>>({
    name: "",
    description: "",
    estimatedTime: 30,
    isRequired: true,
    category: "diagnostic",
    canSkip: false,
    requiresApproval: false,
    requiresFormCompletion: false,
    tools: [],
    skills: [],
    checklistItems: [],
    dependencies: [],
    formFields: [],
    automationRules: [],
    notificationSettings: {
      onStart: false,
      onComplete: false,
      onDelay: false
    }
  })

  const [showFormFieldDialog, setShowFormFieldDialog] = useState(false)
  const [showAutomationDialog, setShowAutomationDialog] = useState(false)
  const [editingFormField, setEditingFormField] = useState<FormField | null>(null)
  const [editingAutomationRule, setEditingAutomationRule] = useState<AutomationRule | null>(null)
  const [saving, setSaving] = useState(false)

  const [newFormField, setNewFormField] = useState<Partial<FormField>>({
    name: "",
    label: "",
    type: "text",
    required: false,
    placeholder: "",
    helpText: "",
    options: [],
    order: 0,
    isConditional: false
  })

  const [newAutomationRule, setNewAutomationRule] = useState<Partial<AutomationRule>>({
    trigger: "step_completion",
    action: "send_notification",
    isActive: true
  })

  const [newChecklistItem, setNewChecklistItem] = useState("")
  const [newTool, setNewTool] = useState("")
  const [newSkill, setNewSkill] = useState("")

  const { toast } = useToast()

  const categoryOptions = [
    { value: "diagnostic", label: "Diagnostic" },
    { value: "repair", label: "Repair" },
    { value: "quality", label: "Quality Check" },
    { value: "addon", label: "Add-on Service" },
    { value: "completion", label: "Completion" }
  ]

  const fieldTypeOptions = [
    { value: "text", label: "Text Input" },
    { value: "textarea", label: "Text Area" },
    { value: "number", label: "Number" },
    { value: "checkbox", label: "Checkbox" },
    { value: "radio", label: "Radio Button" },
    { value: "select", label: "Dropdown" },
    { value: "multiselect", label: "Multi-select" },
    { value: "file", label: "File Upload" },
    { value: "date", label: "Date" },
    { value: "time", label: "Time" }
  ]

  const triggerOptions = [
    { value: "step_completion", label: "Step Completion" },
    { value: "time_delay", label: "Time Delay" },
    { value: "condition_met", label: "Condition Met" },
    { value: "manual", label: "Manual Trigger" },
    { value: "form_submission", label: "Form Submission" }
  ]

  const actionOptions = [
    { value: "send_notification", label: "Send Notification" },
    { value: "update_status", label: "Update Status" },
    { value: "assign_staff", label: "Assign Staff" },
    { value: "create_task", label: "Create Task" },
    { value: "move_to_next_step", label: "Move to Next Step" }
  ]

  useEffect(() => {
    console.log("StepManagementDialog: Dialog opened with step:", step?.name || "new step")
    if (step) {
      console.log("StepManagementDialog: Loading existing step data")
      setStepData({
        ...step,
        formFields: step.formFields || [],
        automationRules: step.automationRules || [],
        tools: step.tools || [],
        skills: step.skills || [],
        checklistItems: step.checklistItems || [],
        dependencies: step.dependencies || [],
        notificationSettings: step.notificationSettings || {
          onStart: false,
          onComplete: false,
          onDelay: false
        }
      })
    } else if (isNew) {
      console.log("StepManagementDialog: Initializing new step data")
      setStepData({
        name: "",
        description: "",
        estimatedTime: 30,
        isRequired: true,
        category: "diagnostic",
        canSkip: false,
        requiresApproval: false,
        requiresFormCompletion: false,
        tools: [],
        skills: [],
        checklistItems: [],
        dependencies: [],
        formFields: [],
        automationRules: [],
        notificationSettings: {
          onStart: false,
          onComplete: false,
          onDelay: false
        }
      })
    }
  }, [step, isNew])

  const handleSave = async () => {
    console.log("StepManagementDialog: Attempting to save step:", stepData.name)
    if (!stepData.name || !stepData.description || !stepData.category) {
      console.error("StepManagementDialog: Missing required fields")
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      console.log("StepManagementDialog: Calling onSave with step data:", stepData)
      await onSave(stepData)
      console.log("StepManagementDialog: Step saved successfully")
      toast({
        title: "Success",
        description: `Step ${isNew ? 'created' : 'updated'} successfully`
      })
      onOpenChange(false)
    } catch (error: any) {
      console.error("StepManagementDialog: Error saving step:", error)
      toast({
        title: "Error",
        description: error.message || `Failed to ${isNew ? 'create' : 'update'} step`,
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAddFormField = async () => {
    console.log("StepManagementDialog: Adding form field:", newFormField)
    if (!newFormField.name || !newFormField.label || !newFormField.type) {
      console.error("StepManagementDialog: Missing required form field details")
      toast({
        title: "Error",
        description: "Please fill in all required form field details",
        variant: "destructive"
      })
      return
    }

    try {
      const formFieldData = {
        ...newFormField,
        id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        order: stepData.formFields?.length || 0
      } as FormField

      console.log("StepManagementDialog: Form field data prepared:", formFieldData)

      // Always update local state first
      console.log("StepManagementDialog: Adding form field to local state")
      setStepData(prev => ({
        ...prev,
        formFields: [...(prev.formFields || []), formFieldData]
      }))

      // For existing steps, also call the API
      if (!isNew) {
        console.log("StepManagementDialog: Adding form field via API for existing step")
        await onAddFormField(formFieldData)
      }

      setShowFormFieldDialog(false)
      setNewFormField({
        name: "",
        label: "",
        type: "text",
        required: false,
        placeholder: "",
        helpText: "",
        options: [],
        order: 0,
        isConditional: false
      })

      console.log("StepManagementDialog: Form field added successfully")
      toast({
        title: "Success",
        description: "Form field added successfully"
      })
    } catch (error: any) {
      console.error("StepManagementDialog: Error adding form field:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to add form field",
        variant: "destructive"
      })
    }
  }

  const handleAddAutomationRule = async () => {
    console.log("StepManagementDialog: Adding automation rule:", newAutomationRule)
    if (!newAutomationRule.trigger || !newAutomationRule.action) {
      console.error("StepManagementDialog: Missing required automation rule details")
      toast({
        title: "Error",
        description: "Please fill in all required automation rule details",
        variant: "destructive"
      })
      return
    }

    try {
      const ruleData = {
        ...newAutomationRule,
        _id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      } as AutomationRule

      console.log("StepManagementDialog: Automation rule data prepared:", ruleData)

      // Always update local state first
      console.log("StepManagementDialog: Adding automation rule to local state")
      setStepData(prev => ({
        ...prev,
        automationRules: [...(prev.automationRules || []), ruleData]
      }))

      // For existing steps, also call the API
      if (!isNew) {
        console.log("StepManagementDialog: Adding automation rule via API for existing step")
        await onAddAutomationRule(ruleData)
      }

      setShowAutomationDialog(false)
      setNewAutomationRule({
        trigger: "step_completion",
        action: "send_notification",
        isActive: true
      })

      console.log("StepManagementDialog: Automation rule added successfully")
      toast({
        title: "Success",
        description: "Automation rule added successfully"
      })
    } catch (error: any) {
      console.error("StepManagementDialog: Error adding automation rule:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to add automation rule",
        variant: "destructive"
      })
    }
  }

  const handleUpdateFormField = async (fieldId: string, updates: Partial<FormField>) => {
    console.log("StepManagementDialog: Updating form field:", fieldId, updates)
    try {
      // Always update local state first
      console.log("StepManagementDialog: Updating form field in local state")
      setStepData(prev => ({
        ...prev,
        formFields: prev.formFields?.map(field =>
          field.id === fieldId ? { ...field, ...updates } : field
        ) || []
      }))

      // For existing steps, also call the API
      if (!isNew) {
        console.log("StepManagementDialog: Updating form field via API for existing step")
        await onUpdateFormField(fieldId, updates)
      }

      setEditingFormField(null)
      console.log("StepManagementDialog: Form field updated successfully")
      toast({
        title: "Success",
        description: "Form field updated successfully"
      })
    } catch (error: any) {
      console.error("StepManagementDialog: Error updating form field:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update form field",
        variant: "destructive"
      })
    }
  }

  const handleRemoveFormField = async (fieldId: string) => {
    console.log("StepManagementDialog: Removing form field:", fieldId)
    try {
      // Always update local state first
      console.log("StepManagementDialog: Removing form field from local state")
      setStepData(prev => ({
        ...prev,
        formFields: prev.formFields?.filter(field => field.id !== fieldId) || []
      }))

      // For existing steps, also call the API
      if (!isNew) {
        console.log("StepManagementDialog: Removing form field via API for existing step")
        await onRemoveFormField(fieldId)
      }

      console.log("StepManagementDialog: Form field removed successfully")
      toast({
        title: "Success",
        description: "Form field removed successfully"
      })
    } catch (error: any) {
      console.error("StepManagementDialog: Error removing form field:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove form field",
        variant: "destructive"
      })
    }
  }

  const handleRemoveAutomationRule = async (ruleId: string) => {
    console.log("StepManagementDialog: Removing automation rule:", ruleId)
    try {
      // Always update local state first
      console.log("StepManagementDialog: Removing automation rule from local state")
      setStepData(prev => ({
        ...prev,
        automationRules: prev.automationRules?.filter(rule => rule._id !== ruleId) || []
      }))

      // For existing steps, also call the API
      if (!isNew) {
        console.log("StepManagementDialog: Removing automation rule via API for existing step")
        await onRemoveAutomationRule(ruleId)
      }

      console.log("StepManagementDialog: Automation rule removed successfully")
      toast({
        title: "Success",
        description: "Automation rule removed successfully"
      })
    } catch (error: any) {
      console.error("StepManagementDialog: Error removing automation rule:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove automation rule",
        variant: "destructive"
      })
    }
  }

  const addChecklistItem = () => {
    if (newChecklistItem.trim()) {
      console.log("StepManagementDialog: Adding checklist item:", newChecklistItem.trim())
      setStepData(prev => ({
        ...prev,
        checklistItems: [...(prev.checklistItems || []), newChecklistItem.trim()]
      }))
      setNewChecklistItem("")
    }
  }

  const removeChecklistItem = (index: number) => {
    console.log("StepManagementDialog: Removing checklist item at index:", index)
    setStepData(prev => ({
      ...prev,
      checklistItems: prev.checklistItems?.filter((_, i) => i !== index) || []
    }))
  }

  const addTool = () => {
    if (newTool.trim()) {
      console.log("StepManagementDialog: Adding tool:", newTool.trim())
      setStepData(prev => ({
        ...prev,
        tools: [...(prev.tools || []), newTool.trim()]
      }))
      setNewTool("")
    }
  }

  const removeTool = (index: number) => {
    console.log("StepManagementDialog: Removing tool at index:", index)
    setStepData(prev => ({
      ...prev,
      tools: prev.tools?.filter((_, i) => i !== index) || []
    }))
  }

  const addSkill = () => {
    if (newSkill.trim()) {
      console.log("StepManagementDialog: Adding skill:", newSkill.trim())
      setStepData(prev => ({
        ...prev,
        skills: [...(prev.skills || []), newSkill.trim()]
      }))
      setNewSkill("")
    }
  }

  const removeSkill = (index: number) => {
    console.log("StepManagementDialog: Removing skill at index:", index)
    setStepData(prev => ({
      ...prev,
      skills: prev.skills?.filter((_, i) => i !== index) || []
    }))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {isNew ? 'Create New Step' : 'Edit Step'}
            </DialogTitle>
            <DialogDescription>
              {isNew ? 'Create a new workflow step with interactive elements' : 'Modify step properties and interactive elements'}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="forms">Forms</TabsTrigger>
              <TabsTrigger value="automation">Automation</TabsTrigger>
              <TabsTrigger value="requirements">Requirements</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="step-name">Step Name *</Label>
                  <Input
                    id="step-name"
                    value={stepData.name || ""}
                    onChange={(e) => setStepData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter step name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="step-category">Category *</Label>
                  <Select
                    value={stepData.category || "diagnostic"}
                    onValueChange={(value) => setStepData(prev => ({ ...prev, category: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="step-description">Description *</Label>
                <Textarea
                  id="step-description"
                  value={stepData.description || ""}
                  onChange={(e) => setStepData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter step description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estimated-time">Estimated Time (minutes)</Label>
                  <Input
                    id="estimated-time"
                    type="number"
                    value={stepData.estimatedTime || 30}
                    onChange={(e) => setStepData(prev => ({ ...prev, estimatedTime: parseInt(e.target.value) || 30 }))}
                    min="1"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is-required"
                      checked={stepData.isRequired || false}
                      onCheckedChange={(checked) => setStepData(prev => ({ ...prev, isRequired: checked }))}
                    />
                    <Label htmlFor="is-required">Required Step</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="can-skip"
                      checked={stepData.canSkip || false}
                      onCheckedChange={(checked) => setStepData(prev => ({ ...prev, canSkip: checked }))}
                    />
                    <Label htmlFor="can-skip">Can Skip</Label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="requires-approval"
                    checked={stepData.requiresApproval || false}
                    onCheckedChange={(checked) => setStepData(prev => ({ ...prev, requiresApproval: checked }))}
                  />
                  <Label htmlFor="requires-approval">Requires Approval</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="requires-form"
                    checked={stepData.requiresFormCompletion || false}
                    onCheckedChange={(checked) => setStepData(prev => ({ ...prev, requiresFormCompletion: checked }))}
                  />
                  <Label htmlFor="requires-form">Requires Form Completion</Label>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Notification Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="notify-start"
                      checked={stepData.notificationSettings?.onStart || false}
                      onCheckedChange={(checked) => setStepData(prev => ({
                        ...prev,
                        notificationSettings: {
                          ...prev.notificationSettings,
                          onStart: checked
                        }
                      }))}
                    />
                    <Label htmlFor="notify-start">Notify on Start</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="notify-complete"
                      checked={stepData.notificationSettings?.onComplete || false}
                      onCheckedChange={(checked) => setStepData(prev => ({
                        ...prev,
                        notificationSettings: {
                          ...prev.notificationSettings,
                          onComplete: checked
                        }
                      }))}
                    />
                    <Label htmlFor="notify-complete">Notify on Complete</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="notify-delay"
                      checked={stepData.notificationSettings?.onDelay || false}
                      onCheckedChange={(checked) => setStepData(prev => ({
                        ...prev,
                        notificationSettings: {
                          ...prev.notificationSettings,
                          onDelay: checked
                        }
                      }))}
                    />
                    <Label htmlFor="notify-delay">Notify on Delay</Label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="forms" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FormInput className="h-5 w-5" />
                    Interactive Form Elements
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Add checkboxes, text areas, and other interactive elements for data collection
                  </p>
                </div>
                <Button onClick={() => setShowFormFieldDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Form Field
                </Button>
              </div>

              <div className="space-y-3">
                {stepData.formFields && stepData.formFields.length > 0 ? (
                  stepData.formFields.map((field) => (
                    <Card key={field.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{field.type}</Badge>
                            {field.required && <Badge variant="destructive">Required</Badge>}
                            {field.isConditional && <Badge variant="secondary">Conditional</Badge>}
                          </div>
                          <h4 className="font-medium">{field.label}</h4>
                          <p className="text-sm text-muted-foreground">{field.name}</p>
                          {field.helpText && (
                            <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>
                          )}
                          {field.options && field.options.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium">Options:</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {field.options.map((option, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {option.label}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingFormField(field)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveFormField(field.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <Card className="p-8 text-center">
                    <FormInput className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">No Form Fields</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add interactive form elements like checkboxes, text areas, and dropdowns to collect data during this step.
                    </p>
                    <Button onClick={() => setShowFormFieldDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Form Field
                    </Button>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="automation" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Automation Rules
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Configure automatic actions and triggers for this step
                  </p>
                </div>
                <Button onClick={() => setShowAutomationDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>

              <div className="space-y-3">
                {stepData.automationRules && stepData.automationRules.length > 0 ? (
                  stepData.automationRules.map((rule) => (
                    <Card key={rule._id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={rule.isActive ? "default" : "secondary"}>
                              {rule.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Badge variant="outline">{rule.trigger}</Badge>
                          </div>
                          <h4 className="font-medium">
                            When: {triggerOptions.find(t => t.value === rule.trigger)?.label}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Action: {actionOptions.find(a => a.value === rule.action)?.label}
                          </p>
                          {rule.condition && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Condition: {rule.condition}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingAutomationRule(rule)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveAutomationRule(rule._id!)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <Card className="p-8 text-center">
                    <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">No Automation Rules</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add automation rules to trigger actions automatically when certain conditions are met.
                    </p>
                    <Button onClick={() => setShowAutomationDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Rule
                    </Button>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="requirements" className="space-y-4">
              <div className="grid gap-6">
                {/* Checklist Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckSquare className="h-4 w-4" />
                      Checklist Items
                    </CardTitle>
                    <CardDescription>
                      Add mandatory checklist items that must be completed
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        placeholder="Enter checklist item"
                        onKeyPress={(e) => e.key === 'Enter' && addChecklistItem()}
                      />
                      <Button onClick={addChecklistItem} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {stepData.checklistItems?.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm">{item}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeChecklistItem(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Required Tools */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Required Tools
                    </CardTitle>
                    <CardDescription>
                      Specify tools needed for this step
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={newTool}
                        onChange={(e) => setNewTool(e.target.value)}
                        placeholder="Enter tool name"
                        onKeyPress={(e) => e.key === 'Enter' && addTool()}
                      />
                      <Button onClick={addTool} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {stepData.tools?.map((tool, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {tool}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 ml-1"
                            onClick={() => removeTool(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Required Skills */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Required Skills
                    </CardTitle>
                    <CardDescription>
                      Specify skills or certifications needed
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        placeholder="Enter skill requirement"
                        onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                      />
                      <Button onClick={addSkill} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {stepData.skills?.map((skill, index) => (
                        <Badge key={index} variant="outline" className="flex items-center gap-1">
                          {skill}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 ml-1"
                            onClick={() => removeSkill(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isNew ? 'Create Step' : 'Save Changes'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Field Dialog */}
      <Dialog open={showFormFieldDialog} onOpenChange={setShowFormFieldDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Form Field</DialogTitle>
            <DialogDescription>
              Create an interactive form element for data collection
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="field-name">Field Name *</Label>
                <Input
                  id="field-name"
                  value={newFormField.name || ""}
                  onChange={(e) => setNewFormField(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="field_name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-label">Display Label *</Label>
                <Input
                  id="field-label"
                  value={newFormField.label || ""}
                  onChange={(e) => setNewFormField(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Field Label"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="field-type">Field Type *</Label>
                <Select
                  value={newFormField.type || "text"}
                  onValueChange={(value) => setNewFormField(prev => ({ ...prev, type: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="field-required"
                  checked={newFormField.required || false}
                  onCheckedChange={(checked) => setNewFormField(prev => ({ ...prev, required: checked }))}
                />
                <Label htmlFor="field-required">Required Field</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="field-placeholder">Placeholder Text</Label>
              <Input
                id="field-placeholder"
                value={newFormField.placeholder || ""}
                onChange={(e) => setNewFormField(prev => ({ ...prev, placeholder: e.target.value }))}
                placeholder="Enter placeholder text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="field-help">Help Text</Label>
              <Textarea
                id="field-help"
                value={newFormField.helpText || ""}
                onChange={(e) => setNewFormField(prev => ({ ...prev, helpText: e.target.value }))}
                placeholder="Additional help or instructions"
                rows={2}
              />
            </div>
            {(newFormField.type === 'select' || newFormField.type === 'multiselect' || newFormField.type === 'radio') && (
              <div className="space-y-2">
                <Label>Options (one per line)</Label>
                <Textarea
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  onChange={(e) => {
                    const options = e.target.value.split('\n').filter(line => line.trim()).map(line => ({
                      value: line.trim().toLowerCase().replace(/\s+/g, '_'),
                      label: line.trim()
                    }))
                    setNewFormField(prev => ({ ...prev, options }))
                  }}
                  rows={4}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormFieldDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddFormField}>
              Add Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Form Field Dialog */}
      <Dialog open={!!editingFormField} onOpenChange={(open) => !open && setEditingFormField(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Form Field</DialogTitle>
            <DialogDescription>
              Modify the form field properties
            </DialogDescription>
          </DialogHeader>
          {editingFormField && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-field-name">Field Name *</Label>
                  <Input
                    id="edit-field-name"
                    value={editingFormField.name || ""}
                    onChange={(e) => setEditingFormField(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                    placeholder="field_name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-field-label">Display Label *</Label>
                  <Input
                    id="edit-field-label"
                    value={editingFormField.label || ""}
                    onChange={(e) => setEditingFormField(prev => prev ? ({ ...prev, label: e.target.value }) : null)}
                    placeholder="Field Label"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-field-type">Field Type *</Label>
                  <Select
                    value={editingFormField.type || "text"}
                    onValueChange={(value) => setEditingFormField(prev => prev ? ({ ...prev, type: value as any }) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="edit-field-required"
                    checked={editingFormField.required || false}
                    onCheckedChange={(checked) => setEditingFormField(prev => prev ? ({ ...prev, required: checked }) : null)}
                  />
                  <Label htmlFor="edit-field-required">Required Field</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-field-placeholder">Placeholder Text</Label>
                <Input
                  id="edit-field-placeholder"
                  value={editingFormField.placeholder || ""}
                  onChange={(e) => setEditingFormField(prev => prev ? ({ ...prev, placeholder: e.target.value }) : null)}
                  placeholder="Enter placeholder text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-field-help">Help Text</Label>
                <Textarea
                  id="edit-field-help"
                  value={editingFormField.helpText || ""}
                  onChange={(e) => setEditingFormField(prev => prev ? ({ ...prev, helpText: e.target.value }) : null)}
                  placeholder="Additional help or instructions"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFormField(null)}>
              Cancel
            </Button>
            <Button onClick={() => editingFormField && handleUpdateFormField(editingFormField.id, editingFormField)}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Automation Rule Dialog */}
      <Dialog open={showAutomationDialog} onOpenChange={setShowAutomationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Automation Rule</DialogTitle>
            <DialogDescription>
              Configure automatic actions for this step
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule-trigger">Trigger *</Label>
                <Select
                  value={newAutomationRule.trigger || "step_completion"}
                  onValueChange={(value) => setNewAutomationRule(prev => ({ ...prev, trigger: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-action">Action *</Label>
                <Select
                  value={newAutomationRule.action || "send_notification"}
                  onValueChange={(value) => setNewAutomationRule(prev => ({ ...prev, action: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {actionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-condition">Condition (optional)</Label>
              <Input
                id="rule-condition"
                value={newAutomationRule.condition || ""}
                onChange={(e) => setNewAutomationRule(prev => ({ ...prev, condition: e.target.value }))}
                placeholder="e.g., status == 'completed'"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="rule-active"
                checked={newAutomationRule.isActive || false}
                onCheckedChange={(checked) => setNewAutomationRule(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="rule-active">Active Rule</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutomationDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAutomationRule}>
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}