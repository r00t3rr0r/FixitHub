import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Plus,
  Edit,
  Trash2,
  TestTube,
  MessageSquare,
  Bell,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react"
import api from "@/api/api"

interface Provider {
  _id: string
  name: string
  type: "sms" | "push"
  provider: string
  isActive: boolean
  lastTested?: string
  testStatus?: "success" | "failed" | "pending"
  settings?: Record<string, any>
}

interface ProviderFormData {
  provider: string
  isActive: boolean
  [key: string]: any
}

const availableProviders = {
  sms: [
    { id: "twilio", name: "Twilio" },
    { id: "vonage", name: "Vonage (Nexmo)" },
    { id: "aws-sns", name: "AWS SNS" },
  ],
  push: [
    { id: "firebase", name: "Firebase Cloud Messaging" },
    { id: "onesignal", name: "OneSignal" },
    { id: "expo", name: "Expo Push Notifications" },
  ],
}

const requiredFields = {
  twilio: ["accountSid", "authToken", "fromNumber"],
  vonage: ["apiKey", "apiSecret", "from"],
  "aws-sns": ["region", "accessKeyId", "secretAccessKey"],
  firebase: ["projectId", "serviceAccountKey"],
  onesignal: ["appId", "restApiKey"],
  expo: ["accessToken"],
}

const fieldLabels = {
  accountSid: "Account SID",
  authToken: "Auth Token",
  fromNumber: "From Number",
  apiKey: "API Key",
  apiSecret: "API Secret",
  from: "From",
  region: "AWS Region",
  accessKeyId: "Access Key ID",
  secretAccessKey: "Secret Access Key",
  projectId: "Firebase Project ID",
  serviceAccountKey: "Service Account Key (JSON)",
  appId: "OneSignal App ID",
  restApiKey: "REST API Key",
  accessToken: "Access Token",
}

