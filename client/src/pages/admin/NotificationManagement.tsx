import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/useToast"
import {
  getNotificationTemplates,
  getNotificationRules,
  getNotificationHistory,
  getNotificationSettings,
  getNotificationAnalytics,
  NotificationTemplate,
  NotificationRule,
  NotificationHistory,
  NotificationSettings,
  NotificationAnalytics
} from "@/api/notificationManagement"
import {
  Bell,
  Search,
  Plus,
  Edit,
  Eye,
  Send,
  Mail,
  MessageSquare,
  Smartphone,
  Settings,
  BarChart3,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Users,
  Filter
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function NotificationManagement() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [history, setHistory] = useState<NotificationHistory[]>([])
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [analytics, setAnalytics] = useState<NotificationAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching notification management data...")
        const [templatesResponse, rulesResponse, historyResponse, settingsResponse, analyticsResponse] = await Promise.all([
          getNotificationTemplates(),
          getNotificationRules(),
          getNotificationHistory(),
          getNotificationSettings(),
          getNotificationAnalytics()
        ])

        setTemplates((templatesResponse as any).templates || [])
        setRules((rulesResponse as any).rules || [])
        setHistory((historyResponse as any).history || [])
        setSettings((settingsResponse as any).settings || null)
        setAnalytics((analyticsResponse as any).analytics || null)
      } catch (error) {
        console.error("Error fetching notification data:", error)
        toast({
          title: "Error",
          description: "Failed to load notification data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [toast])

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'sms':
        return <MessageSquare className="h-4 w-4" />
      case 'push':
        return <Smartphone className="h-4 w-4" />
      case 'in_app':
        return <Bell className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'opened':
      case 'clicked':
        return 'bg-green-500 text-white'
      case 'sent':
        return 'bg-blue-500 text-white'
      case 'pending':
        return 'bg-yellow-500 text-black'
      case 'failed':
        return 'bg-red-500 text-white'
      default:
        return 'bg-gray-500 text-white'
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
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Notification Management
          </h1>
          <p className="text-muted-foreground">
            Manage notification templates, automation rules, and delivery settings
          </p>
        </div>
        <Dialog open={showCreateTemplate} onOpenChange={setShowCreateTemplate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl bg-background">
            <DialogHeader>
              <DialogTitle>Create Notification Template</DialogTitle>
              <DialogDescription>
                Create a new notification template for automated messaging
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input id="template-name" placeholder="Enter template name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-type">Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="push">Push Notification</SelectItem>
                      <SelectItem value="in_app">In-App</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-subject">Subject (Email only)</Label>
                <Input id="template-subject" placeholder="Enter email subject" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-content">Content</Label>
                <Textarea
                  id="template-content"
                  placeholder="Enter notification content with variables like {{customerName}}"
                  rows={6}
                />
              </div>
              <div className="space-y-2">
                <Label>Available Variables</Label>
                <div className="flex flex-wrap gap-2">
                  {['customerName', 'orderNumber', 'deviceModel', 'status', 'amount'].map((variable) => (
                    <Badge key={variable} variant="outline" className="text-xs">
                      {`{{${variable}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateTemplate(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowCreateTemplate(false)}>
                Create Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Total Sent
              </CardTitle>
              <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {analytics.totalSent.toLocaleString()}
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Notifications delivered
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                Delivery Rate
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {analytics.deliveryRate.toFixed(1)}%
              </div>
              <p className="text-xs text-green-600 dark:text-green-400">
                Successfully delivered
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
                Open Rate
              </CardTitle>
              <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {analytics.openRate.toFixed(1)}%
              </div>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                Messages opened
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
                Click Rate
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                {analytics.clickRate.toFixed(1)}%
              </div>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                Click-through rate
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="rules">Automation Rules</TabsTrigger>
          <TabsTrigger value="history">Delivery History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search templates..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-48">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="push">Push</SelectItem>
                      <SelectItem value="in_app">In-App</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Templates Grid */}
          <div className="grid gap-6">
            {templates.map((template) => (
              <Card key={template._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {getChannelIcon(template.type)}
                        {template.name}
                        <Badge variant={template.isActive ? "default" : "secondary"}>
                          {template.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {template.subject && (
                          <span className="font-medium">Subject: {template.subject}</span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm">{template.content}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {template.variables.map((variable) => (
                      <Badge key={variable} variant="outline" className="text-xs">
                        {`{{${variable}}}`}
                      </Badge>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-primary">{template.usage.sent}</p>
                      <p className="text-xs text-muted-foreground">Sent</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-primary">{template.usage.delivered}</p>
                      <p className="text-xs text-muted-foreground">Delivered</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-primary">{template.usage.opened}</p>
                      <p className="text-xs text-muted-foreground">Opened</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-primary">{template.usage.clicked}</p>
                      <p className="text-xs text-muted-foreground">Clicked</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="grid gap-6">
            {rules.map((rule) => (
              <Card key={rule._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {rule.name}
                        <Badge variant={rule.isActive ? "default" : "secondary"}>
                          {rule.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">{rule.priority}</Badge>
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {rule.description}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium mb-2">Trigger</p>
                      <Badge variant="outline">{rule.trigger.replace('_', ' ')}</Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Template</p>
                      <Badge variant="outline">{rule.templateName}</Badge>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Channels</p>
                    <div className="flex gap-2">
                      {rule.channels.map((channel) => (
                        <div key={channel} className="flex items-center gap-1">
                          {getChannelIcon(channel)}
                          <Badge variant="secondary" className="text-xs">
                            {channel}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {rule.escalation.enabled && (
                    <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                          Escalation enabled after {rule.escalation.delay} minutes
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Delivery History</CardTitle>
              <CardDescription>
                Recent notification deliveries and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow key={item._id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.recipient.name}</p>
                          <p className="text-sm text-muted-foreground">{item.recipient.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{item.templateName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getChannelIcon(item.channel)}
                          <span className="capitalize">{item.channel}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(item.status)}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(item.sentAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          {settings && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Email Settings</CardTitle>
                  <CardDescription>Configure email notification delivery</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">Send notifications via email</p>
                    </div>
                    <Switch defaultChecked={settings.email.enabled} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>From Name</Label>
                      <Input defaultValue={settings.email.fromName} />
                    </div>
                    <div className="space-y-2">
                      <Label>From Email</Label>
                      <Input defaultValue={settings.email.fromEmail} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Reply To</Label>
                    <Input defaultValue={settings.email.replyTo} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>SMS Settings</CardTitle>
                  <CardDescription>Configure SMS notification delivery</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable SMS Notifications</Label>
                      <p className="text-sm text-muted-foreground">Send notifications via SMS</p>
                    </div>
                    <Switch defaultChecked={settings.sms.enabled} />
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select defaultValue={settings.sms.provider}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="twilio">Twilio</SelectItem>
                        <SelectItem value="nexmo">Nexmo</SelectItem>
                        <SelectItem value="aws_sns">AWS SNS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Push Notification Settings</CardTitle>
                  <CardDescription>Configure push notification delivery</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Push Notifications</Label>
                      <p className="text-sm text-muted-foreground">Send push notifications</p>
                    </div>
                    <Switch defaultChecked={settings.push.enabled} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Web Push</Label>
                      <p className="text-sm text-muted-foreground">Browser notifications</p>
                    </div>
                    <Switch defaultChecked={settings.push.webPush} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Mobile Push</Label>
                      <p className="text-sm text-muted-foreground">Mobile app notifications</p>
                    </div>
                    <Switch defaultChecked={settings.push.mobilePush} />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {analytics && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Channel Performance</CardTitle>
                  <CardDescription>Performance breakdown by notification channel</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.channelBreakdown.map((channel) => (
                      <div key={channel.channel} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getChannelIcon(channel.channel)}
                            <span className="font-medium capitalize">{channel.channel}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {channel.sent} sent
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Delivery Rate</span>
                            <span>{((channel.delivered / channel.sent) * 100).toFixed(1)}%</span>
                          </div>
                          <Progress value={(channel.delivered / channel.sent) * 100} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Template Performance</CardTitle>
                  <CardDescription>Performance metrics for each template</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Delivery Rate</TableHead>
                        <TableHead>Open Rate</TableHead>
                        <TableHead>Click Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.templatePerformance.map((template) => (
                        <TableRow key={template.templateId}>
                          <TableCell className="font-medium">{template.templateName}</TableCell>
                          <TableCell>{template.sent}</TableCell>
                          <TableCell>{template.deliveryRate.toFixed(1)}%</TableCell>
                          <TableCell>{template.openRate.toFixed(1)}%</TableCell>
                          <TableCell>{template.clickRate.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}