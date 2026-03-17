import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/useToast"
import {
  getBrands,
  getBrandById,
  getModelsByBrand,
  getModelById,
  createBrand,
  createModel,
  updateModel,
  updateBrand,
  Brand,
  Model
} from "@/api/brands"
import {
  getDeviceTypes,
  getManufacturersByDeviceType,
  getModelsByTypeAndManufacturer,
  DeviceType,
  Manufacturer,
  DeviceModel
} from "@/api/devices"
import {
  Smartphone,
  Search,
  Plus,
  Edit,
  Eye,
  Trash2,
  Package,
  Users
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
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
import { Textarea } from "@/components/ui/textarea"

export function DeviceBrandsManagement() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [models, setModels] = useState<DeviceModel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDeviceType, setSelectedDeviceType] = useState("all")
  const [selectedManufacturer, setSelectedManufacturer] = useState("all")

  // Dialog states
  const [showCreateBrand, setShowCreateBrand] = useState(false)
  const [showCreateModel, setShowCreateModel] = useState(false)
  const [showViewBrand, setShowViewBrand] = useState(false)
  const [showViewModel, setShowViewModel] = useState(false)
  const [showViewDeviceType, setShowViewDeviceType] = useState(false)
  const [showDeleteBrand, setShowDeleteBrand] = useState(false)
  const [showDeleteModel, setShowDeleteModel] = useState(false)

  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingModelId, setEditingModelId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Selected items
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [selectedModel, setSelectedModel] = useState<DeviceModel | null>(null)
  const [selectedDeviceTypeDetails, setSelectedDeviceTypeDetails] = useState<DeviceType | null>(null)

  // Form states
  const [brandForm, setBrandForm] = useState({
    name: '',
    logo: ''
  })

  const [modelForm, setModelForm] = useState({
    name: '',
    brandId: '',
    deviceType: '',
    image: '',
    specifications: {} as Record<string, string>
  })

  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('DeviceBrandsManagement: Fetching initial data...')
        const [brandsResponse, deviceTypesResponse] = await Promise.all([
          getBrands(),
          getDeviceTypes()
        ])
        console.log('DeviceBrandsManagement: brandsResponse received:', brandsResponse)
        console.log('DeviceBrandsManagement: brandsResponse type:', typeof brandsResponse)
        console.log('DeviceBrandsManagement: brandsResponse length:', brandsResponse?.length)
        console.log('DeviceBrandsManagement: brandsResponse is array:', Array.isArray(brandsResponse))
        
        setBrands(brandsResponse)
        console.log('DeviceBrandsManagement: setBrands called with:', brandsResponse)
        
        setDeviceTypes((deviceTypesResponse as any).deviceTypes || [])
        console.log('DeviceBrandsManagement: Initial data loaded')
      } catch (error) {
        console.error('DeviceBrandsManagement: Error loading data:', error)
        toast({
          title: "Error",
          description: "Failed to load device data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [toast])

  useEffect(() => {
    const fetchManufacturers = async () => {
      if (selectedDeviceType && selectedDeviceType !== "all") {
        try {
          console.log('DeviceBrandsManagement: Fetching manufacturers for device type:', selectedDeviceType)
          const response = await getManufacturersByDeviceType(selectedDeviceType)
          setManufacturers((response as any).manufacturers || [])
        } catch (error) {
          console.error('DeviceBrandsManagement: Error fetching manufacturers:', error)
          setManufacturers([])
        }
      } else {
        setManufacturers([])
      }
    }
    fetchManufacturers()
  }, [selectedDeviceType])

  useEffect(() => {
    const fetchModels = async () => {
      if (selectedDeviceType && selectedDeviceType !== "all" &&
          selectedManufacturer && selectedManufacturer !== "all") {
        try {
          console.log('DeviceBrandsManagement: Fetching models for type and manufacturer:', selectedDeviceType, selectedManufacturer)
          const response = await getModelsByTypeAndManufacturer(selectedDeviceType, selectedManufacturer)
          setModels((response as any).models || [])
        } catch (error) {
          console.error('DeviceBrandsManagement: Error fetching models:', error)
          setModels([])
        }
      } else {
        setModels([])
      }
    }
    fetchModels()
  }, [selectedDeviceType, selectedManufacturer])

  const handleViewBrand = async (brand: Brand) => {
    try {
      console.log('DeviceBrandsManagement: Viewing brand:', brand._id)
      const response = await getBrandById(brand._id)
      setSelectedBrand(response)
      setShowViewBrand(true)
    } catch (error) {
      console.error('DeviceBrandsManagement: Error viewing brand:', error)
      toast({
        title: "Error",
        description: "Failed to load brand details",
        variant: "destructive"
      })
    }
  }

  const handleViewDeviceType = async (deviceType: DeviceType) => {
    try {
      console.log('DeviceBrandsManagement: Viewing device type:', deviceType._id)
      setSelectedDeviceTypeDetails(deviceType)
      setSelectedDeviceType(deviceType._id)
      setShowViewDeviceType(true)
    } catch (error) {
      console.error('DeviceBrandsManagement: Error viewing device type:', error)
      toast({
        title: "Error",
        description: "Failed to load device type details",
        variant: "destructive"
      })
    }
  }

  const handleViewModel = async (model: DeviceModel) => {
    try {
      console.log('DeviceBrandsManagement: Viewing model:', model._id)
      setSelectedModel(model)
      setShowViewModel(true)
    } catch (error) {
      console.error('DeviceBrandsManagement: Error viewing model:', error)
      toast({
        title: "Error",
        description: "Failed to load model details",
        variant: "destructive"
      })
    }
  }

  const handleCreateBrand = () => {
    setBrandForm({ name: '', logo: '' })
    setShowCreateBrand(true)
  }

  const handleCreateModel = () => {
    setIsEditMode(false)
    setEditingModelId(null)
    setModelForm({
      name: '',
      brandId: '',
      deviceType: '',
      image: '',
      specifications: {}
    })
    setShowCreateModel(true)
  }

  const handleEditModel = (model: DeviceModel) => {
    console.log('DeviceBrandsManagement: Editing model:', model)
    console.log('DeviceBrandsManagement: model.brandId value:', model.brandId)
    console.log('DeviceBrandsManagement: model.brandId type:', typeof model.brandId)
    setIsEditMode(true)
    setEditingModelId(model._id)
    setModelForm({
      name: model.name || '',
      brandId: model.brandId || '',
      deviceType: model.deviceType || '',
      image: model.image || '',
      specifications: model.specifications || {}
    })
    console.log('DeviceBrandsManagement: modelForm after setting:', {
      name: model.name || '',
      brandId: model.brandId || '',
      deviceType: model.deviceType || '',
      image: model.image || '',
      specifications: model.specifications || {}
    })
    setShowCreateModel(true)
  }

  const handleSaveBrand = async () => {
    try {
      if (!brandForm.name) {
        toast({
          title: "Error",
          description: "Brand name is required",
          variant: "destructive"
        })
        return
      }

      console.log('DeviceBrandsManagement: Creating brand:', brandForm)
      const response = await createBrand(brandForm)
      console.log('DeviceBrandsManagement: Brand created, response:', response)

      toast({
        title: "Success",
        description: "Brand created successfully",
      })

      // Close dialog and reset form first
      setShowCreateBrand(false)
      setBrandForm({ name: '', logo: '' })

      // Refresh brands list immediately
      console.log('DeviceBrandsManagement: Refreshing brands list...')
      console.log('DeviceBrandsManagement: Current brands state before refresh:', brands)
      console.log('DeviceBrandsManagement: Current brands state length before refresh:', brands.length)
      
      const brandsResponse = await getBrands()
      console.log('DeviceBrandsManagement: Brands response after refresh:', brandsResponse)
      console.log('DeviceBrandsManagement: Brands response type after refresh:', typeof brandsResponse)
      console.log('DeviceBrandsManagement: Brands response length after refresh:', brandsResponse?.length)
      console.log('DeviceBrandsManagement: Brands response is array after refresh:', Array.isArray(brandsResponse))
      
      setBrands(brandsResponse)
      console.log('DeviceBrandsManagement: setBrands called after refresh with:', brandsResponse)

    } catch (error) {
      console.error('DeviceBrandsManagement: Error saving brand:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to save brand",
        variant: "destructive"
      })
    }
  }

  const handleSaveModel = async () => {
    try {
      if (!modelForm.name || !modelForm.brandId || !modelForm.deviceType) {
        toast({
          title: "Error",
          description: "Model name, brand, and device type are required",
          variant: "destructive"
        })
        return
      }

      setIsSubmitting(true)

      if (isEditMode && editingModelId) {
        console.log('DeviceBrandsManagement: Updating model:', editingModelId, modelForm)
        await updateModel(editingModelId, modelForm)
        toast({
          title: "Success",
          description: "Model updated successfully",
        })
      } else {
        console.log('DeviceBrandsManagement: Creating model:', modelForm)
        await createModel(modelForm)
        toast({
          title: "Success",
          description: "Model created successfully",
        })
      }

      // Refresh models list if we're viewing models
      if (selectedDeviceType !== "all" && selectedManufacturer !== "all") {
        const modelsResponse = await getModelsByTypeAndManufacturer(selectedDeviceType, selectedManufacturer)
        setModels((modelsResponse as any).models || [])
      }

      setShowCreateModel(false)
      setIsEditMode(false)
      setEditingModelId(null)
      setModelForm({
        name: '',
        brandId: '',
        deviceType: '',
        image: '',
        specifications: {}
      })
    } catch (error) {
      console.error('DeviceBrandsManagement: Error saving model:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to save model",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredBrands = brands.filter(brand =>
    brand.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
              {[...Array(3)].map((_, i) => (
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Smartphone className="h-8 w-8" />
            Device Brands Management
          </h1>
          <p className="text-muted-foreground">
            Manage device brands, models, and types
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Brands
            </CardTitle>
            <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {brands.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Device Types
            </CardTitle>
            <Smartphone className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {deviceTypes.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Manufacturers
            </CardTitle>
            <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {manufacturers.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Total Models
            </CardTitle>
            <Package className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {models.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search brands..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Select value={selectedDeviceType} onValueChange={setSelectedDeviceType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Device Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Device Types</SelectItem>
                  {deviceTypes.map((type) => (
                    <SelectItem key={type._id} value={type._id}>{type.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedDeviceType !== "all" && (
              <div className="w-48">
                <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Manufacturers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Manufacturers</SelectItem>
                    {manufacturers.map((manufacturer) => (
                      <SelectItem key={manufacturer._id} value={manufacturer._id}>{manufacturer.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="brands" className="space-y-4">
        <TabsList>
          <TabsTrigger value="brands">Device Brands</TabsTrigger>
          <TabsTrigger value="types">Device Types</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
        </TabsList>

        <TabsContent value="brands" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleCreateBrand}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Brand
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredBrands.map((brand) => (
              <Card
                key={brand._id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleViewBrand(brand)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      {brand.logo && (
                        <img
                          src={brand.logo}
                          alt={brand.name}
                          className="w-12 h-12 object-contain rounded"
                        />
                      )}
                      <div>
                        <CardTitle className="text-lg">{brand.name}</CardTitle>
                        <CardDescription>
                          {brand.models?.length || 0} models
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewBrand(brand)}
                        className="hover:bg-blue-100 dark:hover:bg-blue-900 rounded p-2"
                        title="View brand details"
                      >
                        <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-green-100 dark:hover:bg-green-900 rounded p-2"
                        title="Edit brand"
                      >
                        <Edit className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-red-100 dark:hover:bg-red-900 rounded p-2"
                        title="Delete brand"
                      >
                        <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Brand ID: {brand._id}
                    </div>
                    {brand.models && brand.models.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {brand.models.slice(0, 3).map((model, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {model.name}
                          </Badge>
                        ))}
                        {brand.models.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{brand.models.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {deviceTypes.map((type) => (
              <Card
                key={type._id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleViewDeviceType(type)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{type.name}</CardTitle>
                      <CardDescription>
                        {type.count} models available
                      </CardDescription>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDeviceType(type)}
                        className="hover:bg-blue-100 dark:hover:bg-blue-900 rounded p-2"
                        title="View device type details"
                      >
                        <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-green-100 dark:hover:bg-green-900 rounded p-2"
                        title="Edit device type"
                      >
                        <Edit className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Type ID: {type._id}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Click to view manufacturers
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleCreateModel}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Model
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => (
              <Card
                key={model._id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleViewModel(model)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      {model.image && (
                        <img
                          src={model.image}
                          alt={model.name}
                          className="w-12 h-12 object-contain rounded"
                        />
                      )}
                      <div>
                        <CardTitle className="text-lg">{model.name}</CardTitle>
                        <CardDescription>
                          {model.manufacturer}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewModel(model)}
                        className="hover:bg-blue-100 dark:hover:bg-blue-900 rounded p-2"
                        title="View model details"
                      >
                        <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditModel(model)}
                        className="hover:bg-green-100 dark:hover:bg-green-900 rounded p-2"
                        title="Edit model"
                      >
                        <Edit className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-red-100 dark:hover:bg-red-900 rounded p-2"
                        title="Delete model"
                      >
                        <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Model ID: {model._id}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Device Type: {model.deviceType}
                    </div>
                    {model.specifications && Object.keys(model.specifications).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(model.specifications).slice(0, 2).map(([key, value]) => (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {key}: {value}
                          </Badge>
                        ))}
                        {Object.keys(model.specifications).length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{Object.keys(model.specifications).length - 2} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Brand Dialog */}
      <Dialog open={showCreateBrand} onOpenChange={setShowCreateBrand}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Brand</DialogTitle>
            <DialogDescription>
              Create a new device brand
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="brandName">Brand Name</Label>
              <Input
                id="brandName"
                value={brandForm.name}
                onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                placeholder="Enter brand name"
              />
            </div>
            <div>
              <Label htmlFor="brandLogo">Logo URL</Label>
              <Input
                id="brandLogo"
                value={brandForm.logo}
                onChange={(e) => setBrandForm({ ...brandForm, logo: e.target.value })}
                placeholder="Enter logo URL"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateBrand(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBrand}>
              Save Brand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Model Dialog - Enhanced Single Page Layout */}
      <Dialog open={showCreateModel} onOpenChange={setShowCreateModel}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {isEditMode ? 'Edit Model' : 'Add New Model'}
            </DialogTitle>
            <DialogDescription>
              {isEditMode ? 'Update device model details' : 'Create a new device model'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 📋 Basic Information Section */}
            <Card className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-[#1a2a5e]">
                  <Package className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="modelName" className="text-sm font-medium">
                      Model Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="modelName"
                      value={modelForm.name}
                      onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                      placeholder="e.g., iPhone 15 Pro"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="modelImage" className="text-sm font-medium">
                      Image URL
                    </Label>
                    <Input
                      id="modelImage"
                      value={modelForm.image}
                      onChange={(e) => setModelForm({ ...modelForm, image: e.target.value })}
                      placeholder="https://example.com/image.jpg"
                      className="bg-background"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 🏭 Device Configuration Section */}
            <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-300">
                  <Smartphone className="h-5 w-5" />
                  Device Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="modelDeviceType" className="text-sm font-medium">
                      Device Type <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={modelForm.deviceType}
                      onValueChange={(value) => setModelForm({ ...modelForm, deviceType: value })}
                    >
                      <SelectTrigger id="modelDeviceType" className="bg-background">
                        <SelectValue placeholder="Select device type" />
                      </SelectTrigger>
                      <SelectContent>
                        {deviceTypes.map((type) => (
                          <SelectItem key={type._id} value={type._id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="modelBrand" className="text-sm font-medium">
                      Brand <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={modelForm.brandId}
                      onValueChange={(value) => setModelForm({ ...modelForm, brandId: value })}
                    >
                      <SelectTrigger id="modelBrand" className="bg-background">
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {brands.map((brand) => (
                          <SelectItem key={brand._id} value={brand._id}>
                            {brand.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ⚙️ Technical Specifications Section */}
            <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-purple-700 dark:text-purple-300">
                  <Package className="h-5 w-5" />
                  Technical Specifications
                </CardTitle>
                <CardDescription className="text-sm">
                  Add key specifications as JSON format (e.g., {`{"screen": "6.1 inch", "storage": "256GB"}`})
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="modelSpecs" className="text-sm font-medium">
                    Specifications (JSON)
                  </Label>
                  <Textarea
                    id="modelSpecs"
                    value={JSON.stringify(modelForm.specifications, null, 2)}
                    onChange={(e) => {
                      try {
                        const specs = JSON.parse(e.target.value)
                        setModelForm({ ...modelForm, specifications: specs })
                      } catch (error) {
                        // Allow typing invalid JSON temporarily
                        console.log('DeviceBrandsManagement: Invalid JSON being typed:', error)
                      }
                    }}
                    placeholder='{"screen": "6.1 inch", "storage": "256GB", "ram": "8GB"}'
                    className="bg-background font-mono text-sm min-h-[120px]"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModel(false)
                setIsEditMode(false)
                setEditingModelId(null)
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveModel}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Model' : 'Create Model')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Brand Dialog */}
      <Dialog open={showViewBrand} onOpenChange={setShowViewBrand}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Brand Details</DialogTitle>
          </DialogHeader>
          {selectedBrand && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {selectedBrand.logo && (
                  <img
                    src={selectedBrand.logo}
                    alt={selectedBrand.name}
                    className="w-16 h-16 object-contain rounded"
                  />
                )}
                <div>
                  <h3 className="text-lg font-semibold">{selectedBrand.name}</h3>
                  <p className="text-sm text-muted-foreground">Brand ID: {selectedBrand._id}</p>
                </div>
              </div>
              {selectedBrand.models && selectedBrand.models.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Models ({selectedBrand.models.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedBrand.models.map((model, index) => (
                      <Badge key={index} variant="secondary">
                        {model.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowViewBrand(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Device Type Dialog */}
      <Dialog open={showViewDeviceType} onOpenChange={setShowViewDeviceType}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Device Type Details</DialogTitle>
            <DialogDescription>
              View manufacturers and models for this device type
            </DialogDescription>
          </DialogHeader>
          {selectedDeviceTypeDetails && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedDeviceTypeDetails.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Type ID: {selectedDeviceTypeDetails._id} | {selectedDeviceTypeDetails.count} models available
                </p>
              </div>

              {manufacturers.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Manufacturers ({manufacturers.length})</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    {manufacturers.map((manufacturer) => (
                      <Card key={manufacturer._id} className="p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <h5 className="font-medium">{manufacturer.name}</h5>
                            <p className="text-sm text-muted-foreground">
                              {manufacturer.count} models
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedManufacturer(manufacturer._id)
                              setShowViewDeviceType(false)
                            }}
                          >
                            View Models
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowViewDeviceType(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Model Dialog */}
      <Dialog open={showViewModel} onOpenChange={setShowViewModel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Model Details</DialogTitle>
          </DialogHeader>
          {selectedModel && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {selectedModel.image && (
                  <img
                    src={selectedModel.image}
                    alt={selectedModel.name}
                    className="w-16 h-16 object-contain rounded"
                  />
                )}
                <div>
                  <h3 className="text-lg font-semibold">{selectedModel.name}</h3>
                  <p className="text-sm text-muted-foreground">Model ID: {selectedModel._id}</p>
                  <p className="text-sm text-muted-foreground">Manufacturer: {selectedModel.manufacturer}</p>
                  <p className="text-sm text-muted-foreground">Device Type: {selectedModel.deviceType}</p>
                </div>
              </div>
              {selectedModel.specifications && Object.keys(selectedModel.specifications).length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Specifications</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedModel.specifications).map(([key, value]) => (
                      <Badge key={key} variant="secondary">
                        {key}: {value}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowViewModel(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}