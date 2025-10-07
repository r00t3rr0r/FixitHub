import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/useToast"
import { getUsers, createUser, updateUserRole, updateUserStatus, bulkUpdateUserStatus, deleteUser, User, CreateUserData } from "@/api/users"
import {
  Users,
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Package,
  Eye,
  Edit,
  Trash2,
  UserPlus,
  Shield,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MapPin,
  Clock,
  Activity
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { UserDetailsDialog } from "@/components/admin/UserDetailsDialog"
import { EditUserDialog } from "@/components/admin/EditUserDialog"

type SortField = 'name' | 'email' | 'role' | 'status' | 'createdAt' | 'lastActivity' | 'totalOrders' | 'totalSpent'
type SortDirection = 'asc' | 'desc'

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const { toast } = useToast()

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "customer" as "customer" | "staff" | "admin",
    sendWelcomeEmail: false
  })

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        console.log("Fetching users...")
        const response = await getUsers()
        const usersData = (response as any).users || []
        setUsers(usersData)
        setFilteredUsers(usersData)
      } catch (error) {
        console.error("Error fetching users:", error)
        toast({
          title: "Error",
          description: "Failed to load users",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [toast])

  useEffect(() => {
    let filtered = users

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone.includes(searchTerm)
      )
    }

    // Filter by role
    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter)
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(user => user.status === statusFilter)
    }

    // Sort users
    filtered.sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]

      // Handle special cases
      if (sortField === 'lastActivity') {
        aValue = new Date(a.lastActivity || a.createdAt).getTime()
        bValue = new Date(b.lastActivity || b.createdAt).getTime()
      } else if (sortField === 'createdAt') {
        aValue = new Date(a.createdAt).getTime()
        bValue = new Date(b.createdAt).getTime()
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    setFilteredUsers(filtered)
  }, [users, searchTerm, roleFilter, statusFilter, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />
    }
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setCreating(true)
      console.log("Creating user:", formData)

      const userData: CreateUserData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role,
        sendWelcomeEmail: formData.sendWelcomeEmail
      }

      const response = await createUser(userData)

      toast({
        title: "Success!",
        description: "User created successfully"
      })

      // Refresh users list
      const usersResponse = await getUsers()
      const usersData = (usersResponse as any).users || []
      setUsers(usersData)
      setFilteredUsers(usersData)

      // Reset form and close dialog
      setFormData({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "customer",
        sendWelcomeEmail: false
      })
      setShowCreateDialog(false)
    } catch (error: any) {
      console.error("Error creating user:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive"
      })
    } finally {
      setCreating(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setUpdating(userId)
      console.log("Updating user role:", userId, newRole)
      await updateUserRole(userId, newRole)

      // Update local state
      setUsers(users.map(user =>
        user._id === userId ? { ...user, role: newRole as any } : user
      ))

      toast({
        title: "Success!",
        description: "User role updated successfully"
      })
    } catch (error: any) {
      console.error("Error updating user role:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive"
      })
    } finally {
      setUpdating(null)
    }
  }

  const handleStatusToggle = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'

    try {
      setUpdating(userId)
      console.log("Updating user status:", userId, newStatus)
      await updateUserStatus(userId, newStatus)

      // Update local state
      setUsers(users.map(user =>
        user._id === userId ? { ...user, status: newStatus as any } : user
      ))

      toast({
        title: "Success!",
        description: `User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`
      })
    } catch (error: any) {
      console.error("Error updating user status:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update user status",
        variant: "destructive"
      })
    } finally {
      setUpdating(null)
    }
  }

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedUsers.length === 0) return

    try {
      console.log("Bulk updating user status:", selectedUsers, status)
      await bulkUpdateUserStatus(selectedUsers, status)

      // Update local state
      setUsers(users.map(user =>
        selectedUsers.includes(user._id) ? { ...user, status: status as any } : user
      ))
      setSelectedUsers([])

      toast({
        title: "Success!",
        description: `${selectedUsers.length} users updated successfully`
      })
    } catch (error: any) {
      console.error("Error bulk updating users:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update users",
        variant: "destructive"
      })
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      setDeleting(userId)
      console.log("Deleting user:", userId)
      await deleteUser(userId)

      // Remove user from local state
      setUsers(users.filter(user => user._id !== userId))

      toast({
        title: "Success!",
        description: "User deleted successfully"
      })
    } catch (error: any) {
      console.error("Error deleting user:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive"
      })
    } finally {
      setDeleting(null)
    }
  }

  const handleEditUser = (user: User) => {
    console.log("EditUser: Opening edit dialog for user:", user._id)
    setEditingUser(user)
    setShowEditDialog(true)
  }

  const handleUserUpdated = (updatedUser: User) => {
    console.log("EditUser: User updated successfully:", updatedUser._id)
    // Update the user in the local state
    setUsers(users.map(user => 
      user._id === updatedUser._id ? updatedUser : user
    ))
    
    toast({
      title: "Success!",
      description: "User updated successfully"
    })
  }

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredUsers.map(user => user._id))
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500 text-white'
      case 'staff':
        return 'bg-blue-500 text-white'
      case 'customer':
        return 'bg-green-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500 text-white'
      case 'inactive':
        return 'bg-gray-500 text-white'
      case 'suspended':
        return 'bg-red-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const handleRowClick = (userId: string, e: React.MouseEvent) => {
    // Prevent row click when clicking on interactive elements
    if ((e.target as HTMLElement).closest('button, input, select, [role="button"]')) {
      return
    }
    
    console.log('Row clicked for user:', userId)
    setSelectedUserId(userId)
    setShowDetailsDialog(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              User Management
            </h1>
            <p className="text-muted-foreground">
              Manage users, roles, and permissions across the platform
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-background">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new user to the system with role and permissions
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: "customer" | "staff" | "admin") =>
                        setFormData({ ...formData, role: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sendWelcomeEmail"
                    checked={formData.sendWelcomeEmail}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, sendWelcomeEmail: checked as boolean })
                    }
                  />
                  <Label htmlFor="sendWelcomeEmail">Send welcome email</Label>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? "Creating..." : "Create User"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground">
                +{users.filter(u => new Date(u.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length} this month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.status === 'active').length}
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.round((users.filter(u => u.status === 'active').length / users.length) * 100)}% of total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Staff Members</CardTitle>
              <Shield className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.role === 'staff').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Including {users.filter(u => u.role === 'admin').length} admins
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${users.reduce((sum, u) => sum + (u.totalSpent || 0), 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                From {users.reduce((sum, u) => sum + (u.totalOrders || 0), 0)} orders
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name, email, or phone..."
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
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedUsers.length > 0 && (
              <div className="flex items-center gap-2 mt-4 p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">
                  {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2 ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkStatusUpdate('active')}
                  >
                    Activate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkStatusUpdate('inactive')}
                  >
                    Deactivate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedUsers([])}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enhanced Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>User Directory</CardTitle>
            <CardDescription>
              Comprehensive list of all users with management capabilities. Click on any row to view detailed information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-2">
                        User Information
                        {getSortIcon('name')}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('role')}>
                      <div className="flex items-center gap-2">
                        Role & Status
                        {getSortIcon('role')}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('createdAt')}>
                      <div className="flex items-center gap-2">
                        Member Since
                        {getSortIcon('createdAt')}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('lastActivity')}>
                      <div className="flex items-center gap-2">
                        Last Activity
                        {getSortIcon('lastActivity')}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('totalOrders')}>
                      <div className="flex items-center gap-2">
                        Orders & Spending
                        {getSortIcon('totalOrders')}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No users found</p>
                        {searchTerm && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Try adjusting your search or filters
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow
                        key={user._id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={(e) => handleRowClick(user._id, e)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedUsers.includes(user._id)}
                            onCheckedChange={() => handleSelectUser(user._id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback className="bg-primary/10">
                                {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{user.name}</p>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span className="truncate">{user.email}</span>
                              </div>
                              {user.phone && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  <span>{user.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-2">
                            <Select
                              value={user.role}
                              onValueChange={(value) => handleRoleChange(user._id, value)}
                              disabled={updating === user._id}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue>
                                  <Badge className={getRoleColor(user.role)}>
                                    {user.role}
                                  </Badge>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="customer">Customer</SelectItem>
                                <SelectItem value="staff">Staff</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(user.status)} variant="outline">
                                {user.status}
                              </Badge>
                              <Switch
                                checked={user.status === 'active'}
                                onCheckedChange={() => handleStatusToggle(user._id, user.status)}
                                disabled={updating === user._id}
                                size="sm"
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span>{formatDate(user.createdAt)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center gap-1 text-sm">
                                <Activity className="h-3 w-3 text-muted-foreground" />
                                <span>{formatDate(user.lastActivity || user.createdAt)}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{formatDateTime(user.lastActivity || user.createdAt)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Package className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">{user.totalOrders || 0}</span>
                              <span className="text-muted-foreground">orders</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <DollarSign className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">${(user.totalSpent || 0).toFixed(2)}</span>
                            </div>
                            {(user.totalOrders || 0) > 0 && (
                              <div className="text-xs text-muted-foreground">
                                Avg: ${((user.totalSpent || 0) / (user.totalOrders || 1)).toFixed(2)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => {
                                setSelectedUserId(user._id)
                                setShowDetailsDialog(true)
                              }}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onSelect={(e) => e.preventDefault()}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete User
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete the user
                                      "{user.name}" and remove all their data from the system.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteUser(user._id)}
                                      disabled={deleting === user._id}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      {deleting === user._id ? "Deleting..." : "Delete"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {filteredUsers.length > 0 && (
              <div className="flex items-center justify-between px-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {filteredUsers.length} of {users.length} users
                </div>
                <div className="text-sm text-muted-foreground">
                  Click on any row to view detailed user information
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <UserDetailsDialog
          userId={selectedUserId}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
        />

        <EditUserDialog
          user={editingUser}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onUserUpdated={handleUserUpdated}
        />
      </div>
    </TooltipProvider>
  )
}