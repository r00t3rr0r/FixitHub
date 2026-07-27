import { useEffect, useState, useMemo } from "react"
import { useAdcellConfig } from "@/hooks/useAdcellConfig"
import { SEO } from '@/components/SEO'
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
  DollarSign,
  CheckCircle2,
  Layers3,
  Shield,
  Tag
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
import { formatEUR } from '@/lib/utils'

const PRIMARY_BLUE = 'var(--primary-blue, #1a2a5e)'
const OFF_WHITE = 'var(--off-white, #f8f9fc)'

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
  const [selectedQuickViewImage, setSelectedQuickViewImage] = useState<string | null>(null)
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const { toast } = useToast()
  const adcell = useAdcellConfig()

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        console.log("Fetching products...")
        const response = await getProducts({ limit: 1000 })
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

  useEffect(() => {
    if (!selectedProduct) {
      setSelectedQuickViewImage(null)
      return
    }

    setSelectedQuickViewImage(selectedProduct.images?.[0] || null)
  }, [selectedProduct])

  // Pagination logic
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    setPaginatedProducts(filteredProducts.slice(startIndex, endIndex))
  }, [filteredProducts, currentPage, itemsPerPage])

  // ADCELL Container Tag – Category/Search Page
  useEffect(() => {
    if (paginatedProducts.length === 0 || !adcell.enabled || !adcell.containerTagsEnabled) return
    const productIds = paginatedProducts.map((p) => p._id).join(',')
    const categoryId = categoryFilter !== 'all' ? categoryFilter : ''
    const categoryName = categoryFilter !== 'all' ? categoryFilter : ''
    const method = searchTerm ? 'search' : 'category'

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true

    if (searchTerm) {
      script.src =
        `https://t.adcell.com/js/inlineretarget.js?method=search` +
        `&pid=${adcell.pid}` +
        `&search=${encodeURIComponent(searchTerm)}` +
        `&productIds=${encodeURIComponent(productIds)}` +
        `&productSeparator=,`
    } else {
      script.src =
        `https://t.adcell.com/js/inlineretarget.js?method=category` +
        `&pid=${adcell.pid}` +
        `&categoryName=${encodeURIComponent(categoryName)}` +
        `&categoryId=${encodeURIComponent(categoryId)}` +
        `&productIds=${encodeURIComponent(productIds)}` +
        `&productSeparator=,`
    }

    document.body.appendChild(script)
    return () => { script.remove() }
  }, [paginatedProducts, categoryFilter, searchTerm, adcell])

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
  const quickViewImages = selectedProduct?.images?.filter(Boolean) || []
  const quickViewPrimaryImage = selectedQuickViewImage || quickViewImages[0] || "/placeholder-product.png"
  const quickViewSavings = selectedProduct?.originalPrice ? selectedProduct.originalPrice - selectedProduct.price : 0

  // ── SEO: JSON-LD for the shop listing page ──────────────────────────────
  const BASE_URL = "https://www.mcrepair.de"

  const shopJsonLd = useMemo(() => {
    if (products.length === 0) return null

    const webPageLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${BASE_URL}/shop#webpage`,
      name: "Ersatzteile & Zubehör – McRepair.de Shop",
      description: "Hochwertige Ersatzteile und Zubehör für Smartphones, Tablets und weitere Geräte. Direkt bestellen bei McRepair.de.",
      url: `${BASE_URL}/shop`,
      isPartOf: {
        "@type": "WebSite",
        "@id": `${BASE_URL}/#website`,
        name: "McRepair.de",
        url: BASE_URL,
      },
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
          { "@type": "ListItem", position: 2, name: "Shop", item: `${BASE_URL}/shop` },
        ],
      },
      mainEntity: {
        "@type": "ItemList",
        "@id": `${BASE_URL}/shop#product-list`,
        name: "Shop Produkte",
        numberOfItems: products.length,
        itemListElement: products.map((p, index) => {
          const productUrl = `${BASE_URL}/shop/product/${p._id}`
          const item: any = {
            "@type": "ListItem",
            position: index + 1,
            url: productUrl,
            item: {
              "@type": "Product",
              "@id": productUrl,
              name: p.seoName || p.name,
              description: p.seoMetaDescription || p.description,
              sku: p.sku,
              brand: { "@type": "Brand", name: p.brand },
              category: p.category,
              image: p.images.filter(Boolean),
              url: productUrl,
              offers: {
                "@type": "Offer",
                url: productUrl,
                priceCurrency: "EUR",
                price: p.price.toFixed(2),
                priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                availability: p.inStock
                  ? "https://schema.org/InStock"
                  : "https://schema.org/OutOfStock",
                itemCondition: "https://schema.org/NewCondition",
                seller: { "@type": "Organization", name: "McRepair.de", url: BASE_URL },
              },
            },
          }
          if (p.reviewCount > 0) {
            item.item.aggregateRating = {
              "@type": "AggregateRating",
              ratingValue: p.rating.toFixed(1),
              reviewCount: p.reviewCount,
              bestRating: "5",
              worstRating: "1",
            }
          }
          return item
        }),
      },
    }

    const organizationLd = {
      "@context": "https://schema.org",
      "@type": "OnlineStore",
      "@id": `${BASE_URL}/#store`,
      name: "McRepair.de Shop",
      url: `${BASE_URL}/shop`,
      description: "Onlineshop für Smartphone-Ersatzteile, Tablets-Zubehör und weitere Geräteteile.",
      currenciesAccepted: "EUR",
      paymentAccepted: "Kreditkarte, PayPal, Überweisung",
      priceRange: "€–€€€",
    }

    return [webPageLd, organizationLd]
  }, [products])

  const shopKeywords = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category))].join(", ")
    const brnds = [...new Set(products.map(p => p.brand))].slice(0, 8).join(", ")
    return `Ersatzteile, Zubehör, Smartphone Reparatur, ${cats}, ${brnds}, McRepair, Shop kaufen`
  }, [products])

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: OFF_WHITE }}>
        <div className="container mx-auto px-2.5 py-4 sm:px-4 sm:py-6 space-y-6">
          {/* Header skeleton */}
          <div className="rounded-2xl px-4 py-4 shadow-lg sm:px-5" style={{ backgroundColor: PRIMARY_BLUE }}>
            <div className="space-y-2 flex-1">
              <div className="h-8 w-48 bg-white/30 rounded animate-pulse"></div>
              <div className="h-4 w-72 bg-white/20 rounded animate-pulse"></div>
            </div>
            <div className="h-8 w-24 mt-3 sm:mt-0 bg-white/20 rounded animate-pulse"></div>
          </div>

          {/* Filters skeleton */}
          <Card className="border shadow-sm">
            <CardContent className="pt-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="flex-1 h-9 bg-gray-200 rounded animate-pulse"></div>
                <div className="flex gap-2">
                  <div className="h-9 w-28 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-9 w-32 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-9 w-16 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Products grid skeleton */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="border shadow-sm">
                <div className="h-40 bg-gray-200 animate-pulse"></div>
                <CardHeader className="p-3 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: OFF_WHITE }}>
      <SEO
        title="Ersatzteile & Zubehör kaufen – McRepair.de Shop"
        description={`Hochwertige Ersatzteile & Zubehör für Smartphones und Tablets. ${products.length > 0 ? `${products.length} Produkte` : 'Jetzt entdecken'} im McRepair.de Shop.`}
        canonical="/shop"
        keywords={shopKeywords || "Ersatzteile, Zubehör, Smartphone, Tablet, Reparatur, McRepair Shop"}
        jsonLd={shopJsonLd || undefined}
      />
      <div className="container mx-auto px-2.5 py-4 sm:px-4 sm:py-6 space-y-6">
        {/* Header */}
        <div className="mb-5">
          <div
            className="flex flex-col gap-3 rounded-2xl px-4 py-4 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:px-5"
            style={{ backgroundColor: PRIMARY_BLUE }}
          >
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.9rem]">
                Web Shop
              </h1>
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge
                  variant="secondary"
                  className="px-2.5 py-1 text-xs font-semibold shadow-sm"
                  style={{ backgroundColor: 'rgba(255,255,255,0.14)', color: '#ffffff' }}
                >
                  <Package className="mr-1.5 h-3.5 w-3.5" />
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'Produkt' : 'Produkte'}
                </Badge>
                <span className="text-xs font-medium text-blue-100 sm:text-sm flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#f5b800]" />
                  Premium Zubehoer und Ersatzteile fuer Ihre Geraete
                </span>
              </div>
            </div>
            <Button
              asChild
              variant="outline"
              className="group h-9 border-white/30 bg-white/10 px-3 text-xs font-semibold text-white transition-all duration-300 hover:bg-white hover:text-[#1a2a5e] sm:text-sm"
              style={{
                borderWidth: '1px',
                borderColor: 'rgba(255,255,255,0.3)'
              }}
            >
              <Link to="/cart">
                <ShoppingCart className="h-4 w-4 mr-2 transition-transform group-hover:scale-110" />
                <span className="hidden sm:inline">Zum Warenkorb</span>
                <span className="sm:hidden">Warenkorb</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters and Search Card */}
        <Card className="border shadow-sm">
          <CardContent className="pt-4">
            {/* Search and Quick Actions */}
            <div className="flex flex-col lg:flex-row gap-3 mb-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search products by name, brand, or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-sm border-gray-300 focus:border-yellow-500 focus:ring-yellow-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="h-9 text-sm border-gray-300 hover:border-yellow-500 hover:bg-yellow-50"
                >
                  <Filter className="h-3 w-3 mr-1 text-yellow-600" />
                  <span className="hidden sm:inline">{showFilters ? 'Hide' : 'Filters'}</span>
                  <span className="sm:hidden">{showFilters ? 'Hide' : 'Show'}</span>
                </Button>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-28 sm:w-36 h-9 text-sm border-gray-300 hover:border-yellow-500">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex border rounded-md border-gray-300">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className={`h-9 w-9 rounded-r-none p-0 ${viewMode === "grid" ? "bg-yellow-500 hover:bg-yellow-600 text-white" : ""}`}
                  >
                    <Grid3X3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className={`h-9 w-9 rounded-l-none p-0 ${viewMode === "list" ? "bg-yellow-500 hover:bg-yellow-600 text-white" : ""}`}
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
              <div className="pt-3 border-t border-gray-200 space-y-4 animate-slideDown">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Category Filter */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Category</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="h-9 text-sm border-gray-300 hover:border-yellow-500">
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
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Brand</Label>
                    <Select value={brandFilter} onValueChange={setBrandFilter}>
                      <SelectTrigger className="h-9 text-sm border-gray-300 hover:border-yellow-500">
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
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Availability</Label>
                    <Select value={stockFilter} onValueChange={setStockFilter}>
                      <SelectTrigger className="h-9 text-sm border-gray-300 hover:border-yellow-500">
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
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-yellow-600" />
                      Price Range
                    </Label>
                    <div className="pt-1.5">
                      <Slider
                        min={0}
                        max={maxPrice}
                        step={10}
                        value={priceRange}
                        onValueChange={(value) => setPriceRange(value as [number, number])}
                        className="mb-1.5"
                      />
                      <div className="flex justify-between text-xs text-gray-600 font-medium">
                        <span>${priceRange[0]}</span>
                        <span>${priceRange[1]}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active Filters and Reset */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {categoryFilter !== "all" && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs px-2 py-0.5">
                        Category: {categoryFilter}
                        <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setCategoryFilter("all")} />
                      </Badge>
                    )}
                    {brandFilter !== "all" && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs px-2 py-0.5">
                        Brand: {brandFilter}
                        <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setBrandFilter("all")} />
                      </Badge>
                    )}
                    {stockFilter !== "all" && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs px-2 py-0.5">
                        Stock: {stockFilter === "inStock" ? "In Stock" : "Low Stock"}
                        <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setStockFilter("all")} />
                      </Badge>
                    )}
                    {(priceRange[0] !== 0 || priceRange[1] !== maxPrice) && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs px-2 py-0.5">
                        Price: ${priceRange[0]} - ${priceRange[1]}
                        <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setPriceRange([0, maxPrice])} />
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-8 text-xs text-gray-600 hover:text-yellow-600 hover:bg-yellow-50"
                  >
                    Reset All
                  </Button>
                </div>

                {/* Results Count */}
                <div className="text-xs text-gray-600 font-medium">
                  Showing {paginatedProducts.length} of {filteredProducts.length} products
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products Grid/List */}
        <div className={viewMode === "grid"
          ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          : "space-y-3"
        }>
          {paginatedProducts.length === 0 ? (
            <div className="col-span-full">
              <Card className="border shadow-sm">
                <CardContent className="text-center py-12">
                  <Package className="h-16 w-16 mx-auto mb-3 text-gray-400" />
                  <h3 className="text-lg font-semibold mb-1 text-gray-900">No products found</h3>
                  <p className="text-gray-600 text-sm mb-3">
                    Try adjusting your search or filter criteria
                  </p>
                  <Button
                    size="sm"
                    onClick={resetFilters}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white h-8 text-xs"
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
                className={`group border shadow-sm hover:shadow-md hover:border-yellow-300 transition-all duration-300 overflow-hidden ${
                  viewMode === "list" ? "flex flex-row" : ""
                }`}
                style={{
                  animation: `fadeInUp 0.4s ease-out ${index * 0.04}s both`
                }}
              >
                <div className={viewMode === "list" ? "w-36 flex-shrink-0" : ""}>
                  <div className="relative overflow-hidden">
                    <Link to={`/shop/product/${product._id}`} tabIndex={-1} aria-hidden="true">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className={`object-cover transition-all duration-500 group-hover:scale-110 ${
                          viewMode === "list" ? "w-36 h-36" : "w-full h-40"
                        }`}
                      />
                    </Link>
                    {product.originalPrice && (
                      <Badge className="absolute top-2 left-2 bg-red-500 border-0 text-xs px-2 py-0.5">
                        Sale
                      </Badge>
                    )}
                    {!product.inStock && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Badge variant="destructive" className="text-xs px-3 py-1">
                          Out of Stock
                        </Badge>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 bg-white/90 hover:bg-white shadow-sm"
                    >
                      <Heart className="h-3.5 w-3.5 text-gray-700 group-hover:text-red-500 transition-colors" />
                    </Button>

                    {/* Quick View Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleQuickView(product)}
                      className="absolute bottom-2 right-2 h-7 w-7 bg-yellow-400/90 hover:bg-yellow-500 shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-300"
                    >
                      <Eye className="h-3.5 w-3.5 text-gray-900" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1">
                  <CardHeader className={`${viewMode === "list" ? "p-3 pb-2" : "p-3"}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-sm group-hover:text-yellow-600 transition-colors font-bold line-clamp-2">
                          <Link
                            to={`/shop/product/${product._id}`}
                            className="hover:underline focus:outline-none focus:text-yellow-600"
                          >
                            {product.name}
                          </Link>
                        </CardTitle>
                        <CardDescription className="text-xs font-semibold mt-0.5 text-gray-700">
                          {product.brand}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < Math.floor(product.rating)
                                ? "text-yellow-500 fill-current"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-600">
                        ({product.reviewCount})
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className={`space-y-2 ${viewMode === "list" ? "p-3 pt-0" : "p-3 pt-0"}`}>
                    <p className="text-xs text-gray-700 line-clamp-2">
                      {product.description}
                    </p>

                    {product.features && product.features.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {product.features.slice(0, 2).map((feature, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs border-yellow-400 text-yellow-800 bg-yellow-50 px-1.5 py-0"
                          >
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg font-bold text-gray-900">
                          {formatEUR(product.price)}
                        </span>
                        {product.originalPrice && (
                          <span className="text-xs text-gray-500 line-through">
                            {formatEUR(product.originalPrice)}
                          </span>
                        )}
                      </div>

                      <Button
                        onClick={() => handleAddToCart(product._id)}
                        disabled={!product.inStock || addingToCart === product._id}
                        size="sm"
                        className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-bold shadow-sm hover:shadow-md transition-all duration-300 disabled:opacity-50 h-7 text-xs px-2"
                      >
                        {addingToCart === product._id ? (
                          <span className="flex items-center gap-1">
                            <div className="h-3 w-3 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                            <span className="hidden sm:inline">Adding...</span>
                          </span>
                        ) : (
                          <>
                            <Plus className="h-3 w-3 sm:mr-1" />
                            <span className="hidden sm:inline">Add to Cart</span>
                            <span className="sm:hidden">Add</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {product.stockCount <= 5 && product.inStock && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <div className="h-1.5 w-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                        <p className="text-xs text-orange-600 font-semibold">
                          Only {product.stockCount} left
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
          <div className="flex justify-center items-center gap-1.5 pt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="h-8 text-xs border-gray-300 hover:border-yellow-500 hover:bg-yellow-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
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
                      className={`h-8 w-8 p-0 text-xs ${currentPage === pageNumber
                        ? "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500"
                        : "border-gray-300 hover:border-yellow-500 hover:bg-yellow-50"
                      }`}
                    >
                      {pageNumber}
                    </Button>
                  )
                } else if (
                  pageNumber === currentPage - 2 ||
                  pageNumber === currentPage + 2
                ) {
                  return <span key={pageNumber} className="px-1 text-gray-500 text-xs">...</span>
                }
                return null
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="h-8 text-xs border-gray-300 hover:border-yellow-500 hover:bg-yellow-50 disabled:opacity-50"
            >
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">Next</span>
              <ChevronRight className="h-3 w-3 sm:ml-1" />
            </Button>
          </div>
        )}

        {/* Quick View Modal */}
        <Dialog open={quickViewOpen} onOpenChange={setQuickViewOpen}>
          <DialogContent className="w-[calc(100vw-16px)] sm:max-w-5xl max-h-[92dvh] overflow-hidden border-0 bg-white p-0 gap-0 rounded-[20px] sm:rounded-[28px] shadow-[0_24px_80px_rgba(26,42,94,0.32)] [&>button]:top-4 [&>button]:right-4 [&>button]:text-white/80 [&>button]:opacity-100 [&>button:hover]:text-white [&>button]:focus:ring-white/50 [&>button]:ring-offset-transparent">
            {selectedProduct && (
              <>
                <DialogHeader className="gap-4 bg-gradient-to-r from-[#1a2a5e] via-[#22366f] to-[#2d4a8f] px-4 py-4 text-left sm:px-6 sm:py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border-0 bg-white/14 px-2.5 py-1 text-[11px] font-semibold text-white shadow-none">
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          Produktdetails
                        </Badge>
                        <Badge className="border-0 bg-[#f5b800] px-2.5 py-1 text-[11px] font-bold text-[#1a2a5e] shadow-none">
                          <Sparkles className="mr-1 h-3.5 w-3.5" />
                          Shop Quick View
                        </Badge>
                        {selectedProduct.inStock ? (
                          <Badge className="border-0 bg-[#38a169] px-2.5 py-1 text-[11px] font-semibold text-white shadow-none">
                            Sofort verfuegbar
                          </Badge>
                        ) : (
                          <Badge className="border-0 bg-[#c53030] px-2.5 py-1 text-[11px] font-semibold text-white shadow-none">
                            Nicht verfuegbar
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <DialogTitle className="text-xl font-bold tracking-tight !text-[#f5b800] sm:text-[1.65rem]">
                          {selectedProduct.name}
                        </DialogTitle>
                        <DialogDescription className="max-w-2xl text-sm leading-6 text-blue-100/90">
                          {selectedProduct.brand} • {selectedProduct.category}
                          {selectedProduct.sku ? ` • SKU ${selectedProduct.sku}` : ""}
                        </DialogDescription>
                      </div>
                    </div>
                  </div>
                </DialogHeader>

                <div className="max-h-[calc(92dvh-136px)] overflow-y-auto bg-[linear-gradient(180deg,#f7f9fd_0%,#ffffff_42%)]">
                  <div className="grid gap-5 p-3 sm:p-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                    <div className="space-y-4">
                      <section className="overflow-hidden rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                        <div className="flex items-center justify-between border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Produktfoto</p>
                            <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">Hauptansicht</p>
                          </div>
                          {quickViewSavings > 0 && (
                            <Badge className="border-0 bg-[#fff4cc] px-3 py-1 text-[11px] font-semibold text-[#8b5e00] shadow-none">
                              <Sparkles className="mr-1 h-3.5 w-3.5" />
                              {formatEUR(quickViewSavings)} sparen
                            </Badge>
                          )}
                        </div>

                        <div className="bg-[radial-gradient(circle_at_top,#eef4ff_0%,#f8f9fc_48%,#ffffff_100%)] p-4 sm:p-6">
                          <div className="overflow-hidden rounded-[20px] border border-[#dfe4ee] bg-white shadow-sm">
                            <img
                              src={quickViewPrimaryImage}
                              alt={selectedProduct.name}
                              className="h-[260px] w-full object-contain p-4 sm:h-[420px] sm:p-6"
                              onError={(event) => {
                                event.currentTarget.src = "/placeholder-product.png"
                              }}
                            />
                          </div>
                        </div>
                      </section>

                      {quickViewImages.length > 1 && (
                        <section className="rounded-[24px] border border-[#d9dfeb] bg-white p-3 shadow-[0_14px_36px_rgba(26,42,94,0.08)] sm:p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Galerie</p>
                              <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">Weitere Ansichten</p>
                            </div>
                            <span className="text-xs font-medium text-[#63708a]">{quickViewImages.length} Bilder</span>
                          </div>

                          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                            {quickViewImages.slice(0, 5).map((image, index) => {
                              const isActive = quickViewPrimaryImage === image

                              return (
                                <button
                                  key={`${image}-${index}`}
                                  type="button"
                                  onClick={() => setSelectedQuickViewImage(image)}
                                  className={`overflow-hidden rounded-2xl border p-1.5 transition-all ${
                                    isActive
                                      ? "border-[#f5b800] bg-[#fff9e6] shadow-[0_10px_24px_rgba(245,184,0,0.18)]"
                                      : "border-[#d9dfeb] bg-[#f8f9fc] hover:border-[#1a2a5e]/30 hover:bg-white"
                                  }`}
                                >
                                  <img
                                    src={image}
                                    alt={`${selectedProduct.name} Ansicht ${index + 1}`}
                                    className="h-16 w-full rounded-xl object-cover sm:h-20"
                                    onError={(event) => {
                                      event.currentTarget.src = "/placeholder-product.png"
                                    }}
                                  />
                                </button>
                              )
                            })}
                          </div>
                        </section>
                      )}
                    </div>

                    <div className="space-y-4">
                      <section className="rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                        <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Preis & Status</p>
                          <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">Schneller Ueberblick</p>
                        </div>

                        <div className="space-y-4 px-4 py-4 sm:px-5">
                          <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#63708a]">Aktueller Preis</p>
                              <div className="mt-1 flex items-end gap-2">
                                <span className="text-3xl font-bold tracking-tight text-[#1a2a5e]">
                                  {formatEUR(selectedProduct.price)}
                                </span>
                                {selectedProduct.originalPrice && (
                                  <span className="pb-1 text-sm font-medium text-[#8a94a6] line-through">
                                    {formatEUR(selectedProduct.originalPrice)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <Badge className={`border-0 px-3 py-1 text-xs font-semibold shadow-none ${
                              selectedProduct.inStock
                                ? "bg-[#e8f6ee] text-[#2f855a]"
                                : "bg-[#fdecec] text-[#c53030]"
                            }`}>
                              <Shield className="mr-1 h-3.5 w-3.5" />
                              {selectedProduct.inStock ? `${selectedProduct.stockCount} verfuegbar` : "Aktuell ausverkauft"}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < Math.floor(selectedProduct.rating)
                                      ? "fill-[#f5b800] text-[#f5b800]"
                                      : "text-[#d2d8e4]"
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-sm font-medium text-[#43506a]">
                              {selectedProduct.rating.toFixed(1)} von 5 ({selectedProduct.reviewCount} Bewertungen)
                            </span>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl bg-[#f8f9fc] px-3 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#63708a]">Kategorie</p>
                              <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">{selectedProduct.category}</p>
                            </div>
                            <div className="rounded-2xl bg-[#f8f9fc] px-3 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#63708a]">Marke</p>
                              <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">{selectedProduct.brand}</p>
                            </div>
                            <div className="rounded-2xl bg-[#f8f9fc] px-3 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#63708a]">Lieferstatus</p>
                              <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">
                                {selectedProduct.inStock ? "Sofort lieferbar" : "Nicht verfuegbar"}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge className="border-0 bg-[#eef3fb] px-2.5 py-1 text-[11px] font-semibold text-[#1a2a5e] shadow-none">
                              <Tag className="mr-1 h-3.5 w-3.5" />
                              {selectedProduct.category}
                            </Badge>
                            <Badge className="border-0 bg-[#fff7db] px-2.5 py-1 text-[11px] font-semibold text-[#a16207] shadow-none">
                              <Layers3 className="mr-1 h-3.5 w-3.5" />
                              {selectedProduct.brand}
                            </Badge>
                            {selectedProduct.sku && (
                              <Badge className="border-0 bg-[#edf2f7] px-2.5 py-1 text-[11px] font-semibold text-[#43506a] shadow-none">
                                SKU {selectedProduct.sku}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </section>

                      <section className="rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                        <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Beschreibung</p>
                          <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">Produktinformation</p>
                        </div>

                        <div className="px-4 py-4 sm:px-5">
                          <p className="text-sm leading-7 text-[#43506a]">
                            {selectedProduct.description}
                          </p>
                        </div>
                      </section>

                      {selectedProduct.features && selectedProduct.features.length > 0 && (
                        <section className="rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                          <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Highlights</p>
                            <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">Wichtige Merkmale</p>
                          </div>

                          <div className="grid gap-2 px-4 py-4 sm:px-5">
                            {selectedProduct.features.map((feature, index) => (
                              <div
                                key={index}
                                className="flex items-start gap-2 rounded-2xl bg-[#f8f9fc] px-3 py-3"
                              >
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#38a169]" />
                                <span className="text-sm leading-6 text-[#1a2a5e]">{feature}</span>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      <div className="rounded-[24px] border border-[#d9dfeb] bg-white p-4 shadow-[0_14px_36px_rgba(26,42,94,0.08)] sm:p-5">
                        <Button
                          onClick={() => {
                            handleAddToCart(selectedProduct._id)
                            setQuickViewOpen(false)
                          }}
                          disabled={!selectedProduct.inStock || addingToCart === selectedProduct._id}
                          className="h-12 w-full bg-gradient-to-r from-[#f5b800] to-[#f0c419] text-[#1a2a5e] font-bold text-sm shadow-[0_14px_28px_rgba(245,184,0,0.28)] transition-all duration-300 hover:from-[#f0c419] hover:to-[#e0b000] hover:shadow-[0_18px_34px_rgba(245,184,0,0.34)] disabled:opacity-50"
                        >
                          {addingToCart === selectedProduct._id ? (
                            <span className="flex items-center gap-2">
                              <div className="h-4 w-4 border-2 border-[#1a2a5e] border-t-transparent rounded-full animate-spin"></div>
                              Wird hinzugefuegt...
                            </span>
                          ) : (
                            <>
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              In den Warenkorb
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Benefits section */}
        {paginatedProducts.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3 mt-6">
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
                className="border shadow-sm hover:shadow-md transition-all duration-300 group"
                style={{
                  animation: `fadeInUp 0.4s ease-out ${index * 0.1}s both`
                }}
              >
                <CardContent className="p-4 text-center">
                  <div className="relative inline-block mb-2">
                    <div className={`w-12 h-12 bg-gradient-to-br ${benefit.color} rounded-full flex items-center justify-center mx-auto shadow-md group-hover:scale-110 transition-transform duration-300`}>
                      <benefit.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <h3 className="font-bold text-sm text-gray-900 mb-0.5">{benefit.title}</h3>
                  <p className="text-xs text-gray-600">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
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
