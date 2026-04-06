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
import "./RepairRequestQuestionnaire.css"

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
      <div className="repair-request-page">
        <div className="mcrepair-card animate-fadeInUp" style={{ borderColor: 'var(--mcrepair-danger)' }}>
          <div className="mcrepair-card-header">
            <h2 className="mcrepair-card-title" style={{ color: 'var(--mcrepair-danger)' }}>
              <AlertCircle className="h-6 w-6" />
              {t('repairRequest.noDeviceSelected')}
            </h2>
          </div>
          <div className="mcrepair-card-content">
            <p style={{ marginBottom: '20px', color: 'var(--mcrepair-gray-500)' }}>
              {t('repairRequest.noDeviceSelectedDesc')}
            </p>
            <button onClick={() => navigate("/new-order")} className="mcrepair-btn mcrepair-btn-primary">
              <ArrowLeft className="h-4 w-4" />
              {t('repairRequest.backToOrderForm')}
            </button>
          </div>
        </div>
      </div>
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

  return (
    <div className="repair-request-page animate-fadeInUp">
      {/* Header */}
      <div className="repair-request-header">
        <button
          onClick={() => navigate("/new-order")}
          className="repair-request-back-btn"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('repairRequest.backToOrderForm')}
        </button>
        <div className="repair-request-title">
          <div className="repair-request-title-icon">
            <FileText className="h-6 w-6" style={{ color: 'var(--mcrepair-white)' }} />
          </div>
          <div>
            <h1>{t('repairRequest.title')}</h1>
            <p className="repair-request-subtitle">
              {t('repairRequest.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Selected Device Display */}
      <div className="mcrepair-card device-display-card">
        <div className="mcrepair-card-header mcrepair-card-header-primary">
          <div className="device-header-content">
            <h2 className="mcrepair-card-title">
              <CheckCircle className="h-5 w-5" style={{ color: 'var(--mcrepair-success)' }} />
              {t('repairRequest.selectedDevice')}
            </h2>
            <button
              type="button"
              onClick={handleOpenDeviceDialog}
              className="device-change-button"
            >
              <Edit2 className="h-4 w-4" />
              {t('repairRequest.changeDevice')}
            </button>
          </div>
        </div>
        <div className="mcrepair-card-content">
          <div className="device-display-content-enhanced">
            <div className="device-image-container">
              {selectedDevice.image ? (
                <img
                  src={selectedDevice.image}
                  alt={selectedDevice.name}
                  className="device-image"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
              ) : null}
              <div className="device-image-fallback" style={{ display: selectedDevice.image ? 'none' : 'flex' }}>
                {getDeviceTypeIcon(selectedDevice.deviceType)}
              </div>
            </div>
            <div className="device-info-enhanced">
              <h3 className="device-name">{selectedDevice.name}</h3>
              <div className="device-meta">
                <div className="device-meta-item">
                  <span className="device-meta-label">{t('repairRequest.manufacturer')}</span>
                  <span className="device-meta-value">{selectedDevice.manufacturer}</span>
                </div>
                <div className="device-meta-item">
                  <span className="device-meta-label">{t('repairRequest.deviceType')}</span>
                  <span className="device-meta-value">{selectedDevice.deviceType}</span>
                </div>
              </div>
              <div className="device-model-number-field">
                <label htmlFor="modelNumber" className="model-number-label">
                  <Info className="h-3 w-3" />
                  {t('repairRequest.modelNumber')}
                </label>
                <input
                  type="text"
                  id="modelNumber"
                  placeholder={t('repairRequest.modelNumberPlaceholder')}
                  value={formData.modelNumber}
                  onChange={(e) => handleInputChange("modelNumber", e.target.value)}
                  className="model-number-input"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <div className="mcrepair-alert">
        <Info className="h-5 w-5" />
        <div className="mcrepair-alert-content">
          {t('repairRequest.infoAlert')}
        </div>
      </div>

      {/* Repair Request Form */}
      <form onSubmit={handleSubmit}>
        {/* Issue Details - Combined Card */}
        <div className="mcrepair-card compact-card">
          <div className="mcrepair-card-header-compact">
            <h2 className="mcrepair-card-title-compact">
              <AlertCircle className="h-4 w-4" />
              {t('repairRequest.issueDetailsTitle')}
            </h2>
          </div>
          <div className="mcrepair-card-content-compact">
            <div className="issue-details-grid">
              {/* Issue Description */}
              <div className="issue-description-field">
                <label htmlFor="issueDescription" className="mcrepair-label-compact">
                  {t('repairRequest.issueDescriptionLabel')} <span className="required">*</span>
                </label>
                <textarea
                  id="issueDescription"
                  placeholder={t('repairRequest.issueDescriptionPlaceholder')}
                  value={formData.issueDescription}
                  onChange={(e) => handleInputChange("issueDescription", e.target.value)}
                  rows={4}
                  className={`mcrepair-textarea-compact ${errors.issueDescription ? 'error' : ''}`}
                />
                {errors.issueDescription && (
                  <span className="mcrepair-error-text">
                    <AlertCircle className="h-3 w-3" />
                    {errors.issueDescription}
                  </span>
                )}
              </div>

              {/* When Issue Occurred */}
              <div className="issue-date-field">
                <label htmlFor="issueOccurredDate" className="mcrepair-label-compact">
                  <Calendar className="h-3 w-3" />
                  {t('repairRequest.whenDidItHappen')} <span className="required">*</span>
                </label>
                <input
                  id="issueOccurredDate"
                  type="text"
                  placeholder={t('repairRequest.whenPlaceholder')}
                  value={formData.issueOccurredDate}
                  onChange={(e) => handleInputChange("issueOccurredDate", e.target.value)}
                  className={`mcrepair-input-compact ${errors.issueOccurredDate ? 'error' : ''}`}
                />
                {errors.issueOccurredDate && (
                  <span className="mcrepair-error-text">
                    <AlertCircle className="h-3 w-3" />
                    {errors.issueOccurredDate}
                  </span>
                )}
                <span className="mcrepair-helper-text-compact">
                  {t('repairRequest.approximateDate')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Extended Information Button (Collapsible) */}
        <button
          type="button"
          onClick={() => setShowExtendedInfo(!showExtendedInfo)}
          className="extended-info-toggle"
        >
          <div className="extended-info-toggle-content">
            <Info className="h-5 w-5" style={{ color: 'var(--mcrepair-primary)', flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <h4 className="extended-info-title">
                {t('repairRequest.extendedInfoTitle')}
              </h4>
              <p className="extended-info-subtitle">
                {t('repairRequest.extendedInfoSubtitle')}
              </p>
            </div>
            {showExtendedInfo ? 
              <ChevronUp className="h-5 w-5" style={{ color: 'var(--mcrepair-primary)' }} /> : 
              <ChevronDown className="h-5 w-5" style={{ color: 'var(--mcrepair-primary)' }} />
            }
          </div>
        </button>

        {/* Extended Information Content (Collapsible) */}
        {showExtendedInfo && (
          <div className="extended-info-content">
            {/* Water Damage */}
            <div className="extended-info-field">
              <label className="extended-info-label">
                <Droplets className="h-4 w-4" style={{ color: 'var(--mcrepair-primary)' }} />
                {t('repairRequest.waterDamage')}
              </label>
              <div className="extended-info-options">
                {['no', 'yes', 'unsure'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setWaterDamage(option as any)}
                    className={`extended-info-option ${waterDamage === option ? 'selected' : ''}`}
                  >
                    {option === 'no' ? t('repairRequest.waterDamageNo') : option === 'yes' ? t('repairRequest.waterDamageYes') : t('repairRequest.waterDamageUnsure')}
                  </button>
                ))}
              </div>
            </div>

            {/* Previous Repair Details */}
            <div className="extended-info-field">
              <label className="extended-info-label">
                <Wrench className="h-4 w-4" style={{ color: 'var(--mcrepair-primary)' }} />
                {t('repairRequest.previousRepairDetails')}
              </label>
              <textarea
                placeholder={t('repairRequest.previousRepairPlaceholder')}
                value={previousRepairDetails}
                onChange={(e) => setPreviousRepairDetails(e.target.value)}
                rows={3}
                className="mcrepair-textarea"
              />
              <span className="mcrepair-helper-text">
                {t('repairRequest.previousRepairHint')}
              </span>
            </div>

            {/* Item Condition */}
            <div className="extended-info-field">
              <label className="extended-info-label">
                <Package className="h-4 w-4" style={{ color: 'var(--mcrepair-primary)' }} />
                {t('repairRequest.itemCondition')}
              </label>
              <div className="extended-info-options">
                {['original', 'refurbished', 'unsure'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setItemCondition(option as any)}
                    className={`extended-info-option ${itemCondition === option ? 'selected' : ''}`}
                  >
                    {option === 'original' ? t('repairRequest.conditionOriginal') : option === 'refurbished' ? t('repairRequest.conditionRefurbished') : t('repairRequest.conditionUnsure')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Image Upload */}
        <div className="mcrepair-card">
          <div className="mcrepair-card-header mcrepair-card-header-primary">
            <h2 className="mcrepair-card-title">
              <Upload className="h-5 w-5" />
              {t('repairRequest.uploadImages')}
            </h2>
            <p className="mcrepair-card-description">
              {t('repairRequest.uploadImagesDesc')}
            </p>
          </div>
          <div className="mcrepair-card-content">
            <div className="mcrepair-form-group">
              <label htmlFor="images" className="mcrepair-label">
                {t('repairRequest.addPhotos')}
              </label>
              <input
                id="images"
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="mcrepair-file-input"
                disabled={images.length >= 5}
              />
              <span className="mcrepair-helper-text">
                {t('repairRequest.imageHint', { count: images.length })}
              </span>
            </div>

            {/* Image Previews */}
            {imagePreviewUrls.length > 0 && (
              <div className="image-preview-grid">
                {imagePreviewUrls.map((url, index) => (
                  <div key={index} className="image-preview-item">
                    <img
                      src={url}
                      alt={t('repairRequest.previewAlt', { index: index + 1 })}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="image-remove-btn"
                      aria-label={t('repairRequest.removeImage')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="submit-section">
          <div className="mcrepair-card submit-card">
            <div className="mcrepair-card-content">
              <div className="mcrepair-alert mcrepair-alert-success" style={{ marginBottom: '24px' }}>
                <CheckCircle className="h-5 w-5" />
                <div className="mcrepair-alert-content">
                  {t('repairRequest.submitInfo')}
                </div>
              </div>

              <div className="submit-actions">
                <button
                  type="button"
                  onClick={() => navigate("/new-order")}
                  disabled={submitting}
                  className="mcrepair-btn mcrepair-btn-outline"
                >
                  {t('repairRequest.cancel')}
                </button>
                <button
                  type="submit"
                  ref={submitButtonRef}
                  disabled={submitting}
                  className="mcrepair-btn mcrepair-btn-success mcrepair-btn-large"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {t('repairRequest.submitting')}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      {t('repairRequest.submitButton')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Device Change Dialog */}
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
            {/* Device Type Selection */}
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
                      <span className="text-xs text-gray-500 ml-2">({type.count})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Manufacturer Selection */}
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
                      <span className="text-xs text-gray-500 ml-2">({manufacturer.count} {t('repairRequest.models')})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model Selection */}
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
                            className="w-6 h-6 object-contain"
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

            {/* Preview selected model */}
            {selectedModel && models.find(m => m._id === selectedModel) && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  {models.find(m => m._id === selectedModel)?.image && (
                    <img 
                      src={models.find(m => m._id === selectedModel)?.image} 
                      alt="Selected device"
                      className="w-16 h-16 object-contain"
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
            <Button
              variant="outline"
              onClick={() => setShowDeviceDialog(false)}
            >
              {t('repairRequest.cancel')}
            </Button>
            <Button
              onClick={handleConfirmDeviceChange}
              disabled={!selectedModel}
              className="bg-[#1a2a5e] hover:bg-[#0f1d45]"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {t('repairRequest.confirmDevice')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Login Dialog */}
      {showLoginDialog && (
        <>
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            zIndex: 9998
          }} onClick={() => setShowLoginDialog(false)} />
          <LoginDialog 
            isOpen={showLoginDialog} 
            onClose={() => setShowLoginDialog(false)}
            anchorElement={submitButtonRef.current}
            onLoginSuccess={() => {
              // After successful login, submit the form automatically
              const form = document.querySelector('form') as HTMLFormElement
              if (form) {
                form.requestSubmit()
              }
            }}
          />
        </>
      )}
    </div>
  )
}
