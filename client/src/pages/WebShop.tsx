import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/hooks/useToast"
import { getProducts, addToCart, Product } from "@/api/shop"
import {
  ShoppingCart,
  Search,
  Filter,
  Star,
  Plus,
  Heart,
  Grid3X3,
  List,
  Package,
  Sparkles,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  DollarSign
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export function WebShop() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [paginatedProducts, setPaginatedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [brandFilter, setBrandFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000])
  const [maxPrice, setMaxPrice] = useState(1000)
  const [sortBy, setSortBy] = useState("name")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [addingToCart, setAddingToCart] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(12)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        console.log("Fetching products...")
        const response = await getProducts()
        const productsData = (response as any).products || []
        setProducts(productsData)
        setFilteredProducts(productsData)

        // Calculate max price from products
        if (productsData.length > 0) {
          const prices = productsData.map((p: Product) => p.price)
          const maxPriceValue = Math.ceil(Math.max(...prices))
          setMaxPrice(maxPriceValue)
          setPriceRange([0, maxPriceValue])
        }
      } catch (error) {
        console.error("Error fetching products:", error)
        toast({
          title: "Error",
          description: "Failed to load products",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [toast])

  useEffect(() => {
    let filtered = products

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by category
    if (categoryFilter !== "all") {
      filtered = filtered.filter(product => product.category === categoryFilter)
    }

    // Filter by brand
    if (brandFilter !== "all") {
      filtered = filtered.filter(product => product.brand === brandFilter)
    }

    // Filter by stock availability
    if (stockFilter === "inStock") {
      filtered = filtered.filter(product => product.inStock)
    } else if (stockFilter === "lowStock") {
      filtered = filtered.filter(product => product.inStock && product.stockCount <= 5)
    }

    // Filter by price range
    filtered = filtered.filter(product =>
      product.price >= priceRange[0] && product.price <= priceRange[1]
    )

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return a.price - b.price
        case "price-high":
          return b.price - a.price
        case "rating":
          return b.rating - a.rating
        case "name":
        default:
          return a.name.localeCompare(b.name)
      }
    })

    setFilteredProducts(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }, [products, searchTerm, categoryFilter, brandFilter, stockFilter, priceRange, sortBy])

  // Pagination logic
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    setPaginatedProducts(filteredProducts.slice(startIndex, endIndex))
  }, [filteredProducts, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)

  const handleAddToCart = async (productId: string) => {
    try {
      setAddingToCart(productId)
      console.log("Adding product to cart:", productId)

      // Find the product to pass its data for guest cart
      const product = products.find(p => p._id === productId)
      await addToCart({ productId, quantity: 1, product })

      // Dispatch cart update event
      window.dispatchEvent(new Event('cartUpdated'))

      toast({
        title: "Success!",
        description: "Product added to cart",
      })
    } catch (error: any) {
      console.error("Error adding to cart:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to add product to cart",
        variant: "destructive"
      })
    } finally {
      setAddingToCart(null)
    }
  }

  const handleQuickView = (product: Product) => {
    setSelectedProduct(product)
    setQuickViewOpen(true)
  }

  const resetFilters = () => {
    setSearchTerm("")
    setCategoryFilter("all")
    setBrandFilter("all")
    setStockFilter("all")
    setPriceRange([0, maxPrice])
    setSortBy("name")
  }

  const categories = [...new Set(products.map(p => p.category))]
  const brands = [...new Set(products.map(p => p.brand))]

  if (loading) {
    return (
      <div
        className="min-h-screen bg-cover bg-center bg-fixed relative"
        style={{
          backgroundImage: "url('https://www.mcrepair.de/bilder/home/banner/fakten_bg.jpg')"
        }}
      >
        {/* Dark overlay for better readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/60"></div>

        <div className="relative z-10 container mx-auto px-4 py-8 space-y-8">
          {/* Header skeleton */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-3 flex-1">
              <div className="h-10 w-64 bg-white/20 backdrop-blur-sm rounded-lg animate-pulse"></div>
              <div className="h-5 w-96 bg-white/20 backdrop-blur-sm rounded animate-pulse"></div>
            </div>
            <div className="h-10 w-32 bg-yellow-500/30 backdrop-blur-sm rounded-lg animate-pulse"></div>
          </div>

          {/* Filters skeleton */}
          <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 h-10 bg-gray-200 rounded animate-pulse"></div>
                <div className="flex gap-2">
                  <div className="h-10 w-40 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-10 w-40 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-10 w-20 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Products grid skeleton */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="border-0 shadow-2xl bg-white/95 backdrop-blur-md overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
                <div className="h-48 bg-gray-200 animate-pulse"></div>
                <CardHeader>
                  <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed relative"
      style={{
        backgroundImage: "url('https://www.mcrepair.de/bilder/home/banner/fakten_bg.jpg')"
      }}
    >
      {/* Dark overlay with gradient for better content visibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/60"></div>

      {/* Content wrapper with relative positioning */}
      <div className="relative z-10 container mx-auto px-4 py-8 space-y-8">
        {/* Header with enhanced contrast */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2">
            <h1 className="text-5xl font-bold text-white drop-shadow-2xl">
              Web Shop
            </h1>
            <p className="text-white/90 flex items-center gap-2 drop-shadow-lg text-lg">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              Find premium accessories and parts for your devices
            </p>
          </div>
          <Button
            asChild
            className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-semibold shadow-2xl hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-110 border-2 border-yellow-300"
          >
            <Link to="/cart">
              <ShoppingCart className="h-5 w-5 mr-2" />
              View Cart
            </Link>
          </Button>
        </div>

        {/* Filters and Search Card with enhanced glass effect */}
        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md hover:shadow-yellow-500/20 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 shadow-lg"></div>
          <CardContent className="pt-6">
            {/* Search and Quick Actions */}
            <div className="flex flex-col lg:flex-row gap-4 mb-4">
              <div className="flex-1">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500 group-hover:text-yellow-600 transition-colors duration-200" />
                  <Input
                    placeholder="Search products by name, brand, or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-gray-300 focus:border-yellow-500 focus:ring-yellow-500 transition-all duration-200 bg-white shadow-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="border-gray-300 hover:border-yellow-500 hover:bg-yellow-50 transition-colors duration-200"
                >
                  <Filter className="h-4 w-4 mr-2 text-yellow-600" />
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </Button>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40 border-gray-300 hover:border-yellow-500 transition-colors duration-200 bg-white shadow-sm">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex border rounded-md border-gray-300 bg-white shadow-sm">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className={`rounded-r-none ${viewMode === "grid" ? "bg-yellow-500 hover:bg-yellow-600 text-white" : ""}`}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className={`rounded-l-none ${viewMode === "list" ? "bg-yellow-500 hover:bg-yellow-600 text-white" : ""}`}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
              <div className="pt-4 border-t border-gray-200 space-y-6 animate-slideDown">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Category Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">Category</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="border-gray-300 hover:border-yellow-500 transition-colors duration-200 bg-white shadow-sm">
                        <SelectValue placeholder="Category" />
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
                  </div>

                  {/* Brand Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">Brand</Label>
                    <Select value={brandFilter} onValueChange={setBrandFilter}>
                      <SelectTrigger className="border-gray-300 hover:border-yellow-500 transition-colors duration-200 bg-white shadow-sm">
                        <SelectValue placeholder="Brand" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Brands</SelectItem>
                        {brands.map(brand => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Stock Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">Availability</Label>
                    <Select value={stockFilter} onValueChange={setStockFilter}>
                      <SelectTrigger className="border-gray-300 hover:border-yellow-500 transition-colors duration-200 bg-white shadow-sm">
                        <SelectValue placeholder="Stock Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Products</SelectItem>
                        <SelectItem value="inStock">In Stock</SelectItem>
                        <SelectItem value="lowStock">Low Stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Price Range Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-yellow-600" />
                      Price Range
                    </Label>
                    <div className="pt-2">
                      <Slider
                        min={0}
                        max={maxPrice}
                        step={10}
                        value={priceRange}
                        onValueChange={(value) => setPriceRange(value as [number, number])}
                        className="mb-2"
                      />
                      <div className="flex justify-between text-sm text-gray-600 font-medium">
                        <span>${priceRange[0]}</span>
                        <span>${priceRange[1]}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active Filters and Reset */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex flex-wrap gap-2">
                    {categoryFilter !== "all" && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                        Category: {categoryFilter}
                        <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setCategoryFilter("all")} />
                      </Badge>
                    )}
                    {brandFilter !== "all" && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                        Brand: {brandFilter}
                        <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setBrandFilter("all")} />
                      </Badge>
                    )}
                    {stockFilter !== "all" && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                        Stock: {stockFilter === "inStock" ? "In Stock" : "Low Stock"}
                        <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setStockFilter("all")} />
                      </Badge>
                    )}
                    {(priceRange[0] !== 0 || priceRange[1] !== maxPrice) && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                        Price: ${priceRange[0]} - ${priceRange[1]}
                        <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setPriceRange([0, maxPrice])} />
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="text-gray-600 hover:text-yellow-600 hover:bg-yellow-50"
                  >
                    Reset All
                  </Button>
                </div>

                {/* Results Count */}
                <div className="text-sm text-gray-600 font-medium">
                  Showing {paginatedProducts.length} of {filteredProducts.length} products
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products Grid/List with enhanced cards */}
        <div className={viewMode === "grid"
          ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          : "space-y-4"
        }>
          {paginatedProducts.length === 0 ? (
            <div className="col-span-full">
              <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
                <CardContent className="text-center py-16">
                  <div className="relative inline-block">
                    <Package className="h-24 w-24 mx-auto mb-4 text-gray-400" />
                    <div className="absolute inset-0 bg-yellow-400/30 blur-2xl rounded-full animate-pulse"></div>
                  </div>
                  <h3 className="text-2xl font-semibold mb-2 text-gray-900">No products found</h3>
                  <p className="text-gray-600 text-lg mb-4">
                    Try adjusting your search or filter criteria
                  </p>
                  <Button
                    onClick={resetFilters}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white"
                  >
                    Clear All Filters
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            paginatedProducts.map((product, index) => (
              <Card
                key={product._id}
                className={`group border-0 shadow-2xl bg-white/95 backdrop-blur-md hover:shadow-yellow-500/30 hover:scale-105 transition-all duration-300 overflow-hidden ${
                  viewMode === "list" ? "flex flex-row" : ""
                }`}
                style={{
                  animation: `fadeInUp 0.6s ease-out ${index * 0.06}s both`
                }}
              >
                {/* Enhanced gradient top border */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 shadow-lg"></div>

                <div className={viewMode === "list" ? "w-48 flex-shrink-0" : ""}>
                  <div className="relative overflow-hidden">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className={`object-cover transition-all duration-700 group-hover:scale-125 ${
                        viewMode === "list" ? "w-48 h-48" : "w-full h-48"
                      }`}
                    />
                    {product.originalPrice && (
                      <Badge className="absolute top-3 left-3 bg-gradient-to-r from-red-500 to-red-600 border-0 shadow-xl animate-pulse text-sm px-3 py-1">
                        Sale
                      </Badge>
                    )}
                    {!product.inStock && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
                        <Badge variant="destructive" className="text-base shadow-xl px-4 py-2">
                          Out of Stock
                        </Badge>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-3 right-3 bg-white/95 hover:bg-white backdrop-blur-sm shadow-xl hover:scale-125 transition-all duration-300"
                    >
                      <Heart className="h-5 w-5 text-gray-700 group-hover:text-red-500 transition-colors duration-300" />
                    </Button>

                    {/* Quick View Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleQuickView(product)}
                      className="absolute bottom-3 right-3 bg-yellow-400/95 hover:bg-yellow-500 backdrop-blur-sm shadow-xl hover:scale-125 transition-all duration-300 opacity-0 group-hover:opacity-100"
                    >
                      <Eye className="h-5 w-5 text-gray-900" />
                    </Button>

                    {/* Enhanced hover glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/0 via-yellow-500/0 to-yellow-500/0 group-hover:from-yellow-500/20 group-hover:via-transparent group-hover:to-transparent transition-all duration-700"></div>
                  </div>
                </div>

                <div className="flex-1">
                  <CardHeader className={viewMode === "list" ? "pb-2" : ""}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg group-hover:text-yellow-600 transition-colors duration-300 font-bold">
                          {product.name}
                        </CardTitle>
                        <CardDescription className="text-sm font-semibold mt-1 text-gray-700">
                          {product.brand}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-5 w-5 transition-all duration-300 ${
                              i < Math.floor(product.rating)
                                ? "text-yellow-500 fill-current drop-shadow-md"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-700 font-medium">
                        ({product.reviewCount})
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <p className="text-sm text-gray-700 line-clamp-2 font-medium">
                      {product.description}
                    </p>

                    {product.features && product.features.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {product.features.slice(0, 3).map((feature, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs border-yellow-400 text-yellow-800 bg-yellow-50 hover:bg-yellow-100 transition-colors duration-200 shadow-sm"
                          >
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-900 drop-shadow-sm">
                          ${product.price.toFixed(2)}
                        </span>
                        {product.originalPrice && (
                          <span className="text-sm text-gray-500 line-through font-medium">
                            ${product.originalPrice.toFixed(2)}
                          </span>
                        )}
                      </div>

                      <Button
                        onClick={() => handleAddToCart(product._id)}
                        disabled={!product.inStock || addingToCart === product._id}
                        size="sm"
                        className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-bold shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 border border-yellow-300"
                      >
                        {addingToCart === product._id ? (
                          <span className="flex items-center gap-2">
                            <div className="h-4 w-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                            Adding...
                          </span>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-1" />
                            Add to Cart
                          </>
                        )}
                      </Button>
                    </div>

                    {product.stockCount <= 5 && product.inStock && (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="h-2.5 w-2.5 bg-orange-500 rounded-full animate-pulse shadow-lg"></div>
                        <p className="text-xs text-orange-600 font-bold">
                          Only {product.stockCount} left in stock
                        </p>
                      </div>
                    )}
                  </CardContent>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 pt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="border-gray-300 hover:border-yellow-500 hover:bg-yellow-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <div className="flex gap-1">
              {[...Array(totalPages)].map((_, index) => {
                const pageNumber = index + 1
                // Show first page, last page, current page, and pages around current
                if (
                  pageNumber === 1 ||
                  pageNumber === totalPages ||
                  (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                ) {
                  return (
                    <Button
                      key={pageNumber}
                      variant={currentPage === pageNumber ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNumber)}
                      className={currentPage === pageNumber
                        ? "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500"
                        : "border-gray-300 hover:border-yellow-500 hover:bg-yellow-50"
                      }
                    >
                      {pageNumber}
                    </Button>
                  )
                } else if (
                  pageNumber === currentPage - 2 ||
                  pageNumber === currentPage + 2
                ) {
                  return <span key={pageNumber} className="px-2 text-gray-500">...</span>
                }
                return null
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="border-gray-300 hover:border-yellow-500 hover:bg-yellow-50 disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Quick View Modal */}
        <Dialog open={quickViewOpen} onOpenChange={setQuickViewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedProduct && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-gray-900">
                    {selectedProduct.name}
                  </DialogTitle>
                  <DialogDescription className="text-lg font-semibold text-gray-700">
                    {selectedProduct.brand}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid md:grid-cols-2 gap-6 pt-4">
                  {/* Product Image */}
                  <div className="space-y-4">
                    <div className="relative overflow-hidden rounded-lg border-2 border-gray-200">
                      <img
                        src={selectedProduct.images[0]}
                        alt={selectedProduct.name}
                        className="w-full h-96 object-cover"
                      />
                      {selectedProduct.originalPrice && (
                        <Badge className="absolute top-4 left-4 bg-gradient-to-r from-red-500 to-red-600 border-0 shadow-xl text-base px-4 py-2">
                          Sale - Save ${(selectedProduct.originalPrice - selectedProduct.price).toFixed(2)}
                        </Badge>
                      )}
                    </div>

                    {/* Additional Product Images */}
                    {selectedProduct.images.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {selectedProduct.images.slice(0, 4).map((image, index) => (
                          <img
                            key={index}
                            src={image}
                            alt={`${selectedProduct.name} view ${index + 1}`}
                            className="w-full h-20 object-cover rounded border border-gray-200 cursor-pointer hover:border-yellow-500 transition-colors"
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="space-y-6">
                    {/* Rating */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-6 w-6 ${
                              i < Math.floor(selectedProduct.rating)
                                ? "text-yellow-500 fill-current"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-lg text-gray-700 font-medium">
                        {selectedProduct.rating.toFixed(1)} ({selectedProduct.reviewCount} reviews)
                      </span>
                    </div>

                    {/* Price */}
                    <div className="flex items-center gap-3">
                      <span className="text-4xl font-bold text-gray-900">
                        ${selectedProduct.price.toFixed(2)}
                      </span>
                      {selectedProduct.originalPrice && (
                        <span className="text-xl text-gray-500 line-through">
                          ${selectedProduct.originalPrice.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Stock Status */}
                    <div>
                      {selectedProduct.inStock ? (
                        <Badge className="bg-green-500 text-white text-base px-4 py-2">
                          In Stock ({selectedProduct.stockCount} available)
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-base px-4 py-2">
                          Out of Stock
                        </Badge>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <h3 className="font-bold text-lg mb-2 text-gray-900">Description</h3>
                      <p className="text-gray-700 leading-relaxed">
                        {selectedProduct.description}
                      </p>
                    </div>

                    {/* Features */}
                    {selectedProduct.features && selectedProduct.features.length > 0 && (
                      <div>
                        <h3 className="font-bold text-lg mb-3 text-gray-900">Key Features</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedProduct.features.map((feature, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className="text-sm border-yellow-400 text-yellow-800 bg-yellow-50 px-3 py-1"
                            >
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category and Brand */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Category</p>
                        <p className="font-semibold text-gray-900">{selectedProduct.category}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Brand</p>
                        <p className="font-semibold text-gray-900">{selectedProduct.brand}</p>
                      </div>
                    </div>

                    {/* Add to Cart Button */}
                    <Button
                      onClick={() => {
                        handleAddToCart(selectedProduct._id)
                        setQuickViewOpen(false)
                      }}
                      disabled={!selectedProduct.inStock || addingToCart === selectedProduct._id}
                      className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-bold text-lg py-6 shadow-xl hover:shadow-2xl transition-all duration-300 disabled:opacity-50"
                    >
                      {addingToCart === selectedProduct._id ? (
                        <span className="flex items-center gap-2">
                          <div className="h-5 w-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                          Adding to Cart...
                        </span>
                      ) : (
                        <>
                          <ShoppingCart className="h-5 w-5 mr-2" />
                          Add to Cart
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Enhanced Benefits section */}
        {paginatedProducts.length > 0 && (
          <div className="grid gap-6 md:grid-cols-3 mt-8">
            {[
              {
                icon: ShoppingCart,
                title: "Free Shipping",
                description: "On orders over $50",
                color: "from-blue-500 to-blue-600"
              },
              {
                icon: Sparkles,
                title: "Quality Guarantee",
                description: "100% authentic products",
                color: "from-yellow-500 to-yellow-600"
              },
              {
                icon: Package,
                title: "Fast Delivery",
                description: "2-3 business days",
                color: "from-green-500 to-green-600"
              }
            ].map((benefit, index) => (
              <Card
                key={index}
                className="border-0 shadow-2xl bg-white/95 backdrop-blur-md hover:shadow-yellow-500/30 transition-all duration-300 hover:scale-110 overflow-hidden group"
                style={{
                  animation: `fadeInUp 0.6s ease-out ${index * 0.15}s both`
                }}
              >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 shadow-lg"></div>
                <CardContent className="pt-6 text-center">
                  <div className="relative inline-block mb-4">
                    <div className={`w-20 h-20 bg-gradient-to-br ${benefit.color} rounded-full flex items-center justify-center mx-auto shadow-2xl group-hover:scale-125 transition-transform duration-500`}>
                      <benefit.icon className="h-10 w-10 text-white drop-shadow-lg" />
                    </div>
                    <div className={`absolute inset-0 bg-gradient-to-br ${benefit.color} blur-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full`}></div>
                  </div>
                  <h3 className="font-bold text-xl text-gray-900 mb-1">{benefit.title}</h3>
                  <p className="text-base text-gray-700 font-medium">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Enhanced custom animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