export function ProviderConfigurationTab() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<"sms" | "push">("sms")
  const [selectedProvider, setSelectedProvider] = useState<string>("")
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [formData, setFormData] = useState<ProviderFormData>({
    provider: "",
    isActive: true,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set())
  const [testingId, setTestingId] = useState<string | null>(null)

  useEffect(() => {
    loadProviders()
  }, [])

  const loadProviders = async () => {
    setLoading(true)
    try {
      const response = await api.get("/api/system-config/providers")
      setProviders(response.data.providers || [])
    } catch (error: any) {
      console.error("Failed to load providers:", error)
      toast({
        title: "Error",
        description: "Failed to load provider configurations",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (type: "sms" | "push", provider?: Provider) => {
    setSelectedType(type)
    if (provider) {
      setEditingProvider(provider)
      setSelectedProvider(provider.provider)
      setFormData({
        ...provider.settings,
        isActive: provider.isActive,
      })
    } else {
      setEditingProvider(null)
      setSelectedProvider("")
      setFormData({ provider: "", isActive: true })
    }
    setIsDialogOpen(true)
  }

  const handleProviderSelect = (providerName: string) => {
    setSelectedProvider(providerName)
    setFormData({
      provider: providerName,
      isActive: true,
    })
  }

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }))
  }

  const handleSaveProvider = async () => {
    try {
      if (!selectedProvider) {
        toast({
          title: "Error",
          description: "Please select a provider",
          variant: "destructive",
        })
        return
      }

      // Validate required fields
      const required = requiredFields[selectedProvider as keyof typeof requiredFields] || []
      const missing = required.filter((field) => !formData[field])
      if (missing.length > 0) {
        toast({
          title: "Validation Error",
          description: `Missing required fields: ${missing.map(f => fieldLabels[f as keyof typeof fieldLabels] || f).join(", ")}`,
          variant: "destructive",
        })
        return
      }

      setIsLoading(true)
      let endpoint = `/api/system-config/providers/${selectedType}`
      if (editingProvider) {
        endpoint += `/${editingProvider._id}`
      }

      const method = editingProvider ? "put" : "post"
      const response = await api[method](endpoint, {
        provider: selectedProvider,
        ...formData,
      })

      toast({
        title: "Success",
        description: `${editingProvider ? "Updated" : "Created"} provider configuration`,
      })

      setIsDialogOpen(false)
      await loadProviders()
    } catch (error: any) {
      console.error("Failed to save provider:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to save provider",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestProvider = async (providerId: string) => {
    try {
      setTestingId(providerId)
      const response = await api.post(`/api/system-config/providers/${providerId}/test`)

      toast({
        title: response.data.result.success ? "Success" : "Failed",
        description: response.data.message,
        variant: response.data.result.success ? "default" : "destructive",
      })

      await loadProviders()
    } catch (error: any) {
      console.error("Failed to test provider:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to test provider",
        variant: "destructive",
      })
    } finally {
      setTestingId(null)
    }
  }

  const handleDeleteProvider = async (providerId: string) => {
    try {
      await api.delete(`/api/system-config/providers/${providerId}`)
      toast({
        title: "Success",
        description: "Provider deleted successfully",
      })
      await loadProviders()
    } catch (error: any) {
      console.error("Failed to delete provider:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete provider",
        variant: "destructive",
      })
    }
  }

  const toggleFieldVisibility = (fieldName: string) => {
    const newVisible = new Set(visibleFields)
    if (newVisible.has(fieldName)) {
      newVisible.delete(fieldName)
    } else {
      newVisible.add(fieldName)
    }
    setVisibleFields(newVisible)
  }

  const getProviderIcon = (type: string) => {
    return type === "sms" ? <MessageSquare className="w-4 h-4" /> : <Bell className="w-4 h-4" />
  }

  const getSMSProviders = () => providers.filter((p) => p.type === "sms")
  const getPushProviders = () => providers.filter((p) => p.type === "push")

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">SMS Providers</h3>
        <div className="space-y-4">
          {getSMSProviders().length === 0 ? (
            <Card className="bg-muted">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  No SMS providers configured. Add one to enable SMS notifications.
                </p>
                <Button
                  onClick={() => handleOpenDialog("sms")}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add SMS Provider
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {getSMSProviders().map((provider) => (
                <Card key={provider._id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getProviderIcon("sms")}
                        <div>
                          <CardTitle className="text-base">{provider.name}</CardTitle>
                          <CardDescription>{provider.provider}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {provider.testStatus === "success" && (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Connected
                          </Badge>
                        )}
                        {provider.testStatus === "failed" && (
                          <Badge className="bg-red-100 text-red-800">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                        <Switch
                          checked={provider.isActive}
                          onCheckedChange={(checked) => {
                            handleOpenDialog("sms", provider)
                            setFormData((prev) => ({ ...prev, isActive: checked }))
                          }}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestProvider(provider._id)}
                        disabled={testingId === provider._id}
                      >
                        {testingId === provider._id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4 mr-2" />
                        )}
                        Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog("sms", provider)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Provider</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this SMS provider? SMS notifications will
                              no longer work until a new provider is configured.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteProvider(provider._id)}
                              className="bg-red-600"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {getSMSProviders().length > 0 && (
                <Button variant="outline" onClick={() => handleOpenDialog("sms")} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Another SMS Provider
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-semibold mb-4">Push Providers</h3>
        <div className="space-y-4">
          {getPushProviders().length === 0 ? (
            <Card className="bg-muted">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  No Push providers configured. Add one to enable push notifications.
                </p>
                <Button
                  onClick={() => handleOpenDialog("push")}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Push Provider
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {getPushProviders().map((provider) => (
                <Card key={provider._id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getProviderIcon("push")}
                        <div>
                          <CardTitle className="text-base">{provider.name}</CardTitle>
                          <CardDescription>{provider.provider}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {provider.testStatus === "success" && (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Connected
                          </Badge>
                        )}
                        {provider.testStatus === "failed" && (
                          <Badge className="bg-red-100 text-red-800">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                        <Switch
                          checked={provider.isActive}
                          onCheckedChange={(checked) => {
                            handleOpenDialog("push", provider)
                            setFormData((prev) => ({ ...prev, isActive: checked }))
                          }}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestProvider(provider._id)}
                        disabled={testingId === provider._id}
                      >
                        {testingId === provider._id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4 mr-2" />
                        )}
                        Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog("push", provider)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Provider</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this Push provider? Push notifications will
                              no longer work until a new provider is configured.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteProvider(provider._id)}
                              className="bg-red-600"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {getPushProviders().length > 0 && (
                <Button variant="outline" onClick={() => handleOpenDialog("push")} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Another Push Provider
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Provider Configuration Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? "Edit" : "Add"} {selectedType === "sms" ? "SMS" : "Push"} Provider
            </DialogTitle>
            <DialogDescription>
              Configure your {selectedType === "sms" ? "SMS" : "Push"} notification provider
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Provider Selection */}
            {!editingProvider && (
              <div className="space-y-3">
                <Label>Select Provider</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(selectedType === "sms" ? availableProviders.sms : availableProviders.push).map(
                    (provider) => (
                      <Button
                        key={provider.id}
                        variant={selectedProvider === provider.id ? "default" : "outline"}
                        onClick={() => handleProviderSelect(provider.id)}
                        className="justify-start"
                      >
                        {provider.name}
                      </Button>
                    )
                  )}
                </div>
              </div>
            )}

            {selectedProvider && (
              <>
                <Separator />

                {/* Configuration Fields */}
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      {selectedType === "sms"
                        ? "Configure your SMS provider to enable text message notifications"
                        : "Configure your Push provider to enable mobile push notifications"}
                    </p>
                  </div>

                  {(requiredFields[selectedProvider as keyof typeof requiredFields] || []).map(
                    (fieldName) => {
                      const isSecret =
                        fieldName.includes("Secret") ||
                        fieldName.includes("Token") ||
                        fieldName.includes("Key")
                      const isVisible = visibleFields.has(fieldName)

                      return (
                        <div key={fieldName} className="space-y-2">
                          <Label htmlFor={fieldName}>
                            {fieldLabels[fieldName as keyof typeof fieldLabels] || fieldName}
                          </Label>
                          {fieldName === "serviceAccountKey" ? (
                            <Textarea
                              id={fieldName}
                              placeholder='{"type": "service_account", ...}'
                              value={
                                typeof formData[fieldName] === "object"
                                  ? JSON.stringify(formData[fieldName])
                                  : formData[fieldName] || ""
                              }
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value)
                                  handleFieldChange(fieldName, parsed)
                                } catch {
                                  handleFieldChange(fieldName, e.target.value)
                                }
                              }}
                              className="font-mono text-sm"
                              rows={8}
                            />
                          ) : (
                            <div className="flex gap-2">
                              <Input
                                id={fieldName}
                                type={isSecret && !isVisible ? "password" : "text"}
                                placeholder={`Enter ${fieldLabels[fieldName as keyof typeof fieldLabels] || fieldName}`}
                                value={formData[fieldName] || ""}
                                onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                              />
                              {isSecret && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleFieldVisibility(fieldName)}
                                >
                                  {isVisible ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    }
                  )}
                </div>

                <Separator />

                {/* Active Toggle */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="isActive">Enable this provider</Label>
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => handleFieldChange("isActive", checked)}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProvider} disabled={!selectedProvider || isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingProvider ? "Update Provider" : "Add Provider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
