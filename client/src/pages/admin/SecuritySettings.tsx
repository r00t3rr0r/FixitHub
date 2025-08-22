import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Shield,
  Lock,
  Eye,
  AlertTriangle,
  Key,
  UserCheck,
  Activity,
  Save
} from "lucide-react"

export function SecuritySettings() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Security Settings
          </h1>
          <p className="text-muted-foreground">
            Configure security policies and access controls
          </p>
        </div>
        <Button>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      {/* Security Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Status
          </CardTitle>
          <CardDescription>Current security health overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span>SSL Certificate</span>
              <Badge className="bg-green-500">Valid</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span>Firewall Status</span>
              <Badge className="bg-green-500">Active</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span>Security Score</span>
              <Badge className="bg-green-500">95/100</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Authentication Settings
          </CardTitle>
          <CardDescription>Configure user authentication policies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="two-factor">Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">Require 2FA for admin accounts</p>
            </div>
            <Switch id="two-factor" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="password-complexity">Strong Password Policy</Label>
              <p className="text-sm text-muted-foreground">Enforce complex passwords</p>
            </div>
            <Switch id="password-complexity" defaultChecked />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
            <Input
              id="session-timeout"
              type="number"
              defaultValue="30"
              placeholder="Enter timeout in minutes"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-login-attempts">Max Login Attempts</Label>
            <Input
              id="max-login-attempts"
              type="number"
              defaultValue="5"
              placeholder="Enter max attempts"
            />
          </div>
        </CardContent>
      </Card>

      {/* Access Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Access Control
          </CardTitle>
          <CardDescription>Manage user permissions and access levels</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="ip-whitelist">IP Whitelist</Label>
              <p className="text-sm text-muted-foreground">Restrict admin access by IP</p>
            </div>
            <Switch id="ip-whitelist" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="role-based-access">Role-Based Access Control</Label>
              <p className="text-sm text-muted-foreground">Enable granular permissions</p>
            </div>
            <Switch id="role-based-access" defaultChecked />
          </div>
          <div className="space-y-2">
            <Label htmlFor="allowed-ips">Allowed IP Addresses</Label>
            <Input
              id="allowed-ips"
              placeholder="Enter IP addresses (comma separated)"
            />
          </div>
        </CardContent>
      </Card>

      {/* Security Monitoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Security Monitoring
          </CardTitle>
          <CardDescription>Monitor security events and threats</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="login-monitoring">Login Monitoring</Label>
              <p className="text-sm text-muted-foreground">Track login attempts and failures</p>
            </div>
            <Switch id="login-monitoring" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="suspicious-activity">Suspicious Activity Detection</Label>
              <p className="text-sm text-muted-foreground">Alert on unusual behavior</p>
            </div>
            <Switch id="suspicious-activity" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="audit-logging">Audit Logging</Label>
              <p className="text-sm text-muted-foreground">Log all admin actions</p>
            </div>
            <Switch id="audit-logging" defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Recent Security Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Recent Security Events
          </CardTitle>
          <CardDescription>Latest security-related activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { event: 'Failed login attempt', user: 'unknown@example.com', time: '2 minutes ago', severity: 'medium' },
              { event: 'Admin login', user: 'admin@fixithub.com', time: '15 minutes ago', severity: 'low' },
              { event: 'Password changed', user: 'staff@fixithub.com', time: '1 hour ago', severity: 'low' },
              { event: 'Multiple failed attempts', user: '192.168.1.100', time: '2 hours ago', severity: 'high' }
            ].map((event, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${
                    event.severity === 'high' ? 'bg-red-500' :
                    event.severity === 'medium' ? 'bg-orange-500' :
                    'bg-green-500'
                  }`} />
                  <div>
                    <p className="font-medium">{event.event}</p>
                    <p className="text-sm text-muted-foreground">{event.user}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{event.time}</span>
                  <Badge variant={
                    event.severity === 'high' ? 'destructive' :
                    event.severity === 'medium' ? 'default' :
                    'secondary'
                  }>
                    {event.severity}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Security Actions</CardTitle>
          <CardDescription>Perform security-related tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Button variant="outline" className="h-auto p-4 flex-col gap-2">
              <Key className="h-6 w-6" />
              <span className="font-medium">Generate API Keys</span>
              <span className="text-xs text-muted-foreground">Create new API keys</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex-col gap-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="font-medium">Security Scan</span>
              <span className="text-xs text-muted-foreground">Run vulnerability check</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}