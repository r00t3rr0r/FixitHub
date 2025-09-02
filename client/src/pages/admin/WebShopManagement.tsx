import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { getProducts, createProduct, getProductCategories, getProductBrands, Product } from "@/api/shop"
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
  X
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function WebShopManagement() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [availableBrands, setAvailableBrands] = useState<string[]>([])
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
    }
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching products for admin...")
        const [productsResponse, categoriesResponse, brandsResponse] = await Promise.all([
          getProducts(),
          getProductCategories(),
          getProductBrands()
        ])

        const productsData = productsResponse.products || []
        setProducts(productsData)
        setFilteredProducts(productsData)

        const categories = categoriesResponse.categories?.map((cat: any) => cat.name) || []
        setAvailableCategories(categories)

        const brands = brandsResponse.brands?.map((brand: any) => brand.name) || []
        setAvailableBrands(brands)

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
  }, [toast])

  useEffect(() => {
    let filtered = products

    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(product => product.category === categoryFilter)
    }

    if (stockFilter !== "all") {
      if (stockFilter === "in-stock") {
        filtered = filtered.filter(product => product.inStock && product.stockCount > 0)
      } else if (stockFilter === "low-stock") {
        filtered = filtered.filter(product => product.inStock && product.stockCount <= 5)
      } else if (stockFilter === "out-of-stock") {
        filtered = filtered.filter(product => !product.inStock || product.stockCount === 0)
      }
    }

    setFilteredProducts(filtered)
  }, [products, searchTerm, categoryFilter, stockFilter])

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
        } : undefined
      }

      const response = await createProduct(productData)

      if (response.success) {
        toast({
          title: "Success",
          description: response.message || "Product created successfully"
        })

        // Add the new product to the list
        setProducts(prev => [response.product, ...prev])

        // Reset form and close dialog
        resetForm()
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

  const resetForm = () => {
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
      }
    })
  }

  const addArrayField = (field: 'images' | 'features' | 'compatibility') => {
    setNewProduct(prev => ({
      ...prev,
      [field]: [...prev[field], ""]
    }))
  }

  const removeArrayField = (field: 'images' | 'features' | 'compatibility', index: number) => {
    setNewProduct(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }))
  }

  const updateArrayField = (field: 'images' | 'features' | 'compatibility', index: number, value: string) => {
    setNewProduct(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }))
  }

  const categories = [...new Set(products.map(p => p.category))]
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
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
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
            Manage your product catalog and inventory levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No products found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product._id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-12 h-12 rounded object-cover"
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
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
                    onChange={(e) => updateArrayField('images', index, e.target.value)}
                    placeholder="Enter image URL"
                    className="flex-1"
                  />
                  {newProduct.images.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayField('images', index)}
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
                onClick={() => addArrayField('images')}
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
                    onChange={(e) => updateArrayField('features', index, e.target.value)}
                    placeholder="Enter feature"
                    className="flex-1"
                  />
                  {newProduct.features.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayField('features', index)}
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
                onClick={() => addArrayField('features')}
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
                    onChange={(e) => updateArrayField('compatibility', index, e.target.value)}
                    placeholder="Enter compatible device"
                    className="flex-1"
                  />
                  {newProduct.compatibility.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayField('compatibility', index)}
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
                onClick={() => addArrayField('compatibility')}
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
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                resetForm()
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
    </div>
  )
}