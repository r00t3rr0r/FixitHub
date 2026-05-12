import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import {
  getSystemConfig,
  updateSystemConfig,
  getNotificationTemplates,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  getIntegrations,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  testIntegration,
  clearCache,
  runSecurityScan,
  SystemConfig,
  NotificationTemplate,
  NotificationTemplateInput,
  Integration
} from "@/api/systemConfig"
import { NotificationTemplateDialog } from "@/components/admin/NotificationTemplateDialog"
import { IntegrationDialog } from "@/components/admin/IntegrationDialog"
import { LanguageManagementTab } from "@/components/admin/LanguageManagementTab"
import { ProviderConfigurationTab } from "@/components/admin/ProviderConfigurationTab"
import {
  Settings,
  Bell,
  Shield,
  FileText,
  Workflow,
  Link,
  Plus,
  Edit,
  Trash2,
  TestTube,
  RefreshCw,
  Scan,
  Save,
  Server,
  Database,
  Mail,
  CheckCircle,
  AlertCircle,
  Users,
  ShoppingCart,
  Image,
  Home,
  BookOpen,
  Store,
  Search,
  Globe,
  Layout,
  FileImage,
  Zap
} from "lucide-react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"

const containsHtml = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value)

const stripHtml = (value: string) => value
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const getTemplatePreviewText = (content: string) => {
  const preview = stripHtml(content)
  if (!preview) {
    return 'HTML-E-Mail-Vorlage mit Layout und dynamischen Inhalten'
  }

  return preview.length > 220 ? `${preview.slice(0, 220).trim()}...` : preview
}

const getTemplateTypeLabel = (type: NotificationTemplate['type']) => {
  if (type === 'email') return 'E-Mail'
  if (type === 'sms') return 'SMS'
  return 'Push'
}

const DEFAULT_LOCALHOST_TEMPLATE_BASE_URL = 'http://localhost:5173'
const DEFAULT_PRODUCTION_TEMPLATE_BASE_URL = 'https://50mj9v47-5173.euw.devtunnels.ms'

const normalizeBaseUrl = (value: string) => {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const parsed = new URL(withProtocol)
    if (!['http:', 'https:'].includes(parsed.protocol)) return ''
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return ''
  }
}

const getTemplateLinkSettingsForUi = (config: SystemConfig) => {
  const settings = config.templateLinkSettings || {
    mode: 'localhost' as const,
    localhostBaseUrl: DEFAULT_LOCALHOST_TEMPLATE_BASE_URL,
    productionBaseUrl: DEFAULT_PRODUCTION_TEMPLATE_BASE_URL,
  }

  return {
    mode: settings.mode === 'production' ? 'production' : 'localhost',
    localhostBaseUrl: settings.localhostBaseUrl || DEFAULT_LOCALHOST_TEMPLATE_BASE_URL,
    productionBaseUrl: settings.productionBaseUrl || DEFAULT_PRODUCTION_TEMPLATE_BASE_URL,
  }
}

const getNormalizedTemplateLinkSettings = (config: SystemConfig) => {
  const settings = getTemplateLinkSettingsForUi(config)

  return {
    mode: settings.mode === 'production' ? 'production' : 'localhost',
    localhostBaseUrl: normalizeBaseUrl(settings.localhostBaseUrl) || DEFAULT_LOCALHOST_TEMPLATE_BASE_URL,
    productionBaseUrl: normalizeBaseUrl(settings.productionBaseUrl) || DEFAULT_PRODUCTION_TEMPLATE_BASE_URL,
  }
}

