import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/useToast"
import {
  getStaffMembers,
  getTeams,
  getWorkloadDistribution,
  getPerformanceMetrics,
  createStaffMember,
  createTeam,
  updateStaffMember,
  updateTeam,
  deleteStaffMember,
  deleteTeam,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  StaffMember,
  Team,
  WorkloadDistribution,
  PerformanceMetrics,
  Task
} from "@/api/staff"
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Clock,
  Target,
  TrendingUp,
  Award,
  AlertTriangle,
  CheckCircle,
  MoreHorizontal
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Textarea } from "@/components/ui/textarea"
import { CreateStaffDialog } from "@/components/admin/CreateStaffDialog"
import { CreateTeamDialog } from "@/components/admin/CreateTeamDialog"
import { StaffDetailsDialog } from "@/components/admin/StaffDetailsDialog"

export function StaffManagement() {
  const [activeTab, setActiveTab] = useState("staff")
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [workload, setWorkload] = useState<WorkloadDistribution[]>([])
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [showCreateStaff, setShowCreateStaff] = useState(false)
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [showEditTeam, setShowEditTeam] = useState(false)
  const [showStaffDetails, setShowStaffDetails] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const { toast } = useToast()

  // Task form state
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    category: "repair" as "repair" | "maintenance" | "training" | "meeting" | "other",
    dueDate: "",
    estimatedHours: 1
  })

  // Team form state
  const [teamForm, setTeamForm] = useState({
    name: "",
    description: "",
    leaderId: "",
    department: "Technical",
    specializations: [] as string[],
    permissions: [] as string[],
    members: [] as Array<{ userId: string; role: string }>
  })

  useEffect(() => {
    fetchStaffManagementData()
  }, [])

  const fetchStaffManagementData = async () => {
    try {
      console.log("Fetching staff management data...")
      setLoading(true)

      const [staffResponse, teamsResponse, workloadResponse, metricsResponse] = await Promise.all([
        getStaffMembers({ role: roleFilter, search: searchTerm }),
        getTeams(),
        getWorkloadDistribution(),
        getPerformanceMetrics()
      ])

      console.log("Staff response:", staffResponse)
      console.log("Teams response:", teamsResponse)
      console.log("Workload response:", workloadResponse)
      console.log("Metrics response:", metricsResponse)

      setStaff((staffResponse as any).staff || [])
      setTeams((teamsResponse as any).teams || [])
      setWorkload((workloadResponse as any).workload || [])
      setMetrics((metricsResponse as any).metrics || null)

      // Fetch tasks for workload tab
      const tasksResponse = await getTasks()
      setTasks((tasksResponse as any).tasks || [])
    } catch (error) {
      console.error("Error fetching staff management data:", error)
      toast({
        title: "Error",
        description: "Failed to load staff management data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      console.log("Creating task:", taskForm)
      await createTask({
        ...taskForm,
        dueDate: new Date(taskForm.dueDate).toISOString()
      })

      toast({
        title: "Success!",
        description: "Task created successfully"
      })

      setShowCreateTask(false)
      setTaskForm({
        title: "",
        description: "",
        assignedTo: "",
        priority: "normal",
        category: "repair",
        dueDate: "",
        estimatedHours: 1
      })

      // Refresh data
      fetchStaffManagementData()
    } catch (error: any) {
      console.error("Error creating task:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create task",
        variant: "destructive"
      })
    }
  }

  const handleEditTeam = (team: Team) => {
    console.log("Editing team:", team)
    console.log("Available staff members:", staff)
    setEditingTeam(team)
    
    // Ensure we have staff data before setting up the form
    if (!staff || staff.length === 0) {
      console.error("No staff members available for team editing")
      return
    }

    // Safely extract member data with proper validation
    const safeMembers = team.members ? team.members.map(m => {
      console.log("Processing team member:", m)
      const userId = typeof m.userId === 'object' && m.userId ? m.userId._id : m.userId
      const role = m.role || "member"
      console.log("Extracted userId:", userId, "role:", role)
      return { userId, role }
    }).filter(m => m.userId) : [] // Filter out any members without valid userId

    console.log("Safe members for form:", safeMembers)

    setTeamForm({
      name: team.name || "",
      description: team.description || "",
      leaderId: typeof team.leaderId === 'object' && team.leaderId ? team.leaderId._id : team.leaderId || "",
      department: team.department || "Technical",
      specializations: team.specializations || [],
      permissions: team.permissions || [],
      members: safeMembers
    })
    setShowEditTeam(true)
  }

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTeam) return

    try {
      console.log("Updating team:", editingTeam._id, teamForm)
      await updateTeam(editingTeam._id, teamForm)

      toast({
        title: "Success!",
        description: "Team updated successfully"
      })

      setShowEditTeam(false)
      setEditingTeam(null)
      fetchStaffManagementData()
    } catch (error: any) {
      console.error("Error updating team:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update team",
        variant: "destructive"
      })
    }
  }

  const handleDeleteTeam = async (teamId: string) => {
    try {
      await deleteTeam(teamId)
      toast({
        title: "Success!",
        description: "Team deleted successfully"
      })
      fetchStaffManagementData()
    } catch (error: any) {
      console.error("Error deleting team:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete team",
        variant: "destructive"
      })
    }
  }

  const handleDeleteStaff = async (staffId: string) => {
    try {
      await deleteStaffMember(staffId)
      toast({
        title: "Success!",
        description: "Staff member deleted successfully"
      })
      fetchStaffManagementData()
    } catch (error: any) {
      console.error("Error deleting staff member:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete staff member",
        variant: "destructive"
      })
    }
  }

  const handleStaffRowClick = (staffMember: StaffMember) => {
    console.log("Opening staff details for:", staffMember.name)
    setSelectedStaffId(staffMember._id)
    setShowStaffDetails(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white'
      case 'in_progress':
        return 'bg-blue-500 text-white'
      case 'pending':
        return 'bg-yellow-500 text-black'
      case 'cancelled':
        return 'bg-red-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-600 text-white'
      case 'high':
        return 'bg-orange-500 text-white'
      case 'normal':
        return 'bg-blue-500 text-white'
      case 'low':
        return 'bg-gray-500 text-white'
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
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-8 w-8" />
          Staff Management
        </h1>
        <p className="text-muted-foreground">
          Manage staff members, teams, workload distribution, and performance metrics
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{staff.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Teams</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teams.filter(t => t.isActive).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.filter(t => ['pending', 'in_progress'].includes(t.status)).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Utilization</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workload.length > 0 ? Math.round(workload.reduce((sum, w) => sum + w.utilizationRate, 0) / workload.length) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="staff">Staff Members</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="workload">Workload</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Staff Members Tab */}
        <TabsContent value="staff" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search staff members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setShowCreateStaff(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Staff Member
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Specializations</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Workload</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.filter(member =>
                    (roleFilter === "all" || member.role === roleFilter) &&
                    (searchTerm === "" || member.name.toLowerCase().includes(searchTerm.toLowerCase()) || member.email.toLowerCase().includes(searchTerm.toLowerCase()))
                  ).map((member) => (
                    <TableRow 
                      key={member._id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleStaffRowClick(member)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
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
                      <TableCell>{member.department || 'Technical'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {member.specializations.slice(0, 2).map((spec, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
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
                        <Badge className={member.status === 'active' ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}>
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={member.currentWorkload.utilizationRate} className="w-16" />
                          <span className="text-sm">{member.currentWorkload.utilizationRate}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete {member.name} from the system.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteStaff(member._id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teams Tab */}
        <TabsContent value="teams" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Team Management</h3>
            <Button onClick={() => setShowCreateTeam(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <Card key={team._id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{team.name}</CardTitle>
                      <CardDescription>{team.description}</CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditTeam(team)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the team "{team.name}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteTeam(team._id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">Team Leader</p>
                      <p className="text-sm text-muted-foreground">{team.leaderName}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Members ({team.members.length})</p>
                      <div className="flex -space-x-2 mt-1">
                        {team.members.slice(0, 5).map((member) => (
                          <Avatar key={member.userId._id} className="w-6 h-6 border-2 border-background">
                            <AvatarImage src={member.userId.avatar} />
                            <AvatarFallback className="text-xs">
                              {member.userId.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {team.members.length > 5 && (
                          <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                            <span className="text-xs">+{team.members.length - 5}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Performance</p>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Orders: {team.performance.totalOrders}</span>
                        <span>Rating: {team.performance.customerSatisfaction.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Edit Team Dialog */}
          <Dialog open={showEditTeam} onOpenChange={setShowEditTeam}>
            <DialogContent className="sm:max-w-md bg-background">
              <DialogHeader>
                <DialogTitle>Edit Team</DialogTitle>
                <DialogDescription>
                  Update team information and manage members
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateTeam} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teamName">Team Name</Label>
                  <Input
                    id="teamName"
                    value={teamForm.name}
                    onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teamDescription">Description</Label>
                  <Textarea
                    id="teamDescription"
                    value={teamForm.description}
                    onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teamLeader">Team Leader</Label>
                  <Select
                    value={teamForm.leaderId}
                    onValueChange={(value) => setTeamForm({ ...teamForm, leaderId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team leader" />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.map((member) => (
                        <SelectItem key={member._id} value={member._id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Team Members</Label>
                  <div className="space-y-2">
                    {teamForm.members.map((member, index) => (
                      <div key={index} className="flex gap-2">
                        <Select
                          value={member.userId}
                          onValueChange={(value) => {
                            const newMembers = [...teamForm.members]
                            newMembers[index].userId = value
                            setTeamForm({ ...teamForm, members: newMembers })
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select member" />
                          </SelectTrigger>
                          <SelectContent>
                            {staff.map((staffMember) => (
                              <SelectItem key={staffMember._id} value={staffMember._id}>
                                {staffMember.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={member.role}
                          onValueChange={(value) => {
                            const newMembers = [...teamForm.members]
                            newMembers[index].role = value
                            setTeamForm({ ...teamForm, members: newMembers })
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="lead">Lead</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newMembers = teamForm.members.filter((_, i) => i !== index)
                            setTeamForm({ ...teamForm, members: newMembers })
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTeamForm({
                          ...teamForm,
                          members: [...teamForm.members, { userId: "", role: "member" }]
                        })
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Member
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowEditTeam(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Update Team</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Workload Tab */}
        <TabsContent value="workload" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Workload Management</h3>
            <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Task
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-background">
                <DialogHeader>
                  <DialogTitle>Assign New Task</DialogTitle>
                  <DialogDescription>
                    Create and assign a new task to a staff member
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateTask} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="taskTitle">Title</Label>
                    <Input
                      id="taskTitle"
                      value={taskForm.title}
                      onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taskDescription">Description</Label>
                    <Textarea
                      id="taskDescription"
                      value={taskForm.description}
                      onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="assignedTo">Assigned To</Label>
                      <Select
                        value={taskForm.assignedTo}
                        onValueChange={(value) => setTaskForm({ ...taskForm, assignedTo: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select staff member" />
                        </SelectTrigger>
                        <SelectContent>
                          {staff.map((member) => (
                            <SelectItem key={member._id} value={member._id}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select
                        value={taskForm.priority}
                        onValueChange={(value: "low" | "normal" | "high" | "urgent") =>
                          setTaskForm({ ...taskForm, priority: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dueDate">Due Date</Label>
                      <Input
                        id="dueDate"
                        type="datetime-local"
                        value={taskForm.dueDate}
                        onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="estimatedHours">Estimated Hours</Label>
                      <Input
                        id="estimatedHours"
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={taskForm.estimatedHours}
                        onChange={(e) => setTaskForm({ ...taskForm, estimatedHours: parseFloat(e.target.value) })}
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowCreateTask(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Task</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {workload.map((member) => (
              <Card key={member.staffId}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{member.staffName}</CardTitle>
                      <CardDescription>
                        {member.assignedOrders} orders • {member.assignedTasks} tasks
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Utilization</div>
                      <div className="text-lg font-semibold">{member.utilizationRate}%</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Progress value={member.utilizationRate} className="w-full" />
                    <div className="text-sm text-muted-foreground">
                      Capacity: {member.assignedOrders + (member.assignedTasks || 0)} / {member.capacity}
                    </div>
                    {member.currentTasks.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Current Assignments:</p>
                        {member.currentTasks.map((task) => (
                          <div key={task.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={task.type === 'order' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {task.type === 'order' ? 'Order' : 'Task'}
                                </Badge>
                                <Badge className={getPriorityColor(task.priority)} size="sm">
                                  {task.priority}
                                </Badge>
                                {task.status && (
                                  <Badge className={getStatusColor(task.status)} size="sm">
                                    {task.status.replace('_', ' ')}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Due: {new Date(task.dueDate).toLocaleDateString()}
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-medium">{task.title}</p>
                              {task.subtitle && (
                                <p className="text-xs text-muted-foreground">{task.subtitle}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={task.progress} className="flex-1" />
                              <span className="text-xs text-muted-foreground">{task.progress}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {member.currentTasks.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        <p className="text-sm">No current assignments</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <h3 className="text-lg font-semibold">Performance Metrics</h3>
          
          {metrics && (
            <div className="grid gap-4">
              {metrics.individual.map((member) => (
                <Card key={member.staffId}>
                  <CardHeader>
                    <CardTitle className="text-lg">{member.staffName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">Orders Completed</span>
                        </div>
                        <div className="text-2xl font-bold">{member.ordersCompleted}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium">Avg Completion Time</span>
                        </div>
                        <div className="text-2xl font-bold">{Number(member.averageCompletionTime).toFixed(1)}h</div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium">Customer Satisfaction</span>
                        </div>
                        <div className="text-2xl font-bold">{Number(member.customerSatisfaction).toFixed(1)}/5</div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Goal Progress</span>
                        <span className="text-sm text-muted-foreground">
                          {member.goals.achieved} / {member.goals.target}
                        </span>
                      </div>
                      <Progress value={member.goals.percentage} className="w-full" />
                    </div>

                    {/* Add Task Management Section */}
                    <div className="mt-6 border-t pt-4">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Current Tasks
                      </h4>
                      {tasks.filter(task => task.assignedTo._id === member.staffId).length > 0 ? (
                        <div className="space-y-3">
                          {tasks.filter(task => task.assignedTo._id === member.staffId).map((task) => (
                            <div key={task._id} className="p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge className={getPriorityColor(task.priority)} size="sm">
                                    {task.priority}
                                  </Badge>
                                  <Badge className={getStatusColor(task.status)} size="sm">
                                    {task.status.replace('_', ' ')}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Due: {new Date(task.dueDate).toLocaleDateString()}
                                </div>
                              </div>
                              <div className="mb-2">
                                <p className="text-sm font-medium">{task.title}</p>
                                <p className="text-xs text-muted-foreground">{task.description}</p>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Progress value={task.status === 'completed' ? 100 : task.status === 'in_progress' ? 60 : 20} className="w-20" />
                                  <span className="text-xs text-muted-foreground">
                                    {task.status === 'completed' ? 100 : task.status === 'in_progress' ? 60 : 20}%
                                  </span>
                                </div>
                                <Select
                                  value={task.status}
                                  onValueChange={async (newStatus) => {
                                    try {
                                      await updateTask(task._id, { status: newStatus })
                                      toast({
                                        title: "Success",
                                        description: "Task status updated successfully"
                                      })
                                      fetchStaffManagementData()
                                    } catch (error: any) {
                                      toast({
                                        title: "Error",
                                        description: error.message,
                                        variant: "destructive"
                                      })
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          <p className="text-sm">No tasks assigned</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Staff Dialog */}
      <CreateStaffDialog
        open={showCreateStaff}
        onOpenChange={setShowCreateStaff}
        onStaffCreated={fetchStaffManagementData}
      />

      {/* Create Team Dialog */}
      <CreateTeamDialog
        open={showCreateTeam}
        onOpenChange={setShowCreateTeam}
        onTeamCreated={fetchStaffManagementData}
      />

      {/* Staff Details Dialog */}
      <StaffDetailsDialog
        open={showStaffDetails}
        onOpenChange={setShowStaffDetails}
        staffId={selectedStaffId}
      />
    </div>
  )
}