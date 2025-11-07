import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/useToast"
import { getRepairServices, getAddOnServices, RepairService } from "@/api/services"
import { getDeviceTypes, getManufacturersByDeviceType, getModelsByTypeAndManufacturer, DeviceType, Manufacturer, DeviceModel, searchDevices, SearchResult } from "@/api/devices"
import { createOrder } from "@/api/orders"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Smartphone,
  Upload,
  Plus,
  Check,
  Clock,
  DollarSign,
  Star,
  Shield,
  Zap,
  Package,
  Monitor,
  Tablet,
  Watch,
  Gamepad2,
  Search,
  X
} from "lucide-react"

interface OrderForm {
  deviceType: string
  deviceManufacturer: string
  deviceModel: string
  services: string[]
  addOns: string[]
  customerNotes: string
  photos: FileList
}

interface SelectedDevice {
  _id: string
  name: string
  deviceType: string
  manufacturer: string
  manufacturerId: string
}

const getDeviceTypeIcon = (deviceType: string) => {
  switch (deviceType.toLowerCase()) {
    case 'smartphone':
      return <Smartphone className="h-5 w-5" />
    case 'tablet':
      return <Tablet className="h-5 w-5" />
    case 'laptop':
      return <Monitor className="h-5 w-5" />
    case 'smartwatch':
      return <Watch className="h-5 w-5" />
    case 'gaming-console':
      return <Gamepad2 className="h-5 w-5" />
    default:
      return <Package className="h-5 w-5" />
  }
}

