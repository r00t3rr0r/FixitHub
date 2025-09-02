import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/useToast"
import { WorkflowStep, FormField, AutomationRule } from "@/api/workflow"
import {
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Clock,
  CheckCircle,
  AlertTriangle,
  FormInput,
  Zap,
  Settings,
  FileText,
  List,
  Wrench,
  User,
  Bell
} from "lucide-react"

interface StepFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  step?: WorkflowStep | null
  onSave: (stepData: Partial<WorkflowStep>) => Promise<void>
  mode: 'create' | 'edit'
  existingSteps?: WorkflowStep[]
}

export function StepFormDialog({
  open,
  onOpenChange,
  step,
  onSave,
  mode,
  existingSteps = []
}: StepFormDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("basic")

  // Form state
  const [formData, setFormData] = useState<Partial<WorkflowStep>>({
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

  // Form field editing state
  const [editingFormField, setEditingFormField] = useState<FormField | null>(null)
  const [showFormFieldDialog, setShowFormFieldDialog] = useState(false)
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

  // Automation rule editing state
  const [editingAutomationRule, setEditingAutomationRule] = useState<AutomationRule | null>(null)
  const [showAutomationDialog, setShowAutomationDialog] = useState(false)
  const [newAutomationRule, setNewAutomationRule] = useState<Partial<AutomationRule>>({
    trigger: "step_completion",
    action: "send_notification",
    isActive: true
  })

  // Input states for arrays
  const [newTool, setNewTool] = useState("")
  const [newSkill, setNewSkill] = useState("")
  const [newChecklistItem, setNewChecklistItem] = useState("")

  const categoryOptions = [
    { value: "diagnostic", label: "Diagnostic", icon: AlertTriangle },
    { value: "repair", label: "Repair", icon: Wrench },
    { value: "quality", label: "Quality Check", icon: CheckCircle },
    { value: "addon", label: "Add-on Service", icon: Plus },
    { value: "completion", label: "Completion", icon: FileText }
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
    console.log("StepFormDialog: Dialog opened with mode:", mode, "step:", step?.name)
    if (step && mode === 'edit') {
      console.log("StepFormDialog: Loading existing step data for editing")
      setFormData({
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
    } else if (mode === 'create') {
      console.log("StepFormDialog: Initializing form for new step creation")
      setFormData({
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
  }, [step, mode, open])

  const handleSave = async () => {
    console.log("StepFormDialog: Attempting to save step with data:", formData)

    if (!formData.name || !formData.description || !formData.category) {
      console.error("StepFormDialog: Validation failed - missing required fields")
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      console.log("StepFormDialog: Calling onSave with form data")
      await onSave(formData)
      console.log("StepFormDialog: Step saved successfully")
      onOpenChange(false)
      toast({
        title: "Success",
        description: `Workflow step ${mode === 'create' ? 'created' : 'updated'} successfully`
      })
    } catch (error: any) {
      console.error("StepFormDialog: Error saving step:", error)
      toast({
        title: "Error",
        description: error.message || `Failed to ${mode} workflow step`,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddTool = () => {
    if (newTool.trim()) {
      console.log("StepFormDialog: Adding tool:", newTool.trim())
      setFormData(prev => ({
        ...prev,
        tools: [...(prev.tools || []), newTool.trim()]
      }))
      setNewTool("")
    }
  }

  const handleRemoveTool = (index: number) => {
    console.log("StepFormDialog: Removing tool at index:", index)
    setFormData(prev => ({
      ...prev,
      tools: prev.tools?.filter((_, i) => i !== index) || []
    }))
  }

  const handleAddSkill = () => {
    if (newSkill.trim()) {
      console.log("StepFormDialog: Adding skill:", newSkill.trim())
      setFormData(prev => ({
        ...prev,
        skills: [...(prev.skills || []), newSkill.trim()]
      }))
      setNewSkill("")
    }
  }

  const handleRemoveSkill = (index: number) => {
    console.log("StepFormDialog: Removing skill at index:", index)
    setFormData(prev => ({
      ...prev,
      skills: prev.skills?.filter((_, i) => i !== index) || []
    }))
  }

  const handleAddChecklistItem = () => {
    if (newChecklistItem.trim()) {
      console.log("StepFormDialog: Adding checklist item:", newChecklistItem.trim())
      setFormData(prev => ({
        ...prev,
        checklistItems: [...(prev.checklistItems || []), newChecklistItem.trim()]
      }))
      setNewChecklistItem("")
    }
  }

  const handleRemoveChecklistItem = (index: number) => {
    console.log("StepFormDialog: Removing checklist item at index:", index)
    setFormData(prev => ({
      ...prev,
      checklistItems: prev.checklistItems?.filter((_, i) => i !== index) || []
    }))
  }

  const handleAddFormField = () => {
    if (!newFormField.name || !newFormField.label) {
      console.error("StepFormDialog: Form field validation failed - missing name or label")
      toast({
        title: "Error",
        description: "Please fill in field name and label",
        variant: "destructive"
      })
      return
    }

    const fieldData: FormField = {
      ...newFormField,
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      order: formData.formFields?.length || 0,
      isConditional: newFormField.isConditional || false
    } as FormField

    console.log("StepFormDialog: Adding form field:", fieldData)
    setFormData(prev => ({
      ...prev,
      formFields: [...(prev.formFields || []), fieldData]
    }))

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
    setShowFormFieldDialog(false)
  }

  const handleEditFormField = (field: FormField) => {
    console.log("StepFormDialog: Editing form field:", field.name)
    setEditingFormField(field)
    setNewFormField({ ...field })
    setShowFormFieldDialog(true)
  }

  const handleUpdateFormField = () => {
    if (!editingFormField || !newFormField.name || !newFormField.label) {
      console.error("StepFormDialog: Form field update validation failed")
      toast({
        title: "Error",
        description: "Please fill in field name and label",
        variant: "destructive"
      })
      return
    }

    console.log("StepFormDialog: Updating form field:", editingFormField.id)
    setFormData(prev => ({
      ...prev,
      formFields: prev.formFields?.map(field =>
        field.id === editingFormField.id ? { ...newFormField } as FormField : field
      ) || []
    }))

    setEditingFormField(null)
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
    setShowFormFieldDialog(false)
  }

  const handleRemoveFormField = (fieldId: string) => {
    console.log("StepFormDialog: Removing form field:", fieldId)
    setFormData(prev => ({
      ...prev,
      formFields: prev.formFields?.filter(field => field.id !== fieldId) || []
    }))
  }

  const handleAddAutomationRule = () => {
    if (!newAutomationRule.trigger || !newAutomationRule.action) {
      console.error("StepFormDialog: Automation rule validation failed - missing trigger or action")
      toast({
        title: "Error",
        description: "Please select trigger and action",
        variant: "destructive"
      })
      return
    }

    const ruleData: AutomationRule = {
      ...newAutomationRule
    } as AutomationRule

    console.log("StepFormDialog: Adding automation rule:", ruleData)
    setFormData(prev => ({
      ...prev,
      automationRules: [...(prev.automationRules || []), ruleData]
    }))

    setNewAutomationRule({
      trigger: "step_completion",
      action: "send_notification",
      isActive: true
    })
    setShowAutomationDialog(false)
  }

  const handleEditAutomationRule = (rule: AutomationRule) => {
    console.log("StepFormDialog: Editing automation rule:", rule._id)
    setEditingAutomationRule(rule)
    setNewAutomationRule({ ...rule })
    setShowAutomationDialog(true)
  }

  const handleUpdateAutomationRule = () => {
    if (!editingAutomationRule || !newAutomationRule.trigger || !newAutomationRule.action) {
      console.error("StepFormDialog: Automation rule update validation failed")
      toast({
        title: "Error",
        description: "Please select trigger and action",
        variant: "destructive"
      })
      return
    }

    console.log("StepFormDialog: Updating automation rule:", editingAutomationRule._id)
    setFormData(prev => ({
      ...prev,
      automationRules: prev.automationRules?.map(rule =>
        rule._id === editingAutomationRule._id ? { ...newAutomationRule } as AutomationRule : rule
      ) || []
    }))

    setEditingAutomationRule(null)
    setNewAutomationRule({
      trigger: "step_completion",
      action: "send_notification",
      isActive: true
    })
    setShowAutomationDialog(false)
  }

  const handleRemoveAutomationRule = (ruleId: string) => {
    console.log("StepFormDialog: Removing automation rule:", ruleId)
    setFormData(prev => ({
      ...prev,
      automationRules: prev.automationRules?.filter(rule => rule._id !== ruleId) || []
    }))
  }

  const handleDependencyChange = (stepId: string, checked: boolean) => {
    console.log("StepFormDialog: Dependency change for step:", stepId, "checked:", checked)
    if (checked) {
      setFormData(prev => ({
        ...prev,
        dependencies: [...(prev.dependencies || []), stepId]
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        dependencies: prev.dependencies?.filter(id => id !== stepId) || []
      }))
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'Create New Step' : 'Edit Step'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? 'Add a new step to the workflow with interactive forms and automation rules'
                : 'Modify step properties, forms, and automation rules'
              }
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Basic
              </TabsTrigger>
              <TabsTrigger value="requirements" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                Requirements
              </TabsTrigger>
              <TabsTrigger value="forms" className="flex items-center gap-2">
                <FormInput className="h-4 w-4" />
                Forms
              </TabsTrigger>
              <TabsTrigger value="automation" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Automation
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="step-name">Step Name *</Label>
                  <Input
                    id="step-name"
                    value={formData.name || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter step name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className="h-4 w-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
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
                    value={formData.estimatedTime || 30}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimatedTime: parseInt(e.target.value) || 30 }))}
                    min="1"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is-required"
                      checked={formData.isRequired || false}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isRequired: checked }))}
                    />
                    <Label htmlFor="is-required">Required Step</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="can-skip"
                      checked={formData.canSkip || false}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, canSkip: checked }))}
                    />
                    <Label htmlFor="can-skip">Can Skip</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="requires-approval"
                      checked={formData.requiresApproval || false}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requiresApproval: checked }))}
                    />
                    <Label htmlFor="requires-approval">Requires Approval</Label>
                  </div>
                </div>
              </div>

              {existingSteps.length > 0 && (
                <div className="space-y-2">
                  <Label>Dependencies</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {existingSteps
                      .filter(s => s._id !== step?._id)
                      .map((existingStep) => (
                        <div key={existingStep._id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`dep-${existingStep._id}`}
                            checked={formData.dependencies?.includes(existingStep._id) || false}
                            onCheckedChange={(checked) => handleDependencyChange(existingStep._id, checked as boolean)}
                          />
                          <Label htmlFor={`dep-${existingStep._id}`} className="text-sm">
                            {existingStep.name}
                          </Label>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="requirements" className="space-y-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5" />
                      Required Tools
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={newTool}
                        onChange={(e) => setNewTool(e.target.value)}
                        placeholder="Enter tool name"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddTool()}
                      />
                      <Button onClick={handleAddTool} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.tools?.map((tool, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {tool}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => handleRemoveTool(index)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Required Skills
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        placeholder="Enter skill requirement"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
                      />
                      <Button onClick={handleAddSkill} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.skills?.map((skill, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {skill}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => handleRemoveSkill(index)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Checklist Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        placeholder="Enter checklist item"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddChecklistItem()}
                      />
                      <Button onClick={handleAddChecklistItem} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {formData.checklistItems?.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm">{item}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveChecklistItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="forms" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Interactive Form Fields</h3>
                  <p className="text-sm text-muted-foreground">
                    Add form fields for data collection, diagnostics, and checklists
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="requires-form"
                    checked={formData.requiresFormCompletion || false}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requiresFormCompletion: checked }))}
                  />
                  <Label htmlFor="requires-form">Require Form Completion</Label>
                </div>
              </div>

              <Button onClick={() => setShowFormFieldDialog(true)} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Form Field
              </Button>

              <div className="space-y-3">
                {formData.formFields?.map((field) => (
                  <Card key={field.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{field.type}</Badge>
                            {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                            {field.isConditional && <Badge variant="secondary" className="text-xs">Conditional</Badge>}
                          </div>
                          <h4 className="font-medium">{field.label}</h4>
                          <p className="text-sm text-muted-foreground">{field.name}</p>
                          {field.helpText && (
                            <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditFormField(field)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFormField(field.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="automation" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Automation Rules</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure automatic actions based on step events and conditions
                  </p>
                </div>
              </div>

              <Button onClick={() => setShowAutomationDialog(true)} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Automation Rule
              </Button>

              <div className="space-y-3">
                {formData.automationRules?.map((rule) => (
                  <Card key={rule._id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{rule.trigger}</Badge>
                            <Badge variant="secondary">{rule.action}</Badge>
                            {rule.isActive ? (
                              <Badge variant="default" className="text-xs">Active</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">Inactive</Badge>
                            )}
                          </div>
                          <p className="text-sm">
                            When <strong>{rule.trigger.replace('_', ' ')}</strong> → <strong>{rule.action.replace('_', ' ')}</strong>
                          </p>
                          {rule.condition && (
                            <p className="text-xs text-muted-foreground mt-1">Condition: {rule.condition}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditAutomationRule(rule)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAutomationRule(rule._id!)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-4">Notification Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="notify-start">Notify on Step Start</Label>
                      <p className="text-sm text-muted-foreground">Send notification when step begins</p>
                    </div>
                    <Switch
                      id="notify-start"
                      checked={formData.notificationSettings?.onStart || false}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        notificationSettings: {
                          ...prev.notificationSettings,
                          onStart: checked
                        }
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="notify-complete">Notify on Step Completion</Label>
                      <p className="text-sm text-muted-foreground">Send notification when step is completed</p>
                    </div>
                    <Switch
                      id="notify-complete"
                      checked={formData.notificationSettings?.onComplete || false}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        notificationSettings: {
                          ...prev.notificationSettings,
                          onComplete: checked
                        }
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="notify-delay">Notify on Delay</Label>
                      <p className="text-sm text-muted-foreground">Send notification if step takes longer than estimated</p>
                    </div>
                    <Switch
                      id="notify-delay"
                      checked={formData.notificationSettings?.onDelay || false}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        notificationSettings: {
                          ...prev.notificationSettings,
                          onDelay: checked
                        }
                      }))}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {mode === 'create' ? 'Create Step' : 'Update Step'}
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
            <DialogTitle>
              {editingFormField ? 'Edit Form Field' : 'Add Form Field'}
            </DialogTitle>
            <DialogDescription>
              Configure an interactive form field for data collection
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
                <Label htmlFor="field-label">Field Label *</Label>
                <Input
                  id="field-label"
                  value={newFormField.label || ""}
                  onChange={(e) => setNewFormField(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Display Label"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="field-type">Field Type</Label>
                <Select
                  value={newFormField.type}
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
              <div className="flex items-center space-x-2 pt-8">
                <Switch
                  id="field-required"
                  checked={newFormField.required || false}
                  onCheckedChange={(checked) => setNewFormField(prev => ({ ...prev, required: checked }))}
                />
                <Label htmlFor="field-required">Required</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="field-placeholder">Placeholder</Label>
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
                  value={newFormField.options?.map(opt => `${opt.value}:${opt.label}`).join('\n') || ""}
                  onChange={(e) => {
                    const lines = e.target.value.split('\n').filter(line => line.trim())
                    const options = lines.map(line => {
                      const [value, label] = line.split(':')
                      return { value: value?.trim() || '', label: label?.trim() || value?.trim() || '' }
                    })
                    setNewFormField(prev => ({ ...prev, options }))
                  }}
                  placeholder="value1:Label 1&#10;value2:Label 2"
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormFieldDialog(false)}>
              Cancel
            </Button>
            <Button onClick={editingFormField ? handleUpdateFormField : handleAddFormField}>
              {editingFormField ? 'Update Field' : 'Add Field'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Automation Rule Dialog */}
      <Dialog open={showAutomationDialog} onOpenChange={setShowAutomationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAutomationRule ? 'Edit Automation Rule' : 'Add Automation Rule'}
            </DialogTitle>
            <DialogDescription>
              Configure automatic actions for this step
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule-trigger">Trigger</Label>
                <Select
                  value={newAutomationRule.trigger}
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
                <Label htmlFor="rule-action">Action</Label>
                <Select
                  value={newAutomationRule.action}
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
                placeholder="e.g., form_field_value == 'failed'"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="rule-active"
                checked={newAutomationRule.isActive || false}
                onCheckedChange={(checked) => setNewAutomationRule(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="rule-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutomationDialog(false)}>
              Cancel
            </Button>
            <Button onClick={editingAutomationRule ? handleUpdateAutomationRule : handleAddAutomationRule}>
              {editingAutomationRule ? 'Update Rule' : 'Add Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}