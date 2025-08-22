import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Wrench,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  Calendar,
  BarChart3
} from "lucide-react"

export function StaffDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <h1 className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-2">
          Staff Dashboard
        </h1>
        <p className="text-blue-700 dark:text-blue-300">
          Manage repair orders, track progress, and collaborate with your team
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Assigned Orders
            </CardTitle>
            <Wrench className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">12</div>
            <p className="text-xs text-orange-600 dark:text-orange-400">
              +2 from yesterday
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              In Progress
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">8</div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Active repairs
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Completed Today
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">5</div>
            <p className="text-xs text-green-600 dark:text-green-400">
              Great progress!
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
              Urgent Orders
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900 dark:text-red-100">3</div>
            <p className="text-xs text-red-600 dark:text-red-400">
              Needs attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks and shortcuts for staff members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button className="h-auto p-4 flex-col gap-2">
              <Clock className="h-6 w-6" />
              <span className="font-medium">Clock In/Out</span>
              <span className="text-xs opacity-80">Track work hours</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex-col gap-2">
              <Users className="h-6 w-6" />
              <span className="font-medium">Team Chat</span>
              <span className="text-xs opacity-80">Collaborate with team</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex-col gap-2">
              <Calendar className="h-6 w-6" />
              <span className="font-medium">Schedule</span>
              <span className="text-xs opacity-80">View appointments</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>
            Orders assigned to you or your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { id: "ORD-001", device: "iPhone 14 Pro", service: "Screen Replacement", status: "in-progress", priority: "high" },
              { id: "ORD-002", device: "Samsung Galaxy S23", service: "Battery Replacement", status: "pending", priority: "normal" },
              { id: "ORD-003", device: "Google Pixel 8", service: "Camera Repair", status: "quality-check", priority: "low" }
            ].map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    order.status === 'in-progress' ? 'bg-blue-500' :
                    order.status === 'pending' ? 'bg-gray-500' :
                    'bg-yellow-500'
                  }`} />
                  <div>
                    <p className="font-medium">{order.device}</p>
                    <p className="text-sm text-muted-foreground">{order.service}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    order.priority === 'high' ? 'destructive' :
                    order.priority === 'normal' ? 'default' :
                    'secondary'
                  }>
                    {order.priority}
                  </Badge>
                  <Button size="sm" variant="outline">
                    View
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