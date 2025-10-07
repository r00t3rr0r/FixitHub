import { useEffect, useState } from "react"
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
  Integration
} from "@/api/systemConfig"
import { NotificationTemplateDialog } from "@/components/admin/NotificationTemplateDialog"
import { IntegrationDialog } from "@/components/admin/IntegrationDialog"
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
  Clock,
  Users,
  ShoppingCart,
  Image,
  Upload,
  Lock,
  Eye,
  EyeOff,
  Home,
  BookOpen,
  Store,
  Search,
  Globe,
  Palette,
  Layout,
  Type,
  Video,
  Camera,
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

export function SystemConfiguration() {
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)
  const [runningSecurityScan, setRunningSecurityScan] = useState(false)
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null)

  // Dialog states
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [showIntegrationDialog, setShowIntegrationDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null)
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null)
  const [templateDialogMode, setTemplateDialogMode] = useState<'create' | 'edit'>('create')
  const [integrationDialogMode, setIntegrationDialogMode] = useState<'create' | 'edit'>('create')

  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      console.log("SystemConfiguration: Loading system configuration data...")
      const [configResponse, templatesResponse, integrationsResponse] = await Promise.all([
        getSystemConfig(),
        getNotificationTemplates(),
        getIntegrations()
      ])

      setConfig(configResponse.config)
      setTemplates(templatesResponse.templates)
      setIntegrations(integrationsResponse.integrations)
      console.log("SystemConfiguration: Data loaded successfully")
    } catch (error: any) {
      console.error("SystemConfiguration: Error loading data:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load system configuration",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!config) return

    setSaving(true)
    try {
      console.log("SystemConfiguration: Saving configuration...")
      const response = await updateSystemConfig(config)
      setConfig(response.config)
      toast({
        title: "Success",
        description: "System configuration updated successfully"
      })
    } catch (error: any) {
      console.error("SystemConfiguration: Error saving config:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save configuration",
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
    } catch (error: any) {
      console.error("SystemConfiguration: Error clearing cache:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to clear cache",
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
    } catch (error: any) {
      console.error("SystemConfiguration: Error running security scan:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to run security scan",
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

  const handleSaveTemplate = async (templateData: Omit<NotificationTemplate, '_id'>) => {
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
    } catch (error: any) {
      console.error("SystemConfiguration: Error saving template:", error)
      throw error
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
    } catch (error: any) {
      console.error("SystemConfiguration: Error deleting template:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete template",
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
    } catch (error: any) {
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
    } catch (error: any) {
      console.error("SystemConfiguration: Error deleting integration:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete integration",
        variant: "destructive"
      })
    }
  }

  const handleTestIntegration = async (integrationId: string) => {
    setTestingIntegration(integrationId)
    try {
      console.log("SystemConfiguration: Testing integration:", integrationId)
      const response = await testIntegration(integrationId)

      if (response.result.success) {
        toast({
          title: "Success",
          description: response.result.message
        })
      } else {
        toast({
          title: "Test Failed",
          description: response.result.message,
          variant: "destructive"
        })
      }

      // Update integration test status
      setIntegrations(prev => prev.map(i =>
        i._id === integrationId
          ? { ...i, testStatus: response.result.success ? 'success' : 'failed' }
          : i
      ))
    } catch (error: any) {
      console.error("SystemConfiguration: Error testing integration:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to test integration",
        variant: "destructive"
      })
    } finally {
      setTestingIntegration(null)
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            System Configuration
          </h1>
          <p className="text-muted-foreground">
            Configure system settings, notifications, integrations, and security
          </p>
        </div>
        <Button onClick={handleSaveConfig} disabled={saving}>
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                System Status
              </CardTitle>
              <CardDescription>Current system health and status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    <span>Server Status</span>
                  </div>
                  <Badge className="bg-green-500 text-white">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Online
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span>Database</span>
                  </div>
                  <Badge className="bg-green-500 text-white">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>Email Service</span>
                  </div>
                  <Badge className="bg-green-500 text-white">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Basic system configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={config.timezone}
                    onValueChange={(value) => setConfig(prev => prev ? { ...prev, timezone: value } : null)}
                  >
                    <SelectTrigger>
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
            <CardHeader>
              <CardTitle>System Actions</CardTitle>
              <CardDescription>Perform system maintenance tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={handleClearCache}
                  disabled={clearingCache}
                  className="h-auto p-4 flex-col gap-2"
                >
                  {clearingCache ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current"></div>
                  ) : (
                    <RefreshCw className="h-6 w-6" />
                  )}
                  <span className="font-medium">Clear Cache</span>
                  <span className="text-xs text-muted-foreground">Clear system cache</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRunSecurityScan}
                  disabled={runningSecurityScan}
                  className="h-auto p-4 flex-col gap-2"
                >
                  {runningSecurityScan ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current"></div>
                  ) : (
                    <Scan className="h-6 w-6" />
                  )}
                  <span className="font-medium">Run Security Scan</span>
                  <span className="text-xs text-muted-foreground">Check for vulnerabilities</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab - Combined notifications settings and templates */}
        <TabsContent value="notifications" className="space-y-6">
          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>Configure notification preferences and behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="orderNotifications">Order Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send notifications for order updates</p>
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
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="paymentNotifications">Payment Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send notifications for payment events</p>
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
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="systemAlerts">System Alerts</Label>
                  <p className="text-sm text-muted-foreground">Send system-wide alerts and announcements</p>
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

          {/* Email Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Configuration
              </CardTitle>
              <CardDescription>Configure SMTP settings for email notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input
                    id="smtpHost"
                    value={config.emailSettings?.smtpHost || ''}
                    onChange={(e) => setConfig(prev => prev ? {
                      ...prev,
                      emailSettings: {
                        ...prev.emailSettings,
                        smtpHost: e.target.value
                      }
                    } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">SMTP Port</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    value={config.emailSettings?.smtpPort || 587}
                    onChange={(e) => setConfig(prev => prev ? {
                      ...prev,
                      emailSettings: {
                        ...prev.emailSettings,
                        smtpPort: parseInt(e.target.value)
                      }
                    } : null)}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtpUsername">SMTP Username</Label>
                  <Input
                    id="smtpUsername"
                    value={config.emailSettings?.smtpUsername || ''}
                    onChange={(e) => setConfig(prev => prev ? {
                      ...prev,
                      emailSettings: {
                        ...prev.emailSettings,
                        smtpUsername: e.target.value
                      }
                    } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPassword">SMTP Password</Label>
                  <Input
                    id="smtpPassword"
                    type="password"
                    value={config.emailSettings?.smtpPassword || ''}
                    onChange={(e) => setConfig(prev => prev ? {
                      ...prev,
                      emailSettings: {
                        ...prev.emailSettings,
                        smtpPassword: e.target.value
                      }
                    } : null)}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={config.emailSettings?.enableNotifications}
                  onCheckedChange={(checked) => setConfig(prev => prev ? {
                    ...prev,
                    emailSettings: {
                      ...prev.emailSettings,
                      enableNotifications: checked
                    }
                  } : null)}
                />
                <Label>Enable Email Notifications</Label>
              </div>
            </CardContent>
          </Card>

          {/* Notification Templates */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Notification Templates
                  </CardTitle>
                  <CardDescription>Create and manage notification templates with dynamic variables</CardDescription>
                </div>
                <Button onClick={handleCreateTemplate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No notification templates found</p>
                  <p className="text-sm text-muted-foreground">Create your first template to get started</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {templates.map((template) => (
                    <Card key={template._id} className="relative">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline">{template.type}</Badge>
                              <Badge variant={template.isActive ? "default" : "secondary"}>
                                {template.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-1">
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
                                  <AlertDialogTitle>Delete Template</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{template.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteTemplate(template._id)}
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
                        {template.subject && (
                          <div className="mb-2">
                            <p className="text-sm font-medium">Subject:</p>
                            <p className="text-sm text-muted-foreground">{template.subject}</p>
                          </div>
                        )}
                        <div className="mb-3">
                          <p className="text-sm font-medium">Content Preview:</p>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {template.content}
                          </p>
                        </div>
                        {template.variables && template.variables.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Variables ({template.variables.length}):</p>
                            <div className="flex flex-wrap gap-1">
                              {template.variables.slice(0, 3).map((variable) => (
                                <Badge key={variable.name} variant="outline" className="text-xs">
                                  {`{{${variable.name}}}`}
                                </Badge>
                              ))}
                              {template.variables.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{template.variables.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Link className="h-5 w-5" />
                    Third-Party Integrations
                  </CardTitle>
                  <CardDescription>Manage external service integrations and API connections</CardDescription>
                </div>
                <Button onClick={handleCreateIntegration}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Integration
                </Button>
              </div>
            </CardHeader>
            <CardContent>
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Workflow Settings
              </CardTitle>
              <CardDescription>Configure workflow automation and business processes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>Configure security policies and access controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Homepage Content Management
              </CardTitle>
              <CardDescription>Configure homepage sections, layout, and content display</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Blog Content Management
              </CardTitle>
              <CardDescription>Configure blog display, categories, and content policies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Shop Content Management
              </CardTitle>
              <CardDescription>Configure product display, categories, and shopping experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileImage className="h-5 w-5" />
                Media & File Management
              </CardTitle>
              <CardDescription>Configure file uploads, image optimization, and media handling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                SEO & Performance Settings
              </CardTitle>
              <CardDescription>Configure search engine optimization and site performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
    </div>
  )
}