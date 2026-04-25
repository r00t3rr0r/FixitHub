import { useState, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import { LoginDialog } from "@/components/home/LoginDialog"
import { createRepairRequest } from "@/api/repairRequests"
import {
  getDeviceTypes,
  getManufacturersByDeviceType,
  getModelsByTypeAndManufacturer,
  DeviceType as ApiDeviceType,
  Manufacturer,
  DeviceModel
} from "@/api/devices"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Smartphone,
  Upload,
  CheckCircle,
  ArrowLeft,
  AlertCircle,
  FileText,
  Calendar,
  Wrench,
  Info,
  Loader2,
  Package,
  X,
  ChevronDown,
  ChevronUp,
  Droplets,
  Edit2
} from "lucide-react"

interface SelectedDevice {
  _id: string
  name: string
  deviceType: string
  manufacturer: string
  manufacturerId: string
  image?: string
}

export function RepairRequestQuestionnaire() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { isAuthenticated } = useAuth()
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const submitButtonRef = useRef<HTMLButtonElement>(null)

  // Get device information from navigation state
  const [selectedDevice, setSelectedDevice] = useState<SelectedDevice | null>(location.state?.device as SelectedDevice | null)

  // Device Change Dialog State
  const [showDeviceDialog, setShowDeviceDialog] = useState(false)
  const [deviceTypes, setDeviceTypes] = useState<ApiDeviceType[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [models, setModels] = useState<DeviceModel[]>([])
  const [selectedDeviceType, setSelectedDeviceType] = useState<string>("")
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("")
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [loadingManufacturers, setLoadingManufacturers] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)

  const [formData, setFormData] = useState({
    issueDescription: "",
    issueOccurredDate: "",
    modelNumber: ""
  })

  const [images, setImages] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Extended Information State
  const [showExtendedInfo, setShowExtendedInfo] = useState(false)
  const [waterDamage, setWaterDamage] = useState<'no' | 'yes' | 'unsure'>('no')
  const [previousRepairDetails, setPreviousRepairDetails] = useState("")
  const [itemCondition, setItemCondition] = useState<'original' | 'refurbished' | 'unsure'>('unsure')

  // Load device types when dialog opens
  const handleOpenDeviceDialog = async () => {
    setShowDeviceDialog(true)
    setSelectedDeviceType("")
    setSelectedManufacturer("")
    setSelectedModel("")
    setManufacturers([])
    setModels([])
    
    try {
      const response = await getDeviceTypes()
      setDeviceTypes((response as any).deviceTypes || [])
    } catch (error) {
      console.error("Error loading device types:", error)
      toast({
        title: t('repairRequest.errorTitle'),
        description: t('repairRequest.errorLoadingDeviceTypes'),
        variant: "destructive"
      })
    }
  }

  // Load manufacturers when device type changes
  const handleDeviceTypeChange = async (deviceTypeId: string) => {
    setSelectedDeviceType(deviceTypeId)
    setSelectedManufacturer("")
    setSelectedModel("")
    setManufacturers([])
    setModels([])

    if (!deviceTypeId) return

    try {
      setLoadingManufacturers(true)
      const response = await getManufacturersByDeviceType(deviceTypeId)
      setManufacturers((response as any).manufacturers || [])
    } catch (error) {
      console.error("Error loading manufacturers:", error)
      toast({
        title: t('repairRequest.errorTitle'),
        description: t('repairRequest.errorLoadingBrands'),
        variant: "destructive"
      })
    } finally {
      setLoadingManufacturers(false)
    }
  }

  // Load models when manufacturer changes
  const handleManufacturerChange = async (manufacturerId: string) => {
    setSelectedManufacturer(manufacturerId)
    setSelectedModel("")
    setModels([])

    if (!manufacturerId || !selectedDeviceType) return

    try {
      setLoadingModels(true)
      const response = await getModelsByTypeAndManufacturer(selectedDeviceType, manufacturerId)
      setModels((response as any).models || [])
    } catch (error) {
      console.error("Error loading models:", error)
      toast({
        title: t('repairRequest.errorTitle'),
        description: t('repairRequest.errorLoadingModels'),
        variant: "destructive"
      })
    } finally {
      setLoadingModels(false)
    }
  }

  // Confirm device selection
  const handleConfirmDeviceChange = () => {
    if (!selectedModel) {
      toast({
        title: t('repairRequest.errorTitle'),
        description: t('repairRequest.selectModel'),
        variant: "destructive"
      })
      return
    }

    const selectedModelData = models.find(m => m._id === selectedModel)
    const selectedManufacturerData = manufacturers.find(m => m._id === selectedManufacturer)
    const selectedDeviceTypeData = deviceTypes.find(dt => dt._id === selectedDeviceType)

    if (selectedModelData && selectedManufacturerData && selectedDeviceTypeData) {
      setSelectedDevice({
        _id: selectedModelData._id,
        name: selectedModelData.name,
        deviceType: selectedDeviceTypeData.name,
        manufacturer: selectedManufacturerData.name,
        manufacturerId: selectedManufacturerData._id,
        image: selectedModelData.image
      })

      toast({
        title: t('repairRequest.successTitle'),
        description: t('repairRequest.deviceChangedSuccess', { name: selectedModelData.name })
      })

      setShowDeviceDialog(false)
    }
  }

  // Redirect if no device selected
  if (!selectedDevice) {
    return (
      <section className="container px-4 pb-10 pt-8 md:pb-14 md:pt-10">
        <Card className="overflow-hidden border-0 shadow-xl">
          <CardContent className="p-0">
            <div className="bg-[linear-gradient(135deg,_var(--primary-blue,_#1a2a5e)_0%,_var(--primary-blue-light,_#2f57b0)_100%)] px-8 py-10 text-white md:px-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
                <AlertCircle className="h-4 w-4" />
                {t('repairRequest.noDeviceSelected')}
              </div>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-blue-50 md:text-base">
                {t('repairRequest.noDeviceSelectedDesc')}
              </p>
            </div>
            <div className="flex flex-col gap-3 p-6 sm:flex-row md:p-8">
              <Button
                onClick={() => navigate("/new-order")}
                className="rounded-full bg-[var(--primary-blue,_#1a2a5e)] text-white hover:bg-[var(--primary-blue-dark,_#14224d)]"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('repairRequest.backToOrderForm')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    )
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    if (files.length + images.length > 5) {
      toast({
        title: t('repairRequest.tooManyImages'),
        description: t('repairRequest.tooManyImagesDesc'),
        variant: "destructive"
      })
      return
    }

    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast({
          title: t('repairRequest.invalidFileType'),
          description: t('repairRequest.invalidFileTypeDesc', { name: file.name }),
          variant: "destructive"
        })
        return false
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: t('repairRequest.fileTooLarge'),
          description: t('repairRequest.fileTooLargeDesc', { name: file.name }),
          variant: "destructive"
        })
        return false
      }
      return true
    })

    setImages(prev => [...prev, ...validFiles])

    // Create preview URLs
    validFiles.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreviewUrls(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviewUrls(prev => prev.filter((_, i) => i !== index))
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.issueDescription.trim()) {
      newErrors.issueDescription = t('repairRequest.issueDescriptionRequired')
    } else if (formData.issueDescription.trim().length < 20) {
      newErrors.issueDescription = t('repairRequest.issueDescriptionMinLength')
    }

    if (!formData.issueOccurredDate) {
      newErrors.issueOccurredDate = t('repairRequest.whenRequired')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check if user is authenticated
    if (!isAuthenticated) {
      toast({
        title: t('repairRequest.loginRequired'),
        description: t('repairRequest.loginRequiredDesc'),
        variant: "default"
      })
      setShowLoginDialog(true)
      return
    }

    if (!validateForm()) {
      toast({
        title: t('repairRequest.validationError'),
        description: t('repairRequest.validationErrorDesc'),
        variant: "destructive"
      })
      return
    }

    try {
      setSubmitting(true)

      // Use the base64 data URLs that were already created for preview
      // These will be stored in the database and displayed in the admin panel
      // Note: For production with many images, consider uploading to AWS S3 or Cloudinary
      const imageUrls = imagePreviewUrls

      const requestData = {
        deviceType: selectedDevice.deviceType,
        deviceBrand: selectedDevice.manufacturer,
        deviceModel: selectedDevice.name,
        deviceModelId: selectedDevice._id,
        issueDescription: formData.issueDescription,
        issueOccurredDate: formData.issueOccurredDate,
        repairAttempts: "",
        modelNumber: formData.modelNumber || "",
        waterDamage: waterDamage,
        previousRepairDetails: previousRepairDetails || "",
        itemCondition: itemCondition,
        images: imageUrls
      }

      console.log("Submitting repair request:", requestData)

      await createRepairRequest(requestData)

      toast({
        title: t('repairRequest.successTitle'),
        description: t('repairRequest.successMessage'),
      })

      // Navigate to customer repair requests page
      navigate("/my-repair-requests")
    } catch (error: any) {
      console.error("Error submitting repair request:", error)
      toast({
        title: t('repairRequest.errorTitle'),
        description: error.message || t('repairRequest.errorMessage'),
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const getDeviceTypeIcon = (deviceType: string) => {
    switch (deviceType.toLowerCase()) {
      case 'smartphone':
        return <Smartphone className="h-5 w-5" />
      case 'tablet':
        return <Package className="h-5 w-5" />
      case 'laptop':
        return <Package className="h-5 w-5" />
      default:
        return <Package className="h-5 w-5" />
    }
  }

  const supportPoints = [
    t('repairRequest.infoAlert'),
    t('repairRequest.uploadImagesDesc'),
    t('repairRequest.submitInfo')
  ]

  return (
    <>
      <section className="container px-4 pb-10 pt-8 md:pb-14 md:pt-10">
        <section className="overflow-hidden rounded-3xl border-0 shadow-xl">
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,_var(--primary-blue,_#1a2a5e)_0%,_var(--primary-blue-light,_#2f57b0)_100%)] px-8 py-10 text-white md:px-12 md:py-12">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-12 left-8 h-36 w-36 rounded-full bg-yellow-300/20 blur-2xl" />

            <div className="relative z-10 max-w-4xl">
              <button
                type="button"
                onClick={() => navigate("/new-order")}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('repairRequest.backToOrderForm')}
              </button>

              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
                <FileText className="h-4 w-4" />
                {t('repairRequest.title')}
              </div>

              <h1 className="mt-4 text-3xl font-bold leading-tight md:text-5xl">
                {t('repairRequest.subtitle')}
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-7 text-blue-50 md:text-base">
                {t('repairRequest.infoAlert')}
              </p>

              <div className="mt-7 flex flex-wrap gap-3 text-sm text-blue-50">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
                  {getDeviceTypeIcon(selectedDevice.deviceType)}
                  {selectedDevice.deviceType}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
                  <CheckCircle className="h-4 w-4" />
                  {selectedDevice.manufacturer}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
                  <Wrench className="h-4 w-4" />
                  {selectedDevice.name}
                </span>
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-4 md:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      {selectedDevice.image ? (
                        <img
                          src={selectedDevice.image}
                          alt={selectedDevice.name}
                          className="h-full w-full object-contain p-2"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <div className="h-full w-full items-center justify-center text-[var(--primary-blue,_#1a2a5e)]" style={{ display: selectedDevice.image ? 'none' : 'flex' }}>
                        {getDeviceTypeIcon(selectedDevice.deviceType)}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {t('repairRequest.selectedDevice')}
                      </p>
                      <h2 className="truncate text-lg font-semibold leading-tight" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                        {selectedDevice.name}
                      </h2>
                      <p className="truncate text-sm leading-6" style={{ color: 'var(--gray-600, #475569)' }}>
                        {selectedDevice.manufacturer} · {selectedDevice.deviceType}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={handleOpenDeviceDialog}
                    variant="outline"
                    className="rounded-full border-[rgba(26,42,94,0.14)] bg-white font-semibold text-[var(--primary-blue,_#1a2a5e)] hover:bg-slate-50"
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    {t('repairRequest.changeDevice')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                  <AlertCircle className="h-5 w-5" />
                  {t('repairRequest.issueDetailsTitle')}
                </CardTitle>
                <p className="text-sm leading-6" style={{ color: 'var(--gray-600, #475569)' }}>
                  {t('repairRequest.subtitle')}
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="issueDescription">
                    {t('repairRequest.issueDescriptionLabel')} <span className="text-red-600">*</span>
                  </Label>
                  <Textarea
                    id="issueDescription"
                    placeholder={t('repairRequest.issueDescriptionPlaceholder')}
                    value={formData.issueDescription}
                    onChange={(e) => handleInputChange("issueDescription", e.target.value)}
                    className={`min-h-[180px] ${errors.issueDescription ? 'border-red-500 focus-visible:ring-red-200' : ''}`}
                  />
                  {errors.issueDescription && (
                    <p className="flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      {errors.issueDescription}
                    </p>
                  )}
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="issueOccurredDate">
                      {t('repairRequest.whenDidItHappen')} <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      id="issueOccurredDate"
                      type="text"
                      placeholder={t('repairRequest.whenPlaceholder')}
                      value={formData.issueOccurredDate}
                      onChange={(e) => handleInputChange("issueOccurredDate", e.target.value)}
                      className={errors.issueOccurredDate ? 'border-red-500 focus-visible:ring-red-200' : ''}
                    />
                    {errors.issueOccurredDate ? (
                      <p className="flex items-center gap-2 text-sm text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        {errors.issueOccurredDate}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500">{t('repairRequest.approximateDate')}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="modelNumber">{t('repairRequest.modelNumber')}</Label>
                    <Input
                      id="modelNumber"
                      type="text"
                      placeholder={t('repairRequest.modelNumberPlaceholder')}
                      value={formData.modelNumber}
                      onChange={(e) => handleInputChange("modelNumber", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <button
                  type="button"
                  onClick={() => setShowExtendedInfo(!showExtendedInfo)}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition hover:bg-slate-50"
                  style={{ borderColor: 'rgba(26,42,94,0.1)' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'rgba(245, 197, 24, 0.18)', color: 'var(--primary-blue, #1a2a5e)' }}>
                      <Info className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                        {t('repairRequest.extendedInfoTitle')}
                      </h2>
                      <p className="mt-1 text-sm leading-6" style={{ color: 'var(--gray-600, #475569)' }}>
                        {t('repairRequest.extendedInfoSubtitle')}
                      </p>
                    </div>
                  </div>
                  {showExtendedInfo ? (
                    <ChevronUp className="h-5 w-5 shrink-0" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                  ) : (
                    <ChevronDown className="h-5 w-5 shrink-0" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                  )}
                </button>
              </CardHeader>
              {showExtendedInfo && (
                <CardContent className="space-y-6 pt-0">
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Droplets className="h-4 w-4" />
                      {t('repairRequest.waterDamage')}
                    </Label>
                    <div className="flex flex-wrap gap-3">
                      {['no', 'yes', 'unsure'].map((option) => {
                        const isSelected = waterDamage === option

                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setWaterDamage(option as 'no' | 'yes' | 'unsure')}
                            className="rounded-full border px-4 py-2 text-sm font-semibold transition"
                            style={{
                              borderColor: isSelected ? 'transparent' : 'rgba(26,42,94,0.14)',
                              background: isSelected
                                ? 'linear-gradient(135deg, var(--primary-blue, #1a2a5e) 0%, var(--primary-blue-light, #2f57b0) 100%)'
                                : 'white',
                              color: isSelected ? 'white' : 'var(--primary-blue, #1a2a5e)',
                              boxShadow: isSelected ? '0 12px 30px rgba(26, 42, 94, 0.18)' : 'none'
                            }}
                          >
                            {option === 'no' ? t('repairRequest.waterDamageNo') : option === 'yes' ? t('repairRequest.waterDamageYes') : t('repairRequest.waterDamageUnsure')}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="previousRepairDetails" className="flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      {t('repairRequest.previousRepairDetails')}
                    </Label>
                    <Textarea
                      id="previousRepairDetails"
                      placeholder={t('repairRequest.previousRepairPlaceholder')}
                      value={previousRepairDetails}
                      onChange={(e) => setPreviousRepairDetails(e.target.value)}
                      className="min-h-[120px]"
                    />
                    <p className="text-sm text-slate-500">{t('repairRequest.previousRepairHint')}</p>
                  </div>

                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      {t('repairRequest.itemCondition')}
                    </Label>
                    <div className="flex flex-wrap gap-3">
                      {['original', 'refurbished', 'unsure'].map((option) => {
                        const isSelected = itemCondition === option

                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setItemCondition(option as 'original' | 'refurbished' | 'unsure')}
                            className="rounded-full border px-4 py-2 text-sm font-semibold transition"
                            style={{
                              borderColor: isSelected ? 'transparent' : 'rgba(26,42,94,0.14)',
                              background: isSelected
                                ? 'linear-gradient(135deg, rgba(245,197,24,1) 0%, rgba(245,197,24,0.84) 100%)'
                                : 'white',
                              color: 'var(--primary-blue, #1a2a5e)',
                              boxShadow: isSelected ? '0 12px 24px rgba(245, 197, 24, 0.22)' : 'none'
                            }}
                          >
                            {option === 'original' ? t('repairRequest.conditionOriginal') : option === 'refurbished' ? t('repairRequest.conditionRefurbished') : t('repairRequest.conditionUnsure')}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                  {t('repairRequest.uploadImages')}
                </CardTitle>
                <p className="text-sm leading-6" style={{ color: 'var(--gray-600, #475569)' }}>
                  {t('repairRequest.uploadImagesDesc')}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  id="images"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={images.length >= 5}
                />
                <label
                  htmlFor="images"
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-10 text-center transition ${images.length >= 5 ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-50'}`}
                  style={{ borderColor: 'rgba(26,42,94,0.16)', background: 'rgba(248,250,252,0.9)' }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'rgba(245, 197, 24, 0.18)', color: 'var(--primary-blue, #1a2a5e)' }}>
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                    {t('repairRequest.addPhotos')}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {t('repairRequest.imageHint', { count: images.length })}
                  </p>
                </label>

                {imagePreviewUrls.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {imagePreviewUrls.map((url, index) => (
                      <div key={index} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <img
                          src={url}
                          alt={t('repairRequest.previewAlt', { index: index + 1 })}
                          className="aspect-[4/3] h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white opacity-100 shadow-md transition hover:scale-105 sm:opacity-0 sm:group-hover:opacity-100"
                          aria-label={t('repairRequest.removeImage')}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                  {t('repairRequest.submitButton')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl border px-4 py-4 text-sm leading-6" style={{ borderColor: 'rgba(16,185,129,0.24)', background: 'rgba(236,253,245,0.9)', color: '#065f46' }}>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{t('repairRequest.submitInfo')}</span>
                  </div>
                </div>

                <ul className="space-y-3 text-sm leading-6" style={{ color: 'var(--gray-600, #475569)' }}>
                  {supportPoints.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--accent-yellow, #f5c518)' }} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col gap-3">
                  <Button
                    type="submit"
                    ref={submitButtonRef}
                    disabled={submitting}
                    className="h-12 w-full rounded-full text-base font-semibold text-white"
                    style={{ background: 'var(--primary-blue, #1a2a5e)' }}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('repairRequest.submitting')}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {t('repairRequest.submitButton')}
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => navigate('/')}
                    className="h-12 w-full rounded-full border-[rgba(26,42,94,0.16)] font-semibold text-[var(--primary-blue,_#1a2a5e)]"
                  >
                    {t('repairRequest.backToConfig')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </section>

      <Dialog open={showDeviceDialog} onOpenChange={setShowDeviceDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Edit2 className="h-5 w-5" />
              {t('repairRequest.changeDeviceTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('repairRequest.changeDeviceDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                1. {t('repairRequest.selectDeviceType')} <span className="text-red-500">*</span>
              </label>
              <Select value={selectedDeviceType} onValueChange={handleDeviceTypeChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('repairRequest.selectDeviceTypePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {deviceTypes.map((type) => (
                    <SelectItem key={type._id} value={type._id}>
                      <span className="capitalize">{type.name}</span>
                      <span className="ml-2 text-xs text-gray-500">({type.count})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                2. {t('repairRequest.selectBrand')} <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedManufacturer}
                onValueChange={handleManufacturerChange}
                disabled={!selectedDeviceType || loadingManufacturers}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={
                    loadingManufacturers ? t('repairRequest.loading') :
                    !selectedDeviceType ? t('repairRequest.selectBrandFirst') :
                    t('repairRequest.selectBrandPlaceholder')
                  } />
                </SelectTrigger>
                <SelectContent>
                  {manufacturers.map((manufacturer) => (
                    <SelectItem key={manufacturer._id} value={manufacturer._id}>
                      {manufacturer.name}
                      <span className="ml-2 text-xs text-gray-500">({manufacturer.count} {t('repairRequest.models')})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                3. {t('repairRequest.selectModelLabel')} <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={!selectedManufacturer || loadingModels}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={
                    loadingModels ? t('repairRequest.loading') :
                    !selectedManufacturer ? t('repairRequest.selectManufacturerFirst') :
                    t('repairRequest.selectModelPlaceholder')
                  } />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model._id} value={model._id}>
                      <div className="flex items-center gap-2">
                        {model.image && (
                          <img
                            src={model.image}
                            alt={model.name}
                            className="h-6 w-6 object-contain"
                            onError={(e) => e.currentTarget.style.display = 'none'}
                          />
                        )}
                        <span>{model.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedModel && models.find(m => m._id === selectedModel) && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-center gap-3">
                  {models.find(m => m._id === selectedModel)?.image && (
                    <img
                      src={models.find(m => m._id === selectedModel)?.image}
                      alt="Selected device"
                      className="h-16 w-16 object-contain"
                    />
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">
                      {models.find(m => m._id === selectedModel)?.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {manufacturers.find(m => m._id === selectedManufacturer)?.name} · {deviceTypes.find(dt => dt._id === selectedDeviceType)?.name}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeviceDialog(false)}>
              {t('repairRequest.cancel')}
            </Button>
            <Button
              onClick={handleConfirmDeviceChange}
              disabled={!selectedModel}
              className="bg-[#1a2a5e] hover:bg-[#0f1d45]"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {t('repairRequest.confirmDevice')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showLoginDialog && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.3)',
              zIndex: 9998
            }}
            onClick={() => setShowLoginDialog(false)}
          />
          <LoginDialog
            isOpen={showLoginDialog}
            onClose={() => setShowLoginDialog(false)}
            anchorElement={submitButtonRef.current}
            onLoginSuccess={() => {
              const form = document.querySelector('form') as HTMLFormElement
              if (form) {
                form.requestSubmit()
              }
            }}
          />
        </>
      )}
    </>
  )
}
