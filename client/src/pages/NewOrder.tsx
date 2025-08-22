import { useState, useEffect } from "react"
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
import { getDeviceBrands, getRepairServices, getAddOnServices, DeviceBrand, RepairService } from "@/api/services"
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
  Package
} from "lucide-react"

interface OrderForm {
  deviceBrand: string
  deviceModel: string
  services: string[]
  addOns: string[]
  customerNotes: string
  photos: FileList
}

export function NewOrder() {
  const [step, setStep] = useState(1)
  const [brands, setBrands] = useState<DeviceBrand[]>([])
  const [services, setServices] = useState<RepairService[]>([])
  const [addOns, setAddOns] = useState<any[]>([])
  const [selectedBrand, setSelectedBrand] = useState<DeviceBrand | null>(null)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<OrderForm>()
  const { toast } = useToast()
  const navigate = useNavigate()

  const watchedBrand = watch("deviceBrand")
  const watchedModel = watch("deviceModel")

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        console.log("Fetching order form data...")
        const [brandsResponse, servicesResponse, addOnsResponse] = await Promise.all([
          getDeviceBrands(),
          getRepairServices(),
          getAddOnServices()
        ])

        setBrands((brandsResponse as any).brands || [])
        setServices((servicesResponse as any).services || [])
        setAddOns((addOnsResponse as any).addOns || [])
      } catch (error) {
        console.error("Error fetching form data:", error)
        toast({
          title: "Error",
          description: "Failed to load form data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [toast])

  useEffect(() => {
    if (watchedBrand) {
      const brand = brands.find(b => b._id === watchedBrand)
      setSelectedBrand(brand || null)
      setValue("deviceModel", "")
    }
  }, [watchedBrand, brands, setValue])

  const handleServiceToggle = (serviceId: string) => {
    const newServices = selectedServices.includes(serviceId)
      ? selectedServices.filter(id => id !== serviceId)
      : [...selectedServices, serviceId]

    setSelectedServices(newServices)
    setValue("services", newServices)
  }

  const handleAddOnToggle = (addOnId: string) => {
    const newAddOns = selectedAddOns.includes(addOnId)
      ? selectedAddOns.filter(id => id !== addOnId)
      : [...selectedAddOns, addOnId]

    setSelectedAddOns(newAddOns)
    setValue("addOns", newAddOns)
  }

  const calculateTotal = () => {
    const serviceTotal = services
      .filter(service => selectedServices.includes(service._id))
      .reduce((sum, service) => sum + service.price, 0)

    const addOnTotal = addOns
      .filter(addOn => selectedAddOns.includes(addOn._id))
      .reduce((sum, addOn) => sum + addOn.price, 0)

    return serviceTotal + addOnTotal
  }

  const onSubmit = async (data: OrderForm) => {
    try {
      setSubmitting(true)
      console.log("Submitting order:", data)

      const orderData = {
        ...data,
        services: selectedServices,
        addOns: selectedAddOns,
        totalCost: calculateTotal()
      }

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
                <Smartphone className="h-5 w-5" />
                Select Your Device
              </CardTitle>
              <CardDescription>
                Choose your device brand and model
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="deviceBrand">Device Brand</Label>
                <Select onValueChange={(value) => setValue("deviceBrand", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((brand) => (
                      <SelectItem key={brand._id} value={brand._id}>
                        <div className="flex items-center gap-2">
                          <img src={brand.logo} alt={brand.name} className="w-6 h-6" />
                          {brand.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.deviceBrand && (
                  <p className="text-sm text-destructive">Please select a device brand</p>
                )}
              </div>

              {selectedBrand && (
                <div className="space-y-2">
                  <Label htmlFor="deviceModel">Device Model</Label>
                  <Select onValueChange={(value) => setValue("deviceModel", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedBrand.models.map((model) => (
                        <SelectItem key={model._id} value={model._id}>
                          <div className="flex items-center gap-2">
                            <img src={model.image} alt={model.name} className="w-6 h-6 rounded" />
                            {model.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.deviceModel && (
                    <p className="text-sm text-destructive">Please select a device model</p>
                  )}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!watchedBrand || !watchedModel}
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
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedServices.includes(service._id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handleServiceToggle(service._id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Checkbox
                            checked={selectedServices.includes(service._id)}
                            onChange={() => handleServiceToggle(service._id)}
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
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedAddOns.includes(addOn._id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handleAddOnToggle(addOn._id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Checkbox
                            checked={selectedAddOns.includes(addOn._id)}
                            onChange={() => handleAddOnToggle(addOn._id)}
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
                      {selectedBrand?.name} {selectedBrand?.models.find(m => m._id === watchedModel)?.name}
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