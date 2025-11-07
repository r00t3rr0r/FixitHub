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
import { UnlockPatternInput } from "@/components/inspection/UnlockPatternInput"
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
  X,
  Lock,
  BookOpen,
  User,
  Mail,
  Phone,
  ShoppingCart as ShoppingCartIcon
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

  // Unlock code/pattern state
  const [unlockPattern, setUnlockPattern] = useState<string[]>([])
  const [unlockCode, setUnlockCode] = useState<string>("")
  const [noDeviceLock, setNoDeviceLock] = useState<boolean>(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

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
  }, [watchedDeviceType, selectedDeviceType, selectedDevice])

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
  }, [watchedManufacturer, selectedManufacturer, selectedDeviceType])

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
    if (step < 5) setStep(step + 1)
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
              {[1, 2, 3, 4, 5].map((stepNumber) => (
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
                  {stepNumber < 5 && (
                    <div className={`w-8 h-0.5 ${
                      stepNumber < step ? 'bg-primary' : 'bg-muted'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <Progress value={(step / 5) * 100} className="h-2" />
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

        {/* Step 3: Summary, Unlock Code, and Add-On Services */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Order Summary Card */}
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order Summary
                </CardTitle>
                <CardDescription>
                  Review your device and service details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Customer Information */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      Customer Information
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>Admin User</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span>admin@example.com</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>+1 (555) 000-0000</span>
                      </div>
                    </div>
                  </div>

                  {/* Selected Device Summary */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-primary" />
                      Device Details
                    </h4>
                    <div className="space-y-2 text-sm">
                      {selectedDevice ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-20">Device:</span>
                            <Badge variant="secondary" className="gap-1">
                              {getDeviceTypeIcon(selectedDevice.deviceType)}
                              {selectedDevice.deviceType}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-20">Brand:</span>
                            <span className="font-medium">{selectedDevice.manufacturer}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-20">Model:</span>
                            <span className="font-medium">{selectedDevice.name}</span>
                          </div>
                        </>
                      ) : (
                        <p className="text-muted-foreground text-xs">No device selected</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Selected Services */}
                {selectedServices.length > 0 && (
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="font-semibold text-sm">Selected Services</h4>
                    <div className="space-y-2">
                      {services.filter(s => selectedServices.includes(s._id)).map(service => (
                        <div key={service._id} className="flex items-start justify-between p-2 rounded hover:bg-muted/50">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{service.name}</p>
                            <p className="text-xs text-muted-foreground">{service.description}</p>
                          </div>
                          <Badge variant="outline">${service.price}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Knowledge Base Articles */}
                {selectedServices.length > 0 && (
                  <div className="space-y-3 pt-4 border-t bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      Related Information
                    </h4>
                    <div className="space-y-2 text-sm">
                      {services.filter(s => selectedServices.includes(s._id)).map(service => (
                        <div key={service._id} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium text-blue-900 dark:text-blue-100">
                              {service.name} Guide
                            </p>
                            {service.knowledgeBaseArticles && service.knowledgeBaseArticles.length > 0 && (
                              <p className="text-xs text-blue-700 dark:text-blue-200 mt-1">
                                📚 {service.knowledgeBaseArticles.length} article{service.knowledgeBaseArticles.length !== 1 ? "s" : ""} available
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Unlock Code/Pattern Input Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Device Lock Information
                </CardTitle>
                <CardDescription>
                  Tell us about your device lock (pattern, PIN, or no lock)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UnlockPatternInput
                  onPatternChange={setUnlockPattern}
                  onUnlockCodeChange={setUnlockCode}
                  onNoLockChange={setNoDeviceLock}
                  pattern={unlockPattern}
                  unlockCode={unlockCode}
                  noLock={noDeviceLock}
                />
              </CardContent>
            </Card>

            {/* Add-On Services Card */}
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
                {addOns.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No add-on services available
                  </p>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      {addOns.map((addOn) => (
                        <div
                          key={addOn._id}
                          className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                            selectedAddOns.includes(addOn._id)
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => handleAddOnToggle(addOn._id, !selectedAddOns.includes(addOn._id))}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Checkbox
                                  checked={selectedAddOns.includes(addOn._id)}
                                  onCheckedChange={(checked) => handleAddOnToggle(addOn._id, checked as boolean)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <h3 className="font-semibold text-sm">{addOn.name}</h3>
                                {addOn.category === 'Service' && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Zap className="h-3 w-3 mr-1" />
                                    Express
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mb-3">
                                {addOn.description}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {addOn.estimatedTime || 'N/A'}
                                </div>
                                <div className="flex items-center gap-1 font-semibold text-foreground">
                                  <DollarSign className="h-3 w-3" />
                                  {addOn.price}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Selected Add-ons Summary */}
                    {selectedAddOns.length > 0 && (
                      <div className="mt-4 p-3 rounded-lg bg-muted/50 space-y-2">
                        <p className="text-sm font-medium">Selected Add-ons:</p>
                        {addOns.filter(a => selectedAddOns.includes(a._id)).map(addOn => (
                          <div key={addOn._id} className="flex justify-between text-xs text-muted-foreground">
                            <span>• {addOn.name}</span>
                            <span>${addOn.price}</span>
                          </div>
                        ))}
                        <div className="pt-2 border-t flex justify-between text-sm font-semibold">
                          <span>Add-ons Total:</span>
                          <span>
                            ${addOns.filter(a => selectedAddOns.includes(a._id)).reduce((sum, a) => sum + a.price, 0)}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" onClick={prevStep}>
                    Previous
                  </Button>
                  <Button type="button" onClick={nextStep}>
                    Review & Submit
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Details & Submit */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Final Details & Submit
              </CardTitle>
              <CardDescription>
                Add photos and notes, then review and submit your repair order
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

              {/* Unlock Information Review */}
              {(unlockPattern.length > 0 || unlockCode || noDeviceLock) && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Device Lock Information
                  </h4>
                  <div className="text-sm space-y-2">
                    {noDeviceLock && (
                      <p className="text-blue-900 dark:text-blue-100">
                        ✓ Device has no lock
                      </p>
                    )}
                    {unlockPattern.length > 0 && (
                      <p className="text-blue-900 dark:text-blue-100">
                        ✓ Pattern lock: <span className="font-mono">{unlockPattern.join(' → ')}</span>
                      </p>
                    )}
                    {unlockCode && (
                      <p className="text-blue-900 dark:text-blue-100">
                        ✓ Unlock code provided (kept confidential)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Selected Add-ons Review */}
              {selectedAddOns.length > 0 && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Selected Add-ons
                  </h4>
                  <div className="space-y-1 text-sm">
                    {addOns.filter(a => selectedAddOns.includes(a._id)).map(addOn => (
                      <div key={addOn._id} className="flex justify-between text-green-900 dark:text-green-100">
                        <span>✓ {addOn.name}</span>
                        <span>${addOn.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Complete Order Summary */}
              <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg p-4 space-y-4 border-2 border-primary/20">
                <h3 className="font-semibold flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Order Summary
                </h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Device:</span>
                    <span className="font-medium">
                      {selectedDevice
                        ? `${selectedDevice.deviceType} • ${selectedDevice.manufacturer} • ${selectedDevice.name}`
                        : "Not selected"
                      }
                    </span>
                  </div>

                  {selectedServices.length > 0 && (
                    <div className="pt-2 border-t space-y-1">
                      <span className="text-muted-foreground block font-medium">Services:</span>
                      {services.filter(s => selectedServices.includes(s._id)).map(service => (
                        <div key={service._id} className="flex justify-between ml-2">
                          <span>• {service.name}</span>
                          <span>${service.price}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedAddOns.length > 0 && (
                    <div className="pt-2 border-t space-y-1">
                      <span className="text-muted-foreground block font-medium">Add-ons:</span>
                      {addOns.filter(a => selectedAddOns.includes(a._id)).map(addOn => (
                        <div key={addOn._id} className="flex justify-between ml-2">
                          <span>• {addOn.name}</span>
                          <span>${addOn.price}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t pt-3 mt-3 flex justify-between font-bold text-base">
                    <span>Total Cost:</span>
                    <span className="text-primary">${calculateTotal()}</span>
                  </div>
                </div>
              </div>

              {/* Terms Agreement */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  By submitting this order, you agree to our repair terms and conditions. Your device lock information will be kept confidential and used only by our authorized technicians. You will receive a confirmation email with your order number and expected repair timeline.
                </p>
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={prevStep}>
                  Previous
                </Button>
                <Button type="button" onClick={nextStep} size="lg" className="min-w-[200px]">
                  Review Order in Cart
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Add to Cart Confirmation */}
        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCartIcon className="h-5 w-5" />
                Add to Cart
              </CardTitle>
              <CardDescription>
                Review and add your repair order to your shopping cart
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Order Summary */}
              <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg p-4 space-y-4 border-2 border-primary/20">
                <h3 className="font-semibold flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order Details
                </h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Device:</span>
                    <span className="font-medium">
                      {selectedDevice
                        ? `${selectedDevice.deviceType} • ${selectedDevice.manufacturer} • ${selectedDevice.name}`
                        : "Not selected"
                      }
                    </span>
                  </div>

                  {selectedServices.length > 0 && (
                    <div className="pt-2 border-t space-y-1">
                      <span className="text-muted-foreground block font-medium">Services:</span>
                      {services.filter(s => selectedServices.includes(s._id)).map(service => (
                        <div key={service._id} className="flex justify-between ml-2">
                          <span>• {service.name}</span>
                          <span>${service.price}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedAddOns.length > 0 && (
                    <div className="pt-2 border-t space-y-1">
                      <span className="text-muted-foreground block font-medium">Add-ons:</span>
                      {addOns.filter(a => selectedAddOns.includes(a._id)).map(addOn => (
                        <div key={addOn._id} className="flex justify-between ml-2">
                          <span>• {addOn.name}</span>
                          <span>${addOn.price}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t pt-3 mt-3 flex justify-between font-bold text-base">
                    <span>Total Cost:</span>
                    <span className="text-primary">${calculateTotal()}</span>
                  </div>
                </div>
              </div>

              {/* Information Message */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  <ShoppingCartIcon className="h-4 w-4" />
                  Add to Cart
                </h4>
                <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
                  Your repair order will be added to your shopping cart. You can review, modify, apply discount codes, and manage your orders before proceeding to checkout. This gives you flexibility to add multiple services, compare pricing, and manage your repairs all in one place.
                </p>
              </div>

              {/* Benefits */}
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Review & Modify</p>
                    <p className="text-xs text-muted-foreground">Make changes before checkout</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Apply Discount Codes</p>
                    <p className="text-xs text-muted-foreground">Save with promo codes</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Multiple Orders</p>
                    <p className="text-xs text-muted-foreground">Add multiple repairs to cart</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Secure Checkout</p>
                    <p className="text-xs text-muted-foreground">Safe payment processing</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-4">
                <Button type="button" variant="outline" onClick={prevStep}>
                  Previous
                </Button>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigate("/shop")
                      toast({
                        title: "Order ready!",
                        description: "Add your repair order to the cart and continue shopping"
                      })
                    }}
                  >
                    Continue Shopping
                  </Button>
                  <Button
                    type="button"
                    disabled={submitting}
                    size="lg"
                    className="min-w-[250px]"
                    onClick={async () => {
                      try {
                        setSubmitting(true)
                        console.log("Adding order to cart and redirecting...")

                        // Create order data
                        const selectedDeviceTypeObj = deviceTypes.find(dt => dt._id === selectedDeviceType)
                        const selectedManufacturerObj = manufacturers.find(m => m._id === selectedManufacturer)
                        const selectedModelObj = models.find(m => m._id === selectedModel)

                        const selectedAddOnObjects = addOns
                          .filter(addOn => selectedAddOns.includes(addOn._id))
                          .map(addOn => ({
                            name: addOn.name,
                            description: addOn.description,
                            price: addOn.price,
                            status: 'pending',
                            estimatedTime: addOn.estimatedTime || '30 minutes'
                          }))

                        const photoUrls: string[] = []
                        // Note: Photos would be handled separately in a real implementation

                        const orderData = {
                          deviceType: selectedDeviceTypeObj?.name || selectedDeviceType,
                          deviceBrand: selectedManufacturerObj?.name || selectedManufacturer,
                          deviceModel: selectedModelObj?.name || selectedModel,
                          services: selectedServices,
                          addOns: selectedAddOnObjects,
                          customerNotes: watch("customerNotes") || '',
                          photos: photoUrls,
                          totalCost: calculateTotal()
                        }

                        console.log("Order data prepared:", orderData)

                        // Redirect to cart with a flag or message
                        navigate("/cart", {
                          state: {
                            newOrder: orderData,
                            message: "Your repair order has been added to your cart!"
                          }
                        })

                        toast({
                          title: "Success!",
                          description: "Your repair order has been added to your cart. You can now review it in your shopping cart.",
                        })
                      } catch (error: any) {
                        console.error("Error adding to cart:", error)
                        toast({
                          title: "Error",
                          description: error.message || "Failed to add order to cart",
                          variant: "destructive"
                        })
                      } finally {
                        setSubmitting(false)
                      }
                    }}
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Adding to Cart...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <ShoppingCartIcon className="h-4 w-4" />
                        Add to Cart & Review
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  )
}