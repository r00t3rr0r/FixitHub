import { useEffect, useState } from "react"
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import {
  getAddOnServices,
  getAddOnServiceById,
  createAddOnService,
  updateAddOnService,
  deleteAddOnService,
  AddOnService
} from "@/api/services"
import {
  getServiceCategories,
  ServiceCategory
} from "@/api/serviceCategories"
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  DollarSign,
  Clock,
  Star,
  Save,
  X,
  Shield,
  Package,
  Percent,
  Info,
  Calendar,
  Tag,
  Smartphone,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Upload
} from "lucide-react"
import AddOnCSVImportDialog from "@/components/admin/AddOnCSVImportDialog"
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

export function AddOnServiceManagement() {
  const { t } = useTranslation()
  const [addOnServices, setAddOnServices] = useState<AddOnService[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  // Sorting state
  const [sortBy, setSortBy] = useState<string>("createdAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isCSVImportDialogOpen, setIsCSVImportDialogOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<AddOnService | null>(null)
  const [detailService, setDetailService] = useState<AddOnService | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    estimatedTime: "",
    category: "",
    compatibility: [] as Array<{deviceType: string, brands: string[]}>,
    bundleDiscount: 0,
    popularity: 0
  })
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const deviceTypes = ['iPhone', 'Samsung', 'Google Pixel', 'iPad', 'Tablet', 'Laptop']
  const brands = ['Apple', 'Samsung', 'Google', 'Microsoft', 'Dell', 'HP', 'Lenovo']
  const compactFieldClassName = "h-9 text-xs"
  const compactLabelClassName = "text-[11px] font-medium uppercase tracking-wide text-muted-foreground"

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchAddOnServices()
  }, [currentPage, itemsPerPage, sortBy, sortOrder, categoryFilter])

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true)
      console.log("Fetching add-on service categories...")

      const response = await getServiceCategories({ type: 'addon', isActive: true })
      setCategories(response.categories)
      console.log(`Loaded ${response.categories.length} add-on categories`)
    } catch (error: any) {
      console.error("Error fetching categories:", error)
      toast({
        title: t('common.error'),
        description: error.message || "Failed to load categories",
        variant: "destructive"
      })
    } finally {
      setLoadingCategories(false)
    }
  }

  const fetchAddOnServices = async () => {
    try {
      setLoading(true)
      console.log("Fetching add-on services with pagination and sorting...")

      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
        sortBy: sortBy,
        sortOrder: sortOrder
      }

      if (categoryFilter !== "all") {
        params.category = categoryFilter
      }

      const response = await getAddOnServices(params)
      const servicesData = response.addOns || []
      setAddOnServices(servicesData)

      // Update pagination state
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages)
        setTotalItems(response.pagination.total)
        console.log("Pagination info:", response.pagination)
      }
    } catch (error: any) {
      console.error("Error fetching add-on services:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('addOnServices.failedToLoadServices'),
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchAddOnServiceDetail = async (id: string) => {
    try {
      setLoadingDetail(true)
      console.log("Fetching add-on service detail for ID:", id)
      const response = await getAddOnServiceById(id)
      setDetailService(response.addOn)
      setIsDetailDialogOpen(true)
    } catch (error: any) {
      console.error("Error fetching add-on service detail:", error)
      toast({
        title: t('common.error'),
        description: error.message || "Failed to load add-on service details",
        variant: "destructive"
      })
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleRowClick = (service: AddOnService) => {
    console.log("Row clicked for service:", service.name)
    fetchAddOnServiceDetail(service._id)
  }

  const handleCreateService = async () => {
    try {
      setSubmitting(true)
      console.log("Creating new add-on service:", formData)

      const response = await createAddOnService(formData)

      toast({
        title: t('common.success'),
        description: response.message || t('addOnServices.serviceCreatedSuccess')
      })

      await fetchAddOnServices()
      setIsCreateDialogOpen(false)
      resetForm()
    } catch (error: any) {
      console.error("Error creating add-on service:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('addOnServices.failedToCreateService'),
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
      console.log("Updating add-on service:", selectedService._id, formData)

      const response = await updateAddOnService(selectedService._id, formData)

      toast({
        title: t('common.success'),
        description: response.message || t('addOnServices.serviceUpdated')
      })

      await fetchAddOnServices()
      setIsEditDialogOpen(false)
      setSelectedService(null)
      resetForm()
    } catch (error: any) {
      console.error("Error updating add-on service:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('addOnServices.failedToUpdateService'),
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
      console.log("Deleting add-on service:", selectedService._id)

      const response = await deleteAddOnService(selectedService._id)

      toast({
        title: t('common.success'),
        description: response.message || t('addOnServices.serviceDeleted')
      })

      await fetchAddOnServices()
      setIsDeleteDialogOpen(false)
      setSelectedService(null)
    } catch (error: any) {
      console.error("Error deleting add-on service:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('addOnServices.failedToDeleteService'),
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openCreateDialog = () => {
    resetForm()
    setIsCreateDialogOpen(true)
  }

  const openEditDialog = (service: AddOnService) => {
    setSelectedService(service)
    setFormData({
      name: service.name,
      description: service.description,
      price: service.price,
      estimatedTime: service.estimatedTime,
      category: service.category,
      compatibility: service.compatibility || [],
      bundleDiscount: service.bundleDiscount || 0,
      popularity: service.popularity || 0
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (service: AddOnService) => {
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
      compatibility: [],
      bundleDiscount: 0,
      popularity: 0
    })
  }

  const addCompatibility = () => {
    setFormData(prev => ({
      ...prev,
      compatibility: [...prev.compatibility, { deviceType: "", brands: [] }]
    }))
  }

  const removeCompatibility = (index: number) => {
    setFormData(prev => ({
      ...prev,
      compatibility: prev.compatibility.filter((_, i) => i !== index)
    }))
  }

  const updateCompatibility = (index: number, field: 'deviceType' | 'brands', value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      compatibility: prev.compatibility.map((comp, i) =>
        i === index ? { ...comp, [field]: value } : comp
      )
    }))
  }

  const toggleBrand = (compatIndex: number, brand: string) => {
    const compatibility = formData.compatibility[compatIndex]
    const brands = compatibility.brands.includes(brand)
      ? compatibility.brands.filter(b => b !== brand)
      : [...compatibility.brands, brand]

    updateCompatibility(compatIndex, 'brands', brands)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Column sorting function
  const handleSort = (column: string) => {
    console.log("Sorting by column:", column)
    if (sortBy === column) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      // Set new column and default to ascending
      setSortBy(column)
      setSortOrder("asc")
    }
    // Reset to first page when sorting changes
    setCurrentPage(1)
  }

  // Render sort icon for column headers
  const renderSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ChevronsUpDown className="h-4 w-4 ml-1 opacity-30" />
    }
    return sortOrder === "asc"
      ? <ChevronUp className="h-4 w-4 ml-1" />
      : <ChevronDown className="h-4 w-4 ml-1" />
  }

  // Pagination handlers
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const handlePageSizeChange = (value: string) => {
    setItemsPerPage(parseInt(value))
    setCurrentPage(1) // Reset to first page when changing page size
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#0f1d45] bg-gradient-to-r from-[#1a2a5e] via-[#1a2a5e] to-[#2a3f7e] px-4 py-4 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold leading-none">
            <Plus className="h-6 w-6" />
            {t('addOnServices.title')}
          </h1>
          <p className="text-sm text-white/80">
            {t('addOnServices.description')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            onClick={() => setIsCSVImportDialogOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button
            size="sm"
            className="bg-white text-[#1a2a5e] hover:bg-[#f8f9fc]"
            onClick={openCreateDialog}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('addOnServices.createNewService')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 pb-1">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Add-Ons
            </CardTitle>
            <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {addOnServices.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 pb-1">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Avg. Price
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              ${addOnServices.length > 0 ? (addOnServices.reduce((sum, s) => sum + s.price, 0) / addOnServices.length).toFixed(0) : 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 pb-1">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Categories
            </CardTitle>
            <Filter className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {[...new Set(addOnServices.map(s => s.category))].length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 pb-1">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Avg. Discount
            </CardTitle>
            <Percent className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {addOnServices.length > 0 ? (addOnServices.reduce((sum, s) => sum + (s.bundleDiscount || 0), 0) / addOnServices.length).toFixed(1) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('addOnServices.searchServices')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 pl-10 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 w-40 text-sm">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t('addOnServices.allCategories')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('addOnServices.allCategories')}</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category._id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add-On Services Table */}
      <Card>
        <CardHeader className="px-4 py-4">
          <CardTitle className="text-lg">{t('addOnServices.services')}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {t('addOnServices.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center">
                    {t('addOnServices.service')}
                    {renderSortIcon("name")}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("category")}
                >
                  <div className="flex items-center">
                    {t('addOnServices.category')}
                    {renderSortIcon("category")}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("price")}
                >
                  <div className="flex items-center">
                    {t('addOnServices.price')}
                    {renderSortIcon("price")}
                  </div>
                </TableHead>
                <TableHead>Est. Time</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("bundleDiscount")}
                >
                  <div className="flex items-center">
                    {t('addOnServices.bundleDiscount')}
                    {renderSortIcon("bundleDiscount")}
                  </div>
                </TableHead>
                <TableHead>Compatibility</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("popularity")}
                >
                  <div className="flex items-center">
                    Popularity
                    {renderSortIcon("popularity")}
                  </div>
                </TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addOnServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">{t('addOnServices.noServicesFound')}</p>
                  </TableCell>
                </TableRow>
              ) : (
                addOnServices.map((service) => (
                  <TableRow
                    key={service._id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRowClick(service)}
                  >
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium leading-tight">{service.name}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground leading-snug">
                          {service.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{service.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">${service.price}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{service.estimatedTime}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Percent className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{service.bundleDiscount || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {service.compatibility?.slice(0, 2).map((comp, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {comp.deviceType}
                          </Badge>
                        ))}
                        {(service.compatibility?.length || 0) > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{(service.compatibility?.length || 0) - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-400" />
                        <span className="text-sm">{service.popularity || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
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
                          className="h-8 w-8 p-0"
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
          <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Showing {addOnServices.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Rows per page:</Label>
                <Select value={itemsPerPage.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="h-8 w-20 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('common.previous')}
                </Button>

                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  {t('common.next')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden p-0">
          <DialogHeader className="gap-1 border-b border-[#0f1d45] bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] px-4 py-3 text-left text-white">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Info className="h-4 w-4" />
              Add-On Service Details
            </DialogTitle>
            <DialogDescription className="text-xs text-white/80 sm:text-sm">
              Comprehensive information about the selected add-on service
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="space-y-4 px-4 py-4">
              <div className="h-6 bg-muted rounded w-1/2 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-1/2 animate-pulse"></div>
              <div className="h-32 bg-muted rounded animate-pulse"></div>
            </div>
          ) : detailService ? (
            <div className="max-h-[calc(88vh-132px)] space-y-4 overflow-y-auto px-4 py-4">
              {/* Basic Information */}
              <Card>
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4" />
                    {detailService.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4 pt-0">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1">
                      <Label className={compactLabelClassName}>{t('addOnServices.category')}</Label>
                      <Badge variant="outline" className="w-fit text-[11px]">
                        <Tag className="h-3 w-3 mr-1" />
                        {detailService.category}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <Label className={compactLabelClassName}>{t('addOnServices.price')}</Label>
                      <div className="flex items-center gap-1 text-base font-semibold">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        {detailService.price}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className={compactLabelClassName}>Estimated Time</Label>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3.5 w-3.5 text-blue-600" />
                        <span>{detailService.estimatedTime}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className={compactLabelClassName}>{t('addOnServices.bundleDiscount')}</Label>
                      <div className="flex items-center gap-1 text-sm">
                        <Percent className="h-3.5 w-3.5 text-orange-600" />
                        <span>{detailService.bundleDiscount || 0}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className={compactLabelClassName}>{t('addOnServices.fieldDescription')}</Label>
                    <p className="rounded-lg bg-muted/50 p-2.5 text-sm leading-snug">
                      {detailService.description}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <Card>
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Star className="h-4 w-4" />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-lg bg-gradient-to-br from-yellow-50 to-yellow-100 p-3 text-center dark:from-yellow-950 dark:to-yellow-900">
                      <Star className="mx-auto mb-1.5 h-6 w-6 text-yellow-600" />
                      <div className="text-xl font-bold text-yellow-900 dark:text-yellow-100">
                        {detailService.popularity || 0}%
                      </div>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">Popularity</p>
                    </div>
                    <div className="rounded-lg bg-gradient-to-br from-green-50 to-green-100 p-3 text-center dark:from-green-950 dark:to-green-900">
                      <Shield className="mx-auto mb-1.5 h-6 w-6 text-green-600" />
                      <div className="text-xl font-bold text-green-900 dark:text-green-100">
                        {detailService.isActive ? t('addOnServices.active') : t('addOnServices.inactive')}
                      </div>
                      <p className="text-xs text-green-700 dark:text-green-300">{t('addOnServices.status')}</p>
                    </div>
                    <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 p-3 text-center dark:from-blue-950 dark:to-blue-900">
                      <Smartphone className="mx-auto mb-1.5 h-6 w-6 text-blue-600" />
                      <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
                        {detailService.compatibility?.length || 0}
                      </div>
                      <p className="text-xs text-blue-700 dark:text-blue-300">Compatibility Rules</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Device Compatibility */}
              {detailService.compatibility && detailService.compatibility.length > 0 && (
                <Card>
                  <CardHeader className="px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Smartphone className="h-4 w-4" />
                      {t('addOnServices.deviceCompatibility')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <div className="space-y-3">
                      {detailService.compatibility.map((comp, index) => (
                        <div key={index} className="rounded-lg border bg-muted/25 p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <Smartphone className="h-3.5 w-3.5 text-blue-600" />
                            <span className="text-sm font-medium">{comp.deviceType}</span>
                          </div>
                          <div className="space-y-1.5">
                            <Label className={compactLabelClassName}>Compatible Brands</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {comp.brands.map((brand, brandIndex) => (
                                <Badge key={brandIndex} variant="secondary" className="text-[11px]">
                                  {brand}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Timestamps */}
              <Card>
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calendar className="h-4 w-4" />
                    Timeline Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className={compactLabelClassName}>Created At</Label>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{formatDate(detailService.createdAt)}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className={compactLabelClassName}>Last Updated</Label>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{formatDate(detailService.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <Info className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No service details available</p>
            </div>
          )}

          <DialogFooter className="border-t px-4 py-3 sm:justify-between">
            <Button variant="outline" size="sm" onClick={() => setIsDetailDialogOpen(false)}>
              {t('common.close')}
            </Button>
            {detailService && (
              <Button size="sm" onClick={() => {
                setIsDetailDialogOpen(false)
                openEditDialog(detailService)
              }}>
                <Edit className="h-4 w-4 mr-2" />
                {t('addOnServices.editService')}
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
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden p-0">
          <DialogHeader className="gap-1 border-b border-[#0f1d45] bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] px-4 py-3 text-left text-white">
            <DialogTitle className="text-base font-semibold">
              {isCreateDialogOpen ? t('addOnServices.createNewService') : t('addOnServices.editService')}
            </DialogTitle>
            <DialogDescription className="text-xs text-white/80 sm:text-sm">
              {isCreateDialogOpen
                ? "Add a new add-on service to your catalog"
                : "Update the add-on service information"}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <div className="max-h-[calc(88vh-126px)] overflow-y-auto px-4 py-4">
            <TabsList className="grid h-9 w-full grid-cols-2">
              <TabsTrigger value="basic" className="text-xs">Basic Info</TabsTrigger>
              <TabsTrigger value="compatibility" className="text-xs">Compatibility</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-3 pt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className={compactLabelClassName}>{t('addOnServices.serviceName')}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Screen Protector Installation"
                    className={compactFieldClassName}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category" className={compactLabelClassName}>{t('addOnServices.category')}</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger className={compactFieldClassName}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingCategories ? (
                        <SelectItem value="loading" disabled>Loading categories...</SelectItem>
                      ) : categories.length === 0 ? (
                        <SelectItem value="none" disabled>No categories available</SelectItem>
                      ) : (
                        categories.map(category => (
                          <SelectItem key={category._id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className={compactLabelClassName}>{t('addOnServices.fieldDescription')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the add-on service..."
                  rows={2}
                  className="min-h-[72px] text-sm leading-snug"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="price" className={compactLabelClassName}>{t('addOnServices.price')} ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={compactFieldClassName}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="estimatedTime" className={compactLabelClassName}>Estimated Time</Label>
                  <Input
                    id="estimatedTime"
                    value={formData.estimatedTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimatedTime: e.target.value }))}
                    placeholder="e.g. 15 minutes"
                    className={compactFieldClassName}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bundleDiscount" className={compactLabelClassName}>{t('addOnServices.bundleDiscount')} (%)</Label>
                  <Input
                    id="bundleDiscount"
                    type="number"
                    value={formData.bundleDiscount}
                    onChange={(e) => setFormData(prev => ({ ...prev, bundleDiscount: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    min="0"
                    max="100"
                    className={compactFieldClassName}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="popularity" className={compactLabelClassName}>Popularity (%)</Label>
                  <Input
                    id="popularity"
                    type="number"
                    value={formData.popularity}
                    onChange={(e) => setFormData(prev => ({ ...prev, popularity: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    min="0"
                    max="100"
                    className={compactFieldClassName}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="compatibility" className="space-y-3 pt-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className={compactLabelClassName}>{t('addOnServices.deviceCompatibility')}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={addCompatibility}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Compatibility
                  </Button>
                </div>

                {formData.compatibility.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 py-6 text-center">
                    <Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">No compatibility rules defined</p>
                    <p className="text-xs text-muted-foreground">Click "Add Compatibility" to define device compatibility</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.compatibility.map((comp, index) => (
                      <div key={index} className="space-y-3 rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Compatibility Rule {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => removeCompatibility(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-1.5">
                          <Label className={compactLabelClassName}>Device Type</Label>
                          <Select
                            value={comp.deviceType}
                            onValueChange={(value) => updateCompatibility(index, 'deviceType', value)}
                          >
                            <SelectTrigger className={compactFieldClassName}>
                              <SelectValue placeholder="Select device type" />
                            </SelectTrigger>
                            <SelectContent>
                              {deviceTypes.map(deviceType => (
                                <SelectItem key={deviceType} value={deviceType}>
                                  {deviceType}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className={compactLabelClassName}>Compatible Brands</Label>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {brands.map(brand => (
                              <div key={brand} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`${index}-${brand}`}
                                  checked={comp.brands.includes(brand)}
                                  onChange={() => toggleBrand(index, brand)}
                                  className="rounded border-gray-300"
                                />
                                <Label htmlFor={`${index}-${brand}`} className="text-xs font-normal leading-none">
                                  {brand}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="border-t px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsCreateDialogOpen(false)
                setIsEditDialogOpen(false)
                setSelectedService(null)
                resetForm()
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={isCreateDialogOpen ? handleCreateService : handleUpdateService}
              disabled={submitting || !formData.name || !formData.description || !formData.category}
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isCreateDialogOpen ? "Creating..." : "Updating..."}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isCreateDialogOpen ? t('addOnServices.createNewService') : t('common.update')}
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
            <AlertDialogTitle>{t('addOnServices.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the add-on service
              "{selectedService?.name}" from your catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
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
                t('addOnServices.deleteService')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Import Dialog */}
      <AddOnCSVImportDialog
        open={isCSVImportDialogOpen}
        onOpenChange={setIsCSVImportDialogOpen}
        onImportComplete={() => {
          fetchAddOnServices()
        }}
      />
    </div>
  )
}