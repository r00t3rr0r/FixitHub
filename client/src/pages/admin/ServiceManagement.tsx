import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import {
  getRepairServices,
  getRepairServiceById,
  createRepairService,
  updateRepairService,
  deleteRepairService,
  RepairService,
  PaginationResponse
} from "@/api/services"
import {
  Wrench,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  DollarSign,
  Clock,
  Star,
  Save,
  X,
  BookOpen,
  Link as LinkIcon,
  Info,
  Calendar,
  Tag,
  Smartphone,
  User,
  FileText,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Upload
} from "lucide-react"
import ServiceCSVImportDialog from "@/components/admin/ServiceCSVImportDialog"
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
} from "@/components/ui/alert-dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

type SortField = 'name' | 'category' | 'manufacturer' | 'price' | 'estimatedTime' | 'popularity'
type SortOrder = 'asc' | 'desc'

export function ServiceManagement() {
  const { t } = useTranslation()
  const [services, setServices] = useState<RepairService[]>([])
  const [filteredServices, setFilteredServices] = useState<RepairService[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pagination, setPagination] = useState<PaginationResponse>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false
  })

  // Sorting state
  const [sortBy, setSortBy] = useState<SortField>('popularity')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isCSVImportDialogOpen, setIsCSVImportDialogOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<RepairService | null>(null)
  const [detailService, setDetailService] = useState<RepairService | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    estimatedTime: "",
    category: "",
    deviceTypes: [] as string[],
    manufacturer: "",
    model: "",
    internalRepairInfo: "",
    externalRepairInfo: "",
    linkedKnowledgeBaseArticles: [] as Array<{title: string, url: string}>,
    popularity: 0
  })
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const categories = ['Display', 'Power', 'Camera', 'Emergency', 'Hardware', 'Software']
  const deviceTypes = ['iPhone', 'Samsung', 'Google Pixel', 'iPad', 'Tablet', 'Laptop']

  useEffect(() => {
    fetchServices()
  }, [currentPage, pageSize, sortBy, sortOrder, categoryFilter])

  useEffect(() => {
    // Apply client-side search filter
    if (searchTerm) {
      const filtered = services.filter(service =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (service.manufacturer && service.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (service.model && service.model.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      setFilteredServices(filtered)
    } else {
      setFilteredServices(services)
    }
  }, [services, searchTerm])

  const fetchServices = async () => {
    try {
      setLoading(true)
      console.log("Fetching repair services with pagination and sorting...")

      const params: any = {
        page: currentPage,
        limit: pageSize,
        sortBy,
        sortOrder
      }

      if (categoryFilter !== "all") {
        params.category = categoryFilter
      }

      const response = await getRepairServices(params)
      const servicesData = response.services || []
      setServices(servicesData)
      setFilteredServices(servicesData)

      if (response.pagination) {
        setPagination(response.pagination)
        console.log(`Loaded ${servicesData.length} services (page ${response.pagination.page}/${response.pagination.totalPages})`)
      }
    } catch (error: any) {
      console.error("Error fetching services:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load services",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchServiceDetails = async (serviceId: string) => {
    try {
      setLoadingDetail(true)
      console.log("Fetching service details for ID:", serviceId)

      const response = await getRepairServiceById(serviceId)
      setDetailService(response.service)
      setIsDetailDialogOpen(true)

      console.log("Service details fetched successfully:", response.service.name)
    } catch (error: any) {
      console.error("Error fetching service details:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load service details",
        variant: "destructive"
      })
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleRowClick = (service: RepairService) => {
    console.log("Service row clicked:", service.name)
    fetchServiceDetails(service._id)
  }

  const handleCreateService = async () => {
    try {
      setSubmitting(true)
      console.log("Creating new service:", formData)

      const response = await createRepairService(formData)

      toast({
        title: "Success!",
        description: response.message || "Service created successfully"
      })

      await fetchServices()
      setIsCreateDialogOpen(false)
      resetForm()
    } catch (error: any) {
      console.error("Error creating service:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create service",
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateService = async () => {
    if (!selectedService) return

    try {
      setSubmitting(true)
      console.log("Updating service:", selectedService._id, formData)

      const response = await updateRepairService(selectedService._id, formData)

      toast({
        title: "Success!",
        description: response.message || "Service updated successfully"
      })

      await fetchServices()
      setIsEditDialogOpen(false)
      setSelectedService(null)
      resetForm()
    } catch (error: any) {
      console.error("Error updating service:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update service",
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteService = async () => {
    if (!selectedService) return

    try {
      setSubmitting(true)
      console.log("Deleting service:", selectedService._id)

      const response = await deleteRepairService(selectedService._id)

      toast({
        title: "Success!",
        description: response.message || "Service deleted successfully"
      })

      await fetchServices()
      setIsDeleteDialogOpen(false)
      setSelectedService(null)
    } catch (error: any) {
      console.error("Error deleting service:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete service",
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSort = (field: SortField) => {
    console.log(`Sorting by ${field}`)
    if (sortBy === field) {
      // Toggle sort order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // New sort field, default to ascending
      setSortBy(field)
      setSortOrder('asc')
    }
    // Reset to first page when sorting changes
    setCurrentPage(1)
  }

  const getSortIcon = (field: SortField) => {
    if (sortBy !== field) {
      return <ChevronsUpDown className="h-4 w-4 ml-1 text-muted-foreground" />
    }
    return sortOrder === 'asc'
      ? <ChevronUp className="h-4 w-4 ml-1" />
      : <ChevronDown className="h-4 w-4 ml-1" />
  }

  const openCreateDialog = () => {
    resetForm()
    setIsCreateDialogOpen(true)
  }

  const openEditDialog = (service: RepairService) => {
    setSelectedService(service)
    setFormData({
      name: service.name,
      description: service.description,
      price: service.price,
      estimatedTime: service.estimatedTime,
      category: service.category,
      deviceTypes: service.deviceTypes,
      manufacturer: service.manufacturer || "",
      model: service.model || "",
      internalRepairInfo: service.internalRepairInfo || "",
      externalRepairInfo: service.externalRepairInfo || "",
      linkedKnowledgeBaseArticles: service.linkedKnowledgeBaseArticles || [],
      popularity: service.popularity
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (service: RepairService) => {
    setSelectedService(service)
    setIsDeleteDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: 0,
      estimatedTime: "",
      category: "",
      deviceTypes: [],
      manufacturer: "",
      model: "",
      internalRepairInfo: "",
      externalRepairInfo: "",
      linkedKnowledgeBaseArticles: [],
      popularity: 0
    })
  }

  const handleDeviceTypeToggle = (deviceType: string) => {
    setFormData(prev => ({
      ...prev,
      deviceTypes: prev.deviceTypes.includes(deviceType)
        ? prev.deviceTypes.filter(dt => dt !== deviceType)
        : [...prev.deviceTypes, deviceType]
    }))
  }

  const addKnowledgeBaseArticle = () => {
    setFormData(prev => ({
      ...prev,
      linkedKnowledgeBaseArticles: [...prev.linkedKnowledgeBaseArticles, { title: "", url: "" }]
    }))
  }

  const removeKnowledgeBaseArticle = (index: number) => {
    setFormData(prev => ({
      ...prev,
      linkedKnowledgeBaseArticles: prev.linkedKnowledgeBaseArticles.filter((_, i) => i !== index)
    }))
  }

  const updateKnowledgeBaseArticle = (index: number, field: 'title' | 'url', value: string) => {
    setFormData(prev => ({
      ...prev,
      linkedKnowledgeBaseArticles: prev.linkedKnowledgeBaseArticles.map((article, i) =>
        i === index ? { ...article, [field]: value } : article
      )
    }))
  }

  if (loading && services.length === 0) {
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
            <Wrench className="h-8 w-8" />
            Service Management
          </h1>
          <p className="text-muted-foreground">
            Manage repair services and pricing. Click on a service row to view detailed information.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCSVImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Service
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Services
            </CardTitle>
            <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {pagination.total}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Avg. Price
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              ${services.length > 0 ? (services.reduce((sum, s) => sum + s.price, 0) / services.length).toFixed(0) : 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Categories
            </CardTitle>
            <Filter className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {[...new Set(services.map(s => s.category))].length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Avg. Rating
            </CardTitle>
            <Star className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {services.length > 0 ? (services.reduce((sum, s) => sum + s.popularity, 0) / services.length).toFixed(1) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search services by name, description, category, manufacturer, or model..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={(value) => {
                setCategoryFilter(value)
                setCurrentPage(1) // Reset to first page when filter changes
              }}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={pageSize.toString()} onValueChange={(value) => {
                setPageSize(parseInt(value))
                setCurrentPage(1) // Reset to first page when page size changes
              }}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 per page</SelectItem>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Table */}
      <Card>
        <CardHeader>
          <CardTitle>Repair Services</CardTitle>
          <CardDescription>
            Manage your repair service catalog and pricing. Click on any row to view detailed information. Click column headers to sort.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                    Service
                    {getSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center">
                    Category
                    {getSortIcon('category')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('manufacturer')}
                >
                  <div className="flex items-center">
                    Manufacturer/Model
                    {getSortIcon('manufacturer')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('price')}
                >
                  <div className="flex items-center">
                    Price
                    {getSortIcon('price')}
                  </div>
                </TableHead>
                <TableHead>Est. Time</TableHead>
                <TableHead>Device Types</TableHead>
                <TableHead>Knowledge Base</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('popularity')}
                >
                  <div className="flex items-center">
                    Popularity
                    {getSortIcon('popularity')}
                  </div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      <span className="text-muted-foreground">Loading services...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No services found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredServices.map((service) => (
                  <TableRow
                    key={service._id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRowClick(service)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {service.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{service.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {service.manufacturer && (
                          <p className="font-medium">{service.manufacturer}</p>
                        )}
                        {service.model && (
                          <p className="text-muted-foreground">{service.model}</p>
                        )}
                        {!service.manufacturer && !service.model && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">${service.price}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{service.estimatedTime}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {service.deviceTypes.slice(0, 2).map(type => (
                          <Badge key={type} variant="secondary" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                        {service.deviceTypes.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{service.deviceTypes.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {service.linkedKnowledgeBaseArticles?.length || 0}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-400" />
                        <span className="text-sm">{service.popularity}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditDialog(service)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openDeleteDialog(service)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {!loading && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} services
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={!pagination.hasPrevPage || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, pagination.totalPages))].map((_, idx) => {
                    let pageNum: number
                    if (pagination.totalPages <= 5) {
                      pageNum = idx + 1
                    } else if (currentPage <= 3) {
                      pageNum = idx + 1
                    } else if (currentPage >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + idx
                    } else {
                      pageNum = currentPage - 2 + idx
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        disabled={loading}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                  disabled={!pagination.hasNextPage || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Service Details
            </DialogTitle>
            <DialogDescription>
              Comprehensive information about the selected repair service
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="space-y-4 p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-muted rounded w-1/2"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-20 bg-muted rounded"></div>
                  <div className="h-20 bg-muted rounded"></div>
                </div>
              </div>
            </div>
          ) : detailService ? (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="device">Device Info</TabsTrigger>
                <TabsTrigger value="repair">Repair Details</TabsTrigger>
                <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5" />
                        Basic Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Service Name</Label>
                        <p className="text-lg font-semibold">{detailService.name}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Category</Label>
                        <div className="mt-1">
                          <Badge variant="outline" className="text-sm">
                            <Tag className="h-3 w-3 mr-1" />
                            {detailService.category}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                        <p className="text-sm mt-1 leading-relaxed">{detailService.description}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                        <div className="mt-1">
                          <Badge variant={detailService.isActive ? "default" : "secondary"}>
                            {detailService.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Pricing & Performance
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Price</Label>
                          <p className="text-2xl font-bold text-green-600">${detailService.price}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Popularity</Label>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-400" />
                            <p className="text-xl font-semibold">{detailService.popularity}%</p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Estimated Time</Label>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{detailService.estimatedTime}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                        <div className="flex items-center gap-1 mt-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm">{new Date(detailService.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="device" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5" />
                      Device Compatibility
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Manufacturer</Label>
                        <p className="font-medium mt-1">
                          {detailService.manufacturer || <span className="text-muted-foreground">Not specified</span>}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Model</Label>
                        <p className="font-medium mt-1">
                          {detailService.model || <span className="text-muted-foreground">Not specified</span>}
                        </p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Compatible Device Types</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {detailService.deviceTypes.map(type => (
                          <Badge key={type} variant="secondary">
                            <Smartphone className="h-3 w-3 mr-1" />
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="repair" className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Customer Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">External Repair Information</Label>
                        <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                          {detailService.externalRepairInfo ? (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{detailService.externalRepairInfo}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">No customer-facing repair information provided</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Internal Technical Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Internal Repair Information</Label>
                        <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                          {detailService.internalRepairInfo ? (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{detailService.internalRepairInfo}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">No internal repair information provided</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="knowledge" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Linked Knowledge Base Articles
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detailService.linkedKnowledgeBaseArticles && detailService.linkedKnowledgeBaseArticles.length > 0 ? (
                      <div className="space-y-3">
                        {detailService.linkedKnowledgeBaseArticles.map((article, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                            <LinkIcon className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{article.title || 'Untitled Article'}</p>
                              {article.url && (
                                <a
                                  href={article.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 break-all"
                                >
                                  {article.url}
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No knowledge base articles linked to this service</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Failed to load service details</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              Close
            </Button>
            {detailService && (
              <Button onClick={() => {
                setIsDetailDialogOpen(false)
                openEditDialog(detailService)
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Service
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false)
          setIsEditDialogOpen(false)
          setSelectedService(null)
          resetForm()
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreateDialogOpen ? "Create New Service" : "Edit Service"}
            </DialogTitle>
            <DialogDescription>
              {isCreateDialogOpen
                ? "Add a new repair service to your catalog"
                : "Update the service information"}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="device">Device & Repair</TabsTrigger>
              <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Service Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Screen Repair"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the service..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimatedTime">Estimated Time</Label>
                  <Input
                    id="estimatedTime"
                    value={formData.estimatedTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimatedTime: e.target.value }))}
                    placeholder="e.g. 2-3 hours"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="popularity">Popularity (%)</Label>
                  <Input
                    id="popularity"
                    type="number"
                    value={formData.popularity}
                    onChange={(e) => setFormData(prev => ({ ...prev, popularity: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="device" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input
                    id="manufacturer"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                    placeholder="e.g. Apple, Samsung, Google"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                    placeholder="e.g. iPhone 15 Pro, Galaxy S24"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Device Types</Label>
                <div className="grid grid-cols-3 gap-2">
                  {deviceTypes.map(deviceType => (
                    <div key={deviceType} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={deviceType}
                        checked={formData.deviceTypes.includes(deviceType)}
                        onChange={() => handleDeviceTypeToggle(deviceType)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor={deviceType} className="text-sm font-normal">
                        {deviceType}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="internalRepairInfo">Internal Repair Information</Label>
                <Textarea
                  id="internalRepairInfo"
                  value={formData.internalRepairInfo}
                  onChange={(e) => setFormData(prev => ({ ...prev, internalRepairInfo: e.target.value }))}
                  placeholder="Internal notes and procedures for technicians..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="externalRepairInfo">External Repair Information</Label>
                <Textarea
                  id="externalRepairInfo"
                  value={formData.externalRepairInfo}
                  onChange={(e) => setFormData(prev => ({ ...prev, externalRepairInfo: e.target.value }))}
                  placeholder="Customer-facing repair information..."
                  rows={4}
                />
              </div>
            </TabsContent>

            <TabsContent value="knowledge" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Knowledge Base Articles</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addKnowledgeBaseArticle}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Article
                  </Button>
                </div>

                {formData.linkedKnowledgeBaseArticles.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No knowledge base articles linked</p>
                    <p className="text-sm text-muted-foreground">Click "Add Article" to link relevant documentation</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.linkedKnowledgeBaseArticles.map((article, index) => (
                      <div key={index} className="flex gap-2 items-start p-3 border rounded-lg">
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Article title"
                            value={article.title}
                            onChange={(e) => updateKnowledgeBaseArticle(index, 'title', e.target.value)}
                          />
                          <div className="flex gap-2">
                            <LinkIcon className="h-4 w-4 mt-2 text-muted-foreground" />
                            <Input
                              placeholder="Article URL"
                              value={article.url}
                              onChange={(e) => updateKnowledgeBaseArticle(index, 'url', e.target.value)}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeKnowledgeBaseArticle(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false)
                setIsEditDialogOpen(false)
                setSelectedService(null)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={isCreateDialogOpen ? handleCreateService : handleUpdateService}
              disabled={submitting || !formData.name || !formData.description || !formData.category || formData.deviceTypes.length === 0}
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isCreateDialogOpen ? "Creating..." : "Updating..."}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isCreateDialogOpen ? "Create Service" : "Update Service"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the service
              "{selectedService?.name}" from your catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteService}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                "Delete Service"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Import Dialog */}
      <ServiceCSVImportDialog
        open={isCSVImportDialogOpen}
        onOpenChange={setIsCSVImportDialogOpen}
        onImportComplete={() => {
          fetchServices()
          setIsCSVImportDialogOpen(false)
        }}
      />
    </div>
  )
}