export function NewOrder() {
  const [step, setStep] = useState(1)
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [models, setModels] = useState<DeviceModel[]>([])
  const [services, setServices] = useState<RepairService[]>([])
  const [addOns, setAddOns] = useState<any[]>([])
  const [selectedDeviceType, setSelectedDeviceType] = useState<string>("")
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("")
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([])
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingManufacturers, setLoadingManufacturers] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)

  // Device search autocomplete state
  const [deviceSearchQuery, setDeviceSearchQuery] = useState<string>("")
  const [deviceSearchResults, setDeviceSearchResults] = useState<SearchResult[]>([])
  const [searchingDevices, setSearchingDevices] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<SelectedDevice | null>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<OrderForm>()
  const { toast } = useToast()
  const navigate = useNavigate()

  const watchedDeviceType = watch("deviceType")
  const watchedManufacturer = watch("deviceManufacturer")
  const watchedModel = watch("deviceModel")

  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true)
        console.log("Fetching initial order form data...")
        const [deviceTypesResponse, servicesResponse, addOnsResponse] = await Promise.all([
          getDeviceTypes(),
          getRepairServices(),
          getAddOnServices()
        ])

        setDeviceTypes((deviceTypesResponse as any).deviceTypes || [])
        setServices((servicesResponse as any).services || [])
        setAddOns((addOnsResponse as any).addOns || [])
      } catch (error) {
        console.error("Error fetching initial form data:", error)
        toast({
          title: "Error",
          description: "Failed to load form data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchInitialData()
  }, [])

  // Handle device search
  const handleDeviceSearch = useCallback(async (query: string) => {
    setDeviceSearchQuery(query)

    if (query.length < 2) {
      setDeviceSearchResults([])
      setShowSearchResults(false)
      return
    }

    try {
      setSearchingDevices(true)
      setShowSearchResults(true)
      console.log("Searching devices with query:", query)

      const response = await searchDevices(query)
      setDeviceSearchResults((response as any).devices || [])
    } catch (error) {
      console.error("Error searching devices:", error)
      toast({
        title: "Error",
        description: "Failed to search devices",
        variant: "destructive"
      })
      setDeviceSearchResults([])
    } finally {
      setSearchingDevices(false)
    }
  }, [toast])

  // Handle device selection from search
  const handleSelectDevice = useCallback((device: SearchResult) => {
    console.log("Device selected from search:", device)

    setSelectedDevice({
      _id: device._id,
      name: device.name,
      deviceType: device.deviceType,
      manufacturer: device.manufacturer,
      manufacturerId: device.manufacturerId
    })

    setDeviceSearchQuery(device.displayName)
    setShowSearchResults(false)
    setDeviceSearchResults([])

    // Update form values
    setValue("deviceType", device.deviceType)
    setValue("deviceManufacturer", device.manufacturerId)
    setValue("deviceModel", device._id)

    setSelectedDeviceType(device.deviceType)
    setSelectedManufacturer(device.manufacturerId)
    setSelectedModel(device._id)
  }, [setValue])

  // Handle device type selection (skip if device was selected from search)
  useEffect(() => {
    if (watchedDeviceType && watchedDeviceType !== selectedDeviceType && !selectedDevice) {
      console.log("Device type changed to:", watchedDeviceType)
      setSelectedDeviceType(watchedDeviceType)
      setSelectedManufacturer("")
      setSelectedModel("")
      setManufacturers([])
      setModels([])
      setValue("deviceManufacturer", "")
      setValue("deviceModel", "")

      // Fetch manufacturers for selected device type
      const fetchManufacturers = async () => {
        try {
          setLoadingManufacturers(true)
          console.log("Fetching manufacturers for device type:", watchedDeviceType)
          const response = await getManufacturersByDeviceType(watchedDeviceType)
          setManufacturers((response as any).manufacturers || [])
        } catch (error) {
          console.error("Error fetching manufacturers:", error)
          toast({
            title: "Error",
            description: "Failed to load manufacturers",
            variant: "destructive"
          })
        } finally {
          setLoadingManufacturers(false)
        }
      }

      fetchManufacturers()
    }
  }, [watchedDeviceType, selectedDeviceType, selectedDevice, setValue, toast])

  // Handle manufacturer selection
  useEffect(() => {
    if (watchedManufacturer && watchedManufacturer !== selectedManufacturer && selectedDeviceType) {
      console.log("=== MANUFACTURER SELECTION DEBUG ===");
      console.log("watchedManufacturer:", watchedManufacturer);
      console.log("selectedManufacturer:", selectedManufacturer);
      console.log("selectedDeviceType:", selectedDeviceType);
      console.log("Current manufacturers array:", manufacturers);
      
      setSelectedManufacturer(watchedManufacturer)
      setSelectedModel("")
      setModels([])
      setValue("deviceModel", "")

      // Fetch models for selected device type and manufacturer
      const fetchModels = async () => {
        try {
          setLoadingModels(true)
          console.log("=== FETCHING MODELS ===");
          console.log("Device type for models fetch:", selectedDeviceType);
          console.log("Manufacturer for models fetch:", watchedManufacturer);
          
          const response = await getModelsByTypeAndManufacturer(selectedDeviceType, watchedManufacturer)
          console.log("=== MODELS RESPONSE ===");
          console.log("Full response:", response);
          console.log("Models from response:", (response as any).models);
          console.log("Models array length:", (response as any).models?.length || 0);
          
          setModels((response as any).models || [])
          console.log("=== MODELS SET IN STATE ===");
          console.log("Models set in state:", (response as any).models || []);
        } catch (error) {
          console.error("=== ERROR FETCHING MODELS ===");
          console.error("Error details:", error);
          toast({
            title: "Error",
            description: "Failed to load models",
            variant: "destructive"
          })
        } finally {
          setLoadingModels(false)
          console.log("=== MODELS LOADING FINISHED ===");
        }
      }

      fetchModels()
    }
  }, [watchedManufacturer, selectedManufacturer, selectedDeviceType, setValue, toast])

  // Handle model selection
  useEffect(() => {
    if (watchedModel && watchedModel !== selectedModel) {
      console.log("Model changed to:", watchedModel)
      setSelectedModel(watchedModel)
    }
  }, [watchedModel, selectedModel])

  const handleServiceToggle = useCallback((serviceId: string, checked: boolean) => {
    setSelectedServices(prevServices => {
      const newServices = checked
        ? [...prevServices, serviceId]
        : prevServices.filter(id => id !== serviceId)

      setValue("services", newServices)
      return newServices
    })
  }, [setValue])

  const handleAddOnToggle = useCallback((addOnId: string, checked: boolean) => {
    setSelectedAddOns(prevAddOns => {
      const newAddOns = checked
        ? [...prevAddOns, addOnId]
        : prevAddOns.filter(id => id !== addOnId)

      setValue("addOns", newAddOns)
      return newAddOns
    })
  }, [setValue])

  const calculateTotal = useCallback(() => {
    const serviceTotal = services
      .filter(service => selectedServices.includes(service._id))
      .reduce((sum, service) => sum + service.price, 0)

    const addOnTotal = addOns
      .filter(addOn => selectedAddOns.includes(addOn._id))
      .reduce((sum, addOn) => sum + addOn.price, 0)

    return serviceTotal + addOnTotal
  }, [services, selectedServices, addOns, selectedAddOns])

  // Get unique service categories
  const getServiceCategories = useCallback(() => {
    const categories = new Set(services.map(service => service.category))
    return Array.from(categories).sort()
  }, [services])

  // Filter services by category
  const getFilteredServices = useCallback(() => {
    if (selectedServiceCategory === "all") {
      return services
    }
    return services.filter(service => service.category === selectedServiceCategory)
  }, [services, selectedServiceCategory])

  const onSubmit = async (data: OrderForm) => {
    try {
      setSubmitting(true)
      console.log("Submitting order:", data)

      // Get selected device type, manufacturer, and model names
      const selectedDeviceTypeObj = deviceTypes.find(dt => dt._id === data.deviceType)
      const selectedManufacturerObj = manufacturers.find(m => m._id === data.deviceManufacturer)
      const selectedModelObj = models.find(m => m._id === data.deviceModel)

      // Convert addOns from IDs to full objects as expected by the backend
      const selectedAddOnObjects = addOns
        .filter(addOn => selectedAddOns.includes(addOn._id))
        .map(addOn => ({
          name: addOn.name,
          description: addOn.description,
          price: addOn.price,
          status: 'pending',
          estimatedTime: addOn.estimatedTime || '30 minutes'
        }))

      // Handle photos - convert FileList to array of strings (URLs)
      const photoUrls: string[] = []
      if (data.photos && data.photos.length > 0) {
        for (let i = 0; i < data.photos.length; i++) {
          photoUrls.push(`https://example.com/photo-${i + 1}.jpg`)
        }
      }

      const orderData = {
        deviceType: selectedDeviceTypeObj?.name || data.deviceType,
        deviceBrand: selectedManufacturerObj?.name || data.deviceManufacturer,
        deviceModel: selectedModelObj?.name || data.deviceModel,
        services: selectedServices,
        addOns: selectedAddOnObjects,
        customerNotes: data.customerNotes || '',
        photos: photoUrls,
        totalCost: calculateTotal()
      }

      console.log("Processed order data:", orderData)

      const response = await createOrder(orderData)

      toast({
        title: "Success!",
        description: "Your repair order has been created successfully",
      })

      navigate("/orders")
    } catch (error: any) {
      console.error("Error creating order:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create order",
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const nextStep = () => {
    if (step < 4) setStep(step + 1)
  }

  const prevStep = () => {
    if (step > 1) setStep(step - 1)
  }

  const getStepIcon = (stepNumber: number) => {
    if (stepNumber < step) return <Check className="h-4 w-4" />
    if (stepNumber === step) return <div className="w-2 h-2 bg-primary rounded-full" />
    return <div className="w-2 h-2 bg-muted rounded-full" />
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-10 bg-muted rounded"></div>
              <div className="h-10 bg-muted rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Header */}
      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-6 w-6" />
            Create New Repair Order
          </CardTitle>
          <CardDescription>
            Follow the steps below to submit your device for repair
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {[1, 2, 3, 4].map((stepNumber) => (
                <div key={stepNumber} className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    stepNumber <= step
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted bg-background'
                  }`}>
                    {getStepIcon(stepNumber)}
                  </div>
                  <span className={`text-sm font-medium ${
                    stepNumber <= step ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    Step {stepNumber}
                  </span>
                  {stepNumber < 4 && (
                    <div className={`w-8 h-0.5 ${
                      stepNumber < step ? 'bg-primary' : 'bg-muted'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <Progress value={(step / 4) * 100} className="h-2" />
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Device Selection */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Select Your Device
              </CardTitle>
              <CardDescription>
                Search for your device or choose from the dropdowns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Device Search with Autocomplete */}
              <div className="space-y-2">
                <Label htmlFor="deviceSearch">Search Device</Label>
                <div className="relative">
                  <div className="flex items-center gap-2 relative">
                    <div className="absolute left-3 text-muted-foreground">
                      <Search className="h-4 w-4" />
                    </div>
                    <Input
                      id="deviceSearch"
                      type="text"
                      placeholder="Search by device name, brand, or model (e.g., iPhone 13, Samsung Galaxy)"
                      value={deviceSearchQuery}
                      onChange={(e) => handleDeviceSearch(e.target.value)}
                      onFocus={() => deviceSearchResults.length > 0 && setShowSearchResults(true)}
                      className="pl-10"
                      autoComplete="off"
                    />
                    {selectedDevice && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDevice(null)
                          setDeviceSearchQuery("")
                          setValue("deviceType", "")
                          setValue("deviceManufacturer", "")
                          setValue("deviceModel", "")
                          setSelectedDeviceType("")
                          setSelectedManufacturer("")
                          setSelectedModel("")
                        }}
                        className="absolute right-3 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Search Results Dropdown */}
                  {showSearchResults && deviceSearchQuery.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                      {searchingDevices ? (
                        <div className="p-4 text-center text-muted-foreground">
                          <div className="animate-pulse">Searching devices...</div>
                        </div>
                      ) : deviceSearchResults.length > 0 ? (
                        <div className="py-1">
                          {deviceSearchResults.map((device) => (
                            <button
                              key={device._id}
                              type="button"
                              onClick={() => handleSelectDevice(device)}
                              className="w-full text-left px-4 py-2 hover:bg-accent transition-colors flex items-center justify-between"
                            >
                              <div>
                                <div className="font-medium text-sm">{device.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {device.displayName}
                                </div>
                              </div>
                              {getDeviceTypeIcon(device.deviceType)}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          No devices found
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Type at least 2 characters to search
                </p>
              </div>

              {/* Display selected device */}
              {selectedDevice && (
                <div className="bg-muted/50 rounded-lg p-4 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="text-primary">
                      {getDeviceTypeIcon(selectedDevice.deviceType)}
                    </div>
                    <div>
                      <h4 className="font-medium">{selectedDevice.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedDevice.deviceType} • {selectedDevice.manufacturer}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!selectedDevice}
                >
                  Next Step
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Service Selection with Category Filtering */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Select Repair Services
              </CardTitle>
              <CardDescription>
                Choose the services you need for your device. Filter by category to find services faster.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category Filter Buttons */}
              <div className="space-y-2">
                <Label>Filter by Category</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={selectedServiceCategory === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedServiceCategory("all")}
                  >
                    All Services
                  </Button>
                  {getServiceCategories().map((category) => (
                    <Button
                      key={category}
                      type="button"
                      variant={selectedServiceCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedServiceCategory(category)}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Services Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                {getFilteredServices().map((service) => (
                  <div
                    key={service._id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedServices.includes(service._id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Checkbox
                            checked={selectedServices.includes(service._id)}
                            onCheckedChange={(checked) => handleServiceToggle(service._id, checked as boolean)}
                          />
                          <h3 className="font-semibold">{service.name}</h3>
                          {service.popularity > 80 && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Popular
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className="text-xs">
                            {service.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {service.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {service.estimatedTime}
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${service.price}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {getFilteredServices().length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No services available in this category
                </div>
              )}

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={prevStep}>
                  Previous
                </Button>
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={selectedServices.length === 0}
                >
                  Next Step
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Add-On Services */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Add-On Services
              </CardTitle>
              <CardDescription>
                Enhance your repair with additional services (optional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {addOns.map((addOn) => (
                  <div
                    key={addOn._id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedAddOns.includes(addOn._id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Checkbox
                            checked={selectedAddOns.includes(addOn._id)}
                            onCheckedChange={(checked) => handleAddOnToggle(addOn._id, checked as boolean)}
                          />
                          <h3 className="font-semibold">{addOn.name}</h3>
                          {addOn.category === 'Service' && (
                            <Badge variant="secondary" className="text-xs">
                              <Zap className="h-3 w-3 mr-1" />
                              Express
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {addOn.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {addOn.estimatedTime}
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${addOn.price}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={prevStep}>
                  Previous
                </Button>
                <Button type="button" onClick={nextStep}>
                  Next Step
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Details & Submit */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Order Details
              </CardTitle>
              <CardDescription>
                Add photos and notes for your repair order
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="photos">Device Photos (Optional)</Label>
                <Input
                  id="photos"
                  type="file"
                  multiple
                  accept="image/*"
                  {...register("photos")}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Upload photos of your device to help us assess the damage
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerNotes">Additional Notes (Optional)</Label>
                <Textarea
                  id="customerNotes"
                  placeholder="Describe the issue, when it started, or any other relevant information..."
                  {...register("customerNotes")}
                  rows={4}
                />
              </div>

              {/* Order Summary */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                <h3 className="font-semibold">Order Summary</h3>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Device:</span>
                    <span className="font-medium">
                      {deviceTypes.find(dt => dt._id === watchedDeviceType)?.name} {manufacturers.find(m => m._id === watchedManufacturer)?.name} {models.find(m => m._id === watchedModel)?.name}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-sm font-medium">Services:</span>
                    {services.filter(s => selectedServices.includes(s._id)).map(service => (
                      <div key={service._id} className="flex justify-between text-sm ml-4">
                        <span>• {service.name}</span>
                        <span>${service.price}</span>
                      </div>
                    ))}
                  </div>

                  {selectedAddOns.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-sm font-medium">Add-ons:</span>
                      {addOns.filter(a => selectedAddOns.includes(a._id)).map(addOn => (
                        <div key={addOn._id} className="flex justify-between text-sm ml-4">
                          <span>• {addOn.name}</span>
                          <span>${addOn.price}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>${calculateTotal()}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={prevStep}>
                  Previous
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating Order..." : "Create Order"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  )
}