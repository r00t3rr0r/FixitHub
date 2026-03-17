import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/useToast"
import { getStaffMemberDetails, StaffMemberDetails } from "@/api/staff"
import "./StaffDetailsDialog.css"
import "../../pages/admin/StaffManagement.overrides.css"
import {
  Users,
  Clock,
  Target,
  Activity,
  Calendar,
  CheckCircle,
  AlertTriangle,
  User,
  Briefcase,
  TrendingUp,
  MapPin,
  ExternalLink
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { useNavigate } from "react-router-dom"

interface StaffDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staffId: string | null
}

export function StaffDetailsDialog({ open, onOpenChange, staffId }: StaffDetailsDialogProps) {
  const [staffDetails, setStaffDetails] = useState<StaffMemberDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    if (open && staffId) {
      fetchStaffDetails()
    }
  }, [open, staffId])

  const fetchStaffDetails = async () => {
    if (!staffId) return

    try {
      setLoading(true)
      console.log("Fetching staff details for:", staffId)
      const response = await getStaffMemberDetails(staffId)
      console.log("Staff details response:", response)
      
      // Add detailed logging for problematic data
      console.log("Staff details timeTracking:", response.staffDetails.timeTracking)
      console.log("Staff details hireDate:", response.staffDetails.hireDate, "type:", typeof response.staffDetails.hireDate)
      console.log("Staff details teams:", response.staffDetails.teams)
      console.log("Staff details assignedOrders:", response.staffDetails.assignedOrders)
      console.log("Staff details assignedTasks:", response.staffDetails.assignedTasks)
      console.log("Staff details activityLog:", response.staffDetails.activityLog)
      console.log("Staff details performanceHistory:", response.staffDetails.performanceHistory)
      
      setStaffDetails(response.staffDetails)
    } catch (error: any) {
      console.error("Error fetching staff details:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load staff details",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    console.log("Getting status color for:", status, "type:", typeof status)
    switch (status) {
      case 'completed':
        return 'staff-badge-success'
      case 'in_progress':
      case 'in-progress':
        return 'staff-badge-primary'
      case 'pending':
        return 'staff-badge-warning'
      case 'cancelled':
        return 'staff-badge-danger'
      case 'clocked_in':
        return 'staff-badge-success'
      case 'clocked_out':
        return 'staff-badge'
      case 'on_break':
        return 'staff-badge-warning'
      default:
        return 'staff-badge'
    }
  }

  const getPriorityColor = (priority: string) => {
    console.log("Getting priority color for:", priority, "type:", typeof priority)
    switch (priority) {
      case 'urgent':
        return 'staff-badge-danger'
      case 'high':
        return 'staff-badge-warning'
      case 'normal':
        return 'staff-badge-primary'
      case 'low':
        return 'staff-badge'
      default:
        return 'staff-badge'
    }
  }

  // Helper function to safely format dates
  const formatDate = (dateValue: any, formatString: string = 'MMM dd, yyyy HH:mm') => {
    console.log("Formatting date:", dateValue, "type:", typeof dateValue, "formatString:", formatString)
    
    if (!dateValue) {
      console.log("Date value is null/undefined, returning 'Not available'")
      return 'Not available'
    }

    try {
      // Handle both string and Date objects
      const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.log("Invalid date, returning 'Invalid date'")
        return 'Invalid date'
      }

      const formattedDate = format(date, formatString)
      console.log("Successfully formatted date:", formattedDate)
      return formattedDate
    } catch (error) {
      console.error('Error formatting date:', dateValue, error)
      return 'Invalid date'
    }
  }

  // Helper function to safely render any value
  const safeRender = (value: any, fallback: string = 'N/A') => {
    console.log("Safe rendering value:", value, "type:", typeof value)

    if (value === null || value === undefined) {
      return fallback
    }

    if (typeof value === 'object') {
      console.warn("Attempting to render object:", value)
      return JSON.stringify(value)
    }

    return String(value)
  }

  // Helper function to calculate assignment duration
  const getAssignmentDuration = (assignedAt: string) => {
    if (!assignedAt) return 'N/A'

    try {
      return formatDistanceToNow(new Date(assignedAt), { addSuffix: true })
    } catch (error) {
      console.error('Error calculating assignment duration:', error)
      return 'N/A'
    }
  }

  // Handle order click navigation
  const handleOrderClick = (orderId: string) => {
    console.log('Navigating to order details:', orderId)
    onOpenChange(false) // Close the dialog
    navigate(`/admin/orders/${orderId}`)
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading Staff Details...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!staffDetails) {
    return null
  }

  console.log("Rendering StaffDetailsDialog with staffDetails:", staffDetails)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="staff-details-dialog max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="staff-details-header">
          <DialogTitle className="flex items-center gap-3" style={{ border: 'none', paddingBottom: 0 }}>
            <div className="staff-details-avatar">
              {staffDetails.avatar ? (
                <img src={staffDetails.avatar} alt={staffDetails.name} />
              ) : (
                staffDetails.name.split(' ').map(n => n[0]).join('')
              )}
            </div>
            <div className="staff-details-header-info">
              <div className="staff-details-name">{safeRender(staffDetails.name)}</div>
              <div className="staff-details-email">{safeRender(staffDetails.email)}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Header Stats */}
        <div className="staff-details-stats-grid">
          <div className="staff-details-stat-card">
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(staffDetails.timeTracking?.currentStatus || 'unknown')}>
                {safeRender(staffDetails.timeTracking?.currentStatus?.replace('_', ' ') || 'Unknown')}
              </Badge>
            </div>
            <div className="staff-details-stat-label mt-1">Current Status</div>
          </div>
          <div className="staff-details-stat-card">
            <div className="staff-details-stat-value">{safeRender(staffDetails.currentWorkload?.assignedOrders || 0)}</div>
            <div className="staff-details-stat-label">Active Orders</div>
          </div>
          <div className="staff-details-stat-card">
            <div className="staff-details-stat-value">{safeRender(staffDetails.currentWorkload?.assignedTasks || 0)}</div>
            <div className="staff-details-stat-label">Active Tasks</div>
          </div>
          <div className="staff-details-stat-card">
            <div className="staff-details-stat-value">{safeRender(staffDetails.currentWorkload?.utilizationRate || 0)}%</div>
            <div className="staff-details-stat-label">Utilization</div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="staff-details-tabs-list">
            <TabsTrigger value="overview" className="staff-details-tabs-trigger">Overview</TabsTrigger>
            <TabsTrigger value="teams" className="staff-details-tabs-trigger">Teams</TabsTrigger>
            <TabsTrigger value="workload" className="staff-details-tabs-trigger">Workload</TabsTrigger>
            <TabsTrigger value="performance" className="staff-details-tabs-trigger">Performance</TabsTrigger>
            <TabsTrigger value="time" className="staff-details-tabs-trigger">Time Tracking</TabsTrigger>
            <TabsTrigger value="activity" className="staff-details-tabs-trigger">Activity</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="staff-info-card">
                <div className="staff-info-card-header">
                  <User className="h-5 w-5" />
                  <h3 className="staff-info-card-title">Personal Information</h3>
                </div>
                <div className="space-y-3">
                  <div className="staff-info-field">
                    <label className="staff-info-label">Role</label>
                    <Badge variant="outline" className="staff-badge-outline">{safeRender(staffDetails.role)}</Badge>
                  </div>
                  <div className="staff-info-field">
                    <label className="staff-info-label">Department</label>
                    <div className="staff-info-value">{safeRender(staffDetails.department || 'Technical')}</div>
                  </div>
                  <div className="staff-info-field">
                    <label className="staff-info-label">Phone</label>
                    <div className="staff-info-value">{safeRender(staffDetails.phone || 'Not provided')}</div>
                  </div>
                  <div className="staff-info-field">
                    <label className="staff-info-label">Hire Date</label>
                    <div className="staff-info-value">
                      {formatDate(staffDetails.hireDate, 'MMM dd, yyyy')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="staff-info-card">
                <div className="staff-info-card-header">
                  <Briefcase className="h-5 w-5" />
                  <h3 className="staff-info-card-title">Skills & Specializations</h3>
                </div>
                <div className="space-y-3">
                  <div className="staff-info-field">
                    <label className="staff-info-label">Specializations</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {(staffDetails.specializations || []).map((spec, index) => (
                        <Badge key={index} variant="secondary" className="staff-badge-secondary text-xs">
                          {safeRender(spec)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="staff-info-field">
                    <label className="staff-info-label">Add-On Capabilities</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {(staffDetails.addOnCapabilities || []).map((capability, index) => (
                        <Badge key={index} variant="outline" className="staff-badge-outline text-xs">
                          {safeRender(capability)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Memberships
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(staffDetails.teams || []).length > 0 ? (
                  <div className="space-y-3">
                    {(staffDetails.teams || []).map((team) => (
                      <div key={team._id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{safeRender(team.name)}</div>
                          <div className="text-sm text-muted-foreground">
                            Joined {formatDate(team.joinedAt, 'MMM dd, yyyy')}
                          </div>
                        </div>
                        <Badge variant="outline">{safeRender(team.role)}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Not assigned to any teams</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Workload Tab */}
          <TabsContent value="workload" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Assigned Orders ({(staffDetails.assignedOrders || []).length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(staffDetails.assignedOrders || []).length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {(staffDetails.assignedOrders || []).map((order) => (
                        <div
                          key={order._id}
                          onClick={() => handleOrderClick(order._id)}
                          className="p-3 border rounded-lg space-y-2 cursor-pointer hover:bg-accent hover:shadow-md transition-all duration-200"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium flex items-center gap-2">
                              {safeRender(order.orderNumber)}
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <div className="flex gap-2">
                              <Badge className={getPriorityColor(order.priority)} size="sm">
                                {safeRender(order.priority)}
                              </Badge>
                              <Badge className={getStatusColor(order.status)} size="sm">
                                {safeRender(order.status?.replace('-', ' '))}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {safeRender(order.deviceBrand)} {safeRender(order.deviceModel)}
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={order.progress || 0} className="flex-1" />
                            <span className="text-xs text-muted-foreground">{safeRender(order.progress || 0)}%</span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Assigned {getAssignmentDuration(order.assignedAt)}
                            </span>
                            <span>
                              Due: {formatDate(order.estimatedCompletion, 'MMM dd, yyyy')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No assigned orders</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Assigned Tasks ({(staffDetails.assignedTasks || []).length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(staffDetails.assignedTasks || []).length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {(staffDetails.assignedTasks || []).map((task) => (
                        <div key={task._id} className="p-3 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{safeRender(task.title)}</div>
                            <div className="flex gap-2">
                              <Badge className={getPriorityColor(task.priority)} size="sm">
                                {safeRender(task.priority)}
                              </Badge>
                              <Badge className={getStatusColor(task.status)} size="sm">
                                {safeRender(task.status?.replace('_', ' '))}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">{safeRender(task.description)}</div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Est: {safeRender(task.estimatedHours)}h</span>
                            <span>Actual: {safeRender(task.actualHours)}h</span>
                            <span>Due: {formatDate(task.dueDate, 'MMM dd')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No assigned tasks</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Orders Completed</span>
                      <span>{safeRender(staffDetails.performance?.ordersCompleted || 0)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Avg Completion Time</span>
                      <span>{safeRender(staffDetails.performance?.averageCompletionTime || 0)}h</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Customer Satisfaction</span>
                      <span>{safeRender((staffDetails.performance?.customerSatisfaction || 0).toFixed(1))}/5</span>
                    </div>
                    <Progress value={(staffDetails.performance?.customerSatisfaction || 0) * 20} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Efficiency</span>
                      <span>{safeRender(staffDetails.performance?.efficiency || 0)}%</span>
                    </div>
                    <Progress value={staffDetails.performance?.efficiency || 0} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Quality Score</span>
                      <span>{safeRender(staffDetails.performance?.qualityScore || 0)}%</span>
                    </div>
                    <Progress value={staffDetails.performance?.qualityScore || 0} />
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Performance History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(staffDetails.performanceHistory || []).length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {(staffDetails.performanceHistory || []).map((period, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <div className="font-medium">{safeRender(period.period)}</div>
                            <div className="text-sm text-muted-foreground">
                              {safeRender(period.ordersCompleted)} orders completed
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Avg Time: </span>
                              {safeRender(period.averageCompletionTime)}h
                            </div>
                            <div>
                              <span className="text-muted-foreground">Satisfaction: </span>
                              {safeRender(period.customerSatisfaction?.toFixed(1))}/5
                            </div>
                            <div>
                              <span className="text-muted-foreground">Efficiency: </span>
                              {safeRender(period.efficiency)}%
                            </div>
                            <div>
                              <span className="text-muted-foreground">Quality: </span>
                              {safeRender(period.qualityScore)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No performance history available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Time Tracking Tab */}
          <TabsContent value="time" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Time Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-bold">{safeRender(staffDetails.timeTracking?.totalHoursThisWeek || 0)}h</div>
                      <div className="text-sm text-muted-foreground">This Week</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{safeRender(staffDetails.timeTracking?.totalHoursThisMonth || 0)}h</div>
                      <div className="text-sm text-muted-foreground">This Month</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{safeRender(staffDetails.timeTracking?.averageHoursPerDay || 0)}h</div>
                    <div className="text-sm text-muted-foreground">Average Hours Per Day</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-sm font-medium">Last Clock In</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(staffDetails.timeTracking?.lastClockIn)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Last Clock Out</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(staffDetails.timeTracking?.lastClockOut)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Current Status</div>
                    <Badge className={getStatusColor(staffDetails.timeTracking?.currentStatus || 'unknown')}>
                      {safeRender(staffDetails.timeTracking?.currentStatus?.replace('_', ' ') || 'Unknown')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Activity Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(staffDetails.activityLog || []).length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {(staffDetails.activityLog || []).map((activity) => (
                      <div key={activity._id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{safeRender(activity.action)}</div>
                              <div className="text-sm text-muted-foreground">{safeRender(activity.description)}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(activity.timestamp, 'MMM dd, HH:mm')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No activity recorded</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}