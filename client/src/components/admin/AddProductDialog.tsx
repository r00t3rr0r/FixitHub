import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/useToast"
import { createProduct, Product } from "@/api/shop"
import { Plus, X } from "lucide-react"

interface AddProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProductCreated: (product: Product) => void
  availableCategories: string[]
  availableBrands: string[]
}

export function AddProductDialog({
  open,
  onOpenChange,
  onProductCreated,
  availableCategories,
  availableBrands
}: AddProductDialogProps) {
  const [isCreating, setIsCreating] = useState(false)
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
        console.log("Product created successfully:", response.product)
        toast({
          title: "Success",
          description: response.message || "Product created successfully"
        })

        // Notify parent component
        onProductCreated(response.product)

        // Reset form and close dialog
        resetForm()
        onOpenChange(false)
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
      },
      // SEO Fields
      searchKeywords: "",
      seoName: "",
      seoTitleTag: "",
      seoMetaKeywords: "",
      seoMetaDescription: ""
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  {availableCategories.length > 0 ? (
                    availableCategories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="Accessories">Accessories</SelectItem>
                      <SelectItem value="Cases">Cases</SelectItem>
                      <SelectItem value="Chargers">Chargers</SelectItem>
                      <SelectItem value="Cables">Cables</SelectItem>
                      <SelectItem value="Screen Protectors">Screen Protectors</SelectItem>
                      <SelectItem value="Batteries">Batteries</SelectItem>
                      <SelectItem value="Tools">Tools</SelectItem>
                      <SelectItem value="Parts">Parts</SelectItem>
                    </>
                  )}
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
              resetForm()
              onOpenChange(false)
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
  )
}