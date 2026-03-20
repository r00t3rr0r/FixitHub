import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/useToast"
import { Integration } from "@/api/systemConfig"
import { Save, TestTube } from "lucide-react"

interface IntegrationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  integration?: Integration | null
  onSave: (integration: Omit<Integration, '_id'>) => Promise<void>
  mode: 'create' | 'edit'
}

export function IntegrationDialog({
  open,
  onOpenChange,
  integration,
  onSave,
  mode
}: IntegrationDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState<Omit<Integration, '_id'>>({
    name: '',
    type: 'email',
    provider: '',
    apiKey: '',
    apiSecret: '',
    endpoint: '',
    settings: {},
    isActive: true,
    testStatus: 'pending'
  })

  const integrationTypes = [
    { value: 'email', label: 'Email Service' },
    { value: 'sms', label: 'SMS Service' },
    { value: 'payment', label: 'Payment Gateway' },
    { value: 'storage', label: 'Cloud Storage' },
    { value: 'analytics', label: 'Analytics' },
    { value: 'shipping', label: 'Shipping & Tracking' }
  ]

  const providers = {
    email: ['SendGrid', 'Mailgun', 'Amazon SES', 'SMTP'],
    sms: ['Twilio', 'Nexmo', 'Amazon SNS'],
    payment: ['Stripe', 'PayPal', 'Square'],
    storage: ['AWS S3', 'Google Cloud Storage', 'Azure Blob'],
    analytics: ['Google Analytics', 'Mixpanel', 'Amplitude'],
    shipping: ['DHL', 'FedEx', 'UPS', 'USPS']
  }

  useEffect(() => {
    if (integration && mode === 'edit') {
      setFormData({
        name: integration.name,
        type: integration.type,
        provider: integration.provider,
        apiKey: integration.apiKey,
        apiSecret: integration.apiSecret || '',
        endpoint: integration.endpoint || '',
        settings: integration.settings || {},
        isActive: integration.isActive,
        testStatus: integration.testStatus
      })
    } else if (mode === 'create') {
      setFormData({
        name: '',
        type: 'email',
        provider: '',
        apiKey: '',
        apiSecret: '',
        endpoint: '',
        settings: {},
        isActive: true,
        testStatus: 'pending'
      })
    }
  }, [integration, mode, open])

  const handleSave = async () => {
    if (!formData.name || !formData.provider || !formData.apiKey) {
      toast({
        title: "Error",
        description: "Name, provider, and API key are required",
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
        description: `Integration ${mode === 'create' ? 'created' : 'updated'} successfully`
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white p-6 rounded-t-lg">
          <DialogTitle className="text-xl">
            {mode === 'create' ? 'Add Integration' : 'Edit Integration'}
          </DialogTitle>
          <DialogDescription className="text-blue-100 text-sm mt-2">
            Configure third-party service integration settings
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4 px-6">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-sm">Integration Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter integration name"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="type" className="text-sm">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value, provider: '' }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {integrationTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="provider" className="text-sm">Provider *</Label>
              <Select
                value={formData.provider}
                onValueChange={(value) => setFormData(prev => ({ ...prev, provider: value }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers[formData.type as keyof typeof providers]?.map(provider => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="endpoint" className="text-sm">Endpoint URL</Label>
              <Input
                id="endpoint"
                value={formData.endpoint}
                onChange={(e) => setFormData(prev => ({ ...prev, endpoint: e.target.value }))}
                placeholder="https://api.example.com"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="apiKey" className="text-sm">API Key *</Label>
            <Input
              id="apiKey"
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="Enter API key"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="apiSecret" className="text-sm">API Secret</Label>
            <Input
              id="apiSecret"
              type="password"
              value={formData.apiSecret}
              onChange={(e) => setFormData(prev => ({ ...prev, apiSecret: e.target.value }))}
              placeholder="Enter API secret (if required)"
              className="h-9 text-sm"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
            />
            <Label className="text-sm">Active Integration</Label>
          </div>
        </div>

        <DialogFooter className="bg-gray-50 px-6 py-4 rounded-b-lg">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading} size="sm" className="bg-[#1a2a5e] hover:bg-[#2a3f7f]">
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3 w-3 mr-1" />
                {mode === 'create' ? 'Add Integration' : 'Update Integration'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}