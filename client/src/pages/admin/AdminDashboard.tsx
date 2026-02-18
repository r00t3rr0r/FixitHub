import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  BarChart3,
  Users,
  Package,
  DollarSign,
  TrendingUp,
  Settings,
  Shield,
  Database,
  Clock,
  AlertCircle,
  CheckCircle,
  Calendar,
  Wrench,
  Bell,
  Activity,
  UserCheck,
  FileText,
  Download,
  RefreshCw,
  ArrowRight,
  Timer
} from "lucide-react"
import {
  getDashboardSummary,
  getRecentBookings,
  getActiveRepairRequests,
  getRecentNotifications,
  getRecentActivities,
  getStaffStatus,
  getAssignedOrders,
  getSystemOverview
} from "@/api/adminDashboard"

interface DashboardData {
  bookings: any[];
  repairRequests: any[];
  notifications: any[];
  activities: any[];
  staffStatus: any[];
  assignedOrders: any[];
  systemOverview: any;
}

// Description: Admin Dashboard Page - Real-time comprehensive overview
// Endpoint: N/A (Frontend component)
// Request: N/A
// Response: N/A
export function AdminDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    bookings: [],
    repairRequests: [],
    notifications: [],
    activities: [],
    staffStatus: [],
    assignedOrders: [],
    systemOverview: {}
  })

  // Fetch dashboard data
  const fetchDashboardData = async (showToast: boolean = false) => {
    try {
      if (showToast) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const data = await getDashboardSummary()
      console.log('Admin Dashboard: Fetched dashboard data with counts:', {
        bookings: data.bookings?.length || 0,
        repairRequests: data.repairRequests?.length || 0,
        notifications: data.notifications?.length || 0,
        activities: data.activities?.length || 0,
        staffStatus: data.staffStatus?.length || 0,
        assignedOrders: data.assignedOrders?.length || 0,
        systemOverview: !!data.systemOverview
      })

      // Ensure all arrays are properly set
      const processedData = {
        bookings: Array.isArray(data.bookings) ? data.bookings : [],
        repairRequests: Array.isArray(data.repairRequests) ? data.repairRequests : [],
        notifications: Array.isArray(data.notifications) ? data.notifications : [],
        activities: Array.isArray(data.activities) ? data.activities : [],
        staffStatus: Array.isArray(data.staffStatus) ? data.staffStatus : [],
        assignedOrders: Array.isArray(data.assignedOrders) ? data.assignedOrders : [],
        systemOverview: (typeof data.systemOverview === 'object' && data.systemOverview !== null) ? data.systemOverview : {}
      }

      console.log('Admin Dashboard: Processed data ready for display:', processedData)

      setDashboardData(processedData)

      if (showToast) {
        toast({
          title: "Dashboard Refreshed",
          description: `Updated: ${processedData.bookings.length} bookings, ${processedData.repairRequests.length} repair requests, ${processedData.notifications.length} notifications`
        })
      }
    } catch (error: any) {
      console.error('Admin Dashboard: Error fetching dashboard data:', error)
      toast({
        variant: "destructive",
        title: "Error Loading Dashboard",
        description: error.message || "Failed to load dashboard data"
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initial data load
  useEffect(() => {
    console.log('Admin Dashboard: Mounting component, fetching initial data')
    fetchDashboardData()

    // Auto-refresh every 15 seconds for real-time updates
    const interval = setInterval(() => {
      console.log('Admin Dashboard: Auto-refreshing data...')
      fetchDashboardData()
    }, 15000)

    return () => {
      console.log('Admin Dashboard: Unmounting component, clearing interval')
      clearInterval(interval)
    }
  }, [])

  // Helper function to format time ago
  const timeAgo = (date: string) => {
    const now = new Date().getTime()
    const then = new Date(date).getTime()
    const diff = now - then
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes} min ago`
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    return `${days} day${days > 1 ? 's' : ''} ago`
  }

  // Helper function to format duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  // Export data function
  const handleExportData = () => {
    const dataStr = JSON.stringify(dashboardData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
    const exportFileDefaultName = `admin-dashboard-${new Date().toISOString()}.json`
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
    toast({
      title: "Data Exported",
      description: "Dashboard data has been exported successfully"
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  const { systemOverview } = dashboardData

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-purple-900 dark:text-purple-100 mb-2">
              Admin Dashboard
            </h1>
            <p className="text-purple-700 dark:text-purple-300">
              Real-time comprehensive overview of your repair business
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportData}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export Data
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* System Overview Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Orders
            </CardTitle>
            <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {systemOverview.totalOrders || 0}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {systemOverview.pendingOrders || 0} pending
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {systemOverview.totalUsers || 0}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400">
              {systemOverview.activeStaff || 0} active staff
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Repair Requests
            </CardTitle>
            <Wrench className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {systemOverview.totalRepairRequests || 0}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400">
              {systemOverview.pendingRepairRequests || 0} pending
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              System Health
            </CardTitle>
            <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {systemOverview.systemHealth || 'Good'}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              DB: {systemOverview.databaseStatus || 'Connected'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Bookings */}
        <Card className="col-span-full lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              New Bookings
            </CardTitle>
            <CardDescription>Latest booking requests</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {dashboardData.bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No recent bookings</p>
                ) : (
                  dashboardData.bookings.slice(0, 5).map((booking: any) => (
                    <div key={booking._id} className="flex items-start justify-between p-3 rounded-lg border hover:bg-accent transition-colors">
                      <div className="space-y-1 flex-1">
                        <p className="font-medium text-sm">
                          {booking.customer?.firstName} {booking.customer?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{booking.service?.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant={booking.status === 'confirmed' ? 'default' : booking.status === 'pending' ? 'secondary' : 'outline'} className="text-xs">
                            {booking.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(booking.bookingTime)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">${booking.totalAmount || 0}</p>
                        <Badge variant={booking.paymentStatus === 'paid' ? 'default' : 'secondary'} className="text-xs">
                          {booking.paymentStatus}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <Separator className="my-4" />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/admin/bookings')}
            >
              View All Bookings
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Active Repair Requests */}
        <Card className="col-span-full lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Repair Requests
            </CardTitle>
            <CardDescription>Current repair requests status</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {dashboardData.repairRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No active repair requests</p>
                ) : (
                  dashboardData.repairRequests.slice(0, 5).map((request: any) => (
                    <div key={request._id} className="p-3 rounded-lg border hover:bg-accent transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="space-y-1 flex-1">
                          <p className="font-medium text-sm">
                            {request.customer?.firstName} {request.customer?.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{request.deviceType}</p>
                        </div>
                        <Badge
                          variant={request.urgency === 'high' ? 'destructive' : request.urgency === 'medium' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {request.urgency}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {request.issueDescription}
                      </p>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {request.status}
                        </Badge>
                        {request.estimatedCompletionDate && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(request.estimatedCompletionDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <Separator className="my-4" />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/admin/repair-requests')}
            >
              View All Requests
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Notifications & Messages */}
        <Card className="col-span-full lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Recent alerts and messages</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {dashboardData.notifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No new notifications</p>
                ) : (
                  dashboardData.notifications.slice(0, 8).map((notification: any) => (
                    <div
                      key={notification._id}
                      className={`p-3 rounded-lg border hover:bg-accent transition-colors ${
                        notification.isUrgent ? 'border-red-500 bg-red-50 dark:bg-red-950' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {notification.isUrgent && (
                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 space-y-1">
                          <p className={`font-medium text-sm ${notification.isUrgent ? 'text-red-700 dark:text-red-300' : ''}`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(notification.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <Separator className="my-4" />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/notifications')}
            >
              View All Notifications
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Staff Status & Assigned Orders */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Staff Member Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Staff Status
            </CardTitle>
            <CardDescription>Current staff availability and assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {dashboardData.staffStatus.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No staff members found</p>
                ) : (
                  dashboardData.staffStatus.map((staff: any) => (
                    <div key={staff._id} className="p-3 rounded-lg border hover:bg-accent transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            staff.availability === 'available' ? 'bg-green-500' :
                            staff.availability === 'busy' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`} />
                          <p className="font-medium text-sm">
                            {staff.firstName} {staff.lastName}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {staff.availability}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {staff.assignedOrders || 0} orders
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {staff.assignedTasks || 0} tasks
                        </span>
                      </div>
                      {staff.activeWorkSession && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded text-xs">
                          <p className="font-medium text-blue-700 dark:text-blue-300">
                            Currently working: {staff.activeWorkSession.taskDescription}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <Separator className="my-4" />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/admin/staff')}
            >
              Manage Staff
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Assigned Orders with Time Tracking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Assigned Orders
            </CardTitle>
            <CardDescription>Orders with time tracking metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {dashboardData.assignedOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No assigned orders</p>
                ) : (
                  dashboardData.assignedOrders.map((order: any) => (
                    <div key={order._id} className="p-3 rounded-lg border hover:bg-accent transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">#{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            Customer: {order.customer?.firstName} {order.customer?.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Assigned to: {order.assignedTo?.firstName} {order.assignedTo?.lastName}
                          </p>
                        </div>
                        <Badge
                          variant={order.priority === 'urgent' ? 'destructive' : order.priority === 'high' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {order.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {order.status}
                        </Badge>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(order.totalTimeSpent || 0)}</span>
                        </div>
                      </div>
                      {order.lastActivity && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last activity: {timeAgo(order.lastActivity)}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <Separator className="my-4" />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/admin/orders')}
            >
              View All Orders
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activities
          </CardTitle>
          <CardDescription>Latest system-wide activities and events</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[250px]">
            <div className="space-y-3">
              {dashboardData.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No recent activities</p>
              ) : (
                dashboardData.activities.slice(0, 10).map((activity: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.type === 'order' ? 'bg-blue-500' :
                        activity.type === 'user' ? 'bg-green-500' :
                        activity.type === 'repair_request' ? 'bg-orange-500' :
                        activity.type === 'booking' ? 'bg-purple-500' :
                        'bg-gray-500'
                      }`} />
                      <div>
                        <p className="font-medium text-sm">{activity.description}</p>
                        {activity.user && (
                          <p className="text-xs text-muted-foreground">
                            by {activity.user.firstName} {activity.user.lastName}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(activity.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>Frequently used management actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => navigate('/admin/bookings')}
            >
              <Calendar className="h-5 w-5" />
              <span className="text-sm">Approve Bookings</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => navigate('/admin/orders')}
            >
              <Package className="h-5 w-5" />
              <span className="text-sm">Assign Tasks</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => navigate('/admin/users')}
            >
              <Users className="h-5 w-5" />
              <span className="text-sm">Manage Users</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => navigate('/admin/analytics')}
            >
              <BarChart3 className="h-5 w-5" />
              <span className="text-sm">View Analytics</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
