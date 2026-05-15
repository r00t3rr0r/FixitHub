import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/useToast"
import { Integration } from "@/api/systemConfig"
import { Save, Eye, EyeOff } from "lucide-react"

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
  const [showApiKey, setShowApiKey] = useState(false)
  const [showApiSecret, setShowApiSecret] = useState(false)
  const [showLocationApiKey, setShowLocationApiKey] = useState(false)
  const dhlSandboxEndpoint = 'https://api-sandbox.dhl.com'
  const dhlProductionEndpoint = 'https://api.dhl.com'
  const defaultDhlSettings = {
    bookingLabelMode: 'dummy' as const,
    accountNumber: '',
    profile: 'STANDARD_GRUPPENPROFIL',
    product: 'V01PAK',
    shipperCompany: 'FixitHub GmbH',
    shipperStreet: '',
    shipperNumber: '',
    shipperPostalCode: '',
    shipperCity: '',
    shipperCountry: 'DE',
    shipperEmail: '',
    shipperPhone: '',
    pickup: {
      locationType: 'branch',
      branchCode: '',
      retailID: '',
      preferNearest: true,
      maxResults: 10,
      countryCode: 'DE',
      probePath: '/parcel/de/shipping/v2/pickup',
    },
    dhlApis: {
      parcelDeShipping: true,
      parcelDeTracking: true,
      parcelDeReturns: false,
      parcelDePickup: false,
      locationFinder: false,
    }
  }

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

  const showsBookingLabelMode = formData.type === 'shipping' && formData.provider === 'DHL'
  const showsDhlBusinessCustomerFields = formData.type === 'shipping' && formData.provider === 'DHL'

  useEffect(() => {
    if (integration && mode === 'edit') {
      setFormData({
        name: integration.name,
        type: integration.type,
        provider: integration.provider,
        apiKey: integration.apiKey,
        apiSecret: integration.apiSecret || '',
        endpoint: integration.endpoint || '',
        credentials: {
          apiKey: integration.credentials?.apiKey || integration.apiKey,
          apiSecret: integration.credentials?.apiSecret || integration.apiSecret || '',
          apiEndpoint: integration.credentials?.apiEndpoint || integration.endpoint || '',
          clientId: integration.credentials?.clientId || integration.apiKey,
          clientSecret: integration.credentials?.clientSecret || integration.apiSecret || '',
          username: integration.credentials?.username || integration.metadata?.username || '',
          password: integration.credentials?.password || integration.metadata?.password || '',
          accountId: integration.credentials?.accountId || '',
          shippingAuthUrl: integration.credentials?.shippingAuthUrl || (
            (integration.metadata?.environment || integration.credentials?.apiEndpoint || integration.endpoint || '').includes('sandbox')
              ? 'https://api-sandbox.dhl.com/parcel/de/account/auth/ropc/v1/token'
              : 'https://api.dhl.com/parcel/de/account/auth/ropc/v1/token'
          ),
          shippingGrantType: integration.credentials?.shippingGrantType || 'password',
          trackingBaseUrl: integration.credentials?.trackingBaseUrl || 'https://cig.dhl.de/services/sandbox/rest/sendungsverfolgung',
          trackingUsername: integration.credentials?.trackingUsername || '',
          trackingPassword: integration.credentials?.trackingPassword || '',
          trackingAuthType: integration.credentials?.trackingAuthType || 'basic',
          locationApiKey: integration.credentials?.locationApiKey || ''
        },
        metadata: {
          ...(integration.metadata || {}),
          environment: integration.metadata?.environment || 'sandbox',
          clientId: integration.metadata?.clientId || integration.apiKey,
          clientSecret: integration.metadata?.clientSecret || integration.apiSecret || '',
        },
        settings: {
          ...defaultDhlSettings,
          ...(integration.settings || {}),
          pickup: {
            ...defaultDhlSettings.pickup,
            ...(integration.settings?.pickup || {}),
          },
          dhlApis: {
            ...defaultDhlSettings.dhlApis,
            ...(integration.settings?.dhlApis || {}),
          },
          bookingLabelMode: integration.settings?.bookingLabelMode || 'dummy',
          accountNumber: integration.settings?.accountNumber || ''
        },
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
        credentials: {
          apiKey: '',
          apiSecret: '',
          apiEndpoint: '',
          clientId: '',
          clientSecret: '',
          username: 'user-valid',
          password: 'SandboxPasswort2023!',
          accountId: '',
          shippingAuthUrl: 'https://api-sandbox.dhl.com/parcel/de/account/auth/ropc/v1/token',
          shippingGrantType: 'password',
          trackingBaseUrl: 'https://cig.dhl.de/services/sandbox/rest/sendungsverfolgung',
          trackingUsername: 'zt12345',
          trackingPassword: 'geheim',
          trackingAuthType: 'basic',
          locationApiKey: ''
        },
        metadata: {
          environment: 'sandbox',
          clientId: '',
          clientSecret: '',
        },
        settings: { ...defaultDhlSettings },
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

    if (showsDhlBusinessCustomerFields && (!formData.apiSecret || !formData.credentials?.username || !formData.credentials?.password)) {
      toast({
        title: "Error",
        description: "For DHL Shipping, API secret plus Shipping API username/password are required",
        variant: "destructive"
      })
      return
    }

    if (showsDhlBusinessCustomerFields && !formData.settings?.accountNumber) {
      toast({
        title: "Error",
        description: "For DHL Shipping, Account/Billing Number is required",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      // Synchronize credentials with current values for DHL integration
      const dataToSave = {
        ...formData,
        credentials: {
          ...(formData.credentials || {}),
          apiKey: formData.apiKey,
          apiSecret: formData.apiSecret || '',
          apiEndpoint: formData.endpoint || '',
          clientId: formData.apiKey,
          clientSecret: formData.apiSecret || '',
          username: formData.credentials?.username || '',
          password: formData.credentials?.password || '',
          accountId: formData.settings?.accountNumber || '',
          locationApiKey: formData.credentials?.locationApiKey || ''
        }
      }

      // Also synchronize metadata with current values for DHL (keep environment only)
      if (formData.provider === 'DHL' && formData.type === 'shipping') {
        dataToSave.metadata = {
          ...(formData.metadata || {}),
          clientId: formData.apiKey,
          clientSecret: formData.apiSecret || '',
          environment: formData.metadata?.environment || 'sandbox'
        }
      }

      await onSave(dataToSave)
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
      <DialogContent className="w-[96vw] max-w-4xl h-[92vh] max-h-[92vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white p-6 rounded-t-lg">
          <DialogTitle className="text-xl">
            {mode === 'create' ? 'Add Integration' : 'Edit Integration'}
          </DialogTitle>
          <DialogDescription className="text-blue-100 text-sm mt-2">
            Configure third-party service integration settings
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
          <div className="grid gap-3">
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
                onValueChange={(value) => setFormData(prev => ({
                  ...prev,
                  provider: value,
                  endpoint: value === 'DHL' && prev.type === 'shipping'
                    ? (prev.endpoint || dhlSandboxEndpoint)
                    : prev.endpoint,
                  settings: value === 'DHL' && prev.type === 'shipping'
                    ? {
                        ...defaultDhlSettings,
                        ...prev.settings,
                        bookingLabelMode: prev.settings?.bookingLabelMode || 'dummy'
                      }
                    : prev.settings,
                  credentials: value === 'DHL' && prev.type === 'shipping'
                    ? {
                        ...(prev.credentials || {}),
                        username: prev.credentials?.username || 'user-valid',
                        password: prev.credentials?.password || 'SandboxPasswort2023!',
                        shippingAuthUrl: prev.credentials?.shippingAuthUrl || 'https://api-sandbox.dhl.com/parcel/de/account/auth/ropc/v1/token',
                        shippingGrantType: prev.credentials?.shippingGrantType || 'password',
                        trackingBaseUrl: prev.credentials?.trackingBaseUrl || 'https://cig.dhl.de/services/sandbox/rest/sendungsverfolgung',
                        trackingUsername: prev.credentials?.trackingUsername || 'zt12345',
                        trackingPassword: prev.credentials?.trackingPassword || 'geheim',
                        trackingAuthType: prev.credentials?.trackingAuthType || 'basic'
                      }
                    : prev.credentials,
                  metadata: value === 'DHL' && prev.type === 'shipping'
                    ? {
                        ...(prev.metadata || {}),
                        environment: prev.metadata?.environment || 'sandbox',
                      }
                    : prev.metadata
                }))}
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
              <Label htmlFor="endpoint" className="text-sm">{showsDhlBusinessCustomerFields ? 'Endpoint URL (Base)' : 'Endpoint URL'}</Label>
              <Input
                id="endpoint"
                value={formData.endpoint}
                onChange={(e) => setFormData(prev => ({ ...prev, endpoint: e.target.value }))}
                placeholder={showsDhlBusinessCustomerFields ? dhlSandboxEndpoint : 'https://api.example.com'}
                className="h-9 text-sm"
              />
              {showsDhlBusinessCustomerFields && (
                <p className="text-xs text-muted-foreground">
                  Base URL only. Shipping endpoint is built automatically as /parcel/de/shipping/v2/orders.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="apiKey" className="text-sm">{showsDhlBusinessCustomerFields ? 'API Key (client_id) *' : 'API Key *'}</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                value={formData.apiKey}
                onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder={showsDhlBusinessCustomerFields ? 'DHL App client_id' : 'Enter API key'}
                className="h-9 text-sm pr-9"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showApiKey ? 'API Key verbergen' : 'API Key anzeigen'}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="apiSecret" className="text-sm">{showsDhlBusinessCustomerFields ? 'API Secret (client_secret) *' : 'API Secret'}</Label>
            <div className="relative">
              <Input
                id="apiSecret"
                type={showApiSecret ? 'text' : 'password'}
                value={formData.apiSecret}
                onChange={(e) => setFormData(prev => ({ ...prev, apiSecret: e.target.value }))}
                placeholder={showsDhlBusinessCustomerFields ? 'DHL App client_secret' : 'Enter API secret (if required)'}
                className="h-9 text-sm pr-9"
              />
              <button
                type="button"
                onClick={() => setShowApiSecret(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showApiSecret ? 'API Secret verbergen' : 'API Secret anzeigen'}
              >
                {showApiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {showsDhlBusinessCustomerFields && (
            <>
              <div className="rounded-md border p-3 space-y-3 bg-slate-50/60">
                <p className="text-sm font-medium">DHL Parcel DE Shipping Essentials</p>

                <div className="rounded-md border bg-white p-3 space-y-2">
                  <p className="text-sm font-medium">Aktive DHL APIs</p>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm">Parcel DE Shipping</p>
                      <p className="text-xs text-muted-foreground">Versandauftraege und Labelerstellung</p>
                    </div>
                    <Switch
                      checked={Boolean(formData.settings?.dhlApis?.parcelDeShipping ?? true)}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...(prev.settings || {}),
                          dhlApis: {
                            parcelDeShipping: checked,
                            parcelDeTracking: Boolean(prev.settings?.dhlApis?.parcelDeTracking ?? true),
                            parcelDeReturns: Boolean(prev.settings?.dhlApis?.parcelDeReturns ?? false),
                            parcelDePickup: Boolean(prev.settings?.dhlApis?.parcelDePickup ?? false),
                            locationFinder: Boolean(prev.settings?.dhlApis?.locationFinder ?? false)
                          }
                        }
                      }))}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm">Parcel DE Tracking</p>
                      <p className="text-xs text-muted-foreground">Tracking-Status und Events abrufen</p>
                    </div>
                    <Switch
                      checked={Boolean(formData.settings?.dhlApis?.parcelDeTracking ?? true)}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...(prev.settings || {}),
                          dhlApis: {
                            parcelDeShipping: Boolean(prev.settings?.dhlApis?.parcelDeShipping ?? true),
                            parcelDeTracking: checked,
                            parcelDeReturns: Boolean(prev.settings?.dhlApis?.parcelDeReturns ?? false),
                            parcelDePickup: Boolean(prev.settings?.dhlApis?.parcelDePickup ?? false),
                            locationFinder: Boolean(prev.settings?.dhlApis?.locationFinder ?? false)
                          }
                        }
                      }))}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm">Parcel DE Returns</p>
                      <p className="text-xs text-muted-foreground">Ruecksendelabel via Returns API</p>
                    </div>
                    <Switch
                      checked={Boolean(formData.settings?.dhlApis?.parcelDeReturns ?? false)}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...(prev.settings || {}),
                          dhlApis: {
                            parcelDeShipping: Boolean(prev.settings?.dhlApis?.parcelDeShipping ?? true),
                            parcelDeTracking: Boolean(prev.settings?.dhlApis?.parcelDeTracking ?? true),
                            parcelDeReturns: checked,
                            parcelDePickup: Boolean(prev.settings?.dhlApis?.parcelDePickup ?? false),
                            locationFinder: Boolean(prev.settings?.dhlApis?.locationFinder ?? false)
                          }
                        }
                      }))}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm">Parcel DE Pickup</p>
                      <p className="text-xs text-muted-foreground">Pickup-Standorte und Abholoptionen via Pickup API</p>
                    </div>
                    <Switch
                      checked={Boolean(formData.settings?.dhlApis?.parcelDePickup ?? false)}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...(prev.settings || {}),
                          dhlApis: {
                            parcelDeShipping: Boolean(prev.settings?.dhlApis?.parcelDeShipping ?? true),
                            parcelDeTracking: Boolean(prev.settings?.dhlApis?.parcelDeTracking ?? true),
                            parcelDeReturns: Boolean(prev.settings?.dhlApis?.parcelDeReturns ?? false),
                            parcelDePickup: checked,
                            locationFinder: Boolean(prev.settings?.dhlApis?.locationFinder ?? false)
                          }
                        }
                      }))}
                    />
                  </div>
                </div>

                {Boolean(formData.settings?.dhlApis?.parcelDePickup ?? false) && (
                  <div className="rounded-md border bg-white p-3 space-y-3">
                    <p className="text-sm font-medium">DHL Parcel DE Pickup Settings</p>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="dhlPickupLocationType" className="text-sm">Location Type</Label>
                        <Select
                          value={String(formData.settings?.pickup?.locationType || 'branch')}
                          onValueChange={(value: 'branch' | 'locker' | 'retail') => setFormData(prev => ({
                            ...prev,
                            settings: {
                              ...(prev.settings || {}),
                              pickup: {
                                ...(prev.settings?.pickup || {}),
                                locationType: value
                              }
                            }
                          }))}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="branch">Branch</SelectItem>
                            <SelectItem value="locker">Locker</SelectItem>
                            <SelectItem value="retail">Retail</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="dhlPickupCountryCode" className="text-sm">Country Code (ISO2)</Label>
                        <Input
                          id="dhlPickupCountryCode"
                          value={String(formData.settings?.pickup?.countryCode || 'DE')}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            settings: {
                              ...(prev.settings || {}),
                              pickup: {
                                ...(prev.settings?.pickup || {}),
                                countryCode: e.target.value.toUpperCase()
                              }
                            }
                          }))}
                          placeholder="DE"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="dhlPickupBranchCode" className="text-sm">Branch Code (optional)</Label>
                        <Input
                          id="dhlPickupBranchCode"
                          value={String(formData.settings?.pickup?.branchCode || '')}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            settings: {
                              ...(prev.settings || {}),
                              pickup: {
                                ...(prev.settings?.pickup || {}),
                                branchCode: e.target.value
                              }
                            }
                          }))}
                          placeholder="z. B. 123456789"
                          className="h-9 text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="dhlPickupRetailId" className="text-sm">Retail ID (optional)</Label>
                        <Input
                          id="dhlPickupRetailId"
                          value={String(formData.settings?.pickup?.retailID || '')}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            settings: {
                              ...(prev.settings || {}),
                              pickup: {
                                ...(prev.settings?.pickup || {}),
                                retailID: e.target.value
                              }
                            }
                          }))}
                          placeholder="Retail ID"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="dhlPickupMaxResults" className="text-sm">Max Results</Label>
                        <Input
                          id="dhlPickupMaxResults"
                          type="number"
                          min={1}
                          max={100}
                          value={String(formData.settings?.pickup?.maxResults || 10)}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            settings: {
                              ...(prev.settings || {}),
                              pickup: {
                                ...(prev.settings?.pickup || {}),
                                maxResults: Math.max(1, Math.min(100, Number(e.target.value || 10)))
                              }
                            }
                          }))}
                          className="h-9 text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="dhlPickupProbePath" className="text-sm">Pickup Probe Path</Label>
                        <Input
                          id="dhlPickupProbePath"
                          value={String(formData.settings?.pickup?.probePath || '/parcel/de/shipping/v2/pickup')}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            settings: {
                              ...(prev.settings || {}),
                              pickup: {
                                ...(prev.settings?.pickup || {}),
                                probePath: e.target.value
                              }
                            }
                          }))}
                          placeholder="/parcel/de/shipping/v2/pickup"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm">Prefer Nearest Pickup Point</p>
                        <p className="text-xs text-muted-foreground">Bevorzugt den naechstgelegenen Standort, falls mehrere verfuegbar sind</p>
                      </div>
                      <Switch
                        checked={Boolean(formData.settings?.pickup?.preferNearest ?? true)}
                        onCheckedChange={(checked) => setFormData(prev => ({
                          ...prev,
                          settings: {
                            ...(prev.settings || {}),
                            pickup: {
                              ...(prev.settings?.pickup || {}),
                              preferNearest: checked
                            }
                          }
                        }))}
                      />
                    </div>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="dhlEnvironment" className="text-sm">Environment *</Label>
                    <Select
                      value={String(formData.metadata?.environment || 'sandbox')}
                      onValueChange={(value: 'sandbox' | 'production') => setFormData(prev => ({
                        ...prev,
                        endpoint: value === 'production' ? dhlProductionEndpoint : dhlSandboxEndpoint,
                        credentials: {
                          ...(prev.credentials || {}),
                          shippingAuthUrl: value === 'production'
                            ? 'https://api.dhl.com/parcel/de/account/auth/ropc/v1/token'
                            : 'https://api-sandbox.dhl.com/parcel/de/account/auth/ropc/v1/token',
                          trackingBaseUrl: value === 'production'
                            ? (prev.credentials?.trackingBaseUrl || 'https://cig.dhl.de/services/sandbox/rest/sendungsverfolgung')
                            : 'https://cig.dhl.de/services/sandbox/rest/sendungsverfolgung'
                        },
                        metadata: {
                          ...(prev.metadata || {}),
                          environment: value
                        }
                      }))}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox (Integration Testing)</SelectItem>
                        <SelectItem value="production">Production (Live)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="dhlAccountNumber" className="text-sm">Account/Billing Number *</Label>
                    <Input
                      id="dhlAccountNumber"
                      value={String(formData.settings?.accountNumber || '')}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...(prev.settings || {}),
                          accountNumber: e.target.value
                        }
                      }))}
                      placeholder="z.B. 33333333330101"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="dhlProfile" className="text-sm">Profile</Label>
                    <Input
                      id="dhlProfile"
                      value={String(formData.settings?.profile || 'STANDARD_GRUPPENPROFIL')}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...(prev.settings || {}),
                          profile: e.target.value
                        }
                      }))}
                      placeholder="STANDARD_GRUPPENPROFIL"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="dhlProduct" className="text-sm">Product</Label>
                    <Input
                      id="dhlProduct"
                      value={String(formData.settings?.product || 'V01PAK')}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...(prev.settings || {}),
                          product: e.target.value
                        }
                      }))}
                      placeholder="V01PAK"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  API Key = client_id, API Secret = client_secret. Username/Password sind Business-Customer-Zugangsdaten.
                </p>
              </div>

              <div className="rounded-md border p-3 space-y-3 bg-slate-50/60">
                <p className="text-sm font-medium">DHL Shipper Default Address (Fallback)</p>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="shipperCompany" className="text-sm">Company</Label>
                    <Input
                      id="shipperCompany"
                      value={String(formData.settings?.shipperCompany || '')}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...(prev.settings || {}),
                          shipperCompany: e.target.value
                        }
                      }))}
                      placeholder="FixitHub GmbH"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="shipperCountry" className="text-sm">Country (ISO2)</Label>
                    <Input
                      id="shipperCountry"
                      value={String(formData.settings?.shipperCountry || 'DE')}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...(prev.settings || {}),
                          shipperCountry: e.target.value.toUpperCase()
                        }
                      }))}
                      placeholder="DE"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="shipperStreet" className="text-sm">Street</Label>
                    <Input
                      id="shipperStreet"
                      value={String(formData.settings?.shipperStreet || '')}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...(prev.settings || {}),
                          shipperStreet: e.target.value
                        }
                      }))}
                      placeholder="Musterstrasse"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="shipperNumber" className="text-sm">No.</Label>
                    <Input
                      id="shipperNumber"
                      value={String(formData.settings?.shipperNumber || '')}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...(prev.settings || {}),
                          shipperNumber: e.target.value
                        }
                      }))}
                      placeholder="1"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="shipperPostalCode" className="text-sm">Postal Code</Label>
                    <Input
                      id="shipperPostalCode"
                      value={String(formData.settings?.shipperPostalCode || '')}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...(prev.settings || {}),
                          shipperPostalCode: e.target.value
                        }
                      }))}
                      placeholder="10115"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="shipperCity" className="text-sm">City</Label>
                    <Input
                      id="shipperCity"
                      value={String(formData.settings?.shipperCity || '')}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...(prev.settings || {}),
                          shipperCity: e.target.value
                        }
                      }))}
                      placeholder="Berlin"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="shipperEmail" className="text-sm">Shipper Email</Label>
                    <Input
                      id="shipperEmail"
                      value={String(formData.settings?.shipperEmail || '')}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...(prev.settings || {}),
                          shipperEmail: e.target.value
                        }
                      }))}
                      placeholder="logistics@fixithub.com"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="shipperPhone" className="text-sm">Shipper Phone</Label>
                    <Input
                      id="shipperPhone"
                      value={String(formData.settings?.shipperPhone || '')}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...(prev.settings || {}),
                          shipperPhone: e.target.value
                        }
                      }))}
                      placeholder="+49301234567"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {showsDhlBusinessCustomerFields && (
            <>
              <div className="rounded-md border p-3 space-y-3 bg-slate-50/60">
                <p className="text-sm font-medium">DHL Parcel DE Shipping API – Zugangsdaten</p>
                <p className="text-xs text-muted-foreground">
                  ROPC-Token-Anfrage: username/password werden an den Auth-Endpunkt gesendet, zusammen mit client_id/client_secret.
                </p>

                <div className="space-y-1">
                  <Label htmlFor="dhlShippingAuthUrl" className="text-sm">Auth URL *</Label>
                  <Input
                    id="dhlShippingAuthUrl"
                    value={formData.credentials?.shippingAuthUrl || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      credentials: {
                        ...(prev.credentials || {}),
                        shippingAuthUrl: e.target.value
                      }
                    }))}
                    placeholder="https://api-sandbox.dhl.com/parcel/de/account/auth/ropc/v1/token"
                    className="h-9 text-sm"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="dhlShippingUsername" className="text-sm">Username *</Label>
                    <Input
                      id="dhlShippingUsername"
                      value={formData.credentials?.username || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        credentials: {
                          ...(prev.credentials || {}),
                          username: e.target.value
                        }
                      }))}
                      placeholder="user-valid"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="dhlShippingPassword" className="text-sm">Password *</Label>
                    <Input
                      id="dhlShippingPassword"
                      type="password"
                      value={formData.credentials?.password || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        credentials: {
                          ...(prev.credentials || {}),
                          password: e.target.value
                        }
                      }))}
                      placeholder="SandboxPasswort2023!"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="dhlShippingGrantType" className="text-sm">Grant Type</Label>
                  <Input
                    id="dhlShippingGrantType"
                    value={formData.credentials?.shippingGrantType || 'password'}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      credentials: {
                        ...(prev.credentials || {}),
                        shippingGrantType: e.target.value
                      }
                    }))}
                    placeholder="password"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-3 bg-slate-50/60">
                <p className="text-sm font-medium">DHL Parcel DE Tracking API – Zugangsdaten</p>
                <p className="text-xs text-muted-foreground">
                  Sendungsverfolgung über cig.dhl.de mit Basic Authentication.
                </p>

                <div className="space-y-1">
                  <Label htmlFor="dhlTrackingBaseUrl" className="text-sm">Base URL</Label>
                  <Input
                    id="dhlTrackingBaseUrl"
                    value={formData.credentials?.trackingBaseUrl || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      credentials: {
                        ...(prev.credentials || {}),
                        trackingBaseUrl: e.target.value
                      }
                    }))}
                    placeholder="https://cig.dhl.de/services/sandbox/rest/sendungsverfolgung"
                    className="h-9 text-sm"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="dhlTrackingUsername" className="text-sm">Username</Label>
                    <Input
                      id="dhlTrackingUsername"
                      value={formData.credentials?.trackingUsername || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        credentials: {
                          ...(prev.credentials || {}),
                          trackingUsername: e.target.value
                        }
                      }))}
                      placeholder="zt12345"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="dhlTrackingPassword" className="text-sm">Password</Label>
                    <Input
                      id="dhlTrackingPassword"
                      type="password"
                      value={formData.credentials?.trackingPassword || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        credentials: {
                          ...(prev.credentials || {}),
                          trackingPassword: e.target.value
                        }
                      }))}
                      placeholder="geheim"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="dhlTrackingAuthType" className="text-sm">Auth Type</Label>
                  <Select
                    value={formData.credentials?.trackingAuthType || 'basic'}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      credentials: {
                        ...(prev.credentials || {}),
                        trackingAuthType: value
                      }
                    }))}
                  >
                    <SelectTrigger id="dhlTrackingAuthType" className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic Authentication</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {showsDhlBusinessCustomerFields && (
            <div className="rounded-md border p-3 space-y-3 bg-slate-50/60">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">DHL Location Finder API</p>
                  <p className="text-xs text-muted-foreground">
                    Suche nach Packstations, Postfilialen und Paketshops für Kunden. Nutzt standardmäßig den client_id-Schlüssel.
                  </p>
                </div>
                <Switch
                  checked={Boolean(formData.settings?.dhlApis?.locationFinder ?? false)}
                  onCheckedChange={(checked) => setFormData(prev => ({
                    ...prev,
                    settings: {
                      ...(prev.settings || {}),
                      dhlApis: {
                        parcelDeShipping: Boolean(prev.settings?.dhlApis?.parcelDeShipping ?? true),
                        parcelDeTracking: Boolean(prev.settings?.dhlApis?.parcelDeTracking ?? true),
                        parcelDeReturns: Boolean(prev.settings?.dhlApis?.parcelDeReturns ?? false),
                        parcelDePickup: Boolean(prev.settings?.dhlApis?.parcelDePickup ?? false),
                        locationFinder: checked,
                      }
                    }
                  }))}
                />
              </div>

              {Boolean(formData.settings?.dhlApis?.locationFinder ?? false) && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="dhlLocationApiKey" className="text-sm">Separater Location Finder API Key (optional)</Label>
                    <div className="relative">
                      <Input
                        id="dhlLocationApiKey"
                        type={showLocationApiKey ? 'text' : 'password'}
                        value={formData.credentials?.locationApiKey || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          credentials: {
                            ...(prev.credentials || {}),
                            locationApiKey: e.target.value
                          }
                        }))}
                        placeholder="Leer lassen → client_id wird verwendet"
                        className="h-9 text-sm pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLocationApiKey(v => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                        aria-label={showLocationApiKey ? 'Key verbergen' : 'Key anzeigen'}
                      >
                        {showLocationApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      DHL Developer Portal → App → Subscription Key für „Location Finder – Unified". Leer lassen um client_id zu verwenden.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {showsBookingLabelMode && (
            <div className="space-y-1">
              <Label htmlFor="bookingLabelMode" className="text-sm">Booking Label Mode</Label>
              <Select
                value={formData.settings?.bookingLabelMode || 'dummy'}
                onValueChange={(value: 'dummy' | 'live') => setFormData(prev => ({
                  ...prev,
                  settings: {
                    ...prev.settings,
                    bookingLabelMode: value,
                  }
                }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dummy">Dummy PDF Label</SelectItem>
                  <SelectItem value="live">Live DHL Label</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Dummy creates a placeholder PDF for bookings. Live uses the DHL API and falls back to dummy on failure.
              </p>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
            />
            <Label className="text-sm">Active Integration</Label>
          </div>
          </div>
        </div>

        <DialogFooter className="bg-gray-50 px-4 md:px-6 py-4 rounded-b-lg border-t">
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