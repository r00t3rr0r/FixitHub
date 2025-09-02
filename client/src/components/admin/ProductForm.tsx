import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, X } from "lucide-react"
import { createProduct, Product } from "@/api/shop"
import { useToast } from "@/hooks/useToast"

interface ProductFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProductCreated: (product: Product) => void
  availableCategories: string[]
  availableBrands: string[]
}

export function ProductForm({
  open,
  onOpenChange,
  onProductCreated,
  availableCategories,
  availableBrands
}: ProductFormProps) {
  const [isCreating, setIsCreating] = useState(false)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
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

  const resetForm = () => {
    setFormData({
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
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], ""]
    }))
  }

  const removeArrayField = (field: 'images' | 'features' | 'compatibility', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }))
  }

  const updateArrayField = (field: 'images' | 'features' | 'compatibility', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }))
  }

  const handleSubmit = async () => {
    try {
      setIsCreating(true)
      console.log("Creating new product:", formData)

      // Validate required fields
      if (!formData.name || !formData.description || !formData.price ||
          !formData.category || !formData.brand || !formData.stockCount) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive"
        })
        return
      }

      // Prepare product data
      const productData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : undefined,
        category: formData.category,
        brand: formData.brand,
        stockCount: parseInt(formData.stockCount),
        images: formData.images.filter(img => img.trim() !== ""),
        features: formData.features.filter(feature => feature.trim() !== ""),
        compatibility: formData.compatibility.filter(comp => comp.trim() !== ""),
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        dimensions: (formData.dimensions.length || formData.dimensions.width || formData.dimensions.height) ? {
          length: formData.dimensions.length ? parseFloat(formData.dimensions.length) : undefined,
          width: formData.dimensions.width ? parseFloat(formData.dimensions.width) : undefined,
          height: formData.dimensions.height ? parseFloat(formData.dimensions.height) : undefined
        } : undefined
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

  const handleCancel = () => {
    resetForm()
    onOpenChange(false)
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
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter product name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Brand *</Label>
              <Select
                value={formData.brand}
                onValueChange={(value) => setFormData(prev => ({ ...prev, brand: value }))}
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
              {formData.brand === "other" && (
                <Input
                  placeholder="Enter custom brand"
                  onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
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
                value={formData.stockCount}
                onChange={(e) => setFormData(prev => ({ ...prev, stockCount: e.target.value }))}
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
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
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
                value={formData.originalPrice}
                onChange={(e) => setFormData(prev => ({ ...prev, originalPrice: e.target.value }))}
                placeholder="Enter original price (optional)"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter product description"
              rows={3}
            />
          </div>

          {/* Images */}
          <div className="space-y-2">
            <Label>Product Images</Label>
            {formData.images.map((image, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={image}
                  onChange={(e) => updateArrayField('images', index, e.target.value)}
                  placeholder="Enter image URL"
                  className="flex-1"
                />
                {formData.images.length > 1 && (
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
            {formData.features.map((feature, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={feature}
                  onChange={(e) => updateArrayField('features', index, e.target.value)}
                  placeholder="Enter feature"
                  className="flex-1"
                />
                {formData.features.length > 1 && (
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
            {formData.compatibility.map((comp, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={comp}
                  onChange={(e) => updateArrayField('compatibility', index, e.target.value)}
                  placeholder="Enter compatible device"
                  className="flex-1"
                />
                {formData.compatibility.length > 1 && (
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
                value={formData.weight}
                onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
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
                value={formData.dimensions.length}
                onChange={(e) => setFormData(prev => ({
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
                value={formData.dimensions.width}
                onChange={(e) => setFormData(prev => ({
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
                value={formData.dimensions.height}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  dimensions: { ...prev.dimensions, height: e.target.value }
                }))}
                placeholder="Height"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}