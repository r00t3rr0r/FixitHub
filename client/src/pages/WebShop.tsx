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
  List
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
      await addToCart(productId, 1)
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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
          <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-muted rounded-t"></div>
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Web Shop</h1>
          <p className="text-muted-foreground">
            Find accessories and parts for your devices
          </p>
        </div>
        <Button asChild>
          <Link to="/cart">
            <ShoppingCart className="h-4 w-4 mr-2" />
            View Cart
          </Link>
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
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
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="rounded-r-none"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="rounded-l-none"
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
            <Card>
              <CardContent className="text-center py-12">
                <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No products found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search or filter criteria
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          filteredProducts.map((product) => (
            <Card key={product._id} className={`group hover:shadow-lg transition-all duration-200 ${
              viewMode === "list" ? "flex flex-row" : ""
            }`}>
              <div className={viewMode === "list" ? "w-48 flex-shrink-0" : ""}>
                <div className="relative overflow-hidden rounded-t-lg">
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className={`object-cover transition-transform group-hover:scale-105 ${
                      viewMode === "list" ? "w-48 h-48" : "w-full h-48"
                    }`}
                  />
                  {product.originalPrice && (
                    <Badge className="absolute top-2 left-2 bg-red-500">
                      Sale
                    </Badge>
                  )}
                  {!product.inStock && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Badge variant="destructive">Out of Stock</Badge>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                  >
                    <Heart className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1">
                <CardHeader className={viewMode === "list" ? "pb-2" : ""}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {product.name}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {product.brand}
                      </CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < Math.floor(product.rating)
                              ? "text-yellow-400 fill-current"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ({product.reviewCount})
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>

                  {product.features && product.features.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {product.features.slice(0, 3).map((feature, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">
                        ${product.price.toFixed(2)}
                      </span>
                      {product.originalPrice && (
                        <span className="text-sm text-muted-foreground line-through">
                          ${product.originalPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                    
                    <Button
                      onClick={() => handleAddToCart(product._id)}
                      disabled={!product.inStock || addingToCart === product._id}
                      size="sm"
                    >
                      {addingToCart === product._id ? (
                        "Adding..."
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          Add to Cart
                        </>
                      )}
                    </Button>
                  </div>

                  {product.stockCount <= 5 && product.inStock && (
                    <p className="text-xs text-orange-600">
                      Only {product.stockCount} left in stock
                    </p>
                  )}
                </CardContent>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}