type IntegrationTestResult = {
  success?: boolean
  message?: string
  debug?: {
    environment?: string
    authFlow?: string
    tokenEndpoint?: string
    probeEndpoint?: string
    hasClientId?: boolean
    hasClientSecret?: boolean
    [key: string]: unknown
  }
  [key: string]: unknown
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export function SystemConfiguration() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)
  const [runningSecurityScan, setRunningSecurityScan] = useState(false)
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null)
  const [testResultModal, setTestResultModal] = useState<IntegrationTestResult | null>(null)
  const [showTestResultModal, setShowTestResultModal] = useState(false)

  // Template test dialog
  const [testingTemplate, setTestingTemplate] = useState<NotificationTemplate | null>(null)
  const [templateTestEmail, setTemplateTestEmail] = useState("")
  const [sendingTemplateTest, setSendingTemplateTest] = useState(false)

  // Template filter
  const [templateSearch, setTemplateSearch] = useState('')
  const [templateTypeFilter, setTemplateTypeFilter] = useState<'all' | 'email' | 'sms' | 'push'>('all')

  // Dialog states
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [showIntegrationDialog, setShowIntegrationDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null)
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null)
  const [templateDialogMode, setTemplateDialogMode] = useState<'create' | 'edit'>('create')
  const [integrationDialogMode, setIntegrationDialogMode] = useState<'create' | 'edit'>('create')

  const { toast } = useToast()

  const toIntegrationPayload = (integration: Integration): Omit<Integration, '_id'> => ({
    name: integration.name,
    type: integration.type,
    provider: integration.provider,
    apiKey: integration.apiKey,
    apiSecret: integration.apiSecret || '',
    endpoint: integration.endpoint || '',
    credentials: integration.credentials || {},
    metadata: integration.metadata || {},
    settings: integration.settings || {},
    isActive: integration.isActive,
    lastTested: integration.lastTested,
    testStatus: integration.testStatus,
  })

  const loadData = useCallback(async () => {
    try {
      console.log("SystemConfiguration: Loading system configuration data...")
      const [configResponse, templatesResponse, integrationsResponse] = await Promise.all([
        getSystemConfig(),
        getNotificationTemplates(),
        getIntegrations()
      ])

      const normalizedConfig = {
        ...configResponse.config,
        templateLinkSettings: getNormalizedTemplateLinkSettings(configResponse.config),
      }

      setConfig(normalizedConfig)
      setTemplates(templatesResponse.templates)
      setIntegrations(integrationsResponse.integrations)
      console.log("SystemConfiguration: Data loaded successfully")
    } catch (error: unknown) {
      console.error("SystemConfiguration: Error loading data:", error)
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to load system configuration"),
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSaveConfig = async () => {
    if (!config) return

    const normalizedTemplateLinkSettings = getNormalizedTemplateLinkSettings(config)
    const normalizedProductionBaseUrl = normalizeBaseUrl(normalizedTemplateLinkSettings.productionBaseUrl)

    if (!normalizedProductionBaseUrl) {
      toast({
        title: "Ungueltige Production-URL",
        description: "Bitte geben Sie eine gueltige URL mit http:// oder https:// ein.",
        variant: "destructive"
      })
      return
    }

    const payload: SystemConfig = {
      ...config,
      templateLinkSettings: {
        ...normalizedTemplateLinkSettings,
        productionBaseUrl: normalizedProductionBaseUrl,
      }
    }

    setSaving(true)
    try {
      console.log("SystemConfiguration: Saving configuration...")
      const response = await updateSystemConfig(payload)
      setConfig({
        ...response.config,
        templateLinkSettings: getNormalizedTemplateLinkSettings(response.config),
      })
      toast({
        title: "Success",
        description: "System configuration updated successfully"
      })
    } catch (error: unknown) {
      console.error("SystemConfiguration: Error saving config:", error)
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to save configuration"),
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClearCache = async () => {
    setClearingCache(true)
    try {
      console.log("SystemConfiguration: Clearing cache...")
      await clearCache()
      toast({
        title: "Success",
        description: "System cache cleared successfully"
      })
    } catch (error: unknown) {
      console.error("SystemConfiguration: Error clearing cache:", error)
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to clear cache"),
        variant: "destructive"
      })
    } finally {
      setClearingCache(false)
    }
  }

  const handleRunSecurityScan = async () => {
    setRunningSecurityScan(true)
    try {
      console.log("SystemConfiguration: Running security scan...")
      await runSecurityScan()
      toast({
        title: "Success",
        description: "Security scan completed successfully"
      })
    } catch (error: unknown) {
      console.error("SystemConfiguration: Error running security scan:", error)
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to run security scan"),
        variant: "destructive"
      })
    } finally {
      setRunningSecurityScan(false)
    }
  }

  const handleCreateTemplate = () => {
    setEditingTemplate(null)
    setTemplateDialogMode('create')
    setShowTemplateDialog(true)
  }

  const handleEditTemplate = (template: NotificationTemplate) => {
    setEditingTemplate(template)
    setTemplateDialogMode('edit')
    setShowTemplateDialog(true)
  }

  const handleSaveTemplate = async (templateData: NotificationTemplateInput) => {
    try {
      if (templateDialogMode === 'create') {
        console.log("SystemConfiguration: Creating template...")
        const response = await createNotificationTemplate(templateData)
        setTemplates(prev => [...prev, response.template])
      } else if (editingTemplate) {
        console.log("SystemConfiguration: Updating template...")
        const response = await updateNotificationTemplate(editingTemplate._id, templateData)
        setTemplates(prev => prev.map(t => t._id === editingTemplate._id ? response.template : t))
      }
    } catch (error: unknown) {
      console.error("SystemConfiguration: Error saving template:", error)
      throw error
    }
  }

  const handleTestTemplate = (template: NotificationTemplate) => {
    setTestingTemplate(template)
    setTemplateTestEmail("")
  }

  const handleSendTemplateTest = async () => {
    if (!testingTemplate || !templateTestEmail.trim()) return
    setSendingTemplateTest(true)
    try {
      const token = localStorage.getItem("accessToken")
      const response = await fetch(`/api/system-config/notification-templates/${testingTemplate._id}/send-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to: templateTestEmail.trim() }),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        toast({ title: "Test-E-Mail gesendet", description: data.message || `Vorlage an ${templateTestEmail} gesendet` })
        setTestingTemplate(null)
      } else {
        toast({ title: "Fehler", description: data.message || data.error || "Senden fehlgeschlagen", variant: "destructive" })
      }
    } catch (error: unknown) {
      toast({ title: "Verbindungsfehler", description: getErrorMessage(error, "Unbekannter Fehler"), variant: "destructive" })
    } finally {
      setSendingTemplateTest(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      console.log("SystemConfiguration: Deleting template:", templateId)
      await deleteNotificationTemplate(templateId)
      setTemplates(prev => prev.filter(t => t._id !== templateId))
      toast({
        title: "Success",
        description: "Template deleted successfully"
      })
    } catch (error: unknown) {
      console.error("SystemConfiguration: Error deleting template:", error)
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to delete template"),
        variant: "destructive"
      })
    }
  }

  const handleCreateIntegration = () => {
    setEditingIntegration(null)
    setIntegrationDialogMode('create')
    setShowIntegrationDialog(true)
  }

  const handleEditIntegration = (integration: Integration) => {
    setEditingIntegration(integration)
    setIntegrationDialogMode('edit')
    setShowIntegrationDialog(true)
  }

  const handleSaveIntegration = async (integrationData: Omit<Integration, '_id'>) => {
    try {
      if (integrationDialogMode === 'create') {
        console.log("SystemConfiguration: Creating integration...")
        const response = await createIntegration(integrationData)
        setIntegrations(prev => [...prev, response.integration])
      } else if (editingIntegration) {
        console.log("SystemConfiguration: Updating integration...")
        const response = await updateIntegration(editingIntegration._id, integrationData)
        setIntegrations(prev => prev.map(i => i._id === editingIntegration._id ? response.integration : i))
      }
    } catch (error: unknown) {
      console.error("SystemConfiguration: Error saving integration:", error)
      throw error
    }
  }

  const handleDeleteIntegration = async (integrationId: string) => {
    try {
      console.log("SystemConfiguration: Deleting integration:", integrationId)
      await deleteIntegration(integrationId)
      setIntegrations(prev => prev.filter(i => i._id !== integrationId))
      toast({
        title: "Success",
        description: "Integration deleted successfully"
      })
    } catch (error: unknown) {
      console.error("SystemConfiguration: Error deleting integration:", error)
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to delete integration"),
        variant: "destructive"
      })
    }
  }

  const handleTestIntegration = async (integrationId: string) => {
    setTestingIntegration(integrationId)
    try {
      console.log("SystemConfiguration: Testing integration:", integrationId)
      const response = await testIntegration(integrationId)

      // Store full test result including debug info
      setTestResultModal(response.result)
      setShowTestResultModal(true)

      // Update integration test status
      setIntegrations(prev => prev.map(i =>
        i._id === integrationId
          ? { ...i, testStatus: response.result.success ? 'success' : 'failed' }
          : i
      ))

      // Also show toast notification
      if (response.result.success) {
        toast({
          title: "✅ Test erfolgreich",
          description: response.result.message
        })
      } else {
        toast({
          title: "❌ Test fehlgeschlagen",
          description: response.result.message,
          variant: "destructive"
        })
      }
    } catch (error: unknown) {
      console.error("SystemConfiguration: Error testing integration:", error)
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to test integration"),
        variant: "destructive"
      })
    } finally {
      setTestingIntegration(null)
    }
  }

  const handleBookingLabelModeChange = async (integration: Integration, bookingLabelMode: 'dummy' | 'live') => {
    const updatedIntegration: Integration = {
      ...integration,
      settings: {
        ...(integration.settings || {}),
        bookingLabelMode,
      },
    }

    setIntegrations((prev) => prev.map((item) => item._id === integration._id ? updatedIntegration : item))

    try {
      const response = await updateIntegration(integration._id, toIntegrationPayload(updatedIntegration))
      setIntegrations((prev) => prev.map((item) => item._id === integration._id ? response.integration : item))
      toast({
        title: 'Success',
        description: `Booking label mode set to ${bookingLabelMode}`,
      })
    } catch (error: unknown) {
      setIntegrations((prev) => prev.map((item) => item._id === integration._id ? integration : item))
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to update booking label mode'),
        variant: 'destructive'
      })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load system configuration</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] rounded-lg p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6" />
              {t('admin.systemConfig.title')}
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              Configure system settings, notifications, integrations, and security
            </p>
          </div>
          <Button onClick={handleSaveConfig} disabled={saving} className="bg-white text-[#1a2a5e] hover:bg-blue-50">
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-3">
        <TabsList className="h-auto bg-gradient-to-r from-[#1a2a5e]/10 to-[#2a3f7f]/10 border-b-2 border-[#1a2a5e] gap-1 p-1 w-full rounded-none">
          <TabsTrigger value="general" className="text-xs sm:text-sm py-2 px-2 sm:px-4">{t('admin.systemConfig.general')}</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs sm:text-sm py-2 px-2 sm:px-4">{t('admin.systemConfig.notifications')}</TabsTrigger>
          <TabsTrigger value="providers" className="text-xs sm:text-sm py-2 px-2 sm:px-4">SMS/Push Providers</TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs sm:text-sm py-2 px-2 sm:px-4">{t('admin.systemConfig.integrations')}</TabsTrigger>
          <TabsTrigger value="workflow" className="text-xs sm:text-sm py-2 px-2 sm:px-4">{t('admin.systemConfig.workflows')}</TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm py-2 px-2 sm:px-4">{t('admin.systemConfig.security')}</TabsTrigger>
          <TabsTrigger value="content" className="text-xs sm:text-sm py-2 px-2 sm:px-4">{t('admin.systemConfig.content')}</TabsTrigger>
          <TabsTrigger value="languages" className="text-xs sm:text-sm py-2 px-2 sm:px-4">{t('admin.systemConfig.languages')}</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4">
          {/* System Status */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white rounded-t-lg p-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Server className="h-5 w-5" />
                System Status
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs mt-1">Current system health and status</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex items-center justify-between p-2 border rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors">
                  <div className="flex items-center gap-2 text-sm">
                    <Server className="h-4 w-4 text-[#1a2a5e]" />
                    <span>Server Status</span>
                  </div>
                  <Badge className="bg-green-500 text-white text-xs py-0.5 px-2">
                    <CheckCircle className="h-2.5 w-2.5 mr-1" />
                    Online
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 border rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors">
                  <div className="flex items-center gap-2 text-sm">
                    <Database className="h-4 w-4 text-[#1a2a5e]" />
                    <span>Database</span>
                  </div>
                  <Badge className="bg-green-500 text-white text-xs py-0.5 px-2">
                    <CheckCircle className="h-2.5 w-2.5 mr-1" />
                    Connected
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 border rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-[#1a2a5e]" />
                    <span>Email Service</span>
                  </div>
                  <Badge className="bg-green-500 text-white text-xs py-0.5 px-2">
                    <CheckCircle className="h-2.5 w-2.5 mr-1" />
                    Active
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* General Settings */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white rounded-t-lg p-4">
              <CardTitle className="text-lg">General Settings</CardTitle>
              <CardDescription className="text-blue-100 text-xs mt-1">Basic system configuration</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="siteName">Site Name</Label>
                  <Input
                    id="siteName"
                    value={config.siteName}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, siteName: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Admin Email</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={config.adminEmail}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, adminEmail: e.target.value } : null)}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="timezone" className="text-sm">Timezone</Label>
                  <Select
                    value={config.timezone}
                    onValueChange={(value) => setConfig(prev => prev ? { ...prev, timezone: value } : null)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={config.maintenanceMode}
                    onCheckedChange={(checked) => setConfig(prev => prev ? { ...prev, maintenanceMode: checked } : null)}
                  />
                  <Label>Maintenance Mode</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Actions */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white rounded-t-lg p-4">
              <CardTitle className="text-lg">System Actions</CardTitle>
              <CardDescription className="text-blue-100 text-xs mt-1">Perform system maintenance tasks</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={handleClearCache}
                  disabled={clearingCache}
                  className="h-auto py-3 px-4 flex-col gap-1"
                >
                  {clearingCache ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  ) : (
                    <RefreshCw className="h-5 w-5" />
                  )}
                  <span className="font-medium text-sm">Clear Cache</span>
                  <span className="text-xs text-muted-foreground">Clear system cache</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRunSecurityScan}
                  disabled={runningSecurityScan}
                  className="h-auto py-3 px-4 flex-col gap-1"
                >
                  {runningSecurityScan ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  ) : (
                    <Scan className="h-5 w-5" />
                  )}
                  <span className="font-medium text-sm">Run Security Scan</span>
                  <span className="text-xs text-muted-foreground">Check for vulnerabilities</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab - Combined notifications settings and templates */}
        <TabsContent value="notifications" className="space-y-4">
          {/* Notification Settings */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white rounded-t-lg p-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs mt-1">Configure notification preferences and behavior</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div>
                  <Label htmlFor="orderNotifications" className="text-sm font-medium">Order Notifications</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Send notifications for order updates</p>
                </div>
                <Switch
                  id="orderNotifications"
                  checked={config.notificationSettings?.orderNotifications}
                  onCheckedChange={(checked) =>
                    setConfig(prev => prev ? {
                      ...prev,
                      notificationSettings: {
                        ...prev.notificationSettings,
                        orderNotifications: checked
                      }
                    } : null)
                  }
                />
              </div>
              <div className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div>
                  <Label htmlFor="paymentNotifications" className="text-sm font-medium">Payment Notifications</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Send notifications for payment events</p>
                </div>
                <Switch
                  id="paymentNotifications"
                  checked={config.notificationSettings?.paymentNotifications}
                  onCheckedChange={(checked) =>
                    setConfig(prev => prev ? {
                      ...prev,
                      notificationSettings: {
                        ...prev.notificationSettings,
                        paymentNotifications: checked
                      }
                    } : null)
                  }
                />
              </div>
              <div className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div>
                  <Label htmlFor="systemAlerts" className="text-sm font-medium">System Alerts</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Send system-wide alerts and announcements</p>
                </div>
                <Switch
                  id="systemAlerts"
                  checked={config.notificationSettings?.systemAlerts}
                  onCheckedChange={(checked) =>
                    setConfig(prev => prev ? {
                      ...prev,
                      notificationSettings: {
                        ...prev.notificationSettings,
                        systemAlerts: checked
                      }
                    } : null)
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white rounded-t-lg p-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="h-5 w-5" />
                Zentrale Link-Basis fuer Templates
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs mt-1">
                Alle Template-Links werden zentral erzeugt. Wechseln Sie zwischen Localhost und Production-URL.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) =>
                      prev
                        ? {
                            ...prev,
                            templateLinkSettings: {
                              ...getTemplateLinkSettingsForUi(prev),
                              mode: 'localhost',
                            },
                          }
                        : null
                    )
                  }
                  className={`px-3 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                    getTemplateLinkSettingsForUi(config).mode === 'localhost'
                      ? 'bg-[#1a2a5e] text-white border-[#1a2a5e]'
                      : 'bg-white text-[#1a2a5e] border-[#d8dce6] hover:bg-[#eef3ff]'
                  }`}
                >
                  Localhost
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) =>
                      prev
                        ? {
                            ...prev,
                            templateLinkSettings: {
                              ...getTemplateLinkSettingsForUi(prev),
                              mode: 'production',
                            },
                          }
                        : null
                    )
                  }
                  className={`px-3 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                    getTemplateLinkSettingsForUi(config).mode === 'production'
                      ? 'bg-[#1a2a5e] text-white border-[#1a2a5e]'
                      : 'bg-white text-[#1a2a5e] border-[#d8dce6] hover:bg-[#eef3ff]'
                  }`}
                >
                  Production
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateProductionBaseUrl">Production Base URL</Label>
                <Input
                  id="templateProductionBaseUrl"
                  value={getTemplateLinkSettingsForUi(config).productionBaseUrl}
                  onChange={(e) =>
                    setConfig((prev) =>
                      prev
                        ? {
                            ...prev,
                            templateLinkSettings: {
                              ...getTemplateLinkSettingsForUi(prev),
                              productionBaseUrl: e.target.value,
                            },
                          }
                        : null
                    )
                  }
                  placeholder={DEFAULT_PRODUCTION_TEMPLATE_BASE_URL}
                />
                {!!getTemplateLinkSettingsForUi(config).productionBaseUrl &&
                !normalizeBaseUrl(getTemplateLinkSettingsForUi(config).productionBaseUrl) ? (
                  <p className="text-xs text-red-600">Bitte eine gueltige URL mit http:// oder https:// eingeben.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Standard: {DEFAULT_PRODUCTION_TEMPLATE_BASE_URL}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-[#d8dce6] bg-[#f8f9fc] p-3">
                <p className="text-xs text-muted-foreground">Aktive Template-Basis-URL</p>
                <p className="text-sm font-semibold text-[#1a2a5e] break-all">
                  {getTemplateLinkSettingsForUi(config).mode === 'production'
                    ? normalizeBaseUrl(getTemplateLinkSettingsForUi(config).productionBaseUrl) || DEFAULT_PRODUCTION_TEMPLATE_BASE_URL
                    : getTemplateLinkSettingsForUi(config).localhostBaseUrl}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notification Templates */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white rounded-t-lg p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5" />
                    Kunden-Benachrichtigungsvorlagen
                  </CardTitle>
                  <CardDescription className="text-blue-100 text-xs mt-1">Buchungen, Reparaturanfragen, Reklamationen, Statusupdates, Zahlungen, Termine und Standardbenachrichtigungen</CardDescription>
                </div>
                <Button onClick={handleCreateTemplate} size="sm" className="bg-white text-[#1a2a5e] hover:bg-blue-50">
                  <Plus className="h-4 w-4 mr-2" />
                  Vorlage anlegen
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="mb-4 rounded-2xl border border-[#d8dce6] bg-gradient-to-r from-[#f8f9fc] via-white to-[#fff7df] p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#1a2a5e]">McRepair Layout fuer transaktionale Kunden-Benachrichtigungen</p>
                      <p className="text-xs text-muted-foreground">Einheitliches Design fuer E-Mail, SMS und Push-Vorlagen mit dynamischen Platzhaltern.</p>
                    </div>
                    <Badge variant="outline" className="w-fit border-[#f5b800] bg-white text-[#1a2a5e]">
                      {templates.length} Vorlagen gesamt
                    </Badge>
                  </div>
                  {/* Search & Filter */}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Vorlagen durchsuchen …"
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-[#d8dce6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a5e]/30"
                      />
                    </div>
                    <div className="flex gap-1">
                      {(['all', 'email', 'sms', 'push'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTemplateTypeFilter(t)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                            templateTypeFilter === t
                              ? 'bg-[#1a2a5e] text-white border-[#1a2a5e]'
                              : 'bg-white text-[#1a2a5e] border-[#d8dce6] hover:bg-[#eef3ff]'
                          }`}
                        >
                          {t === 'all' ? `Alle (${templates.length})` :
                           t === 'email' ? `E-Mail (${templates.filter(x => x.type === 'email').length})` :
                           t === 'sms' ? `SMS (${templates.filter(x => x.type === 'sms').length})` :
                           `Push (${templates.filter(x => x.type === 'push').length})`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {(() => {
                const filtered = templates.filter((t) => {
                  const matchesType = templateTypeFilter === 'all' || t.type === templateTypeFilter
                  const q = templateSearch.toLowerCase()
                  const matchesSearch = !q || t.name.toLowerCase().includes(q) || (t.subject || '').toLowerCase().includes(q)
                  return matchesType && matchesSearch
                })
                if (templates.length === 0) return (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">Keine Benachrichtigungsvorlagen gefunden</p>
                    <p className="text-sm text-muted-foreground">Legen Sie Ihre erste Vorlage fuer die Kundenkommunikation an</p>
                  </div>
                )
                if (filtered.length === 0) return (
                  <div className="text-center py-8">
                    <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                    <p className="text-muted-foreground text-sm">Keine Vorlagen fuer diesen Filter gefunden</p>
                  </div>
                )
                return (
                <div className="grid gap-4 md:grid-cols-2">
                  {filtered.map((template) => (
                    <Card key={template._id} className="relative overflow-hidden border-[#d8dce6] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline">{getTemplateTypeLabel(template.type)}</Badge>
                              {containsHtml(template.content) && (
                                <Badge variant="outline" className="border-[#f5b800] text-[#1a2a5e]">McRepair HTML</Badge>
                              )}
                              <Badge variant={template.isActive ? "default" : "secondary"}>
                                {template.isActive ? "Aktiv" : "Inaktiv"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Vorlage als Test-E-Mail senden"
                              onClick={() => handleTestTemplate(template)}
                              disabled={template.type !== 'email'}
                            >
                              <TestTube className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTemplate(template)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Vorlage loeschen</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Moechten Sie "{template.name}" wirklich loeschen? Dieser Schritt kann nicht rueckgaengig gemacht werden.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteTemplate(template._id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Loeschen
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {template.subject && (
                          <div className="mb-2">
                            <p className="text-sm font-medium">Betreff:</p>
                            <p className="text-sm text-muted-foreground">{template.subject}</p>
                          </div>
                        )}
                        <div className="mb-3">
                          <p className="text-sm font-medium">Inhaltsvorschau:</p>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {getTemplatePreviewText(template.content)}
                          </p>
                        </div>
                        {template.variables && template.variables.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Variablen ({template.variables.length}):</p>
                            <div className="flex flex-wrap gap-1">
                              {template.variables.slice(0, 3).map((variable) => (
                                <Badge key={variable.name} variant="outline" className="text-xs">
                                  {`{{${variable.name}}}`}
                                </Badge>
                              ))}
                              {template.variables.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{template.variables.length - 3} mehr
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Template Test Dialog */}
        {testingTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
              <div className="flex items-center gap-2 mb-1">
                <TestTube className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Vorlage als Test-E-Mail senden</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Sendet die Vorlage mit Beispiel-Platzhalterwerten an die angegebene Adresse</p>

              <div className="bg-gray-50 border rounded-lg p-3 mb-4 text-sm space-y-1">
                <p><span className="font-medium">Vorlage:</span> {testingTemplate.name}</p>
                {testingTemplate.subject && <p><span className="font-medium">Betreff:</span> {testingTemplate.subject}</p>}
                {testingTemplate.variables && testingTemplate.variables.length > 0 && (
                  <p><span className="font-medium">Variablen:</span> {testingTemplate.variables.map(v => `{{${v.name}}}`).join(', ')}</p>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <label htmlFor="template-test-email" className="text-sm font-medium">Empfänger-E-Mail-Adresse *</label>
                <input
                  id="template-test-email"
                  type="email"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="test@example.com"
                  value={templateTestEmail}
                  onChange={(e) => setTemplateTestEmail(e.target.value)}
                  disabled={sendingTemplateTest}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendTemplateTest()}
                />
              </div>

              {/* HTML Preview */}
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Vorschau (HTML-formatiert):</p>
                <div className="bg-white border rounded-lg overflow-hidden overflow-y-auto max-h-64 border-gray-300 shadow-sm">
                  <div 
                    className="p-4 text-sm"
                    dangerouslySetInnerHTML={{ 
                      __html: (() => {
                        const content = testingTemplate.content;
                        // Sample values for replacing placeholders
                        const sampleValues: Record<string, string> = {
                          customerName: 'Max Mustermann',
                          firstName: 'Max',
                          lastName: 'Mustermann',
                          email: templateTestEmail || 'test@example.com',
                          orderNumber: 'ORD-2026-0001',
                          repairNumber: 'REP-2026-0001',
                          deviceName: 'iPhone 15 Pro',
                          deviceModel: 'iPhone 15 Pro',
                          status: 'In Bearbeitung',
                          estimatedCost: '89,00 €',
                          totalAmount: '89,00 €',
                          amountPaid: '89,00 €',
                          technician: 'FixitHub Service',
                          notes: 'Ihr Gerät wird gerade geprüft.',
                          completionDate: new Date().toLocaleDateString('de-DE'),
                          shopName: 'FixitHub',
                          shopAddress: 'Musterstraße 1, 12345 Musterstadt',
                          supportEmail: 'support@fixithub.de',
                          supportPhone: '+49 123 456789',
                          trackingUrl: 'https://fixithub.de/tracking/REP-2026-0001',
                          verificationUrl: 'https://fixithub.de/verify/example-token',
                          passwordResetUrl: 'https://fixithub.de/reset/example-token',
                          invoiceUrl: 'https://fixithub.de/invoice/INV-2026-0001',
                        };
                        // Replace all {{variable}} placeholders
                        return content.replace(/{{(\w+)}}/g, (match, key) => sampleValues[key] || `[${key}]`);
                      })()
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setTestingTemplate(null)} disabled={sendingTemplateTest}>Abbrechen</Button>
                <Button
                  onClick={handleSendTemplateTest}
                  disabled={sendingTemplateTest || !templateTestEmail.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {sendingTemplateTest ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Wird gesendet...</>
                  ) : (
                    <><TestTube className="h-4 w-4 mr-2" />Test senden</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* SMS/Push Providers Tab */}
        <TabsContent value="providers" className="space-y-6">
          <ProviderConfigurationTab />
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white rounded-t-lg p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Link className="h-5 w-5" />
                    Third-Party Integrations
                  </CardTitle>
                  <CardDescription className="text-blue-100 text-xs mt-1">Manage external service integrations and API connections</CardDescription>
                </div>
                <Button onClick={handleCreateIntegration} size="sm" className="bg-white text-[#1a2a5e] hover:bg-blue-50">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Integration
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {integrations.length === 0 ? (
                <div className="text-center py-8">
                  <Link className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No integrations configured</p>
                  <p className="text-sm text-muted-foreground">Add your first integration to get started</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {integrations.map((integration) => (
                    <Card key={integration._id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{integration.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline">{integration.type}</Badge>
                              <Badge variant="outline">{integration.provider}</Badge>
                              <Badge
                                variant={
                                  integration.testStatus === 'success' ? 'default' :
                                  integration.testStatus === 'failed' ? 'destructive' : 'secondary'
                                }
                              >
                                {integration.testStatus === 'success' ? 'Connected' :
                                 integration.testStatus === 'failed' ? 'Failed' : 'Pending'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTestIntegration(integration._id)}
                              disabled={testingIntegration === integration._id}
                            >
                              {testingIntegration === integration._id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                              ) : (
                                <TestTube className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditIntegration(integration)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Integration</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{integration.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteIntegration(integration._id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div>
                            <p className="text-sm font-medium">Status:</p>
                            <p className="text-sm text-muted-foreground">
                              {integration.isActive ? 'Active' : 'Inactive'}
                            </p>
                          </div>
                          {integration.lastTested && (
                            <div>
                              <p className="text-sm font-medium">Last Tested:</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(integration.lastTested).toLocaleString()}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium">Endpoint:</p>
                            <p className="text-sm text-muted-foreground break-all">
                              {integration.endpoint || 'Default endpoint'}
                            </p>
                          </div>
                          {integration.type === 'shipping' && integration.provider === 'DHL' && (
                            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                              <div>
                                <p className="text-sm font-medium">Aktive DHL APIs</p>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  <Badge variant={(integration.settings?.dhlApis?.parcelDeShipping ?? true) ? 'default' : 'secondary'}>
                                    Shipping
                                  </Badge>
                                  <Badge variant={(integration.settings?.dhlApis?.parcelDeTracking ?? true) ? 'default' : 'secondary'}>
                                    Tracking
                                  </Badge>
                                  <Badge variant={(integration.settings?.dhlApis?.parcelDeReturns ?? false) ? 'default' : 'secondary'}>
                                    Returns
                                  </Badge>
                                  <Badge variant={(integration.settings?.dhlApis?.parcelDePickup ?? false) ? 'default' : 'secondary'}>
                                    Pickup
                                  </Badge>
                                </div>
                              </div>

                              <div>
                                <p className="text-sm font-medium">Booking Label Mode</p>
                                <p className="text-xs text-muted-foreground">
                                  Choose whether booking creation prepares a dummy PDF label or calls the live DHL API.
                                </p>
                              </div>
                              <Select
                                value={integration.settings?.bookingLabelMode || 'dummy'}
                                onValueChange={(value: 'dummy' | 'live') => handleBookingLabelModeChange(integration, value)}
                              >
                                <SelectTrigger className="h-9 text-sm bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="dummy">Dummy PDF Label</SelectItem>
                                  <SelectItem value="live">Live DHL Label</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflow Tab */}
        <TabsContent value="workflow" className="space-y-6">
          <Card>
            <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white rounded-t-lg p-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Workflow className="h-5 w-5" />
                Workflow Settings
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs mt-1">Configure workflow automation and business processes</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoAssignment">Auto Assignment</Label>
                  <p className="text-sm text-muted-foreground">Automatically assign orders to available staff</p>
                </div>
                <Switch
                  id="autoAssignment"
                  checked={config.workflowSettings?.autoAssignment}
                  onCheckedChange={(checked) =>
                    setConfig(prev => prev ? {
                      ...prev,
                      workflowSettings: {
                        ...prev.workflowSettings,
                        autoAssignment: checked
                      }
                    } : null)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="requireApproval">Require Approval</Label>
                  <p className="text-sm text-muted-foreground">Require manager approval for certain actions</p>
                </div>
                <Switch
                  id="requireApproval"
                  checked={config.workflowSettings?.requireApproval}
                  onCheckedChange={(checked) =>
                    setConfig(prev => prev ? {
                      ...prev,
                      workflowSettings: {
                        ...prev.workflowSettings,
                        requireApproval: checked
                      }
                    } : null)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enableAutomation">Enable Automation</Label>
                  <p className="text-sm text-muted-foreground">Enable workflow automation rules</p>
                </div>
                <Switch
                  id="enableAutomation"
                  checked={config.workflowSettings?.enableAutomation}
                  onCheckedChange={(checked) =>
                    setConfig(prev => prev ? {
                      ...prev,
                      workflowSettings: {
                        ...prev.workflowSettings,
                        enableAutomation: checked
                      }
                    } : null)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultEstimatedTime">Default Estimated Time (minutes)</Label>
                <Input
                  id="defaultEstimatedTime"
                  type="number"
                  value={config.workflowSettings?.defaultEstimatedTime || 60}
                  onChange={(e) => setConfig(prev => prev ? {
                    ...prev,
                    workflowSettings: {
                      ...prev.workflowSettings,
                      defaultEstimatedTime: parseInt(e.target.value)
                    }
                  } : null)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white rounded-t-lg p-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs mt-1">Configure security policies and access controls</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Password Policy */}
              <div className="space-y-4">
                <h4 className="font-medium">Password Policy</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="minLength">Minimum Length</Label>
                    <Input
                      id="minLength"
                      type="number"
                      value={config.securitySettings?.passwordPolicy?.minLength || 8}
                      onChange={(e) => setConfig(prev => prev ? {
                        ...prev,
                        securitySettings: {
                          ...prev.securitySettings,
                          passwordPolicy: {
                            ...prev.securitySettings?.passwordPolicy,
                            minLength: parseInt(e.target.value)
                          }
                        }
                      } : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
                    <Input
                      id="maxLoginAttempts"
                      type="number"
                      value={config.securitySettings?.maxLoginAttempts || 5}
                      onChange={(e) => setConfig(prev => prev ? {
                        ...prev,
                        securitySettings: {
                          ...prev.securitySettings,
                          maxLoginAttempts: parseInt(e.target.value)
                        }
                      } : null)}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.securitySettings?.passwordPolicy?.requireUppercase}
                      onCheckedChange={(checked) => setConfig(prev => prev ? {
                        ...prev,
                        securitySettings: {
                          ...prev.securitySettings,
                          passwordPolicy: {
                            ...prev.securitySettings?.passwordPolicy,
                            requireUppercase: checked
                          }
                        }
                      } : null)}
                    />
                    <Label>Require Uppercase Letters</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.securitySettings?.passwordPolicy?.requireLowercase}
                      onCheckedChange={(checked) => setConfig(prev => prev ? {
                        ...prev,
                        securitySettings: {
                          ...prev.securitySettings,
                          passwordPolicy: {
                            ...prev.securitySettings?.passwordPolicy,
                            requireLowercase: checked
                          }
                        }
                      } : null)}
                    />
                    <Label>Require Lowercase Letters</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.securitySettings?.passwordPolicy?.requireNumbers}
                      onCheckedChange={(checked) => setConfig(prev => prev ? {
                        ...prev,
                        securitySettings: {
                          ...prev.securitySettings,
                          passwordPolicy: {
                            ...prev.securitySettings?.passwordPolicy,
                            requireNumbers: checked
                          }
                        }
                      } : null)}
                    />
                    <Label>Require Numbers</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.securitySettings?.passwordPolicy?.requireSpecialChars}
                      onCheckedChange={(checked) => setConfig(prev => prev ? {
                        ...prev,
                        securitySettings: {
                          ...prev.securitySettings,
                          passwordPolicy: {
                            ...prev.securitySettings?.passwordPolicy,
                            requireSpecialChars: checked
                          }
                        }
                      } : null)}
                    />
                    <Label>Require Special Characters</Label>
                  </div>
                </div>
              </div>

              {/* Session Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">Session Settings</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeout">Session Timeout (seconds)</Label>
                    <Input
                      id="sessionTimeout"
                      type="number"
                      value={config.securitySettings?.sessionTimeout || 3600}
                      onChange={(e) => setConfig(prev => prev ? {
                        ...prev,
                        securitySettings: {
                          ...prev.securitySettings,
                          sessionTimeout: parseInt(e.target.value)
                        }
                      } : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lockoutDuration">Lockout Duration (seconds)</Label>
                    <Input
                      id="lockoutDuration"
                      type="number"
                      value={config.securitySettings?.lockoutDuration || 900}
                      onChange={(e) => setConfig(prev => prev ? {
                        ...prev,
                        securitySettings: {
                          ...prev.securitySettings,
                          lockoutDuration: parseInt(e.target.value)
                        }
                      } : null)}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={config.securitySettings?.enableTwoFactor}
                    onCheckedChange={(checked) => setConfig(prev => prev ? {
                      ...prev,
                      securitySettings: {
                        ...prev.securitySettings,
                        enableTwoFactor: checked
                      }
                    } : null)}
                  />
                  <Label>Enable Two-Factor Authentication</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Tab - Enhanced with comprehensive content management */}
        <TabsContent value="content" className="space-y-6">
          {/* Homepage Content Settings */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white rounded-t-lg p-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Home className="h-5 w-5" />
                Homepage Content Management
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs mt-1">Configure homepage sections, layout, and content display</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Hero Section Settings */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Layout className="h-4 w-4" />
                  Hero Section
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="heroTitle">Hero Title</Label>
                    <Input
                      id="heroTitle"
                      placeholder="Welcome to FixitHub"
                      defaultValue="Professional Device Repair Services"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
                    <Input
                      id="heroSubtitle"
                      placeholder="Fast, reliable, and affordable repairs"
                      defaultValue="Expert repairs for all your devices"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heroDescription">Hero Description</Label>
                  <Textarea
                    id="heroDescription"
                    placeholder="Detailed description of your services"
                    rows={3}
                    defaultValue="Get your devices fixed by certified professionals with warranty and fast turnaround times."
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="heroCTA">Call-to-Action Text</Label>
                    <Input
                      id="heroCTA"
                      placeholder="Get Started"
                      defaultValue="Book Repair Now"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="heroImage">Hero Image URL</Label>
                    <Input
                      id="heroImage"
                      placeholder="https://example.com/hero.jpg"
                      defaultValue="/images/hero-repair.jpg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="heroVideo">Hero Video URL (Optional)</Label>
                    <Input
                      id="heroVideo"
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch defaultChecked />
                  <Label>Enable Hero Section Animation</Label>
                </div>
              </div>

              <Separator />

              {/* Services Showcase */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Services Showcase
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="servicesTitle">Section Title</Label>
                    <Input
                      id="servicesTitle"
                      placeholder="Our Services"
                      defaultValue="What We Fix"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="servicesLimit">Max Services to Display</Label>
                    <Input
                      id="servicesLimit"
                      type="number"
                      placeholder="6"
                      defaultValue="8"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Show Service Prices</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Show Service Icons</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Enable Service Filtering</Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Testimonials Section */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Customer Testimonials
                </h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="testimonialsTitle">Section Title</Label>
                    <Input
                      id="testimonialsTitle"
                      placeholder="What Our Customers Say"
                      defaultValue="Customer Reviews"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="testimonialsLimit">Max Testimonials</Label>
                    <Input
                      id="testimonialsLimit"
                      type="number"
                      placeholder="3"
                      defaultValue="6"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="testimonialsLayout">Layout Style</Label>
                    <Select defaultValue="carousel">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grid">Grid Layout</SelectItem>
                        <SelectItem value="carousel">Carousel</SelectItem>
                        <SelectItem value="masonry">Masonry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Show Customer Photos</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Auto-rotate Testimonials</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Blog Content Settings */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white rounded-t-lg p-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5" />
                Blog Content Management
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs mt-1">Configure blog display, categories, and content policies</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Blog Display Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">Blog Display Settings</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="blogPostsPerPage">Posts Per Page</Label>
                    <Input
                      id="blogPostsPerPage"
                      type="number"
                      placeholder="10"
                      defaultValue="12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="blogExcerptLength">Excerpt Length (words)</Label>
                    <Input
                      id="blogExcerptLength"
                      type="number"
                      placeholder="150"
                      defaultValue="200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="blogDateFormat">Date Format</Label>
                    <Select defaultValue="relative">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="relative">Relative (2 days ago)</SelectItem>
                        <SelectItem value="short">Short (Mar 15, 2024)</SelectItem>
                        <SelectItem value="full">Full (March 15, 2024)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Show Author Information</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Enable Comments</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Show Reading Time</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Enable Social Sharing</Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Blog SEO Settings */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Blog SEO Settings
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="blogMetaTitle">Default Meta Title Template</Label>
                    <Input
                      id="blogMetaTitle"
                      placeholder="{{title}} | {{siteName}}"
                      defaultValue="{{title}} - FixitHub Blog"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="blogMetaDescription">Default Meta Description Template</Label>
                    <Input
                      id="blogMetaDescription"
                      placeholder="{{excerpt}}"
                      defaultValue="Read {{title}} on FixitHub blog. {{excerpt}}"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Auto-generate Sitemap</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Enable Schema Markup</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Canonical URLs</Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Content Moderation */}
              <div className="space-y-4">
                <h4 className="font-medium">Content Moderation</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center space-x-2">
                    <Switch />
                    <Label>Require Admin Approval for New Posts</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Moderate Comments</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Enable Spam Detection</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch />
                    <Label>Auto-publish Scheduled Posts</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shop Content Settings */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white rounded-t-lg p-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Store className="h-5 w-5" />
                Shop Content Management
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs mt-1">Configure product display, categories, and shopping experience</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Product Display */}
              <div className="space-y-4">
                <h4 className="font-medium">Product Display Settings</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="productsPerPage">Products Per Page</Label>
                    <Input
                      id="productsPerPage"
                      type="number"
                      placeholder="20"
                      defaultValue="24"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productImageSize">Product Image Size</Label>
                    <Select defaultValue="medium">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small (200x200)</SelectItem>
                        <SelectItem value="medium">Medium (400x400)</SelectItem>
                        <SelectItem value="large">Large (600x600)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productLayout">Product Grid Layout</Label>
                    <Select defaultValue="grid-4">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grid-2">2 Columns</SelectItem>
                        <SelectItem value="grid-3">3 Columns</SelectItem>
                        <SelectItem value="grid-4">4 Columns</SelectItem>
                        <SelectItem value="grid-5">5 Columns</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Show Product Ratings</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Show Stock Status</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Enable Quick View</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Show Sale Badges</Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Shopping Cart Settings */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Shopping Cart Configuration
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cartSessionTimeout">Session Timeout (minutes)</Label>
                    <Input
                      id="cartSessionTimeout"
                      type="number"
                      value={Math.round((config.cartSettings?.sessionTimeout || 1800) / 60)}
                      onChange={(e) => setConfig(prev => prev ? {
                        ...prev,
                        cartSettings: {
                          ...prev.cartSettings,
                          sessionTimeout: parseInt(e.target.value) * 60
                        }
                      } : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxItems">Max Items in Cart</Label>
                    <Input
                      id="maxItems"
                      type="number"
                      value={config.cartSettings?.maxItems || 50}
                      onChange={(e) => setConfig(prev => prev ? {
                        ...prev,
                        cartSettings: {
                          ...prev.cartSettings,
                          maxItems: parseInt(e.target.value)
                        }
                      } : null)}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.cartSettings?.enableGuestCheckout}
                      onCheckedChange={(checked) => setConfig(prev => prev ? {
                        ...prev,
                        cartSettings: {
                          ...prev.cartSettings,
                          enableGuestCheckout: checked
                        }
                      } : null)}
                    />
                    <Label>Enable Guest Checkout</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.cartSettings?.requirePhone}
                      onCheckedChange={(checked) => setConfig(prev => prev ? {
                        ...prev,
                        cartSettings: {
                          ...prev.cartSettings,
                          requirePhone: checked
                        }
                      } : null)}
                    />
                    <Label>Require Phone Number</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.cartSettings?.enablePromoCode}
                      onCheckedChange={(checked) => setConfig(prev => prev ? {
                        ...prev,
                        cartSettings: {
                          ...prev.cartSettings,
                          enablePromoCode: checked
                        }
                      } : null)}
                    />
                    <Label>Enable Promo Codes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Save Cart for Logged Users</Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abandonmentEmailDelay">Cart Abandonment Email Delay (hours)</Label>
                  <Input
                    id="abandonmentEmailDelay"
                    type="number"
                    value={Math.round((config.cartSettings?.abandonmentEmailDelay || 3600) / 3600)}
                    onChange={(e) => setConfig(prev => prev ? {
                      ...prev,
                      cartSettings: {
                        ...prev.cartSettings,
                        abandonmentEmailDelay: parseInt(e.target.value) * 3600
                      }
                    } : null)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Media & File Management */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white rounded-t-lg p-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileImage className="h-5 w-5" />
                Media & File Management
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs mt-1">Configure file uploads, image optimization, and media handling</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* File Upload Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">File Upload Settings</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="maxImageSize">Max Image Size (MB)</Label>
                    <Input
                      id="maxImageSize"
                      type="number"
                      value={Math.round((config.contentSettings?.maxImageSize || 5242880) / 1024 / 1024)}
                      onChange={(e) => setConfig(prev => prev ? {
                        ...prev,
                        contentSettings: {
                          ...prev.contentSettings,
                          maxImageSize: parseInt(e.target.value) * 1024 * 1024
                        }
                      } : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxFileSize">Max File Size (MB)</Label>
                    <Input
                      id="maxFileSize"
                      type="number"
                      value={Math.round((config.contentSettings?.maxFileSize || 10485760) / 1024 / 1024)}
                      onChange={(e) => setConfig(prev => prev ? {
                        ...prev,
                        contentSettings: {
                          ...prev.contentSettings,
                          maxFileSize: parseInt(e.target.value) * 1024 * 1024
                        }
                      } : null)}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="allowedImageTypes">Allowed Image Types</Label>
                    <Input
                      id="allowedImageTypes"
                      placeholder="jpg, png, gif, webp"
                      defaultValue="jpg, jpeg, png, gif, webp, svg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="allowedFileTypes">Allowed File Types</Label>
                    <Input
                      id="allowedFileTypes"
                      placeholder="pdf, doc, txt"
                      defaultValue="pdf, doc, docx, txt, zip, csv"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Image Optimization */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Image Optimization
                </h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="imageQuality">JPEG Quality (%)</Label>
                    <Input
                      id="imageQuality"
                      type="number"
                      placeholder="85"
                      defaultValue="90"
                      min="1"
                      max="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="thumbnailSize">Thumbnail Size (px)</Label>
                    <Input
                      id="thumbnailSize"
                      type="number"
                      placeholder="150"
                      defaultValue="200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mediumSize">Medium Size (px)</Label>
                    <Input
                      id="mediumSize"
                      type="number"
                      placeholder="300"
                      defaultValue="400"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.contentSettings?.autoOptimizeImages}
                      onCheckedChange={(checked) => setConfig(prev => prev ? {
                        ...prev,
                        contentSettings: {
                          ...prev.contentSettings,
                          autoOptimizeImages: checked
                        }
                      } : null)}
                    />
                    <Label>Auto Optimize Images</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Generate WebP Format</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Create Multiple Sizes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Strip Metadata</Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Content Approval */}
              <div className="space-y-4">
                <h4 className="font-medium">Content Approval & Moderation</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.contentSettings?.requireApproval}
                      onCheckedChange={(checked) => setConfig(prev => prev ? {
                        ...prev,
                        contentSettings: {
                          ...prev.contentSettings,
                          requireApproval: checked
                        }
                      } : null)}
                    />
                    <Label>Require Content Approval</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Auto-scan for Inappropriate Content</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Virus Scan Uploads</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch />
                    <Label>Watermark Images</Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approvalNotifyEmail">Approval Notification Email</Label>
                  <Input
                    id="approvalNotifyEmail"
                    type="email"
                    placeholder="content@fixithub.com"
                    defaultValue="admin@fixithub.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SEO & Performance */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white rounded-t-lg p-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="h-5 w-5" />
                SEO & Performance Settings
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs mt-1">Configure search engine optimization and site performance</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* SEO Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">SEO Configuration</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="seoTitle">Default Page Title Template</Label>
                    <Input
                      id="seoTitle"
                      placeholder="{{title}} | {{siteName}}"
                      defaultValue="{{title}} - FixitHub"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seoDescription">Default Meta Description</Label>
                    <Input
                      id="seoDescription"
                      placeholder="Professional device repair services..."
                      defaultValue="Professional device repair services with warranty and fast turnaround."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seoKeywords">Default Keywords</Label>
                  <Input
                    id="seoKeywords"
                    placeholder="device repair, phone repair, laptop repair"
                    defaultValue="device repair, phone repair, laptop repair, screen replacement, battery replacement"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Auto-generate Sitemap</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Enable Open Graph Tags</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Enable Twitter Cards</Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Performance Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">Performance Optimization</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Enable Caching</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Compress Images</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Minify CSS/JS</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label>Enable CDN</Label>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cacheTimeout">Cache Timeout (hours)</Label>
                    <Input
                      id="cacheTimeout"
                      type="number"
                      placeholder="24"
                      defaultValue="48"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cdnUrl">CDN URL</Label>
                    <Input
                      id="cdnUrl"
                      placeholder="https://cdn.fixithub.com"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Languages Tab */}
        <TabsContent value="languages" className="space-y-6">
          <Card>
            <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white rounded-t-lg p-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="h-5 w-5" />
                Language Management
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs mt-1">
                Manage system languages and translations
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <LanguageManagementTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <NotificationTemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        template={editingTemplate}
        onSave={handleSaveTemplate}
        mode={templateDialogMode}
      />

      <IntegrationDialog
        open={showIntegrationDialog}
        onOpenChange={setShowIntegrationDialog}
        integration={editingIntegration}
        onSave={handleSaveIntegration}
        mode={integrationDialogMode}
      />

      {/* Integration Test Result Modal */}
      <AlertDialog open={showTestResultModal} onOpenChange={setShowTestResultModal}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {testResultModal?.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Verbindung erfolgreich
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Verbindung fehlgeschlagen
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base font-medium text-foreground mt-2">
              {testResultModal?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Debug Information Section */}
          {testResultModal?.debug && (
            <div className="space-y-4 py-4 border-y">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-sm text-[#1a2a5e] mb-3">🔍 Debug-Informationen</h4>
                
                {/* Authentication Section */}
                <div className="space-y-2 mb-4">
                  <h5 className="text-xs font-semibold text-[#1a2a5e] uppercase tracking-wide">🔐 Authentifizierung</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="text-xs bg-white p-2 rounded border">
                      <span className="text-muted-foreground">Umgebung:</span>
                      <span className="ml-2 font-mono font-semibold">{testResultModal.debug.environment}</span>
                    </div>
                    <div className="text-xs bg-white p-2 rounded border">
                      <span className="text-muted-foreground">Auth-Flow:</span>
                      <span className="ml-2 font-mono font-semibold">{testResultModal.debug.authFlow}</span>
                    </div>
                    <div className="text-xs bg-white p-2 rounded border col-span-full">
                      <span className="text-muted-foreground">Token-Endpoint:</span>
                      <span className="ml-2 font-mono font-semibold break-all text-[11px]">{testResultModal.debug.tokenEndpoint}</span>
                    </div>
                    <div className="text-xs bg-white p-2 rounded border col-span-full">
                      <span className="text-muted-foreground">Test-Endpoint:</span>
                      <span className="ml-2 font-mono font-semibold break-all text-[11px]">{testResultModal.debug.probeEndpoint}</span>
                    </div>
                  </div>
                </div>

                {/* Credentials Status */}
                <div className="space-y-2 mb-4">
                  <h5 className="text-xs font-semibold text-[#1a2a5e] uppercase tracking-wide">📝 Anmeldedaten-Status</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className={`text-xs p-2 rounded border ${testResultModal.debug.hasClientId ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <span className={testResultModal.debug.hasClientId ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                        {testResultModal.debug.hasClientId ? '✅' : '❌'} Client ID
                      </span>
                    </div>
                    <div className={`text-xs p-2 rounded border ${testResultModal.debug.hasClientSecret ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <span className={testResultModal.debug.hasClientSecret ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                        {testResultModal.debug.hasClientSecret ? '✅' : '❌'} Client Secret
                      </span>
                    </div>
                    <div className={`text-xs p-2 rounded border ${testResultModal.debug.hasUsername ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <span className={testResultModal.debug.hasUsername ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                        {testResultModal.debug.hasUsername ? '✅' : '❌'} Username
                      </span>
                    </div>
                    <div className={`text-xs p-2 rounded border ${testResultModal.debug.hasPassword ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <span className={testResultModal.debug.hasPassword ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                        {testResultModal.debug.hasPassword ? '✅' : '❌'} Password
                      </span>
                    </div>
                  </div>
                </div>

                {/* Credentials Sources */}
                <div className="space-y-2 mb-4">
                  <h5 className="text-xs font-semibold text-[#1a2a5e] uppercase tracking-wide">📍 Anmeldedaten-Quellen</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="text-xs bg-white p-2 rounded border">
                      <span className="text-muted-foreground">Username-Quelle:</span>
                      <span className="ml-2 font-mono text-[11px]">{testResultModal.debug.usernameSource || 'nicht vorhanden'}</span>
                    </div>
                    <div className="text-xs bg-white p-2 rounded border">
                      <span className="text-muted-foreground">Password-Quelle:</span>
                      <span className="ml-2 font-mono text-[11px]">{testResultModal.debug.passwordSource || 'nicht vorhanden'}</span>
                    </div>
                  </div>
                </div>

                {/* Masked Credentials */}
                {testResultModal.debug.clientIdMasked && (
                  <div className="space-y-2 mb-4">
                    <h5 className="text-xs font-semibold text-[#1a2a5e] uppercase tracking-wide">🔒 Maskierte Zugangsdaten (Audit-Trail)</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="text-xs bg-white p-2 rounded border">
                        <span className="text-muted-foreground">Client ID:</span>
                        <span className="ml-2 font-mono">{testResultModal.debug.clientIdMasked}</span>
                      </div>
                      <div className="text-xs bg-white p-2 rounded border">
                        <span className="text-muted-foreground">Username:</span>
                        <span className="ml-2 font-mono">{testResultModal.debug.usernameMasked}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* OAuth Error Details */}
                {testResultModal.debug.oauthError && (
                  <div className="space-y-2 bg-red-50 border border-red-200 rounded p-3">
                    <h5 className="text-xs font-semibold text-red-700 uppercase tracking-wide">⚠️ OAuth-Fehler</h5>
                    <div className="text-xs space-y-1">
                      <div>
                        <span className="text-red-600 font-semibold">Fehlertyp:</span>
                        <span className="ml-2 font-mono">{testResultModal.debug.oauthError}</span>
                      </div>
                      <div>
                        <span className="text-red-600 font-semibold">Beschreibung:</span>
                        <span className="ml-2 font-mono">{testResultModal.debug.oauthErrorDescription || 'Keine Beschreibung'}</span>
                      </div>
                    </div>

                    {/* Troubleshooting Suggestions */}
                    <div className="mt-3 bg-white p-2 rounded border border-red-200 text-xs">
                      <p className="font-semibold text-[#1a2a5e] mb-2">🔧 Lösungsschritte:</p>
                      {testResultModal.debug.oauthError === 'invalid_client' && (
                        <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                          <li>Client ID und Secret sind falsch ODER</li>
                          <li>Sandbox-Anmeldedaten auf Production-Endpoint (oder umgekehrt)</li>
                          <li>Überprüfen Sie App-Anmeldedaten im DHL Developer Portal</li>
                          <li>Stellen Sie sicher, dass Umgebung mit Endpoint-URL übereinstimmt</li>
                        </ul>
                      )}
                      {testResultModal.debug.oauthError === 'invalid_grant' && (
                        <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                          <li>Business Customer Username oder Password sind falsch</li>
                          <li>Überprüfen Sie Anmeldedaten im DHL Partner Portal</li>
                          <li>Verwenden Sie die gleichen Daten wie zum Einloggen im Portal</li>
                        </ul>
                      )}
                      {testResultModal.debug.oauthError === 'unauthorized_client' && (
                        <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                          <li>App existiert, ist aber nicht autorisiert für Parcel DE Shipping</li>
                          <li>Im DHL Developer Portal: API Permissions überprüfen</li>
                          <li>Aktivieren Sie "Parcel DE Shipping" für diese App</li>
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowTestResultModal(false)}>
              Schließen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}