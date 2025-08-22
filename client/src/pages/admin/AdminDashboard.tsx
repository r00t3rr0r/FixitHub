import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  BarChart3,
  Users,
  Package,
  DollarSign,
  TrendingUp,
  Settings,
  Shield,
  Database
} from "lucide-react"

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
        <h1 className="text-3xl font-bold text-purple-900 dark:text-purple-100 mb-2">
          Admin Dashboard
        </h1>
        <p className="text-purple-700 dark:text-purple-300">
          Comprehensive system management and business analytics
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">$45,231</div>
            <p className="text-xs text-green-600 dark:text-green-400">
              +20.1% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Active Users
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">2,350</div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              +180 new this month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Total Orders
            </CardTitle>
            <Package className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">12,234</div>
            <p className="text-xs text-orange-600 dark:text-orange-400">
              +19% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Growth Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">+12.5%</div>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Monthly growth
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Management Sections */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* User Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Manage customers, staff, and administrators
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Customers</span>
              <Badge variant="secondary">2,180</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Staff Members</span>
              <Badge variant="secondary">45</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Administrators</span>
              <Badge variant="secondary">8</Badge>
            </div>
            <Button className="w-full mt-4">
              Manage Users
            </Button>
          </CardContent>
        </Card>

        {/* Order Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Management
            </CardTitle>
            <CardDescription>
              Monitor and manage repair orders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Pending Orders</span>
              <Badge variant="destructive">23</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">In Progress</span>
              <Badge variant="default">67</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Completed Today</span>
              <Badge variant="secondary">34</Badge>
            </div>
            <Button className="w-full mt-4">
              View All Orders
            </Button>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Settings
            </CardTitle>
            <CardDescription>
              Configure system preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <Shield className="h-4 w-4 mr-2" />
              Security Settings
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Database className="h-4 w-4 mr-2" />
              Database Management
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics Config
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent System Activity</CardTitle>
          <CardDescription>
            Latest actions and system events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { action: "New user registration", user: "john.doe@example.com", time: "2 minutes ago", type: "user" },
              { action: "Order completed", user: "Staff: Sarah Johnson", time: "5 minutes ago", type: "order" },
              { action: "Payment processed", user: "Order #ORD-1234", time: "10 minutes ago", type: "payment" },
              { action: "System backup completed", user: "System", time: "1 hour ago", type: "system" }
            ].map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'user' ? 'bg-blue-500' :
                    activity.type === 'order' ? 'bg-green-500' :
                    activity.type === 'payment' ? 'bg-purple-500' :
                    'bg-gray-500'
                  }`} />
                  <div>
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-sm text-muted-foreground">{activity.user}</p>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}