import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  Sparkles
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function WebShop() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [addingToCart, setAddingToCart] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        console.log("Fetching products...")
        const response = await getProducts()
        const productsData = (response as any).products || []
        setProducts(productsData)
        setFilteredProducts(productsData)
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
  }, [products, searchTerm, categoryFilter, sortBy])

  const handleAddToCart = async (productId: string) => {
    try {
      setAddingToCart(productId)
      console.log("Adding product to cart:", productId)
      await addToCart({ productId, quantity: 1 })
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

  const categories = [...new Set(products.map(p => p.category))]

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-yellow-50/30">
        <div className="container mx-auto px-4 py-8 space-y-8">
          {/* Header skeleton */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-3 flex-1">
              <div className="h-10 w-64 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-lg animate-pulse"></div>
              <div className="h-5 w-96 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="h-10 w-32 bg-gradient-to-r from-yellow-200 via-yellow-300 to-yellow-200 rounded-lg animate-pulse"></div>
          </div>

          {/* Filters skeleton */}
          <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 h-10 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded animate-pulse"></div>
                <div className="flex gap-2">
                  <div className="h-10 w-40 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded animate-pulse"></div>
                  <div className="h-10 w-40 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded animate-pulse"></div>
                  <div className="h-10 w-20 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Products grid skeleton */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
                <div className="h-48 bg-gradient-to-br from-gray-200 via-gray-300 to-gray-200 animate-pulse"></div>
                <CardHeader>
                  <div className="h-6 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-3/4 animate-pulse"></div>
                  <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-1/2 animate-pulse"></div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-yellow-50/30">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header with gradient text */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-yellow-600 bg-clip-text text-transparent">
              Web Shop
            </h1>
            <p className="text-gray-600 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              Find premium accessories and parts for your devices
            </p>
          </div>
          <Button
            asChild
            className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Link to="/cart">
              <ShoppingCart className="h-4 w-4 mr-2" />
              View Cart
            </Link>
          </Button>
        </div>

        {/* Filters and Search Card */}
        <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 group-hover:text-yellow-500 transition-colors duration-200" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 transition-all duration-200"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40 border-gray-200 hover:border-yellow-400 transition-colors duration-200">
                    <Filter className="h-4 w-4 mr-2 text-yellow-500" />
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

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40 border-gray-200 hover:border-yellow-400 transition-colors duration-200">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex border rounded-md border-gray-200">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className={`rounded-r-none ${viewMode === "grid" ? "bg-yellow-400 hover:bg-yellow-500 text-gray-900" : ""}`}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className={`rounded-l-none ${viewMode === "list" ? "bg-yellow-400 hover:bg-yellow-500 text-gray-900" : ""}`}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid/List */}
        <div className={viewMode === "grid"
          ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          : "space-y-4"
        }>
          {filteredProducts.length === 0 ? (
            <div className="col-span-full">
              <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
                <CardContent className="text-center py-16">
                  <div className="relative inline-block">
                    <Package className="h-20 w-20 mx-auto mb-4 text-gray-300" />
                    <div className="absolute inset-0 bg-yellow-400/20 blur-xl rounded-full animate-pulse"></div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900">No products found</h3>
                  <p className="text-gray-600">
                    Try adjusting your search or filter criteria
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            filteredProducts.map((product, index) => (
              <Card
                key={product._id}
                className={`group border-0 shadow-lg bg-white/90 backdrop-blur-sm hover:shadow-2xl hover:scale-102 transition-all duration-300 overflow-hidden ${
                  viewMode === "list" ? "flex flex-row" : ""
                }`}
                style={{
                  animation: `fadeInUp 0.5s ease-out ${index * 0.05}s both`
                }}
              >
                {/* Gradient top border */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>

                <div className={viewMode === "list" ? "w-48 flex-shrink-0" : ""}>
                  <div className="relative overflow-hidden">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className={`object-cover transition-all duration-500 group-hover:scale-110 ${
                        viewMode === "list" ? "w-48 h-48" : "w-full h-48"
                      }`}
                    />
                    {product.originalPrice && (
                      <Badge className="absolute top-3 left-3 bg-gradient-to-r from-red-500 to-red-600 border-0 shadow-lg animate-pulse">
                        Sale
                      </Badge>
                    )}
                    {!product.inStock && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                        <Badge variant="destructive" className="text-sm shadow-lg">
                          Out of Stock
                        </Badge>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-3 right-3 bg-white/90 hover:bg-white backdrop-blur-sm shadow-lg hover:scale-110 transition-all duration-200"
                    >
                      <Heart className="h-4 w-4 text-gray-600 group-hover:text-red-500 transition-colors duration-200" />
                    </Button>
                    {/* Hover glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-t from-yellow-400/0 via-yellow-400/0 to-yellow-400/0 group-hover:from-yellow-400/10 group-hover:via-transparent group-hover:to-transparent transition-all duration-500"></div>
                  </div>
                </div>

                <div className="flex-1">
                  <CardHeader className={viewMode === "list" ? "pb-2" : ""}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg group-hover:text-yellow-600 transition-colors duration-200">
                          {product.name}
                        </CardTitle>
                        <CardDescription className="text-sm font-medium mt-1">
                          {product.brand}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 transition-all duration-200 ${
                              i < Math.floor(product.rating)
                                ? "text-yellow-400 fill-current"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-600">
                        ({product.reviewCount})
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {product.description}
                    </p>

                    {product.features && product.features.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {product.features.slice(0, 3).map((feature, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs border-yellow-200 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 transition-colors duration-200"
                          >
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-yellow-600 bg-clip-text text-transparent">
                          ${product.price.toFixed(2)}
                        </span>
                        {product.originalPrice && (
                          <span className="text-sm text-gray-400 line-through">
                            ${product.originalPrice.toFixed(2)}
                          </span>
                        )}
                      </div>

                      <Button
                        onClick={() => handleAddToCart(product._id)}
                        disabled={!product.inStock || addingToCart === product._id}
                        size="sm"
                        className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
                        <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse"></div>
                        <p className="text-xs text-orange-600 font-medium">
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

        {/* Benefits section */}
        {filteredProducts.length > 0 && (
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
                className="border-0 shadow-lg bg-white/90 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden group"
                style={{
                  animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`
                }}
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
                <CardContent className="pt-6 text-center">
                  <div className="relative inline-block mb-4">
                    <div className={`w-16 h-16 bg-gradient-to-br ${benefit.color} rounded-full flex items-center justify-center mx-auto shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <benefit.icon className="h-8 w-8 text-white" />
                    </div>
                    <div className={`absolute inset-0 bg-gradient-to-br ${benefit.color} blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300 rounded-full`}></div>
                  </div>
                  <h3 className="font-semibold text-lg text-gray-900 mb-1">{benefit.title}</h3>
                  <p className="text-sm text-gray-600">{benefit.description}</p>
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
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
