import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/useToast"
import { getStaffMembers, getTeams, getWorkloadDistribution, getPerformanceMetrics, StaffMember, Team, WorkloadDistribution, PerformanceMetrics } from "@/api/staff"
import {
  Users,
  Search,
  Plus,
  Edit,
  Eye,
  Clock,
  Award,
  TrendingUp,
  UserPlus,
  Calendar,
  Star,
  Target
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

export function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [workload, setWorkload] = useState<WorkloadDistribution[]>([])
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching staff management data...")
        const [staffResponse, teamsResponse, workloadResponse, metricsResponse] = await Promise.all([
          getStaffMembers(),
          getTeams(),
          getWorkloadDistribution(),
          getPerformanceMetrics()
        ])

        setStaff((staffResponse as any).staff || [])
        setTeams((teamsResponse as any).teams || [])
        setWorkload((workloadResponse as any).workload || [])
        setMetrics((metricsResponse as any).metrics || null)
      } catch (error) {
        console.error("Error fetching staff data:", error)
        toast({
          title: "Error",
          description: "Failed to load staff data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [toast])

  const filteredStaff = staff.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "all" || member.role === roleFilter
    return matchesSearch && matchesRole
  })

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
            <Users className="h-8 w-8" />
            Staff Management
          </h1>
          <p className="text-muted-foreground">
            Manage staff members, teams, and performance metrics
          </p>
        </div>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Staff Member
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Staff
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {staff.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Active Teams
            </CardTitle>
            <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {teams.filter(t => t.isActive).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Avg. Utilization
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {Math.round(workload.reduce((sum, w) => sum + w.utilizationRate, 0) / workload.length || 0)}%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Avg. Satisfaction
            </CardTitle>
            <Award className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {metrics?.individual.reduce((sum, i) => sum + i.customerSatisfaction, 0) / metrics?.individual.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="staff" className="space-y-4">
        <TabsList>
          <TabsTrigger value="staff">Staff Members</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="workload">Workload</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search staff by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-48">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="technician">Technician</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Staff Table */}
          <Card>
            <CardHeader>
              <CardTitle>Staff Directory</CardTitle>
              <CardDescription>
                Manage staff members and their information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Specializations</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Workload</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No staff members found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStaff.map((member) => (
                      <TableRow key={member._id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={member.avatar} />
                              <AvatarFallback>
                                {member.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{member.name}</p>
                              <p className="text-sm text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{member.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {member.specializations.slice(0, 2).map((spec) => (
                              <Badge key={spec} variant="secondary" className="text-xs">
                                {spec}
                              </Badge>
                            ))}
                            {member.specializations.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{member.specializations.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                            {member.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-yellow-400 fill-current" />
                              <span className="text-sm">{member.performance.customerSatisfaction}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {member.performance.ordersCompleted} orders
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{member.currentWorkload.assignedOrders}/{member.currentWorkload.capacity}</span>
                              <span>{member.currentWorkload.utilizationRate}%</span>
                            </div>
                            <Progress value={member.currentWorkload.utilizationRate} className="h-1" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teams" className="space-y-4">
          <div className="grid gap-6">
            {teams.map((team) => (
              <Card key={team._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {team.name}
                        <Badge variant={team.isActive ? "default" : "secondary"}>
                          {team.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {team.description}
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
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{team.members.length} members</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Leader: {team.leaderName}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {team.specializations.map((spec) => (
                      <Badge key={spec} variant="outline">{spec}</Badge>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-primary">{team.performance.totalOrders}</p>
                      <p className="text-xs text-muted-foreground">Total Orders</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-primary">{team.performance.averageCompletionTime}d</p>
                      <p className="text-xs text-muted-foreground">Avg. Time</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-primary">{team.performance.customerSatisfaction}</p>
                      <p className="text-xs text-muted-foreground">Satisfaction</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-primary">{team.performance.efficiency}%</p>
                      <p className="text-xs text-muted-foreground">Efficiency</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="workload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workload Distribution</CardTitle>
              <CardDescription>
                Current workload and capacity for all staff members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workload.map((member) => (
                  <div key={member.staffId} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{member.staffName}</h4>
                      <Badge variant={
                        member.utilizationRate >= 90 ? 'destructive' :
                        member.utilizationRate >= 70 ? 'default' :
                        'secondary'
                      }>
                        {member.utilizationRate}% utilized
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between text-sm">
                        <span>Assigned Orders: {member.assignedOrders}/{member.capacity}</span>
                      </div>
                      <Progress value={member.utilizationRate} className="h-2" />
                    </div>

                    {member.currentTasks.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Current Tasks:</p>
                        <div className="space-y-1">
                          {member.currentTasks.slice(0, 3).map((task) => (
                            <div key={task.orderId} className="flex items-center justify-between text-sm">
                              <span>{task.orderNumber}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {task.priority}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {task.progress}%
                                </span>
                              </div>
                            </div>
                          ))}
                          {member.currentTasks.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{member.currentTasks.length - 3} more tasks
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {metrics && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Individual Performance</CardTitle>
                  <CardDescription>Performance metrics for each staff member</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff Member</TableHead>
                        <TableHead>Orders</TableHead>
                        <TableHead>Avg. Time</TableHead>
                        <TableHead>Satisfaction</TableHead>
                        <TableHead>Efficiency</TableHead>
                        <TableHead>Goal Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.individual.map((member) => (
                        <TableRow key={member.staffId}>
                          <TableCell className="font-medium">{member.staffName}</TableCell>
                          <TableCell>{member.ordersCompleted}</TableCell>
                          <TableCell>{member.averageCompletionTime.toFixed(1)}d</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-yellow-400 fill-current" />
                              {member.customerSatisfaction.toFixed(1)}
                            </div>
                          </TableCell>
                          <TableCell>{member.efficiency}%</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span>{member.goals.achieved}/{member.goals.target}</span>
                                <span>{member.goals.percentage.toFixed(1)}%</span>
                              </div>
                              <Progress value={member.goals.percentage} className="h-1" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Team Performance</CardTitle>
                  <CardDescription>Performance metrics for each team</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Total Orders</TableHead>
                        <TableHead>Avg. Time</TableHead>
                        <TableHead>Satisfaction</TableHead>
                        <TableHead>Efficiency</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.team.map((team) => (
                        <TableRow key={team.teamId}>
                          <TableCell className="font-medium">{team.teamName}</TableCell>
                          <TableCell>{team.memberCount}</TableCell>
                          <TableCell>{team.totalOrders}</TableCell>
                          <TableCell>{team.averageCompletionTime.toFixed(1)}d</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-yellow-400 fill-current" />
                              {team.customerSatisfaction.toFixed(1)}
                            </div>
                          </TableCell>
                          <TableCell>{team.efficiency}%</TableCell>
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