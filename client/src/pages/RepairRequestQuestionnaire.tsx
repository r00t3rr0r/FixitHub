import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { createRepairRequest } from "@/api/repairRequests"
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
  Package
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface SelectedDevice {
  _id: string
  name: string
  deviceType: string
  manufacturer: string
  manufacturerId: string
}

export function RepairRequestQuestionnaire() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  // Get device information from navigation state
  const selectedDevice = location.state?.device as SelectedDevice | null

  const [formData, setFormData] = useState({
    issueDescription: "",
    issueOccurredDate: "",
    repairAttempts: "",
    additionalInfo: ""
  })

  const [images, setImages] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Redirect if no device selected
  if (!selectedDevice) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
        <Card className="border-2 border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-6 w-6" />
              No Device Selected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Please select a device first before requesting repair service.
            </p>
            <Button onClick={() => navigate("/new-order")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back to Order Form
            </Button>
          </CardContent>
        </Card>
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
        title: "Too many images",
        description: "You can upload a maximum of 5 images",
        variant: "destructive"
      })
      return
    }

    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not an image file`,
          variant: "destructive"
        })
        return false
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "File too large",
          description: `${file.name} exceeds 5MB limit`,
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
      newErrors.issueDescription = "Issue description is required"
    } else if (formData.issueDescription.trim().length < 20) {
      newErrors.issueDescription = "Please provide a more detailed description (at least 20 characters)"
    }

    if (!formData.issueOccurredDate) {
      newErrors.issueOccurredDate = "Please specify when the issue occurred"
    }

    if (!formData.repairAttempts.trim()) {
      newErrors.repairAttempts = "Please indicate if you've attempted any repairs"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly",
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
        repairAttempts: formData.repairAttempts,
        additionalInfo: formData.additionalInfo || "",
        images: imageUrls
      }

      console.log("Submitting repair request:", requestData)

      const response = await createRepairRequest(requestData)

      toast({
        title: "Success!",
        description: "Your repair request has been submitted successfully. Our team will review it and contact you soon.",
      })

      // Navigate to customer orders/requests page
      navigate("/orders")
    } catch (error: any) {
      console.error("Error submitting repair request:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to submit repair request. Please try again.",
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
    <div className="max-w-4xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="space-y-2">
        <Button
          variant="ghost"
          onClick={() => navigate("/new-order")}
          className="mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Order Form
        </Button>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg shadow-lg">
            <FileText className="h-6 w-6 text-white" />
          </div>
          Request Repair Service
        </h1>
        <p className="text-muted-foreground">
          Provide details about your device issue and our team will review your request
        </p>
      </div>

      {/* Selected Device Display */}
      <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Selected Device
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 bg-white/50 dark:bg-gray-900/30 rounded-lg">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg shadow-md">
              {getDeviceTypeIcon(selectedDevice.deviceType)}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">{selectedDevice.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">{selectedDevice.deviceType}</Badge>
                <Badge variant="outline">{selectedDevice.manufacturer}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
          Please provide as much detail as possible about your device issue. This helps our technicians
          prepare the right tools and parts, and provide you with an accurate quote.
        </AlertDescription>
      </Alert>

      {/* Repair Request Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Issue Description */}
        <Card className="border-2 hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-5 w-5 text-purple-600" />
              Issue Description
            </CardTitle>
            <CardDescription>
              Describe the problem with your device in detail
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label htmlFor="issueDescription" className="text-sm font-semibold">
                What is wrong with your device? <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="issueDescription"
                placeholder="Example: The screen is cracked and not responding to touch. The device fell from about 1 meter height..."
                value={formData.issueDescription}
                onChange={(e) => handleInputChange("issueDescription", e.target.value)}
                rows={5}
                className={`border-2 resize-none ${errors.issueDescription ? 'border-red-500' : ''}`}
              />
              {errors.issueDescription && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.issueDescription}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Minimum 20 characters. Be as specific as possible.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* When Issue Occurred */}
        <Card className="border-2 hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-orange-600" />
              When Did This Occur?
            </CardTitle>
            <CardDescription>
              When did you first notice this issue?
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label htmlFor="issueOccurredDate" className="text-sm font-semibold">
                Date or timeframe <span className="text-red-500">*</span>
              </Label>
              <Input
                id="issueOccurredDate"
                type="text"
                placeholder="Example: Yesterday evening, Last week, 2 days ago..."
                value={formData.issueOccurredDate}
                onChange={(e) => handleInputChange("issueOccurredDate", e.target.value)}
                className={`border-2 ${errors.issueOccurredDate ? 'border-red-500' : ''}`}
              />
              {errors.issueOccurredDate && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.issueOccurredDate}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                You can specify an approximate date or timeframe
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Repair Attempts */}
        <Card className="border-2 hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-5 w-5 text-blue-600" />
              Previous Repair Attempts
            </CardTitle>
            <CardDescription>
              Have you tried fixing this yourself or taken it elsewhere?
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label htmlFor="repairAttempts" className="text-sm font-semibold">
                Repair or troubleshooting attempts <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="repairAttempts"
                placeholder="Example: No, this is the first time. OR Yes, I tried restarting the device and updating the software but the issue persists..."
                value={formData.repairAttempts}
                onChange={(e) => handleInputChange("repairAttempts", e.target.value)}
                rows={4}
                className={`border-2 resize-none ${errors.repairAttempts ? 'border-red-500' : ''}`}
              />
              {errors.repairAttempts && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.repairAttempts}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Include any repair shops you've visited or DIY attempts
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Additional Information */}
        <Card className="border-2 hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-5 w-5 text-green-600" />
              Additional Information
            </CardTitle>
            <CardDescription>
              Any other details that might be helpful (optional)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label htmlFor="additionalInfo" className="text-sm font-semibold">
                Additional notes or context
              </Label>
              <Textarea
                id="additionalInfo"
                placeholder="Example: Device is still under warranty, Has a screen protector, Urgently needed for work..."
                value={formData.additionalInfo}
                onChange={(e) => handleInputChange("additionalInfo", e.target.value)}
                rows={3}
                className="border-2 resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Optional but helpful for our technicians
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Image Upload */}
        <Card className="border-2 hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-5 w-5 text-indigo-600" />
              Upload Images
            </CardTitle>
            <CardDescription>
              Photos of the damage or issue (optional, max 5 images)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-3">
              <Label htmlFor="images" className="text-sm font-semibold">
                Add photos of your device
              </Label>
              <Input
                id="images"
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="cursor-pointer h-12 border-2 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-blue-400 file:to-blue-500 file:text-white file:font-semibold hover:file:from-blue-500 hover:file:to-blue-600"
                disabled={images.length >= 5}
              />
              <p className="text-xs text-muted-foreground">
                JPG, PNG, or GIF. Max 5MB per image. {images.length}/5 images uploaded
              </p>
            </div>

            {/* Image Previews */}
            {imagePreviewUrls.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {imagePreviewUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <AlertCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Card className="border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 shadow-lg">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Alert className="border-green-300 dark:border-green-700">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm">
                  After submission, our team will review your request and contact you within 24 hours
                  with a quote and estimated repair time.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/new-order")}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="min-w-[200px] bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-5 w-5" />
                      Submit Repair Request
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
