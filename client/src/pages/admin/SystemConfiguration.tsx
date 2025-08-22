import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Settings,
  Server,
  Mail,
  Bell,
  Shield,
  Save,
  RefreshCw
} from "lucide-react"

export function SystemConfiguration() {
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
            Configure system settings and preferences
          </p>
        </div>
        <Button>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

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
              <span>Server Status</span>
              <Badge className="bg-green-500">Online</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span>Database</span>
              <Badge className="bg-green-500">Connected</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span>Email Service</span>
              <Badge className="bg-green-500">Active</Badge>
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
          <div className="space-y-2">
            <Label htmlFor="site-name">Site Name</Label>
            <Input
              id="site-name"
              defaultValue="FixitHub"
              placeholder="Enter site name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-email">Admin Email</Label>
            <Input
              id="admin-email"
              type="email"
              defaultValue="admin@fixithub.com"
              placeholder="Enter admin email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              defaultValue="UTC-5 (Eastern Time)"
              placeholder="Enter timezone"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="maintenance-mode">Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">Enable to put site in maintenance mode</p>
            </div>
            <Switch id="maintenance-mode" />
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
          <CardDescription>Configure email service settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="smtp-host">SMTP Host</Label>
            <Input
              id="smtp-host"
              defaultValue="smtp.gmail.com"
              placeholder="Enter SMTP host"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtp-port">SMTP Port</Label>
              <Input
                id="smtp-port"
                defaultValue="587"
                placeholder="Enter SMTP port"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-username">SMTP Username</Label>
              <Input
                id="smtp-username"
                defaultValue="noreply@fixithub.com"
                placeholder="Enter SMTP username"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email-notifications">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">Enable system email notifications</p>
            </div>
            <Switch id="email-notifications" defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </CardTitle>
          <CardDescription>Configure system notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="order-notifications">Order Notifications</Label>
              <p className="text-sm text-muted-foreground">Notify admins of new orders</p>
            </div>
            <Switch id="order-notifications" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="payment-notifications">Payment Notifications</Label>
              <p className="text-sm text-muted-foreground">Notify of payment events</p>
            </div>
            <Switch id="payment-notifications" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="system-alerts">System Alerts</Label>
              <p className="text-sm text-muted-foreground">Critical system notifications</p>
            </div>
            <Switch id="system-alerts" defaultChecked />
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
            <Button variant="outline" className="h-auto p-4 flex-col gap-2">
              <RefreshCw className="h-6 w-6" />
              <span className="font-medium">Clear Cache</span>
              <span className="text-xs text-muted-foreground">Clear system cache</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex-col gap-2">
              <Shield className="h-6 w-6" />
              <span className="font-medium">Run Security Scan</span>
              <span className="text-xs text-muted-foreground">Check for vulnerabilities</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}