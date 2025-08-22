import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  BarChart3,
  HardDrive,
  Activity
} from "lucide-react"

export function DatabaseManagement() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Database className="h-8 w-8" />
          Database Management
        </h1>
        <p className="text-muted-foreground">
          Monitor and manage database operations
        </p>
      </div>

      {/* Database Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Size</CardTitle>
            <HardDrive className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.4 GB</div>
            <p className="text-xs text-muted-foreground">+120 MB this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45,231</div>
            <p className="text-xs text-muted-foreground">+1,234 this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Activity className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">Current connections</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Backup</CardTitle>
            <Database className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2h ago</div>
            <p className="text-xs text-muted-foreground">Automatic backup</p>
          </CardContent>
        </Card>
      </div>

      {/* Database Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Database Operations</CardTitle>
          <CardDescription>Perform database maintenance and backup operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button className="h-auto p-4 flex-col gap-2">
              <Download className="h-6 w-6" />
              <span className="font-medium">Create Backup</span>
              <span className="text-xs opacity-80">Export database</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex-col gap-2">
              <Upload className="h-6 w-6" />
              <span className="font-medium">Restore Backup</span>
              <span className="text-xs opacity-80">Import database</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex-col gap-2">
              <RefreshCw className="h-6 w-6" />
              <span className="font-medium">Optimize Tables</span>
              <span className="text-xs opacity-80">Improve performance</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex-col gap-2">
              <Trash2 className="h-6 w-6" />
              <span className="font-medium">Clean Logs</span>
              <span className="text-xs opacity-80">Remove old logs</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table Information */}
      <Card>
        <CardHeader>
          <CardTitle>Table Information</CardTitle>
          <CardDescription>Database table statistics and information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { table: 'users', records: 2350, size: '45 MB', status: 'Healthy' },
              { table: 'orders', records: 12234, size: '890 MB', status: 'Healthy' },
              { table: 'products', records: 456, size: '12 MB', status: 'Healthy' },
              { table: 'notifications', records: 8901, size: '234 MB', status: 'Needs Cleanup' }
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <span className="font-medium">{item.table}</span>
                  <span className="text-sm text-muted-foreground">{item.records} records</span>
                  <span className="text-sm text-muted-foreground">{item.size}</span>
                </div>
                <Badge variant={item.status === 'Healthy' ? 'default' : 'destructive'}>
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle>Backup History</CardTitle>
          <CardDescription>Recent database backups</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { date: '2024-01-15 14:30', size: '2.4 GB', type: 'Automatic', status: 'Success' },
              { date: '2024-01-14 14:30', size: '2.3 GB', type: 'Automatic', status: 'Success' },
              { date: '2024-01-13 14:30', size: '2.3 GB', type: 'Manual', status: 'Success' }
            ].map((backup, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-4">
                  <span className="font-medium">{backup.date}</span>
                  <span className="text-sm text-muted-foreground">{backup.size}</span>
                  <Badge variant="outline">{backup.type}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500">{backup.status}</Badge>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}