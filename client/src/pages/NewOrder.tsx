import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
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
import { addRepairOrderToCart } from "@/api/shop"
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
  ShoppingCart as ShoppingCartIcon,
  ChevronRight,
  Sparkles,
  Info,
  FileText,
  AlertCircle,
  Droplets,
  Wrench
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
  const { t } = useTranslation()
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
  const [quantity, setQuantity] = useState<number>(1)

  // Related Information checkbox state
  const [relatedInfoAcknowledged, setRelatedInfoAcknowledged] = useState<boolean>(false)

  // Additional repair information state
  const [errorDescription, setErrorDescription] = useState<string>("")
  const [waterDamage, setWaterDamage] = useState<string>("")
  const [previousRepairAttempts, setPreviousRepairAttempts] = useState<string>("")
  const [previousRepairDetails, setPreviousRepairDetails] = useState<string>("")
  const [itemCondition, setItemCondition] = useState<string>("")

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

        // Check if device was pre-selected from homepage
        const preSelectedDeviceJson = sessionStorage.getItem('selectedDevice')
        if (preSelectedDeviceJson) {
          try {
            const preSelectedDevice = JSON.parse(preSelectedDeviceJson)
            console.log("Pre-selected device from homepage:", preSelectedDevice)

            // Set the selected device
            setSelectedDevice(preSelectedDevice)
            setDeviceSearchQuery(preSelectedDevice.name)

            // Find the device type ID from the loaded device types
            const deviceTypeObj = ((deviceTypesResponse as any).deviceTypes || []).find(
              (dt: DeviceType) => dt.name.toLowerCase() === preSelectedDevice.deviceType.toLowerCase()
            )

            if (deviceTypeObj) {
              setValue("deviceType", deviceTypeObj._id)
              setValue("deviceManufacturer", preSelectedDevice.manufacturerId)
              setValue("deviceModel", preSelectedDevice._id)

              setSelectedDeviceType(deviceTypeObj._id)
              setSelectedManufacturer(preSelectedDevice.manufacturerId)
              setSelectedModel(preSelectedDevice._id)
            }

            // Clear the session storage
            sessionStorage.removeItem('selectedDevice')

            // Show success message
            toast({
              title: t('newOrder.deviceSelection.deviceSelected'),
              description: t('newOrder.deviceSelection.preSelectedSuccess', { device: preSelectedDevice.name })
            })
          } catch (error) {
            console.error("Error processing pre-selected device:", error)
          }
        }
      } catch (error) {
        console.error("Error fetching initial form data:", error)
        toast({
          title: t('common.error'),
          description: t('newOrder.deviceSelection.loadError'),
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchInitialData()
  }, [toast, setValue])

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
        title: t('common.error'),
        description: t('newOrder.errors.searchDevices'),
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
            title: t('common.error'),
            description: t('newOrder.serviceSelection.loadManufacturersError'),
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
            title: t('common.error'),
            description: t('newOrder.serviceSelection.loadModelsError'),
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

      // Ensure we have proper device names, not IDs
      let deviceBrandName = selectedManufacturerObj?.name;
      let deviceModelName = selectedModelObj?.name;

      // If we couldn't find the selected objects, try to search by ID in the data
      if (!deviceBrandName && data.deviceManufacturer) {
        // Search through all loaded manufacturers to find the matching one
        const found = manufacturers.find(m => m._id === data.deviceManufacturer);
        deviceBrandName = found?.name || data.deviceManufacturer;
      }

      if (!deviceModelName && data.deviceModel) {
        // Search through all loaded models to find the matching one
        const found = models.find(m => m._id === data.deviceModel);
        deviceModelName = found?.name || data.deviceModel;
      }

      const orderData = {
        deviceType: selectedDeviceTypeObj?.name || data.deviceType,
        deviceBrand: deviceBrandName || data.deviceManufacturer,
        deviceModel: deviceModelName || data.deviceModel,
        services: selectedServices,
        addOns: selectedAddOnObjects,
        customerNotes: data.customerNotes || '',
        photos: photoUrls,
        totalCost: calculateTotal(),
        // Device unlock information
        unlockPattern: unlockPattern,
        unlockCode: unlockCode,
        noLock: noDeviceLock,
        // Additional repair information
        errorDescription: errorDescription,
        waterDamage: waterDamage,
        previousRepairAttempts: previousRepairAttempts,
        previousRepairDetails: previousRepairDetails,
        itemCondition: itemCondition
      }

      console.log('Order data - Device Brand:', deviceBrandName, 'Device Model:', deviceModelName);

      console.log("Processed order data:", orderData)

      const response = await createOrder(orderData)

      toast({
        title: t('common.success'),
        description: t('newOrder.success.orderCreated'),
      })

      navigate("/orders")
    } catch (error: any) {
      console.error("Error creating order:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('newOrder.errors.createOrder'),
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const nextStep = () => {
    // Special validation for Step 3: Check if Related Information is acknowledged and repair info is filled
    if (step === 3) {
      // Validate required repair information fields
      if (!errorDescription.trim()) {
        toast({
          title: t('common.error'),
          description: t('newOrder.repairInfo.errorDescriptionRequired'),
          variant: "destructive"
        })
        document.getElementById('errorDescription')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }

      if (!waterDamage) {
        toast({
          title: t('common.error'),
          description: t('newOrder.repairInfo.waterDamageRequired'),
          variant: "destructive"
        })
        return
      }

      if (!previousRepairAttempts) {
        toast({
          title: t('common.error'),
          description: t('newOrder.repairInfo.previousRepairRequired'),
          variant: "destructive"
        })
        return
      }

      if (!itemCondition) {
        toast({
          title: t('common.error'),
          description: t('newOrder.repairInfo.itemConditionRequired'),
          variant: "destructive"
        })
        return
      }

      // Check related information acknowledgement
      const hasRelatedInfo = selectedServices.length > 0 &&
        services.filter(s => selectedServices.includes(s._id)).some(s =>
          s.externalRepairInfo || (s.linkedKnowledgeBaseArticles && s.linkedKnowledgeBaseArticles.length > 0)
        )

      if (hasRelatedInfo && !relatedInfoAcknowledged) {
        toast({
          title: t('common.error'),
          description: "Please confirm that you have read and understood the related information before proceeding.",
          variant: "destructive"
        })
        // Scroll to the checkbox
        const checkboxElement = document.getElementById('related-info-checkbox')
        if (checkboxElement) {
          checkboxElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        return
      }
    }

    if (step < 5) {
      setStep(step + 1)
      // Smooth scroll to top on step change
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1)
      // Smooth scroll to top on step change
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Reset checkbox when leaving step 3 or when selected services change
  useEffect(() => {
    if (step !== 3) {
      setRelatedInfoAcknowledged(false)
    }
  }, [step])

  useEffect(() => {
    // Reset checkbox when services change
    setRelatedInfoAcknowledged(false)
  }, [selectedServices])

  const getStepIcon = (stepNumber: number) => {
    if (stepNumber < step) return <Check className="h-4 w-4" />
    if (stepNumber === step) return <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
    return <div className="w-2 h-2 bg-muted rounded-full" />
  }

  const getStepTitle = (stepNumber: number) => {
    switch (stepNumber) {
      case 1: return t('newOrder.step1')
      case 2: return t('newOrder.step2')
      case 3: return t('newOrder.step3')
      case 4: return t('newOrder.step4')
      case 5: return t('newOrder.step5')
      default: return t('newOrder.stepOf', { current: stepNumber, total: 5 })
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
        <Card className="animate-pulse border-2 shadow-lg">
          <CardHeader>
            <div className="h-8 bg-gradient-to-r from-muted via-muted/50 to-muted rounded w-1/3 animate-pulse"></div>
            <div className="h-4 bg-gradient-to-r from-muted via-muted/50 to-muted rounded w-2/3 mt-2 animate-pulse"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-12 bg-gradient-to-r from-muted via-muted/50 to-muted rounded animate-pulse"></div>
              <div className="h-12 bg-gradient-to-r from-muted via-muted/50 to-muted rounded animate-pulse"></div>
              <div className="h-12 bg-gradient-to-r from-muted via-muted/50 to-muted rounded animate-pulse"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-8">
      {/* Enhanced Progress Header with Compact Design */}
      <Card className="bg-gradient-to-br from-yellow-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border-2 border-yellow-200/50 dark:border-yellow-600/20 shadow-xl backdrop-blur-sm sticky top-4 z-40 animate-in slide-in-from-top duration-700">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-1.5 bg-yellow-400 rounded-lg shadow-md">
              <Sparkles className="h-5 w-5 text-gray-900 animate-pulse" />
            </div>
            <span className="bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent font-bold">
              {t('newOrder.title')}
            </span>
          </CardTitle>
          <CardDescription className="text-sm">
            {t('newOrder.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Compact Step Indicators */}
          <div className="flex items-center justify-between mb-3 overflow-x-auto pb-2">
            {[1, 2, 3, 4, 5].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center gap-1.5 flex-shrink-0">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-500 ${
                      stepNumber < step
                        ? 'border-green-500 bg-green-500 text-white shadow-md shadow-green-500/50'
                        : stepNumber === step
                        ? 'border-yellow-400 bg-yellow-400 text-gray-900 shadow-md shadow-yellow-400/50 scale-110 animate-pulse'
                        : 'border-gray-300 bg-white dark:bg-gray-800 text-gray-400'
                    }`}
                  >
                    {stepNumber < step ? (
                      <Check className="h-4 w-4 animate-in zoom-in duration-300" />
                    ) : (
                      <span className="font-bold text-xs">{stepNumber}</span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-medium transition-all duration-300 text-center max-w-[60px] ${
                      stepNumber <= step
                        ? 'text-gray-900 dark:text-white font-semibold'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {getStepTitle(stepNumber)}
                  </span>
                </div>
                {stepNumber < 5 && (
                  <div className="relative w-8 h-0.5 mx-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className={`absolute inset-0 transition-all duration-700 ${
                        stepNumber < step
                          ? 'bg-gradient-to-r from-green-500 to-green-400 w-full'
                          : 'bg-yellow-400 w-0'
                      }`}
                      style={{
                        width: stepNumber < step ? '100%' : '0%'
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Compact Progress Bar */}
          <div className="relative">
            <Progress
              value={(step / 5) * 100}
              className="h-2 shadow-inner overflow-hidden"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                 style={{
                   backgroundSize: '200% 100%',
                   animation: 'shimmer 2s infinite'
                 }}
            />
          </div>

          {/* Compact Step Progress Text */}
          <p className="text-center text-xs text-muted-foreground mt-2 font-medium">
            {t('newOrder.stepOf', { current: step, total: 5 })} - {getStepTitle(step)}
          </p>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Device Selection with Compact Design */}
        {step === 1 && (
          <Card className="animate-in slide-in-from-right duration-500 border-2 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 bg-blue-500 rounded-lg shadow-md">
                  <Package className="h-4 w-4 text-white" />
                </div>
                <span>{t('newOrder.deviceSelection.title')}</span>
              </CardTitle>
              <CardDescription className="text-sm">
                {t('newOrder.deviceSelection.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              {/* Compact Device Search with Autocomplete */}
              <div className="space-y-2">
                <Label htmlFor="deviceSearch" className="text-sm font-semibold">{t('newOrder.deviceSelection.searchLabel')}</Label>
                <div className="relative">
                  <div className="flex items-center gap-2 relative group">
                    <div className="absolute left-3 text-muted-foreground transition-colors group-focus-within:text-yellow-500">
                      <Search className="h-4 w-4" />
                    </div>
                    <Input
                      id="deviceSearch"
                      type="text"
                      placeholder={t('newOrder.deviceSelection.searchPlaceholder')}
                      value={deviceSearchQuery}
                      onChange={(e) => handleDeviceSearch(e.target.value)}
                      onFocus={() => deviceSearchResults.length > 0 && setShowSearchResults(true)}
                      className="pl-10 h-10 text-sm border-2 focus:border-yellow-400 focus:ring-yellow-400/20 transition-all duration-300"
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
                        className="absolute right-3 text-muted-foreground hover:text-red-500 transition-colors duration-200"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  {/* Enhanced Search Results Dropdown */}
                  {showSearchResults && deviceSearchQuery.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border-2 border-yellow-200 dark:border-yellow-600/20 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto animate-in slide-in-from-top duration-300">
                      {searchingDevices ? (
                        <div className="p-6 text-center">
                          <div className="inline-flex items-center gap-3 text-muted-foreground">
                            <div className="h-5 w-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                            <span className="animate-pulse">{t('newOrder.deviceSelection.searching')}</span>
                          </div>
                        </div>
                      ) : deviceSearchResults.length > 0 ? (
                        <div className="py-2">
                          {deviceSearchResults.map((device, index) => (
                            <button
                              key={device._id}
                              type="button"
                              onClick={() => handleSelectDevice(device)}
                              className="w-full text-left px-4 py-3 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-all duration-200 flex items-center justify-between group border-b last:border-b-0 animate-in slide-in-from-top"
                              style={{ animationDelay: `${index * 50}ms` }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/30 rounded-lg group-hover:scale-110 transition-transform">
                                  {getDeviceTypeIcon(device.deviceType)}
                                </div>
                                <div>
                                  <div className="font-semibold text-sm group-hover:text-yellow-600 transition-colors">
                                    {device.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {device.displayName}
                                  </div>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-yellow-500 group-hover:translate-x-1 transition-all" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-muted-foreground text-sm">
                          <div className="inline-flex flex-col items-center gap-2">
                            <Search className="h-8 w-8 text-gray-300" />
                            <span>{t('newOrder.deviceSelection.noResults')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {t('newOrder.deviceSelection.searchMinChars')}
                </p>
              </div>

              {/* Enhanced Selected Device Display */}
              {selectedDevice && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl p-5 border-2 border-green-200 dark:border-green-800 shadow-md animate-in zoom-in duration-500">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-lg">
                      {getDeviceTypeIcon(selectedDevice.deviceType)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
                          {t('newOrder.deviceSelection.deviceSelected')}
                        </span>
                      </div>
                      <h4 className="font-bold text-lg text-gray-900 dark:text-white">{selectedDevice.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedDevice.deviceType} • {selectedDevice.manufacturer}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!selectedDevice}
                  size="lg"
                  className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <span>{t('newOrder.deviceSelection.continueToServices')}</span>
                  <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Service Selection with Compact Design */}
        {step === 2 && (
          <Card className="animate-in slide-in-from-right duration-500 border-2 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 bg-purple-500 rounded-lg shadow-md">
                  <Package className="h-4 w-4 text-white" />
                </div>
                <span>{t('newOrder.serviceSelection.title')}</span>
              </CardTitle>
              <CardDescription className="text-sm">
                {t('newOrder.serviceSelection.subtitle', { count: selectedServices.length })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              {/* Compact Category Filter Buttons */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{t('newOrder.serviceSelection.filterLabel')}</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={selectedServiceCategory === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedServiceCategory("all")}
                    className={`transition-all duration-300 ${
                      selectedServiceCategory === "all"
                        ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 shadow-md'
                        : 'hover:border-yellow-400 hover:text-yellow-600'
                    }`}
                  >
                    {t('newOrder.serviceSelection.allServices')}
                  </Button>
                  {getServiceCategories().map((category) => (
                    <Button
                      key={category}
                      type="button"
                      variant={selectedServiceCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedServiceCategory(category)}
                      className={`transition-all duration-300 ${
                        selectedServiceCategory === category
                          ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 shadow-md'
                          : 'hover:border-yellow-400 hover:text-yellow-600'
                      }`}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Compact Services Grid */}
              <div className="grid gap-3 md:grid-cols-2">
                {getFilteredServices().map((service, index) => (
                  <div
                    key={service._id}
                    className={`p-4 rounded-lg border-2 transition-all duration-300 group animate-in slide-in-from-bottom ${
                      selectedServices.includes(service._id)
                        ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 shadow-lg scale-105'
                        : 'border-gray-200 dark:border-gray-700 hover:border-yellow-300 hover:shadow-md hover:scale-102'
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Checkbox
                            checked={selectedServices.includes(service._id)}
                            onCheckedChange={(checked) => handleServiceToggle(service._id, checked as boolean)}
                            onClick={(e) => e.stopPropagation()}
                            className="border-2"
                          />
                          <h3 className="font-bold text-sm group-hover:text-yellow-600 transition-colors">
                            {service.name}
                          </h3>
                          {service.popularity > 80 && (
                            <Badge variant="secondary" className="text-[10px] bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 border border-yellow-300">
                              <Star className="h-2.5 w-2.5 mr-0.5 text-yellow-500 fill-yellow-500" />
                              {t('newOrder.serviceSelection.popular')}
                            </Badge>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-[10px] mb-2">
                          {service.category}
                        </Badge>
                        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                          {service.description}
                        </p>
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <Clock className="h-3 w-3" />
                            <span className="font-medium">{service.estimatedTime}</span>
                          </div>
                          <div className="flex items-center gap-1 text-green-600 dark:text-green-400 font-bold">
                            <DollarSign className="h-3 w-3" />
                            <span>${service.price}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {getFilteredServices().length === 0 && (
                <div className="text-center py-12 text-muted-foreground animate-in fade-in duration-300">
                  <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-base">{t('newOrder.serviceSelection.noServicesInCategory')}</p>
                </div>
              )}

              <div className="flex justify-between pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  size="lg"
                  className="group"
                >
                  <ChevronRight className="mr-2 h-5 w-5 rotate-180 group-hover:-translate-x-1 transition-transform" />
                  {t('newOrder.serviceSelection.previous')}
                </Button>
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={selectedServices.length === 0}
                  size="lg"
                  className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 group"
                >
                  <span>{t('newOrder.serviceSelection.continueButton', { count: selectedServices.length })}</span>
                  <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Compact Summary, Unlock Code, and Add-On Services */}
        {step === 3 && (
          <div className="space-y-4 animate-in slide-in-from-right duration-500">
            {/* Compact Order Summary Card */}
            <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-950/20 dark:via-gray-800 dark:to-indigo-950/20 shadow-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg shadow-md">
                    <Package className="h-4 w-4 text-white" />
                  </div>
                  <span>{t('newOrder.detailsStep.orderSummaryTitle')}</span>
                </CardTitle>
                <CardDescription className="text-sm">
                  {t('newOrder.detailsStep.orderSummarySubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {/* Compact Customer Information */}
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-2 p-3 bg-white/50 dark:bg-gray-900/30 rounded-lg">
                    <h4 className="font-semibold text-xs flex items-center gap-1.5">
                      <User className="h-3 w-3 text-blue-500" />
                      {t('newOrder.detailsStep.customerInfo')}
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="h-2.5 w-2.5" />
                        <span>Admin User</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="h-2.5 w-2.5" />
                        <span>admin@example.com</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-2.5 w-2.5" />
                        <span>+1 (555) 000-0000</span>
                      </div>
                    </div>
                  </div>

                  {/* Compact Selected Device Summary */}
                  <div className="space-y-2 p-3 bg-white/50 dark:bg-gray-900/30 rounded-lg">
                    <h4 className="font-semibold text-xs flex items-center gap-1.5">
                      <Smartphone className="h-3 w-3 text-blue-500" />
                      {t('newOrder.detailsStep.deviceDetails')}
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      {selectedDevice ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-20">{t('newOrder.detailsStep.device')}:</span>
                            <Badge variant="secondary" className="gap-1">
                              {getDeviceTypeIcon(selectedDevice.deviceType)}
                              {selectedDevice.deviceType}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-20">{t('newOrder.detailsStep.brand')}:</span>
                            <span className="font-medium">{selectedDevice.manufacturer}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-20">{t('newOrder.detailsStep.model')}:</span>
                            <span className="font-medium">{selectedDevice.name}</span>
                          </div>
                        </>
                      ) : (
                        <p className="text-muted-foreground text-xs">{t('newOrder.detailsStep.noDeviceSelected')}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Selected Services */}
                {selectedServices.length > 0 && (
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      {t('newOrder.detailsStep.selectedServices', { count: selectedServices.length })}
                    </h4>
                    <div className="space-y-2">
                      {services.filter(s => selectedServices.includes(s._id)).map((service, index) => (
                        <div
                          key={service._id}
                          className="flex items-start justify-between p-3 rounded-lg hover:bg-white/50 dark:hover:bg-gray-900/30 transition-all animate-in slide-in-from-left"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-semibold">{service.name}</p>
                            <p className="text-xs text-muted-foreground">{service.description}</p>
                          </div>
                          <Badge variant="outline" className="ml-2 font-bold">${service.price}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related Information: External Repair Info & Knowledge Base Articles */}
                {selectedServices.length > 0 && services.filter(s => selectedServices.includes(s._id)).some(s => s.externalRepairInfo || (s.linkedKnowledgeBaseArticles && s.linkedKnowledgeBaseArticles.length > 0)) && (
                  <div className="space-y-4 pt-4 border-t bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 p-5 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                    <h4 className="font-bold text-base flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      {t('newOrder.detailsStep.relatedInfo')}
                    </h4>
                    <div className="space-y-4">
                      {services.filter(s => selectedServices.includes(s._id)).map((service) => {
                        const hasExternalInfo = service.externalRepairInfo && service.externalRepairInfo.trim().length > 0
                        const hasKnowledgeBase = service.linkedKnowledgeBaseArticles && service.linkedKnowledgeBaseArticles.length > 0

                        if (!hasExternalInfo && !hasKnowledgeBase) return null

                        return (
                          <div key={service._id} className="space-y-3 bg-white/50 dark:bg-gray-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-2 pb-2 border-b border-blue-200 dark:border-blue-700">
                              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                              <h5 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                                {service.name}
                              </h5>
                            </div>

                            {/* External Repair Information */}
                            {hasExternalInfo && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                                  <span className="inline-block w-1 h-1 rounded-full bg-blue-600" />
                                  Repair Information
                                </p>
                                <div className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed pl-3 border-l-2 border-blue-300 dark:border-blue-700">
                                  {service.externalRepairInfo}
                                </div>
                              </div>
                            )}

                            {/* Knowledge Base Articles */}
                            {hasKnowledgeBase && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                                  <span className="inline-block w-1 h-1 rounded-full bg-blue-600" />
                                  Knowledge Base Articles ({service.linkedKnowledgeBaseArticles.length})
                                </p>
                                <ul className="space-y-1.5 pl-3">
                                  {service.linkedKnowledgeBaseArticles.map((article, idx) => (
                                    <li key={idx} className="flex items-start gap-2 group">
                                      <span className="text-blue-500 text-xs mt-0.5">📚</span>
                                      {article.url ? (
                                        <a
                                          href={article.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sm text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 hover:underline transition-colors flex-1 leading-relaxed"
                                        >
                                          {article.title}
                                        </a>
                                      ) : (
                                        <span className="text-sm text-blue-700 dark:text-blue-300 flex-1 leading-relaxed">
                                          {article.title}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Acknowledgement Checkbox */}
                    <div id="related-info-checkbox" className="flex items-start gap-3 mt-4 pt-4 border-t border-blue-300 dark:border-blue-700 bg-white/70 dark:bg-gray-900/50 p-4 rounded-lg">
                      <Checkbox
                        id="relatedInfoCheckbox"
                        checked={relatedInfoAcknowledged}
                        onCheckedChange={(checked) => setRelatedInfoAcknowledged(checked as boolean)}
                        className="mt-0.5 border-2 border-blue-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor="relatedInfoCheckbox"
                          className="text-sm font-semibold text-blue-900 dark:text-blue-100 cursor-pointer flex items-center gap-2"
                        >
                          I confirm that I have read and understood the related information above
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">
                                  Please review all repair information and knowledge base articles provided above to ensure you understand the service details, warranty terms, and any important instructions before proceeding with your order.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Label>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                          Required to proceed to the next step
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Compact Additional Repair Information Card */}
            <Card className="border-2 hover:shadow-lg transition-shadow duration-300 border-blue-200 dark:border-blue-800">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-1.5 bg-blue-500 rounded-lg shadow-md">
                    <Info className="h-4 w-4 text-white" />
                  </div>
                  <span>{t('newOrder.repairInfo.title')}</span>
                </CardTitle>
                <CardDescription className="text-sm">
                  {t('newOrder.repairInfo.subtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Compact Error Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="errorDescription" className="text-sm font-semibold flex items-center gap-1.5">
                    {t('newOrder.repairInfo.errorDescriptionLabel')}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="errorDescription"
                    placeholder={t('newOrder.repairInfo.errorDescriptionPlaceholder')}
                    value={errorDescription}
                    onChange={(e) => setErrorDescription(e.target.value)}
                    rows={3}
                    className="border-2 focus:border-blue-400 focus:ring-blue-400/20 resize-none text-sm"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {t('newOrder.repairInfo.errorDescriptionHint')}
                  </p>
                </div>

                {/* Compact Water Damage */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    {t('newOrder.repairInfo.waterDamageLabel')}
                    <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {['yes', 'no', 'dont-know'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setWaterDamage(option)}
                        className={`p-3 rounded-lg border-2 transition-all duration-300 ${
                          waterDamage === option
                            ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 shadow-md scale-105'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                            waterDamage === option ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                          }`}>
                            {waterDamage === option && <Check className="h-2 w-2 text-white" />}
                          </div>
                          <span className="font-medium text-xs">
                            {t(`newOrder.repairInfo.waterDamage.${option}`)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compact Previous Repair Attempts */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    {t('newOrder.repairInfo.previousRepairLabel')}
                    <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {['yes', 'no', 'dont-know'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setPreviousRepairAttempts(option)}
                        className={`p-3 rounded-lg border-2 transition-all duration-300 ${
                          previousRepairAttempts === option
                            ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 shadow-md scale-105'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                            previousRepairAttempts === option ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                          }`}>
                            {previousRepairAttempts === option && <Check className="h-2 w-2 text-white" />}
                          </div>
                          <span className="font-medium text-xs">
                            {t(`newOrder.repairInfo.previousRepair.${option}`)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Previous Repair Details (shown only if "yes" is selected) */}
                  {previousRepairAttempts === 'yes' && (
                    <div className="space-y-2 pt-3 animate-in slide-in-from-top duration-300">
                      <Label htmlFor="previousRepairDetails" className="text-sm font-semibold">
                        {t('newOrder.repairInfo.previousRepairDetailsLabel')}
                      </Label>
                      <Textarea
                        id="previousRepairDetails"
                        placeholder={t('newOrder.repairInfo.previousRepairDetailsPlaceholder')}
                        value={previousRepairDetails}
                        onChange={(e) => setPreviousRepairDetails(e.target.value)}
                        rows={3}
                        className="border-2 focus:border-blue-400 focus:ring-blue-400/20 resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('newOrder.repairInfo.previousRepairDetailsHint')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Compact Item Condition */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    {t('newOrder.repairInfo.itemConditionLabel')}
                    <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {['original', 'refurbished'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setItemCondition(option)}
                        className={`p-3 rounded-lg border-2 transition-all duration-300 ${
                          itemCondition === option
                            ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 shadow-md scale-105'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                            itemCondition === option ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                          }`}>
                            {itemCondition === option && <Check className="h-2 w-2 text-white" />}
                          </div>
                          <span className="font-medium text-xs">
                            {t(`newOrder.repairInfo.itemCondition.${option}`)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Information Notice */}
                <div className="bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-950/40 dark:to-cyan-950/40 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-4">
                  <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{t('newOrder.repairInfo.infoNotice')}</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Compact Quantity Selection Card */}
            <Card className="border-2 hover:shadow-lg transition-shadow duration-300 border-purple-200 dark:border-purple-800">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-1.5 bg-purple-500 rounded-lg shadow-md">
                    <Package className="h-4 w-4 text-white" />
                  </div>
                  <span>{t('newOrder.detailsStep.quantityTitle')}</span>
                </CardTitle>
                <CardDescription className="text-sm">
                  {t('newOrder.detailsStep.quantitySubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Label htmlFor="quantity" className="text-base font-semibold min-w-[100px]">
                      {t('newOrder.detailsStep.quantityLabel')}
                    </Label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                        className="h-10 w-10"
                      >
                        -
                      </Button>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        max="100"
                        value={quantity}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 1
                          setQuantity(Math.max(1, Math.min(100, value)))
                        }}
                        className="w-20 text-center text-lg font-bold border-2"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(Math.min(100, quantity + 1))}
                        disabled={quantity >= 100}
                        className="h-10 w-10"
                      >
                        +
                      </Button>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 border-2 border-purple-300 dark:border-purple-700 rounded-xl p-4">
                    <p className="text-sm text-purple-900 dark:text-purple-100 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('newOrder.detailsStep.quantityNote') }} />
                    {quantity > 1 && (
                      <div className="mt-3 pt-3 border-t border-purple-300 dark:border-purple-700">
                        <p className="text-sm font-bold text-purple-900 dark:text-purple-100" dangerouslySetInnerHTML={{ __html: t('newOrder.detailsStep.quantityOrders', { quantity }) }} />
                        <p className="text-xs text-purple-700 dark:text-purple-200 mt-1">
                          {t('newOrder.detailsStep.quantityTotalCost', { total: (calculateTotal() * quantity).toFixed(2) })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Compact Unlock Code/Pattern Input Card */}
            <Card className="border-2 hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-1.5 bg-orange-500 rounded-lg shadow-md">
                    <Lock className="h-4 w-4 text-white" />
                  </div>
                  <span>{t('newOrder.detailsStep.unlockTitle')}</span>
                </CardTitle>
                <CardDescription className="text-sm">
                  {t('newOrder.detailsStep.unlockSubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
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

            {/* Compact Add-On Services Card */}
            <Card className="border-2 hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-1.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg shadow-md">
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                  <span>{t('newOrder.detailsStep.addOnsTitle')}</span>
                </CardTitle>
                <CardDescription className="text-sm">
                  {t('newOrder.detailsStep.addOnsSubtitle', { count: selectedAddOns.length })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {addOns.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-base">{t('newOrder.detailsStep.noAddOnsAvailable')}</p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      {addOns.map((addOn, index) => (
                        <div
                          key={addOn._id}
                          className={`p-4 rounded-lg border-2 transition-all duration-300 group animate-in slide-in-from-bottom ${
                            selectedAddOns.includes(addOn._id)
                              ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 shadow-md scale-105'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-300 hover:shadow-sm hover:scale-102'
                          }`}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Checkbox
                                  checked={selectedAddOns.includes(addOn._id)}
                                  onCheckedChange={(checked) => handleAddOnToggle(addOn._id, checked as boolean)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="border-2"
                                />
                                <h3 className="font-bold text-sm group-hover:text-green-600 transition-colors">
                                  {addOn.name}
                                </h3>
                                {addOn.category === 'Service' && (
                                  <Badge variant="secondary" className="text-[10px] bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 border border-yellow-300">
                                    <Zap className="h-2.5 w-2.5 mr-0.5 text-yellow-500 fill-yellow-500" />
                                    {t('newOrder.detailsStep.express')}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                                {addOn.description}
                              </p>
                              <div className="flex items-center gap-3 text-xs">
                                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                  <Clock className="h-3 w-3" />
                                  <span className="font-medium">{addOn.estimatedTime || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-1 text-green-600 dark:text-green-400 font-bold">
                                  <DollarSign className="h-3 w-3" />
                                  <span>${addOn.price}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Enhanced Selected Add-ons Summary */}
                    {selectedAddOns.length > 0 && (
                      <div className="mt-6 p-5 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-300 dark:border-green-700 space-y-3 animate-in zoom-in duration-300">
                        <p className="text-sm font-bold flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          {t('newOrder.detailsStep.selectedAddOns')}
                        </p>
                        <div className="space-y-2">
                          {addOns.filter(a => selectedAddOns.includes(a._id)).map(addOn => (
                            <div key={addOn._id} className="flex justify-between text-sm">
                              <span className="font-medium">• {addOn.name}</span>
                              <span className="font-bold text-green-600">${addOn.price}</span>
                            </div>
                          ))}
                        </div>
                        <div className="pt-3 border-t border-green-300 dark:border-green-700 flex justify-between font-bold">
                          <span>{t('newOrder.detailsStep.addOnsTotal')}</span>
                          <span className="text-green-600 text-lg">
                            ${addOns.filter(a => selectedAddOns.includes(a._id)).reduce((sum, a) => sum + a.price, 0)}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-between pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    size="lg"
                    className="group"
                  >
                    <ChevronRight className="mr-2 h-5 w-5 rotate-180 group-hover:-translate-x-1 transition-transform" />
                    {t('newOrder.serviceSelection.previous')}
                  </Button>
                  <Button
                    type="button"
                    onClick={nextStep}
                    size="lg"
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
                  >
                    <span>{t('newOrder.detailsStep.reviewAndSubmit')}</span>
                    <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Compact Details & Submit */}
        {step === 4 && (
          <Card className="animate-in slide-in-from-right duration-500 border-2 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg shadow-md">
                  <Upload className="h-4 w-4 text-white" />
                </div>
                <span>{t('newOrder.reviewStep.title')}</span>
              </CardTitle>
              <CardDescription className="text-sm">
                {t('newOrder.reviewStep.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              <div className="space-y-3 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl">
                <Label htmlFor="photos" className="text-base font-semibold flex items-center gap-2">
                  <Upload className="h-4 w-4 text-blue-600" />
                  {t('newOrder.reviewStep.photosLabel')}
                </Label>
                <Input
                  id="photos"
                  type="file"
                  multiple
                  accept="image/*"
                  {...register("photos")}
                  className="cursor-pointer h-12 border-2 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-yellow-400 file:to-yellow-500 file:text-gray-900 file:font-semibold hover:file:from-yellow-500 hover:file:to-yellow-600"
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {t('newOrder.reviewStep.photosHint')}
                </p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="customerNotes" className="text-base font-semibold">{t('newOrder.reviewStep.notesLabel')}</Label>
                <Textarea
                  id="customerNotes"
                  placeholder={t('newOrder.reviewStep.notesPlaceholder')}
                  {...register("customerNotes")}
                  rows={5}
                  className="border-2 focus:border-yellow-400 focus:ring-yellow-400/20 resize-none"
                />
              </div>

              {/* Enhanced Unlock Information Review */}
              {(unlockPattern.length > 0 || unlockCode || noDeviceLock) && (
                <div className="bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/40 dark:to-indigo-950/40 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-5 space-y-3 animate-in zoom-in duration-300">
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    {t('newOrder.reviewStep.unlockInfoTitle')}
                  </h4>
                  <div className="text-sm space-y-2">
                    {noDeviceLock && (
                      <p className="text-blue-900 dark:text-blue-100 flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        {t('newOrder.reviewStep.deviceNoLock')}
                      </p>
                    )}
                    {unlockPattern.length > 0 && (
                      <p className="text-blue-900 dark:text-blue-100 flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        {t('newOrder.reviewStep.patternLock')} <span className="font-mono font-bold">{unlockPattern.join(' → ')}</span>
                      </p>
                    )}
                    {unlockCode && (
                      <p className="text-blue-900 dark:text-blue-100 flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        {t('newOrder.reviewStep.unlockCodeProvided')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Quantity Information Display */}
              {quantity > 1 && (
                <div className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-950/40 dark:to-pink-950/40 border-2 border-purple-300 dark:border-purple-700 rounded-xl p-5 space-y-3 animate-in zoom-in duration-300">
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    {t('newOrder.reviewStep.quantityInfo')}
                  </h4>
                  <div className="text-sm space-y-2">
                    <p className="text-purple-900 dark:text-purple-100 flex items-center gap-2 font-semibold">
                      <Check className="h-4 w-4 text-purple-600" />
                      {t('newOrder.reviewStep.multipleOrders', { quantity })}
                    </p>
                    <p className="text-purple-900 dark:text-purple-100 font-bold text-lg">
                      {t('newOrder.reviewStep.totalForAll', { total: (calculateTotal() * quantity).toFixed(2) })}
                    </p>
                  </div>
                </div>
              )}

              {/* Enhanced Selected Add-ons Review */}
              {selectedAddOns.length > 0 && (
                <div className="bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-950/40 dark:to-emerald-950/40 border-2 border-green-300 dark:border-green-700 rounded-xl p-5 space-y-3 animate-in zoom-in duration-300">
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                    {t('newOrder.reviewStep.selectedAddOns')}
                  </h4>
                  <div className="space-y-2 text-sm">
                    {addOns.filter(a => selectedAddOns.includes(a._id)).map(addOn => (
                      <div key={addOn._id} className="flex justify-between items-center text-green-900 dark:text-green-100">
                        <span className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          {addOn.name}
                        </span>
                        <span className="font-bold">${addOn.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Repair Information Review */}
              {(errorDescription || waterDamage || previousRepairAttempts || itemCondition) && (
                <div className="bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/40 dark:to-orange-950/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-5 space-y-4 animate-in zoom-in duration-300">
                  <h4 className="font-bold text-base flex items-center gap-2">
                    <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    {t('newOrder.repairInfo.title')}
                  </h4>
                  <div className="space-y-3 text-sm">
                    {/* Error Description */}
                    {errorDescription && (
                      <div className="bg-white/50 dark:bg-gray-900/30 rounded-lg p-3 space-y-1">
                        <div className="font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          {t('newOrder.repairInfo.errorDescriptionLabel')}
                        </div>
                        <div className="text-amber-800 dark:text-amber-200 ml-6 whitespace-pre-wrap">
                          {errorDescription}
                        </div>
                      </div>
                    )}

                    {/* Water Damage */}
                    {waterDamage && (
                      <div className="bg-white/50 dark:bg-gray-900/30 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                            <Droplets className="h-4 w-4" />
                            {t('newOrder.repairInfo.waterDamageLabel')}
                          </span>
                          <span className={`font-bold px-3 py-1 rounded-full text-xs ${
                            waterDamage === 'yes'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              : waterDamage === 'no'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                          }`}>
                            {t(`newOrder.repairInfo.waterDamage.${waterDamage}`)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Previous Repair Attempts */}
                    {previousRepairAttempts && (
                      <div className="bg-white/50 dark:bg-gray-900/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                            <Wrench className="h-4 w-4" />
                            {t('newOrder.repairInfo.previousRepairLabel')}
                          </span>
                          <span className={`font-bold px-3 py-1 rounded-full text-xs ${
                            previousRepairAttempts === 'yes'
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                              : previousRepairAttempts === 'no'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                          }`}>
                            {t(`newOrder.repairInfo.previousRepair.${previousRepairAttempts}`)}
                          </span>
                        </div>
                        {previousRepairAttempts === 'yes' && previousRepairDetails && (
                          <div className="ml-6 text-amber-800 dark:text-amber-200 border-l-2 border-amber-400 pl-3 whitespace-pre-wrap">
                            {previousRepairDetails}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Item Condition */}
                    {itemCondition && (
                      <div className="bg-white/50 dark:bg-gray-900/30 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            {t('newOrder.repairInfo.itemConditionLabel')}
                          </span>
                          <span className={`font-bold px-3 py-1 rounded-full text-xs ${
                            itemCondition === 'original'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          }`}>
                            {t(`newOrder.repairInfo.itemCondition.${itemCondition}`)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Enhanced Complete Order Summary */}
              <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-900/20 dark:via-amber-900/20 dark:to-orange-900/20 rounded-xl p-6 space-y-4 border-2 border-yellow-300 dark:border-yellow-600/30 shadow-lg animate-in zoom-in duration-500">
                <h3 className="font-bold text-lg flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-lg shadow-md">
                    <DollarSign className="h-5 w-5 text-gray-900" />
                  </div>
                  <span>{t('newOrder.reviewStep.orderSummary')}</span>
                </h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-gray-900/30 rounded-lg">
                    <span className="text-muted-foreground font-medium">{t('newOrder.reviewStep.device')}:</span>
                    <span className="font-bold text-right">
                      {selectedDevice
                        ? `${selectedDevice.deviceType} • ${selectedDevice.manufacturer} • ${selectedDevice.name}`
                        : t('newOrder.reviewStep.notSelected')
                      }
                    </span>
                  </div>

                  {selectedServices.length > 0 && (
                    <div className="pt-2 border-t space-y-2">
                      <span className="text-muted-foreground block font-bold">{t('newOrder.reviewStep.services')}</span>
                      {services.filter(s => selectedServices.includes(s._id)).map(service => (
                        <div key={service._id} className="flex justify-between ml-4 p-2 hover:bg-white/50 dark:hover:bg-gray-900/30 rounded-lg transition-colors">
                          <span className="flex items-center gap-2">
                            <Check className="h-3 w-3 text-green-600" />
                            {service.name}
                          </span>
                          <span className="font-bold">${service.price}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedAddOns.length > 0 && (
                    <div className="pt-2 border-t space-y-2">
                      <span className="text-muted-foreground block font-bold">{t('newOrder.reviewStep.addOns')}</span>
                      {addOns.filter(a => selectedAddOns.includes(a._id)).map(addOn => (
                        <div key={addOn._id} className="flex justify-between ml-4 p-2 hover:bg-white/50 dark:hover:bg-gray-900/30 rounded-lg transition-colors">
                          <span className="flex items-center gap-2">
                            <Check className="h-3 w-3 text-green-600" />
                            {addOn.name}
                          </span>
                          <span className="font-bold">${addOn.price}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t-2 pt-4 mt-4">
                    {quantity > 1 && (
                      <div className="flex justify-between items-center mb-2 text-sm">
                        <span className="text-muted-foreground">{t('newOrder.reviewStep.costPerOrder')}</span>
                        <span className="font-semibold">${calculateTotal().toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-lg">{quantity > 1 ? t('newOrder.reviewStep.totalForAllOrders') : t('newOrder.reviewStep.totalCost')}</span>
                      <span className="font-bold text-2xl bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
                        ${(calculateTotal() * quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Terms Agreement */}
              <div className="bg-muted/50 rounded-xl p-5 border-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('newOrder.reviewStep.termsAgreement')}
                </p>
              </div>

              <div className="flex justify-between pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  size="lg"
                  className="group"
                >
                  <ChevronRight className="mr-2 h-5 w-5 rotate-180 group-hover:-translate-x-1 transition-transform" />
                  {t('newOrder.reviewStep.previous')}
                </Button>
                <Button
                  type="button"
                  onClick={nextStep}
                  size="lg"
                  className="min-w-[200px] bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-bold shadow-lg hover:shadow-xl transition-all duration-300 group"
                >
                  <span>{t('newOrder.reviewStep.reviewInCart')}</span>
                  <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Compact Add to Cart Confirmation */}
        {step === 5 && (
          <Card className="animate-in slide-in-from-right duration-500 border-2 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg shadow-md animate-pulse">
                  <ShoppingCartIcon className="h-4 w-4 text-white" />
                </div>
                <span>{t('newOrder.cartStep.title')}</span>
              </CardTitle>
              <CardDescription className="text-sm">
                {t('newOrder.cartStep.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              {/* Enhanced Order Summary */}
              <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 space-y-4 border-2 border-blue-300 dark:border-blue-700 shadow-lg animate-in zoom-in duration-300">
                <h3 className="font-bold text-lg flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg shadow-md">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                  <span>{t('newOrder.cartStep.orderDetails')}</span>
                </h3>

                <div className="space-y-3 text-sm">
                  {/* Quantity Display */}
                  {quantity > 1 && (
                    <div className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 border-2 border-purple-300 dark:border-purple-700 rounded-lg p-4 mb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          <span className="font-bold text-purple-900 dark:text-purple-100">{t('newOrder.detailsStep.quantityLabel')}</span>
                        </div>
                        <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{quantity}</span>
                      </div>
                      <p className="text-xs text-purple-700 dark:text-purple-200 mt-2">
                        {t('newOrder.reviewStep.multipleOrders', { quantity })} ({t('newOrder.reviewStep.totalForAll', { total: (calculateTotal() * quantity).toFixed(2) })})
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-gray-900/30 rounded-lg">
                    <span className="text-muted-foreground font-medium">{t('newOrder.cartStep.device')}:</span>
                    <span className="font-bold text-right">
                      {selectedDevice
                        ? `${selectedDevice.deviceType} • ${selectedDevice.manufacturer} • ${selectedDevice.name}`
                        : t('newOrder.cartStep.notSelected')
                      }
                    </span>
                  </div>

                  {selectedServices.length > 0 && (
                    <div className="pt-2 border-t space-y-2">
                      <span className="text-muted-foreground block font-bold">{t('newOrder.cartStep.services')}</span>
                      {services.filter(s => selectedServices.includes(s._id)).map(service => (
                        <div key={service._id} className="flex justify-between ml-4 p-2 hover:bg-white/50 dark:hover:bg-gray-900/30 rounded-lg transition-colors">
                          <span className="flex items-center gap-2">
                            <Check className="h-3 w-3 text-green-600" />
                            {service.name}
                          </span>
                          <span className="font-bold">${service.price}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedAddOns.length > 0 && (
                    <div className="pt-2 border-t space-y-2">
                      <span className="text-muted-foreground block font-bold">{t('newOrder.reviewStep.addOns')}</span>
                      {addOns.filter(a => selectedAddOns.includes(a._id)).map(addOn => (
                        <div key={addOn._id} className="flex justify-between ml-4 p-2 hover:bg-white/50 dark:hover:bg-gray-900/30 rounded-lg transition-colors">
                          <span className="flex items-center gap-2">
                            <Check className="h-3 w-3 text-green-600" />
                            {addOn.name}
                          </span>
                          <span className="font-bold">${addOn.price}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t-2 pt-4 mt-4">
                    {quantity > 1 && (
                      <div className="flex justify-between items-center mb-2 text-sm">
                        <span className="text-muted-foreground">{t('newOrder.reviewStep.costPerOrder')}</span>
                        <span className="font-semibold">${calculateTotal().toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-lg">{quantity > 1 ? t('newOrder.reviewStep.totalForAllOrders') : t('newOrder.reviewStep.totalCost')}</span>
                      <span className="font-bold text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        ${(calculateTotal() * quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Information Message */}
              <div className="bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/40 dark:to-indigo-950/40 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-5 animate-in fade-in duration-500">
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  <ShoppingCartIcon className="h-5 w-5" />
                  {t('newOrder.cartStep.cartBenefitsTitle')}
                </h4>
                <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
                  {t('newOrder.cartStep.cartBenefitsDesc')}
                </p>
              </div>

              {/* Enhanced Benefits Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { title: t('newOrder.cartStep.benefit1Title'), desc: t('newOrder.cartStep.benefit1Desc'), delay: 0 },
                  { title: t('newOrder.cartStep.benefit2Title'), desc: t('newOrder.cartStep.benefit2Desc'), delay: 100 },
                  { title: t('newOrder.cartStep.benefit3Title'), desc: t('newOrder.cartStep.benefit3Desc'), delay: 200 },
                  { title: t('newOrder.cartStep.benefit4Title'), desc: t('newOrder.cartStep.benefit4Desc'), delay: 300 }
                ].map((benefit, index) => (
                  <div
                    key={index}
                    className="flex gap-3 p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border-2 border-green-200 dark:border-green-800 animate-in slide-in-from-bottom"
                    style={{ animationDelay: `${benefit.delay}ms` }}
                  >
                    <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg h-fit">
                      <Check className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{benefit.title}</p>
                      <p className="text-xs text-muted-foreground">{benefit.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between gap-3 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  size="lg"
                  className="group"
                >
                  <ChevronRight className="mr-2 h-5 w-5 rotate-180 group-hover:-translate-x-1 transition-transform" />
                  {t('newOrder.cartStep.previous')}
                </Button>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigate("/shop")
                      toast({
                        title: t('newOrder.cartStep.orderReady'),
                        description: t('newOrder.cartStep.orderReadyDesc')
                      })
                    }}
                    size="lg"
                    className="hover:border-yellow-400 hover:text-yellow-600"
                  >
                    {t('newOrder.cartStep.continueShopping')}
                  </Button>
                  <Button
                    type="button"
                    disabled={submitting}
                    size="lg"
                    className="min-w-[250px] bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
                    onClick={async () => {
                      try {
                        setSubmitting(true)
                        console.log(`Adding ${quantity} repair order(s) to cart...`)

                        // Get selected device details
                        const selectedDeviceTypeObj = deviceTypes.find(dt => dt._id === selectedDeviceType)

                        // For device brand and model, prioritize the search-selected device
                        let deviceBrandName = selectedDevice?.manufacturer || manufacturers.find(m => m._id === selectedManufacturer)?.name || selectedManufacturer
                        let deviceModelName = selectedDevice?.name || models.find(m => m._id === selectedModel)?.name || selectedModel

                        // Prepare add-ons data
                        const selectedAddOnObjects = addOns
                          .filter(addOn => selectedAddOns.includes(addOn._id))
                          .map(addOn => ({
                            name: addOn.name,
                            description: addOn.description,
                            price: addOn.price,
                            estimatedTime: addOn.estimatedTime || '30 minutes'
                          }))

                        const photoUrls: string[] = []
                        // Note: Photos would be handled separately in a real implementation

                        // Prepare repair order data for cart
                        const repairOrderData = {
                          deviceType: selectedDeviceTypeObj?.name || selectedDeviceType,
                          deviceBrand: deviceBrandName,
                          deviceModel: deviceModelName,
                          services: selectedServices,
                          addOns: selectedAddOnObjects,
                          customerNotes: watch("customerNotes") || '',
                          photos: photoUrls,
                          totalCost: calculateTotal(),
                          unlockPattern: unlockPattern,
                          unlockCode: unlockCode,
                          noLock: noDeviceLock,
                          // Additional repair information
                          errorDescription: errorDescription,
                          waterDamage: waterDamage,
                          previousRepairAttempts: previousRepairAttempts,
                          previousRepairDetails: previousRepairDetails,
                          itemCondition: itemCondition
                        }

                        console.log("Repair order data template:", repairOrderData)

                        // Create multiple orders based on quantity
                        let successCount = 0
                        let failCount = 0

                        for (let i = 0; i < quantity; i++) {
                          try {
                            console.log(`Adding order ${i + 1} of ${quantity} to cart...`)
                            await addRepairOrderToCart(repairOrderData)
                            successCount++
                          } catch (error) {
                            console.error(`Error adding order ${i + 1}:`, error)
                            failCount++
                          }
                        }

                        if (successCount === quantity) {
                          toast({
                            title: t('common.success'),
                            description: quantity > 1
                              ? `Successfully added ${quantity} repair orders to cart!`
                              : t('newOrder.success.addedToCart'),
                          })
                        } else if (successCount > 0) {
                          toast({
                            title: 'Partial Success',
                            description: `Added ${successCount} of ${quantity} orders. ${failCount} failed.`,
                            variant: "default"
                          })
                        } else {
                          throw new Error('Failed to add any orders to cart')
                        }

                        // Navigate to cart page
                        navigate("/cart")
                      } catch (error: any) {
                        console.error("Error adding repair order(s) to cart:", error)
                        toast({
                          title: t('common.error'),
                          description: error.message || t('newOrder.errors.addToCart'),
                          variant: "destructive"
                        })
                      } finally {
                        setSubmitting(false)
                      }
                    }}
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {quantity > 1 ? `Adding ${quantity} orders...` : t('newOrder.cartStep.addingToCart')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <ShoppingCartIcon className="h-5 w-5" />
                        {quantity > 1 ? `Add ${quantity} Orders to Cart` : t('newOrder.cartStep.addToCart')}
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </form>

      {/* Add custom CSS for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  )
}
