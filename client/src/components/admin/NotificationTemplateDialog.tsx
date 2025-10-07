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
import { useToast } from "@/hooks/useToast"
import { NotificationTemplate } from "@/api/systemConfig"
import { Plus, X, Save, Eye } from "lucide-react"

interface NotificationTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: NotificationTemplate | null
  onSave: (template: Omit<NotificationTemplate, '_id'>) => Promise<void>
  mode: 'create' | 'edit'
}

export function NotificationTemplateDialog({
  open,
  onOpenChange,
  template,
  onSave,
  mode
}: NotificationTemplateDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const [formData, setFormData] = useState<Omit<NotificationTemplate, '_id'>>({
    name: '',
    type: 'email',
    subject: '',
    content: '',
    variables: [],
    isActive: true
  })

  const [newVariable, setNewVariable] = useState({
    name: '',
    description: '',
    required: false
  })

  const commonVariables = [
    { name: 'customerName', description: 'Customer full name', required: false },
    { name: 'orderNumber', description: 'Order number', required: false },
    { name: 'deviceBrand', description: 'Device brand', required: false },
    { name: 'deviceModel', description: 'Device model', required: false },
    { name: 'serviceName', description: 'Service name', required: false },
    { name: 'totalCost', description: 'Total cost', required: false },
    { name: 'estimatedCompletion', description: 'Estimated completion date', required: false },
    { name: 'companyName', description: 'Company name', required: false },
    { name: 'supportEmail', description: 'Support email', required: false }
  ]

  useEffect(() => {
    if (template && mode === 'edit') {
      setFormData({
        name: template.name,
        type: template.type,
        subject: template.subject || '',
        content: template.content,
        variables: template.variables || [],
        isActive: template.isActive
      })
    } else if (mode === 'create') {
      setFormData({
        name: '',
        type: 'email',
        subject: '',
        content: '',
        variables: [],
        isActive: true
      })
    }
  }, [template, mode, open])

  const handleSave = async () => {
    if (!formData.name || !formData.content) {
      toast({
        title: "Error",
        description: "Name and content are required",
        variant: "destructive"
      })
      return
    }

    if (formData.type === 'email' && !formData.subject) {
      toast({
        title: "Error",
        description: "Subject is required for email templates",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      await onSave(formData)
      onOpenChange(false)
      toast({
        title: "Success",
        description: `Template ${mode === 'create' ? 'created' : 'updated'} successfully`
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const addVariable = () => {
    if (!newVariable.name) {
      toast({
        title: "Error",
        description: "Variable name is required",
        variant: "destructive"
      })
      return
    }

    if (formData.variables.some(v => v.name === newVariable.name)) {
      toast({
        title: "Error",
        description: "Variable with this name already exists",
        variant: "destructive"
      })
      return
    }

    setFormData(prev => ({
      ...prev,
      variables: [...prev.variables, { ...newVariable }]
    }))

    setNewVariable({ name: '', description: '', required: false })
  }

  const removeVariable = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index)
    }))
  }

  const addCommonVariable = (variable: typeof commonVariables[0]) => {
    if (formData.variables.some(v => v.name === variable.name)) {
      toast({
        title: "Error",
        description: "Variable already exists",
        variant: "destructive"
      })
      return
    }

    setFormData(prev => ({
      ...prev,
      variables: [...prev.variables, variable]
    }))
  }

  const renderPreview = () => {
    let content = formData.content
    formData.variables.forEach(variable => {
      const placeholder = `{{${variable.name}}}`
      const sampleValue = getSampleValue(variable.name)
      content = content.replace(new RegExp(placeholder, 'g'), sampleValue)
    })

    return content
  }

  const getSampleValue = (variableName: string) => {
    const sampleValues: Record<string, string> = {
      customerName: 'John Doe',
      orderNumber: 'ORD-001',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 12',
      serviceName: 'Screen Replacement',
      totalCost: '$299.99',
      estimatedCompletion: 'March 15, 2024',
      companyName: 'FixitHub',
      supportEmail: 'support@fixithub.com'
    }
    return sampleValues[variableName] || `[${variableName}]`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create Notification Template' : 'Edit Notification Template'}
          </DialogTitle>
          <DialogDescription>
            Create customizable notification templates with dynamic variables
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Basic Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter template name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: 'email' | 'sms' | 'push') => 
                  setFormData(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="push">Push Notification</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subject (for email) */}
          {formData.type === 'email' && (
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Enter email subject"
              />
            </div>
          )}

          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Content *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-4 w-4 mr-2" />
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </Button>
            </div>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Enter template content. Use {{variableName}} for dynamic content."
              rows={8}
            />
            {showPreview && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm bg-muted p-3 rounded">
                    {renderPreview()}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Variables */}
          <div className="space-y-4">
            <Label>Variables</Label>
            
            {/* Common Variables */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Common Variables</CardTitle>
                <CardDescription>Click to add commonly used variables</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {commonVariables.map((variable) => (
                    <Button
                      key={variable.name}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addCommonVariable(variable)}
                      disabled={formData.variables.some(v => v.name === variable.name)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {variable.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Add Custom Variable */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Add Custom Variable</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <Input
                    placeholder="Variable name"
                    value={newVariable.name}
                    onChange={(e) => setNewVariable(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <Input
                    placeholder="Description"
                    value={newVariable.description}
                    onChange={(e) => setNewVariable(prev => ({ ...prev, description: e.target.value }))}
                  />
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={newVariable.required}
                      onCheckedChange={(checked) => setNewVariable(prev => ({ ...prev, required: checked }))}
                    />
                    <Label className="text-sm">Required</Label>
                  </div>
                  <Button type="button" onClick={addVariable}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Current Variables */}
            {formData.variables.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Current Variables</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {formData.variables.map((variable, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {`{{${variable.name}}}`}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {variable.description}
                          </span>
                          {variable.required && (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVariable(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Active Status */}
          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
            />
            <Label>Active Template</Label>
          </div>
        </div>

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
                {mode === 'create' ? 'Create Template' : 'Update Template'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}