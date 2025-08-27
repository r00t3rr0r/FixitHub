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
import { getDeviceTypes, getManufacturersByDeviceType, getModelsByTypeAndManufacturer, DeviceType, Manufacturer, DeviceModel } from "@/api/devices"
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
  Gamepad2
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
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingManufacturers, setLoadingManufacturers] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)

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

  // Handle device type selection
  useEffect(() => {
    if (watchedDeviceType && watchedDeviceType !== selectedDeviceType) {
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
  }, [watchedDeviceType, selectedDeviceType, setValue, toast])

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
                Choose your device type, manufacturer, and model
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Device Type Selection */}
              <div className="space-y-2">
                <Label htmlFor="deviceType">Device Type</Label>
                <Select onValueChange={(value) => setValue("deviceType", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select device type" />
                  </SelectTrigger>
                  <SelectContent>
                    {deviceTypes.map((deviceType) => (
                      <SelectItem key={deviceType._id} value={deviceType._id}>
                        <div className="flex items-center gap-2">
                          {getDeviceTypeIcon(deviceType.name)}
                          <span>{deviceType.name}</span>
                          <Badge variant="secondary" className="ml-auto">
                            {deviceType.count} services
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.deviceType && (
                  <p className="text-sm text-destructive">Please select a device type</p>
                )}
              </div>

              {/* Manufacturer Selection */}
              {selectedDeviceType && (
                <div className="space-y-2">
                  <Label htmlFor="deviceManufacturer">Manufacturer/Brand</Label>
                  {loadingManufacturers ? (
                    <div className="h-10 bg-muted rounded animate-pulse"></div>
                  ) : (
                    <Select onValueChange={(value) => setValue("deviceManufacturer", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select manufacturer" />
                      </SelectTrigger>
                      <SelectContent>
                        {manufacturers.map((manufacturer) => (
                          <SelectItem key={manufacturer._id} value={manufacturer._id}>
                            <div className="flex items-center gap-2">
                              <span>{manufacturer.name}</span>
                              <Badge variant="secondary" className="ml-auto">
                                {manufacturer.count} models
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {errors.deviceManufacturer && (
                    <p className="text-sm text-destructive">Please select a manufacturer</p>
                  )}
                </div>
              )}

              {/* Model Selection */}
              {selectedManufacturer && (
                <div className="space-y-2">
                  <Label htmlFor="deviceModel">Device Model</Label>
                  {loadingModels ? (
                    <div className="h-10 bg-muted rounded animate-pulse"></div>
                  ) : (
                    <Select onValueChange={(value) => setValue("deviceModel", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((model) => (
                          <SelectItem key={model._id} value={model._id}>
                            <div className="flex items-center gap-2">
                              <span>{model.name}</span>
                              <Badge variant="secondary" className="ml-auto">
                                {model.count} services
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {errors.deviceModel && (
                    <p className="text-sm text-destructive">Please select a device model</p>
                  )}
                </div>
              )}

              {/* Selection Summary */}
              {selectedDeviceType && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Selected Device:</h4>
                  <div className="flex items-center gap-2 text-sm">
                    {getDeviceTypeIcon(deviceTypes.find(dt => dt._id === selectedDeviceType)?.name || "")}
                    <span>
                      {deviceTypes.find(dt => dt._id === selectedDeviceType)?.name}
                      {selectedManufacturer && ` • ${manufacturers.find(m => m._id === selectedManufacturer)?.name}`}
                      {selectedModel && ` • ${models.find(m => m._id === selectedModel)?.name}`}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!watchedDeviceType || !watchedManufacturer || !watchedModel}
                >
                  Next Step
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Service Selection */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Select Repair Services
              </CardTitle>
              <CardDescription>
                Choose the services you need for your device
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {services.map((service) => (
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