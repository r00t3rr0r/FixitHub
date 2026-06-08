import { useEffect, useRef, useState } from "react"
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
  deleteAllRepairServices,
  RepairService,
  PaginationResponse
} from "@/api/services"
import {
  getServiceCategories,
  ServiceCategory
} from "@/api/serviceCategories"
import {
  Wrench,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Clock,
  Star,
  Save,
  X,
  BookOpen,
  Link as LinkIcon,
  Info,
  Calendar,
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
import "./ServiceManagement.css"

type SortField = 'name' | 'category' | 'manufacturer' | 'model' | 'price' | 'estimatedTime' | 'popularity'
type SortOrder = 'asc' | 'desc'

interface ColumnFilterMenuProps {
  column: string
  label: string
  allValues: string[]
  excludedValues: Set<string>
  onExcludedChange: (column: string, excluded: Set<string>) => void
  sortBy?: string
  sortOrder?: SortOrder
  onSortAsc?: () => void
  onSortDesc?: () => void
}

function ServiceDetailView({ service }: { service: RepairService }) {
  const stripHtml = (value?: string) => {
    if (!value) return ''
    return value.replace(/<[^>]*>/g, '').trim()
  }

  const renderHtmlBlock = (label: string, value?: string) => {
    const hasContent = Boolean(stripHtml(value))
    return (
      <div className="sd-desc">
        <span className="sd-desc__label">{label}</span>
        {hasContent ? (
          <div
            className="sd-desc__body"
            dangerouslySetInnerHTML={{ __html: value as string }}
          />
        ) : (
          <p className="sd-desc__body sd-desc__body--empty">No information available</p>
        )}
      </div>
    )
  }

  const renderTextBlock = (label: string, value?: string, fallback = '—') => {
    const hasContent = Boolean(value && value.trim())
    return (
      <div className="sd-desc">
        <span className="sd-desc__label">{label}</span>
        <p className={`sd-desc__body${hasContent ? '' : ' sd-desc__body--empty'}`}>
          {hasContent ? value : fallback}
        </p>
      </div>
    )
  }

  const formatMoney = (value?: number) => `$${(value ?? 0).toFixed(2)}`

  return (
    <div className="sd-layout">
      {/* Identity strip */}
      <div className="sd-identity">
        <div className="sd-identity__left">
          <div className="sd-partnum">#{service.articleNumber || 'NO-ARTICLE'}</div>
          <div className="sd-name">{service.name}</div>
          <div className="sd-meta">
            {service.manufacturer && <span>{service.manufacturer}</span>}
            {service.manufacturer && (service.model || service.category) && <span className="sd-dot">·</span>}
            {service.model && <span>{service.model}</span>}
            {service.model && service.category && <span className="sd-dot">·</span>}
            <span className="sd-category-pill">{service.category}</span>
          </div>
        </div>
        <div className="sd-price-block">
          <div className="sd-price">{formatMoney(service.price)}</div>
          <div className="sd-price-label">Current Price</div>
          <span className={`sd-status-badge ${service.isActive ? 'sd-status-badge--active' : 'sd-status-badge--inactive'}`}>
            {service.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Two-column body: left = Basic + Pricing, right = Device + SEO */}
      <div className="sd-body-grid">

        {/* LEFT COLUMN */}
        <div className="sd-col">

          {/* Basic Information */}
          <div className="sd-section">
            <div className="sd-section-title"><Info size={12} /> Basic Information</div>
            <div className="sd-kv-grid">
              <span className="sd-kv-label">Article #</span>
              <span className="sd-kv-value sd-mono">{service.articleNumber || '—'}</span>

              <span className="sd-kv-label">Category</span>
              <span className="sd-kv-value">{service.category || '—'}</span>

              <span className="sd-kv-label">Service</span>
              <span className="sd-kv-value">{service.service || '—'}</span>

              <span className="sd-kv-label">Estimated Time</span>
              <span className="sd-kv-value">
                {service.estimatedTime
                  ? <span className="sd-inline-icon"><Clock size={12} />{service.estimatedTime}</span>
                  : '—'}
              </span>
            </div>
          </div>

          {/* Pricing & Performance */}
          <div className="sd-section">
            <div className="sd-section-title"><DollarSign size={12} /> Pricing &amp; Performance</div>
            <div className="sd-kv-grid">
              <span className="sd-kv-label">Price</span>
              <span className="sd-kv-value sd-money">{formatMoney(service.price)}</span>

              <span className="sd-kv-label">MSRP</span>
              <span className="sd-kv-value sd-money">{formatMoney(service.msrp)}</span>

              <span className="sd-kv-label">Purchase Price</span>
              <span className="sd-kv-value sd-money">{formatMoney(service.purchasePrice)}</span>

              <span className="sd-kv-label">Tax Class</span>
              <span className="sd-kv-value">{service.taxClass || '—'}</span>

              <span className="sd-kv-label">Source</span>
              <span className="sd-kv-value">{service.source || '—'}</span>

              <span className="sd-kv-label">Popularity</span>
              <span className="sd-kv-value sd-big">
                <span className="sd-inline-icon"><Star size={12} />{service.popularity}%</span>
              </span>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div className="sd-col">

          {/* Device Compatibility */}
          <div className="sd-section">
            <div className="sd-section-title"><Smartphone size={12} /> Device Compatibility</div>
            <div className="sd-kv-grid">
              <span className="sd-kv-label">Manufacturer</span>
              <span className="sd-kv-value">{service.manufacturer || '—'}</span>

              <span className="sd-kv-label">Model</span>
              <span className="sd-kv-value">{service.model || '—'}</span>

              <span className="sd-kv-label">Device Types</span>
              <span className="sd-kv-value sd-big">{service.deviceTypes?.length || 0}</span>
            </div>
            {service.deviceTypes && service.deviceTypes.length > 0 ? (
              <div className="sd-chip-list">
                {service.deviceTypes.map((deviceType) => (
                  <span key={deviceType} className="sd-chip">{deviceType}</span>
                ))}
              </div>
            ) : (
              <p className="sd-chip-empty">No compatible device types defined</p>
            )}
          </div>

          {/* SEO */}
          <div className="sd-section">
            <div className="sd-section-title"><FileText size={12} /> SEO</div>
            <div className="sd-kv-grid">
              <span className="sd-kv-label">Keywords</span>
              <span className="sd-kv-value">{service.searchKeywords || '—'}</span>

              <span className="sd-kv-label">SEO Name</span>
              <span className="sd-kv-value">{service.seoName || '—'}</span>

              <span className="sd-kv-label">SEO Title</span>
              <span className="sd-kv-value">{service.seoTitleTag || '—'}</span>
            </div>
          </div>

        </div>
      </div>

      {/* Full-width: Descriptions */}
      <div className="sd-section">
        <div className="sd-section-title"><FileText size={12} /> Descriptions</div>
        {renderHtmlBlock('Short Description', service.shortDescription)}
        {renderHtmlBlock('Description', service.description)}
      </div>

      {/* Full-width: SEO Meta */}
      {(service.seoMetaKeywords || service.seoMetaDescription) && (
        <div className="sd-section">
          <div className="sd-section-title"><FileText size={12} /> SEO Meta</div>
          {renderTextBlock('SEO Meta Keywords', service.seoMetaKeywords)}
          {renderTextBlock('SEO Meta Description', service.seoMetaDescription)}
        </div>
      )}

      {/* Full-width: Print Information */}
      {(service.printShortDescription || service.printDescription) && (
        <div className="sd-section">
          <div className="sd-section-title"><FileText size={12} /> Print Information</div>
          {renderTextBlock('Print Short Description', service.printShortDescription)}
          {renderTextBlock('Print Description', service.printDescription)}
        </div>
      )}

      {/* Full-width: Repair Information */}
      <div className="sd-section">
        <div className="sd-section-title"><User size={12} /> Repair Information</div>
        {renderTextBlock(
          'External Repair Information',
          service.externalRepairInfo,
          'No customer-facing repair information provided'
        )}
        {renderTextBlock(
          'Internal Repair Information',
          service.internalRepairInfo,
          'No internal repair information provided'
        )}
      </div>

      {/* Full-width: Note */}
      {service.note && service.note.trim() && (
        <div className="sd-section">
          <div className="sd-section-title"><FileText size={12} /> Note</div>
          {renderTextBlock('Note', service.note)}
        </div>
      )}

      {/* Full-width: Knowledge Base */}
      <div className="sd-section">
        <div className="sd-section-title">
          <BookOpen size={12} /> Knowledge Base
          {service.linkedKnowledgeBaseArticles && service.linkedKnowledgeBaseArticles.length > 0
            ? ` (${service.linkedKnowledgeBaseArticles.length})`
            : ''}
        </div>
        {service.linkedKnowledgeBaseArticles && service.linkedKnowledgeBaseArticles.length > 0 ? (
          <div className="sd-kb-list">
            {service.linkedKnowledgeBaseArticles.map((article, index) => (
              <div key={`${article.url || article.title || 'kb'}-${index}`} className="sd-kb-item">
                <LinkIcon />
                <div>
                  <p className="sd-kb-title">{article.title || 'Untitled Article'}</p>
                  {article.url ? (
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="sd-kb-link">
                      {article.url}
                    </a>
                  ) : (
                    <p className="sd-empty">No URL linked</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="sd-empty">No knowledge base articles linked to this service</p>
        )}
      </div>

      {/* Meta footer */}
      <div className="sd-meta-footer">
        <Calendar size={12} />
        <span>Created:</span>
        <span>{new Date(service.createdAt).toLocaleString()}</span>
        <span className="sd-dot">·</span>
        <span>Updated:</span>
        <span>{new Date(service.updatedAt).toLocaleString()}</span>
      </div>
    </div>
  )
}

function ColumnFilterMenu({
  column,
  label,
  allValues,
  excludedValues,
  onExcludedChange,
  sortBy,
  sortOrder,
  onSortAsc,
  onSortDesc,
}: ColumnFilterMenuProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const hasSortActions = Boolean(onSortAsc && onSortDesc)
  const isSortActive = hasSortActions && sortBy === column
  const isActive = isSortActive || excludedValues.size > 0

  const filteredValues = allValues.filter((value) =>
    value.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
        setSearch("")
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const toggleValue = (value: string) => {
    const next = new Set(excludedValues)

    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }

    onExcludedChange(column, next)
  }

  const selectAll = () => {
    const next = new Set(excludedValues)
    filteredValues.forEach((value) => next.delete(value))
    onExcludedChange(column, next)
  }

  const deselectAll = () => {
    const next = new Set(excludedValues)
    filteredValues.forEach((value) => next.add(value))
    onExcludedChange(column, next)
  }

  const clearFilter = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onExcludedChange(column, new Set())
  }

  const sortIcon = isSortActive
    ? (sortOrder === 'asc'
        ? <ChevronUp className="h-3.5 w-3.5" />
        : <ChevronDown className="h-3.5 w-3.5" />)
    : <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />

  return (
    <div className="col-filter-root">
      <button
        ref={buttonRef}
        type="button"
        className={`col-filter-trigger${isActive ? ' col-filter-trigger--active' : ''}`}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        title={`Filter ${label}`}
      >
        <span className="col-filter-label">{label}</span>
        {excludedValues.size > 0
          ? <Filter className="col-filter-icon--filtered h-3.5 w-3.5" />
          : sortIcon}
        {excludedValues.size > 0 && (
          <span className="col-filter-badge">{excludedValues.size}</span>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          className="col-filter-menu"
          onClick={(event) => event.stopPropagation()}
        >
          {hasSortActions && (
            <>
              <div className="col-filter-sort-row">
                <button
                  type="button"
                  className={`col-filter-sort-btn${isSortActive && sortOrder === 'asc' ? ' col-filter-sort-btn--active' : ''}`}
                  onClick={() => {
                    onSortAsc?.()
                    setOpen(false)
                  }}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  Asc
                </button>
                <button
                  type="button"
                  className={`col-filter-sort-btn${isSortActive && sortOrder === 'desc' ? ' col-filter-sort-btn--active' : ''}`}
                  onClick={() => {
                    onSortDesc?.()
                    setOpen(false)
                  }}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  Desc
                </button>
              </div>
              <div className="col-filter-divider" />
            </>
          )}

          <div className="col-filter-search-wrap">
            <Search className="col-filter-search-icon h-3.5 w-3.5" />
            <input
              className="col-filter-search-input"
              placeholder="Search values..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoFocus
            />
            {search && (
              <button
                type="button"
                className="col-filter-search-clear"
                onClick={() => setSearch("")}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="col-filter-actions-row">
            <button type="button" className="col-filter-link" onClick={selectAll}>All</button>
            <button type="button" className="col-filter-link" onClick={deselectAll}>None</button>
            {excludedValues.size > 0 && (
              <button
                type="button"
                className="col-filter-link col-filter-link--danger"
                onClick={clearFilter}
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>

          <div className="col-filter-list">
            {filteredValues.length === 0 ? (
              <span className="col-filter-empty">No values found</span>
            ) : (
              filteredValues.map((value) => (
                <label key={value} className="col-filter-item">
                  <input
                    type="checkbox"
                    className="col-filter-checkbox"
                    checked={!excludedValues.has(value)}
                    onChange={() => toggleValue(value)}
                  />
                  <span className="col-filter-item-label" title={value}>
                    {value}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function ServiceManagement() {
  const [services, setServices] = useState<RepairService[]>([])
  const [allServicesForFilterMenus, setAllServicesForFilterMenus] = useState<RepairService[]>([])
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
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({})

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isCSVImportDialogOpen, setIsCSVImportDialogOpen] = useState(false)
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false)
  const [deleteAllPassword, setDeleteAllPassword] = useState("")
  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const [selectedService, setSelectedService] = useState<RepairService | null>(null)
  const [detailService, setDetailService] = useState<RepairService | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [formData, setFormData] = useState({
    articleNumber: "",
    name: "",
    service: "",
    shortDescription: "",
    description: "",
    printShortDescription: "",
    printDescription: "",
    note: "",
    searchKeywords: "",
    seoName: "",
    seoTitleTag: "",
    seoMetaKeywords: "",
    seoMetaDescription: "",
    price: 0,
    purchasePrice: 0,
    msrp: 0,
    taxClass: "",
    source: "",
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

  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const deviceTypes = ['iPhone', 'Samsung', 'Google Pixel', 'iPad', 'Tablet', 'Laptop']

  const sortDisplayValues = (values: string[]) => (
    values.sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
  )

  const getServiceValue = (service: RepairService, column: string) => {
    switch (column) {
      case 'name':
        return service.name || '—'
      case 'category':
        return service.category || '—'
      case 'manufacturer':
        return service.manufacturer?.trim() || '—'
      case 'model':
        return service.model?.trim() || '—'
      case 'price':
        return `$${service.price}`
      case 'estimatedTime':
        return service.estimatedTime || '—'
      case 'knowledgeBase':
        return String(service.linkedKnowledgeBaseArticles?.length || 0)
      case 'popularity':
        return `${service.popularity}%`
      default:
        return '—'
    }
  }

  const getServiceDeviceTypes = (service: RepairService) => (
    service.deviceTypes?.length ? service.deviceTypes : ['—']
  )

  useEffect(() => {
    fetchCategories()
    fetchAllServicesForFilterMenus()
  }, [])

  useEffect(() => {
    document.body.classList.add('service-management-page')
    return () => {
      document.body.classList.remove('service-management-page')
    }
  }, [])

  useEffect(() => {
    fetchServices()
  }, [currentPage, pageSize, sortBy, sortOrder, categoryFilter])

  useEffect(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const hasAnyColumnFilter = Object.values(columnFilters).some((set) => set && set.size > 0)

    // When column filters are active, filter the full dataset so that values
    // unique to other pages remain reachable (e.g. after "None" + re-select).
    // Otherwise filter only the current page for performance and correct pagination.
    const sourceList = hasAnyColumnFilter && allServicesForFilterMenus.length
      ? allServicesForFilterMenus
      : services

    const filtered = sourceList.filter((service) => {
      const matchesSearch = !normalizedSearch || (
        service.name.toLowerCase().includes(normalizedSearch) ||
        service.description.toLowerCase().includes(normalizedSearch) ||
        service.category.toLowerCase().includes(normalizedSearch) ||
        (service.manufacturer && service.manufacturer.toLowerCase().includes(normalizedSearch)) ||
        (service.model && service.model.toLowerCase().includes(normalizedSearch))
      )

      if (!matchesSearch) return false

      if (columnFilters.name?.size && columnFilters.name.has(getServiceValue(service, 'name'))) return false
      if (columnFilters.category?.size && columnFilters.category.has(getServiceValue(service, 'category'))) return false
      if (columnFilters.manufacturer?.size && columnFilters.manufacturer.has(getServiceValue(service, 'manufacturer'))) return false
      if (columnFilters.model?.size && columnFilters.model.has(getServiceValue(service, 'model'))) return false
      if (columnFilters.price?.size && columnFilters.price.has(getServiceValue(service, 'price'))) return false
      if (columnFilters.estimatedTime?.size && columnFilters.estimatedTime.has(getServiceValue(service, 'estimatedTime'))) return false
      if (columnFilters.knowledgeBase?.size && columnFilters.knowledgeBase.has(getServiceValue(service, 'knowledgeBase'))) return false
      if (columnFilters.popularity?.size && columnFilters.popularity.has(getServiceValue(service, 'popularity'))) return false

      if (columnFilters.deviceTypes?.size) {
        const serviceDeviceTypes = getServiceDeviceTypes(service)
        const hasAtLeastOneIncludedDeviceType = serviceDeviceTypes
          .some((deviceType) => !columnFilters.deviceTypes?.has(deviceType))

        if (!hasAtLeastOneIncludedDeviceType) return false
      }

      return true
    })

    setFilteredServices(filtered)
  }, [services, allServicesForFilterMenus, searchTerm, columnFilters])

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true)
      console.log("Fetching repair service categories...")

      const response = await getServiceCategories({ type: 'repair', isActive: true })
      setCategories(response.categories)
      console.log(`Loaded ${response.categories.length} repair categories`)
    } catch (error: any) {
      console.error("Error fetching categories:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load categories",
        variant: "destructive"
      })
    } finally {
      setLoadingCategories(false)
    }
  }

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

  const fetchAllServicesForFilterMenus = async () => {
    try {
      const maxLimitPerPage = 200
      let page = 1
      let totalPages = 1
      const allServices: RepairService[] = []

      do {
        const response = await getRepairServices({
          page,
          limit: maxLimitPerPage,
          sortBy: 'name',
          sortOrder: 'asc'
        })

        const batch = response.services || []
        allServices.push(...batch)
        totalPages = response.pagination?.totalPages || 1
        page += 1
      } while (page <= totalPages)

      const uniqueById = Array.from(
        new Map(allServices.map((service) => [service._id, service])).values()
      )

      setAllServicesForFilterMenus(uniqueById)
    } catch (error) {
      console.error('Failed to fetch full service list for filter menus:', error)
      setAllServicesForFilterMenus([])
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
      await fetchAllServicesForFilterMenus()
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
      await fetchAllServicesForFilterMenus()
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
      await fetchAllServicesForFilterMenus()
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

  const handleColumnFilterChange = (column: string, excluded: Set<string>) => {
    setColumnFilters((previous) => ({ ...previous, [column]: excluded }))
  }

  const makeSortAsc = (field: SortField) => () => {
    setSortBy(field)
    setSortOrder('asc')
    setCurrentPage(1)
  }

  const makeSortDesc = (field: SortField) => () => {
    setSortBy(field)
    setSortOrder('desc')
    setCurrentPage(1)
  }

  const openCreateDialog = () => {
    resetForm()
    setIsCreateDialogOpen(true)
  }

  const openEditDialog = (service: RepairService) => {
    setSelectedService(service)
    setFormData({
      articleNumber: service.articleNumber || "",
      name: service.name,
      service: service.service || "",
      shortDescription: service.shortDescription || "",
      description: service.description,
      printShortDescription: service.printShortDescription || "",
      printDescription: service.printDescription || "",
      note: service.note || "",
      searchKeywords: service.searchKeywords || "",
      seoName: service.seoName || "",
      seoTitleTag: service.seoTitleTag || "",
      seoMetaKeywords: service.seoMetaKeywords || "",
      seoMetaDescription: service.seoMetaDescription || "",
      price: service.price,
      purchasePrice: service.purchasePrice || 0,
      msrp: service.msrp || 0,
      taxClass: service.taxClass || "",
      source: service.source || "",
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
      articleNumber: "",
      name: "",
      service: "",
      shortDescription: "",
      description: "",
      printShortDescription: "",
      printDescription: "",
      note: "",
      searchKeywords: "",
      seoName: "",
      seoTitleTag: "",
      seoMetaKeywords: "",
      seoMetaDescription: "",
      price: 0,
      purchasePrice: 0,
      msrp: 0,
      taxClass: "",
      source: "",
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
      <div className="service-page-container">
        <div className="service-page-header animate-pulse" style={{ minHeight: 96 }} />
        <div className="service-stats-grid">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="service-stat-card animate-pulse" style={{ minHeight: 92 }} />
          ))}
        </div>
        <div className="service-section-card animate-pulse" style={{ minHeight: 280 }} />
      </div>
    )
  }

  const activeFilterCount = Object.values(columnFilters).filter((values) => values.size > 0).length
  const hasClientFilters = Boolean(searchTerm.trim()) || activeFilterCount > 0
  const columnValues = {
    name: sortDisplayValues(Array.from(new Set((allServicesForFilterMenus.length ? allServicesForFilterMenus : services).map((service) => getServiceValue(service, 'name'))))),
    category: sortDisplayValues(Array.from(new Set((allServicesForFilterMenus.length ? allServicesForFilterMenus : services).map((service) => getServiceValue(service, 'category'))))),
    manufacturer: sortDisplayValues(Array.from(new Set((allServicesForFilterMenus.length ? allServicesForFilterMenus : services).map((service) => getServiceValue(service, 'manufacturer'))))),
    model: sortDisplayValues(Array.from(new Set((allServicesForFilterMenus.length ? allServicesForFilterMenus : services).map((service) => getServiceValue(service, 'model'))))),
    price: sortDisplayValues(Array.from(new Set((allServicesForFilterMenus.length ? allServicesForFilterMenus : services).map((service) => getServiceValue(service, 'price'))))),
    estimatedTime: sortDisplayValues(Array.from(new Set((allServicesForFilterMenus.length ? allServicesForFilterMenus : services).map((service) => getServiceValue(service, 'estimatedTime'))))),
    deviceTypes: sortDisplayValues(Array.from(new Set((allServicesForFilterMenus.length ? allServicesForFilterMenus : services).flatMap((service) => getServiceDeviceTypes(service))))),
    knowledgeBase: sortDisplayValues(Array.from(new Set((allServicesForFilterMenus.length ? allServicesForFilterMenus : services).map((service) => getServiceValue(service, 'knowledgeBase'))))),
    popularity: sortDisplayValues(Array.from(new Set((allServicesForFilterMenus.length ? allServicesForFilterMenus : services).map((service) => getServiceValue(service, 'popularity'))))),
  }

  return (
    <div className="service-page-container">
      {/* Header */}
      <div className="service-page-header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="service-page-header__title-block">
            <h1 className="service-page-header__title">
              <Wrench className="h-6 w-6" />
            Service Management
            </h1>
            <p className="service-page-header__subtitle">
            Manage repair services and pricing with column filters and detailed service records.
            </p>
          </div>
          <div className="service-page-header__actions">
            <button type="button" className="service-header-btn service-header-btn--ghost" onClick={() => setIsCSVImportDialogOpen(true)}>
              <Upload className="h-4 w-4" />
            Import CSV
            </button>
            <button
              type="button"
              className="service-header-btn service-header-btn--danger"
              onClick={() => {
                setDeleteAllPassword("")
                setIsDeleteAllDialogOpen(true)
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete All
            </button>
            <button type="button" className="service-header-btn service-header-btn--solid" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
            Add Service
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="service-stats-grid">
        <Card className="service-stat-card service-stat-card--blue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-blue-700 dark:text-blue-300">
              Total Services
            </CardTitle>
            <Wrench className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
              {pagination.total}
            </div>
          </CardContent>
        </Card>

        <Card className="service-stat-card service-stat-card--green">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-green-700 dark:text-green-300">
              Avg. Price
            </CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="text-xl font-bold text-green-900 dark:text-green-100">
              ${services.length > 0 ? (services.reduce((sum, s) => sum + s.price, 0) / services.length).toFixed(0) : 0}
            </div>
          </CardContent>
        </Card>

        <Card className="service-stat-card service-stat-card--purple">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-purple-700 dark:text-purple-300">
              Categories
            </CardTitle>
            <Filter className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="text-xl font-bold text-purple-900 dark:text-purple-100">
              {[...new Set(services.map(s => s.category))].length}
            </div>
          </CardContent>
        </Card>

        <Card className="service-stat-card service-stat-card--orange">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-orange-700 dark:text-orange-300">
              Avg. Rating
            </CardTitle>
            <Star className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="text-xl font-bold text-orange-900 dark:text-orange-100">
              {services.length > 0 ? (services.reduce((sum, s) => sum + s.popularity, 0) / services.length).toFixed(1) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="service-section-card">
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search services by name, description, category, manufacturer, or model..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={(value) => {
                setCategoryFilter(value)
                setCurrentPage(1) // Reset to first page when filter changes
              }}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <Filter className="mr-1.5 h-3.5 w-3.5" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category._id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={pageSize.toString()} onValueChange={(value) => {
                setPageSize(parseInt(value))
                setCurrentPage(1) // Reset to first page when page size changes
              }}>
                <SelectTrigger className="h-8 w-28 text-xs">
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
      <Card className="service-section-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Repair Services</CardTitle>
          <CardDescription className="text-xs">
            Manage your repair service catalog and pricing. Use the column menus to sort or exclude values across all services.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {activeFilterCount > 0 && (
            <div className="service-active-filters-bar">
              <Filter className="h-3.5 w-3.5" />
              <span>
                {activeFilterCount} column filters active, showing {filteredServices.length} of {allServicesForFilterMenus.length || services.length} services
              </span>
              <button
                type="button"
                className="col-filter-link col-filter-link--danger"
                onClick={() => setColumnFilters({})}
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="select-none py-2 text-xs">
                  <ColumnFilterMenu
                    column="name"
                    label="Service"
                    allValues={columnValues.name}
                    excludedValues={columnFilters.name || new Set()}
                    onExcludedChange={handleColumnFilterChange}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortAsc={makeSortAsc('name')}
                    onSortDesc={makeSortDesc('name')}
                  />
                </TableHead>
                <TableHead className="select-none py-2 text-xs">
                  <ColumnFilterMenu
                    column="category"
                    label="Category"
                    allValues={columnValues.category}
                    excludedValues={columnFilters.category || new Set()}
                    onExcludedChange={handleColumnFilterChange}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortAsc={makeSortAsc('category')}
                    onSortDesc={makeSortDesc('category')}
                  />
                </TableHead>
                <TableHead className="select-none py-2 text-xs">
                  <ColumnFilterMenu
                    column="manufacturer"
                    label="Manufacturer"
                    allValues={columnValues.manufacturer}
                    excludedValues={columnFilters.manufacturer || new Set()}
                    onExcludedChange={handleColumnFilterChange}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortAsc={makeSortAsc('manufacturer')}
                    onSortDesc={makeSortDesc('manufacturer')}
                  />
                </TableHead>
                <TableHead className="select-none py-2 text-xs">
                  <ColumnFilterMenu
                    column="model"
                    label="Model"
                    allValues={columnValues.model}
                    excludedValues={columnFilters.model || new Set()}
                    onExcludedChange={handleColumnFilterChange}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortAsc={makeSortAsc('model')}
                    onSortDesc={makeSortDesc('model')}
                  />
                </TableHead>
                <TableHead className="select-none py-2 text-xs">
                  <ColumnFilterMenu
                    column="price"
                    label="Price"
                    allValues={columnValues.price}
                    excludedValues={columnFilters.price || new Set()}
                    onExcludedChange={handleColumnFilterChange}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortAsc={makeSortAsc('price')}
                    onSortDesc={makeSortDesc('price')}
                  />
                </TableHead>
                <TableHead className="select-none py-2 text-xs">
                  <ColumnFilterMenu
                    column="estimatedTime"
                    label="Est. Time"
                    allValues={columnValues.estimatedTime}
                    excludedValues={columnFilters.estimatedTime || new Set()}
                    onExcludedChange={handleColumnFilterChange}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortAsc={makeSortAsc('estimatedTime')}
                    onSortDesc={makeSortDesc('estimatedTime')}
                  />
                </TableHead>
                <TableHead className="select-none py-2 text-xs">
                  <ColumnFilterMenu
                    column="deviceTypes"
                    label="Device Types"
                    allValues={columnValues.deviceTypes}
                    excludedValues={columnFilters.deviceTypes || new Set()}
                    onExcludedChange={handleColumnFilterChange}
                  />
                </TableHead>
                <TableHead className="select-none py-2 text-xs">
                  <ColumnFilterMenu
                    column="knowledgeBase"
                    label="Knowledge Base"
                    allValues={columnValues.knowledgeBase}
                    excludedValues={columnFilters.knowledgeBase || new Set()}
                    onExcludedChange={handleColumnFilterChange}
                  />
                </TableHead>
                <TableHead className="select-none py-2 text-xs">
                  <ColumnFilterMenu
                    column="popularity"
                    label="Popularity"
                    allValues={columnValues.popularity}
                    excludedValues={columnFilters.popularity || new Set()}
                    onExcludedChange={handleColumnFilterChange}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortAsc={makeSortAsc('popularity')}
                    onSortDesc={makeSortDesc('popularity')}
                  />
                </TableHead>
                <TableHead className="py-2 text-right text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      <span className="text-muted-foreground">Loading services...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No services match the current search or column filters</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredServices.map((service) => (
                  <TableRow
                    key={service._id}
                    className="cursor-pointer text-xs transition-colors hover:bg-muted/50"
                    onClick={() => handleRowClick(service)}
                  >
                    <TableCell className="py-2">
                      <div>
                        <p className="font-medium leading-tight">{service.name}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {service.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className="h-5 px-1.5 text-[11px]">{service.category}</Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="text-xs">
                        {service.manufacturer
                          ? <p className="font-medium">{service.manufacturer}</p>
                          : <span className="text-muted-foreground">-</span>}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-xs text-muted-foreground">{service.model || '-'}</span>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">${service.price}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span>{service.estimatedTime}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {service.deviceTypes.slice(0, 2).map(type => (
                          <Badge key={type} variant="secondary" className="h-5 px-1.5 text-[11px]">
                            {type}
                          </Badge>
                        ))}
                        {service.deviceTypes.length > 2 && (
                          <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                            +{service.deviceTypes.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3 text-muted-foreground" />
                        <span>
                          {service.linkedKnowledgeBaseArticles?.length || 0}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-400" />
                        <span>{service.popularity}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
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
                          className="h-7 w-7 p-0"
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
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <div className="text-xs text-muted-foreground">
                {hasClientFilters
                  ? `Showing ${filteredServices.length} of ${allServicesForFilterMenus.length || services.length} services (${pagination.total} total)`
                  : `Showing ${((currentPage - 1) * pageSize) + 1} to ${Math.min(currentPage * pageSize, pagination.total)} of ${pagination.total} services`}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
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
                        className="h-7 w-7 p-0 text-xs"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
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
        <DialogContent className="max-h-[90vh] max-w-4xl service-detail-dialog">
          <DialogHeader>
            <DialogTitle>
              <Info className="h-4 w-4" />
              Service Details
            </DialogTitle>
            <DialogDescription>
              Comprehensive information about the selected repair service
            </DialogDescription>
          </DialogHeader>

          <div className="service-dialog-scroll">

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
            <ServiceDetailView service={detailService} />
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Failed to load service details</p>
            </div>
          )}

          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" className="service-dialog-btn-outline" onClick={() => setIsDetailDialogOpen(false)}>
              Close
            </Button>
            {detailService && (
              <Button size="sm" className="service-dialog-btn-primary" onClick={() => {
                setIsDetailDialogOpen(false)
                openEditDialog(detailService)
              }}>
                <Edit className="mr-1.5 h-3.5 w-3.5" />
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
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto p-4 sm:p-5">
          <DialogHeader className="-mx-4 -mt-4 border-b border-[#2a3f7e] bg-[#1a2a5e] px-4 py-2.5 text-white sm:-mx-5 sm:-mt-5 sm:px-5">
            <DialogTitle className="text-base font-semibold">
              {isCreateDialogOpen ? "Create New Service" : "Edit Service"}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#d8dce6]">
              {isCreateDialogOpen
                ? "Add a new repair service to your catalog"
                : "Update the service information"}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid h-8 w-full grid-cols-3">
              <TabsTrigger value="basic" className="px-2 text-xs">Basic Info</TabsTrigger>
              <TabsTrigger value="device" className="px-2 text-xs">Device & Repair</TabsTrigger>
              <TabsTrigger value="knowledge" className="px-2 text-xs">Knowledge Base</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="articleNumber" className="text-xs">Artikelnummer</Label>
                  <Input
                    id="articleNumber"
                    value={formData.articleNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, articleNumber: e.target.value }))}
                    placeholder="e.g. ART-100023"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs">Service Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Screen Repair"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-xs">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
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

              <div className="space-y-2">
                <Label htmlFor="description" className="text-xs">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the service..."
                  rows={2}
                  className="min-h-[64px] text-xs"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-xs">Price ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimatedTime" className="text-xs">Estimated Time</Label>
                  <Input
                    id="estimatedTime"
                    value={formData.estimatedTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimatedTime: e.target.value }))}
                    placeholder="e.g. 2-3 hours"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="popularity" className="text-xs">Popularity (%)</Label>
                  <Input
                    id="popularity"
                    type="number"
                    value={formData.popularity}
                    onChange={(e) => setFormData(prev => ({ ...prev, popularity: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    min="0"
                    max="100"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="service" className="text-xs">Service</Label>
                  <Input
                    id="service"
                    value={formData.service}
                    onChange={(e) => setFormData(prev => ({ ...prev, service: e.target.value }))}
                    placeholder="e.g. Display Reparatur"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shortDescription" className="text-xs">Kurzbeschreibung</Label>
                  <Input
                    id="shortDescription"
                    value={formData.shortDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, shortDescription: e.target.value }))}
                    placeholder="Kurze Zusammenfassung"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="device" className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="manufacturer" className="text-xs">Manufacturer</Label>
                  <Input
                    id="manufacturer"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                    placeholder="e.g. Apple, Samsung, Google"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="msrp" className="text-xs">UVP ($)</Label>
                  <Input
                    id="msrp"
                    type="number"
                    value={formData.msrp}
                    onChange={(e) => setFormData(prev => ({ ...prev, msrp: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchasePrice" className="text-xs">Purchase Price ($)</Label>
                  <Input
                    id="purchasePrice"
                    type="number"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="taxClass" className="text-xs">Steuerklasse</Label>
                  <Input
                    id="taxClass"
                    value={formData.taxClass}
                    onChange={(e) => setFormData(prev => ({ ...prev, taxClass: e.target.value }))}
                    placeholder="e.g. A"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source" className="text-xs">_quelle</Label>
                  <Input
                    id="source"
                    value={formData.source}
                    onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                    placeholder="e.g. JTL"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="searchKeywords" className="text-xs">Suchbegriffe</Label>
                <Input
                  id="searchKeywords"
                  value={formData.searchKeywords}
                  onChange={(e) => setFormData(prev => ({ ...prev, searchKeywords: e.target.value }))}
                  placeholder="keyword1, keyword2"
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="seoName" className="text-xs">SEO Namen (Suchmaschienenname)</Label>
                  <Input
                    id="seoName"
                    value={formData.seoName}
                    onChange={(e) => setFormData(prev => ({ ...prev, seoName: e.target.value }))}
                    placeholder="seo-name"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seoTitleTag" className="text-xs">SEO Titel-Tag</Label>
                  <Input
                    id="seoTitleTag"
                    value={formData.seoTitleTag}
                    onChange={(e) => setFormData(prev => ({ ...prev, seoTitleTag: e.target.value }))}
                    placeholder="SEO Title"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoMetaKeywords" className="text-xs">SEO Meta-Keywords</Label>
                <Input
                  id="seoMetaKeywords"
                  value={formData.seoMetaKeywords}
                  onChange={(e) => setFormData(prev => ({ ...prev, seoMetaKeywords: e.target.value }))}
                  placeholder="meta, keywords"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoMetaDescription" className="text-xs">SEO Meta-Description</Label>
                <Textarea
                  id="seoMetaDescription"
                  value={formData.seoMetaDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, seoMetaDescription: e.target.value }))}
                  placeholder="Meta description"
                  rows={2}
                  className="min-h-[64px] text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="printShortDescription" className="text-xs">Druck Kurzbeschreibung</Label>
                <Textarea
                  id="printShortDescription"
                  value={formData.printShortDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, printShortDescription: e.target.value }))}
                  placeholder="Kurzer Drucktext"
                  rows={2}
                  className="min-h-[64px] text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="printDescription" className="text-xs">Druck Beschreibung</Label>
                <Textarea
                  id="printDescription"
                  value={formData.printDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, printDescription: e.target.value }))}
                  placeholder="Langer Drucktext"
                  rows={2}
                  className="min-h-[64px] text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="note" className="text-xs">Amerkung / Anmerkung</Label>
                <Textarea
                  id="note"
                  value={formData.note}
                  onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Interne Notiz"
                  rows={2}
                  className="min-h-[64px] text-xs"
                />
              </div>
                <div className="space-y-2">
                  <Label htmlFor="model" className="text-xs">Model</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                    placeholder="e.g. iPhone 15 Pro, Galaxy S24"
                    className="h-8 text-xs"
                  />
                </div>

              <div className="space-y-2">
                <Label className="text-xs">Device Types</Label>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {deviceTypes.map(deviceType => (
                    <div key={deviceType} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={deviceType}
                        checked={formData.deviceTypes.includes(deviceType)}
                        onChange={() => handleDeviceTypeToggle(deviceType)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor={deviceType} className="text-xs font-normal">
                        {deviceType}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="internalRepairInfo" className="text-xs">Internal Repair Information</Label>
                <Textarea
                  id="internalRepairInfo"
                  value={formData.internalRepairInfo}
                  onChange={(e) => setFormData(prev => ({ ...prev, internalRepairInfo: e.target.value }))}
                  placeholder="Internal notes and procedures for technicians..."
                  rows={3}
                  className="min-h-[80px] text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="externalRepairInfo" className="text-xs">External Repair Information</Label>
                <Textarea
                  id="externalRepairInfo"
                  value={formData.externalRepairInfo}
                  onChange={(e) => setFormData(prev => ({ ...prev, externalRepairInfo: e.target.value }))}
                  placeholder="Customer-facing repair information..."
                  rows={3}
                  className="min-h-[80px] text-xs"
                />
              </div>
            </TabsContent>

            <TabsContent value="knowledge" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Knowledge Base Articles</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={addKnowledgeBaseArticle}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add Article
                  </Button>
                </div>

                {formData.linkedKnowledgeBaseArticles.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 py-6 text-center">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-xs text-muted-foreground">No knowledge base articles linked</p>
                    <p className="text-xs text-muted-foreground">Click "Add Article" to link relevant documentation</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.linkedKnowledgeBaseArticles.map((article, index) => (
                      <div key={index} className="flex items-start gap-2 rounded-lg border p-2">
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Article title"
                            value={article.title}
                            onChange={(e) => updateKnowledgeBaseArticle(index, 'title', e.target.value)}
                            className="h-8 text-xs"
                          />
                          <div className="flex gap-2">
                            <LinkIcon className="mt-2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              placeholder="Article URL"
                              value={article.url}
                              onChange={(e) => updateKnowledgeBaseArticle(index, 'url', e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => removeKnowledgeBaseArticle(index)}
                        >
                          <X className="h-3.5 w-3.5" />
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
              size="sm"
              className="h-8 text-xs"
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
              size="sm"
              className="h-8 text-xs"
              onClick={isCreateDialogOpen ? handleCreateService : handleUpdateService}
              disabled={submitting || !formData.name || !formData.description || !formData.category || formData.deviceTypes.length === 0}
            >
              {submitting ? (
                <>
                  <div className="mr-1.5 h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-white"></div>
                  {isCreateDialogOpen ? "Creating..." : "Updating..."}
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
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
          fetchAllServicesForFilterMenus()
          setIsCSVImportDialogOpen(false)
        }}
      />

      {/* Delete All Services Confirmation Dialog */}
      <AlertDialog
        open={isDeleteAllDialogOpen}
        onOpenChange={(open) => {
          if (!isDeletingAll) {
            setIsDeleteAllDialogOpen(open)
            if (!open) setDeleteAllPassword("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">
              Delete ALL Services?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="font-semibold text-red-600">
                  WARNING: This action permanently deletes every service in the database. It cannot be undone.
                </p>
                <p>
                  Enter the admin password below to confirm.
                </p>
                <Input
                  type="password"
                  placeholder="Admin password"
                  value={deleteAllPassword}
                  onChange={(e) => setDeleteAllPassword(e.target.value)}
                  autoFocus
                  disabled={isDeletingAll}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && deleteAllPassword.length > 0 && !isDeletingAll) {
                      e.preventDefault()
                      ;(document.getElementById("confirm-delete-all-btn") as HTMLButtonElement | null)?.click()
                    }
                  }}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              id="confirm-delete-all-btn"
              disabled={isDeletingAll || deleteAllPassword.length === 0}
              className="bg-red-600 hover:bg-red-700"
              onClick={async (e) => {
                e.preventDefault()
                setIsDeletingAll(true)
                try {
                  const result = await deleteAllRepairServices(deleteAllPassword)
                  toast({
                    title: "All services deleted",
                    description: `Successfully deleted ${result?.deletedCount ?? 0} services.`,
                  })
                  setIsDeleteAllDialogOpen(false)
                  setDeleteAllPassword("")
                  await fetchServices()
                  await fetchAllServicesForFilterMenus()
                } catch (err: any) {
                  toast({
                    variant: "destructive",
                    title: "Delete failed",
                    description: err?.message || "Failed to delete services",
                  })
                } finally {
                  setIsDeletingAll(false)
                }
              }}
            >
              {isDeletingAll ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                "Delete All Services"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
