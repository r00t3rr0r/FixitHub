import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { getProducts, createProduct, updateProduct, deleteProduct, getProductCategories, getProductBrands, Product } from "@/api/shop"
import {
  ShoppingCart,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  Package,
  DollarSign,
  Star,
  TrendingUp,
  X,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Upload
} from "lucide-react"
import ProductCSVImportDialog from "@/components/admin/ProductCSVImportDialog"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function WebShopManagement() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [sortBy, setSortBy] = useState("createdAt")
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [availableBrands, setAvailableBrands] = useState<string[]>([])
  const [showImportDialog, setShowImportDialog] = useState(false)
  const { toast } = useToast()

  // Form state for new product
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: "",
    originalPrice: "",
    category: "",
    brand: "",
    stockCount: "",
    images: [""],
    features: [""],
    compatibility: [""],
    weight: "",
    dimensions: {
      length: "",
      width: "",
      height: ""
    },
    // SEO Fields
    searchKeywords: "",
    seoName: "",
    seoTitleTag: "",
    seoMetaKeywords: "",
    seoMetaDescription: ""
  })

  // Form state for editing product
  const [editProduct, setEditProduct] = useState({
    name: "",
    description: "",
    price: "",
    originalPrice: "",
    category: "",
    brand: "",
    stockCount: "",
    images: [""],
    features: [""],
    compatibility: [""],
    weight: "",
    dimensions: {
      length: "",
      width: "",
      height: ""
    },
    // SEO Fields
    searchKeywords: "",
    seoName: "",
    seoTitleTag: "",
    seoMetaKeywords: "",
    seoMetaDescription: ""
  })

  // Fetch products with pagination, sorting, and filtering
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        console.log("Fetching products with pagination, sorting, and filtering...", {
          page: currentPage,
          limit: itemsPerPage,
          sortBy,
          sortOrder,
          search: searchTerm,
          category: categoryFilter,
          stockFilter
        })

        // Build filter object
        const filters: any = {
          page: currentPage,
          limit: itemsPerPage,
          sortBy,
          sortOrder
        }

        if (searchTerm) filters.search = searchTerm
        if (categoryFilter !== "all") filters.category = categoryFilter

        const [productsResponse, categoriesResponse, brandsResponse] = await Promise.all([
          getProducts(filters),
          getProductCategories(),
          getProductBrands()
        ])

        const productsData = productsResponse.products || []
        setProducts(productsData)
        setTotalPages(productsResponse.totalPages || 1)
        setTotalProducts(productsResponse.totalProducts || 0)

        const categories = categoriesResponse.categories?.map((cat: any) => cat.name) || []
        setAvailableCategories(categories)

        const brands = brandsResponse.brands?.map((brand: any) => brand.name) || []
        setAvailableBrands(brands)

        console.log("Loaded", productsData.length, "products, total pages:", productsResponse.totalPages)
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentPage, itemsPerPage, sortBy, sortOrder, searchTerm, categoryFilter, toast])

  const handleViewProduct = (product: Product) => {
    console.log("Viewing product:", product.name)
    setSelectedProduct(product)
    setShowViewDialog(true)
  }

  const handleEditProduct = (product: Product) => {
    console.log("Editing product:", product.name)
    setSelectedProduct(product)
    setEditProduct({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      originalPrice: product.originalPrice?.toString() || "",
      category: product.category,
      brand: product.brand,
      stockCount: product.stockCount.toString(),
      images: product.images.length > 0 ? product.images : [""],
      features: product.features.length > 0 ? product.features : [""],
      compatibility: product.compatibility.length > 0 ? product.compatibility : [""],
      weight: product.weight?.toString() || "",
      dimensions: {
        length: product.dimensions?.length?.toString() || "",
        width: product.dimensions?.width?.toString() || "",
        height: product.dimensions?.height?.toString() || ""
      },
      // SEO Fields
      searchKeywords: product.searchKeywords || "",
      seoName: product.seoName || "",
      seoTitleTag: product.seoTitleTag || "",
      seoMetaKeywords: product.seoMetaKeywords || "",
      seoMetaDescription: product.seoMetaDescription || ""
    })
    setShowEditDialog(true)
  }

  const handleDeleteProduct = (product: Product) => {
    console.log("Preparing to delete product:", product.name)
    setSelectedProduct(product)
    setShowDeleteDialog(true)
  }

  const handleAddProduct = async () => {
    try {
      setIsCreating(true)
      console.log("Creating new product:", newProduct)

      // Validate required fields
      if (!newProduct.name || !newProduct.description || !newProduct.price ||
          !newProduct.category || !newProduct.brand || !newProduct.stockCount) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive"
        })
        return
      }

      // Prepare product data
      const productData = {
        name: newProduct.name,
        description: newProduct.description,
        price: parseFloat(newProduct.price),
        originalPrice: newProduct.originalPrice ? parseFloat(newProduct.originalPrice) : undefined,
        category: newProduct.category,
        brand: newProduct.brand,
        stockCount: parseInt(newProduct.stockCount),
        images: newProduct.images.filter(img => img.trim() !== ""),
        features: newProduct.features.filter(feature => feature.trim() !== ""),
        compatibility: newProduct.compatibility.filter(comp => comp.trim() !== ""),
        weight: newProduct.weight ? parseFloat(newProduct.weight) : undefined,
        dimensions: (newProduct.dimensions.length || newProduct.dimensions.width || newProduct.dimensions.height) ? {
          length: newProduct.dimensions.length ? parseFloat(newProduct.dimensions.length) : undefined,
          width: newProduct.dimensions.width ? parseFloat(newProduct.dimensions.width) : undefined,
          height: newProduct.dimensions.height ? parseFloat(newProduct.dimensions.height) : undefined
        } : undefined,
        // SEO Fields
        searchKeywords: newProduct.searchKeywords || undefined,
        seoName: newProduct.seoName || undefined,
        seoTitleTag: newProduct.seoTitleTag || undefined,
        seoMetaKeywords: newProduct.seoMetaKeywords || undefined,
        seoMetaDescription: newProduct.seoMetaDescription || undefined
      }

      const response = await createProduct(productData)

      if (response.success) {
        toast({
          title: "Success",
          description: response.message || "Product created successfully"
        })

        // Reset to first page to see the new product
        setCurrentPage(1)

        // Reset form and close dialog
        resetAddForm()
        setShowAddDialog(false)
      }
    } catch (error) {
      console.error("Error creating product:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create product",
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateProduct = async () => {
    if (!selectedProduct) return

    try {
      setIsUpdating(true)
      console.log("Updating product:", selectedProduct._id, editProduct)

      // Validate required fields
      if (!editProduct.name || !editProduct.description || !editProduct.price ||
          !editProduct.category || !editProduct.brand || !editProduct.stockCount) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive"
        })
        return
      }

      // Prepare product data
      const productData = {
        name: editProduct.name,
        description: editProduct.description,
        price: parseFloat(editProduct.price),
        originalPrice: editProduct.originalPrice ? parseFloat(editProduct.originalPrice) : undefined,
        category: editProduct.category,
        brand: editProduct.brand,
        stockCount: parseInt(editProduct.stockCount),
        images: editProduct.images.filter(img => img.trim() !== ""),
        features: editProduct.features.filter(feature => feature.trim() !== ""),
        compatibility: editProduct.compatibility.filter(comp => comp.trim() !== ""),
        weight: editProduct.weight ? parseFloat(editProduct.weight) : undefined,
        dimensions: (editProduct.dimensions.length || editProduct.dimensions.width || editProduct.dimensions.height) ? {
          length: editProduct.dimensions.length ? parseFloat(editProduct.dimensions.length) : undefined,
          width: editProduct.dimensions.width ? parseFloat(editProduct.dimensions.width) : undefined,
          height: editProduct.dimensions.height ? parseFloat(editProduct.dimensions.height) : undefined
        } : undefined,
        // SEO Fields
        searchKeywords: editProduct.searchKeywords || undefined,
        seoName: editProduct.seoName || undefined,
        seoTitleTag: editProduct.seoTitleTag || undefined,
        seoMetaKeywords: editProduct.seoMetaKeywords || undefined,
        seoMetaDescription: editProduct.seoMetaDescription || undefined
      }

      const response = await updateProduct(selectedProduct._id, productData)

      if (response.success) {
        toast({
          title: "Success",
          description: response.message || "Product updated successfully"
        })

        // Refresh current page
        setCurrentPage(currentPage)

        // Close dialog and reset
        setShowEditDialog(false)
        setSelectedProduct(null)
        resetEditForm()
      }
    } catch (error) {
      console.error("Error updating product:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update product",
        variant: "destructive"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const confirmDeleteProduct = async () => {
    if (!selectedProduct) return

    try {
      setIsDeleting(true)
      console.log("Deleting product:", selectedProduct._id)

      const response = await deleteProduct(selectedProduct._id)

      if (response.success) {
        toast({
          title: "Success",
          description: response.message || "Product deleted successfully"
        })

        // Refresh current page (or go back to first page if current is now empty)
        if (products.length === 1 && currentPage > 1) {
          setCurrentPage(currentPage - 1)
        } else {
          setCurrentPage(currentPage)
        }

        // Close dialog and reset
        setShowDeleteDialog(false)
        setSelectedProduct(null)
      }
    } catch (error) {
      console.error("Error deleting product:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete product",
        variant: "destructive"
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const resetAddForm = () => {
    setNewProduct({
      name: "",
      description: "",
      price: "",
      originalPrice: "",
      category: "",
      brand: "",
      stockCount: "",
      images: [""],
      features: [""],
      compatibility: [""],
      weight: "",
      dimensions: {
        length: "",
        width: "",
        height: ""
      },
      // SEO Fields
      searchKeywords: "",
      seoName: "",
      seoTitleTag: "",
      seoMetaKeywords: "",
      seoMetaDescription: ""
    })
  }

  const resetEditForm = () => {
    setEditProduct({
      name: "",
      description: "",
      price: "",
      originalPrice: "",
      category: "",
      brand: "",
      stockCount: "",
      images: [""],
      features: [""],
      compatibility: [""],
      weight: "",
      dimensions: {
        length: "",
        width: "",
        height: ""
      },
      // SEO Fields
      searchKeywords: "",
      seoName: "",
      seoTitleTag: "",
      seoMetaKeywords: "",
      seoMetaDescription: ""
    })
  }

  const addArrayField = (field: 'images' | 'features' | 'compatibility', isEdit = false) => {
    if (isEdit) {
      setEditProduct(prev => ({
        ...prev,
        [field]: [...prev[field], ""]
      }))
    } else {
      setNewProduct(prev => ({
        ...prev,
        [field]: [...prev[field], ""]
      }))
    }
  }

  const removeArrayField = (field: 'images' | 'features' | 'compatibility', index: number, isEdit = false) => {
    if (isEdit) {
      setEditProduct(prev => ({
        ...prev,
        [field]: prev[field].filter((_, i) => i !== index)
      }))
    } else {
      setNewProduct(prev => ({
        ...prev,
        [field]: prev[field].filter((_, i) => i !== index)
      }))
    }
  }

  const updateArrayField = (field: 'images' | 'features' | 'compatibility', index: number, value: string, isEdit = false) => {
    if (isEdit) {
      setEditProduct(prev => ({
        ...prev,
        [field]: prev[field].map((item, i) => i === index ? value : item)
      }))
    } else {
      setNewProduct(prev => ({
        ...prev,
        [field]: prev[field].map((item, i) => i === index ? value : item)
      }))
    }
  }

  // Handle column header sorting
  const handleColumnSort = (columnName: string) => {
    console.log("Sorting by column:", columnName)
    if (sortBy === columnName) {
      // Toggle sort order if same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // Change sort column and reset to ascending
      setSortBy(columnName)
      setSortOrder('asc')
    }
    // Reset to first page when sorting changes
    setCurrentPage(1)
  }

  // Build sortable column header component
  const SortableColumnHeader = ({ label, columnName }: { label: string; columnName: string }) => {
    const isActive = sortBy === columnName
    return (
      <button
        onClick={() => handleColumnSort(columnName)}
        className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer"
      >
        {label}
        <ArrowUpDown
          className={`h-4 w-4 ${isActive ? 'text-primary font-bold' : 'text-muted-foreground'}`}
        />
      </button>
    )
  }

  const categories = availableCategories
  const totalRevenue = products.reduce((sum, product) => sum + (product.price * (product.stockCount || 0)), 0)
  const lowStockProducts = products.filter(p => p.inStock && p.stockCount <= 5).length
  const outOfStockProducts = products.filter(p => !p.inStock || p.stockCount === 0).length

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
            <ShoppingCart className="h-8 w-8" />
            Web Shop Management
          </h1>
          <p className="text-muted-foreground">
            Manage products, inventory, and shop settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Products
            </CardTitle>
            <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {products.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Inventory Value
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              ${totalRevenue.toFixed(0)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Low Stock
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {lowStockProducts}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
              Out of Stock
            </CardTitle>
            <Package className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900 dark:text-red-100">
              {outOfStockProducts}
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
                  placeholder="Search products by name, brand, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
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

              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock</SelectItem>
                  <SelectItem value="in-stock">In Stock</SelectItem>
                  <SelectItem value="low-stock">Low Stock</SelectItem>
                  <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Inventory</CardTitle>
          <CardDescription>
            Manage your product catalog and inventory levels ({totalProducts} total products)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortableColumnHeader label="Product" columnName="name" /></TableHead>
                <TableHead><SortableColumnHeader label="Category" columnName="category" /></TableHead>
                <TableHead><SortableColumnHeader label="Price" columnName="price" /></TableHead>
                <TableHead><SortableColumnHeader label="Stock" columnName="stockCount" /></TableHead>
                <TableHead><SortableColumnHeader label="Rating" columnName="rating" /></TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No products found</p>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product._id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-12 h-12 rounded object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder-product.png"
                          }}
                        />
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.brand}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">${product.price.toFixed(2)}</p>
                        {product.originalPrice && (
                          <p className="text-sm text-muted-foreground line-through">
                            ${product.originalPrice.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${
                          product.stockCount <= 5 ? 'text-red-600' :
                          product.stockCount <= 10 ? 'text-orange-600' :
                          'text-green-600'
                        }`}>
                          {product.stockCount}
                        </span>
                        {product.stockCount <= 5 && (
                          <Badge variant="destructive" className="text-xs">
                            Low
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm">{product.rating}</span>
                        <span className="text-xs text-muted-foreground">
                          ({product.reviewCount})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.inStock ? "default" : "destructive"}>
                        {product.inStock ? "In Stock" : "Out of Stock"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewProduct(product)}
                          title="View Product"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditProduct(product)}
                          title="Edit Product"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteProduct(product)}
                          title="Delete Product"
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
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Items per page:</span>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                setItemsPerPage(parseInt(value))
                setCurrentPage(1)
              }}>
                <SelectTrigger className="w-20">
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

            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} ({totalProducts} total products)
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || loading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Product Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Create a new product for your web shop inventory
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter product name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand">Brand *</Label>
                <Select
                  value={newProduct.brand}
                  onValueChange={(value) => setNewProduct(prev => ({ ...prev, brand: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBrands.map(brand => (
                      <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                    ))}
                    <SelectItem value="other">Other (Custom)</SelectItem>
                  </SelectContent>
                </Select>
                {newProduct.brand === "other" && (
                  <Input
                    placeholder="Enter custom brand"
                    onChange={(e) => setNewProduct(prev => ({ ...prev, brand: e.target.value }))}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={newProduct.category}
                  onValueChange={(value) => setNewProduct(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Accessories">Accessories</SelectItem>
                    <SelectItem value="Cases">Cases</SelectItem>
                    <SelectItem value="Chargers">Chargers</SelectItem>
                    <SelectItem value="Cables">Cables</SelectItem>
                    <SelectItem value="Screen Protectors">Screen Protectors</SelectItem>
                    <SelectItem value="Batteries">Batteries</SelectItem>
                    <SelectItem value="Tools">Tools</SelectItem>
                    <SelectItem value="Parts">Parts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stockCount">Stock Count *</Label>
                <Input
                  id="stockCount"
                  type="number"
                  min="0"
                  value={newProduct.stockCount}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, stockCount: e.target.value }))}
                  placeholder="Enter stock quantity"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="Enter price"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="originalPrice">Original Price</Label>
                <Input
                  id="originalPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newProduct.originalPrice}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, originalPrice: e.target.value }))}
                  placeholder="Enter original price (optional)"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={newProduct.description}
                onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter product description"
                rows={3}
              />
            </div>

            {/* Images */}
            <div className="space-y-2">
              <Label>Product Images</Label>
              {newProduct.images.map((image, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={image}
                    onChange={(e) => updateArrayField('images', index, e.target.value, false)}
                    placeholder="Enter image URL"
                    className="flex-1"
                  />
                  {newProduct.images.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayField('images', index, false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayField('images', false)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Image
              </Button>
            </div>

            {/* Features */}
            <div className="space-y-2">
              <Label>Features</Label>
              {newProduct.features.map((feature, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={feature}
                    onChange={(e) => updateArrayField('features', index, e.target.value, false)}
                    placeholder="Enter feature"
                    className="flex-1"
                  />
                  {newProduct.features.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayField('features', index, false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayField('features', false)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Feature
              </Button>
            </div>

            {/* Compatibility */}
            <div className="space-y-2">
              <Label>Compatibility</Label>
              {newProduct.compatibility.map((comp, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={comp}
                    onChange={(e) => updateArrayField('compatibility', index, e.target.value, false)}
                    placeholder="Enter compatible device"
                    className="flex-1"
                  />
                  {newProduct.compatibility.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayField('compatibility', index, false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayField('compatibility', false)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Compatibility
              </Button>
            </div>

            {/* Physical Properties */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (g)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  min="0"
                  value={newProduct.weight}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, weight: e.target.value }))}
                  placeholder="Weight"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="length">Length (cm)</Label>
                <Input
                  id="length"
                  type="number"
                  step="0.1"
                  min="0"
                  value={newProduct.dimensions.length}
                  onChange={(e) => setNewProduct(prev => ({
                    ...prev,
                    dimensions: { ...prev.dimensions, length: e.target.value }
                  }))}
                  placeholder="Length"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="width">Width (cm)</Label>
                <Input
                  id="width"
                  type="number"
                  step="0.1"
                  min="0"
                  value={newProduct.dimensions.width}
                  onChange={(e) => setNewProduct(prev => ({
                    ...prev,
                    dimensions: { ...prev.dimensions, width: e.target.value }
                  }))}
                  placeholder="Width"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  min="0"
                  value={newProduct.dimensions.height}
                  onChange={(e) => setNewProduct(prev => ({
                    ...prev,
                    dimensions: { ...prev.dimensions, height: e.target.value }
                  }))}
                  placeholder="Height"
                />
              </div>
            </div>

            {/* SEO Fields */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">SEO Optimization</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="searchKeywords">Search Keywords (Suchbegriffe)</Label>
                  <Textarea
                    id="searchKeywords"
                    value={newProduct.searchKeywords}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, searchKeywords: e.target.value }))}
                    placeholder="Enter search keywords for product discovery"
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">Max 500 characters. Used for internal search functionality.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seoName">SEO Name (Suchmaschinenname)</Label>
                  <Input
                    id="seoName"
                    value={newProduct.seoName}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, seoName: e.target.value }))}
                    placeholder="Name optimized for search engines"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground">Max 200 characters. How the product appears in search results.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seoTitleTag">SEO Title Tag</Label>
                  <Input
                    id="seoTitleTag"
                    value={newProduct.seoTitleTag}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, seoTitleTag: e.target.value }))}
                    placeholder="Page title (50-60 characters recommended)"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground">Max 60 characters. Displays in browser tab and search results.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seoMetaKeywords">SEO Meta Keywords</Label>
                  <Textarea
                    id="seoMetaKeywords"
                    value={newProduct.seoMetaKeywords}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, seoMetaKeywords: e.target.value }))}
                    placeholder="Comma-separated keywords for search engines"
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">Max 500 characters. Comma-separated relevant keywords.</p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="seoMetaDescription">SEO Meta Description</Label>
                  <Textarea
                    id="seoMetaDescription"
                    value={newProduct.seoMetaDescription}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, seoMetaDescription: e.target.value }))}
                    placeholder="Meta description (150-160 characters recommended)"
                    rows={2}
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground">Max 160 characters. Displays under title in search results.</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetAddForm()
                setShowAddDialog(false)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddProduct} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update the product information
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Product Name *</Label>
                <Input
                  id="edit-name"
                  value={editProduct.name}
                  onChange={(e) => setEditProduct(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter product name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-brand">Brand *</Label>
                <Select
                  value={editProduct.brand}
                  onValueChange={(value) => setEditProduct(prev => ({ ...prev, brand: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBrands.map(brand => (
                      <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                    ))}
                    <SelectItem value="other">Other (Custom)</SelectItem>
                  </SelectContent>
                </Select>
                {editProduct.brand === "other" && (
                  <Input
                    placeholder="Enter custom brand"
                    onChange={(e) => setEditProduct(prev => ({ ...prev, brand: e.target.value }))}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-category">Category *</Label>
                <Select
                  value={editProduct.category}
                  onValueChange={(value) => setEditProduct(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Accessories">Accessories</SelectItem>
                    <SelectItem value="Cases">Cases</SelectItem>
                    <SelectItem value="Chargers">Chargers</SelectItem>
                    <SelectItem value="Cables">Cables</SelectItem>
                    <SelectItem value="Screen Protectors">Screen Protectors</SelectItem>
                    <SelectItem value="Batteries">Batteries</SelectItem>
                    <SelectItem value="Tools">Tools</SelectItem>
                    <SelectItem value="Parts">Parts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-stockCount">Stock Count *</Label>
                <Input
                  id="edit-stockCount"
                  type="number"
                  min="0"
                  value={editProduct.stockCount}
                  onChange={(e) => setEditProduct(prev => ({ ...prev, stockCount: e.target.value }))}
                  placeholder="Enter stock quantity"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-price">Price *</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editProduct.price}
                  onChange={(e) => setEditProduct(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="Enter price"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-originalPrice">Original Price</Label>
                <Input
                  id="edit-originalPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editProduct.originalPrice}
                  onChange={(e) => setEditProduct(prev => ({ ...prev, originalPrice: e.target.value }))}
                  placeholder="Enter original price (optional)"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description *</Label>
              <Textarea
                id="edit-description"
                value={editProduct.description}
                onChange={(e) => setEditProduct(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter product description"
                rows={3}
              />
            </div>

            {/* Images */}
            <div className="space-y-2">
              <Label>Product Images</Label>
              {editProduct.images.map((image, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={image}
                    onChange={(e) => updateArrayField('images', index, e.target.value, true)}
                    placeholder="Enter image URL"
                    className="flex-1"
                  />
                  {editProduct.images.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayField('images', index, true)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayField('images', true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Image
              </Button>
            </div>

            {/* Features */}
            <div className="space-y-2">
              <Label>Features</Label>
              {editProduct.features.map((feature, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={feature}
                    onChange={(e) => updateArrayField('features', index, e.target.value, true)}
                    placeholder="Enter feature"
                    className="flex-1"
                  />
                  {editProduct.features.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayField('features', index, true)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayField('features', true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Feature
              </Button>
            </div>

            {/* Compatibility */}
            <div className="space-y-2">
              <Label>Compatibility</Label>
              {editProduct.compatibility.map((comp, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={comp}
                    onChange={(e) => updateArrayField('compatibility', index, e.target.value, true)}
                    placeholder="Enter compatible device"
                    className="flex-1"
                  />
                  {editProduct.compatibility.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayField('compatibility', index, true)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayField('compatibility', true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Compatibility
              </Button>
            </div>

            {/* Physical Properties */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-weight">Weight (g)</Label>
                <Input
                  id="edit-weight"
                  type="number"
                  step="0.1"
                  min="0"
                  value={editProduct.weight}
                  onChange={(e) => setEditProduct(prev => ({ ...prev, weight: e.target.value }))}
                  placeholder="Weight"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-length">Length (cm)</Label>
                <Input
                  id="edit-length"
                  type="number"
                  step="0.1"
                  min="0"
                  value={editProduct.dimensions.length}
                  onChange={(e) => setEditProduct(prev => ({
                    ...prev,
                    dimensions: { ...prev.dimensions, length: e.target.value }
                  }))}
                  placeholder="Length"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-width">Width (cm)</Label>
                <Input
                  id="edit-width"
                  type="number"
                  step="0.1"
                  min="0"
                  value={editProduct.dimensions.width}
                  onChange={(e) => setEditProduct(prev => ({
                    ...prev,
                    dimensions: { ...prev.dimensions, width: e.target.value }
                  }))}
                  placeholder="Width"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-height">Height (cm)</Label>
                <Input
                  id="edit-height"
                  type="number"
                  step="0.1"
                  min="0"
                  value={editProduct.dimensions.height}
                  onChange={(e) => setEditProduct(prev => ({
                    ...prev,
                    dimensions: { ...prev.dimensions, height: e.target.value }
                  }))}
                  placeholder="Height"
                />
              </div>
            </div>

            {/* SEO Fields */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">SEO Optimization</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-searchKeywords">Search Keywords (Suchbegriffe)</Label>
                  <Textarea
                    id="edit-searchKeywords"
                    value={editProduct.searchKeywords}
                    onChange={(e) => setEditProduct(prev => ({ ...prev, searchKeywords: e.target.value }))}
                    placeholder="Enter search keywords for product discovery"
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">Max 500 characters. Used for internal search functionality.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-seoName">SEO Name (Suchmaschinenname)</Label>
                  <Input
                    id="edit-seoName"
                    value={editProduct.seoName}
                    onChange={(e) => setEditProduct(prev => ({ ...prev, seoName: e.target.value }))}
                    placeholder="Name optimized for search engines"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground">Max 200 characters. How the product appears in search results.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-seoTitleTag">SEO Title Tag</Label>
                  <Input
                    id="edit-seoTitleTag"
                    value={editProduct.seoTitleTag}
                    onChange={(e) => setEditProduct(prev => ({ ...prev, seoTitleTag: e.target.value }))}
                    placeholder="Page title (50-60 characters recommended)"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground">Max 60 characters. Displays in browser tab and search results.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-seoMetaKeywords">SEO Meta Keywords</Label>
                  <Textarea
                    id="edit-seoMetaKeywords"
                    value={editProduct.seoMetaKeywords}
                    onChange={(e) => setEditProduct(prev => ({ ...prev, seoMetaKeywords: e.target.value }))}
                    placeholder="Comma-separated keywords for search engines"
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">Max 500 characters. Comma-separated relevant keywords.</p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit-seoMetaDescription">SEO Meta Description</Label>
                  <Textarea
                    id="edit-seoMetaDescription"
                    value={editProduct.seoMetaDescription}
                    onChange={(e) => setEditProduct(prev => ({ ...prev, seoMetaDescription: e.target.value }))}
                    placeholder="Meta description (150-160 characters recommended)"
                    rows={2}
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground">Max 160 characters. Displays under title in search results.</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false)
                setSelectedProduct(null)
                resetEditForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateProduct} disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Update Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Product Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
            <DialogDescription>
              View complete product information
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-6 py-4">
              {/* Product Images */}
              <div className="space-y-2">
                <Label>Product Images</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {selectedProduct.images.map((image, index) => (
                    <img
                      key={index}
                      src={image}
                      alt={`${selectedProduct.name} ${index + 1}`}
                      className="w-full h-24 object-cover rounded border"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder-product.png"
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product Name</Label>
                  <p className="text-sm font-medium">{selectedProduct.name}</p>
                </div>
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <p className="text-sm">{selectedProduct.brand}</p>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Badge variant="outline">{selectedProduct.category}</Badge>
                </div>
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <p className="text-sm font-mono">{selectedProduct.sku}</p>
                </div>
                <div className="space-y-2">
                  <Label>Price</Label>
                  <div>
                    <p className="text-sm font-medium">${selectedProduct.price.toFixed(2)}</p>
                    {selectedProduct.originalPrice && (
                      <p className="text-sm text-muted-foreground line-through">
                        ${selectedProduct.originalPrice.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Stock</Label>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${
                      selectedProduct.stockCount <= 5 ? 'text-red-600' :
                      selectedProduct.stockCount <= 10 ? 'text-orange-600' :
                      'text-green-600'
                    }`}>
                      {selectedProduct.stockCount} units
                    </span>
                    <Badge variant={selectedProduct.inStock ? "default" : "destructive"}>
                      {selectedProduct.inStock ? "In Stock" : "Out of Stock"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Description</Label>
                <p className="text-sm">{selectedProduct.description}</p>
              </div>

              {/* Features */}
              {selectedProduct.features.length > 0 && (
                <div className="space-y-2">
                  <Label>Features</Label>
                  <ul className="text-sm space-y-1">
                    {selectedProduct.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-current rounded-full"></span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Compatibility */}
              {selectedProduct.compatibility.length > 0 && (
                <div className="space-y-2">
                  <Label>Compatibility</Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedProduct.compatibility.map((comp, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {comp}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Physical Properties */}
              {(selectedProduct.weight || selectedProduct.dimensions) && (
                <div className="space-y-2">
                  <Label>Physical Properties</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {selectedProduct.weight && (
                      <div>
                        <p className="text-muted-foreground">Weight</p>
                        <p className="font-medium">{selectedProduct.weight}g</p>
                      </div>
                    )}
                    {selectedProduct.dimensions?.length && (
                      <div>
                        <p className="text-muted-foreground">Length</p>
                        <p className="font-medium">{selectedProduct.dimensions.length}cm</p>
                      </div>
                    )}
                    {selectedProduct.dimensions?.width && (
                      <div>
                        <p className="text-muted-foreground">Width</p>
                        <p className="font-medium">{selectedProduct.dimensions.width}cm</p>
                      </div>
                    )}
                    {selectedProduct.dimensions?.height && (
                      <div>
                        <p className="text-muted-foreground">Height</p>
                        <p className="font-medium">{selectedProduct.dimensions.height}cm</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Rating and Reviews */}
              <div className="space-y-2">
                <Label>Rating & Reviews</Label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium">{selectedProduct.rating}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ({selectedProduct.reviewCount} reviews)
                  </span>
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {new Date(selectedProduct.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Updated</p>
                  <p className="font-medium">
                    {new Date(selectedProduct.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowViewDialog(false)
                setSelectedProduct(null)
              }}
            >
              Close
            </Button>
            {selectedProduct && (
              <Button
                onClick={() => {
                  setShowViewDialog(false)
                  handleEditProduct(selectedProduct)
                }}
              >
                Edit Product
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedProduct?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDeleteDialog(false)
                setSelectedProduct(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProduct}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Import Dialog */}
      <ProductCSVImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportComplete={() => {
          // Refresh the products list after import
          setCurrentPage(1);
          const fetchData = async () => {
            try {
              setLoading(true);
              const filters: any = {
                page: 1,
                limit: itemsPerPage,
                sortBy,
                sortOrder
              };
              if (searchTerm) filters.search = searchTerm;
              if (categoryFilter !== "all") filters.category = categoryFilter;
              const productsResponse = await getProducts(filters);
              setProducts(productsResponse.products || []);
              setTotalPages(productsResponse.totalPages || 1);
              setTotalProducts(productsResponse.totalProducts || 0);
            } catch (error) {
              console.error("Error refreshing products:", error);
            } finally {
              setLoading(false);
            }
          };
          fetchData();
        }}
      />
    </div>
  )
}