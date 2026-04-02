import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import "./UserManagement.css"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/useToast"
import { getUsers, createUser, updateUserRole, updateUserStatus, bulkUpdateUserStatus, deleteUser, User, CreateUserData, GetUsersParams } from "@/api/users"
import { getCustomerGroups, type CustomerGroup as CustomerGroupOption } from "@/api/customerGroups"
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
  Activity,
  ChevronLeft,
  ChevronRight,
  Upload
} from "lucide-react"
import { CSVImportDialog } from "@/components/admin/CSVImportDialog"
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { UserDetailsDialog } from "@/components/admin/UserDetailsDialog"
import { EditUserDialog } from "@/components/admin/EditUserDialog"

type SortField = 'name' | 'email' | 'role' | 'status' | 'createdAt' | 'lastActivity' | 'totalOrders' | 'totalSpent'
type SortDirection = 'asc' | 'desc'

export function UserManagement() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<User[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [customerGroupFilter, setCustomerGroupFilter] = useState("all")
  const [availableGroups, setAvailableGroups] = useState<CustomerGroupOption[]>([])
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
  const [showCSVImportDialog, setShowCSVImportDialog] = useState(false)
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

  // Fetch users with pagination
  const fetchUsers = async () => {
    try {
      setLoading(true)
      console.log("Fetching users with pagination...", {
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        role: roleFilter,
        status: statusFilter,
        customerGroupId: customerGroupFilter
      })

      const params: GetUsersParams = {
        page: currentPage,
        limit: pageSize,
      }

      if (searchTerm) {
        params.search = searchTerm
      }

      if (roleFilter !== "all") {
        params.role = roleFilter
      }

      if (statusFilter !== "all") {
        params.status = statusFilter
      }

      if (customerGroupFilter !== "all") {
        params.customerGroupId = customerGroupFilter
      }

      const response = await getUsers(params)

      console.log("Users fetched successfully:", {
        usersCount: response.users.length,
        totalUsers: response.totalUsers,
        currentPage: response.currentPage,
        totalPages: response.totalPages
      })

      setUsers(response.users)
      setTotalUsers(response.totalUsers)
      setTotalPages(response.totalPages)
      setCurrentPage(response.currentPage)
    } catch (error) {
      console.error("Error fetching users:", error)
      toast({
        title: t('common.error'),
        description: t('userManagement.failedToLoadUsers'),
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [currentPage, pageSize, searchTerm, roleFilter, statusFilter, customerGroupFilter])

  // Reset to page 1 when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [searchTerm, roleFilter, statusFilter, customerGroupFilter])

  useEffect(() => {
    const loadCustomerGroups = async () => {
      try {
        const response = await getCustomerGroups({ status: 'all', limit: 100 })
        setAvailableGroups(response.groups || [])
      } catch (error) {
        console.error("Error loading customer groups for filter:", error)
      }
    }

    loadCustomerGroups()
  }, [])

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
        title: t('common.success'),
        description: t('userManagement.userCreatedSuccess')
      })

      // Refresh users list
      await fetchUsers()

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
        title: t('common.error'),
        description: error.message || t('userManagement.failedToCreateUser'),
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
        title: t('common.success'),
        description: t('userManagement.userRoleUpdated')
      })
    } catch (error: any) {
      console.error("Error updating user role:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('userManagement.failedToUpdateRole'),
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
        title: t('common.success'),
        description: t('userManagement.userStatusUpdated')
      })
    } catch (error: any) {
      console.error("Error updating user status:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('userManagement.failedToUpdateStatus'),
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

      // Refresh users list to get updated data
      await fetchUsers()
      setSelectedUsers([])

      toast({
        title: t('common.success'),
        description: `${selectedUsers.length} users updated successfully`
      })
    } catch (error: any) {
      console.error("Error bulk updating users:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('common.error'),
        variant: "destructive"
      })
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      setDeleting(userId)
      console.log("Deleting user:", userId)
      await deleteUser(userId)

      // Refresh users list
      await fetchUsers()

      toast({
        title: t('common.success'),
        description: t('toast.success.deleted')
      })
    } catch (error: any) {
      console.error("Error deleting user:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('userManagement.failedToDeleteUser'),
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
    // Refresh users list to get updated data
    fetchUsers()

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
    if (selectedUsers.length === users.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(users.map(user => user._id))
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'badge badge-admin'
      case 'staff':
        return 'badge badge-staff'
      case 'customer':
        return 'badge badge-customer'
      default:
        return 'badge'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'badge badge-active'
      case 'inactive':
        return 'badge badge-inactive'
      case 'suspended':
        return 'badge badge-suspended'
      default:
        return 'badge'
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

  const handlePageChange = (page: number) => {
    console.log("Changing to page:", page)
    setCurrentPage(page)
  }

  const handlePageSizeChange = (newSize: string) => {
    console.log("Changing page size to:", newSize)
    setPageSize(parseInt(newSize))
    setCurrentPage(1) // Reset to first page when changing page size
  }

  const renderPaginationItems = () => {
    const items = []
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    // Adjust start page if we're near the end
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    // Previous button
    items.push(
      <PaginationItem key="prev">
        <PaginationPrevious
          onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
          className={currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
        />
      </PaginationItem>
    )

    // First page + ellipsis
    if (startPage > 1) {
      items.push(
        <PaginationItem key={1}>
          <PaginationLink onClick={() => handlePageChange(1)} className="cursor-pointer">
            1
          </PaginationLink>
        </PaginationItem>
      )
      if (startPage > 2) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <PaginationEllipsis />
          </PaginationItem>
        )
      }
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            onClick={() => handlePageChange(i)}
            isActive={i === currentPage}
            className="cursor-pointer"
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      )
    }

    // Last page + ellipsis
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(
          <PaginationItem key="ellipsis-end">
            <PaginationEllipsis />
          </PaginationItem>
        )
      }
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink onClick={() => handlePageChange(totalPages)} className="cursor-pointer">
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      )
    }

    // Next button
    items.push(
      <PaginationItem key="next">
        <PaginationNext
          onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
          className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
        />
      </PaginationItem>
    )

    return items
  }

  if (loading && users.length === 0) {
    return (
      <div className="user-management-page space-y-6">
        <div className="skeleton h-8 rounded w-48"></div>
        <Card className="skeleton">
          <CardHeader>
            <div className="skeleton h-6 rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-16 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="user-management-page space-y-6">
        {/* Header */}
        <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              {t('userManagement.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('userManagement.description')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCSVImportDialog(true)}
              data-variant="outline"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import from CSV
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button data-variant="default">
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('userManagement.createNewUser')}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-background">
                <DialogHeader>
                  <DialogTitle>{t('userManagement.createNewUser')}</DialogTitle>
                  <DialogDescription>
                    {t('userManagement.description')}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t('userManagement.name')}</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('userManagement.email')}</Label>
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
                      <Label htmlFor="phone">{t('userManagement.phone')}</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">{t('userManagement.role')}</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value: "customer" | "staff" | "admin") =>
                          setFormData({ ...formData, role: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('common.select')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="customer">{t('userManagement.customer')}</SelectItem>
                          <SelectItem value="staff">{t('userManagement.staff')}</SelectItem>
                          <SelectItem value="admin">{t('userManagement.admin')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">{t('login.password')}</Label>
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
                    <Label htmlFor="sendWelcomeEmail">{t('userManagement.sendWelcomeEmail')}</Label>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)} data-variant="outline">
                      {t('common.cancel')}
                    </Button>
                    <Button type="submit" disabled={creating} data-variant="default">
                      {creating ? t('common.create') + "..." : t('common.create')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="stats-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="stat-label text-sm font-medium">{t('userManagement.users')}</CardTitle>
              <Users className="stat-icon h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="stat-value text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Total registered users
              </p>
            </CardContent>
          </Card>
          <Card className="stats-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="stat-label text-sm font-medium">{t('userManagement.active')}</CardTitle>
              <Users className="stat-icon h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="stat-value text-2xl font-bold">
                {users.filter(u => u.isActive).length}
              </div>
              <p className="text-xs text-muted-foreground">
                On current page
              </p>
            </CardContent>
          </Card>
          <Card className="stats-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="stat-label text-sm font-medium">{t('staffManagement.staff')}</CardTitle>
              <Shield className="stat-icon h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="stat-value text-2xl font-bold">
                {users.filter(u => u.role === 'staff').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Including {users.filter(u => u.role === 'admin').length} admins
              </p>
            </CardContent>
          </Card>
          <Card className="stats-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="stat-label text-sm font-medium">{t('orders.totalCost')}</CardTitle>
              <DollarSign className="stat-icon h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="stat-value text-2xl font-bold">
                ${users.reduce((sum, u) => sum + (u.totalSpent || 0), 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                From {users.reduce((sum, u) => sum + (u.totalOrders || 0), 0)} orders
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="filters-bar">
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 filter-group">
                <div className="relative search-input">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('userManagement.name') + ", " + t('userManagement.email') + ", " + t('userManagement.phone')}
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
                    <SelectValue placeholder={t('userManagement.allRoles')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('userManagement.allRoles')}</SelectItem>
                    <SelectItem value="customer">{t('userManagement.customer')}</SelectItem>
                    <SelectItem value="staff">{t('userManagement.staff')}</SelectItem>
                    <SelectItem value="admin">{t('userManagement.admin')}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={t('userManagement.allStatuses')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('userManagement.allStatuses')}</SelectItem>
                    <SelectItem value="active">{t('userManagement.active')}</SelectItem>
                    <SelectItem value="inactive">{t('userManagement.inactive')}</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={customerGroupFilter} onValueChange={setCustomerGroupFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder={t('userManagement.allCustomerGroups')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('userManagement.allCustomerGroups')}</SelectItem>
                    <SelectItem value="none">{t('userManagement.noCustomerGroup')}</SelectItem>
                    {availableGroups.map((group) => (
                      <SelectItem key={group._id} value={group._id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 per page</SelectItem>
                    <SelectItem value="25">25 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                    <SelectItem value="100">100 per page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedUsers.length > 0 && (
              <div className="bulk-actions-bar flex items-center gap-2 mt-4 p-3 rounded-lg">
                <span className="selected-count text-sm font-medium">
                  {selectedUsers.length} {t('userManagement.selectedCount')}
                </span>
                <div className="flex gap-2 ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkStatusUpdate('active')}
                    data-variant="outline"
                  >
                    {t('userManagement.active')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkStatusUpdate('inactive')}
                    data-variant="outline"
                  >
                    {t('userManagement.inactive')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedUsers([])}
                    data-variant="outline"
                  >
                    {t('common.close')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enhanced Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('userManagement.users')}</CardTitle>
            <CardDescription>
              Showing {users.length} of {totalUsers} users (Page {currentPage} of {totalPages})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="table-container rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedUsers.length === users.length && users.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-2">
                        {t('userManagement.name')}
                        {getSortIcon('name')}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('role')}>
                      <div className="flex items-center gap-2">
                        {t('userManagement.role')} & {t('userManagement.status')}
                        {getSortIcon('role')}
                      </div>
                    </TableHead>
                    <TableHead>{t('userManagement.customerGroup')}</TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('createdAt')}>
                      <div className="flex items-center gap-2">
                        {t('userManagement.createdAt')}
                        {getSortIcon('createdAt')}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('lastActivity')}>
                      <div className="flex items-center gap-2">
                        {t('userManagement.lastActivity')}
                        {getSortIcon('lastActivity')}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('totalOrders')}>
                      <div className="flex items-center gap-2">
                        {t('userManagement.totalOrders')} & {t('userManagement.totalSpent')}
                        {getSortIcon('totalOrders')}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="empty-state text-center py-8">
                        <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <h3 className="text-muted-foreground">{t('userManagement.noUsersFound')}</h3>
                        {searchTerm && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Try adjusting your search or filters
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
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
                            <Avatar className="avatar w-10 h-10">
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
                              <Badge className={getStatusColor(user.isActive ? 'active' : 'inactive')} variant="outline">
                                {user.isActive ? 'active' : 'inactive'}
                              </Badge>
                              <Switch
                                checked={user.isActive}
                                onCheckedChange={() => handleStatusToggle(user._id, user.isActive ? 'active' : 'inactive')}
                                disabled={updating === user._id}
                                size="sm"
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.customerGroup ? (
                            <Badge variant="outline">{user.customerGroup}</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">{t('userManagement.noCustomerGroup')}</span>
                          )}
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
                                <span>{formatDate(user.createdAt)}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{formatDateTime(user.createdAt)}</p>
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
                              <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => {
                                setSelectedUserId(user._id)
                                setShowDetailsDialog(true)
                              }}>
                                <Eye className="mr-2 h-4 w-4" />
                                {t('userManagement.viewDetails')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                <Edit className="mr-2 h-4 w-4" />
                                {t('userManagement.editUser')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onSelect={(e) => e.preventDefault()}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {t('userManagement.deleteUser')}
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {t('userManagement.confirmDelete')} "{user.name}"
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteUser(user._id)}
                                      disabled={deleting === user._id}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      {deleting === user._id ? t('common.delete') + "..." : t('common.delete')}
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalUsers)} of {totalUsers} users
                </div>
                <Pagination>
                  <PaginationContent>
                    {renderPaginationItems()}
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>

        {showDetailsDialog && (
          <UserDetailsDialog
            userId={selectedUserId}
            open={showDetailsDialog}
            onOpenChange={setShowDetailsDialog}
          />
        )}

        {showEditDialog && (
          <EditUserDialog
            user={editingUser}
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
            onUserUpdated={handleUserUpdated}
          />
        )}

        <CSVImportDialog
          open={showCSVImportDialog}
          onOpenChange={setShowCSVImportDialog}
          onImportSuccess={fetchUsers}
        />
      </div>
    </TooltipProvider>
  )
}
